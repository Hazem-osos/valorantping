# Riyadh Ping Optimizer

Local-only Windows desktop lab for **VALORANT Riyadh** latency on **WE Egypt Ethernet**. It measures, explains, and applies **only user-approved, backed-up Windows changes**. It does not invent ping, touch Vanguard, or install a VPN.

## Install on the gaming PC

1. Copy `dist/Riyadh-Ping-Optimizer-Setup.exe` to the Windows machine (USB or local share).
2. Double-click the Setup.exe. If SmartScreen appears, choose **More info → Run anyway**. That is normal for an unsigned installer; this app does not disable SmartScreen.
3. Install for this user (no administrator is required for ordinary diagnostics).
4. Start **Riyadh Ping Optimizer** from the Start Menu.
5. Node.js, npm, and Cursor are **not** required on the gaming PC.

Uninstall from Windows Settings → Apps. Snapshots stay in `%APPDATA%\Riyadh Ping Optimizer` unless you delete them.

## What it will do

- Live gateway, WE DNS, Cloudflare, Google DNS, and AWS Bahrain TCP 443 probes
- RTT / p50 / p95 / jitter / loss / spikes plus adapter throughput correlation
- Read-only traceroute
- Manual VALORANT overlay RTT **and** packet loss logging
- 15-minute stability test with a local report and baseline comparison
- Optimization Center: evidence-gated, confirm-to-apply, backup + rollback
- CSV export and before/after history

## What it will not do

- Promise that 36ms will become 20ms
- Treat ICMP or AWS TCP as Riot RTT
- Silently change DNS, MTU, routing, firewall, registry, TCP stack, or NIC speed
- Touch Vanguard or VALORANT memory
- Use a VPN, VPS, or paid relay

## Develop / verify

```bash
npm install
npm run verify          # typecheck, lint, tests, electron-vite build
npm run package:win     # Windows x64 NSIS installer
```

Details: [docs/MEASUREMENTS.md](docs/MEASUREMENTS.md), [docs/SAFETY.md](docs/SAFETY.md), [docs/OPTIMIZATION.md](docs/OPTIMIZATION.md), [docs/PACKAGING.md](docs/PACKAGING.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
