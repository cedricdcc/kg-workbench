import decimal
import io
import math
import os
import tempfile
import uuid
from datetime import date, datetime, time
from typing import Any

import duckdb
import openpyxl
import pyarrow as pa
import pyarrow.parquet as pq


def map_duckdb_type_to_kg(duckdb_type: str) -> str:
    t = duckdb_type.upper().split("(")[0].strip()
    if t in {
        "BIGINT",
        "INTEGER",
        "SMALLINT",
        "TINYINT",
        "HUGEINT",
        "UBIGINT",
        "UINTEGER",
        "USMALLINT",
        "UTINYINT",
        "FLOAT",
        "DOUBLE",
        "DECIMAL",
        "NUMERIC",
        "REAL",
    }:
        return "number"
    if t in {"BOOLEAN", "BOOL"}:
        return "boolean"
    if (
        t in {"DATE", "TIMESTAMP", "TIMESTAMPTZ", "TIME", "TIMETZ", "TIMESTAMP_MS", "TIMESTAMP_NS"}
        or "TIMESTAMP" in t
        or "TIME" in t
        or "DATE" in t
    ):
        return "date"
    return "string"


def sanitize_value(val: Any) -> Any:
    if val is None:
        return None
    if isinstance(val, uuid.UUID):
        return str(val)
    if isinstance(val, decimal.Decimal):
        return float(val)
    if isinstance(val, (bytes, bytearray)):
        return val.decode("utf-8", errors="replace")
    if isinstance(val, (datetime, date, time)):
        return val.isoformat()
    if isinstance(val, float):
        if math.isnan(val) or math.isinf(val):
            return None
        return val
    return val


def profile_tabular_data(
    file_bytes: bytes,
    file_name: str,
    file_type: str,
    options: dict[str, Any] | None = None,
) -> dict[str, Any]:
    con = duckdb.connect(database=":memory:")
    options = options or {}
    clean_type = file_type.lower().replace(".", "").strip()

    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{clean_type}") as tmp:
            tmp.write(file_bytes)
            temp_path = tmp.name

        if clean_type in {"csv", "tsv", "txt"}:
            delimiter = options.get("delimiter")
            if delimiter:
                con.execute(
                    "CREATE TABLE data_table AS SELECT * FROM read_csv(?, delim=?, auto_detect=true, sample_size=10000)",
                    [temp_path, delimiter],
                )
            else:
                con.execute(
                    "CREATE TABLE data_table AS SELECT * FROM read_csv(?, auto_detect=true, sample_size=10000)",
                    [temp_path],
                )
        elif clean_type in {"parquet", "pq"}:
            con.execute(
                "CREATE TABLE data_table AS SELECT * FROM read_parquet(?)",
                [temp_path],
            )
        elif clean_type in {"xlsx", "xls", "excel"}:
            wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
            sheet_name = options.get("sheetName")
            ws = wb[sheet_name] if sheet_name and sheet_name in wb.sheetnames else wb.active
            if ws is None:
                raise ValueError("No active worksheet found in Excel workbook")

            rows = list(ws.iter_rows(values_only=True))
            if not rows or len(rows) < 1:
                raise ValueError("Excel file contains no data rows")

            raw_headers = rows[0]
            headers = [
                str(h).strip() if h is not None and str(h).strip() else f"col_{idx+1}"
                for idx, h in enumerate(raw_headers)
            ]
            data_rows = rows[1:]

            # Convert to PyArrow Table
            cols_data: list[list[Any]] = [[] for _ in headers]
            for row in data_rows:
                for col_idx in range(len(headers)):
                    val = row[col_idx] if col_idx < len(row) else None
                    cols_data[col_idx].append(val)

            arrow_table = pa.Table.from_arrays(
                [pa.array(col_data) for col_data in cols_data],
                names=headers,
            )
            con.register("data_table", arrow_table)
        else:
            raise ValueError(f"Unsupported tabular file format: {file_type}")

        # Compute summary metrics
        row_count = con.execute("SELECT count(*) FROM data_table").fetchone()[0]
        schema_info = con.execute("DESCRIBE data_table").fetchall()
        column_count = len(schema_info)

        columns_profile = []
        candidate_keys: list[list[str]] = []

        for row in schema_info:
            col_name = str(row[0])
            duckdb_type = str(row[1])
            inferred_kg = map_duckdb_type_to_kg(duckdb_type)

            # Escaped column identifier
            clean_col = col_name.replace('"', '""')
            escaped_col = f'"{clean_col}"'

            stats_sql = f"""
                SELECT
                    count(*) - count({escaped_col}) as null_count,
                    count(DISTINCT {escaped_col}) as distinct_count,
                    min({escaped_col}) as min_val,
                    max({escaped_col}) as max_val
                FROM data_table
            """
            stats_row = con.execute(stats_sql).fetchone()
            null_count = stats_row[0] if stats_row else 0
            distinct_count = stats_row[1] if stats_row else 0
            min_val = sanitize_value(stats_row[2]) if stats_row else None
            max_val = sanitize_value(stats_row[3]) if stats_row else None

            null_pct = round((null_count / row_count * 100), 2) if row_count > 0 else 0.0
            is_unique = (null_count == 0) and (distinct_count == row_count) and (row_count > 0)

            sample_sql = f"""
                SELECT DISTINCT {escaped_col}
                FROM data_table
                WHERE {escaped_col} IS NOT NULL
                LIMIT 5
            """
            samples = [
                sanitize_value(s[0])
                for s in con.execute(sample_sql).fetchall()
                if s[0] is not None
            ]

            if is_unique:
                candidate_keys.append([col_name])

            columns_profile.append({
                "name": col_name,
                "duckdbType": duckdb_type,
                "inferredKgType": inferred_kg,
                "nullCount": null_count,
                "nullPercentage": null_pct,
                "distinctCount": distinct_count,
                "isUniqueCandidate": is_unique,
                "minValue": min_val,
                "maxValue": max_val,
                "sampleValues": samples,
            })

        # Top 20 preview rows
        preview_cur = con.execute("SELECT * FROM data_table LIMIT 20")
        col_names = [d[0] for d in preview_cur.description]
        preview_rows = []
        for p_row in preview_cur.fetchall():
            preview_rows.append({
                col_names[i]: sanitize_value(p_row[i])
                for i in range(len(col_names))
            })

        return {
            "fileName": file_name,
            "fileType": clean_type,
            "rowCount": row_count,
            "columnCount": column_count,
            "estimatedSizeBytes": len(file_bytes),
            "columns": columns_profile,
            "candidateKeys": candidate_keys,
            "previewRows": preview_rows,
        }
    finally:
        con.close()
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass


def _escape_libpq(val: Any) -> str:
    s = str(val)
    s_esc = s.replace("\\", "\\\\").replace("'", "\\'")
    return f"'{s_esc}'"


def _escape_mysql_val(val: Any) -> str:
    s = str(val)
    s_esc = s.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{s_esc}"'


def _build_db_connection(
    db_type: str,
    host: str,
    port: int,
    database: str,
    user: str,
    password: str,
    ssl_mode: str = "prefer",
) -> tuple[str, str, str, str]:
    db_norm = db_type.lower().strip()
    if db_norm in {"postgres", "postgresql"}:
        extension_name = "postgres"
        attach_type = "POSTGRES"
        parts = [
            f"host={_escape_libpq(host)}",
            f"port={_escape_libpq(port)}",
            f"dbname={_escape_libpq(database)}",
            f"user={_escape_libpq(user)}",
            f"password={_escape_libpq(password)}",
        ]
        if ssl_mode:
            parts.append(f"sslmode={_escape_libpq(ssl_mode)}")
        conn_str = " ".join(parts)
        return db_norm, extension_name, attach_type, conn_str
    elif db_norm == "mysql":
        extension_name = "mysql"
        attach_type = "MYSQL"
        parts = [
            f"host={_escape_mysql_val(host)}",
            f"port={port}",
            f"user={_escape_mysql_val(user)}",
            f"password={_escape_mysql_val(password)}",
            f"database={_escape_mysql_val(database)}",
        ]
        conn_str = " ".join(parts)
        return db_norm, extension_name, attach_type, conn_str
    else:
        raise ValueError(f"Unsupported database type: {db_type}")


def discover_remote_tables(
    db_type: str,
    host: str,
    port: int,
    database: str,
    user: str,
    password: str,
    ssl_mode: str = "prefer",
) -> list[dict[str, Any]]:
    db_norm, extension_name, attach_type, conn_str = _build_db_connection(
        db_type=db_type,
        host=host,
        port=port,
        database=database,
        user=user,
        password=password,
        ssl_mode=ssl_mode,
    )

    con = duckdb.connect(database=":memory:")
    attached = False
    try:
        con.execute(f"LOAD {extension_name};")
        conn_str_sql = conn_str.replace("'", "''")
        con.execute(f"ATTACH '{conn_str_sql}' AS remote_db (TYPE {attach_type}, READ_ONLY);")
        attached = True

        # Query estimated rows for postgres if available
        estimated_rows_map: dict[tuple[str, str], int] = {}
        if db_norm in {"postgres", "postgresql"}:
            try:
                est_rows = con.execute(
                    """
                    SELECT n.nspname, c.relname, c.reltuples
                    FROM remote_db.pg_catalog.pg_class c
                    JOIN remote_db.pg_catalog.pg_namespace n ON n.oid = c.relnamespace
                    WHERE c.relkind IN ('r', 'v', 'm', 'p')
                    """
                ).fetchall()
                for s_name, t_name, reltuples in est_rows:
                    if reltuples is not None and reltuples >= 0:
                        estimated_rows_map[(str(s_name), str(t_name))] = int(reltuples)
            except Exception:
                pass

        # Query information_schema.tables
        raw_tables = con.execute(
            """
            SELECT table_schema, table_name, table_type
            FROM remote_db.information_schema.tables
            ORDER BY table_schema, table_name
            """
        ).fetchall()

        excluded_schemas = {
            "information_schema",
            "pg_catalog",
            "pg_toast",
            "mysql",
            "performance_schema",
            "sys",
        }

        tables: list[dict[str, Any]] = []
        for row in raw_tables:
            schema_name = str(row[0])
            table_name = str(row[1])
            table_type = str(row[2])

            schema_lower = schema_name.lower()
            if schema_lower in excluded_schemas or schema_lower.startswith("pg_"):
                continue

            estimated = estimated_rows_map.get((schema_name, table_name))
            tables.append({
                "schema": schema_name,
                "name": table_name,
                "type": table_type,
                "estimated_rows": estimated,
            })

        return tables
    finally:
        if attached:
            try:
                con.execute("DETACH remote_db;")
            except Exception:
                pass
        con.close()


def profile_remote_database_table(
    db_type: str,
    host: str,
    port: int,
    database: str,
    user: str,
    password: str,
    table: str,
    schema: str = "public",
    ssl_mode: str = "prefer",
) -> dict[str, Any]:
    db_norm, extension_name, attach_type, conn_str = _build_db_connection(
        db_type=db_type,
        host=host,
        port=port,
        database=database,
        user=user,
        password=password,
        ssl_mode=ssl_mode,
    )

    con = duckdb.connect(database=":memory:")
    attached = False
    try:
        con.execute(f"LOAD {extension_name};")
        conn_str_sql = conn_str.replace("'", "''")
        con.execute(f"ATTACH '{conn_str_sql}' AS remote_db (TYPE {attach_type}, READ_ONLY);")
        attached = True

        clean_table = table.replace('"', '""')
        clean_schema = schema.replace('"', '""') if schema else None

        if db_norm == "mysql":
            # In MySQL, schema is typically the database catalog
            if not clean_schema or clean_schema.lower() == "public":
                clean_schema = database.replace('"', '""')

        if clean_schema:
            target_ref = f'"remote_db"."{clean_schema}"."{clean_table}"'
        else:
            target_ref = f'"remote_db"."{clean_table}"'

        row_count = con.execute(f"SELECT count(*) FROM {target_ref}").fetchone()[0]
        schema_info = con.execute(f"DESCRIBE {target_ref}").fetchall()
        column_count = len(schema_info)

        columns_profile = []
        candidate_keys: list[list[str]] = []

        for row in schema_info:
            col_name = str(row[0])
            duckdb_type = str(row[1])
            inferred_kg = map_duckdb_type_to_kg(duckdb_type)

            clean_col = col_name.replace('"', '""')
            escaped_col = f'"{clean_col}"'

            if row_count == 0:
                null_count = 0
                null_pct = 0.0
                distinct_count = 0
                is_unique = False
                min_val = None
                max_val = None
                samples: list[Any] = []
            else:
                stats_sql = f"""
                    SELECT
                        count(*) - count({escaped_col}) as null_count,
                        count(DISTINCT {escaped_col}) as distinct_count,
                        min({escaped_col}) as min_val,
                        max({escaped_col}) as max_val
                    FROM {target_ref}
                """
                try:
                    stats_row = con.execute(stats_sql).fetchone()
                    null_count = stats_row[0] if stats_row else 0
                    distinct_count = stats_row[1] if stats_row else 0
                    min_val = sanitize_value(stats_row[2]) if stats_row else None
                    max_val = sanitize_value(stats_row[3]) if stats_row else None
                except Exception:
                    try:
                        null_count = con.execute(f"SELECT count(*) - count({escaped_col}) FROM {target_ref}").fetchone()[0]
                    except Exception:
                        null_count = 0
                    distinct_count = 0
                    min_val = None
                    max_val = None

                null_pct = round((null_count / row_count * 100), 2)
                is_unique = (null_count == 0) and (distinct_count == row_count)

                sample_sql = f"""
                    SELECT DISTINCT {escaped_col}
                    FROM {target_ref}
                    WHERE {escaped_col} IS NOT NULL
                    LIMIT 5
                """
                try:
                    samples = [
                        sanitize_value(s[0])
                        for s in con.execute(sample_sql).fetchall()
                        if s[0] is not None
                    ]
                except Exception:
                    samples = []

            if is_unique:
                candidate_keys.append([col_name])

            columns_profile.append({
                "name": col_name,
                "duckdbType": duckdb_type,
                "inferredKgType": inferred_kg,
                "nullCount": null_count,
                "nullPercentage": null_pct,
                "distinctCount": distinct_count,
                "isUniqueCandidate": is_unique,
                "minValue": min_val,
                "maxValue": max_val,
                "sampleValues": samples,
            })

        preview_rows = []
        if row_count > 0:
            preview_cur = con.execute(f"SELECT * FROM {target_ref} LIMIT 20")
            col_names = [d[0] for d in preview_cur.description]
            for p_row in preview_cur.fetchall():
                preview_rows.append({
                    col_names[i]: sanitize_value(p_row[i])
                    for i in range(len(col_names))
                })

        return {
            "fileName": table,
            "fileType": db_norm,
            "rowCount": row_count,
            "columnCount": column_count,
            "estimatedSizeBytes": 0,
            "columns": columns_profile,
            "candidateKeys": candidate_keys,
            "previewRows": preview_rows,
        }
    finally:
        if attached:
            try:
                con.execute("DETACH remote_db;")
            except Exception:
                pass
        con.close()


