# Haunted Repo Escape Room

Public demo repo for **agent-runtime-observability**. This project is intentionally small and a little spooky so an AI agent naturally uses a lot of tools, spawns subagents, runs shell commands, reads/edits files, and optionally calls MCP tools.

## Quick start (standalone)

```bash
npm install
npm run clues
npm test
```

Expect the tests to fail until the checksum bug is fixed.

## Trace-friendly standalone run (slower)

If you want a run that takes a few seconds (filesystem + CPU + subprocess work with varied durations), use:

```bash
npm run demo
```

You can scale it up/down:

```bash
DEMO_INTENSITY=8 npm run demo
```

## Observability demo (paired with the tracing dashboard)

1. Start the observability server + dashboard:
   ```bash
   cd ../agent-runtime-observability
   npm run dev
   ```
2. Wire this repo to the telemetry hooks (run **from this repo**):
   ```bash
   node ../agent-runtime-observability/bin/setup.js
   ```
3. Open this repo in Cursor and run the prompt below in Agent Chat.
4. View the timeline at `http://localhost:5173/observability`.

## DEMO PROMPT (copy/paste into Agent Chat)

You are in the Haunted Repo Escape Room. Please do all of the following:

1. Start with a brief plan (3-5 bullet points).
2. Spawn an **explore subagent** to map the repo and identify which files to read first.
3. Spawn a **shell subagent** to run `npm test` and `npm run typecheck` and report the failures.
4. Use `Grep` to find where the checksum or door code is computed.
5. Read the relevant files and fix the bug so tests pass.
6. Use **your MCP docs tool** (any configured MCP server) to look up a best practice related to checksums or modulo arithmetic in JavaScript, and apply any relevant improvement.
7. Spawn a **reviewer subagent** to review the fix and re-run `npm test`.
8. Summarize what changed and why.

Constraints:
- Do not add or modify any hook configuration files in this repo.
- Use only Agent tools (no Tab completions).
- Keep changes minimal and focused on the failing tests.

## Notes

- This repo intentionally contains a bug in `src/checksum.ts`.
- The goal is to generate a clean, story-like trace with lots of tool spans and subagent lanes.
