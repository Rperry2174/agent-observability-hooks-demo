import { describe, expect, it } from 'vitest';
import { checksum } from '../src/checksum.js';

describe('checksum', () => {
  it('uses the weighted checksum mod 97', () => {
    expect(checksum('lantern|GHOST')).toBe(21);
    expect(checksum('ember|GHOST')).toBe(49);
  });
});
