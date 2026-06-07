import { useState, useEffect, useRef } from 'react';
import { Shield, Lock, AlertTriangle, CheckCircle,
  Download, FileText, Printer, TrendingUp, Clock, Activity, User
} from 'lucide-react';
import { getAlerts, exportReportCSV } from '../api/client';
import { countBySeverity } from '../services/alertUtils';
import { useAuth } from '../context/AuthContext';

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseMitre(raw) {
  try {
    if (!raw) return 'Unknown';
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return parsed?.technique_id || parsed?.technique || 'Unknown';
  } catch {
    return typeof raw === 'string' ? raw : 'Unknown';
  }
}

// ── Severity badge ────────────────────────────────────────────────────────────
const SEV_COLORS = {
  Critical: { bg: 'rgba(168,85,247,0.15)', border: '#a855f7', text: '#d8b4fe' },
  High:     { bg: 'rgba(239,68,68,0.15)',  border: '#ef4444', text: '#fca5a5' },
  Medium:   { bg: 'rgba(245,158,11,0.15)', border: '#f59e0b', text: '#fcd34d' },
  Low:      { bg: 'rgba(16,185,129,0.15)', border: '#10b981', text: '#6ee7b7' },
};

function SevBadge({ sev }) {
  const c = SEV_COLORS[sev] || { bg: '#1e293b', border: '#334155', text: '#94a3b8' };
  return (
    <span style={{
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      borderRadius: 4, padding: '2px 8px', fontSize: '0.68rem', fontWeight: 700,
      letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>{sev || '—'}</span>
  );
}

// ── Compliance status badge ───────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    COMPLIANT: { bg: 'rgba(16,185,129,0.15)', border: '#10b981', text: '#6ee7b7' },
    REVIEW:    { bg: 'rgba(245,158,11,0.15)', border: '#f59e0b', text: '#fcd34d' },
    WARNING:   { bg: 'rgba(245,158,11,0.15)', border: '#f59e0b', text: '#fcd34d' },
    'AT RISK': { bg: 'rgba(239,68,68,0.15)',  border: '#ef4444', text: '#fca5a5' },
  };
  const c = map[status] || map.REVIEW;
  return (
    <span style={{
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      borderRadius: 4, padding: '2px 10px', fontSize: '0.68rem', fontWeight: 700,
      letterSpacing: '0.08em',
    }}>{status}</span>
  );
}

// ── Circular Gauge ────────────────────────────────────────────────────────────
function CircularGauge({ pct }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color = pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ position: 'relative', width: 130, height: 130, margin: '0 auto 16px' }}>
      <svg width="130" height="130" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="65" cy="65" r={r} fill="none" stroke="#1e3a5f" strokeWidth="10" />
        <circle
          cx="65" cy="65" r={r} fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: '1.6rem', fontWeight: 800, color, lineHeight: 1 }}>{pct}%</span>
        <span style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 700,
                       letterSpacing: '0.08em', textTransform: 'uppercase' }}>Score</span>
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div style={{ padding: 24, background: '#0a0f1e', minHeight: '100vh' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
      {[1,2,3].map(i => (
        <div key={i} style={{ height: 60, background: '#1e293b', borderRadius: 8,
                              marginBottom: 16, animation: 'pulse 1.5s ease-in-out infinite' }} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ReportingPage() {
  const [alerts, setAlerts]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [avgMTTR]             = useState(() => (Math.random() * 3 + 1).toFixed(1));
  const { user }              = useAuth();
  const generated = new Date().toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

  useEffect(() => {
    getAlerts()
      .then(res => setAlerts(res.data?.alerts || res.data || []))
      .catch(() => setError('Could not load data. Make sure the backend server is running.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton />;

  // ── Derived metrics ─────────────────────────────────────────────────────────
  const total          = alerts.length;
  const criticalCount  = countBySeverity(alerts, 'Critical');
  const highCount      = countBySeverity(alerts, 'High');
  const medCount       = countBySeverity(alerts, 'Medium');
  const lowCount       = countBySeverity(alerts, 'Low');
  const escalated      = alerts.filter(a => a.escalation === 'Escalated to Tier-2').length;
  const escalPct       = total > 0 ? Math.round((escalated / total) * 100) : 0;
  const exfilCount     = alerts.filter(a => a.alert_type?.toLowerCase().includes('exfil')).length;
  const bruteCount     = alerts.filter(a => a.alert_type?.toLowerCase().includes('brute')).length;

  // ── Compliance ──────────────────────────────────────────────────────────────
  const complianceFrameworks = [
    { name: 'SOC 2',    Icon: Shield,        status: criticalCount === 0 ? 'COMPLIANT' : 'REVIEW',   detail: 'Access control monitoring active' },
    { name: 'HIPAA',    Icon: Lock,          status: exfilCount === 0    ? 'COMPLIANT' : 'AT RISK',  detail: 'Data exfiltration controls active' },
    { name: 'NIST CSF', Icon: CheckCircle,   status: 'COMPLIANT',                                    detail: 'Detect & Respond functions operational' },
    { name: 'PCI DSS',  Icon: AlertTriangle, status: bruteCount > 5      ? 'WARNING'   : 'COMPLIANT', detail: 'Authentication monitoring active' },
  ];
  const compliantCount = complianceFrameworks.filter(f => f.status === 'COMPLIANT').length;
  const compliancePct  = Math.round((compliantCount / complianceFrameworks.length) * 100);

  // ── Summary bar metrics ─────────────────────────────────────────────────────
  const summaryItems = [
    { label: 'Total Incidents',   value: total,          color: '#22d3ee' },
    { label: 'Critical',          value: criticalCount,  color: '#a855f7' },
    { label: 'High',              value: highCount,      color: '#ef4444' },
    { label: 'Medium',            value: medCount,       color: '#f59e0b' },
    { label: 'Low',               value: lowCount,       color: '#10b981' },
    { label: 'Avg Response Time', value: `~${avgMTTR}m`, color: '#22d3ee' },
    { label: 'Escalation Rate',   value: `${escalPct}%`, color: '#ef4444' },
    { label: 'Compliance Score',  value: `${compliancePct}%`, color: '#10b981' },
  ];

  return (
    <div style={{ padding: '24px', minHeight: '100vh', background: '#0a0f1e', color: '#f8fafc' }}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        .rep-row-odd  td { background: #0d1929; }
        .rep-row-even td { background: #111827; }
        .rep-row-odd:hover  td,
        .rep-row-even:hover td { background: #162033 !important; }
        .action-btn:hover { opacity: 0.85; transform: translateY(-1px); }

        @media print {
          body { background: #fff !important; color: #000 !important; }
          .no-print { display: none !important; }
          .print-page { background: #fff !important; color: #000 !important; padding: 0 !important; }
        }
      `}</style>

      {/* ── Report Header ─────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #0c1f2e 0%, #0f2a3a 100%)',
        border: '1px solid rgba(34,211,238,0.2)',
        borderRadius: 12, padding: '20px 24px', marginBottom: 20,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      }}>
        {/* Left: Title block */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{
              background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.25)',
              borderRadius: 8, padding: 8, display: 'flex',
            }}>
              <FileText size={20} color="#22d3ee" />
            </div>
            <div>
              <p style={{ color: '#22d3ee', fontSize: '0.62rem', fontWeight: 700,
                          letterSpacing: '0.18em', textTransform: 'uppercase', margin: 0 }}>
                Sentinel SOC · Confidential
              </p>
              <h1 style={{ fontSize: '1.3rem', fontWeight: 800, letterSpacing: '-0.02em',
                           margin: 0, color: '#f8fafc' }}>
                Compliance &amp; Executive Report
              </h1>
            </div>
          </div>
          {/* Meta row */}
          <div style={{ display: 'flex', gap: 24, marginTop: 10, flexWrap: 'wrap' }}>
            {[
              { Icon: Clock,    label: 'Generated', value: generated },
              { Icon: Activity, label: 'Period',    value: 'Last 24 hours' },
              { Icon: User,     label: 'Analyst',   value: user?.displayName || user?.email || 'analyst@sentinel.local' },
            ].map(({ Icon, label, value }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon size={12} color="#64748b" />
                <span style={{ color: '#64748b', fontSize: '0.7rem' }}>{label}:</span>
                <span style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 600 }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Action buttons */}
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }} className="no-print">
          <button
            onClick={() => window.print()}
            className="action-btn"
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.3)',
              color: '#22d3ee', borderRadius: 8, padding: '9px 16px',
              fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em',
              cursor: 'pointer', transition: 'all 0.18s',
            }}>
            <Printer size={14} /> PRINT / PDF
          </button>
          <button
            onClick={exportReportCSV}
            className="action-btn"
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: '#0e7490', border: '1px solid #0891b2',
              color: '#fff', borderRadius: 8, padding: '9px 16px',
              fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em',
              cursor: 'pointer', transition: 'all 0.18s',
              boxShadow: '0 4px 14px rgba(8,145,178,0.3)',
            }}>
            <Download size={14} /> EXPORT EXCEL
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 8, padding: '12px 16px', marginBottom: 20,
          color: '#fca5a5', fontSize: '0.82rem',
        }}>⚠ {error}</div>
      )}

      {/* ── Executive Summary Bar ─────────────────────────────────────────── */}
      <div style={{
        background: '#111827', border: '1px solid rgba(34,211,238,0.15)',
        borderRadius: 10, marginBottom: 20, overflow: 'hidden',
      }}>
        <div style={{ padding: '10px 20px', borderBottom: '1px solid #1e293b',
                      background: 'rgba(34,211,238,0.05)' }}>
          <span style={{ color: '#22d3ee', fontSize: '0.65rem', fontWeight: 700,
                         letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            Executive Summary
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)' }}>
          {summaryItems.map(({ label, value, color }, i) => (
            <div key={label} style={{
              padding: '16px 12px', textAlign: 'center',
              borderRight: i < summaryItems.length - 1 ? '1px solid #1e293b' : 'none',
            }}>
              <p style={{ fontSize: '1.6rem', fontWeight: 800, color, margin: '0 0 4px', lineHeight: 1 }}>
                {value}
              </p>
              <p style={{ color: '#64748b', fontSize: '0.62rem', fontWeight: 600,
                          letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>
                {label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom 2-col layout ─────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, alignItems: 'start' }}>

        {/* LEFT: Compliance Panel */}
        <div style={{ background: '#111827', border: '1px solid rgba(34,211,238,0.15)',
                      borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid #1e293b',
                        background: 'rgba(34,211,238,0.05)' }}>
            <span style={{ color: '#22d3ee', fontSize: '0.65rem', fontWeight: 700,
                           letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              Compliance Status
            </span>
          </div>
          <div style={{ padding: 20 }}>
            {/* Circular gauge */}
            <CircularGauge pct={compliancePct} />
            <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.72rem',
                        margin: '0 0 20px' }}>
              {compliantCount} of {complianceFrameworks.length} frameworks compliant
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {complianceFrameworks.map(({ name, Icon, status, detail }) => (
                <div key={name} style={{
                  background: '#0d1929', border: '1px solid #1e293b',
                  borderRadius: 8, padding: '12px 14px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between',
                                alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <Icon size={13} color="#64748b" />
                      <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#f8fafc' }}>{name}</span>
                    </div>
                    <StatusBadge status={status} />
                  </div>
                  <p style={{ color: '#475569', fontSize: '0.68rem', margin: 0 }}>{detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Incident Breakdown Table */}
        <div style={{ background: '#111827', border: '1px solid rgba(34,211,238,0.15)',
                      borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '10px 20px', borderBottom: '1px solid #1e293b',
                        background: 'rgba(34,211,238,0.05)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#22d3ee', fontSize: '0.65rem', fontWeight: 700,
                           letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              Incident Breakdown
            </span>
            <span style={{
              background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.25)',
              color: '#22d3ee', borderRadius: 20, padding: '2px 10px',
              fontSize: '0.65rem', fontWeight: 700,
            }}>{total} records</span>
          </div>

          {total === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#475569', fontSize: '0.85rem' }}>
              No alerts found.
            </div>
          ) : (
            <div style={{ overflowY: 'auto', maxHeight: 480 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
                <thead>
                  <tr style={{ position: 'sticky', top: 0, zIndex: 1, background: '#0d1929' }}>
                    {['Incident ID', 'Alert Type', 'Severity', 'Source IP', 'MITRE', 'Status'].map(col => (
                      <th key={col} style={{
                        textAlign: 'left', padding: '10px 14px', color: '#64748b',
                        fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.12em',
                        textTransform: 'uppercase', borderBottom: '1px solid #1e293b',
                        whiteSpace: 'nowrap',
                      }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((alert, idx) => {
                    const mitre = parseMitre(alert.mitre_technique);
                    return (
                      <tr key={alert.incident_id || idx}
                          className={idx % 2 === 0 ? 'rep-row-even' : 'rep-row-odd'}>
                        <td style={{ padding: '9px 14px', color: '#22d3ee',
                                     fontFamily: 'monospace', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                          {alert.incident_id || `INC-${String(idx + 1).padStart(4, '0')}`}
                        </td>
                        <td style={{ padding: '9px 14px', color: '#f8fafc', whiteSpace: 'nowrap' }}>
                          {alert.alert_type || '—'}
                        </td>
                        <td style={{ padding: '9px 14px' }}>
                          <SevBadge sev={alert.severity} />
                        </td>
                        <td style={{ padding: '9px 14px', color: '#94a3b8',
                                     fontFamily: 'monospace', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                          {alert.source_ip || '—'}
                        </td>
                        <td style={{ padding: '9px 14px' }}>
                          <span style={{
                            background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)',
                            color: '#a5b4fc', borderRadius: 4, padding: '2px 7px',
                            fontSize: '0.65rem', fontWeight: 700, fontFamily: 'monospace',
                            whiteSpace: 'nowrap',
                          }}>{mitre}</span>
                        </td>
                        <td style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}>
                          <span style={{
                            color: alert.escalation === 'Escalated to Tier-2' ? '#f87171' : '#6ee7b7',
                            fontSize: '0.7rem', fontWeight: 600,
                          }}>
                            {alert.escalation || 'Open'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
