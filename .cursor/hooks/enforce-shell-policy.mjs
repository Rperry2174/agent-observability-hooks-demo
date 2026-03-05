#!/usr/bin/env node
/**
 * beforeShellExecution hook — Shell Command Governance
 *
 * Prevents the agent from running commands that would introduce disallowed
 * languages, package managers, or dangerous operations.
 *
 * Cross-platform: runs identically on macOS, Linux, and Windows.
 *
 * Hook type: beforeShellExecution
 * Returns JSON with permission: "allow" | "deny" | "ask"
 */

import { platform } from "os";

// ── Policy Configuration ────────────────────────────────────────────

// Commands that install non-TypeScript toolchains
const BLOCKED_INSTALL_PATTERNS = [
  { pattern: /\bpip3?\s+install\b/i,       reason: "Python packages are not permitted — this is a TypeScript-only project" },
  { pattern: /\bpipenv\b/i,                reason: "Pipenv is not permitted — this is a TypeScript-only project" },
  { pattern: /\bpoetry\s+add\b/i,          reason: "Poetry is not permitted — this is a TypeScript-only project" },
  { pattern: /\bconda\s+install\b/i,        reason: "Conda is not permitted — this is a TypeScript-only project" },
  { pattern: /\bgem\s+install\b/i,          reason: "Ruby gems are not permitted — this is a TypeScript-only project" },
  { pattern: /\bbundle\s+install\b/i,       reason: "Bundler is not permitted — this is a TypeScript-only project" },
  { pattern: /\bcargo\s+(add|install)\b/i,  reason: "Cargo/Rust is not permitted — this is a TypeScript-only project" },
  { pattern: /(?:^|[;&|])\s*go\s+(get|install)\b/i, reason: "Go modules are not permitted — this is a TypeScript-only project" },
  { pattern: /\bcomposer\s+(require|install)\b/i, reason: "Composer/PHP is not permitted — this is a TypeScript-only project" },
  { pattern: /\bbrew\s+install\s+python/i,  reason: "Installing Python via Homebrew is not permitted" },
  { pattern: /\bapt(-get)?\s+install\s+.*python/i, reason: "Installing Python via apt is not permitted" },
];

// Commands that compile/run non-TypeScript code
const BLOCKED_EXEC_PATTERNS = [
  { pattern: /\bpython3?\s+\S+\.py\b/i,    reason: "Running Python scripts is not permitted" },
  { pattern: /\bruby\s+\S+\.rb\b/i,         reason: "Running Ruby scripts is not permitted" },
  { pattern: /\bjavac?\s+/i,                reason: "Running Java is not permitted" },
  { pattern: /\bgcc\b|\bg\+\+\b/i,          reason: "Compiling C/C++ is not permitted" },
  { pattern: /\brustc\b/i,                  reason: "Compiling Rust is not permitted" },
];

// Dangerous operations that need human approval
const ASK_PATTERNS = [
  { pattern: /\brm\s+-rf\s+\//,             reason: "Recursive delete from root — requires approval" },
  { pattern: /\bgit\s+push\s+.*--force\b/i, reason: "Force push — requires approval" },
  { pattern: /\bgit\s+reset\s+--hard\b/i,   reason: "Hard reset — requires approval" },
  { pattern: /\bcurl\b.*\|\s*(ba)?sh\b/i,   reason: "Piping curl to shell — requires approval" },
  { pattern: /\bsudo\b/i,                   reason: "Elevated privileges — requires approval" },
];

// ── Platform-Aware Logging ──────────────────────────────────────────

function getPlatformInfo() {
  const os = platform();
  return {
    os,
    shell: os === "win32" ? "PowerShell" : process.env.SHELL || "bash",
    isWindows: os === "win32",
    isMac: os === "darwin",
    isLinux: os === "linux",
  };
}

// ── Hook Logic ──────────────────────────────────────────────────────

function evaluate(input) {
  const command = input.command || "";
  const env = getPlatformInfo();

  for (const { pattern, reason } of BLOCKED_INSTALL_PATTERNS) {
    if (pattern.test(command)) {
      return deny(reason, env);
    }
  }

  for (const { pattern, reason } of BLOCKED_EXEC_PATTERNS) {
    if (pattern.test(command)) {
      return deny(reason, env);
    }
  }

  for (const { pattern, reason } of ASK_PATTERNS) {
    if (pattern.test(command)) {
      return ask(reason, env);
    }
  }

  return allowCmd(env);
}

function deny(reason, env) {
  const output = {
    permission: "deny",
    user_message: `🚫 Blocked by tech stack policy: ${reason}`,
    agent_message:
      `This command was blocked by the project's tech stack enforcement hook. ` +
      `${reason}. Use TypeScript/Node.js tooling instead. ` +
      `(Platform: ${env.os}, Shell: ${env.shell})`,
  };
  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}

function ask(reason, env) {
  const output = {
    permission: "ask",
    user_message: `⚠️ Needs approval: ${reason} (${env.os})`,
    agent_message: `This command requires user approval: ${reason}`,
  };
  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}

function allowCmd(env) {
  const output = { permission: "allow" };
  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}

// ── Entry Point ─────────────────────────────────────────────────────
let data = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (data += chunk));
process.stdin.on("end", () => {
  try {
    const input = JSON.parse(data);
    evaluate(input);
  } catch {
    process.stdout.write(JSON.stringify({ permission: "allow" }));
    process.exit(0);
  }
});
