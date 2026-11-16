import asyncio
from contextlib import asynccontextmanager
import logging
from typing import Any
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .config import settings
from .daemon import heartbeat_loop, worker_loop
from .shacl_engine import validate_shacl_turtle

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("reasoner.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing KG Workbench Reasoner Service (%s)", settings.worker_id)
    stop_event = asyncio.Event()

    heartbeat_task = asyncio.create_task(heartbeat_loop(stop_event))
    worker_task = asyncio.create_task(worker_loop(stop_event))

    yield

    logger.info("Shutting down KG Workbench Reasoner Service...")
    stop_event.set()
    heartbeat_task.cancel()
    worker_task.cancel()
    await asyncio.gather(heartbeat_task, worker_task, return_exceptions=True)
    logger.info("Reasoner Service background tasks stopped.")


app = FastAPI(
    title="KG Workbench Reasoner",
    version="0.1.0",
    description="W3C SHACL and Oxigraph RDF reasoning microservice",
    lifespan=lifespan,
)


class ValidateShaclRequest(BaseModel):
    data_graph: str = Field(description="RDF data graph in Turtle format")
    shapes_graph: str = Field(description="SHACL shapes graph in Turtle format")
    inference: str = Field(default="rdfs", description="Inference type: 'rdfs', 'owlrl', 'none'")
    rdfs_ttl: str | None = Field(
        default=None,
        description="Optional RDFS ontology graph in Turtle format for entailment",
    )


class ValidateShaclResponse(BaseModel):
    conforms: bool
    report_text: str
    results_count: int


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "kg-workbench-reasoner",
        "worker_id": settings.worker_id,
    }


@app.get("/reasoner/info")
def info() -> dict[str, Any]:
    return {
        "worker_id": settings.worker_id,
        "capabilities": ["shacl_validation", "entailment_reasoning", "blast_radius"],
        "workbench_api_url": settings.workbench_api_url,
    }


@app.post("/reasoner/validate-shacl")
def validate_shacl(req: ValidateShaclRequest) -> dict[str, Any]:
    try:
        report = validate_shacl_turtle(
            data_graph_ttl=req.data_graph,
            shapes_graph_ttl=req.shapes_graph,
            inference=req.inference,
            rdfs_ttl=req.rdfs_ttl,
        )
        return report
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

