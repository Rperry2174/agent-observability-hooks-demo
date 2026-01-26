export type Clue = {
  id: string;
  line: string;
  weight: number;
};

export const CLUES: Clue[] = [
  {
    id: 'g',
    line: 'Gravel crunches where no one walks.',
    weight: 7,
  },
  {
    id: 'h',
    line: 'Hinges creak on the hallway door.',
    weight: 5,
  },
  {
    id: 'o',
    line: 'Old portraits watch from the stairwell.',
    weight: 9,
  },
  {
    id: 's',
    line: 'Smoke curls from a cold fireplace.',
    weight: 6,
  },
  {
    id: 't',
    line: 'Thirteen candles flicker in a row.',
    weight: 8,
  },
];

export function formatClues(clues: Clue[]): string {
  return clues.map((clue) => `• ${clue.line}`).join('\n');
}

export function weightedWhisper(clues: Clue[]): string {
  const totalWeight = clues.reduce((sum, clue) => sum + clue.weight, 0);
  return `The house hums at weight ${totalWeight}.`;
}
