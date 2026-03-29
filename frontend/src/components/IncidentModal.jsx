import { X, ExternalLink } from 'lucide-react'
import { updateAlertStatus } from '../api/client'
import { useState } from 'react'
import { updateAlertNotes } from '../api/client'

function MitreTag({ mitre }) {
  // mitre_technique comes from DB as a JSON string — parse it safely
  let parsed = {}
  try {
    parsed = typeof mitre === 'string' ? JSON.parse(mitre) : mitre
  } catch {
    parsed = {}
  }

  const tid   = parsed.technique_id   || '—'
  const tname = parsed.technique_name || '—'
  const tactic = parsed.tactic        || '—'
  const url   = parsed.mitre_url      || `https://attack.mitre.org/techniques/${tid}/`

  const [notes, setNotes] = useState(alert?.notes || '')
  const [notesSaved, setNotesSaved] = useState(false)
  
  const handleNotesSave = async () => {
    await updateAlertNotes(alert.incident_id, notes)
    setNotesSaved(true)
    setTimeout(() => setNotesSaved(false), 2000)
  }

  return (
    <div style={{
      background: '#0f172a', borderRadius: 6, padding: '10px 14px',
      border: '1px solid #334155', fontSize: 13
    }}>
      <div style={{ color: '#94a3b8', marginBottom: 4 }}>MITRE ATT&amp;CK</div>
      <div style={{ color: '#3b82f6', fontWeight: 600 }}>
        {tid} — {tname}
      </div>
      <div style={{ color: '#64748b', marginTop: 2 }}>Tactic: {tactic}</div>
      
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        style={{ color: '#3b82f6', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}
        >
        View on MITRE <ExternalLink size={12} />
      </a>
    </div>
  )
}

const SLAB = {
  label: { color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', marginBottom: 4 },
  value: { color: '#f1f5f9', fontSize: 14, lineHeight: 1.6 },
}

const SEV_COLOR = {
  Critical: '#8b5cf6', High: '#ef4444',
  Medium: '#f59e0b', Low: '#10b981', Normal: '#475569',
}

export default function IncidentModal({ alert, onClose }) {
  // ── Hooks must be at the top of the function, before any return ──
  const [status, setStatus] = useState(alert?.status || 'New')

  const STATUS_COLORS = {
    'New':            '#3b82f6',
    'Investigating':  '#f59e0b',
    'Resolved':       '#10b981',
    'False Positive': '#475569',
  }

  const handleStatusChange = async (e) => {
    const newStatus = e.target.value
    setStatus(newStatus)
    await updateAlertStatus(alert.incident_id, newStatus)
  }

  if (!alert) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#1e293b', border: '1px solid #334155',
          borderRadius: 12, width: '90%', maxWidth: 640,
          padding: 28, maxHeight: '85vh', overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ color: '#3b82f6', fontWeight: 700, fontSize: 18 }}>
              {alert.incident_id}
            </div>
            <div style={{
              display: 'inline-block', marginTop: 6, padding: '2px 10px',
              borderRadius: 12, fontSize: 12, fontWeight: 600,
              background: SEV_COLOR[alert.severity] + '22',
              color: SEV_COLOR[alert.severity],
              border: `1px solid ${SEV_COLOR[alert.severity]}44`,
            }}>
              {alert.severity}
            </div>

            {/* Status dropdown — sits below severity badge */}
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: '#94a3b8', fontSize: 12 }}>STATUS</span>
              <select
                value={status}
                onChange={handleStatusChange}
                style={{
                  background: STATUS_COLORS[status] + '22',
                  color: STATUS_COLORS[status],
                  border: `1px solid ${STATUS_COLORS[status]}44`,
                  borderRadius: 6, padding: '4px 10px',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {['New', 'Investigating', 'Resolved', 'False Positive'].map(s => (
                  <option key={s} value={s} style={{ background: '#1e293b', color: '#f8fafc' }}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
          >
            <X size={22} />
          </button>
        </div>

        {/* AI Summary */}
        <div style={{ marginBottom: 16 }}>
          <div style={SLAB.label}>AI Summary</div>
          <div style={{ ...SLAB.value, background: '#0f172a', borderRadius: 6, padding: '10px 14px', border: '1px solid #334155' }}>
            {alert.incident_summary || '—'}
          </div>
        </div>

        {/* Recommended action */}
        <div style={{ marginBottom: 16 }}>
          <div style={SLAB.label}>Recommended Action</div>
          <div style={{ ...SLAB.value, color: '#f59e0b', fontWeight: 600 }}>
            {alert.recommended_action || '—'}
          </div>
        </div>

        {/* Two-column details */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          {[
            ['Source IP',     alert.source_ip],
            ['Destination',   `${alert.destination_ip}:${alert.port}`],
            ['Alert Type',    alert.alert_type],
            ['Risk Score',    alert.risk_score],
            ['Confidence',    `${Number(alert.confidence).toFixed(1)}%`],
            ['Campaign',      alert.campaign_id],
            ['Country',       alert.ip_country || '—'],
            ['Escalation',    alert.escalation],
          ].map(([label, val]) => (
            <div key={label} style={{ background: '#0f172a', borderRadius: 6, padding: '8px 12px', border: '1px solid #334155' }}>
              <div style={SLAB.label}>{label}</div>
              <div style={SLAB.value}>{val}</div>
            </div>
          ))}
        </div>

        {/* MITRE block */}
        <MitreTag mitre={alert.mitre_technique} />

        {/* Automation result */}
        <div style={{ marginTop: 12 }}>
          <div style={SLAB.label}>Automation Result</div>
          <div style={{ ...SLAB.value, color: '#64748b', fontSize: 13 }}>
            {alert.automation_result || '—'}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={SLAB.label}>Analyst Notes</div>
        <textarea
          value={notes}
          onChange={e => { setNotes(e.target.value); setNotesSaved(false) }}
          placeholder="Add investigation notes..."
          rows={3}
          style={{
            width: '100%', background: '#0f172a', color: '#f1f5f9',
            border: '1px solid #334155', borderRadius: 6,
            padding: '10px 12px', fontSize: 13, resize: 'vertical',
            fontFamily: 'inherit', boxSizing: 'border-box',
          }}
        />
        <button
          onClick={handleNotesSave}
          style={{
            marginTop: 8, background: notesSaved ? '#10b981' : '#3b82f6',
            color: '#fff', border: 'none', borderRadius: 6,
            padding: '6px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            transition: 'background 0.2s',
          }}
        >
          {notesSaved ? '✓ Saved' : 'Save Notes'}
        </button>
      </div>  
    </div>
  )
}