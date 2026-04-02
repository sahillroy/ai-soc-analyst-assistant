import { X, ExternalLink } from 'lucide-react'
import { updateAlertStatus, updateAlertNotes } from '../api/client'
import { useState } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// BUG FIXES vs original:
//
// 1. MitreTag had useState(alert?.notes) and handleNotesSave inside it —
//    'alert' is NOT a prop of MitreTag, only of IncidentModal.
//    → ReferenceError: alert is not defined → blank page in production.
//    FIX: Moved notes state + handleNotesSave into IncidentModal where
//         'alert' is in scope.
//
// 2. The notes <textarea> and Save button were rendered OUTSIDE the modal's
//    closing </div>, meaning they floated outside the backdrop entirely and
//    referenced notes/setNotes/handleNotesSave from MitreTag scope (undefined).
//    FIX: Moved notes section inside the modal content div.
//
// 3. The modal outer <div> (backdrop) had two children: the modal box AND the
//    notes div — notes was a sibling of the modal, not inside it.
//    FIX: Single child modal box that contains everything including notes.
//
// 4. useState hooks must be at the top of their component, before any return.
//    The original had them scattered across MitreTag and IncidentModal.
//    FIX: All hooks are at the top of IncidentModal.
// ─────────────────────────────────────────────────────────────────────────────

function MitreTag({ mitre }) {
  // mitre_technique is stored as JSON string in DB — parse safely
  let parsed = {}
  try {
    parsed = typeof mitre === 'string' ? JSON.parse(mitre) : (mitre || {})
  } catch {
    parsed = {}
  }

  const tid    = parsed.technique_id   || '—'
  const tname  = parsed.technique_name || '—'
  const tactic = parsed.tactic         || '—'
  const url    = parsed.mitre_url      || `https://attack.mitre.org/techniques/${tid}/`

  // ✅ No hooks here — MitreTag is a pure display component
  return (
    <div style={{
      background: '#0f172a', borderRadius: 6, padding: '10px 14px',
      border: '1px solid #334155', fontSize: 13,
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
        style={{
          color: '#3b82f6', fontSize: 12,
          display: 'flex', alignItems: 'center', gap: 4, marginTop: 6,
        }}
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

const STATUS_COLORS = {
  'New':            '#3b82f6',
  'Investigating':  '#f59e0b',
  'Resolved':       '#10b981',
  'False Positive': '#475569',
}

export default function IncidentModal({ alert, onClose }) {
  // ✅ All hooks at the top of the component, before any conditional returns
  const [status,     setStatus]     = useState(alert?.status || 'New')
  const [notes,      setNotes]      = useState(alert?.notes  || '')
  const [notesSaved, setNotesSaved] = useState(false)

  // Render nothing if no alert is selected
  if (!alert) return null

  const handleStatusChange = async (e) => {
    const newStatus = e.target.value
    setStatus(newStatus)
    try {
      await updateAlertStatus(alert.incident_id, newStatus)
    } catch (err) {
      console.error('Failed to update status:', err)
    }
  }

  const handleNotesSave = async () => {
    try {
      await updateAlertNotes(alert.incident_id, notes)
      setNotesSaved(true)
      setTimeout(() => setNotesSaved(false), 2000)
    } catch (err) {
      console.error('Failed to save notes:', err)
    }
  }

  const sevColor = SEV_COLOR[alert.severity] || '#475569'

  return (
    // Backdrop — click outside to close
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {/* Modal box — stop clicks propagating to backdrop */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#1e293b', border: '1px solid #334155',
          borderRadius: 12, width: '90%', maxWidth: 640,
          padding: 28, maxHeight: '85vh', overflowY: 'auto',
        }}
      >
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'flex-start', marginBottom: 20,
        }}>
          <div>
            <div style={{ color: '#3b82f6', fontWeight: 700, fontSize: 18 }}>
              {alert.incident_id}
            </div>

            {/* Severity badge */}
            <div style={{
              display: 'inline-block', marginTop: 6, padding: '2px 10px',
              borderRadius: 12, fontSize: 12, fontWeight: 600,
              background: sevColor + '22',
              color: sevColor,
              border: `1px solid ${sevColor}44`,
            }}>
              {alert.severity}
            </div>

            {/* Status dropdown */}
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: '#94a3b8', fontSize: 12 }}>STATUS</span>
              <select
                value={status}
                onChange={handleStatusChange}
                style={{
                  background: (STATUS_COLORS[status] || '#3b82f6') + '22',
                  color:      STATUS_COLORS[status]  || '#3b82f6',
                  border:     `1px solid ${STATUS_COLORS[status] || '#3b82f6'}44`,
                  borderRadius: 6, padding: '4px 10px',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {['New', 'Investigating', 'Resolved', 'False Positive'].map(s => (
                  <option key={s} value={s} style={{ background: '#1e293b', color: '#f8fafc' }}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}
          >
            <X size={22} />
          </button>
        </div>

        {/* ── AI Summary ───────────────────────────────────────────────── */}
        <div style={{ marginBottom: 16 }}>
          <div style={SLAB.label}>AI Summary</div>
          <div style={{
            ...SLAB.value, background: '#0f172a', borderRadius: 6,
            padding: '10px 14px', border: '1px solid #334155',
          }}>
            {alert.incident_summary || '—'}
          </div>
        </div>

        {/* ── Recommended Action ───────────────────────────────────────── */}
        <div style={{ marginBottom: 16 }}>
          <div style={SLAB.label}>Recommended Action</div>
          <div style={{ ...SLAB.value, color: '#f59e0b', fontWeight: 600 }}>
            {alert.recommended_action || '—'}
          </div>
        </div>

        {/* ── Detail grid ──────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          {[
            ['Source IP',   alert.source_ip],
            ['Destination', `${alert.destination_ip}:${alert.port}`],
            ['Alert Type',  alert.alert_type],
            ['Risk Score',  alert.risk_score],
            ['Confidence',  `${Number(alert.confidence).toFixed(1)}%`],
            ['Campaign',    alert.campaign_id],
            ['Country',     alert.ip_country || '—'],
            ['Escalation',  alert.escalation],
          ].map(([label, val]) => (
            <div key={label} style={{
              background: '#0f172a', borderRadius: 6,
              padding: '8px 12px', border: '1px solid #334155',
            }}>
              <div style={SLAB.label}>{label}</div>
              <div style={SLAB.value}>{val}</div>
            </div>
          ))}
        </div>

        {/* ── MITRE ATT&CK ─────────────────────────────────────────────── */}
        <MitreTag mitre={alert.mitre_technique} />

        {/* ── Automation Result ─────────────────────────────────────────── */}
        <div style={{ marginTop: 12, marginBottom: 16 }}>
          <div style={SLAB.label}>Automation Result</div>
          <div style={{ ...SLAB.value, color: '#64748b', fontSize: 13 }}>
            {alert.automation_result || '—'}
          </div>
        </div>

        {/* ── Analyst Notes ─────────────────────────────────────────────── */}
        {/* ✅ Notes section is now INSIDE the modal box, not floating outside */}
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
              marginTop: 8,
              background: notesSaved ? '#10b981' : '#3b82f6',
              color: '#fff', border: 'none', borderRadius: 6,
              padding: '6px 16px', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
              transition: 'background 0.2s',
            }}
          >
            {notesSaved ? '✓ Saved' : 'Save Notes'}
          </button>
        </div>

      </div>{/* end modal box */}
    </div>  /* end backdrop */
  )
}
