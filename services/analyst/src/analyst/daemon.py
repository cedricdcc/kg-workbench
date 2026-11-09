import asyncio
import logging
from typing import Any
import httpx

from .config import settings

logger = logging.getLogger("analyst.daemon")


async def send_heartbeat(client: httpx.AsyncClient) -> bool:
    url = f"{settings.workbench_api_url}/api/system/services/heartbeat"
    payload = {
        "id": "analyst",
        "service": "analyst",
        "displayName": "NetworkX Graph Analyst Worker",
        "workerId": settings.worker_id,
        "status": "healthy",
        "capabilities": ["graph_qa", "vector_search", "drift_detection"],
        "metadata": {
            "version": "0.1.0",
            "worker_id": settings.worker_id,
            "engine": "networkx",
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
        "workerType": "analyst",
        "workerId": settings.worker_id,
        "leaseSeconds": 120,
    }
    try:
        resp = await client.post(url, json=payload, timeout=5.0)
        if resp.status_code != 200:
            return None
        data = resp.json()
        if data.get("ok") and data.get("job"):
            return data
        return None
    except Exception as exc:
        logger.debug("Failed to poll for analyst jobs: %s", exc)
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
        logger.error("Failed to complete analyst job %s: %s", job_id, exc)
        return False


async def fail_job(
    client: httpx.AsyncClient,
    job_id: str,
    error_message: str,
    current_attempts: int,
    max_attempts: int = 3,
) -> bool:
    url = f"{settings.workbench_api_url}/api/system/jobs/{job_id}/fail"
    payload = {
        "errorMessage": error_message,
        "currentAttempts": current_attempts,
        "maxAttempts": max_attempts,
    }
    try:
        resp = await client.post(url, json=payload, timeout=5.0)
        return resp.status_code == 200
    except Exception as exc:
        logger.error("Failed to record failure for analyst job %s: %s", job_id, exc)
        return False


async def execute_job(client: httpx.AsyncClient, claimed: dict[str, Any]) -> None:
    job = claimed.get("job") or {}
    job_id = job.get("id")
    if not job_id:
        return
    current_attempts = job.get("attempts", 1)
    event_payload = claimed.get("eventPayload") or {}

    logger.info("Executing claimed analyst job %s (attempt %s)", job_id, current_attempts)
    try:
        event_type = (
            event_payload.get("eventType")
            or event_payload.get("event_type")
            or claimed.get("eventType")
            or job.get("eventType")
            or job.get("event_type")
        )

        result: dict[str, Any] = {
            "processedBy": settings.worker_id,
            "status": "processed",
            "eventType": event_type,
        }
        await complete_job(client, job_id, result)
        logger.info("Analyst job %s completed successfully", job_id)
    except Exception as exc:
        logger.exception("Error executing analyst job %s: %s", job_id, exc)
        await fail_job(client, job_id, str(exc), current_attempts)


async def worker_loop(stop_event: asyncio.Event) -> None:
    logger.info("Starting background worker polling loop for workerType='analyst'")
    async with httpx.AsyncClient() as client:
        while not stop_event.is_set():
            claimed = await claim_job(client)
            if claimed:
                await execute_job(client, claimed)
                continue

            try:
                await asyncio.wait_for(
                    stop_event.wait(),
                    timeout=float(settings.poll_interval_seconds),
                )
            except asyncio.TimeoutError:
                pass
