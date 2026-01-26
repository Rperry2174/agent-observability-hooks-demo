import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

function runTar(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('tar', args, { stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`tar exited with code ${code ?? 'null'}`));
    });
  });
}

async function main() {
  const baseDir = process.cwd();
  const distDir = path.join(baseDir, 'dist');
  await fs.mkdir(distDir, { recursive: true });

  const casePath = path.join(baseDir, 'docs/murder-case/current-case.json');
  let caseData;
  try {
    caseData = JSON.parse(await fs.readFile(casePath, 'utf8'));
  } catch (err) {
    console.error('Missing case file. Run `npm run murder:seed` first.');
    process.exit(1);
  }

  const dossierDir = path.join(distDir, 'room-dossiers');
  await fs.mkdir(dossierDir, { recursive: true });

  const dossiers = [
    'kitchen.md',
    'library.md',
    'study.md',
    'ballroom.md',
    'conservatory.md',
    'detective-office.md',
  ];

  await Promise.all(
    dossiers.map((file) =>
      fs.copyFile(
        path.join(baseDir, 'docs/murder-case/rooms', file),
        path.join(dossierDir, file),
      ),
    ),
  );

  await Promise.all([
    fs.copyFile(
      path.join(baseDir, 'docs/murder-case/CASEFILE.md'),
      path.join(distDir, 'CASEFILE.md'),
    ),
    fs.copyFile(
      path.join(baseDir, 'docs/murder-case/spanish-items.md'),
      path.join(distDir, 'spanish-items.md'),
    ),
    fs.copyFile(
      path.join(baseDir, 'docs/murder-case/mansion-map.md'),
      path.join(distDir, 'mansion-map.md'),
    ),
    fs.copyFile(casePath, path.join(distDir, 'current-case.json')),
  ]);

  const reportPath = path.join(distDir, 'murder-report.md');
  const report = [
    '# Murder Investigation Report',
    '',
    `Case ID: ${caseData.caseId}`,
    '',
    'Final determination (from case rules):',
    caseData.solution?.phrase ? `- Phrase: ${caseData.solution.phrase}` : '- Phrase: [missing]',
    '',
    'Artifacts included:',
    '- Case file',
    '- Room dossiers',
    '- Spanish items glossary',
    '- Mansion map',
    '- Case JSON',
    '',
    `Generated at: ${new Date().toISOString()}`,
    '',
  ].join('\n');

  await fs.writeFile(reportPath, report, 'utf8');

  const archivePath = path.join(distDir, 'murder-report.tar.gz');
  await runTar([
    '-czf',
    archivePath,
    '-C',
    distDir,
    'murder-report.md',
    'CASEFILE.md',
    'spanish-items.md',
    'mansion-map.md',
    'current-case.json',
    'room-dossiers',
  ]);

  console.log(`Packaged report: ${archivePath}`);
}

await main();
