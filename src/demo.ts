import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

import { SpanStatusCode, context, trace } from '@opentelemetry/api';
import { SeverityNumber } from '@opentelemetry/api-logs';

import { CLUES, formatClues, weightedWhisper } from './clues.js';
import { solveDoorCode } from './puzzle.js';
import { initTelemetry, getTracer, getMeter, getLogEmitter } from './telemetry.js';

// ── Telemetry bootstrap ─────────────────────────────────────────────
const shutdownTelemetry = initTelemetry();

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

  files.sort();

  for (const f of files) {
    const buf = await fs.readFile(f);
    totalBytes += buf.byteLength;
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
  const phrase = process.argv[2] ?? 'lantern';
  const intensity = clampInt(Number(process.env.DEMO_INTENSITY ?? '3'), 1, 10);
  const seed = 1337 + intensity * 97;
  const rng = mulberry32(seed);
  const rootDir = process.cwd();

  const tracer = getTracer();
  const meter = getMeter();
  const logger = getLogEmitter();

  // ── Metrics instruments ──────────────────────────────────────────
  const stageDurationHist = meter.createHistogram('demo.stage.duration_ms', {
    description: 'Duration of each demo stage in milliseconds',
    unit: 'ms',
  });
  const cpuHashCounter = meter.createCounter('demo.cpu.hashes_total', {
    description: 'Total SHA-256 hashes computed during CPU stage',
  });
  const filesReadGauge = meter.createUpDownCounter('demo.fs.files_read', {
    description: 'Number of files read during filesystem stage',
  });
  const bytesReadGauge = meter.createUpDownCounter('demo.fs.bytes_read', {
    description: 'Total bytes read during filesystem stage',
  });

  // ── Root span wrapping the entire demo run ───────────────────────
  await tracer.startActiveSpan(
    'demo-run',
    {
      attributes: {
        'demo.phrase': phrase,
        'demo.intensity': intensity,
        'demo.seed': seed,
      },
    },
    async (rootSpan) => {
      try {
        console.log('Haunted Repo Escape Room — Demo Run');
        console.log('');
        console.log('Clues found in the foyer:');
        console.log(formatClues(CLUES));
        console.log('');
        console.log(weightedWhisper(CLUES));
        console.log('');
        console.log(`Demo intensity: ${intensity} (set DEMO_INTENSITY=1..10)`);
        console.log('');

        logger.emit({
          severityNumber: SeverityNumber.INFO,
          severityText: 'INFO',
          body: 'Demo run started',
          attributes: { 'demo.phrase': phrase, 'demo.intensity': intensity },
        });

        // ── Stage 1: Filesystem ──────────────────────────────────
        console.log('Stage 1/4: Searching rooms (filesystem)…');
        const stage1Start = performance.now();

        const fsResult = await tracer.startActiveSpan(
          'stage.filesystem',
          {
            attributes: { 'stage.name': 'filesystem', 'stage.number': 1 },
          },
          async (span) => {
            const result = await readTreeAndCountBytes(rootDir, ['src', 'tests', 'docs'], rng);
            span.setAttributes({
              'files.read': result.filesRead,
              'bytes.total': result.totalBytes,
            });
            span.setStatus({ code: SpanStatusCode.OK });
            span.end();
            return result;
          },
        );

        const stage1Duration = performance.now() - stage1Start;
        stageDurationHist.record(stage1Duration, { stage: 'filesystem' });
        filesReadGauge.add(fsResult.filesRead);
        bytesReadGauge.add(fsResult.totalBytes);

        logger.emit({
          severityNumber: SeverityNumber.INFO,
          severityText: 'INFO',
          body: `Stage 1 completed: read ${fsResult.filesRead} files (${fsResult.totalBytes} bytes)`,
          attributes: {
            'stage.name': 'filesystem',
            'files.read': fsResult.filesRead,
            'bytes.total': fsResult.totalBytes,
            'duration_ms': Math.round(stage1Duration),
          },
        });

        console.log(`- Read ${fsResult.filesRead} files (${fsResult.totalBytes} bytes)`);
        console.log('');

        // ── Stage 2: CPU ─────────────────────────────────────────
        console.log('Stage 2/4: Scratching sigils (CPU)…');
        const cpuMs = 250 + intensity * 180;
        const stage2Start = performance.now();

        const cpu = await tracer.startActiveSpan(
          'stage.cpu',
          {
            attributes: {
              'stage.name': 'cpu',
              'stage.number': 2,
              'cpu.target_ms': cpuMs,
            },
          },
          async (span) => {
            const result = burnCpu(cpuMs, `${phrase}|${seed}`);
            span.setAttributes({
              'cpu.hashes': result.hashes,
              'cpu.elapsed_ms': Math.round(result.elapsedMs),
            });
            span.setStatus({ code: SpanStatusCode.OK });
            span.end();
            return result;
          },
        );

        const stage2Duration = performance.now() - stage2Start;
        stageDurationHist.record(stage2Duration, { stage: 'cpu' });
        cpuHashCounter.add(cpu.hashes);

        logger.emit({
          severityNumber: SeverityNumber.INFO,
          severityText: 'INFO',
          body: `Stage 2 completed: ${cpu.hashes} hashes in ${Math.round(cpu.elapsedMs)}ms`,
          attributes: {
            'stage.name': 'cpu',
            'cpu.hashes': cpu.hashes,
            'cpu.elapsed_ms': Math.round(cpu.elapsedMs),
            'duration_ms': Math.round(stage2Duration),
          },
        });

        console.log(`- Hashed ${cpu.hashes} times in ${Math.round(cpu.elapsedMs)}ms`);
        console.log('');

        // ── Stage 3: Subprocesses ────────────────────────────────
        console.log('Stage 3/4: Listening at doors (subprocess)…');
        const waits = [120, 310, 650].map((ms) => ms + intensity * 45);
        const stage3Start = performance.now();

        await tracer.startActiveSpan(
          'stage.subprocess',
          {
            attributes: {
              'stage.name': 'subprocess',
              'stage.number': 3,
              'subprocess.count': waits.length,
            },
          },
          async (subprocessSpan) => {
            const parentCtx = context.active();

            await Promise.all(
              waits.map((ms, i) =>
                context.with(parentCtx, () =>
                  tracer.startActiveSpan(
                    `subprocess.child-${i + 1}`,
                    {
                      attributes: {
                        'child.index': i + 1,
                        'child.wait_ms': ms,
                      },
                    },
                    async (childSpan) => {
                      await runChild(process.execPath, [
                        '-e',
                        `setTimeout(() => { console.log("child ${i + 1}: waited ${ms}ms"); }, ${ms});`,
                      ]);

                      logger.emit({
                        severityNumber: SeverityNumber.INFO,
                        severityText: 'INFO',
                        body: `Subprocess child ${i + 1} completed (waited ${ms}ms)`,
                        attributes: {
                          'child.index': i + 1,
                          'child.wait_ms': ms,
                        },
                      });

                      childSpan.setStatus({ code: SpanStatusCode.OK });
                      childSpan.end();
                    },
                  ),
                ),
              ),
            );

            subprocessSpan.setStatus({ code: SpanStatusCode.OK });
            subprocessSpan.end();
          },
        );

        const stage3Duration = performance.now() - stage3Start;
        stageDurationHist.record(stage3Duration, { stage: 'subprocess' });

        logger.emit({
          severityNumber: SeverityNumber.INFO,
          severityText: 'INFO',
          body: `Stage 3 completed: ${waits.length} subprocesses finished`,
          attributes: {
            'stage.name': 'subprocess',
            'subprocess.count': waits.length,
            'duration_ms': Math.round(stage3Duration),
          },
        });

        console.log('');

        // ── Stage 4: Puzzle ──────────────────────────────────────
        console.log('Stage 4/4: Turning the key…');
        const stage4Start = performance.now();

        const door = await tracer.startActiveSpan(
          'stage.puzzle',
          {
            attributes: {
              'stage.name': 'puzzle',
              'stage.number': 4,
              'puzzle.phrase': phrase,
            },
          },
          async (span) => {
            const code = solveDoorCode(phrase);
            await sleep(80 + Math.floor(rng() * 120));
            span.setAttributes({ 'puzzle.door_code': code });
            span.setStatus({ code: SpanStatusCode.OK });
            span.end();
            return code;
          },
        );

        const stage4Duration = performance.now() - stage4Start;
        stageDurationHist.record(stage4Duration, { stage: 'puzzle' });

        logger.emit({
          severityNumber: SeverityNumber.INFO,
          severityText: 'INFO',
          body: `Stage 4 completed: door code = ${door}`,
          attributes: {
            'stage.name': 'puzzle',
            'puzzle.door_code': door,
            'duration_ms': Math.round(stage4Duration),
          },
        });

        console.log(`Door code for "${phrase}": ${door}`);

        // ── Summary log ──────────────────────────────────────────
        logger.emit({
          severityNumber: SeverityNumber.INFO,
          severityText: 'INFO',
          body: 'Demo run completed successfully',
          attributes: { 'demo.phrase': phrase, 'demo.intensity': intensity },
        });

        rootSpan.setStatus({ code: SpanStatusCode.OK });
      } catch (err) {
        rootSpan.setStatus({
          code: SpanStatusCode.ERROR,
          message: err instanceof Error ? err.message : String(err),
        });
        throw err;
      } finally {
        rootSpan.end();
      }
    },
  );

  // Flush all telemetry before exiting
  await shutdownTelemetry();
}

await main();
