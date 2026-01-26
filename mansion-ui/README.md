# Mansion UI

Lightweight React UI for the murder investigation demo. It renders a simplified mansion map, shows room dossiers, and a dispatch board for agent status.

## Run locally

```bash
cd mansion-ui
npm install
npm run dev
```

Then open `http://localhost:5174`.

## Refresh the case data

Room dossiers and the case file are generated from the repo root:

```bash
cd ..
npm run murder:seed
```

Reload the UI to see the new case.
