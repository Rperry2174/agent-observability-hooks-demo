# Case File: The Manor Murder

Case ID: case-1769473198636-130939
Generated: 2026-01-27T00:19:58.636Z

Use `npm run murder:seed` to generate a new case.

## Suspects
- Lola
- Carlos
- Sofia
- Bruno
- Camila

## Rooms
- Detective Office (lead detective base)
- Kitchen
- Library
- Study
- Ballroom
- Conservatory

## Notes
- Item names in dossiers are written in Spanish.
- You MUST translate Spanish items using the MCP translator to get the clue words.
- Apply clues strictly in numerical order (1..5).
- Use the mansion map to simulate walking between rooms.
- Do not open `docs/murder-case/current-case.json` during the investigation.

## Madlib Template
Template: The [1] [2] [3] the [4] [5].

## Clues (apply in order)
1. Each room dossier includes a Word order number and a Spanish item.
2. Translate the Spanish item using the MCP translator to get the English word.
3. Collect every translated word only after the agents return to the Detective Office.
4. Sort the words by Word order (1..5).
5. Fill the template using the ordered words.
6. The completed phrase is the winning answer.
