import os
import pytest
from tabular.profiler import discover_remote_tables

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
    # Attempting to connect to unreachable MySQL should fail cleanly with DuckDB/IO error
    with pytest.raises(Exception):
        discover_remote_tables(
            db_type="mysql",
            host="127.0.0.1",
            port=3306,
            database="testdb",
            user="root",
            password="pwd",
        )


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
