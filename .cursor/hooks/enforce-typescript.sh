#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# afterFileEdit hook — Tech Stack Enforcement (Bash version)
#
# macOS / Linux only. For Windows, use enforce-typescript.ps1.
# For cross-platform, use enforce-typescript.mjs (recommended).
#
# Exit 0 = allow, Exit 2 = block
# ─────────────────────────────────────────────────────────────────────

set -euo pipefail

INPUT=$(cat)

FILE_PATH=$(echo "$INPUT" | grep -o '"file_path"\s*:\s*"[^"]*"' | head -1 | sed 's/.*: *"//;s/"$//')

if [ -z "$FILE_PATH" ]; then
  echo '{}'
  exit 0
fi

EXT="${FILE_PATH##*.}"
EXT=$(echo ".$EXT" | tr '[:upper:]' '[:lower:]')

# Exempt directories
case "$FILE_PATH" in
  *node_modules/* | *.git/* | *vendor/* | *.cursor/* | *dist/* | *build/*)
    echo '{}'
    exit 0
    ;;
esac

# Allowed extensions
case "$EXT" in
  .ts|.tsx|.mts|.cts|.json|.md|.mdc|.yaml|.yml|.html|.css|.scss|.svg|.sh|.ps1|.mjs|.cjs)
    echo '{}'
    exit 0
    ;;
esac

# Blocked languages
case "$EXT" in
  .js|.jsx)
    LANG="JavaScript (use .ts/.tsx instead)"
    ;;
  .py)
    LANG="Python"
    ;;
  .rb)
    LANG="Ruby"
    ;;
  .go)
    LANG="Go"
    ;;
  .java|.kt)
    LANG="Java/Kotlin"
    ;;
  .rs)
    LANG="Rust"
    ;;
  .c|.cpp|.h)
    LANG="C/C++"
    ;;
  .cs)
    LANG="C#"
    ;;
  .php)
    LANG="PHP"
    ;;
  *)
    echo '{}'
    exit 0
    ;;
esac

FILENAME=$(basename "$FILE_PATH")
echo "{\"decision\":\"deny\",\"reason\":\"BLOCKED: ${LANG} is not permitted by tech stack policy. Only TypeScript (.ts/.tsx) is allowed for application code. File: ${FILENAME}\"}"
exit 2
