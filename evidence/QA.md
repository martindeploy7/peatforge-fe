# PeatForge frontend QA · 7 November 2026

## Village popover addition · 13:36 WIB

The user authorized a new village-marker popover after the manual-review freeze below. Hover/focus opens a compact village summary; click/tap pins it. Enter opens it with keyboard focus. Escape/close returns focus to its marker; an outside pointer press dismisses it. Crossing from marker to card keeps it open. Map movement, scope/replay changes or viewport resize dismiss stale previews. The same content and interactions are wired to native MapLibre and the schematic fallback.

The card derives identity, risk/countdown, canal benefit, pending proposal count, latest inbound time and available confidence from current application state. Unknown values are explicit; replay risk is distinguished from the current-session queue/replies. Buka detail desa selects the matching village and focuses its context panel. No satellite-hotspot counts were invented.

Current checkpoint: build/typecheck passes, 34 tests across six files pass, boundary passes with 27 project files. The five new tests cover known/unknown/critical/replay data and placement bounds. Playwright cases cover hover persistence, keyboard dismissal/detail focus and fallback activation after a drag, but were not executed in this environment. The Computer Use preview attempt timed out and reset its kernel after five seconds. Browser and physical-tablet verification of this new addition remain outstanding. Earlier browser results below predate this addition.

## Scope and authority

Independent implementation in `netlify-rebuild/`. Netlify observations establish product content and workflows; the user's later choice establishes the refinement: Palantir composition, Linear queue, ArcGIS risk presentation. `../web/` is excluded from this implementation. See `PROVENANCE.md` for the explicit boundary and prior-source-exposure disclosure.

Laptop and tablet only. No backend recovery, real SMS delivery, production GIS/forecast equivalence or deployment is claimed.

## Manual-review handoff · 13:09 WIB

The code is frozen for the user's manual review at `http://127.0.0.1:5180/`. The final parity pass restored the national mode's two context tabs and keyboard wraparound, L2/local-rule menu metadata, bilingual demo follow-ups, WARDEN inbound trace events and the latest volunteer reply. The village's observed +5-day canal benefit is retained separately from the proposal's +4-day benefit. Source screenshot `05-live-dark.png` independently confirms the village benefit and latest-reply row; `REFERENCE.md` records national tabs, bilingual SMS and WARDEN inbound events.

After these edits, `npm test && npm run build && npm run check:boundary` completed with exit 0: 29 tests, a successful TypeScript/Vite build (`index-CMmfwDTT.js`) and 24 project files passing the boundary check. Tests additionally check inbound recording without unintended calibration and translated responses. A national-mode keyboard/pilot-return Playwright case was added, but Playwright remains unexecuted because the server listener returns EPERM; the installed Chrome launch probe also exited SIGABRT. No passing browser results are claimed for these final edits. Earlier browser JSONs below are valid evidence for their recorded checkpoints, not a complete regression pass on this final source.

The touch fixture now waits for both documents to be visible before testing. Hidden-tab timeout or interruption produces SKIP/PARTIAL, with a visible WAITING_FOR_FOREGROUND state; it never produces a passing gesture assertion from a skipped test. Existing gesture paths and camera-delta thresholds are unchanged.

Suggested manual acceptance sequence: choose a proposal's village; return to Talio and simulate; send AIR 61 ASAP YA, then YA; inspect the inbound/calibration trace; approve or reject the proposal; seek/play/pause Replay; check national tabs and return to the pilot through Simulator HP; switch day/night. On a physical tablet, verify one-finger pan and two-finger pinch/rotation/tilt while the map is visible. No new development is planned before the user's review.

## Automated verification

- TypeScript/Vite production build passes. The existing MapLibre chunk warning remains (approximately 1.33 MB minified / 370 KB gzip).
- 29 tests pass across five files: local model transitions, geometry, gesture math, source boundary and initial UI rendering.
- Source boundary passes: project-local imports and independently installed registry dependencies. See `final-build-tests.log` for commands and exit codes.
- Manual contrast review: core muted/link pairs exceed 4.5:1 in both themes; forecast text exceeds 6.3:1; risk badge pairs exceed 6.2:1. The blue incoming SMS timestamp was corrected to 5.4:1. See `DESIGN-REVIEW.md`.

## Browser evidence

The root-owned Vite server serves `http://127.0.0.1:5180/`. Browser tests operate actual React DOM controls inside a same-origin iframe with fixed CSS dimensions. These are browser integration fixtures, not a claim of a Playwright run or physical pointer hit-testing.

`browser-matrix-pass.json`, run `664b78ce-23e8-4357-8949-cb62774a3f36`, records:

| Viewport | Light | Dark |
|---|---|---|
| 1440×900 | PASS | PASS |
| 1024×768 | PASS | PASS |
| 768×1024 | PASS | PASS |

All six combinations check the rendered app, document width, all three pane rectangles, clipping inside controls, visible button names and runtime errors. All pass. The laptop map is dominant; below 1200px it spans the first row, with queue/context side by side beneath it and normal page scrolling.

The same clean run passes nine sequential assertions: keyboard tab focus, approval, simulation, SMS tab, AIR 61 report and response, YA confirmation, Replay, Live, and rejection. No uncaught runtime errors were recorded.

Earlier failed runs remain as diagnostic evidence. One false positive treated a button inside closed `<details>` as visible; the harness now accounts for closed ancestors while retaining strict checks for visible buttons. An Arc background run timed out at SMS; the clean dedicated Chrome run completes all nine steps. No unproven application defect was patched to force a passing result.

Playwright smoke could not reach the root server from the managed shell and could not open another listener (`EPERM`). No Playwright pass is claimed.

`controls-partial.json`, run `8a1a2be7-2504-4e0a-a415-f18a3b442427`, records 13 additional passing checks: evidence/trace, query, help, menu/Escape, national empty state/pilot return, layer switches, replay seek/play/pause, local share dialog, malformed SMS, report rejection, TELP guidance, guide dismissal and runtime stability. Village context changes also passed, but its marker assertion and nine camera-button assertions were skipped because native map readiness timed out. The overall result remains PARTIAL, not PASS. Subsequent fixture diagnostics preserve actual canvas dimensions, visibility and render-frame timing.

## Touch integration

`touch-1024-dark.json`, run `59fd27e2-3a99-415f-af74-e2de833a0c70`, records five passes on the actual native MapLibre canvas:

- Pinch changes zoom by +1.12095.
- Two-finger rotation changes bearing by −44.36812°.
- Parallel two-finger movement changes pitch by +38.23935°.
- One-finger drag changes the map center.
- Outside-map events are not cancelled, and the actual external panel can scroll programmatically.

These are synthetic DOM TouchEvents. They do not prove tablet hardware behavior or native default scrolling. The SVG fallback supports flat pan/pinch/rotation, with pitch explicitly unavailable; its gesture math is covered by unit tests.

After the map's initialization moved from `load` to `style.load`, a 768px retry (`touch-768-visible-diagnostic.json`) confirmed a nonzero 768×366 canvas and a passing pinch, but rotation, pitch and pan did not produce camera deltas. The fixture reported both documents as `hidden`; its timers were throttled and the earlier 1024px pass must not be presented as a new 768px pass. This result has not established an application defect or a successful regression check. Computer Use subsequently timed out while attempting to activate the browser. A foreground rerun is outstanding. No speculative CSS height fix was applied: actual geometry disproved a collapsed canvas.

The `style.load` change initializes demo overlays when the style is available rather than waiting for all remote basemap tiles. Installed MapLibre source establishes the event distinction (`style/style.ts`, `ui/map.ts`). Production build, 29 unit tests and the source boundary passed after the change; see the final appended checkpoint in `final-build-tests.log`.

## Product alignment

The queue retains action, village, urgency, benefit and resource needs. Evidence remains expandable. Clicking a proposal's village selects the matching map/context. The stepper is scoped to the last action, and a visible local-demo label prevents simulated Live data from implying a production feed. Replay explicitly changes risk display while queue/SMS remain the current demo session.

The fundamental audit is in `PRODUCT-ALIGNMENT.md`. Additional KPI widgets, speculative automation, invented national data and new backend integrations were deferred.

## Data and verification limits

- Geography beyond the public anchor, village positions and risk hexes are independently generated demo geometry, not recovered original GIS.
- Replay contains 60 dates and observed snapshots; intervening risk values use a documented approximation.
- National data was unavailable during source observation and is represented honestly as unavailable.
- Detailed Talio values appear after the observed report/confirmation step; curves remain explicitly illustrative.
- No real backend, sensor feed, SMS transport, authentication, remote phone sharing or deployment was exercised.
- Pixel equivalence is not claimed. Source screenshots document the starting reference; refined screenshots document the later approved visual direction.
- Current coding deliverable is ready for local review; the final foreground camera/768px touch regression remains unverified because of the Computer Use state and timeout. Do not label the entire frontend flawless or all controls tested.
