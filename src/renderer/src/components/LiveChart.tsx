import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatClock, formatMs } from '../lib/format'

interface SeriesPoint {
  t: number
  [key: string]: number | null
}

const COLORS = ['#C9A227', '#3DDC97', '#6CB6FF', '#F5C542', '#FF5C7A', '#c4b5fd']

export function LiveChart(props: {
  data: SeriesPoint[]
  keys: Array<{ id: string; label: string }>
  unit?: 'ms' | 'kbps'
}): JSX.Element {
  if (props.data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-white/35">
        Start probing to plot real samples. Nothing is simulated.
      </div>
    )
  }
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={props.data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="t"
            tickFormatter={(value) => formatClock(Number(value))}
            stroke="#667085"
            tick={{ fontSize: 11 }}
          />
          <YAxis
            stroke="#667085"
            tick={{ fontSize: 11 }}
            tickFormatter={(value) => String(value)}
            width={42}
          />
          <Tooltip
            contentStyle={{ background: '#12151C', border: '1px solid #242B38', borderRadius: 12 }}
            labelFormatter={(value) => formatClock(Number(value))}
            formatter={(value, name) => [
              props.unit === 'kbps'
                ? `${typeof value === 'number' ? value : '—'} kbps`
                : formatMs(typeof value === 'number' ? value : null),
              String(name)
            ]}
          />
          {props.keys.map((key, index) => (
            <Line
              key={key.id}
              type="monotone"
              dataKey={key.id}
              name={key.label}
              stroke={COLORS[index % COLORS.length]}
              dot={false}
              strokeWidth={2}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
