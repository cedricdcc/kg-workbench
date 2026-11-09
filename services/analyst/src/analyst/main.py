import asyncio
from contextlib import asynccontextmanager
import logging
from typing import Any
from fastapi import FastAPI

from .config import settings
from .daemon import heartbeat_loop, worker_loop

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("analyst.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing KG Workbench Analyst Service (%s)", settings.worker_id)
    stop_event = asyncio.Event()

    heartbeat_task = asyncio.create_task(heartbeat_loop(stop_event))
    worker_task = asyncio.create_task(worker_loop(stop_event))

    yield

    logger.info("Shutting down KG Workbench Analyst Service...")
    stop_event.set()
    heartbeat_task.cancel()
    worker_task.cancel()
    await asyncio.gather(heartbeat_task, worker_task, return_exceptions=True)
    logger.info("Analyst Service background tasks stopped.")


app = FastAPI(
    title="KG Workbench Analyst Service",
    version="0.1.0",
    description="NetworkX Graph Analysis, QA, Vector Search, and Semantic Drift Detection",
    lifespan=lifespan,
)


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "analyst",
        "worker_id": settings.worker_id,
        "engine": "networkx",
    }


@app.get("/analyst/info")
def info() -> dict[str, Any]:
    return {
        "service": "analyst",
        "worker_id": settings.worker_id,
        "capabilities": ["graph_qa", "vector_search", "drift_detection"],
        "workbench_api_url": settings.workbench_api_url,
        "engine": "networkx",
    }
