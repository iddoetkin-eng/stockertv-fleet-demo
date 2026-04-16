# StockerTV Demo — Standalone

Static, single-folder bundle of the two StockerTV demo pages:

1. **Fleet View** (`index.html`) — Mission-control world map with 89
   exchanges and live script simulation.
2. **Pipeline Demo** (`pipeline.html`) — The curated NVIDIA Q4 FY2025
   compliance-first 15-stage pipeline with final avatar video.

No server, no auth, no Express. Works on `file://` locally and on GitHub
Pages. Navigate between the two via the **DEMO** button on Fleet View
and the **FLEET** button on the Pipeline page.

## Files

| File | Purpose |
|---|---|
| `index.html` | Entry point — Fleet View. |
| `fleet.css` | Fleet View styles. |
| `fleet.js` | Fleet View app — map, launch animation, drill-down, audit, kiosk. |
| `showcase.js` | `window.FLEET_SHOWCASE` — 89 exchanges (lat/lng + trading hours), 100 companies, sector content, 41 company profiles, 85 Natural Earth 110m continent paths. |
| `pipeline.html` | Pipeline Demo page. |
| `pipeline.css` | Pipeline Demo styles. |
| `pipeline.js` | Pipeline runner — 15-stage cinematic replay + avatar video modal. |
| `pipeline-showcase.js` | `window.PIPELINE_SHOWCASE` — curated NVIDIA Q4 FY2025 story. Numbers are real 10-K disclosures. |
| `soundfx.js` | Procedural Web Audio UI sounds — shared across both pages. |

## Running locally

Open `index.html` in Chrome. All assets load via relative `<script>` tags,
so `file://` works out of the box. Click **DEMO** (top right) to open the
Pipeline Demo in a new tab; click **FLEET** from there to come back.

## Hosting on GitHub Pages

Already hosted at:
<https://iddoetkin-eng.github.io/stockertv-fleet-demo/>
<https://iddoetkin-eng.github.io/stockertv-fleet-demo/pipeline.html>

To update: push to `main`, Pages redeploys in ~30s.

## Keyboard shortcuts (Fleet View)

| Key | Action |
|---|---|
| `A` | Toggle audit mode |
| `B` | Ring the bell on a random named exchange |
| `?` | Toggle the shortcut help overlay |
| `Esc` | Close the drill-down modal |

## Regenerating showcase files from the orchestrator

Both showcase files are snapshots of the orchestrator's `services/` data:

```bash
cd ../stockertv-orchestrator

# Fleet
node -e 'process.stdout.write("window.FLEET_SHOWCASE = " + JSON.stringify(require("./services/fleetShowcase")) + ";\n");' > ../stockertv-demo-fleet/showcase.js

# Pipeline
node -e 'process.stdout.write("window.PIPELINE_SHOWCASE = " + JSON.stringify(require("./services/pipelineShowcase")) + ";\n");' > ../stockertv-demo-fleet/pipeline-showcase.js
```
