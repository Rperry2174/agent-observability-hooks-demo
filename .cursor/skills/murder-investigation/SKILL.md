---
name: murder-investigation
description: Run a Clue-style murder investigation across multiple rooms with subagents, ordered clues, Spanish item translation via MCP, shell tasks per room, and a packaged final report. Use when the user asks to investigate a murder, solve a Clue-style case, or mentions rooms/weapons/suspects.
---
# Murder Investigation (Clue-style)

## Quick start
When a user asks for a murder investigation or Clue-style case, run a multi-room investigation that produces a rich tool trace:
- Spawn **no fewer than 5 subagents** (one per room) plus a **report compiler** and **forensics packager**.
- Each room subagent must `Read` its dossier, run a room shell task, and use MCP once to translate Spanish item names.
- Apply numbered clues **in order** from the case file and document each transformation.
- Produce a final determination and package a report artifact.

## Inputs and files
Use these files as the canonical source of truth:
- Case rules: `docs/murder-case/CASEFILE.md`
- Room dossiers: `docs/murder-case/rooms/*.md`
- Spanish item list: `docs/murder-case/spanish-items.md`
- Mansion map: `docs/murder-case/mansion-map.json` (summary in `docs/murder-case/mansion-map.md`)

## Required workflow
### 0) Generate the case
At the start of every investigation, generate a fresh case file:
- Run `npm run murder:seed`
- Use `docs/murder-case/CASEFILE.md` as the primary clue source.
- Do **not** read `docs/murder-case/current-case.json` during investigation (it is for `murder:check` and packaging).

### 1) Spawn subagents (parallel)
Spawn **at least 7** Task subagents (prefer the named project agents):
- Room agents (five): `room-kitchen`, `room-library`, `room-study`, `room-ballroom`, `room-conservatory`.
- One **Translation/MCP** agent: `mansion-translator`.
- One **Forensics Packager** agent: `forensics-packager`.

### 2) Room agent checklist (each room)
Each room agent must:
1. `Read` its room dossier in `docs/murder-case/rooms/`.
2. Simulate walking from the Detective Office to the room:
   - `npm run mansion:walk -- --from "Detective Office" --to <Room>`
3. Run the corresponding shell task (`npm run room:kitchen`, etc.).
4. Use **MCP docs** to translate Spanish items in the dossier.
5. Simulate returning to the Detective Office:
   - `npm run mansion:walk -- --from <Room> --to "Detective Office"`
6. Return structured findings (include word order + word):
   - Room
   - Spanish items found
   - English translations
   - Any clue references (by number)
   - Room-specific conclusion

### 3) Lead investigator (main agent)
While subagents run from the Detective Office:
- `Read` the Detective Office dossier (`docs/murder-case/rooms/detective-office.md`).
- `Read` the case file and Spanish item list.
- `Grep` to find any relevant references to rooms/items in the repo.
- Track the ordered clue transformations **step-by-step**:
  - Apply clue #1, then #2, etc., in sequence.
  - Show how each clue changes the interpretation.
- Combine room findings into a single determination:
  - Ordered words (1..5)
  - Final decoded phrase
Optionally delegate synthesis to `case-compiler` and review its output.

### 4) Intentional failure span
Run the failure command once to trigger `postToolUseFailure`:
- `npm run murder:check -- --phrase "<decoded phrase>"`
- The first run is expected to fail unless the correct phrase is provided.

### 5) Forensics packaging
The Forensics Packager agent must:
- Run `npm run murder:package` to produce a report in `dist/`.
- Return a short summary of the packaged artifact.

## Output format (final response)
Provide:
1. A concise narrative summary.
2. Ordered clue application log.
3. Final determination (ordered words + decoded phrase).
4. Tool activity recap (Reads/Grep/Shell/MCP/Task).
5. Packaged artifact path.

## Constraints
- Do **not** modify `.cursor/hooks.json` or any hook configuration.
- Keep code changes minimal unless the user requests fixes.
