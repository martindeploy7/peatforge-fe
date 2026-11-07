# PeatForge operations workspace

Current authority, 2026-11-07: the user requests integration with the fullstack backend in `../peatforge`, locally, preserving this design. Implemented backend endpoints and provenance supersede the earlier frontend-demo baseline below. State comes from same-origin `/api` and backend persistence. Intentional reuse of the validated browser-voice module is part of integration; imports and dependencies stay within this frontend. Historical notes/harnesses below describe the previous baseline. See README.md for current launch and coverage.

Purpose: independently implement the observed PeatForge command center for BPBD operators using laptops and tablets, 768 CSS pixels or wider. Operators follow a shared sequence: risk warning, field report, proposed action, human decision and follow-up communication.

Workflow authority: https://glistening-alfajores-3f22e0.netlify.app/ and the observations recorded in `evidence/REFERENCE.md`. Preserve the observed Indonesian wording, available demo data and decision/SMS/replay behavior. Unobserved private algorithms, measurements and integrations are not established by this reconstruction.

Design authority: on 2026-11-07 the user explicitly approved structural refinement using Palantir for map-centered composition, Linear for the decision queue and ArcGIS for risk presentation. This supersedes pixel-level fidelity to the original composition; Netlify remains the workflow and content reference. The references guide hierarchy and interaction patterns, without copying their source or product chrome. `DESIGN.md` records the accepted implementation direction.

Operating context: three working panes on laptops; on narrower tablets the dominant map precedes the decision queue and village context, with page scrolling. Day and night themes remain available. Selection links proposal villages, map markers and context. The decision queue keeps evidence expandable and human approval explicit. Map controls and touch handlers support pan, pinch zoom, rotation and tilt; browser test results and limitations belong in `evidence/QA.md`. No phone-specific composition is requested.

Data truth: local actions operate on frontend demo state. SMS is a simulator, not a real message service. Risk hexagons, non-anchor village positions, illustrative curves and intermediate replay transitions are independently authored approximations. The public Talio coordinate is an anchor, not proof that surrounding geometry represents surveyed boundaries. Unknown values remain unavailable. National coverage is a map view, not a recovered national monitoring dataset.

Source boundary: this folder has its own registry-installed dependencies. Source in `../web/`, previous generated deployments and older design implementations are excluded from inspection, import, linking and reuse. `evidence/PROVENANCE.md` records the boundary and disclosure of prior-session exposure.

Delivery: a separate localhost application on port 5180, reproducible build, state/render/geometry tests and browser QA harnesses. `evidence/final-build-tests.log` records the final local build/test/boundary commands; `evidence/QA.md` records observed browser outcomes, including failures or blocked checks. Synthetic TouchEvents are not physical-device validation. No deployment is requested.
