import asyncio
import base64
import hashlib
import json
import logging
import os
from typing import Any
import httpx

from .config import settings
from .profiler import (
    discover_remote_tables,
    profile_remote_database_table,
    profile_tabular_data,
)

logger = logging.getLogger("tabular.daemon")


def _decrypt_aes_gcm(ciphertext_hex: str, iv_hex: str, tag_hex: str) -> str:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    seed = (
        os.environ.get("SETTINGS_ENCRYPTION_SECRET")
        or os.environ.get("APP_PASSWORD")
        or "kg-workbench-local-dev-seed"
    )
    key = hashlib.sha256(seed.encode("utf-8")).digest()
    aes = AESGCM(key)
    iv = bytes.fromhex(iv_hex)
    ct_with_tag = bytes.fromhex(ciphertext_hex) + bytes.fromhex(tag_hex)
    decrypted_bytes = aes.decrypt(iv, ct_with_tag, None)
    return decrypted_bytes.decode("utf-8")


def decrypt_credential(password_field: Any) -> str:
    if not password_field:
        return ""
    if isinstance(password_field, str):
        trimmed = password_field.strip()
        if trimmed.startswith("{") and trimmed.endswith("}"):
            try:
                data = json.loads(trimmed)
                if isinstance(data, dict) and "ciphertext" in data and "iv" in data and "tag" in data:
                    return _decrypt_aes_gcm(data["ciphertext"], data["iv"], data["tag"])
            except Exception:
                pass
        return password_field
    elif isinstance(password_field, dict):
        if "ciphertext" in password_field and "iv" in password_field and "tag" in password_field:
            return _decrypt_aes_gcm(
                password_field["ciphertext"],
                password_field["iv"],
                password_field["tag"],
            )
    return str(password_field)


async def send_heartbeat(client: httpx.AsyncClient) -> bool:
    url = f"{settings.workbench_api_url}/api/system/services/heartbeat"
    payload = {
        "id": "tabular",
        "displayName": "DuckDB Tabular Ingestion & Profiling Worker",
        "capabilities": [
            "tabular_profiling",
            "schema_induction",
            "format_csv",
            "format_parquet",
            "format_excel",
        ],
        "metadata": {
            "version": "0.1.0",
            "worker_id": settings.worker_id,
            "engine": "duckdb",
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
        "workerType": "tabular",
        "workerId": settings.worker_id,
        "leaseSeconds": 180,
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
        logger.debug("Failed to poll for tabular jobs: %s", exc)
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
        logger.error("Failed to complete tabular job %s: %s", job_id, exc)
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
        logger.error("Failed to record failure for tabular job %s: %s", job_id, exc)
        return False


async def execute_job(client: httpx.AsyncClient, claimed: dict[str, Any]) -> None:
    job = claimed["job"]
    job_id = job["id"]
    current_attempts = job.get("attempts", 1)
    event_payload = claimed.get("eventPayload") or {}

    logger.info("Executing claimed tabular job %s (attempt %s)", job_id, current_attempts)
    try:
        event_type = (
            event_payload.get("eventType")
            or event_payload.get("event_type")
            or claimed.get("eventType")
            or job.get("eventType")
            or job.get("event_type")
        )

        is_db_discover = (
            event_type == "tabular.db_discover_requested"
            or (
                ("dbType" in event_payload or "db_type" in event_payload)
                and "table" not in event_payload
                and "tableName" not in event_payload
                and "fileBufferBase64" not in event_payload
                and "filePath" not in event_payload
            )
        )
        is_db_profile = (
            event_type == "tabular.db_profile_requested"
            or (
                ("dbType" in event_payload or "db_type" in event_payload)
                and ("table" in event_payload or "tableName" in event_payload)
            )
        )

        if is_db_discover:
            db_type = event_payload.get("dbType") or event_payload.get("db_type") or "postgres"
            host = event_payload.get("host", "localhost")
            default_port = 5432 if str(db_type).lower() in {"postgres", "postgresql"} else 3306
            port = int(event_payload.get("port") or default_port)
            database = event_payload.get("database") or event_payload.get("db", "")
            user = event_payload.get("user") or event_payload.get("username", "")
            raw_pwd = (
                event_payload.get("password")
                or event_payload.get("encryptedPassword")
                or event_payload.get("encrypted_password")
                or ""
            )
            password = decrypt_credential(raw_pwd)
            ssl_mode = event_payload.get("sslMode") or event_payload.get("ssl_mode") or "prefer"

            tables = discover_remote_tables(
                db_type=db_type,
                host=host,
                port=port,
                database=database,
                user=user,
                password=password,
                ssl_mode=ssl_mode,
            )
            result = {
                "tables": tables,
                "processedBy": settings.worker_id,
            }
            await complete_job(client, job_id, result)
            logger.info("Tabular db_discover job %s completed successfully", job_id)
            return

        if is_db_profile:
            db_type = event_payload.get("dbType") or event_payload.get("db_type") or "postgres"
            host = event_payload.get("host", "localhost")
            default_port = 5432 if str(db_type).lower() in {"postgres", "postgresql"} else 3306
            port = int(event_payload.get("port") or default_port)
            database = event_payload.get("database") or event_payload.get("db", "")
            user = event_payload.get("user") or event_payload.get("username", "")
            raw_pwd = (
                event_payload.get("password")
                or event_payload.get("encryptedPassword")
                or event_payload.get("encrypted_password")
                or ""
            )
            password = decrypt_credential(raw_pwd)
            table = event_payload.get("table") or event_payload.get("tableName") or ""
            schema = event_payload.get("schema") or "public"
            ssl_mode = event_payload.get("sslMode") or event_payload.get("ssl_mode") or "prefer"

            profile_res = profile_remote_database_table(
                db_type=db_type,
                host=host,
                port=port,
                database=database,
                user=user,
                password=password,
                table=table,
                schema=schema,
                ssl_mode=ssl_mode,
            )
            profile_res["processedBy"] = settings.worker_id
            await complete_job(client, job_id, profile_res)
            logger.info("Tabular db_profile job %s completed successfully", job_id)
            return

        file_name = event_payload.get("fileName", "dataset")
        file_type = event_payload.get("fileType", "csv")
        options = event_payload.get("options") or {}

        # Resolve file bytes
        file_bytes: bytes | None = None
        if "fileBufferBase64" in event_payload:
            file_bytes = base64.b64decode(event_payload["fileBufferBase64"])
        elif "filePath" in event_payload:
            with open(event_payload["filePath"], "rb") as f:
                file_bytes = f.read()

        if file_bytes is None:
            raise ValueError("No file payload provided (expected 'fileBufferBase64' or 'filePath')")

        profile_res = profile_tabular_data(
            file_bytes=file_bytes,
            file_name=file_name,
            file_type=file_type,
            options=options,
        )
        profile_res["processedBy"] = settings.worker_id

        await complete_job(client, job_id, profile_res)
        logger.info("Tabular job %s completed successfully", job_id)
    except Exception as exc:
        logger.exception("Error executing tabular job %s: %s", job_id, exc)
        await fail_job(client, job_id, str(exc), current_attempts)


async def worker_loop(stop_event: asyncio.Event) -> None:
    logger.info("Starting background worker polling loop for workerType='tabular'")
    async with httpx.AsyncClient() as client:
        while not stop_event.is_set():
            claimed = await claim_job(client)
            if claimed:
                await execute_job(client, claimed)
                continue

            try:
                await asyncio.wait_for(
                    stop_event.wait(),
                    timeout=settings.worker_poll_interval_seconds,
                )
            except asyncio.TimeoutError:
                pass

