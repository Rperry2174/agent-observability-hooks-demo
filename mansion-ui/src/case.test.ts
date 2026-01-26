import { describe, expect, it } from 'vitest';

import { computeSolution, extractClueLines, parseCaseClues, parseRoomEvidence } from './case';

const sampleCase = `
# Case File: Test

Template: The [1] [2] [3] the [4] [5].

## Clues (apply in order)
1. Each room contains a Word order number and Word.
2. Collect every room word and sort by Word order.
3. Fill the template with words 1..5 in order.
`.trim();

const libraryDoc = `
# Room Dossier: Library

- Color note: green
- Suspect seen: Sofia
- Item noted (Spanish): veneno
- Word order: 2
- Word: detective
`;

const kitchenDoc = `
# Room Dossier: Kitchen

- Color note: red
- Suspect seen: Carlos
- Item noted (Spanish): cuchillo
- Word order: 1
- Word: silent
`;

describe('case logic', () => {
  it('extracts ordered clue lines', () => {
    const lines = extractClueLines(sampleCase);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('Word order');
  });

  it('computes a phrase from clues + room evidence', () => {
    const clues = parseCaseClues(sampleCase);
    const evidence = [
      parseRoomEvidence('Library', libraryDoc)!,
      parseRoomEvidence('Kitchen', kitchenDoc)!,
    ];
    const solution = computeSolution(clues, evidence);
    expect(solution).toBeTruthy();
    expect(solution?.phrase).toContain('silent detective');
  });
});
