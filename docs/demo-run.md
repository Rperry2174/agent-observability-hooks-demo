# Demo Run Guide

This run is designed to produce a clean, compelling trace in **agent-runtime-observability** without any custom hooks inside this repo.

## 1) Start the observability server

```bash
cd ../agent-runtime-observability
npm run dev
```

## 2) Install telemetry hooks into this repo

Run from this repo root:

```bash
node ../agent-runtime-observability/bin/setup.js
```

This writes `.cursor/hooks.json` pointing to `../agent-runtime-observability/hooks/telemetry-hook.sh`.

## 3) Install dependencies

```bash
npm install
```

## 4) Run the demo prompt in Agent Chat

Copy/paste the **DEMO PROMPT** from `README.md` into Agent Chat. The prompt is designed to trigger:

- `Read` + `Grep` spans
- Multiple `Task` subagents
- Several `Shell` spans (tests + typecheck)
- 1–2 `MCP` calls (if you have MCP configured)
- Normal thinking/response spans

## 5) View the trace

Open:

```
http://localhost:5173/observability
```

You should see:

- Main agent orchestration spans
- Explore subagent lane (read/grep activity)
- Shell subagent lane (tests + typecheck)
- Reviewer subagent lane (read + retest)