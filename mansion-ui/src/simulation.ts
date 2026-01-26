export type RoomLayout = {
  room: string;
  gridX: number;
  gridY: number;
  width: number;
  height: number;
};

export type GridMapData = {
  gridSize: { cols: number; rows: number };
  cellSize: number;
  rooms: string[];
  layout: RoomLayout[];
  roomDoors: Record<string, { gridX: number; gridY: number }>;
  hallwayTiles: [number, number][];
};

export type AgentPhase =
  | 'waiting'
  | 'walking-out'
  | 'in-room'
  | 'translating'
  | 'returning'
  | 'reported';

export type LeadPhase =
  | 'seeding'
  | 'creating'
  | 'monitoring'
  | 'compiling'
  | 'checking'
  | 'packaging'
  | 'complete';

export type GridCell = { x: number; y: number };

export type AgentConfig = {
  room: string;
  agent: string;
  pathOut: GridCell[];
  pathBack: GridCell[];
  totalSteps: number;
  startOffsetMs: number;
  walkMs: number;
  inRoomMs: number;
  translateMs: number;
  returnMs: number;
  debriefMs: number;
  totalMs: number;
};

export type Point = { x: number; y: number };

export const ROOM_ORDER = ['Kitchen', 'Library', 'Study', 'Ballroom', 'Conservatory'];
export const MS_PER_STEP = 350;
export const BASE_ROOM_MS = 2500;
export const BASE_TRANSLATE_MS = 2200;
export const BASE_DEBRIEF_MS = 800;

export const phaseLabelMap: Record<AgentPhase, string> = {
  waiting: 'waiting',
  'walking-out': 'walking out',
  'in-room': 'in room',
  translating: 'translating',
  returning: 'returning',
  reported: 'reported',
};

export const statusClassMap: Record<AgentPhase, string> = {
  waiting: 'waiting',
  'walking-out': 'dispatched',
  'in-room': 'in-room',
  translating: 'translating',
  returning: 'returning',
  reported: 'reported',
};

export function formatMs(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function buildWalkableGrid(map: GridMapData): boolean[][] {
  const grid: boolean[][] = [];
  for (let y = 0; y < map.gridSize.rows; y++) {
    grid[y] = [];
    for (let x = 0; x < map.gridSize.cols; x++) {
      grid[y][x] = false;
    }
  }

  for (const [x, y] of map.hallwayTiles) {
    if (y >= 0 && y < map.gridSize.rows && x >= 0 && x < map.gridSize.cols) {
      grid[y][x] = true;
    }
  }

  for (const room of Object.keys(map.roomDoors)) {
    const door = map.roomDoors[room];
    if (door && door.gridY >= 0 && door.gridY < map.gridSize.rows) {
      grid[door.gridY][door.gridX] = true;
    }
  }

  return grid;
}

function bfsPath(
  grid: boolean[][],
  start: GridCell,
  end: GridCell,
): GridCell[] {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const key = (c: GridCell) => `${c.x},${c.y}`;
  const visited = new Set<string>();
  const queue: { cell: GridCell; path: GridCell[] }[] = [{ cell: start, path: [start] }];
  visited.add(key(start));

  const directions = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ];

  while (queue.length > 0) {
    const { cell, path } = queue.shift()!;
    if (cell.x === end.x && cell.y === end.y) {
      return path;
    }

    for (const { dx, dy } of directions) {
      const nx = cell.x + dx;
      const ny = cell.y + dy;
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      if (!grid[ny][nx]) continue;
      const next: GridCell = { x: nx, y: ny };
      const nextKey = key(next);
      if (visited.has(nextKey)) continue;
      visited.add(nextKey);
      queue.push({ cell: next, path: [...path, next] });
    }
  }

  return [start];
}

export function buildAgentConfigs(
  map: GridMapData,
  roomAgents: Record<string, string>,
): AgentConfig[] {
  const grid = buildWalkableGrid(map);
  const officeDoor = map.roomDoors['Detective Office'];

  return ROOM_ORDER.map((room, idx) => {
    const roomDoor = map.roomDoors[room];
    const start: GridCell = { x: officeDoor.gridX, y: officeDoor.gridY };
    const end: GridCell = { x: roomDoor.gridX, y: roomDoor.gridY };

    const pathOut = bfsPath(grid, start, end);
    const pathBack = [...pathOut].reverse();
    const totalSteps = pathOut.length;
    const walkMs = totalSteps * MS_PER_STEP;
    const inRoomMs = BASE_ROOM_MS + idx * 350;
    const translateMs = BASE_TRANSLATE_MS + (idx % 2) * 250;
    const returnMs = totalSteps * MS_PER_STEP;
    const debriefMs = BASE_DEBRIEF_MS + idx * 120;
    const startOffsetMs = idx * 600;
    const totalMs = startOffsetMs + walkMs + inRoomMs + translateMs + returnMs + debriefMs;

    return {
      room,
      agent: roomAgents[room],
      pathOut,
      pathBack,
      totalSteps,
      startOffsetMs,
      walkMs,
      inRoomMs,
      translateMs,
      returnMs,
      debriefMs,
      totalMs,
    };
  });
}

export function getLeadPhase(
  elapsedMs: number,
  agentConfigs: AgentConfig[],
): LeadPhase {
  let cursor = elapsedMs;
  if (cursor <= 0) return 'seeding';
  if (cursor < 800) return 'seeding';
  cursor -= 800;
  if (cursor < 900) return 'creating';
  cursor -= 900;
  const monitorWindow = Math.max(...agentConfigs.map((agent) => agent.totalMs), 0);
  if (cursor < monitorWindow) return 'monitoring';
  cursor -= monitorWindow;
  if (cursor < 2000) return 'compiling';
  cursor -= 2000;
  if (cursor < 1200) return 'checking';
  cursor -= 1200;
  if (cursor < 1500) return 'packaging';
  return 'complete';
}

export function getAgentPhase(config: AgentConfig, elapsedMs: number): AgentPhase {
  const local = elapsedMs - config.startOffsetMs;
  if (local <= 0) return 'waiting';
  if (local < config.walkMs) return 'walking-out';
  if (local < config.walkMs + config.inRoomMs) return 'in-room';
  if (local < config.walkMs + config.inRoomMs + config.translateMs) return 'translating';
  if (local < config.walkMs + config.inRoomMs + config.translateMs + config.returnMs) {
    return 'returning';
  }
  return 'reported';
}

export function getRoomCenter(map: GridMapData, room: string): Point {
  const layout = map.layout.find((l) => l.room === room);
  if (!layout) return { x: 0, y: 0 };
  const centerX = (layout.gridX + layout.width / 2) * map.cellSize;
  const centerY = (layout.gridY + layout.height / 2) * map.cellSize;
  return { x: centerX, y: centerY };
}

export function getAgentGridPosition(
  config: AgentConfig,
  elapsedMs: number,
  map: GridMapData,
): Point {
  const cellSize = map.cellSize;
  const officeDoor = map.roomDoors['Detective Office'];
  const roomDoor = map.roomDoors[config.room];
  const local = elapsedMs - config.startOffsetMs;

  const cellToPoint = (cell: GridCell): Point => ({
    x: cell.x * cellSize + cellSize / 2,
    y: cell.y * cellSize + cellSize / 2,
  });

  const officePoint = cellToPoint({ x: officeDoor.gridX, y: officeDoor.gridY });
  const roomPoint = cellToPoint({ x: roomDoor.gridX, y: roomDoor.gridY });

  if (local <= 0) return officePoint;

  if (local < config.walkMs) {
    const progress = local / Math.max(config.walkMs, 1);
    const stepIdx = Math.min(
      Math.floor(progress * config.pathOut.length),
      config.pathOut.length - 1,
    );
    const cell = config.pathOut[stepIdx];
    return cellToPoint(cell);
  }

  if (local < config.walkMs + config.inRoomMs + config.translateMs) {
    return roomPoint;
  }

  if (local < config.walkMs + config.inRoomMs + config.translateMs + config.returnMs) {
    const returnLocal = local - config.walkMs - config.inRoomMs - config.translateMs;
    const progress = returnLocal / Math.max(config.returnMs, 1);
    const stepIdx = Math.min(
      Math.floor(progress * config.pathBack.length),
      config.pathBack.length - 1,
    );
    const cell = config.pathBack[stepIdx];
    return cellToPoint(cell);
  }

  return officePoint;
}

export function getTimelineTotalMs(agentConfigs: AgentConfig[]) {
  const longestAgentMs = Math.max(...agentConfigs.map((agent) => agent.totalMs), 0);
  return 800 + 900 + longestAgentMs + 2000 + 1200 + 1500;
}
