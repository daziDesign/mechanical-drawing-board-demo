# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

Preserve the USB classroom deliverable: `npm run build:offline` generates one directly openable HTML file in `offline/`. Verify it under a `file://` URL, including browser save and JSON transfer between computers. Automatic browser storage does not travel with the USB file.

The teaching toolbar is grouped by purpose (basic tools, construction, annotation, editing), following the user's GeoGebra sidebar reference. Keep tools reachable and text legible at 1920×1080 and 1366×768. Existing drawing conventions prefer exact candidate points, with line segment endpoints and midpoints ahead of arbitrary segment points.
