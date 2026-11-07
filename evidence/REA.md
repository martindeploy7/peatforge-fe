# REA runtime readiness, 7 November 2026

The standalone REA CLI at `/private/tmp/peatforge-re-tools/node_modules/.bin/rea` reports version 6.7.0 and advertises browser scenario capture, passive inspection, screenshot capture and JavaScript bundle analysis. The browser runtime guide and `rea list-browser-targets --schema` require an explicit loopback CDP endpoint for connection. No such endpoint was supplied to this worker. No browser discovery or actions were performed through REA.

One read-only diagnostic, `rea doctor --client codex --json`, failed with `execution_failure`: native Ghidra ownership preparation attempted to compile Swift support, could not write `~/.cache/clang/ModuleCache/.../SwiftShims...pcm` under the workspace sandbox, and reported a Swift SDK/compiler mismatch. This diagnostic does not establish whether a browser provider would work with an authorized endpoint.

No global/client configuration, native browser instance or unrelated dependency was changed. REA produced no site-runtime evidence for this reconstruction. Fresh browser observations recorded by the reference-audit worker are the behavioral source; local demo calculations are implementation choices, not recovered backend behavior.

## Local model boundaries

`src/model.ts` was authored from the new observations in `REFERENCE.md`. It contains a deterministic local reducer, not recovered forecasting, dispatch, agent or calibration code. Messages stay in local application state. The observed ENGINE recalibration is represented as a trace event; no hydrological parameter model was recovered or implemented.

Replay dates use the observed 60-day range. Risk values hold the nearest directly observed snapshot (days 1, 13 and 60); intermediate risk transitions and hotspot counts remain approximations. The Talio days-to-critical display counts down from the observed 53-day initial value, consistent with observed day-13 and day-18 values. Layout positions are illustrative, not recovered geographic coordinates. Unobserved numeric metrics remain absent, and simulation is implemented for the observed Talio flow only.

The audit inspected Talio numeric details after the AIR 61 / YA flow: PFVI 231, water table -55 cm, confidence 68%, and a v1-to-v2 trace changing k_drain 0.042 to 0.047 and sy 0.35 to 0.33 after an observed -61 cm report. Because the initial numeric baseline was not verified, this demo exposes these recorded values only after that specific confirmed report. Other report values do not inherit the recorded calibration numbers. TELP and unrecognized-message replies are local guidance because the reference replies were not observed. Restarting playback from its final frame is also a reconstruction choice.
