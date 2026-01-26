import { describe, expect, it } from 'vitest';

import mapData from '../../docs/murder-case/mansion-map.json';
import {
  buildAgentConfigs,
  getAgentPhase,
  getAgentGridPosition,
  getLeadPhase,
  getTimelineTotalMs,
  getDossierPosition,
  type GridMapData,
} from './simulation';

const map = mapData as GridMapData;

const roomAgents = {
  Kitchen: 'room-kitchen',
  Library: 'room-library',
  Study: 'room-study',
  Ballroom: 'room-ballroom',
  Conservatory: 'room-conservatory',
};

describe('simulation', () => {
  it('builds valid agent configs with paths to dossiers', () => {
    const configs = buildAgentConfigs(map, roomAgents);
    const library = configs.find((config) => config.room === 'Library');
    expect(library).toBeTruthy();
    expect(library!.pathToRoom.length).toBeGreaterThan(0);
    expect(library!.pathToDossier.length).toBeGreaterThan(0);
    expect(library!.pathFromDossier.length).toBe(library!.pathToDossier.length);
    expect(library!.pathToOffice.length).toBe(library!.pathToRoom.length);
  });

  it('advances agent phases through all states and ends in reported', () => {
    const configs = buildAgentConfigs(map, roomAgents);
    const kitchen = configs.find((config) => config.room === 'Kitchen');
    expect(kitchen).toBeTruthy();
    const config = kitchen!;
    
    expect(getAgentPhase(config, 0)).toBe('waiting');
    expect(getAgentPhase(config, config.startOffsetMs + 10)).toBe('walking-out');
    
    const afterWalk = config.startOffsetMs + config.walkToRoomMs + 10;
    expect(getAgentPhase(config, afterWalk)).toBe('entering-room');
    
    const afterEnter = afterWalk + config.enterRoomMs;
    expect(getAgentPhase(config, afterEnter)).toBe('at-dossier');
    
    const afterDossier = afterEnter + config.atDossierMs;
    expect(getAgentPhase(config, afterDossier)).toBe('translating');
    
    const afterTranslate = afterDossier + config.translateMs;
    expect(getAgentPhase(config, afterTranslate)).toBe('exiting-room');
    
    const afterExit = afterTranslate + config.exitRoomMs;
    expect(getAgentPhase(config, afterExit)).toBe('returning');
    
    const afterReturn = afterExit + config.returnMs + config.debriefMs + 10;
    expect(getAgentPhase(config, afterReturn)).toBe('reported');
  });

  it('moves an agent from office to dossier and back', () => {
    const configs = buildAgentConfigs(map, roomAgents);
    const library = configs.find((config) => config.room === 'Library')!;
    const cellSize = map.cellSize;
    
    const officeDoor = map.roomDoors['Detective Office'];
    const dossier = map.roomDossiers['Library'];
    
    const officePos = {
      x: officeDoor.gridX * cellSize + cellSize / 2,
      y: officeDoor.gridY * cellSize + cellSize / 2,
    };
    const dossierPos = {
      x: dossier.gridX * cellSize + cellSize / 2,
      y: dossier.gridY * cellSize + cellSize / 2,
    };

    // At start, should be at office
    const start = getAgentGridPosition(library, library.startOffsetMs + 1, map);
    expect(Math.abs(start.x - officePos.x)).toBeLessThanOrEqual(cellSize);
    expect(Math.abs(start.y - officePos.y)).toBeLessThanOrEqual(cellSize);

    // At dossier phase, should be at dossier
    const atDossierTime = library.startOffsetMs + library.walkToRoomMs + library.enterRoomMs + 10;
    const atDossier = getAgentGridPosition(library, atDossierTime, map);
    expect(Math.abs(atDossier.x - dossierPos.x)).toBeLessThanOrEqual(cellSize);
    expect(Math.abs(atDossier.y - dossierPos.y)).toBeLessThanOrEqual(cellSize);

    // After all phases, should be back at office
    const endTime = library.startOffsetMs + library.totalMs + 10;
    const returned = getAgentGridPosition(library, endTime, map);
    expect(Math.abs(returned.x - officePos.x)).toBeLessThanOrEqual(cellSize);
    expect(Math.abs(returned.y - officePos.y)).toBeLessThanOrEqual(cellSize);
  });

  it('completes lead phase timeline', () => {
    const configs = buildAgentConfigs(map, roomAgents);
    const total = getTimelineTotalMs(configs);
    expect(getLeadPhase(0, configs)).toBe('seeding');
    expect(getLeadPhase(total + 10, configs)).toBe('complete');
  });

  it('returns correct dossier positions', () => {
    const kitchen = getDossierPosition(map, 'Kitchen');
    const kitchenDossier = map.roomDossiers['Kitchen'];
    expect(kitchen.x).toBe(kitchenDossier.gridX * map.cellSize + map.cellSize / 2);
    expect(kitchen.y).toBe(kitchenDossier.gridY * map.cellSize + map.cellSize / 2);
  });
});
