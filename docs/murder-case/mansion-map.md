# Mansion Map

A grid-based map of the mansion with the Detective Office in the center and investigation rooms around the edges.

## Layout (11x11 grid)

```
┌───────────┬───────┬───────────┐
│  KITCHEN  │░░░░░░░│  LIBRARY  │
│   (3x3)   │ hall  │   (3x3)   │
├───────────┼░░░░░░░┼───────────┤
│░░ hall ░░░│       │░░ hall ░░░│
├───────────┤  DET  ├───────────┤
│░░ hall ░░░│ OFFICE│░░ hall ░░░│
├───────────┤ (3x3) ├───────────┤
│░░ hall ░░░│  HQ   │░░ hall ░░░│
├───────────┼░░░░░░░┼───────────┤
│   STUDY   │BALLRM │CONSERV.   │
│   (3x3)   │ (3x3) │  (3x3)    │
└───────────┴───────┴───────────┘
```

## Rooms

| Room              | Grid Position | Size | Color  |
|-------------------|---------------|------|--------|
| Detective Office  | (4,4)         | 3x3  | Purple |
| Kitchen           | (0,0)         | 3x3  | Red    |
| Library           | (8,0)         | 3x3  | Green  |
| Study             | (0,8)         | 3x3  | Gold   |
| Ballroom          | (4,8)         | 3x3  | Violet |
| Conservatory      | (8,8)         | 3x3  | Teal   |

## Movement

Agents move cell-by-cell through hallway tiles using BFS pathfinding. Each cell takes 350ms to traverse.

### Command to simulate walking

```bash
npm run mansion:walk -- --from "Detective Office" --to "Kitchen"
```

## Agent Flow

1. All agents start at the Detective Office
2. Each agent walks to their assigned room through hallways
3. Agents investigate in-room (read dossier, decode word)
4. Agents announce their word via speech bubble during "translating" phase
5. Agents return to Detective Office
6. Lead detective compiles all words in order to solve the case
