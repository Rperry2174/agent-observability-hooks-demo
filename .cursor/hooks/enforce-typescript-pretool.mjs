#!/usr/bin/env node
/**
 * preToolUse hook — Tech Stack Enforcement (Pre-Write Gate)
 *
 * Blocks the agent from creating or editing files in disallowed languages
 * before the write tool executes.
 *
 * Hook type: preToolUse
 * Output: { decision: "allow" | "deny", reason?: string }
 */

import { basename, extname } from "path";

// Allowed file extensions
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
  ".sh",
  ".ps1",
  ".mjs",
  ".cjs",
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

// Directories where any file type is allowed
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
  ".js": "JavaScript (use .ts instead)",
  ".jsx": "JSX (use .tsx instead)",
  ".py": "Python",
  ".rb": "Ruby",
  ".go": "Go",
  ".java": "Java",
  ".kt": "Kotlin",
  ".rs": "Rust",
  ".c": "C",
  ".cpp": "C++",
  ".cs": "C#",
  ".php": "PHP",
  ".swift": "Swift",
};

function isExemptPath(filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  return EXEMPT_DIRS.some(
    (dir) => normalized.includes(`/${dir}/`) || normalized.startsWith(`${dir}/`)
  );
}

function allow() {
  process.stdout.write(JSON.stringify({ decision: "allow" }));
  process.exit(0);
}

function deny(reason) {
  process.stdout.write(JSON.stringify({ decision: "deny", reason }));
  process.exit(0);
}

function evaluatePath(filePath) {
  if (!filePath || typeof filePath !== "string") return null;

  const file = basename(filePath);
  const ext = extname(file).toLowerCase();

  if (ALLOWED_FILENAMES.has(file)) return null;
  if (isExemptPath(filePath)) return null;
  if (!ext) return null;
  if (ALLOWED_EXTENSIONS.has(ext)) return null;

  const langName = BLOCKED_LANGUAGES[ext] || `files with extension ${ext}`;
  return (
    `BLOCKED: ${langName} is not permitted by tech stack policy. ` +
    `Only TypeScript (.ts/.tsx) is allowed for application code. ` +
    `File: ${file}`
  );
}

function extractPathsFromPatch(patchText) {
  if (typeof patchText !== "string" || patchText.length === 0) return [];

  const paths = [];
  const pattern = /^\*\*\* (?:Add|Update) File: (.+)$/gm;

  for (const match of patchText.matchAll(pattern)) {
    paths.push(match[1].trim());
  }

  return paths;
}

function extractCandidatePaths(toolName, toolInput) {
  if (!toolInput || typeof toolInput !== "object") {
    if (toolName === "ApplyPatch" && typeof toolInput === "string") {
      return extractPathsFromPatch(toolInput);
    }
    return [];
  }

  const paths = [];

  for (const key of ["path", "file_path", "target_file", "target_notebook"]) {
    if (typeof toolInput[key] === "string") {
      paths.push(toolInput[key]);
    }
  }

  if (Array.isArray(toolInput.paths)) {
    for (const value of toolInput.paths) {
      if (typeof value === "string") {
        paths.push(value);
      }
    }
  }

  if (toolName === "ApplyPatch" && typeof toolInput.patch === "string") {
    paths.push(...extractPathsFromPatch(toolInput.patch));
  }

  return paths;
}

function shouldInspectTool(toolName) {
  return new Set(["ApplyPatch", "EditNotebook", "Write", "WriteFile", "Edit", "MultiEdit"]).has(toolName);
}

function main(input) {
  const toolName = input.tool_name;
  const toolInput = input.tool_input;

  if (!shouldInspectTool(toolName)) return allow();

  const paths = extractCandidatePaths(toolName, toolInput);
  for (const filePath of paths) {
    const reason = evaluatePath(filePath);
    if (reason) return deny(reason);
  }

  return allow();
}

let data = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (data += chunk));
process.stdin.on("end", () => {
  try {
    main(JSON.parse(data));
  } catch {
    allow();
  }
});
