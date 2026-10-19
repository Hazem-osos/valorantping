import type { StoredSession } from './types'

export function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const text = String(value)
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`
  return text
}

export function sessionToCsv(session: StoredSession): string {
  const header = [
    'sessionId',
    'label',
    'kind',
    'source',
    'targetId',
    'targetLabel',
    'host',
    'protocol',
    'timestamp',
    'avgMs',
    'minMs',
    'maxMs',
    'lossPct',
    'inBps',
    'outBps',
    'valorantRttMs',
    'note'
  ]
  const rows: string[][] = [header]
  for (const target of session.targets) {
    for (const point of target.series) {
      rows.push([
        session.id,
        session.label,
        session.kind,
        'probe',
        target.target.id,
        target.target.label,
        target.target.host,
        target.target.protocol,
        new Date(point.t).toISOString(),
        point.avgMs === null ? '' : String(point.avgMs),
        point.minMs === null ? '' : String(point.minMs),
        point.maxMs === null ? '' : String(point.maxMs),
        point.lossPct.toFixed(2),
        point.inBps === null ? '' : String(Math.round(point.inBps)),
        point.outBps === null ? '' : String(Math.round(point.outBps)),
        '',
        ''
      ])
    }
  }
  for (const sample of session.valorant) {
    rows.push([
      session.id,
      session.label,
      session.kind,
      'valorant-overlay',
      'valorant',
      'VALORANT in-game RTT',
      'overlay',
      'manual',
      new Date(sample.t).toISOString(),
      String(sample.rttMs),
      String(sample.rttMs),
      String(sample.rttMs),
      '0',
      '',
      '',
      String(sample.rttMs),
      sample.note ?? ''
    ])
  }
  return rows.map((row) => row.map(csvEscape).join(',')).join('\n')
}
