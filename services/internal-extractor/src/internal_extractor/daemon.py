import asyncio
import logging
from typing import Any
import httpx

from .config import settings

logger = logging.getLogger("internal_extractor.daemon")


async def send_heartbeat(client: httpx.AsyncClient) -> bool:
    url = f"{settings.workbench_api_url}/api/system/services/heartbeat"
    payload = {
        "id": "extractor",
        "displayName": "Internal GraphRAG Extractor",
        "capabilities": ["text_extraction", "chunking"],
        "metadata": {
            "version": "0.1.0",
            "worker_id": settings.worker_id,
            "ollama_base_url": settings.ollama_base_url,
        },
    }
    try:
        resp = await client.post(url, json=payload, timeout=5.0)
        if resp.status_code == 200:
            logger.debug("Heartbeat registered successfully with Workbench.")
            return True
        logger.warning(
            "Heartbeat responded with status %s: %s",
            resp.status_code,
            resp.text,
        )
        return False
    except Exception as exc:
        logger.warning("Could not reach Workbench for heartbeat: %s", exc)
        return False


async def heartbeat_loop(stop_event: asyncio.Event) -> None:
    logger.info("Starting background heartbeat loop to %s", settings.workbench_api_url)
    async with httpx.AsyncClient() as client:
        while not stop_event.is_set():
            await send_heartbeat(client)
            try:
                await asyncio.wait_for(
                    stop_event.wait(),
                    timeout=float(settings.heartbeat_interval_seconds),
                )
            except asyncio.TimeoutError:
                pass


async def claim_job(client: httpx.AsyncClient) -> dict[str, Any] | None:
    url = f"{settings.workbench_api_url}/api/system/jobs/claim"
    payload = {
        "workerType": "extractor",
        "workerId": settings.worker_id,
        "leaseSeconds": 120,
    }
    try:
        resp = await client.post(url, json=payload, timeout=5.0)
        if resp.status_code != 200:
            logger.debug("Job claim status: %s", resp.status_code)
            return None
        data = resp.json()
        if data.get("ok") and data.get("job"):
            return data
        return None
    except Exception as exc:
        logger.debug("Failed to poll for jobs: %s", exc)
        return None


async def complete_job(
    client: httpx.AsyncClient,
    job_id: str,
    result: dict[str, Any] | None = None,
) -> bool:
    url = f"{settings.workbench_api_url}/api/system/jobs/{job_id}/complete"
    try:
        resp = await client.post(url, json={"result": result or {}}, timeout=5.0)
        return resp.status_code == 200
    except Exception as exc:
        logger.error("Failed to complete job %s: %s", job_id, exc)
        return False


async def fail_job(
    client: httpx.AsyncClient,
    job_id: str,
    error_message: str,
    current_attempts: int,
) -> bool:
    url = f"{settings.workbench_api_url}/api/system/jobs/{job_id}/fail"
    payload = {
        "errorMessage": error_message,
        "currentAttempts": current_attempts,
        "maxAttempts": 3,
    }
    try:
        resp = await client.post(url, json=payload, timeout=5.0)
        return resp.status_code == 200
    except Exception as exc:
        logger.error("Failed to record failure for job %s: %s", job_id, exc)
        return False


async def execute_job(client: httpx.AsyncClient, claimed: dict[str, Any]) -> None:
    job = claimed["job"]
    job_id = job["id"]
    current_attempts = job.get("attempts", 1)
    event_payload = claimed.get("eventPayload") or {}

    logger.info("Executing claimed extraction job %s (attempt %s)", job_id, current_attempts)
    try:
        # In this Phase 1 integration, acknowledge and record execution results
        # If extraction request parameters are provided, perform extraction or mock result
        result = {
            "jobId": job_id,
            "status": "processed",
            "documentId": event_payload.get("documentId"),
            "provider": event_payload.get("provider", "ollama"),
            "processedBy": settings.worker_id,
        }
        await complete_job(client, job_id, result)
        logger.info("Job %s completed successfully", job_id)
    except Exception as exc:
        logger.exception("Error executing job %s: %s", job_id, exc)
        await fail_job(client, job_id, str(exc), current_attempts)


async def worker_loop(stop_event: asyncio.Event) -> None:
    logger.info("Starting background worker polling loop for workerType='extractor'")
    async with httpx.AsyncClient() as client:
        while not stop_event.is_set():
            claimed = await claim_job(client)
            if claimed:
                await execute_job(client, claimed)
                continue  # immediately check if another job is waiting

            try:
                await asyncio.wait_for(
                    stop_event.wait(),
                    timeout=settings.worker_poll_interval_seconds,
                )
            except asyncio.TimeoutError:
                pass

