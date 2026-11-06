FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV UV_LINK_MODE=copy
ENV PATH="/app/.venv/bin:$PATH"

WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:0.12.7 /uv /uvx /bin/
COPY pyproject.toml README.md ./
COPY src ./src
COPY tests ./tests

RUN uv sync --no-dev
RUN python3 -c "import duckdb; conn = duckdb.connect(); conn.execute('INSTALL postgres; INSTALL mysql;')"

EXPOSE 8000

CMD ["uv", "run", "--no-dev", "uvicorn", "tabular.main:app", "--host", "0.0.0.0", "--port", "8000"]
