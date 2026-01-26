import { promises as fs } from 'node:fs';
import path from 'node:path';

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

const input = parseArgs(process.argv.slice(2));
const phrase = input.phrase;

if (!phrase) {
  console.error('Usage: npm run murder:check -- --phrase "<decoded phrase>"');
  process.exit(1);
}

const casePath = path.join(process.cwd(), 'docs/murder-case/current-case.json');
let caseData;
try {
  caseData = JSON.parse(await fs.readFile(casePath, 'utf8'));
} catch (err) {
  console.error('Missing case file. Run `npm run murder:seed` first.');
  process.exit(1);
}

const expectedPhrase = caseData.solution?.phrase;
if (!expectedPhrase) {
  console.error('Case file missing solution phrase. Run `npm run murder:seed` again.');
  process.exit(1);
}

const matches = phrase.trim().toLowerCase() === expectedPhrase.trim().toLowerCase();

if (!matches) {
  console.error('Phrase rejected. The evidence does not match.');
  process.exit(1);
}

console.log('Phrase confirmed. The evidence matches the case file.');
