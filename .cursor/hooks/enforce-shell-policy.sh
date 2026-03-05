#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# beforeShellExecution hook — Shell Command Governance (Bash version)
#
# macOS / Linux only. For Windows, use enforce-shell-policy.ps1.
# For cross-platform, use enforce-shell-policy.mjs (recommended).
#
# Returns JSON with permission: "allow" | "deny" | "ask"
# ─────────────────────────────────────────────────────────────────────

set -euo pipefail

INPUT=$(cat)

COMMAND=$(echo "$INPUT" | grep -o '"command"\s*:\s*"[^"]*"' | head -1 | sed 's/.*: *"//;s/"$//')

if [ -z "$COMMAND" ]; then
  echo '{"permission":"allow"}'
  exit 0
fi

deny() {
  local reason="$1"
  echo "{\"permission\":\"deny\",\"user_message\":\"Blocked by tech stack policy: ${reason}\",\"agent_message\":\"${reason}. Use TypeScript/Node.js tooling instead.\"}"
  exit 0
}

ask() {
  local reason="$1"
  echo "{\"permission\":\"ask\",\"user_message\":\"Needs approval: ${reason}\",\"agent_message\":\"This command requires user approval: ${reason}\"}"
  exit 0
}

# Block non-TypeScript package managers
echo "$COMMAND" | grep -qiE '\bpip3?\s+install\b'         && deny "Python packages are not permitted"
echo "$COMMAND" | grep -qiE '\bgem\s+install\b'           && deny "Ruby gems are not permitted"
echo "$COMMAND" | grep -qiE '\bcargo\s+(add|install)\b'   && deny "Cargo/Rust is not permitted"
echo "$COMMAND" | grep -qiE '(^|[;&|])\s*go\s+(get|install)\b' && deny "Go modules are not permitted"
echo "$COMMAND" | grep -qiE '\bcomposer\s+require\b'      && deny "Composer/PHP is not permitted"

# Block running non-TypeScript code
echo "$COMMAND" | grep -qiE '\bpython3?\s+\S+\.py\b'      && deny "Running Python scripts is not permitted"
echo "$COMMAND" | grep -qiE '\bruby\s+\S+\.rb\b'          && deny "Running Ruby scripts is not permitted"

# Dangerous operations need approval
echo "$COMMAND" | grep -qiE '\brm\s+-rf\s+/'              && ask "Recursive delete from root"
echo "$COMMAND" | grep -qiE '\bgit\s+push\s+.*--force\b'  && ask "Force push"
echo "$COMMAND" | grep -qiE '\bsudo\b'                    && ask "Elevated privileges"

echo '{"permission":"allow"}'
exit 0
