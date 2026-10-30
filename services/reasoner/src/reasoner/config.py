import os
import uuid
from pydantic import BaseModel, Field


class Settings(BaseModel):
    workbench_api_url: str = Field(
        default_factory=lambda: os.getenv("WORKBENCH_API_URL", "http://localhost:3000")
    )
    worker_id: str = Field(
        default_factory=lambda: os.getenv(
            "REASONER_WORKER_ID", f"reasoner-{uuid.uuid4().hex[:8]}"
        )
    )
    heartbeat_interval_seconds: int = Field(
        default_factory=lambda: int(os.getenv("HEARTBEAT_INTERVAL_SECONDS", "30"))
    )
    worker_poll_interval_seconds: int = Field(
        default_factory=lambda: int(os.getenv("WORKER_POLL_INTERVAL_SECONDS", "5"))
    )


settings = Settings()

