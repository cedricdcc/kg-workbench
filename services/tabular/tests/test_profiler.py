import io
import pyarrow as pa
import pyarrow.parquet as pq
import openpyxl
import pytest

from tabular.profiler import profile_tabular_data


def test_profile_csv():
    csv_content = b"id,name,is_active,score\n1,Alice,true,95.5\n2,Bob,false,88.0\n3,Charlie,true,92.3\n"
    res = profile_tabular_data(csv_content, "users.csv", "csv")

    assert res["rowCount"] == 3
    assert res["columnCount"] == 4
    col_names = [c["name"] for c in res["columns"]]
    assert col_names == ["id", "name", "is_active", "score"]

    col_map = {c["name"]: c for c in res["columns"]}
    assert col_map["id"]["inferredKgType"] == "number"
    assert col_map["name"]["inferredKgType"] == "string"
    assert col_map["is_active"]["inferredKgType"] == "boolean"
    assert col_map["score"]["inferredKgType"] == "number"

    # id has 3 distinct non-null values -> candidate key
    assert col_map["id"]["isUniqueCandidate"] is True
    assert ["id"] in res["candidateKeys"]
    assert len(res["previewRows"]) == 3


def test_profile_parquet():
    table = pa.Table.from_arrays(
        [
            pa.array(["SKU-1", "SKU-2", "SKU-3"]),
            pa.array([19.99, 29.99, 9.99]),
        ],
        names=["sku", "price"],
    )
    sink = io.BytesIO()
    pq.write_table(table, sink)
    parquet_bytes = sink.getvalue()

    res = profile_tabular_data(parquet_bytes, "products.parquet", "parquet")
    assert res["rowCount"] == 3
    assert res["columnCount"] == 2
    assert ["sku"] in res["candidateKeys"]


def test_profile_excel():
    wb = openpyxl.Workbook()
    ws = wb.active
    assert ws is not None
    ws.append(["dept_id", "dept_name", "budget"])
    ws.append(["D1", "Engineering", 500000])
    ws.append(["D2", "Marketing", 200000])

    buf = io.BytesIO()
    wb.save(buf)
    excel_bytes = buf.getvalue()

    res = profile_tabular_data(excel_bytes, "departments.xlsx", "excel")
    assert res["rowCount"] == 2
    assert res["columnCount"] == 3
    assert ["dept_id"] in res["candidateKeys"]


def test_profile_handles_nulls():
    csv_content = b"code,label\nA1,Item 1\nA2,\n,Item 3\n"
    res = profile_tabular_data(csv_content, "items.csv", "csv")

    assert res["rowCount"] == 3
    col_map = {c["name"]: c for c in res["columns"]}
    assert col_map["code"]["nullCount"] == 1
    assert col_map["label"]["nullCount"] == 1
    # neither column is unique candidate because nullCount > 0
    assert col_map["code"]["isUniqueCandidate"] is False

