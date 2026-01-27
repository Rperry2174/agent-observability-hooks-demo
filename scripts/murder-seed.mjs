import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOMS = ['Kitchen', 'Library', 'Study', 'Ballroom', 'Conservatory'];
const SUSPECTS = ['Lola', 'Carlos', 'Sofia', 'Bruno', 'Camila'];
const COLORS = ['blue', 'red', 'yellow', 'purple', 'orange', 'white', 'black', 'green'];

const OBSERVATIONS = {
  Kitchen: [
    'A kettle was still warm.',
    'Flour dust on the counter, but no footprints.',
  ],
  Library: [
    'A ledger was left open on the desk.',
    'The dust on the shelves was recently disturbed.',
  ],
  Study: [
    'A stack of letters was tied with twine.',
    'The desk lamp was still on.',
  ],
  Ballroom: [
    'The piano lid was open.',
    'Scuff marks crossed the polished floor.',
  ],
  Conservatory: [
    'A humidifier was still running.',
    'Several plants had been moved recently.',
  ],
};

// Fixed Spanish items that form the puzzle phrase when translated
// The word IS the translated Spanish item - no separate "Word" field!
const ROOM_CLUES = {
  Conservatory: { spanishItem: 'silencioso', wordOrder: 1 }, // → SILENT
  Ballroom: { spanishItem: 'sombra', wordOrder: 2 },         // → SHADOW
  Kitchen: { spanishItem: 'resuelve', wordOrder: 3 },        // → SOLVES
  Library: { spanishItem: 'iluminado', wordOrder: 4 },       // → MOONLIT
  Study: { spanishItem: 'acertijo', wordOrder: 5 },          // → RIDDLE
};

// Translation dictionary (must match MCP translator)
const SPANISH_TO_ENGLISH = {
  silencioso: 'SILENT',
  sombra: 'SHADOW',
  resuelve: 'SOLVES',
  iluminado: 'MOONLIT',
  acertijo: 'RIDDLE',
};

function hashString(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

async function writeRoomDossier(baseDir, room, data) {
  // NOTE: No "Word:" field - the word IS the translated Spanish item!
  const lines = [
    `# Room Dossier: ${room}`,
    '',
    `- Color note: ${data.color}`,
    `- Suspect seen: ${data.suspect}`,
    `- Item noted (Spanish): ${data.spanishItem}`,
    `- Word order: ${data.wordOrder}`,
    '',
    'Observations:',
    ...data.observations.map((line) => `- ${line}`),
    '',
  ];
  const roomPath = path.join(baseDir, 'docs/murder-case/rooms', `${room.toLowerCase()}.md`);
  await fs.writeFile(roomPath, lines.join('\n'), 'utf8');
}

function parseArgs(argv) {
  const args = new Set();
  for (const token of argv) {
    if (token.startsWith('--')) args.add(token.slice(2));
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const seedInput = process.env.CASE_SEED ?? `${Date.now()}`;
  const seed = hashString(seedInput);
  const rng = mulberry32(seed);

  // Shuffle suspects and colors for variety (but clues are fixed)
  const suspects = shuffle(SUSPECTS, rng);

  const roomData = {};
  for (const room of ROOMS) {
    const suspect = suspects[ROOMS.indexOf(room)];
    const color = pick(COLORS, rng);
    const clue = ROOM_CLUES[room];

    roomData[room] = {
      room,
      suspect,
      spanishItem: clue.spanishItem,
      color,
      wordOrder: clue.wordOrder,
      observations: OBSERVATIONS[room],
    };
  }

  const template = 'The [1] [2] [3] the [4] [5].';
  
  // Build solution by translating Spanish items
  const orderedWords = Object.values(roomData)
    .map((entry) => ({
      order: entry.wordOrder,
      spanishItem: entry.spanishItem,
      word: SPANISH_TO_ENGLISH[entry.spanishItem],
      room: entry.room,
    }))
    .sort((a, b) => a.order - b.order);
  
  const phrase = orderedWords.reduce(
    (acc, entry) => acc.replace(new RegExp(`\\[${entry.order}\\]`, 'g'), entry.word),
    template,
  );

  const clues = [
    'Each room dossier includes a Word order number and a Spanish item.',
    'Translate the Spanish item using the MCP translator to get the English word.',
    'Collect every translated word only after the agents return to the Detective Office.',
    'Sort the words by Word order (1..5).',
    'Fill the template using the ordered words.',
    'The completed phrase is the winning answer.',
  ];

  const caseId = `case-${seedInput}-${Math.floor(rng() * 1e6)}`;
  const generatedAt = new Date().toISOString();

  const caseData = {
    caseId,
    seedInput,
    seed,
    generatedAt,
    solution: {
      phrase,
      orderedWords,
    },
    template,
    clues,
    roomData,
  };

  const baseDir = process.cwd();
  await fs.writeFile(
    path.join(baseDir, 'docs/murder-case/current-case.json'),
    JSON.stringify(caseData, null, 2) + '\n',
    'utf8',
  );

  for (const room of ROOMS) {
    await writeRoomDossier(baseDir, room, roomData[room]);
  }

  const caseFileLines = [
    '# Case File: The Manor Murder',
    '',
    `Case ID: ${caseId}`,
    `Generated: ${generatedAt}`,
    '',
    'Use `npm run murder:seed` to generate a new case.',
    '',
    '## Suspects',
    ...SUSPECTS.map((name) => `- ${name}`),
    '',
    '## Rooms',
    '- Detective Office (lead detective base)',
    ...ROOMS.map((room) => `- ${room}`),
    '',
    '## Notes',
    '- Item names in dossiers are written in Spanish.',
    '- You MUST translate Spanish items using the MCP translator to get the clue words.',
    '- Apply clues strictly in numerical order (1..5).',
    '- Use the mansion map to simulate walking between rooms.',
    '- Do not open `docs/murder-case/current-case.json` during the investigation.',
    '',
    '## Madlib Template',
    `Template: ${template}`,
    '',
    '## Clues (apply in order)',
    ...clues.map((clue, idx) => `${idx + 1}. ${clue}`),
    '',
  ];

  await fs.writeFile(
    path.join(baseDir, 'docs/murder-case/CASEFILE.md'),
    caseFileLines.join('\n'),
    'utf8',
  );

  console.log(`Generated case ${caseId}`);
  if (args.has('reveal')) {
    console.log(`Solution: ${phrase}`);
  } else {
    console.log('Solution: [hidden - translate Spanish items to discover]');
  }
}

await main();
