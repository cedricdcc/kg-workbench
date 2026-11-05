import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import JSONResponse

from .config import settings
from .daemon import heartbeat_loop, worker_loop
from .profiler import profile_tabular_data

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tabular.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing KG Workbench Tabular Service (%s)", settings.worker_id)
    stop_event = asyncio.Event()
    heartbeat_task = asyncio.create_task(heartbeat_loop(stop_event))
    worker_task = asyncio.create_task(worker_loop(stop_event))

    yield

    logger.info("Stopping Tabular background tasks...")
    stop_event.set()
    heartbeat_task.cancel()
    worker_task.cancel()
    await asyncio.gather(heartbeat_task, worker_task, return_exceptions=True)


app = FastAPI(
    title="KG Workbench Tabular Service",
    description="DuckDB Tabular Profiling and Ingestion Engine",
    version="0.1.0",
    lifespan=lifespan,
)


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "tabular",
        "worker_id": settings.worker_id,
        "engine": "duckdb",
    }


@app.post("/profile")
async def profile_endpoint(
    file: UploadFile = File(...),
    file_type: str = Form(default="csv"),
) -> Any:
    file_bytes = await file.read()
    try:
        res = profile_tabular_data(
            file_bytes=file_bytes,
            file_name=file.filename or "uploaded_dataset",
            file_type=file_type,
        )
        res["processedBy"] = settings.worker_id
        return res
    except Exception as exc:
        logger.exception("Failed to profile tabular data: %s", exc)
        return JSONResponse(status_code=400, content={"error": str(exc)})
