import { useState } from 'react'
import IncidentModal from './IncidentModal'
import { exportReportCSV } from '../api/client'

const SEV_COLOR = {
  Critical: '#8b5cf6', High: '#ef4444',
  Medium: '#f59e0b', Low: '#10b981', Normal: '#475569',
}

export default function AlertTable({ alerts }) {
  const [selected, setSelected]   = useState(null)
  const [search, setSearch]       = useState('')
  const [sevFilter, setSevFilter] = useState('all')
  const [sortCol, setSortCol]     = useState(null)
  const [sortDir, setSortDir]     = useState('asc')

  // Filter
  const filtered = alerts.filter(a => {
    const matchSev  = sevFilter === 'all' || a.severity === sevFilter
    const matchText = !search || (
      a.source_ip?.includes(search) ||
      a.incident_id?.toLowerCase().includes(search.toLowerCase()) ||
      a.alert_type?.toLowerCase().includes(search.toLowerCase())
    )
    return matchSev && matchText
  })

  // Sort
  const sorted = sortCol
    ? [...filtered].sort((a, b) => {
        const va = a[sortCol] ?? ''
        const vb = b[sortCol] ?? ''
        const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true })
        return sortDir === 'asc' ? cmp : -cmp
      })
    : filtered

  const toggleSort = col => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const TH = ({ col, label }) => (
    <th
      onClick={() => toggleSort(col)}
      style={{ padding: '10px 14px', textAlign: 'left', cursor: 'pointer',
        color: sortCol === col ? '#f8fafc' : '#94a3b8',
        fontSize: 12, textTransform: 'uppercase', fontWeight: 600,
        borderBottom: '1px solid #334155', whiteSpace: 'nowrap' }}
    >
      {label} {sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
    </th>
  )



  return (
    <>
              {/* Controls */}
              <div style={{
          display: 'flex',
          gap: 12,
          marginBottom: 12,
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
        
          {/* LEFT: Search */}
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search IP, ID, alert type..."
            style={{
              background: '#0f172a',
              color: '#f8fafc',
              border: '1px solid #334155',
              borderRadius: 6,
              padding: '8px 12px',
              fontSize: 14,
              flex: 1,
              minWidth: 200,
            }}
          />
        
          {/* RIGHT: Filter + Export */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              value={sevFilter}
              onChange={e => setSevFilter(e.target.value)}
              style={{
                background: '#0f172a', color: '#f8fafc', border: '1px solid #334155',
                borderRadius: 6, padding: '8px 12px', fontSize: 14,
              }}
            >
              <option value="all">All severities</option>
              {['Critical', 'High', 'Medium', 'Low', 'Normal'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            {/* Export button */}
            <button
              onClick={exportReportCSV}
              title="Download full AI-generated incident report (includes LLM summaries, MITRE, playbook actions)"
              style={{
                background: '#1e3a5f', color: '#60a5fa', border: '1px solid #3b82f6',
                borderRadius: 6, padding: '8px 14px', cursor: 'pointer',
                fontSize: 14, display: 'flex', alignItems: 'center', gap: 6,
                fontWeight: 600,
              }}
            >
              ↓ Export AI Report
            </button>
          </div>

        </div>

      {/* Table */}
      <div style={{ background: '#1e293b', borderRadius: 8, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr>
              <TH col="incident_id"  label="Incident ID" />
              <TH col="source_ip"    label="Source IP" />
              <TH col="alert_type"   label="Alert type" />
              <TH col="severity"     label="Severity" />
              <TH col="risk_score"   label="Risk score" />
              <TH col="confidence"   label="Confidence" />
              <TH col="campaign_id"  label="Campaign" />
              <TH col="escalation"   label="Escalation" />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#475569' }}>
                  No alerts match the current filter.
                </td>
              </tr>
            ) : sorted.map((alert, i) => (
              <tr
                key={alert.incident_id || i}
                onClick={() => setSelected(alert)}
                style={{
                  borderBottom: '1px solid #1e293b',
                  cursor: 'pointer',
                  background: i % 2 === 0 ? '#0f172a' : 'transparent',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#334155'}
                onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#0f172a' : 'transparent'}
              >
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#3b82f6', fontWeight: 600 }}>
                  {alert.incident_id}
                </td>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#94a3b8' }}>
                  {alert.source_ip}
                </td>
                <td style={{ padding: '10px 14px', color: '#f1f5f9' }}>
                  {alert.alert_type}
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{
                    padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                    background: (SEV_COLOR[alert.severity] || '#475569') + '22',
                    color: SEV_COLOR[alert.severity] || '#475569',
                    border: `1px solid ${(SEV_COLOR[alert.severity] || '#475569')}44`,
                  }}>
                    {alert.severity}
                  </span>
                </td>
                <td style={{ padding: '10px 14px', color: '#94a3b8' }}>
                  {alert.risk_score}
                </td>
                <td style={{ padding: '10px 14px', color: '#94a3b8' }}>
                  {Number(alert.confidence).toFixed(1)}%
                </td>
                <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 12 }}>
                  {alert.campaign_id}
                </td>
                <td style={{ padding: '10px 14px', color: alert.escalation === 'Escalated to Tier-2' ? '#ef4444' : '#64748b', fontSize: 12 }}>
                  {alert.escalation}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      <IncidentModal alert={selected} onClose={() => setSelected(null)} />
    </>
  )
}