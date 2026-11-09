# Task 10: Full Verification & E2E Validation

**Files:**

- Create: `tests/analyst-e2e-smoke.test.ts`

## Instructions

1. **`tests/analyst-e2e-smoke.test.ts`**:
   - Integration smoke test testing:
     - End-to-end flow: creating an analyst conversation -> adding messages with reasoning trace, subgraphs, and citations.
     - Outbox event publishing with `analyst.query_requested` routing to target worker `analyst`.
     - Claiming and completing analyst jobs through `/api/system/jobs/claim` and `/api/system/jobs/[id]/complete`.
     - Resolving knowledge contradictions and querying updated state.
   - Guard against database connectivity if offline (fallback graceful mock or test against running DB if accessible).

2. **Full Verification Suite**:
   - Run `cmd /c "node_modules\.bin\tsc.cmd" --noEmit`.
   - Run `cmd /c "node_modules\.bin\eslint.cmd"`.
   - Run all Node tests: `cmd /c "node_modules\.bin\tsx.cmd" --conditions=react-server --test tests/analyst-*.test.ts`.
   - Run Python tests in `services/analyst`: `services/analyst/.venv/Scripts/python.exe -m pytest services/analyst/tests`.
   - Run `cmd /c "node_modules\.bin\next.cmd" build`.

3. Commit:
   `git add tests/analyst-e2e-smoke.test.ts`
   `git commit -m "test(analyst): add end-to-end integration smoke tests for graph analyst"`
