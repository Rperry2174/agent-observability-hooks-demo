import { useEffect, useMemo, useRef, useState } from 'react';

import mapData from '../../docs/murder-case/mansion-map.json';
import caseFile from '../../docs/murder-case/CASEFILE.md?raw';
import detectiveOfficeDoc from '../../docs/murder-case/rooms/detective-office.md?raw';
import kitchenDoc from '../../docs/murder-case/rooms/kitchen.md?raw';
import libraryDoc from '../../docs/murder-case/rooms/library.md?raw';
import studyDoc from '../../docs/murder-case/rooms/study.md?raw';
import ballroomDoc from '../../docs/murder-case/rooms/ballroom.md?raw';
import conservatoryDoc from '../../docs/murder-case/rooms/conservatory.md?raw';
import { computeSolution, extractClueLines, parseCaseClues, parseRoomEvidence } from './case';
import {
  buildAgentConfigs,
  formatMs,
  getAgentPhase,
  getAgentGridPosition,
  getLeadPhase,
  getTimelineTotalMs,
  getDossierPosition,
  phaseLabelMap,
  ROOM_ORDER,
  statusClassMap,
  type AgentPhase,
  type GridMapData,
} from './simulation';

const roomDocs: Record<string, string> = {
  'Detective Office': detectiveOfficeDoc,
  Kitchen: kitchenDoc,
  Library: libraryDoc,
  Study: studyDoc,
  Ballroom: ballroomDoc,
  Conservatory: conservatoryDoc,
};

const roomAgents: Record<string, string> = {
  Kitchen: 'room-kitchen',
  Library: 'room-library',
  Study: 'room-study',
  Ballroom: 'room-ballroom',
  Conservatory: 'room-conservatory',
};

const ROOM_COLORS: Record<string, string> = {
  'Detective Office': '#5c4a7a',
  Kitchen: '#8b5a5a',
  Library: '#4a7a5a',
  Study: '#7a6a4a',
  Ballroom: '#6a5a8a',
  Conservatory: '#5a7a7a',
};

export default function App() {
  const map = mapData as GridMapData;
  const [selectedRoom, setSelectedRoom] = useState('Detective Office');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const startRef = useRef<number | null>(null);

  const { gridSize, cellSize, layout, hallwayTiles, roomDoors, roomDossiers } = map;
  const gridWidth = gridSize.cols * cellSize;
  const gridHeight = gridSize.rows * cellSize;

  const agentConfigs = useMemo(() => buildAgentConfigs(map, roomAgents), [map]);
  const totalTimelineMs = useMemo(() => getTimelineTotalMs(agentConfigs), [agentConfigs]);
  const leadPhase = useMemo(
    () => getLeadPhase(elapsedMs, agentConfigs),
    [agentConfigs, elapsedMs],
  );

  const clueLines = useMemo(() => extractClueLines(caseFile), []);
  const parsedClues = useMemo(() => parseCaseClues(caseFile), []);
  const roomEvidence = useMemo(() => {
    return Object.entries(roomDocs)
      .filter(([room]) => room !== 'Detective Office')
      .map(([room, doc]) => parseRoomEvidence(room, doc))
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  }, []);
  const evidenceByRoom = useMemo(() => {
    const m = new Map<string, ReturnType<typeof parseRoomEvidence>>();
    for (const entry of roomEvidence) {
      m.set(entry.room, entry);
    }
    return m;
  }, [roomEvidence]);
  const solution = useMemo(
    () => computeSolution(parsedClues, roomEvidence),
    [parsedClues, roomEvidence],
  );

  const agentPhase = (room: string): AgentPhase => {
    const config = agentConfigs.find((agent) => agent.room === room);
    if (!config) return 'waiting';
    return getAgentPhase(config, elapsedMs);
  };

  const phaseRank: Record<AgentPhase, number> = {
    waiting: 0,
    'walking-out': 1,
    'entering-room': 2,
    'at-dossier': 3,
    translating: 4,
    'exiting-room': 5,
    returning: 6,
    reported: 7,
  };

  const allReported = agentConfigs.every(
    (agent) => getAgentPhase(agent, elapsedMs) === 'reported',
  );

  const collectedWords = agentConfigs
    .map((agent) => {
      const phase = getAgentPhase(agent, elapsedMs);
      if (phaseRank[phase] < phaseRank['exiting-room']) return null;
      const evidence = evidenceByRoom.get(agent.room);
      if (!evidence) return null;
      return {
        room: agent.room,
        order: evidence.wordOrder,
        word: evidence.word,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .sort((a, b) => a.order - b.order);

  const handleStart = () => {
    setElapsedMs((prev) => {
      if (prev >= totalTimelineMs) {
        startRef.current = performance.now();
        return 0;
      }
      startRef.current = performance.now() - prev;
      return prev;
    });
    setIsRunning(true);
  };
  const handlePause = () => setIsRunning(false);
  const handleReset = () => {
    setIsRunning(false);
    startRef.current = null;
    setElapsedMs(0);
  };

  useEffect(() => {
    if (!isRunning) return;
    let rafId = 0;
    const tick = () => {
      if (startRef.current === null) startRef.current = performance.now();
      const next = performance.now() - startRef.current;
      if (next >= totalTimelineMs) {
        setElapsedMs(totalTimelineMs);
        setIsRunning(false);
        return;
      }
      setElapsedMs(next);
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [isRunning, totalTimelineMs]);

  const hallwaySet = useMemo(() => {
    const s = new Set<string>();
    for (const [x, y] of hallwayTiles) {
      s.add(`${x},${y}`);
    }
    return s;
  }, [hallwayTiles]);

  const roomAtCell = (x: number, y: number): string | null => {
    for (const room of layout) {
      if (
        x >= room.gridX &&
        x < room.gridX + room.width &&
        y >= room.gridY &&
        y < room.gridY + room.height
      ) {
        return room.room;
      }
    }
    return null;
  };

  return (
    <div className="page">
      <header className="header">
        <div>
          <p className="eyebrow">Mansion Investigation</p>
          <h1>Mansion Map</h1>
          <p className="subhead">
            Detective Office in the center. Agents walk to dossiers inside each room.
          </p>
        </div>
        <div className="controls">
          <div className="timer">
            {formatMs(elapsedMs)} / {formatMs(totalTimelineMs)}
          </div>
          <button className="dispatch" type="button" onClick={handleStart} disabled={isRunning}>
            Start
          </button>
          <button
            className="dispatch secondary"
            type="button"
            onClick={handlePause}
            disabled={!isRunning}
          >
            Pause
          </button>
          <button className="dispatch ghost" type="button" onClick={handleReset}>
            Reset
          </button>
        </div>
      </header>

      <main className="content">
        <section className="map-container">
          <div
            className="grid-map"
            style={{ width: gridWidth, height: gridHeight }}
          >
            {/* Grid cells */}
            {Array.from({ length: gridSize.rows }).map((_, y) =>
              Array.from({ length: gridSize.cols }).map((_, x) => {
                const room = roomAtCell(x, y);
                const isHallway = hallwaySet.has(`${x},${y}`);
                const isDoor = Object.values(roomDoors).some(
                  (d) => d.gridX === x && d.gridY === y,
                );
                const isSelected = room === selectedRoom;
                const roomColor = room ? ROOM_COLORS[room] : undefined;

                let cellClass = 'cell';
                if (room) cellClass += ' cell-room';
                if (isHallway) cellClass += ' cell-hallway';
                if (isDoor) cellClass += ' cell-door';
                if (isSelected) cellClass += ' cell-selected';

                return (
                  <div
                    key={`${x}-${y}`}
                    className={cellClass}
                    style={{
                      left: x * cellSize,
                      top: y * cellSize,
                      width: cellSize,
                      height: cellSize,
                      backgroundColor: room ? roomColor : undefined,
                    }}
                    onClick={() => room && setSelectedRoom(room)}
                  />
                );
              }),
            )}

            {/* Room labels */}
            {layout.map((room) => {
              const cx = (room.gridX + room.width / 2) * cellSize;
              const cy = (room.gridY + room.height / 2) * cellSize;
              const isOffice = room.room === 'Detective Office';
              return (
                <div
                  key={room.room}
                  className="room-label"
                  style={{ left: cx, top: cy }}
                >
                  <span className="room-name">{room.room}</span>
                  {isOffice && <span className="office-badge">HQ</span>}
                </div>
              );
            })}

            {/* Dossier icons inside rooms */}
            {ROOM_ORDER.map((roomName) => {
              const dossier = roomDossiers[roomName];
              if (!dossier) return null;
              return (
                <div
                  key={`dossier-${roomName}`}
                  className="dossier-icon"
                  style={{
                    left: dossier.gridX * cellSize + cellSize / 2,
                    top: dossier.gridY * cellSize + cellSize / 2,
                  }}
                  title={`${roomName} Dossier`}
                >
                  📋
                </div>
              );
            })}

            {/* Agent sprites */}
            {agentConfigs.map((agent, idx) => {
              const phase = getAgentPhase(agent, elapsedMs);
              const position = getAgentGridPosition(agent, elapsedMs, map);
              const isAtOffice = phase === 'waiting' || phase === 'reported';
              const offsetX = isAtOffice ? (idx % 3 - 1) * 16 : 0;
              const offsetY = isAtOffice ? Math.floor(idx / 3) * 16 - 8 : 0;
              return (
                <div
                  key={agent.room}
                  className={`agent-sprite ${statusClassMap[phase]}`}
                  style={{
                    left: position.x + offsetX,
                    top: position.y + offsetY,
                  }}
                  title={`${agent.agent} (${phaseLabelMap[phase]})`}
                >
                  <span className="agent-icon">{idx + 1}</span>
                </div>
              );
            })}

            {/* Speech bubbles during translating phase */}
            {agentConfigs.map((agent) => {
              const phase = getAgentPhase(agent, elapsedMs);
              if (phase !== 'translating') return null;
              const evidence = evidenceByRoom.get(agent.room);
              if (!evidence) return null;
              const dossierPos = getDossierPosition(map, agent.room);
              return (
                <div
                  key={`${agent.room}-bubble`}
                  className="speech-bubble"
                  style={{
                    left: dossierPos.x,
                    top: dossierPos.y - 40,
                  }}
                >
                  #{evidence.wordOrder}: &quot;{evidence.word}&quot;
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel">
          <div className="panel-card">
            <h2>Lead Detective</h2>
            <p className="lead-phase">Phase: {leadPhase}</p>
            <h3>Agent Status</h3>
            <ul className="timeline">
              {agentConfigs.map((agent) => {
                const phase = agentPhase(agent.room);
                return (
                  <li key={agent.room}>
                    <span className="timeline-room">{agent.room}</span>
                    <span className={`status ${statusClassMap[phase]}`}>
                      {phaseLabelMap[phase]}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="panel-card">
            <h2>Investigation</h2>
            {!allReported && (
              <p className="lead-copy">Waiting for all agents to report...</p>
            )}
            {!allReported && collectedWords.length > 0 && (
              <>
                <h3>Collected Words</h3>
                <ul className="solution-words">
                  {collectedWords.map((entry) => (
                    <li key={`${entry.order}-${entry.room}`}>
                      <span className="solution-label">#{entry.order}</span>
                      <span className="solution-value">{entry.word}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {allReported && solution && (
              <>
                <div className="solution-phrase">{solution.phrase}</div>
                <ul className="solution-words">
                  {solution.orderedWords.map((entry) => (
                    <li key={`${entry.order}-${entry.room}`}>
                      <span className="solution-label">#{entry.order}</span>
                      <span className="solution-value">{entry.word}</span>
                      <span className="solution-room">({entry.room})</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <h3>Clues</h3>
            <ol className="clue-list">
              {clueLines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ol>
          </div>

          <div className="panel-card">
            <h2>{selectedRoom}</h2>
            <pre>{roomDocs[selectedRoom] ?? 'No dossier.'}</pre>
          </div>
        </section>
      </main>
    </div>
  );
}
