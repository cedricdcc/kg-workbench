import os
from pydantic import BaseModel, Field


class Settings(BaseModel):
    workbench_api_url: str = Field(
        default_factory=lambda: os.getenv("WORKBENCH_API_URL", "http://app:3000")
    )
    worker_id: str = Field(
        default_factory=lambda: os.getenv("ANALYST_WORKER_ID")
        or os.getenv("WORKER_ID")
        or "analyst-worker-1"
    )
    poll_interval_seconds: float = Field(
        default_factory=lambda: float(os.getenv("POLL_INTERVAL_SECONDS", "1.0"))
    )
    heartbeat_interval_seconds: float = Field(
        default_factory=lambda: float(os.getenv("HEARTBEAT_INTERVAL_SECONDS", "10.0"))
    )

    @property
    def worker_poll_interval_seconds(self) -> float:
        return self.poll_interval_seconds


settings = Settings()
