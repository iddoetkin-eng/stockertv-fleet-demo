# StockerTV Fleet View — Standalone Demo

Static, single-folder version of the `/demo/fleet` mission-control page. No
server, no auth, no Express. Works on `file://` locally and on GitHub Pages.

## Files

| File | Purpose |
|---|---|
| `index.html` | Entry point. Loads fonts, showcase data, SoundFX, fleet app. |
| `fleet.css` | All styles (dark theme, rings, map, panels, modal, reveal). |
| `fleet.js` | Simulation, launch animation, drill-down, audit, kiosk. |
| `showcase.js` | **Bundled** seed data: 89 exchanges (with lat/lng + trading hours), 100 companies, sector content, 41 company profiles, 85 Natural Earth 110m continent paths. Exposes `window.FLEET_SHOWCASE`. |
| `soundfx.js` | Procedural Web Audio UI sounds (shared module). |

## Running locally

Just open `index.html` in Chrome. Everything is loaded via `<script>` tags
with relative paths, so `file://` works.

## Hosting on GitHub Pages

```bash
gh repo create iddoetkin-eng/stockertv-fleet-demo --public --source=. --push
# Then: Settings → Pages → Deploy from branch: main, folder: / root
```

Live URL will be: `https://iddoetkin-eng.github.io/stockertv-fleet-demo/`

## Keyboard shortcuts

| Key | Action |
|---|---|
| `A` | Toggle audit mode |
| `B` | Ring the bell on a random named exchange |
| `?` | Toggle the shortcut help overlay |
| `Esc` | Close the drill-down modal |

## Regenerating showcase.js from the orchestrator

This folder is a snapshot. To refresh:

```bash
cd ../stockertv-orchestrator
node -e 'process.stdout.write("window.FLEET_SHOWCASE = " + JSON.stringify(require("./services/fleetShowcase")) + ";\n");' > ../stockertv-demo-fleet/showcase.js
```
