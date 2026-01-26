import { describe, expect, it } from 'vitest';
import { solveDoorCode } from '../src/puzzle.js';

describe('puzzle', () => {
  it('solves the door code using the normalized phrase', () => {
    expect(solveDoorCode('Lantern ')).toBe('GATE-21');
  });
});
