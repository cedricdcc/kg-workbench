import io
import math
import os
import tempfile
from datetime import date, datetime
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
    if t in {"DATE", "TIMESTAMP", "TIMESTAMPTZ", "TIME", "TIMETZ", "TIMESTAMP_MS", "TIMESTAMP_NS"}:
        return "date"
    return "string"


def sanitize_value(val: Any) -> Any:
    if val is None:
        return None
    if isinstance(val, (datetime, date)):
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
