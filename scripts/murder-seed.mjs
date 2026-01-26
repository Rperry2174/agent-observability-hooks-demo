import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOMS = ['Kitchen', 'Library', 'Study', 'Ballroom', 'Conservatory'];
const SUSPECTS = ['Lola', 'Carlos', 'Sofia', 'Bruno', 'Camila'];
const WEAPONS = ['cuchillo', 'pistola', 'cuerda', 'tuberia', 'veneno'];
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

const WORD_SLOTS = [
  ['silent', 'restless', 'hidden', 'midnight', 'forgotten'],
  ['detective', 'shadow', 'caretaker', 'whisper', 'lantern'],
  ['solves', 'guards', 'reveals', 'untangles', 'surrounds'],
  ['final', 'secret', 'forgotten', 'moonlit', 'ancient'],
  ['riddle', 'truth', 'cipher', 'pattern', 'memory'],
];

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
  const lines = [
    `# Room Dossier: ${room}`,
    '',
    `- Color note: ${data.color}`,
    `- Suspect seen: ${data.suspect}`,
    `- Item noted (Spanish): ${data.weapon}`,
    `- Word order: ${data.wordOrder}`,
    `- Word: ${data.word}`,
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

  const suspects = shuffle(SUSPECTS, rng);
  const weapons = shuffle(WEAPONS, rng);
  const wordOrders = shuffle([1, 2, 3, 4, 5], rng);

  const roomData = {};
  for (const room of ROOMS) {
    const suspect = suspects[ROOMS.indexOf(room)];
    const weapon = weapons[ROOMS.indexOf(room)];
    const wordOrder = wordOrders[ROOMS.indexOf(room)];
    const word = pick(WORD_SLOTS[wordOrder - 1], rng);
    const color = pick(COLORS, rng);

    roomData[room] = {
      room,
      suspect,
      weapon,
      color,
      wordOrder,
      word,
      observations: OBSERVATIONS[room],
    };
  }

  const template = 'The [1] [2] [3] the [4] [5].';
  const orderedWords = Object.values(roomData)
    .map((entry) => ({
      order: entry.wordOrder,
      word: entry.word,
      room: entry.room,
    }))
    .sort((a, b) => a.order - b.order);
  const phrase = orderedWords.reduce(
    (acc, entry) => acc.replace(new RegExp(`\\[${entry.order}\\]`, 'g'), entry.word),
    template,
  );

  const clues = [
    'Each room dossier includes a Word order number and Word.',
    'Collect every room word only after the agents return to the Detective Office.',
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
    '- Weapon/item names in dossiers are written in Spanish.',
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
    console.log(`Solution: ${solution.suspect} with ${solution.weapon} in ${solution.room}`);
  } else {
    console.log('Solution: [hidden]');
  }
}

await main();
