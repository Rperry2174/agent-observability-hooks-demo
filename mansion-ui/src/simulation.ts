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
  roomDossiers: Record<string, { gridX: number; gridY: number }>;
  hallwayTiles: [number, number][];
};

export type AgentPhase =
  | 'waiting'
  | 'walking-out'
  | 'entering-room'
  | 'at-dossier'
  | 'translating'
  | 'exiting-room'
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
  pathToRoom: GridCell[];
  pathToDossier: GridCell[];
  pathFromDossier: GridCell[];
  pathToOffice: GridCell[];
  totalSteps: number;
  startOffsetMs: number;
  walkToRoomMs: number;
  enterRoomMs: number;
  atDossierMs: number;
  translateMs: number;
  exitRoomMs: number;
  returnMs: number;
  debriefMs: number;
  totalMs: number;
};

export type Point = { x: number; y: number };

export const ROOM_ORDER = ['Kitchen', 'Library', 'Study', 'Ballroom', 'Conservatory'];
export const MS_PER_STEP = 200;
export const BASE_DOSSIER_MS = 1800;
export const BASE_TRANSLATE_MS = 2000;
export const BASE_DEBRIEF_MS = 600;

export const phaseLabelMap: Record<AgentPhase, string> = {
  waiting: 'waiting',
  'walking-out': 'walking to room',
  'entering-room': 'entering room',
  'at-dossier': 'reading dossier',
  translating: 'translating',
  'exiting-room': 'exiting room',
  returning: 'returning',
  reported: 'reported',
};

export const statusClassMap: Record<AgentPhase, string> = {
  waiting: 'waiting',
  'walking-out': 'dispatched',
  'entering-room': 'entering',
  'at-dossier': 'in-room',
  translating: 'translating',
  'exiting-room': 'exiting',
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

  // Mark hallway tiles as walkable
  for (const [x, y] of map.hallwayTiles) {
    if (y >= 0 && y < map.gridSize.rows && x >= 0 && x < map.gridSize.cols) {
      grid[y][x] = true;
    }
  }

  // Mark room doors as walkable
  for (const room of Object.keys(map.roomDoors)) {
    const door = map.roomDoors[room];
    if (door && door.gridY >= 0 && door.gridY < map.gridSize.rows) {
      grid[door.gridY][door.gridX] = true;
    }
  }

  // Mark room interiors as walkable (for dossier paths)
  for (const roomLayout of map.layout) {
    for (let dy = 0; dy < roomLayout.height; dy++) {
      for (let dx = 0; dx < roomLayout.width; dx++) {
        const x = roomLayout.gridX + dx;
        const y = roomLayout.gridY + dy;
        if (y >= 0 && y < map.gridSize.rows && x >= 0 && x < map.gridSize.cols) {
          grid[y][x] = true;
        }
      }
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
    const roomDossier = map.roomDossiers[room];
    
    const officeStart: GridCell = { x: officeDoor.gridX, y: officeDoor.gridY };
    const doorCell: GridCell = { x: roomDoor.gridX, y: roomDoor.gridY };
    const dossierCell: GridCell = { x: roomDossier.gridX, y: roomDossier.gridY };

    // Path: office → room door
    const pathToRoom = bfsPath(grid, officeStart, doorCell);
    // Path: room door → dossier (inside room)
    const pathToDossier = bfsPath(grid, doorCell, dossierCell);
    // Path: dossier → room door
    const pathFromDossier = [...pathToDossier].reverse();
    // Path: room door → office
    const pathToOffice = [...pathToRoom].reverse();

    const walkToRoomSteps = pathToRoom.length;
    const enterRoomSteps = pathToDossier.length;
    const exitRoomSteps = pathFromDossier.length;
    const returnSteps = pathToOffice.length;
    const totalSteps = walkToRoomSteps + enterRoomSteps + exitRoomSteps + returnSteps;

    const walkToRoomMs = walkToRoomSteps * MS_PER_STEP;
    const enterRoomMs = enterRoomSteps * MS_PER_STEP;
    const atDossierMs = BASE_DOSSIER_MS + idx * 300;
    const translateMs = BASE_TRANSLATE_MS + (idx % 2) * 200;
    const exitRoomMs = exitRoomSteps * MS_PER_STEP;
    const returnMs = returnSteps * MS_PER_STEP;
    const debriefMs = BASE_DEBRIEF_MS + idx * 100;
    const startOffsetMs = idx * 800;
    const totalMs = startOffsetMs + walkToRoomMs + enterRoomMs + atDossierMs + translateMs + exitRoomMs + returnMs + debriefMs;

    return {
      room,
      agent: roomAgents[room],
      pathToRoom,
      pathToDossier,
      pathFromDossier,
      pathToOffice,
      totalSteps,
      startOffsetMs,
      walkToRoomMs,
      enterRoomMs,
      atDossierMs,
      translateMs,
      exitRoomMs,
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
  
  let cursor = 0;
  cursor += config.walkToRoomMs;
  if (local < cursor) return 'walking-out';
  
  cursor += config.enterRoomMs;
  if (local < cursor) return 'entering-room';
  
  cursor += config.atDossierMs;
  if (local < cursor) return 'at-dossier';
  
  cursor += config.translateMs;
  if (local < cursor) return 'translating';
  
  cursor += config.exitRoomMs;
  if (local < cursor) return 'exiting-room';
  
  cursor += config.returnMs;
  if (local < cursor) return 'returning';
  
  return 'reported';
}

export function getRoomCenter(map: GridMapData, room: string): Point {
  const layout = map.layout.find((l) => l.room === room);
  if (!layout) return { x: 0, y: 0 };
  const centerX = (layout.gridX + layout.width / 2) * map.cellSize;
  const centerY = (layout.gridY + layout.height / 2) * map.cellSize;
  return { x: centerX, y: centerY };
}

export function getDossierPosition(map: GridMapData, room: string): Point {
  const dossier = map.roomDossiers[room];
  if (!dossier) return getRoomCenter(map, room);
  return {
    x: dossier.gridX * map.cellSize + map.cellSize / 2,
    y: dossier.gridY * map.cellSize + map.cellSize / 2,
  };
}

export function getAgentGridPosition(
  config: AgentConfig,
  elapsedMs: number,
  map: GridMapData,
): Point {
  const cellSize = map.cellSize;
  const local = elapsedMs - config.startOffsetMs;

  const cellToPoint = (cell: GridCell): Point => ({
    x: cell.x * cellSize + cellSize / 2,
    y: cell.y * cellSize + cellSize / 2,
  });

  const getPathPosition = (path: GridCell[], progress: number): Point => {
    const stepIdx = Math.min(
      Math.floor(progress * path.length),
      path.length - 1,
    );
    return cellToPoint(path[Math.max(0, stepIdx)]);
  };

  const officeDoor = map.roomDoors['Detective Office'];
  const officePoint = cellToPoint({ x: officeDoor.gridX, y: officeDoor.gridY });
  const dossier = map.roomDossiers[config.room];
  const dossierPoint = cellToPoint({ x: dossier.gridX, y: dossier.gridY });

  if (local <= 0) return officePoint;

  let cursor = 0;

  // Walking to room door
  cursor += config.walkToRoomMs;
  if (local < cursor) {
    const progress = (local) / Math.max(config.walkToRoomMs, 1);
    return getPathPosition(config.pathToRoom, progress);
  }

  // Entering room (walking to dossier)
  const enterStart = cursor;
  cursor += config.enterRoomMs;
  if (local < cursor) {
    const progress = (local - enterStart) / Math.max(config.enterRoomMs, 1);
    return getPathPosition(config.pathToDossier, progress);
  }

  // At dossier (reading + translating)
  cursor += config.atDossierMs;
  if (local < cursor) return dossierPoint;

  cursor += config.translateMs;
  if (local < cursor) return dossierPoint;

  // Exiting room (walking back to door)
  const exitStart = cursor;
  cursor += config.exitRoomMs;
  if (local < cursor) {
    const progress = (local - exitStart) / Math.max(config.exitRoomMs, 1);
    return getPathPosition(config.pathFromDossier, progress);
  }

  // Returning to office
  const returnStart = cursor;
  cursor += config.returnMs;
  if (local < cursor) {
    const progress = (local - returnStart) / Math.max(config.returnMs, 1);
    return getPathPosition(config.pathToOffice, progress);
  }

  return officePoint;
}

export function getTimelineTotalMs(agentConfigs: AgentConfig[]) {
  const longestAgentMs = Math.max(...agentConfigs.map((agent) => agent.totalMs), 0);
  return 800 + 900 + longestAgentMs + 2000 + 1200 + 1500;
}
