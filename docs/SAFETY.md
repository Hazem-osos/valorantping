# Safety

Phase 1 is observe-only.

## Hard rules

- No automatic or silent system modifications (`netsh`, registry, DNS, MTU, routing, firewall, TCP stack).
- Phase 2 may change the Windows power plan or NIC device-power flag **only** after an evidence match, on-screen confirm, backup, and a working rollback.
- No VALORANT or Vanguard process access, memory reads, injection, packet capture of game traffic, or overlay hooks.
- No VPN, proxy, SOCKS, or VPS path substitution.
- No fabricated, interpolated-as-real, or demo RTT values in the live series. Timeouts are gaps, not invented milliseconds.
- Public ICMP/TCP is labeled as path quality. It is never shown as “Riot ping”.
- User-supplied hosts are validated (`hostname` / IPv4 / IPv6 token only) and passed to `spawn([cmd, ...args])`, never to a shell string.
- Traceroute hop count, probe concurrency, intervals, and timeouts are bounded. In-flight work is cancelled on stop/quit.

## Electron

- `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`
- Preload expose is an allowlisted API
- IPC payloads parsed with Zod
- Navigation and window opens denied; HTTPS may open externally
- CSP on the renderer

## Claims

The UI and recommendations must not say a reduction is guaranteed. Before/after CSV can show that a metric moved; only overlay samples can show that VALORANT moved.
