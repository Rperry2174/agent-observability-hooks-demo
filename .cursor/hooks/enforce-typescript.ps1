# ─────────────────────────────────────────────────────────────────────
# afterFileEdit hook — Tech Stack Enforcement (PowerShell version)
#
# Windows only. For macOS/Linux, use enforce-typescript.sh.
# For cross-platform, use enforce-typescript.mjs (recommended).
#
# Prerequisites (Windows):
#   Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
#
# Exit 0 = allow, Exit 2 = block
# ─────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"

$inputJson = $input | ConvertFrom-Json

$filePath = $inputJson.file_path
if (-not $filePath) {
    Write-Output '{}'
    exit 0
}

$ext = [System.IO.Path]::GetExtension($filePath).ToLower()
$fileName = [System.IO.Path]::GetFileName($filePath)

# Exempt directories
$exemptDirs = @("node_modules", ".git", "vendor", ".cursor", "dist", "build")
foreach ($dir in $exemptDirs) {
    if ($filePath -match [regex]::Escape("/$dir/") -or $filePath -match [regex]::Escape("\$dir\")) {
        Write-Output '{}'
        exit 0
    }
}

# Allowed extensions
$allowedExts = @(
    ".ts", ".tsx", ".mts", ".cts",
    ".json", ".md", ".mdc",
    ".yaml", ".yml",
    ".html", ".css", ".scss", ".svg",
    ".sh", ".ps1", ".mjs", ".cjs"
)

if ($ext -in $allowedExts -or $ext -eq "") {
    Write-Output '{}'
    exit 0
}

# Blocked languages
$blockedMap = @{
    ".js"    = "JavaScript (use .ts instead)"
    ".jsx"   = "JSX (use .tsx instead)"
    ".py"    = "Python"
    ".rb"    = "Ruby"
    ".go"    = "Go"
    ".java"  = "Java"
    ".kt"    = "Kotlin"
    ".rs"    = "Rust"
    ".c"     = "C"
    ".cpp"   = "C++"
    ".cs"    = "C#"
    ".php"   = "PHP"
    ".swift" = "Swift"
}

if ($blockedMap.ContainsKey($ext)) {
    $lang = $blockedMap[$ext]
} else {
    Write-Output '{}'
    exit 0
}

$reason = "BLOCKED: $lang is not permitted by tech stack policy. Only TypeScript (.ts/.tsx) is allowed for application code. File: $fileName"
$output = @{ decision = "deny"; reason = $reason } | ConvertTo-Json -Compress
Write-Output $output
exit 2
