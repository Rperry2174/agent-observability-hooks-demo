import { describe, expect, it } from 'vitest';

import { computeSolution, extractClueLines, parseCaseClues, parseRoomEvidence, translateSpanishItem } from './case';

const sampleCase = `
# Case File: Test

Template: The [1] [2] [3] the [4] [5].

## Clues (apply in order)
1. Each room contains a Word order number and Spanish item to translate.
2. Translate Spanish items and sort by Word order.
3. Fill the template with words 1..5 in order.
`.trim();

// Uses Spanish items that map to actual words via translation
const conservatoryDoc = `
# Room Dossier: Conservatory

- Color note: yellow
- Suspect seen: Bruno
- Item noted (Spanish): silencioso
- Word order: 1
`;

const ballroomDoc = `
# Room Dossier: Ballroom

- Color note: blue
- Suspect seen: Camila
- Item noted (Spanish): sombra
- Word order: 2
`;

describe('case logic', () => {
  it('extracts ordered clue lines', () => {
    const lines = extractClueLines(sampleCase);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('Word order');
  });

  it('translates Spanish items to English words', () => {
    expect(translateSpanishItem('silencioso')).toBe('SILENT');
    expect(translateSpanishItem('sombra')).toBe('SHADOW');
    expect(translateSpanishItem('resuelve')).toBe('SOLVES');
    expect(translateSpanishItem('iluminado')).toBe('MOONLIT');
    expect(translateSpanishItem('acertijo')).toBe('RIDDLE');
    expect(translateSpanishItem('unknown')).toBeNull();
  });

  it('parses room evidence and derives word from Spanish item', () => {
    const evidence = parseRoomEvidence('Conservatory', conservatoryDoc);
    expect(evidence).toBeTruthy();
    expect(evidence?.spanishItem).toBe('silencioso');
    expect(evidence?.word).toBe('SILENT');
    expect(evidence?.wordOrder).toBe(1);
  });

  it('computes a phrase from clues + room evidence', () => {
    const clues = parseCaseClues(sampleCase);
    const evidence = [
      parseRoomEvidence('Ballroom', ballroomDoc)!,
      parseRoomEvidence('Conservatory', conservatoryDoc)!,
    ];
    const solution = computeSolution(clues, evidence);
    expect(solution).toBeTruthy();
    expect(solution?.phrase).toContain('SILENT SHADOW');
  });
});
