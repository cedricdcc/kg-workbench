import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    max_tokens: int = int(os.getenv("KG_EXTRACTOR_MAX_TOKENS", "2000"))
    chunk_size: int = int(os.getenv("KG_EXTRACTOR_CHUNK_SIZE", "4000"))
    chunk_overlap: int = int(os.getenv("KG_EXTRACTOR_CHUNK_OVERLAP", "400"))

    # Event Mesh & Worker Settings
    workbench_api_url: str = os.getenv("WORKBENCH_API_URL", "http://app:3000").rstrip("/")
    enable_heartbeat: bool = os.getenv("ENABLE_HEARTBEAT", "true").lower() in ("true", "1", "yes")
    heartbeat_interval_seconds: int = int(os.getenv("HEARTBEAT_INTERVAL_SECONDS", "30"))
    enable_worker_polling: bool = os.getenv("ENABLE_WORKER_POLLING", "true").lower() in ("true", "1", "yes")
    worker_poll_interval_seconds: float = float(os.getenv("WORKER_POLL_INTERVAL_SECONDS", "3.0"))
    worker_id: str = os.getenv("WORKER_ID", "extractor-1")


settings = Settings()
