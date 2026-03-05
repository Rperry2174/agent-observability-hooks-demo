# ─────────────────────────────────────────────────────────────────────
# beforeShellExecution hook — Shell Command Governance (PowerShell version)
#
# Windows only. For macOS/Linux, use enforce-shell-policy.sh.
# For cross-platform, use enforce-shell-policy.mjs (recommended).
#
# Prerequisites (Windows):
#   Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
#
# Returns JSON with permission: "allow" | "deny" | "ask"
# ─────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"

$inputJson = $input | ConvertFrom-Json
$command = $inputJson.command

if (-not $command) {
    Write-Output '{"permission":"allow"}'
    exit 0
}

function Deny-Command($reason) {
    $output = @{
        permission    = "deny"
        user_message  = "Blocked by tech stack policy: $reason"
        agent_message = "$reason. Use TypeScript/Node.js tooling instead."
    } | ConvertTo-Json -Compress
    Write-Output $output
    exit 0
}

function Ask-Approval($reason) {
    $output = @{
        permission    = "ask"
        user_message  = "Needs approval: $reason"
        agent_message = "This command requires user approval: $reason"
    } | ConvertTo-Json -Compress
    Write-Output $output
    exit 0
}

# Block non-TypeScript package managers
if ($command -match '\bpip3?\s+install\b')         { Deny-Command "Python packages are not permitted" }
if ($command -match '\bgem\s+install\b')           { Deny-Command "Ruby gems are not permitted" }
if ($command -match '\bcargo\s+(add|install)\b')   { Deny-Command "Cargo/Rust is not permitted" }
if ($command -match '(^|[;&|])\s*go\s+(get|install)\b') { Deny-Command "Go modules are not permitted" }
if ($command -match '\bcomposer\s+require\b')      { Deny-Command "Composer/PHP is not permitted" }

# Block running non-TypeScript code
if ($command -match '\bpython3?\s+\S+\.py\b')      { Deny-Command "Running Python scripts is not permitted" }
if ($command -match '\bruby\s+\S+\.rb\b')          { Deny-Command "Running Ruby scripts is not permitted" }

# Dangerous operations need approval
if ($command -match '\bgit\s+push\s+.*--force\b')  { Ask-Approval "Force push" }
if ($command -match '\bgit\s+reset\s+--hard\b')    { Ask-Approval "Hard reset" }

Write-Output '{"permission":"allow"}'
exit 0
