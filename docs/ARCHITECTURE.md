# Architecture

```
src/main        Electron main: IPC, probe engine, traceroute, adapters, history
src/preload     contextBridge allowlist
src/renderer    React dashboard
src/shared      Pure metrics, diagnosis, validation, CSV (unit tested)
```

## Data flow

Renderer invokes `monitor:start` → Zod parse → engine resolves hosts → ICMP/TCP samples and adapter polls are pushed on `probe:sample` / `adapter:sample` → renderer charts use the same `summarizeSamples` / `diagnose` functions as snapshot save.

History is `userData/history.json`, capped at 50 sessions, with downsampled series.

## Why not a “game booster” driver

A shorter Riyadh RTT needs a shorter route or less queueing on the existing one. This process can measure queueing. It cannot move WE Egypt’s backbone. Keeping the app local and read-only makes the evidence trustworthy when you later change one Windows or router setting yourself.
