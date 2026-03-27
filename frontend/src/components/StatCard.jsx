export default function StatCard({ label, value, color }) {
  const colors = {
    blue:   { border: '#3b82f6', text: '#3b82f6' },
    red:    { border: '#ef4444', text: '#ef4444' },
    orange: { border: '#f59e0b', text: '#f59e0b' },
    green:  { border: '#10b981', text: '#10b981' },
    purple: { border: '#8b5cf6', text: '#8b5cf6' },
  }
  const c = colors[color] || colors.blue

  return (
    <div style={{
      background: '#1e293b',
      borderRadius: 8,
      padding: '20px',
      borderBottom: `4px solid ${c.border}`,
      textAlign: 'center',
      flex: 1,
    }}>
      <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 8 }}>{label}</div>
      <div style={{ color: c.text, fontSize: 36, fontWeight: 700 }}>{value}</div>
    </div>
  )
}