// components/TimelineChart.jsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

export default function TimelineChart({ alerts }) {
  // Bucket alerts by hour
  const buckets = alerts.reduce((acc, a) => {
    const hour = new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    acc[hour] = (acc[hour] || 0) + 1
    return acc
  }, {})

  const data = Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, count]) => ({ time, count }))

  return (
    <div style={{ background: '#1e293b', borderRadius: 8, padding: 20, marginBottom: 24 }}>
      <h2 style={{ color: '#f8fafc', margin: '0 0 16px', fontSize: 16 }}>Alert Volume Over Time</h2>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', color: '#f8fafc' }} />
          <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}