import { CLUES, formatClues, weightedWhisper } from './clues.js';
import { solveDoorCode } from './puzzle.js';

const phrase = process.argv[2] ?? 'lantern';

console.log('Haunted Repo Escape Room');
console.log('');
console.log('Clues found in the foyer:');
console.log(formatClues(CLUES));
console.log('');
console.log(weightedWhisper(CLUES));
console.log('');
console.log(`Door code for "${phrase}": ${solveDoorCode(phrase)}`);
