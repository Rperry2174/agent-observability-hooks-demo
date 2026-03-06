#!/usr/bin/env node
/**
 * Universal audit hook — Governance Logging
 *
 * Logs every hook event to a local JSONL file for compliance and debugging.
 * Attach this to any hook event (sessionStart, afterFileEdit, beforeShellExecution, etc.)
 * to build a complete audit trail of agent actions.
 *
 * Cross-platform: runs identically on macOS, Linux, and Windows.
 *
 * The log file location adapts to the platform:
 *   macOS/Linux: .cursor/hooks/audit.jsonl  (project-level)
 *   Windows:     .cursor\hooks\audit.jsonl  (same, just backslashes)
 *
 * Hook type: any (attach to multiple events)
 * Always exits 0 (never blocks)
 */

import { appendFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { platform, hostname, userInfo } from "os";

// ── Configuration ───────────────────────────────────────────────────

const LOG_DIR = process.env.CURSOR_PROJECT_DIR
  ? join(process.env.CURSOR_PROJECT_DIR, ".cursor", "hooks")
  : dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"));

const LOG_FILE = join(LOG_DIR, "audit.jsonl");

// ── Hook Logic ──────────────────────────────────────────────────────

function audit(input) {
  const entry = {
    timestamp: new Date().toISOString(),
    event: input.hook_event_name || "unknown",
    platform: platform(),
    hostname: hostname(),
    user: input.user_email || userInfo().username,
    cursor_version: input.cursor_version || "unknown",
    conversation_id: input.conversation_id || null,
    model: input.model || null,
    details: summarize(input),
  };

  try {
    mkdirSync(dirname(LOG_FILE), { recursive: true });
    appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n");
  } catch {
    // Don't fail the hook if logging fails
  }

  process.stdout.write(JSON.stringify({}));
  process.exit(0);
}

function summarize(input) {
  switch (input.hook_event_name) {
    case "afterFileEdit":
      return { file: input.file_path, edits: (input.edits || []).length };
    case "beforeShellExecution":
      return { command: input.command, cwd: input.cwd };
    case "afterShellExecution":
      return { command: input.command, duration_ms: input.duration };
    case "sessionStart":
      return { session_id: input.session_id, mode: input.composer_mode };
    case "sessionEnd":
      return { session_id: input.session_id, reason: input.reason, duration_ms: input.duration_ms };
    case "beforeMCPExecution":
    case "afterMCPExecution":
      return { tool: input.tool_name };
    case "stop":
      return { status: input.status, loop_count: input.loop_count };
    default:
      return {};
  }
}

// ── Entry Point ─────────────────────────────────────────────────────
let data = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (data += chunk));
process.stdin.on("end", () => {
  try {
    audit(JSON.parse(data));
  } catch {
    process.stdout.write(JSON.stringify({}));
    process.exit(0);
  }
});
