import pytest
import httpx
from internal_extractor.daemon import (
    send_heartbeat,
    claim_job,
    complete_job,
    fail_job,
    execute_job,
)


@pytest.mark.asyncio
async def test_send_heartbeat_success():
    async def mock_post(url, json=None, timeout=None):
        assert "/api/system/services/heartbeat" in url
        assert json["id"] == "extractor"
        assert "capabilities" in json
        return httpx.Response(200, json={"ok": True, "id": "extractor"})

    mock_client = httpx.AsyncClient()
    mock_client.post = mock_post  # type: ignore

    res = await send_heartbeat(mock_client)
    assert res is True


@pytest.mark.asyncio
async def test_send_heartbeat_connection_failure():
    async def mock_post(url, json=None, timeout=None):
        raise httpx.ConnectError("Connection refused")

    mock_client = httpx.AsyncClient()
    mock_client.post = mock_post  # type: ignore

    res = await send_heartbeat(mock_client)
    assert res is False


@pytest.mark.asyncio
async def test_claim_job_found():
    expected_job = {"id": "j-1", "target_worker": "extractor"}

    async def mock_post(url, json=None, timeout=None):
        assert "/api/system/jobs/claim" in url
        assert json["workerType"] == "extractor"
        return httpx.Response(200, json={"ok": True, "job": expected_job})

    mock_client = httpx.AsyncClient()
    mock_client.post = mock_post  # type: ignore

    claimed = await claim_job(mock_client)
    assert claimed is not None
    assert claimed["job"]["id"] == "j-1"


@pytest.mark.asyncio
async def test_claim_job_empty():
    async def mock_post(url, json=None, timeout=None):
        return httpx.Response(200, json={"ok": True, "job": None})

    mock_client = httpx.AsyncClient()
    mock_client.post = mock_post  # type: ignore

    claimed = await claim_job(mock_client)
    assert claimed is None


@pytest.mark.asyncio
async def test_complete_and_fail_job():
    called_urls = []

    async def mock_post(url, json=None, timeout=None):
        called_urls.append(url)
        return httpx.Response(200, json={"ok": True})

    mock_client = httpx.AsyncClient()
    mock_client.post = mock_post  # type: ignore

    ok1 = await complete_job(mock_client, "job-99", {"result": "done"})
    assert ok1 is True
    assert "/api/system/jobs/job-99/complete" in called_urls[0]

    ok2 = await fail_job(mock_client, "job-99", "OOM error", current_attempts=2)
    assert ok2 is True
    assert "/api/system/jobs/job-99/fail" in called_urls[1]


@pytest.mark.asyncio
async def test_execute_job_completes_successfully():
    completed = []

    async def mock_post(url, json=None, timeout=None):
        if "complete" in url:
            completed.append(json)
        return httpx.Response(200, json={"ok": True})

    mock_client = httpx.AsyncClient()
    mock_client.post = mock_post  # type: ignore

    claimed_payload = {
        "job": {"id": "test-job-42", "attempts": 1},
        "eventPayload": {"documentId": "doc-abc", "provider": "ollama"},
    }

    await execute_job(mock_client, claimed_payload)
    assert len(completed) == 1
    assert completed[0]["result"]["jobId"] == "test-job-42"
    assert completed[0]["result"]["status"] == "processed"

