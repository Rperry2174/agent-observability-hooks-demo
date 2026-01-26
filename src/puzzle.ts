import { checksumLabel } from './checksum.js';
import { CLUES, type Clue } from './clues.js';

export function buildLockSeed(clues: Clue[] = CLUES): string {
  return clues.map((clue) => clue.line.trim()[0]).join('').toUpperCase();
}

export function solveDoorCode(phrase: string, clues: Clue[] = CLUES): string {
  const seed = buildLockSeed(clues);
  const normalized = phrase.trim().toLowerCase();
  const payload = `${normalized}|${seed}`;
  return `GATE-${checksumLabel(payload)}`;
}
