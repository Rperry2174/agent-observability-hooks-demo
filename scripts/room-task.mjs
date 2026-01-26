import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const ROOM_CONFIG = {
  kitchen: { weight: 1, dossier: 'docs/murder-case/rooms/kitchen.md' },
  library: { weight: 2, dossier: 'docs/murder-case/rooms/library.md' },
  study: { weight: 3, dossier: 'docs/murder-case/rooms/study.md' },
  ballroom: { weight: 4, dossier: 'docs/murder-case/rooms/ballroom.md' },
  conservatory: { weight: 5, dossier: 'docs/murder-case/rooms/conservatory.md' },
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

async function main() {
  const room = process.argv[2];
  if (!room || !ROOM_CONFIG[room]) {
    console.error('Usage: node scripts/room-task.mjs <kitchen|library|study|ballroom|conservatory>');
    process.exit(1);
  }

  const intensity = clampInt(Number(process.env.ROOM_INTENSITY ?? '3'), 1, 10);
  const { weight, dossier } = ROOM_CONFIG[room];
  const seed = hashString(`${room}:${intensity}`);
  const rng = mulberry32(seed);

  const totalMs = 3000 + intensity * 1000 + weight * 700;
  const ioMs = Math.round(totalMs * 0.22);
  const cpuMs = Math.round(totalMs * 0.58);
  const waitMs = Math.max(600, totalMs - ioMs - cpuMs);

  const baseDir = process.cwd();
  const files = [
    path.join(baseDir, 'docs/murder-case/CASEFILE.md'),
    path.join(baseDir, 'docs/murder-case/spanish-items.md'),
    path.join(baseDir, dossier),
  ];

  console.log(`Room task: ${room}`);
  console.log(`Intensity: ${intensity}`);
  console.log(`Target duration: ${totalMs}ms`);
  console.log('');

  console.log('Stage 1/3: Gathering notes (IO)…');
  const io = await burnIo(ioMs, files, rng);
  console.log(`- ${io.reads} reads in ${Math.round(io.elapsedMs)}ms`);
  console.log('');

  console.log('Stage 2/3: Analyzing evidence (CPU)…');
  const cpu = burnCpu(cpuMs, `${room}|${seed}`);
  console.log(`- ${cpu.hashes} hashes in ${Math.round(cpu.elapsedMs)}ms`);
  console.log('');

  console.log('Stage 3/3: Listening for footsteps (wait)…');
  await runChildWait(waitMs, room);
}

await main();
