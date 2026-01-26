export type RoomEvidence = {
  room: string;
  color: string;
  suspect: string;
  weapon: string;
  wordOrder: number;
  word: string;
};

export type CaseClues = {
  lines: string[];
  template?: string;
};

export type CaseSolution = {
  phrase: string;
  orderedWords: { order: number; word: string; room: string }[];
  valid: boolean;
  notes: string[];
};

function normalizeValue(input: string) {
  return input.trim().toLowerCase();
}

export function extractClueLines(caseFile: string): string[] {
  return caseFile
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^\d+\.\s+/.test(line))
    .map((line) => line.replace(/^\d+\.\s+/, ''));
}

export function parseCaseClues(caseFile: string): CaseClues {
  const lines = extractClueLines(caseFile);
  const templateMatch = caseFile.match(/Template:\s*(.+)/i);

  return {
    lines,
    template: templateMatch?.[1]?.trim(),
  };
}

export function parseRoomEvidence(room: string, doc: string): RoomEvidence | null {
  const colorMatch = doc.match(/Color note:\s*([^\n]+)/i);
  const suspectMatch = doc.match(/Suspect seen:\s*([^\n]+)/i);
  const weaponMatch = doc.match(/Item noted \(Spanish\):\s*([^\n]+)/i);
  const wordOrderMatch = doc.match(/Word order:\s*([^\n]+)/i);
  const wordMatch = doc.match(/Word:\s*([^\n]+)/i);

  if (!colorMatch || !suspectMatch || !weaponMatch || !wordOrderMatch || !wordMatch) return null;
  const wordOrder = Number(wordOrderMatch[1].trim());
  if (!Number.isFinite(wordOrder)) return null;

  return {
    room,
    color: normalizeValue(colorMatch[1]),
    suspect: suspectMatch[1].trim(),
    weapon: normalizeValue(weaponMatch[1]),
    wordOrder,
    word: wordMatch[1].trim(),
  };
}

export function computeSolution(
  clues: CaseClues,
  evidence: RoomEvidence[],
): CaseSolution | null {
  if (!clues.template) return null;

  const notes: string[] = [];
  const ordered = evidence
    .map((room) => ({ order: room.wordOrder, word: room.word, room: room.room }))
    .sort((a, b) => a.order - b.order);

  const expectedOrders = new Set(ordered.map((entry) => entry.order));
  if (expectedOrders.size !== ordered.length) {
    notes.push('Duplicate word order numbers detected.');
  }

  const template = clues.template;
  let phrase = template;
  for (const entry of ordered) {
    phrase = phrase.replace(new RegExp(`\\[${entry.order}\\]`, 'g'), entry.word);
  }

  const unresolved = /\[\d+\]/.test(phrase);
  if (unresolved) {
    notes.push('Not all word slots were resolved from room evidence.');
  }

  return {
    phrase,
    orderedWords: ordered,
    valid: !unresolved,
    notes,
  };
}
