# Tech Stack Governance with Cursor Rules + Hooks

A working example of how **Rules** (AI guidance) and **Hooks** (deterministic enforcement) combine to enforce tech stack requirements across macOS, Linux, and Windows.

---

## The Two-Layer Pattern

Neither rules nor hooks alone solve tech stack governance. Together they form a complete system:

```
┌─────────────────────────────────────────────────────────────┐
│                    RULES (Guidance Layer)                     │
│                                                               │
│  "Only write TypeScript for application code"                 │
│                                                               │
│  ✓ Steers the AI toward the right choice                     │
│  ✓ Injected into model context on every conversation          │
│  ✗ Non-deterministic — the model can still deviate            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    HOOKS (Enforcement Layer)                  │
│                                                               │
│  afterFileEdit    → blocks .js, .py, .go, .java, etc.       │
│  beforeShellExec  → blocks pip install, cargo add, etc.      │
│                                                               │
│  ✓ Deterministic — runs real scripts, not AI judgment         │
│  ✓ Cannot be bypassed by the model                            │
│  ✗ Can only react to actions, not guide generation            │
└─────────────────────────────────────────────────────────────┘
```

**Rules set the expectation. Hooks validate adherence.**

---

## File Structure

```
.cursor/
├── hooks.json                          # Wires hooks to agent events
├── hooks/
│   ├── enforce-typescript.mjs          # ✅ Cross-platform (recommended)
│   ├── enforce-typescript.sh           # macOS / Linux only
│   ├── enforce-typescript.ps1          # Windows only
│   ├── enforce-shell-policy.mjs        # ✅ Cross-platform (recommended)
│   ├── enforce-shell-policy.sh         # macOS / Linux only
│   ├── enforce-shell-policy.ps1        # Windows only
│   └── audit-log.mjs                  # ✅ Cross-platform audit trail
└── rules/
    └── typescript-only.mdc             # AI guidance rule
```

---

## Cross-Platform Strategy

### The Problem

Cursor hooks execute via the system shell:
- **macOS / Linux**: Bash or Zsh
- **Windows**: PowerShell

Shell-specific scripts mean maintaining two (or three) versions of every hook.

### The Solution: Use Node.js

Since Cursor requires Node.js, **write hooks as `.mjs` files** and invoke them with `node`:

```json
{
  "hooks": {
    "afterFileEdit": [
      { "command": "node .cursor/hooks/enforce-typescript.mjs" }
    ]
  }
}
```

This single command works identically on all three platforms. No bash. No PowerShell. No platform detection needed.

### When You Need Platform-Specific Scripts

Some organizations require native shell scripts (e.g., for IT policy or when Node.js isn't guaranteed). In that case, provide all three variants and use the appropriate one in `hooks.json`:

| Platform | Hook Command |
|----------|-------------|
| macOS/Linux | `bash .cursor/hooks/enforce-typescript.sh` |
| Windows | `powershell -File .cursor/hooks/enforce-typescript.ps1` |
| All (recommended) | `node .cursor/hooks/enforce-typescript.mjs` |

> **Windows prerequisite**: PowerShell execution policy must allow scripts:
> ```powershell
> Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
> ```
> For enterprise environments, your IT admin manages this centrally via Group Policy.

---

## How Each Piece Works

### 1. The Rule (AI Guidance)

**File**: `.cursor/rules/typescript-only.mdc`

```yaml
---
description: Enforce TypeScript-only tech stack for all application code
alwaysApply: true
---
```

This rule is injected into the AI's context on every conversation. It tells the model:
- Write all new code in TypeScript (.ts / .tsx)
- Use npm for package management
- Don't create .js, .py, .go, or other language files

**Rules are non-deterministic** — they guide the model but can't guarantee compliance.

### 2. The File Edit Hook (Deterministic Block)

**File**: `.cursor/hooks/enforce-typescript.mjs`  
**Event**: `afterFileEdit`

When the agent creates or edits a file, this hook checks the file extension:

| Extension | Result |
|-----------|--------|
| `.ts`, `.tsx`, `.json`, `.md`, `.yaml` | ✅ Allowed |
| `.js`, `.jsx` | ❌ Blocked — "use .ts instead" |
| `.py`, `.rb`, `.go`, `.java`, `.rs` | ❌ Blocked |
| `.sh`, `.ps1` (scripts) | ✅ Allowed |
| Files in `node_modules/`, `.git/`, etc. | ✅ Exempt |

When blocked, the agent receives a clear error message explaining the policy and what to do instead.

### 3. The Shell Command Hook (Deterministic Block)

**File**: `.cursor/hooks/enforce-shell-policy.mjs`  
**Event**: `beforeShellExecution`

Before the agent runs any shell command, this hook scans it:

| Command Pattern | Result |
|----------------|--------|
| `npm install`, `npx`, `node` | ✅ Allowed |
| `pip install`, `pip3 install` | ❌ Blocked |
| `gem install`, `cargo add` | ❌ Blocked |
| `python script.py` | ❌ Blocked |
| `git push --force` | ⚠️ Asks user |
| `sudo ...` | ⚠️ Asks user |

Three permission levels:
- **allow**: Command runs normally
- **deny**: Command is blocked, agent gets error message
- **ask**: User sees a prompt and decides

### 4. The Audit Hook (Observability)

**File**: `.cursor/hooks/audit-log.mjs`  
**Events**: All major events

Logs every agent action to `.cursor/hooks/audit.jsonl`:

```json
{
  "timestamp": "2026-03-05T19:43:00.000Z",
  "event": "beforeShellExecution",
  "platform": "darwin",
  "hostname": "dev-macbook",
  "user": "dev@example.com",
  "conversation_id": "abc-123",
  "model": "claude-sonnet-4-20250514",
  "details": { "command": "npm install lodash", "cwd": "/project" }
}
```

This gives compliance teams a complete audit trail of what the AI agent did, when, and on which machine.

---

## Profile Levels

Cursor supports hooks and rules at multiple levels. Higher levels override lower ones:

```
┌──────────────────────────────────────────────────┐
│  Enterprise (MDM-managed)         HIGHEST PRIORITY │
│  macOS: /Library/Application Support/Cursor/       │
│  Linux: /etc/cursor/                               │
│  Windows: C:\ProgramData\Cursor\                   │
├──────────────────────────────────────────────────┤
│  Team (Cloud-distributed, Enterprise plans)        │
│  Configured in Cursor dashboard                    │
├──────────────────────────────────────────────────┤
│  Project (Version-controlled)                      │
│  <repo>/.cursor/hooks.json                         │
│  <repo>/.cursor/rules/*.mdc                        │
├──────────────────────────────────────────────────┤
│  User (Personal preferences)      LOWEST PRIORITY  │
│  ~/.cursor/hooks.json                              │
│  ~/.cursor/rules/*.mdc                             │
└──────────────────────────────────────────────────┘
```

### Recommended Setup for Enterprise

| Level | What Goes Here | Example |
|-------|---------------|---------|
| **Enterprise** | Security-critical hooks that cannot be bypassed | Secret scanning, PII detection |
| **Team** | Org-wide coding standards | "TypeScript only", approved package list |
| **Project** | Repo-specific conventions | Framework patterns, test conventions |
| **User** | Personal preferences | Editor style, communication preferences |

For the tech stack enforcement example:
- **Team Rules** (dashboard): The TypeScript-only rule, enforced for all members
- **Project hooks** (`.cursor/hooks.json`): The enforcement scripts, checked into git
- **Enterprise hooks** (MDM): Audit logging to corporate SIEM

---

## Testing the Hooks

### Quick Smoke Test

Open this repo in Cursor and try these prompts in Agent Chat:

**Should be BLOCKED** (hook denies):
> "Create a Python script that prints hello world"

The agent will try to create a `.py` file → `afterFileEdit` hook blocks it → agent gets error message.

**Should be BLOCKED** (hook denies):
> "Install the requests library with pip"

The agent will try `pip install requests` → `beforeShellExecution` hook blocks it → agent gets error message.

**Should SUCCEED** (rule guides, hook allows):
> "Create a utility function that fetches data from an API"

The rule guides the agent to write TypeScript → hook sees `.ts` file → allows it.

### Verify Audit Log

After running any agent session, check the audit trail:

```bash
cat .cursor/hooks/audit.jsonl | head -5
```

---

## Adapting for Your Organization

### Different Language Policy

To enforce Python-only instead of TypeScript-only:

1. Update the rule in `.cursor/rules/typescript-only.mdc` to say "Python only"
2. In `enforce-typescript.mjs`, swap the allowed/blocked extension lists
3. In `enforce-shell-policy.mjs`, block `npm install` and allow `pip install`

### Adding More Governance

Common additions:

| Hook Event | Use Case |
|-----------|----------|
| `beforeReadFile` | Block access to sensitive files (`.env`, credentials) |
| `beforeMCPExecution` | Gate which MCP tools the agent can use |
| `beforeSubmitPrompt` | Scan prompts for PII before sending to model |
| `sessionStart` | Inject org context, set environment variables |
| `preToolUse` | Validate any tool usage with custom logic |

### Distributing to the Team

**Option A: Git (Project hooks)**
Check `.cursor/hooks.json` and `.cursor/hooks/` into your repo. Every developer gets them automatically.

**Option B: MDM (Enterprise hooks)**
Deploy to `/Library/Application Support/Cursor/` (macOS), `/etc/cursor/` (Linux), or `C:\ProgramData\Cursor\` (Windows) via your MDM tool.

**Option C: Team Marketplace (Enterprise plan)**
Configure hooks in the Cursor dashboard. They sync automatically to all team members every 30 minutes.

---

## Summary

| Component | Role | Deterministic? | Cross-Platform? |
|-----------|------|---------------|-----------------|
| Rule (`.mdc`) | Guides AI generation | No (AI-interpreted) | Yes (text) |
| File hook (`.mjs`) | Blocks wrong file types | Yes (script) | Yes (Node.js) |
| Shell hook (`.mjs`) | Blocks wrong commands | Yes (script) | Yes (Node.js) |
| Audit hook (`.mjs`) | Logs all actions | Yes (script) | Yes (Node.js) |
| File hook (`.sh`) | Blocks wrong file types | Yes (script) | macOS/Linux only |
| File hook (`.ps1`) | Blocks wrong file types | Yes (script) | Windows only |

**The `.mjs` (Node.js) versions are the recommended approach** — one script, all platforms, no conditional logic needed.
