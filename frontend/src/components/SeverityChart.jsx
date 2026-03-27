import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts'

const COLORS = {
  Critical: '#8b5cf6',
  High:     '#ef4444',
  Medium:   '#f59e0b',
  Low:      '#10b981',
  Normal:   '#475569',
}

export default function SeverityChart({ alerts }) {
  // Count each severity from the alerts array
  const counts = alerts.reduce((acc, alert) => {
    const s = alert.severity || 'Normal'
    acc[s] = (acc[s] || 0) + 1
    return acc
  }, {})

  const data = Object.entries(counts).map(([name, value]) => ({ name, value }))

  return (
    <div style={{ background: '#1e293b', borderRadius: 8, padding: 20 }}>
      <h2 style={{ color: '#f8fafc', marginTop: 0, fontSize: 16 }}>Alert Distribution</h2>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={COLORS[entry.name] || '#475569'} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #334155', color: '#f8fafc' }}
          />
          <Legend
            formatter={(value) => <span style={{ color: '#94a3b8' }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}