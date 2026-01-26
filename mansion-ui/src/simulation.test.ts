import { describe, expect, it } from 'vitest';

import mapData from '../../docs/murder-case/mansion-map.json';
import {
  buildAgentConfigs,
  getAgentPhase,
  getAgentGridPosition,
  getLeadPhase,
  getTimelineTotalMs,
  getRoomCenter,
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
  it('builds valid agent configs with paths', () => {
    const configs = buildAgentConfigs(map, roomAgents);
    const library = configs.find((config) => config.room === 'Library');
    expect(library).toBeTruthy();
    expect(library!.pathOut.length).toBeGreaterThan(0);
    expect(library!.pathBack.length).toBe(library!.pathOut.length);
  });

  it('advances agent phases and ends in reported', () => {
    const configs = buildAgentConfigs(map, roomAgents);
    const kitchen = configs.find((config) => config.room === 'Kitchen');
    expect(kitchen).toBeTruthy();
    const config = kitchen!;
    expect(getAgentPhase(config, 0)).toBe('waiting');
    expect(getAgentPhase(config, config.startOffsetMs + 10)).toBe('walking-out');
    expect(getAgentPhase(config, config.startOffsetMs + config.walkMs + 20)).toBe('in-room');
    expect(
      getAgentPhase(
        config,
        config.startOffsetMs + config.walkMs + config.inRoomMs + 20,
      ),
    ).toBe('translating');
    expect(
      getAgentPhase(
        config,
        config.startOffsetMs +
          config.walkMs +
          config.inRoomMs +
          config.translateMs +
          20,
      ),
    ).toBe('returning');
    expect(
      getAgentPhase(
        config,
        config.startOffsetMs +
          config.walkMs +
          config.inRoomMs +
          config.translateMs +
          config.returnMs +
          config.debriefMs +
          20,
      ),
    ).toBe('reported');
  });

  it('moves an agent from office to room and back', () => {
    const configs = buildAgentConfigs(map, roomAgents);
    const library = configs.find((config) => config.room === 'Library')!;
    const officeDoor = map.roomDoors['Detective Office'];
    const roomDoor = map.roomDoors['Library'];
    const cellSize = map.cellSize;

    const officePos = {
      x: officeDoor.gridX * cellSize + cellSize / 2,
      y: officeDoor.gridY * cellSize + cellSize / 2,
    };
    const roomPos = {
      x: roomDoor.gridX * cellSize + cellSize / 2,
      y: roomDoor.gridY * cellSize + cellSize / 2,
    };

    const start = getAgentGridPosition(library, library.startOffsetMs + 1, map);
    expect(Math.abs(start.x - officePos.x)).toBeLessThanOrEqual(cellSize);
    expect(Math.abs(start.y - officePos.y)).toBeLessThanOrEqual(cellSize);

    const arrive = getAgentGridPosition(
      library,
      library.startOffsetMs + library.walkMs + 10,
      map,
    );
    expect(Math.abs(arrive.x - roomPos.x)).toBeLessThanOrEqual(cellSize);
    expect(Math.abs(arrive.y - roomPos.y)).toBeLessThanOrEqual(cellSize);

    const returned = getAgentGridPosition(
      library,
      library.startOffsetMs +
        library.walkMs +
        library.inRoomMs +
        library.translateMs +
        library.returnMs +
        library.debriefMs +
        10,
      map,
    );
    expect(Math.abs(returned.x - officePos.x)).toBeLessThanOrEqual(cellSize);
    expect(Math.abs(returned.y - officePos.y)).toBeLessThanOrEqual(cellSize);
  });

  it('completes lead phase timeline', () => {
    const configs = buildAgentConfigs(map, roomAgents);
    const total = getTimelineTotalMs(configs);
    expect(getLeadPhase(0, configs)).toBe('seeding');
    expect(getLeadPhase(total + 10, configs)).toBe('complete');
  });

  it('returns correct room center positions', () => {
    const office = getRoomCenter(map, 'Detective Office');
    const officeLayout = map.layout.find((l) => l.room === 'Detective Office')!;
    expect(office.x).toBe((officeLayout.gridX + officeLayout.width / 2) * map.cellSize);
    expect(office.y).toBe((officeLayout.gridY + officeLayout.height / 2) * map.cellSize);
  });
});
