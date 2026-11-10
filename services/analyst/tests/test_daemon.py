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


@pytest.mark.asyncio
async def test_execute_job_query_empty_graph():
    claimed_job = {
        "ok": True,
        "job": {
            "id": "analyst-job-empty",
            "attempts": 1,
        },
        "eventPayload": {
            "eventType": "analyst.query_requested",
            "conversationId": "conv-123",
            "query": "Find all organizations in Finland",
            "facts": [],
            "anchors": [],
            "datasets": [],
        },
    }

    mock_client = AsyncMock()
    mock_complete_resp = MagicMock()
    mock_complete_resp.status_code = 200
    mock_client.post.return_value = mock_complete_resp

    await execute_job(mock_client, claimed_job)

    assert mock_client.post.called
    complete_call = mock_client.post.call_args
    assert "analyst-job-empty/complete" in complete_call[0][0]
    result = complete_call[1]["json"]["result"]
    assert result["status"] == "completed"
    assert "no accepted facts or mapped tabular datasets" in result["answer"]
    assert result["subgraph"]["nodes"] == []
    assert len(result["reasoningTrace"]) > 0


@pytest.mark.asyncio
async def test_execute_job_query_with_facts():
    claimed_job = {
        "ok": True,
        "job": {
            "id": "analyst-job-facts",
            "attempts": 1,
        },
        "eventPayload": {
            "eventType": "analyst.query_requested",
            "conversationId": "conv-456",
            "query": "Find marine institutes in Finland",
            "facts": [
                {
                    "id": "fact-1",
                    "subject_text": "Finnish Marine Institute",
                    "subject_entity_id": "ent-1",
                    "relation_text": "located_in",
                    "object_text": "Finland",
                    "object_entity_id": "ent-2",
                    "review_status": "accepted",
                    "confidence": 0.95,
                    "document_id": "doc-1",
                }
            ],
            "anchors": [
                {
                    "fact_id": "fact-1",
                    "sourceName": "Baltic Survey 2025",
                    "document_id": "doc-1",
                    "paragraph_id": 3,
                    "quote_text": "The Finnish Marine Institute operates headquarters in Finland.",
                }
            ],
            "datasets": [],
        },
    }

    mock_client = AsyncMock()
    mock_complete_resp = MagicMock()
    mock_complete_resp.status_code = 200
    mock_client.post.return_value = mock_complete_resp

    await execute_job(mock_client, claimed_job)

    assert mock_client.post.called
    complete_call = mock_client.post.call_args
    assert "analyst-job-facts/complete" in complete_call[0][0]
    result = complete_call[1]["json"]["result"]
    assert result["status"] == "completed"
    assert len(result["subgraph"]["nodes"]) >= 2
    assert len(result["subgraph"]["edges"]) >= 1
    assert len(result["reasoningTrace"]) >= 3
    assert len(result["citations"]) >= 1
    assert "Finnish Marine Institute" in result["answer"]

