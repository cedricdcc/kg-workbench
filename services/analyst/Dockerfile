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
