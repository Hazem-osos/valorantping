# Measurements

## Probe loop

Each round pings every selected target, then waits so the nominal interval is respected. ICMP uses the OS `ping` binary. Regional AWS uses a TCP connect to port 443 because ICMP to AWS is often filtered.

Windows `ping -w` is milliseconds. macOS `ping -W` is milliseconds. Linux `-W` is seconds and is rounded up.

`time<1ms` is stored as `0.5` so LAN idle is visible without claiming 0.

## Metrics

- **avg / min / max** over successful replies only
- **p50 / p95** linear interpolation on the sorted successful RTT list
- **jitter** mean absolute successive difference
- **loss** timeouts / (successes + timeouts)
- **spike** RTT ≥ max(configured threshold, 2 × median)

## Throughput correlation

Adapter byte counters are polled every second. Upload and RTT are aligned into 1s buckets. Coincidence is the share of spike buckets whose upload is at or above the 70th percentile. Pearson r is shown when at least 3 aligned points exist.

High coincidence supports **bufferbloat / local congestion**. It does not prove a better Riyadh route exists.

## Traceroute

Read-only `tracert` / `traceroute`. First sustained jump = first hop whose average RTT is ≥ 20ms above the previous responding hop.

## VALORANT

The game uses UDP to Riot. This app never samples that path. Type the overlay. Compare it to ICMP/TCP in snapshots. Divergence is expected and recorded as a finding when |Δp95| ≥ 15ms.

## Baseline below 36ms

If the best regional/public min stays ≥ 30ms, diagnosis emits `path_floor`. Physics and WE Egypt’s route to the Gulf/Saudi cluster bound that number. Phase 1 can still reduce **spikes** if they are local queues.
