import { CLUES, formatClues, weightedWhisper } from './clues.js';
import { solveDoorCode } from './puzzle.js';
import { initTelemetry, shutdownTelemetry, withSpan } from './telemetry.js';

const phrase = process.argv[2] ?? 'lantern';

await initTelemetry('haunted-repo-cli');

try {
  await withSpan(
    'cli.render',
    () => {
      console.log('Haunted Repo Escape Room');
      console.log('');
      console.log('Clues found in the foyer:');
      console.log(formatClues(CLUES));
      console.log('');
      console.log(weightedWhisper(CLUES));
      console.log('');
      console.log(`Door code for "${phrase}": ${solveDoorCode(phrase)}`);
    },
    {
      'cli.entrypoint': 'src/cli.ts',
      'cli.clue.count': CLUES.length,
      'cli.phrase.length': phrase.length,
    },
  );
} finally {
  await shutdownTelemetry();
}
