# Haunted Repo Escape Room

Public demo repo for **agent-runtime-observability**. This project is intentionally small and a little spooky so an AI agent naturally uses a lot of tools, spawns subagents, runs shell commands, reads/edits files, and optionally calls MCP tools.

https://github.com/user-attachments/assets/8df39dc1-315a-46a2-8b9e-c9af0c744ddc

## Setup

```bash
npm install
```

## Two Modes

This repo has two demo modes you can run in Cursor Agent Chat. Both produce rich, multi-tool traces for the observability dashboard.

| | Mode 1: Escape Room | Mode 2: Room Puzzle |
|---|---|---|
| **Prompt** | See [full prompt below](#mode-1-escape-room) | `Start the game and figure out the final phrase.` |
| **What it does** | Agent explores the repo, finds a checksum bug, fixes it, runs tests | 5 room-investigator subagents travel a mansion in parallel, translate Spanish clues via MCP, and report back to a lead detective |
| **Trace character** | Sequential: explore → diagnose → fix → review | Parallel: 5 agents fan out simultaneously, then converge |
| **Tools exercised** | Read, Grep, Shell, Task (explore + shell + reviewer), MCP | Read, Shell, MCP, Task (5 room agents + case-compiler + forensics-packager), Write |
| **Subagents spawned** | ~3 | ~7 |
| **Modifies code?** | Yes (fixes the bug) | No |

---

### Mode 1: Escape Room

Copy and paste this prompt into Cursor Agent Chat:

> You are in the Haunted Repo Escape Room. Please do all of the following:
>
> 1. Start with a brief plan (3-5 bullet points).
> 2. Spawn an **explore subagent** to map the repo and identify which files to read first.
> 3. Spawn a **shell subagent** to run `npm test` and `npm run typecheck` and report the failures.
> 4. Use `Grep` to find where the checksum or door code is computed.
> 5. Read the relevant files and fix the bug so tests pass.
> 6. Use **your MCP docs tool** (any configured MCP server) to look up a best practice related to checksums or modulo arithmetic in JavaScript, and apply any relevant improvement.
> 7. Spawn a **reviewer subagent** to review the fix and re-run `npm test`.
> 8. Summarize what changed and why.
>
> Constraints:
> - Do not add or modify any hook configuration files in this repo.
> - Use only Agent tools (no Tab completions).
> - Keep changes minimal and focused on the failing tests.

**What happens:** The agent explores the codebase, discovers a bug in `src/checksum.ts`, fixes it, and verifies the fix with tests. This produces a sequential trace with ~3 subagents.

---

### Mode 2: Room Puzzle

Just say this in Cursor Agent Chat:

> **Start the game and figure out the final phrase.**

**What happens:** The `detective-lead` agent orchestrates a Clue-style mansion investigation:

1. Resets the puzzle state
2. Spawns **5 room-investigator subagents in parallel** (Ballroom, Kitchen, Study, Library, Conservatory)
3. Each room agent walks to its room, reads the dossier, translates Spanish items via MCP, runs a room task, and walks back
4. A **case-compiler** agent assembles the clue words in order
5. A **forensics-packager** agent bundles the final report

The final phrase is: **The SILENT SHADOW SOLVES the MOONLIT RIDDLE.**

> **Note:** The puzzle answer is static. Do NOT run `npm run murder:seed` — it will regenerate random dossiers and break the alignment between the web UI, agents, and room tasks.

#### Manual run (without agents)
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

---

## Observability Demo (paired with the tracing dashboard)

Both modes work best when paired with the observability dashboard to visualize the agent trace:

1. Start the observability server + dashboard:
   ```bash
   cd ../agent-runtime-observability
   npm run dev
   ```
2. Wire this repo to the telemetry hooks (run **from this repo**):
   ```bash
   node ../agent-runtime-observability/bin/setup.js
   ```
3. Open this repo in Cursor and run either mode's prompt in Agent Chat.
4. View the timeline at `http://localhost:5173/observability`.

## Standalone CLI Commands

```bash
npm run clues        # Print clue list
npm run demo         # Trace-friendly run (filesystem + CPU + subprocess work)
npm test             # Run tests (expect failures until checksum bug is fixed)
```

Scale the demo intensity up or down:
```bash
DEMO_INTENSITY=8 npm run demo
```

## MCP Setup (for translation)

This repo includes a simple `mansion-translator` MCP server for Spanish-English translation. Required for Mode 2 (Room Puzzle).

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

- This repo intentionally contains a bug in `src/checksum.ts` — that's the point of Mode 1.
- The goal is to generate clean, story-like traces with lots of tool spans and subagent lanes.
