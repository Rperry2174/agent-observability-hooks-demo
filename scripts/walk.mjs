import { promises as fs } from 'node:fs';
import path from 'node:path';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampInt(n, min, max) {
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) continue;
    args[key] = value;
    i += 1;
  }
  return args;
}

function normalizeName(name) {
  return name.trim().toLowerCase().replace(/[\s-]+/g, '');
}

function buildGraph(rooms, edges) {
  const graph = new Map();
  for (const room of rooms) {
    graph.set(room, []);
  }
  for (const edge of edges) {
    graph.get(edge.from).push({ to: edge.to, steps: edge.steps });
    graph.get(edge.to).push({ to: edge.from, steps: edge.steps });
  }
  return graph;
}

function shortestPath(graph, start, end) {
  const distances = new Map();
  const previous = new Map();
  const visited = new Set();
  const nodes = Array.from(graph.keys());

  for (const node of nodes) distances.set(node, Infinity);
  distances.set(start, 0);

  while (visited.size < nodes.length) {
    let current = null;
    let best = Infinity;
    for (const node of nodes) {
      if (visited.has(node)) continue;
      const dist = distances.get(node);
      if (dist < best) {
        best = dist;
        current = node;
      }
    }
    if (!current || current === end) break;
    visited.add(current);

    for (const edge of graph.get(current)) {
      const nextDist = distances.get(current) + edge.steps;
      if (nextDist < distances.get(edge.to)) {
        distances.set(edge.to, nextDist);
        previous.set(edge.to, { from: current, steps: edge.steps });
      }
    }
  }

  if (!previous.has(end) && start !== end) return null;

  const path = [];
  let cursor = end;
  while (cursor !== start) {
    const hop = previous.get(cursor);
    if (!hop) break;
    path.unshift({ from: hop.from, to: cursor, steps: hop.steps });
    cursor = hop.from;
  }
  return { path, totalSteps: distances.get(end) };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const fromArg = args.from ?? 'Foyer';
  const toArg = args.to;
  const msPerStep = clampInt(
    Number(args['ms-per-step'] ?? process.env.WALK_MS_PER_STEP ?? '60'),
    20,
    200,
  );

  if (!toArg) {
    console.error('Usage: npm run mansion:walk -- --from <Room> --to <Room> [--ms-per-step 60]');
    process.exit(1);
  }

  const mapPath = path.join(process.cwd(), 'docs/murder-case/mansion-map.json');
  const mapRaw = await fs.readFile(mapPath, 'utf8');
  const map = JSON.parse(mapRaw);

  const roomLookup = new Map(map.rooms.map((room) => [normalizeName(room), room]));
  const from = roomLookup.get(normalizeName(fromArg));
  const to = roomLookup.get(normalizeName(toArg));

  if (!from || !to) {
    console.error('Unknown room. Valid rooms: ' + map.rooms.join(', '));
    process.exit(1);
  }

  const graph = buildGraph(map.rooms, map.edges);
  const result = shortestPath(graph, from, to);
  if (!result) {
    console.error(`No path found from ${from} to ${to}.`);
    process.exit(1);
  }

  console.log(`Walking from ${from} to ${to} (${result.totalSteps} steps).`);
  for (const segment of result.path) {
    console.log(`- ${segment.from} -> ${segment.to} (${segment.steps} steps)`);
    await sleep(segment.steps * msPerStep);
  }
  console.log('Arrived.');
}

await main();
