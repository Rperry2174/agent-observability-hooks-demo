# Haunted Repo Escape Room

Public demo repo for **agent-runtime-observability**. This project is intentionally small and a little spooky so an AI agent naturally uses a lot of tools, spawns subagents, runs shell commands, reads/edits files, and optionally calls MCP tools.

https://github.com/user-attachments/assets/8df39dc1-315a-46a2-8b9e-c9af0c744ddc



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

## OpenTelemetry (built-in)

The demo now initializes OpenTelemetry in the CLI entrypoints (`src/demo.ts` and `src/cli.ts`).

Quick start with console spans:

```bash
npm run demo:otel
npm run clues:otel
```

Exporter configuration:

- `OTEL_TRACES_EXPORTER=console` (set by the `*:otel` scripts)
- `OTEL_TRACES_EXPORTER=otlp` to send spans to an OTLP collector
- If `OTEL_TRACES_EXPORTER` is unset (or `none`), telemetry stays disabled

Example OTLP run:

```bash
OTEL_TRACES_EXPORTER=otlp \
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces \
npm run demo
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

## ROOM PUZZLE PROMPT (agents "travel" + report to detective)

If you want a run that is mostly tool spans (sleep/IO/CPU/subprocess) and easy to parallelize across subagents, just say:

> **Start the game and figure out the final phrase.**

That's it. The `detective-lead` agent knows to:
1. Reset the puzzle
2. Spawn five room investigator subagents in parallel
3. Wait for all investigators to return with their clues
4. Compile and announce the final phrase

Each room agent:
1. Reads the mansion map
2. Walks to the room (shell command)
3. Reads the room dossier
4. Translates Spanish items (MCP call)
5. Runs the room task (CPU/IO work)
6. Walks back (shell command)
7. Writes findings to `.room-notes/<room>.json`

**Final phrase: SILENT SHADOW SOLVES MOONLIT RIDDLE**

> **Note:** The puzzle answer is static. Do NOT run `npm run murder:seed` as it will regenerate random dossiers and break the alignment between the web UI, agents, and room tasks.

### Manual run (without agents)
```bash
npm run puzzle:reset
ROOM_INTENSITY=6 npm run room:ballroom &
ROOM_INTENSITY=6 npm run room:kitchen &
ROOM_INTENSITY=6 npm run room:study &
ROOM_INTENSITY=6 npm run room:library &
ROOM_INTENSITY=6 npm run room:conservatory &
wait
npm run detective
```

## MCP Setup (for translation)

This repo includes a simple `mansion-translator` MCP server for Spanish-English translation.

### Option 1: Project-level MCP (already configured)
The `.cursor/mcp.json` file configures the MCP server for this project. Restart Cursor to pick it up.

### Option 2: Global MCP
Add to `~/.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "mansion-translator": {
      "command": "node",
      "args": ["/path/to/agent-observability-hooks-demo/mcp-servers/mansion-translator/index.mjs"]
    }
  }
}
```

### Option 3: Shell fallback (no MCP setup needed)
Agents can use the shell command instead:
```bash
npm run translate -- <spanish_word>
npm run translate  # list all vocabulary
```

## Notes

- This repo intentionally contains a bug in `src/checksum.ts`.
- The goal is to generate a clean, story-like trace with lots of tool spans and subagent lanes.
