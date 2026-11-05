import base64
import pytest
from unittest.mock import AsyncMock, patch

from tabular.daemon import execute_job, send_heartbeat


@pytest.mark.asyncio
async def test_send_heartbeat():
    mock_client = AsyncMock()
    mock_response = AsyncMock()
    mock_response.status_code = 200
    mock_client.post.return_value = mock_response

    ok = await send_heartbeat(mock_client)
    assert ok is True
    assert mock_client.post.called
    call_args = mock_client.post.call_args
    assert "api/system/services/heartbeat" in call_args[0][0]
    payload = call_args[1]["json"]
    assert payload["id"] == "tabular"
    assert "tabular_profiling" in payload["capabilities"]


@pytest.mark.asyncio
async def test_execute_job_completes_successfully():
    csv_bytes = b"id,val\n1,Alpha\n2,Beta\n"
    csv_b64 = base64.b64encode(csv_bytes).decode("utf-8")

    claimed_job = {
        "ok": True,
        "job": {
            "id": "test-tabular-job-123",
            "attempts": 1,
        },
        "eventPayload": {
            "fileName": "test.csv",
            "fileType": "csv",
            "fileBufferBase64": csv_b64,
            "options": {},
        },
    }

    mock_client = AsyncMock()
    mock_complete_resp = AsyncMock()
    mock_complete_resp.status_code = 200
    mock_client.post.return_value = mock_complete_resp

    await execute_job(mock_client, claimed_job)

    assert mock_client.post.called
    complete_call = mock_client.post.call_args
    assert "test-tabular-job-123/complete" in complete_call[0][0]
    result = complete_call[1]["json"]["result"]
    assert result["rowCount"] == 2
    assert result["columnCount"] == 2

