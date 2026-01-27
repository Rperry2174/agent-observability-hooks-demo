import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

// Steps from Detective Office (from mansion-map.json edges)
// MS_PER_STEP matches web UI simulation (200ms per step)
const MS_PER_STEP = 200;

const ROOM_CONFIG = {
  kitchen: { steps: 12, dossier: 'docs/murder-case/rooms/kitchen.md' },
  library: { steps: 12, dossier: 'docs/murder-case/rooms/library.md' },
  study: { steps: 12, dossier: 'docs/murder-case/rooms/study.md' },
  ballroom: { steps: 6, dossier: 'docs/murder-case/rooms/ballroom.md' },
  conservatory: { steps: 12, dossier: 'docs/murder-case/rooms/conservatory.md' },
};

// Word order for each room (matches dossier files)
// The actual WORD must be obtained by translating the Spanish item in the dossier
// using the MCP translator - there is no hardcoded word here!
const ROOM_ORDER = {
  conservatory: 1,
  ballroom: 2,
  kitchen: 3,
  library: 4,
  study: 5,
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampInt(n, min, max) {
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

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

function burnCpu(targetMs, payload) {
  const start = performance.now();
  const end = start + targetMs;
  let hashes = 0;
  while (performance.now() < end) {
    createHash('sha256').update(payload).update(String(hashes)).digest('hex');
    hashes += 1;
  }
  return { hashes, elapsedMs: performance.now() - start };
}

async function burnIo(targetMs, files, rng) {
  const start = performance.now();
  let reads = 0;
  while (performance.now() - start < targetMs) {
    const file = files[reads % files.length];
    await fs.readFile(file);
    reads += 1;
    await sleep(25 + Math.floor(rng() * 55));
  }
  return { reads, elapsedMs: performance.now() - start };
}

async function runChildWait(ms, label) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      '-e',
      `setTimeout(() => { console.log("${label}: waited ${ms}ms"); }, ${ms});`,
    ]);
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`child exit code ${code ?? 'null'}`));
    });
  });
}

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

async function main() {
  const room = process.argv[2];
  if (!room || !ROOM_CONFIG[room]) {
    console.error('Usage: node scripts/room-task.mjs <kitchen|library|study|ballroom|conservatory>');
    process.exit(1);
  }

  const intensity = clampInt(Number(process.env.ROOM_INTENSITY ?? '3'), 1, 10);
  const { steps, dossier } = ROOM_CONFIG[room];
  const seed = hashString(`${room}:${intensity}`);
  const rng = mulberry32(seed);

  const order = ROOM_ORDER[room];
  if (order === undefined) {
    console.error(`Missing order config for room: ${room}`);
    process.exit(1);
  }

  // Travel time based on actual map distance (matches web UI)
  const travelOutMs = steps * MS_PER_STEP;
  const travelBackMs = steps * MS_PER_STEP;

  // Investigation time scales with intensity
  const investigationMs = 2000 + intensity * 1000;
  const ioMs = Math.round(investigationMs * 0.35);
  const cpuMs = Math.round(investigationMs * 0.65);

  const baseDir = process.cwd();
  const files = [
    path.join(baseDir, 'docs/murder-case/CASEFILE.md'),
    path.join(baseDir, 'docs/murder-case/spanish-items.md'),
    path.join(baseDir, dossier),
  ];

  const totalMs = travelOutMs + ioMs + cpuMs + travelBackMs;

  console.log(`Room task: ${room}`);
  console.log(`Intensity: ${intensity}`);
  console.log(`Distance: ${steps} steps (${travelOutMs}ms each way)`);
  console.log(`Target duration: ${totalMs}ms`);
  console.log('');

  console.log('Stage 1/4: Traveling to the room…');
  await runChildWait(travelOutMs, `${room} (travel out)`);
  console.log('');

  console.log('Stage 2/4: Gathering notes (IO)…');
  const io = await burnIo(ioMs, files, rng);
  console.log(`- ${io.reads} reads in ${Math.round(io.elapsedMs)}ms`);
  console.log('');

  console.log('Stage 3/4: Analyzing evidence (CPU)…');
  const cpu = burnCpu(cpuMs, `${room}|${seed}`);
  console.log(`- ${cpu.hashes} hashes in ${Math.round(cpu.elapsedMs)}ms`);
  console.log('');

  console.log('Investigation complete!');
  console.log(`- Word order: ${order}`);
  console.log('- Word: <translate the Spanish item from the dossier using MCP>');
  await echoLoud(`[${room.toUpperCase()}] Order: ${order} - Translate Spanish item to get word`);
  console.log('');

  console.log('Stage 4/4: Returning to the detective…');
  await runChildWait(travelBackMs, `${room} (travel back)`);
  console.log('');

  console.log('NOTE: Agent must write findings to .room-notes/ after translating the Spanish item.');
}

await main();
