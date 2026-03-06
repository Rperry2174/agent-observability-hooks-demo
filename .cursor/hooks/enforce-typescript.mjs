#!/usr/bin/env node
/**
 * afterFileEdit hook — Tech Stack Enforcement (Language Gate)
 *
 * Blocks the agent from creating or editing files in disallowed languages.
 * This is the DETERMINISTIC enforcement layer. The companion Cursor Rule
 * (.cursor/rules/typescript-only.mdc) handles the AI guidance layer.
 *
 * Cross-platform: runs identically on macOS, Linux, and Windows because
 * it uses Node.js (which Cursor already requires) instead of bash/PowerShell.
 *
 * Hook type: afterFileEdit
 * Exit code 0 = allow, exit code 2 = block
 */

import { readFileSync } from "fs";
import { extname, basename } from "path";

// ── Policy Configuration ────────────────────────────────────────────
// Allowed file extensions (add more as needed for your org)
const ALLOWED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".json",
  ".md",
  ".mdc",
  ".yaml",
  ".yml",
  ".html",
  ".css",
  ".scss",
  ".svg",
  ".sh",    // shell scripts for CI/hooks are fine
  ".ps1",   // PowerShell scripts for CI/hooks are fine
  ".mjs",   // Node ESM config files
  ".cjs",   // Node CJS config files
]);

// Files that are always allowed regardless of extension
const ALLOWED_FILENAMES = new Set([
  ".gitignore",
  ".env.example",
  "Dockerfile",
  "Makefile",
  "LICENSE",
  "Procfile",
]);

// Directories where any file type is allowed (e.g., vendored code, configs)
const EXEMPT_DIRS = [
  "node_modules",
  ".git",
  "vendor",
  ".cursor",
  "dist",
  "build",
];

// Explicitly blocked extensions with human-readable names
const BLOCKED_LANGUAGES = {
  ".js":   "JavaScript (use .ts instead)",
  ".jsx":  "JSX (use .tsx instead)",
  ".py":   "Python",
  ".rb":   "Ruby",
  ".go":   "Go",
  ".java": "Java",
  ".kt":   "Kotlin",
  ".rs":   "Rust",
  ".c":    "C",
  ".cpp":  "C++",
  ".cs":   "C#",
  ".php":  "PHP",
  ".swift":"Swift",
};

// ── Hook Logic ──────────────────────────────────────────────────────

function isExemptPath(filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  return EXEMPT_DIRS.some(
    (dir) => normalized.includes(`/${dir}/`) || normalized.startsWith(`${dir}/`)
  );
}

function enforce(input) {
  const filePath = input.file_path || "";
  const file = basename(filePath);
  const ext = extname(file).toLowerCase();

  if (ALLOWED_FILENAMES.has(file)) return allow();
  if (isExemptPath(filePath)) return allow();
  if (!ext) return allow(); // extensionless files (scripts, configs)
  if (ALLOWED_EXTENSIONS.has(ext)) return allow();

  const langName = BLOCKED_LANGUAGES[ext] || `files with extension ${ext}`;
  return block(
    `BLOCKED: ${langName} is not permitted by tech stack policy. ` +
    `Only TypeScript (.ts/.tsx) is allowed for application code. ` +
    `File: ${file}`
  );
}

function allow() {
  process.stdout.write(JSON.stringify({}));
  process.exit(0);
}

function block(reason) {
  process.stdout.write(JSON.stringify({
    decision: "deny",
    reason,
  }));
  process.exit(2);
}

// ── Entry Point ─────────────────────────────────────────────────────
// Hooks receive JSON via stdin
let data = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (data += chunk));
process.stdin.on("end", () => {
  try {
    const input = JSON.parse(data);
    enforce(input);
  } catch {
    allow(); // fail-open: if we can't parse input, don't block the developer
  }
});
