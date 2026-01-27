import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const EXPECTED_ROOMS = ['kitchen', 'library', 'study', 'ballroom', 'conservatory'];
const NOTES_DIRNAME = '.room-notes';

async function echoLoud(message) {
  await new Promise((resolve, reject) => {
    const child = spawn('echo', [message], { stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`echo exit code ${code ?? 'null'}`));
    });
  });
}

async function fileExists(p) {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function resetNotes(notesDir) {
  if (!(await fileExists(notesDir))) return;
  const entries = await fs.readdir(notesDir);
  await Promise.all(
    entries.map(async (name) => {
      const p = path.join(notesDir, name);
      await fs.rm(p, { force: true });
    })
  );
}

async function main() {
  const arg = process.argv[2];
  const baseDir = process.cwd();
  const notesDir = path.join(baseDir, NOTES_DIRNAME);

  if (arg === '--reset') {
    await resetNotes(notesDir);
    console.log(`Reset notes in ${NOTES_DIRNAME}/`);
    return;
  }

  const missing = [];
  const clues = [];

  for (const room of EXPECTED_ROOMS) {
    const notePath = path.join(notesDir, `${room}.json`);
    if (!(await fileExists(notePath))) {
      missing.push(`${NOTES_DIRNAME}/${room}.json`);
      continue;
    }

    const raw = await fs.readFile(notePath, 'utf8');
    const note = JSON.parse(raw);
    const order = Number(note?.order);
    const word = String(note?.word ?? '').trim();

    if (!Number.isFinite(order) || !word) {
      throw new Error(`Invalid note file: ${path.relative(baseDir, notePath)}`);
    }

    clues.push({ room, order, word });
  }

  if (missing.length > 0) {
    console.error('Detective report: missing room notes:');
    for (const m of missing) console.error(`- ${m}`);
    console.error('');
    console.error('Run each room task (often via subagents), then retry:');
    console.error('- npm run room:ballroom');
    console.error('- npm run room:kitchen');
    console.error('- npm run room:study');
    console.error('- npm run room:library');
    console.error('- npm run room:conservatory');
    process.exit(1);
  }

  clues.sort((a, b) => (a.order - b.order) || a.room.localeCompare(b.room));
  const phrase = clues.map((c) => c.word).join(' ');

  console.log('Detective Office');
  console.log('');
  console.log('Clues received:');
  for (const c of clues) console.log(`- ${c.order}: ${c.word} (${c.room})`);
  console.log('');
  console.log(`Final phrase: ${phrase}`);
  await echoLoud(`[DETECTIVE] ${phrase}`);
}

await main();

