# Task 2: Scaffold `services/analyst` Microservice & Docker Profile

**Files:**

- Create: `services/analyst/Dockerfile`
- Create: `services/analyst/pyproject.toml`
- Create: `services/analyst/README.md`
- Create: `services/analyst/src/analyst/__init__.py`
- Create: `services/analyst/src/analyst/config.py`
- Create: `services/analyst/src/analyst/main.py`
- Create: `services/analyst/src/analyst/daemon.py`
- Modify: `deploy/compose.yaml`
- Create: `services/analyst/tests/test_daemon.py`

## Instructions

1. **`services/analyst/pyproject.toml`**:
   Follow the format of `services/tabular/pyproject.toml` or `services/reasoner/pyproject.toml`:
   - Project name: `kg-workbench-analyst`
   - Dependencies: `fastapi>=0.115.0`, `uvicorn>=0.30.0`, `httpx>=0.27.0`, `pydantic>=2.8.0`, `networkx>=3.2.0`, `pytest>=8.0.0`
   - Python requires: `>=3.11`

2. **`services/analyst/Dockerfile`**:
   Follow `services/tabular/Dockerfile`:

   ```dockerfile
   FROM python:3.13-slim
   COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
   WORKDIR /app
   ENV UV_COMPILE_BYTECODE=1
   ENV UV_LINK_MODE=copy
   COPY pyproject.toml .
   RUN uv sync --frozen --no-install-project --no-dev || uv sync --no-install-project --no-dev
   COPY src/ /app/src/
   RUN uv sync --frozen --no-dev || uv sync --no-dev
   ENV PATH="/app/.venv/bin:$PATH"
   ENV PYTHONPATH="/app/src:$PYTHONPATH"
   EXPOSE 8000
   CMD ["uvicorn", "analyst.main:app", "--host", "0.0.0.0", "--port", "8000"]
   ```

3. **`services/analyst/src/analyst/config.py`**:
   Load settings:
   - `workbench_api_url`: string (default: `"http://app:3000"`)
   - `worker_id`: string (default: `"analyst-worker-1"`)
   - `poll_interval_seconds`: float (default: `1.0`)
   - `heartbeat_interval_seconds`: float (default: `10.0`)

4. **`services/analyst/src/analyst/daemon.py`**:
   - `send_heartbeat(client)`: POST `{ settings.workbench_api_url }/api/system/services/heartbeat` with `{ "service": "analyst", "workerId": settings.worker_id, "status": "healthy", "capabilities": ["graph_qa", "vector_search", "drift_detection"] }`.
   - `heartbeat_loop(stop_event)`
   - `claim_job(client)`: POST `{ settings.workbench_api_url }/api/system/jobs/claim` with `{ "workerType": "analyst", "workerId": settings.worker_id, "leaseSeconds": 120 }`.
   - `complete_job(client, job_id, result)`: POST `{ settings.workbench_api_url }/api/system/jobs/{job_id}/complete` with `{ "result": result }`.
   - `fail_job(client, job_id, error_message, current_attempts)`: POST `{ settings.workbench_api_url }/api/system/jobs/{job_id}/fail`.
   - `execute_job(client, claimed)`: dispatches claimed job.
   - `worker_loop(stop_event)`

5. **`services/analyst/src/analyst/main.py`**:
   - FastAPI app with lifespan running `heartbeat_loop` and `worker_loop`.
   - Route `GET /health` returning `{ "status": "ok", "service": "analyst", "worker_id": settings.worker_id, "engine": "networkx" }`.

6. **`deploy/compose.yaml`**:
   Add `analyst` service under profiles `["analyst", "full"]`:

   ```yaml
   analyst:
     container_name: kg-workbench-analyst
     profiles: ["analyst", "full"]
     build:
       context: ../services/analyst
       dockerfile: Dockerfile
     restart: unless-stopped
     environment:
       WORKBENCH_API_URL: ${WORKBENCH_API_URL:-http://app:3000}
       APP_PASSWORD: ${APP_PASSWORD:-}
     ports:
       - 127.0.0.1:${ANALYST_PORT:-8040}:8000
     extra_hosts:
       - host.docker.internal:host-gateway
   ```

7. **`services/analyst/tests/test_daemon.py`**:
   Unit test testing:
   - FastAPI `/health` endpoint returns 200 and expected JSON.
   - `claim_job` payload includes `workerType: "analyst"`.
   - `send_heartbeat` payload includes capabilities `["graph_qa", "vector_search", "drift_detection"]`.

8. Commit changes:
   `git add services/analyst/ deploy/compose.yaml`
   `git commit -m "feat(analyst): scaffold analyst microservice and compose profile"`
