# Reconstruction provenance

## Local integration update, 2026-11-07

The user subsequently requested integration with the supplied local `../peatforge` fullstack implementation while preserving this frontend design. Backend routes, types and numerical semantics were inspected. The existing validated browser-voice module was deliberately ported into `src/voice/`, with offline checks, to preserve transcript validation, audio gating and lifetime controls. It has no imports outside this frontend. The prior independent-demo source baseline below describes the earlier version. No deployed Netlify bundle was fetched or changed during this integration.

Requested 7 November 2026: independently implement the deployed command center at https://glistening-alfajores-3f22e0.netlify.app/ for laptop and tablet. All new work lives in netlify-rebuild/.

Boundary: do not read, import, copy, or modify ../web/, its assets, fixtures, styles, generated bundles, or earlier reconstruction files. Install application dependencies independently from the package registry. Inspect the deployed UI and document observed behavior. Do not transplant downloaded application JavaScript into the deliverable.

Disclosure: the assistant previously worked with the old source in this conversation. This is an independent new implementation with an explicit no-file-reuse boundary, not a claim of a formally isolated clean-room team. Hackathon eligibility must follow the organizer's actual rules; no eligibility claim is made here.
