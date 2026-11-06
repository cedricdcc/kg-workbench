import os
import pytest
from tabular.profiler import discover_remote_tables, profile_remote_database_table

POSTGRES_HOST = os.environ.get("POSTGRES_HOST", "db")
POSTGRES_PORT = int(os.environ.get("POSTGRES_PORT", "5432"))
POSTGRES_DB = os.environ.get("POSTGRES_DB", "postgres")
POSTGRES_USER = os.environ.get("POSTGRES_USER", "postgres")
POSTGRES_PASSWORD = os.environ.get("POSTGRES_PASSWORD", "55a64bfd04c37dbb0af0dfe60c3b60bf")


def test_discover_remote_tables_postgres():
    tables = discover_remote_tables(
        db_type="postgres",
        host=POSTGRES_HOST,
        port=POSTGRES_PORT,
        database=POSTGRES_DB,
        user=POSTGRES_USER,
        password=POSTGRES_PASSWORD,
        ssl_mode="prefer",
    )

    assert isinstance(tables, list)
    assert len(tables) > 0

    # Verify each item adheres to interface
    for item in tables:
        assert "schema" in item and isinstance(item["schema"], str)
        assert "name" in item and isinstance(item["name"], str)
        assert "type" in item and isinstance(item["type"], str)
        assert "estimated_rows" in item
        assert item["estimated_rows"] is None or isinstance(item["estimated_rows"], int)

    # Verify internal system schemas like pg_catalog and information_schema are filtered out
    discovered_schemas = {t["schema"] for t in tables}
    assert "pg_catalog" not in discovered_schemas
    assert "information_schema" not in discovered_schemas
    for s in discovered_schemas:
        assert not s.startswith("pg_"), f"Schema {s} should have been filtered out"

    # Verify expected public tables exist in postgres test instance
    table_names = {(t["schema"], t["name"]) for t in tables}
    assert ("public", "ontology_documents") in table_names
    assert ("public", "dataset_sources") in table_names


def test_discover_remote_tables_unsupported_type():
    with pytest.raises(ValueError, match="Unsupported database type"):
        discover_remote_tables(
            db_type="unsupported_db",
            host="localhost",
            port=1234,
            database="test",
            user="user",
            password="pwd",
        )


def test_discover_remote_tables_case_insensitive():
    tables = discover_remote_tables(
        db_type="PostgreSQL",
        host=POSTGRES_HOST,
        port=POSTGRES_PORT,
        database=POSTGRES_DB,
        user=POSTGRES_USER,
        password=POSTGRES_PASSWORD,
        ssl_mode="prefer",
    )
    assert len(tables) > 0


def test_discover_remote_tables_mysql_connect_attempt():
    # Attempting to connect to unreachable MySQL should fail cleanly with DuckDB/IO error, not syntax error
    with pytest.raises(Exception) as exc_info:
        discover_remote_tables(
            db_type="mysql",
            host="127.0.0.1",
            port=3306,
            database="testdb",
            user="root",
            password="pwd with spaces and 'quotes'",
        )
    assert "Parser Error" not in str(exc_info.value)

    # Empty password
    with pytest.raises(Exception) as exc_info_empty:
        discover_remote_tables(
            db_type="mysql",
            host="127.0.0.1",
            port=3306,
            database="testdb",
            user="root",
            password="",
        )
    assert "Parser Error" not in str(exc_info_empty.value)


def test_profile_remote_database_table_mysql_quoting():
    with pytest.raises(Exception) as exc_info:
        profile_remote_database_table(
            db_type="mysql",
            host="127.0.0.1",
            port=3306,
            database="testdb",
            user="root",
            password="pwd with spaces and 'quotes'",
            table="my_table",
        )
    assert "Parser Error" not in str(exc_info.value)


def test_discover_remote_tables_detach_on_query_error(monkeypatch):
    import duckdb

    real_connect = duckdb.connect

    class FailingConnection:
        def __init__(self, inner):
            self.inner = inner
            self.detached = False

        def execute(self, sql, *args, **kwargs):
            if "SELECT table_schema" in sql:
                raise RuntimeError("Simulated query failure")
            if "DETACH" in sql:
                self.detached = True
            return self.inner.execute(sql, *args, **kwargs)

        def close(self):
            return self.inner.close()

    def mock_connect(*args, **kwargs):
        conn = real_connect(*args, **kwargs)
        wrapper = FailingConnection(conn)
        mock_connect.last_conn = wrapper
        return wrapper

    monkeypatch.setattr(duckdb, "connect", mock_connect)

    with pytest.raises(RuntimeError, match="Simulated query failure"):
        discover_remote_tables(
            db_type="postgres",
            host=POSTGRES_HOST,
            port=POSTGRES_PORT,
            database=POSTGRES_DB,
            user=POSTGRES_USER,
            password=POSTGRES_PASSWORD,
        )

    assert mock_connect.last_conn.detached is True



def test_discover_remote_tables_invalid_connection():
    with pytest.raises(Exception):
        discover_remote_tables(
            db_type="postgres",
            host="invalid-host-that-does-not-exist",
            port=5432,
            database="postgres",
            user="postgres",
            password="wrong_password",
            ssl_mode="disable",
        )


def test_profile_remote_database_table_postgres():
    res = profile_remote_database_table(
        db_type="postgres",
        host=POSTGRES_HOST,
        port=POSTGRES_PORT,
        database=POSTGRES_DB,
        user=POSTGRES_USER,
        password=POSTGRES_PASSWORD,
        table="ontology_documents",
        schema="public",
        ssl_mode="prefer",
    )

    assert isinstance(res, dict)
    assert res["fileName"] == "ontology_documents"
    assert res["fileType"] in {"postgres", "postgresql"}
    assert res["rowCount"] > 0
    assert res["columnCount"] > 0
    assert isinstance(res["columns"], list)
    assert len(res["columns"]) == res["columnCount"]
    assert isinstance(res["candidateKeys"], list)
    assert isinstance(res["previewRows"], list)

    col_names = {c["name"] for c in res["columns"]}
    assert "id" in col_names
    assert "name" in col_names
    assert "created_at" in col_names

    id_col = next(c for c in res["columns"] if c["name"] == "id")
    assert id_col["duckdbType"] == "UUID"
    assert id_col["inferredKgType"] == "string"
    assert id_col["nullCount"] == 0
    assert id_col["nullPercentage"] == 0.0
    assert id_col["distinctCount"] == res["rowCount"]
    assert id_col["isUniqueCandidate"] is True
    assert ["id"] in res["candidateKeys"]

    created_col = next(c for c in res["columns"] if c["name"] == "created_at")
    assert created_col["inferredKgType"] == "date"

    assert len(res["previewRows"]) > 0
    assert len(res["previewRows"]) <= 20
    first_row = res["previewRows"][0]
    assert "id" in first_row
    assert "name" in first_row


def test_profile_remote_database_table_empty():
    res = profile_remote_database_table(
        db_type="postgres",
        host=POSTGRES_HOST,
        port=POSTGRES_PORT,
        database=POSTGRES_DB,
        user=POSTGRES_USER,
        password=POSTGRES_PASSWORD,
        table="dataset_sources",
        schema="public",
        ssl_mode="prefer",
    )

    assert isinstance(res, dict)
    assert res["fileName"] == "dataset_sources"
    assert res["rowCount"] == 0
    assert res["columnCount"] > 0
    assert res["candidateKeys"] == []
    assert res["previewRows"] == []

    for col in res["columns"]:
        assert col["nullCount"] == 0
        assert col["nullPercentage"] == 0.0
        assert col["distinctCount"] == 0
        assert col["isUniqueCandidate"] is False
        assert col["minValue"] is None
        assert col["maxValue"] is None
        assert col["sampleValues"] == []


def test_profile_remote_database_table_unsupported():
    with pytest.raises(ValueError, match="Unsupported database type"):
        profile_remote_database_table(
            db_type="sqlite_custom",
            host="localhost",
            port=5432,
            database="test",
            user="user",
            password="pwd",
            table="any_table",
        )


def test_profile_remote_database_table_nonexistent():
    with pytest.raises(Exception):
        profile_remote_database_table(
            db_type="postgres",
            host=POSTGRES_HOST,
            port=POSTGRES_PORT,
            database=POSTGRES_DB,
            user=POSTGRES_USER,
            password=POSTGRES_PASSWORD,
            table="table_that_definitely_does_not_exist_xyz",
            schema="public",
        )


def test_profile_remote_database_table_detach_on_error(monkeypatch):
    import duckdb

    real_connect = duckdb.connect

    class FailingConnection:
        def __init__(self, inner):
            self.inner = inner
            self.detached = False

        def execute(self, sql, *args, **kwargs):
            if "SELECT count(*)" in sql:
                raise RuntimeError("Simulated query execution error")
            if "DETACH" in sql:
                self.detached = True
            return self.inner.execute(sql, *args, **kwargs)

        def close(self):
            return self.inner.close()

    def mock_connect(*args, **kwargs):
        conn = real_connect(*args, **kwargs)
        wrapper = FailingConnection(conn)
        mock_connect.last_conn = wrapper
        return wrapper

    monkeypatch.setattr(duckdb, "connect", mock_connect)

    with pytest.raises(RuntimeError, match="Simulated query execution error"):
        profile_remote_database_table(
            db_type="postgres",
            host=POSTGRES_HOST,
            port=POSTGRES_PORT,
            database=POSTGRES_DB,
            user=POSTGRES_USER,
            password=POSTGRES_PASSWORD,
            table="ontology_documents",
            schema="public",
        )

    assert mock_connect.last_conn.detached is True


@pytest.mark.asyncio
async def test_daemon_db_discover_requested():
    from unittest.mock import AsyncMock
    from tabular.daemon import execute_job

    claimed_job = {
        "ok": True,
        "job": {
            "id": "job-discover-test",
            "attempts": 1,
        },
        "eventPayload": {
            "eventType": "tabular.db_discover_requested",
            "dbType": "postgres",
            "host": POSTGRES_HOST,
            "port": POSTGRES_PORT,
            "database": POSTGRES_DB,
            "user": POSTGRES_USER,
            "password": POSTGRES_PASSWORD,
            "sslMode": "prefer",
        },
    }

    mock_client = AsyncMock()
    mock_resp = AsyncMock()
    mock_resp.status_code = 200
    mock_client.post.return_value = mock_resp

    await execute_job(mock_client, claimed_job)

    assert mock_client.post.called
    complete_call = mock_client.post.call_args
    assert "job-discover-test/complete" in complete_call[0][0]
    result = complete_call[1]["json"]["result"]
    assert "tables" in result
    assert isinstance(result["tables"], list)
    assert len(result["tables"]) > 0


@pytest.mark.asyncio
async def test_daemon_db_profile_requested():
    from unittest.mock import AsyncMock
    from tabular.daemon import execute_job

    claimed_job = {
        "ok": True,
        "job": {
            "id": "job-profile-test",
            "attempts": 1,
        },
        "eventPayload": {
            "eventType": "tabular.db_profile_requested",
            "dbType": "postgres",
            "host": POSTGRES_HOST,
            "port": POSTGRES_PORT,
            "database": POSTGRES_DB,
            "user": POSTGRES_USER,
            "password": POSTGRES_PASSWORD,
            "table": "ontology_documents",
            "schema": "public",
            "sslMode": "prefer",
        },
    }

    mock_client = AsyncMock()
    mock_resp = AsyncMock()
    mock_resp.status_code = 200
    mock_client.post.return_value = mock_resp

    await execute_job(mock_client, claimed_job)

    assert mock_client.post.called
    complete_call = mock_client.post.call_args
    assert "job-profile-test/complete" in complete_call[0][0]
    result = complete_call[1]["json"]["result"]
    assert result["fileName"] == "ontology_documents"
    assert result["rowCount"] > 0
    assert len(result["columns"]) > 0


@pytest.mark.asyncio
async def test_daemon_encrypted_credentials():
    import hashlib
    import os
    from unittest.mock import AsyncMock
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    from tabular.daemon import execute_job

    seed = (
        os.environ.get("SETTINGS_ENCRYPTION_SECRET")
        or os.environ.get("APP_PASSWORD")
        or "kg-workbench-local-dev-seed"
    )
    key = hashlib.sha256(seed.encode("utf-8")).digest()
    aes = AESGCM(key)
    iv_bytes = b"123456789012"
    ciphertext_full = aes.encrypt(iv_bytes, POSTGRES_PASSWORD.encode("utf-8"), None)
    ct = ciphertext_full[:-16].hex()
    tag = ciphertext_full[-16:].hex()
    iv = iv_bytes.hex()

    claimed_job = {
        "ok": True,
        "job": {
            "id": "job-encrypted-test",
            "attempts": 1,
        },
        "eventPayload": {
            "eventType": "tabular.db_profile_requested",
            "dbType": "postgres",
            "host": POSTGRES_HOST,
            "port": POSTGRES_PORT,
            "database": POSTGRES_DB,
            "user": POSTGRES_USER,
            "password": {
                "ciphertext": ct,
                "iv": iv,
                "tag": tag,
            },
            "table": "ontology_documents",
            "schema": "public",
            "sslMode": "prefer",
        },
    }

    mock_client = AsyncMock()
    mock_resp = AsyncMock()
    mock_resp.status_code = 200
    mock_client.post.return_value = mock_resp

    await execute_job(mock_client, claimed_job)

    assert mock_client.post.called
    complete_call = mock_client.post.call_args
    assert "job-encrypted-test/complete" in complete_call[0][0]
    result = complete_call[1]["json"]["result"]
    assert result["fileName"] == "ontology_documents"
    assert result["rowCount"] > 0

