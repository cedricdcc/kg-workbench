from unittest.mock import AsyncMock, MagicMock
import pytest
from httpx import ASGITransport, AsyncClient

from analyst.config import settings
from analyst.daemon import (
    claim_job,
    complete_job,
    execute_job,
    fail_job,
    send_heartbeat,
)
from analyst.main import app


@pytest.mark.asyncio
async def test_health_endpoint():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        response = await ac.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "analyst"
    assert data["worker_id"] == settings.worker_id
    assert data["engine"] == "networkx"


@pytest.mark.asyncio
async def test_send_heartbeat():
    mock_client = AsyncMock()
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_client.post.return_value = mock_response

    ok = await send_heartbeat(mock_client)
    assert ok is True
    assert mock_client.post.called

    call_args = mock_client.post.call_args
    assert "api/system/services/heartbeat" in call_args[0][0]
    payload = call_args[1]["json"]
    assert payload["service"] == "analyst"
    assert payload["workerId"] == settings.worker_id
    assert payload["status"] == "healthy"
    assert "graph_qa" in payload["capabilities"]
    assert "vector_search" in payload["capabilities"]
    assert "drift_detection" in payload["capabilities"]


@pytest.mark.asyncio
async def test_claim_job():
    mock_client = AsyncMock()
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "ok": True,
        "job": {
            "id": "job-456",
            "workerType": "analyst",
            "attempts": 1,
        },
        "eventPayload": {
            "eventType": "analyst.qa_query",
            "query": "What are the dependencies?",
        },
    }
    mock_client.post.return_value = mock_response

    claimed = await claim_job(mock_client)
    assert claimed is not None
    assert claimed["job"]["id"] == "job-456"

    call_args = mock_client.post.call_args
    assert "api/system/jobs/claim" in call_args[0][0]
    payload = call_args[1]["json"]
    assert payload["workerType"] == "analyst"
    assert payload["workerId"] == settings.worker_id
    assert payload["leaseSeconds"] == 120


@pytest.mark.asyncio
async def test_complete_job():
    mock_client = AsyncMock()
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_client.post.return_value = mock_response

    res = await complete_job(mock_client, "job-456", {"status": "ok"})
    assert res is True
    call_args = mock_client.post.call_args
    assert "api/system/jobs/job-456/complete" in call_args[0][0]
    assert call_args[1]["json"] == {"result": {"status": "ok"}}


@pytest.mark.asyncio
async def test_fail_job():
    mock_client = AsyncMock()
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_client.post.return_value = mock_response

    res = await fail_job(mock_client, "job-456", "Some error occurred", 1)
    assert res is True
    call_args = mock_client.post.call_args
    assert "api/system/jobs/job-456/fail" in call_args[0][0]
    payload = call_args[1]["json"]
    assert payload["errorMessage"] == "Some error occurred"
    assert payload["currentAttempts"] == 1
    assert payload["maxAttempts"] == 3


@pytest.mark.asyncio
async def test_execute_job():
    claimed_job = {
        "ok": True,
        "job": {
            "id": "analyst-job-789",
            "attempts": 1,
        },
        "eventPayload": {
            "eventType": "analyst.qa_query",
            "query": "Find root causes",
        },
    }

    mock_client = AsyncMock()
    mock_complete_resp = MagicMock()
    mock_complete_resp.status_code = 200
    mock_client.post.return_value = mock_complete_resp

    await execute_job(mock_client, claimed_job)

    assert mock_client.post.called
    complete_call = mock_client.post.call_args
    assert "analyst-job-789/complete" in complete_call[0][0]
    result = complete_call[1]["json"]["result"]
    assert result["processedBy"] == settings.worker_id
    assert result["status"] == "processed"
    assert result["eventType"] == "analyst.qa_query"
