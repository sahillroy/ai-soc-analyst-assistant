import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const COLORS = {
  'Brute Force Attempt': '#ef4444',
  'Port Scanning Activity': '#f59e0b',
  'Traffic Spike / Possible Exfiltration': '#3b82f6',
  'Behavioral Anomaly': '#8b5cf6',
  'Normal Activity': '#475569',
}

export default function AlertTypeChart({ alerts }) {
  const counts = alerts.reduce((acc, a) => {
    const t = a.alert_type || 'Unknown'
    acc[t] = (acc[t] || 0) + 1
    return acc
  }, {})

  const data = Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  return (
    <div style={{ background: '#1e293b', borderRadius: 8, padding: 20 }}>
      <h2 style={{ color: '#f8fafc', margin: '0 0 16px', fontSize: 16 }}>
        Alert Types
      </h2>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} layout="vertical">
          <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} />
          <YAxis
            type="category" dataKey="name" width={220}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #334155', color: '#f8fafc' }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={COLORS[entry.name] || '#475569'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}