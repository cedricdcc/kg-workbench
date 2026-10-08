# AGENTS.md

This is the Codex entrypoint for the repository.

At the start of every new chat in this repository, before answering even a greeting, read `AGENT_CONTRACT.md`. It is the shared source of truth for all agent instructions.

`AGENT_CONTRACT.md` substitutes for a full standalone `AGENTS.md` because it is the synced instruction point shared by `AGENTS.md` and `CLAUDE.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
