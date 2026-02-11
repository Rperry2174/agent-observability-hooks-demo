#!/usr/bin/env node

/**
 * Provisions the Grafana dashboard via the HTTP API.
 *
 * This script:
 * 1. Waits for Grafana to be healthy
 * 2. Imports the demo dashboard
 *
 * Usage: node scripts/grafana-setup.mjs
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

const GRAFANA_URL = process.env.GRAFANA_URL ?? 'http://localhost:3000';
const MAX_RETRIES = 30;
const RETRY_DELAY_MS = 2000;

async function waitForGrafana() {
  console.log(`Waiting for Grafana at ${GRAFANA_URL}...`);
  for (let i = 1; i <= MAX_RETRIES; i++) {
    try {
      const res = await fetch(`${GRAFANA_URL}/api/health`);
      if (res.ok) {
        const data = await res.json();
        console.log(`Grafana is ready (v${data.version})`);
        return;
      }
    } catch {
      // Not ready yet
    }
    if (i < MAX_RETRIES) {
      process.stdout.write(`  attempt ${i}/${MAX_RETRIES}...\r`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }
  throw new Error(`Grafana did not become ready after ${MAX_RETRIES} attempts`);
}

async function importDashboard() {
  const dashboardPath = path.join(process.cwd(), 'grafana/provisioning/dashboards/demo-dashboard.json');
  const dashboardJson = JSON.parse(await fs.readFile(dashboardPath, 'utf8'));

  // Wrap in the import format
  const payload = {
    dashboard: dashboardJson,
    overwrite: true,
    folderId: 0,
  };

  const res = await fetch(`${GRAFANA_URL}/api/dashboards/db`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to import dashboard: ${res.status} ${text}`);
  }

  const result = await res.json();
  console.log(`Dashboard imported: ${result.url}`);
  console.log(`  → Open: ${GRAFANA_URL}${result.url}`);
}

async function main() {
  await waitForGrafana();
  await importDashboard();
  console.log('\nSetup complete! Run the demo:');
  console.log('  npm run demo');
  console.log(`\nThen view in Grafana: ${GRAFANA_URL}/d/haunted-repo-otel-demo`);
}

await main();
