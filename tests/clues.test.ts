import { describe, expect, it } from 'vitest';
import { CLUES } from '../src/clues.js';
import { buildLockSeed } from '../src/puzzle.js';

describe('clues', () => {
  it('builds the lock seed from clue initials', () => {
    expect(buildLockSeed(CLUES)).toBe('GHOST');
  });
});
