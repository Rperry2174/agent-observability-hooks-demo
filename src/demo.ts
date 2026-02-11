import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

import { CLUES, formatClues, weightedWhisper } from './clues.js';
import { solveDoorCode } from './puzzle.js';
import { initTelemetry, shutdownTelemetry, withSpan } from './telemetry.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampInt(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function burnCpu(targetMs: number, payload: string): { hashes: number; elapsedMs: number } {
  const start = performance.now();
  const end = start + targetMs;
  let hashes = 0;
  while (performance.now() < end) {
    // Small but repeatable CPU work.
    createHash('sha256').update(payload).update(String(hashes)).digest('hex');
    hashes += 1;
  }
  return { hashes, elapsedMs: performance.now() - start };
}

async function readTreeAndCountBytes(rootDir: string, relDirs: string[], rng: () => number) {
  let totalBytes = 0;
  const files: string[] = [];

  for (const relDir of relDirs) {
    const absDir = path.join(rootDir, relDir);
    const entries = await fs.readdir(absDir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isFile()) files.push(path.join(absDir, e.name));
    }
  }

  // Deterministic ordering for stable traces.
  files.sort();

  for (const f of files) {
    const buf = await fs.readFile(f);
    totalBytes += buf.byteLength;
    // A little jitter so IO steps vary in duration.
    await sleep(15 + Math.floor(rng() * 45));
  }

  return { filesRead: files.length, totalBytes };
}

async function runChild(cmd: string, args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code ?? 'null'}`));
    });
  });
}

async function main() {
  await initTelemetry('haunted-repo-demo');

  const phrase = process.argv[2] ?? 'lantern';
  const intensity = clampInt(Number(process.env.DEMO_INTENSITY ?? '3'), 1, 10);
  const seed = 1337 + intensity * 97;
  const rng = mulberry32(seed);
  const rootDir = process.cwd();

  try {
    await withSpan(
      'demo.run',
      async (runSpan) => {
        runSpan.setAttributes({
          'demo.intensity': intensity,
          'demo.phrase.length': phrase.length,
        });

        console.log('Haunted Repo Escape Room — Demo Run');
        console.log('');
        console.log('Clues found in the foyer:');
        console.log(formatClues(CLUES));
        console.log('');
        console.log(weightedWhisper(CLUES));
        console.log('');

        console.log(`Demo intensity: ${intensity} (set DEMO_INTENSITY=1..10)`);
        console.log('');

        // Stage 1: FS work (varied per file)
        console.log('Stage 1/4: Searching rooms (filesystem)…');
        const fsResult = await withSpan(
          'demo.stage.filesystem',
          async (span) => {
            const result = await readTreeAndCountBytes(rootDir, ['src', 'tests', 'docs'], rng);
            span.setAttributes({
              'demo.files.read.count': result.filesRead,
              'demo.files.read.bytes': result.totalBytes,
            });
            return result;
          },
          { 'demo.stage': 'filesystem' },
        );
        console.log(`- Read ${fsResult.filesRead} files (${fsResult.totalBytes} bytes)`);
        console.log('');

        // Stage 2: CPU work (varied)
        console.log('Stage 2/4: Scratching sigils (CPU)…');
        const cpuMs = 250 + intensity * 180;
        const cpu = await withSpan(
          'demo.stage.cpu',
          async (span) => {
            const result = burnCpu(cpuMs, `${phrase}|${seed}`);
            span.setAttributes({
              'demo.cpu.hashes': result.hashes,
              'demo.cpu.elapsed_ms': Math.round(result.elapsedMs),
            });
            return result;
          },
          { 'demo.stage': 'cpu', 'demo.cpu.target_ms': cpuMs },
        );
        console.log(`- Hashed ${cpu.hashes} times in ${Math.round(cpu.elapsedMs)}ms`);
        console.log('');

        // Stage 3: Subprocess work (varied)
        console.log('Stage 3/4: Listening at doors (subprocess)…');
        const waits = [120, 310, 650].map((ms) => ms + intensity * 45);
        await withSpan(
          'demo.stage.subprocess',
          async (span) => {
            await Promise.all(
              waits.map((ms, i) =>
                runChild(process.execPath, [
                  '-e',
                  `setTimeout(() => { console.log("child ${i + 1}: waited ${ms}ms"); }, ${ms});`,
                ]),
              ),
            );
            span.setAttribute('demo.subprocess.waits_ms', waits);
          },
          { 'demo.stage': 'subprocess' },
        );
        console.log('');

        // Stage 4: Final output
        console.log('Stage 4/4: Turning the key…');
        const door = await withSpan(
          'demo.stage.solve_door',
          async (span) => {
            const code = solveDoorCode(phrase);
            await sleep(80 + Math.floor(rng() * 120));
            span.setAttribute('demo.door.code', code);
            return code;
          },
          { 'demo.stage': 'door' },
        );
        console.log(`Door code for "${phrase}": ${door}`);
      },
      {
        'demo.entrypoint': 'src/demo.ts',
      },
    );
  } finally {
    await shutdownTelemetry();
  }
}

await main();
