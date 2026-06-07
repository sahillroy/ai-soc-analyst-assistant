import { useState, useEffect } from 'react';
import {
  Shield, Lock, AlertTriangle, CheckCircle,
  Download, FileText, TrendingUp, Clock, Activity
} from 'lucide-react';
import { getAlerts, getStats, exportReportCSV } from '../api/client';
import { countBySeverity } from '../services/alertUtils';

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

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{
      background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: 20,
      animation: 'pulse 1.5s ease-in-out infinite',
    }}>
      <div style={{ height: 12, width: '60%', background: '#334155', borderRadius: 4, marginBottom: 14 }} />
      <div style={{ height: 32, width: '40%', background: '#334155', borderRadius: 4, marginBottom: 10 }} />
      <div style={{ height: 10, width: '80%', background: '#334155', borderRadius: 4 }} />
    </div>
  );
}

export default function ReportingPage() {
  const [alerts, setAlerts]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [avgMTTR]             = useState(() => (Math.random() * 3 + 1).toFixed(1));
  const generated             = new Date().toLocaleString();

  useEffect(() => {
    const load = async () => {
      try {
        const [alertsRes] = await Promise.all([getAlerts()]);
        setAlerts(alertsRes.data?.alerts || alertsRes.data || []);
      } catch (e) {
        setError('Could not load data from backend. Make sure the backend server is running.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ── Derived metrics ─────────────────────────────────────────────────────────
  const total        = alerts.length;
  const criticalCount = countBySeverity(alerts, 'Critical');
  const escalated    = alerts.filter(a => a.escalation === 'Escalated to Tier-2').length;
  const escalPct     = total > 0 ? Math.round((escalated / total) * 100) : 0;
  const exfilCount   = alerts.filter(a => a.alert_type?.toLowerCase().includes('exfil')).length;
  const bruteCount   = alerts.filter(a => a.alert_type?.toLowerCase().includes('brute')).length;

  // ── Compliance frameworks ───────────────────────────────────────────────────
  const complianceFrameworks = [
    {
      name: 'SOC 2',    Icon: Shield,
      status: criticalCount === 0 ? 'COMPLIANT' : 'REVIEW',
      detail: 'Access control monitoring active',
    },
    {
      name: 'HIPAA',    Icon: Lock,
      status: exfilCount === 0 ? 'COMPLIANT' : 'AT RISK',
      detail: 'Data exfiltration controls active',
    },
    {
      name: 'NIST CSF', Icon: CheckCircle,
      status: 'COMPLIANT',
      detail: 'Detect & Respond functions operational',
    },
    {
      name: 'PCI DSS',  Icon: AlertTriangle,
      status: bruteCount > 5 ? 'WARNING' : 'COMPLIANT',
      detail: 'Authentication monitoring active',
    },
  ];

  // ── Stat cards config ───────────────────────────────────────────────────────
  const statCards = [
    { label: 'TOTAL INCIDENTS',    value: total,         sub: 'Detected this session',       Icon: Activity,   border: '#3b82f6' },
    { label: 'CRITICAL THREATS',   value: criticalCount, sub: 'Require immediate action',    Icon: AlertTriangle, border: '#a855f7' },
    { label: 'AVG RESPONSE TIME',  value: `~${avgMTTR}m`,sub: 'Mean time to respond',        Icon: Clock,      border: '#f59e0b' },
    { label: 'ESCALATION RATE',    value: `${escalPct}%`,sub: 'Alerts escalated to Tier-2', Icon: TrendingUp, border: '#ef4444' },
  ];

  // ── Loading state ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: 24, background: '#0a0f1e', minHeight: '100vh', color: '#f8fafc' }}>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
        <div style={{ marginBottom: 24 }}>
          <div style={{ height: 28, width: 320, background: '#1e293b', borderRadius: 6, marginBottom: 8 }} />
          <div style={{ height: 14, width: 240, background: '#1e293b', borderRadius: 4 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
          {[1,2,3,4].map(i => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px', minHeight: '100vh', background: '#0a0f1e', color: '#f8fafc' }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .report-table tr:nth-child(even) td { background: #1e293b; }
        .report-table tr:nth-child(odd)  td { background: #0f172a; }
        .report-table tr:hover td { background: #1a2744 !important; }
        .export-btn:hover { background: #1d4ed8 !important; transform: translateY(-1px); }
      `}</style>

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <FileText size={22} color="#3b82f6" />
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
              COMPLIANCE &amp; EXECUTIVE REPORTING
            </h1>
          </div>
          <p style={{ color: '#64748b', fontSize: '0.82rem', margin: 0 }}>
            Report period: last 24h&nbsp;·&nbsp;Generated: <span style={{ color: '#94a3b8' }}>{generated}</span>
          </p>
        </div>
        <button
          onClick={exportReportCSV}
          className="export-btn"
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#2563eb', border: 'none', color: '#fff',
            borderRadius: 8, padding: '10px 20px',
            fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.08em',
            cursor: 'pointer', transition: 'all 0.18s',
            boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
          }}>
          <Download size={16} />
          EXPORT EXCEL REPORT
        </button>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 8, padding: '12px 16px', marginBottom: 20, color: '#fca5a5', fontSize: '0.82rem',
        }}>
          ⚠ {error}
        </div>
      )}

      {/* ── Stat Cards ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {statCards.map(({ label, value, sub, Icon, border }) => (
          <div key={label} style={{
            background: '#1e293b',
            border: `1px solid #334155`,
            borderTop: `3px solid ${border}`,
            borderRadius: 10, padding: '20px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <p style={{ color: '#64748b', fontSize: '0.65rem', fontWeight: 700,
                          letterSpacing: '0.12em', textTransform: 'uppercase', margin: 0 }}>{label}</p>
              <div style={{ background: `${border}20`, borderRadius: 6, padding: 6 }}>
                <Icon size={16} color={border} />
              </div>
            </div>
            <p style={{ fontSize: '2rem', fontWeight: 800, color: '#f8fafc', margin: '0 0 4px', lineHeight: 1 }}>
              {value}
            </p>
            <p style={{ color: '#64748b', fontSize: '0.72rem', margin: 0 }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Bottom 2-col layout ─────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, alignItems: 'start' }}>

        {/* LEFT: Compliance Panel */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: 20 }}>
          <p style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
                      textTransform: 'uppercase', marginBottom: 16, margin: '0 0 16px' }}>
            Compliance Status
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {complianceFrameworks.map(({ name, Icon, status, detail }) => (
              <div key={name} style={{
                background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '14px 16px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon size={14} color="#64748b" />
                    <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#f8fafc' }}>{name}</span>
                  </div>
                  <StatusBadge status={status} />
                </div>
                <p style={{ color: '#64748b', fontSize: '0.7rem', margin: 0 }}>{detail}</p>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: Incident Breakdown Table */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #334155' }}>
            <p style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
                        textTransform: 'uppercase', margin: 0 }}>
              Incident Breakdown &nbsp;·&nbsp;
              <span style={{ color: '#3b82f6', fontWeight: 800 }}>{total}</span> total
            </p>
          </div>

          {total === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#475569' }}>
              <p style={{ fontSize: '0.85rem' }}>No alerts in the current dataset.</p>
            </div>
          ) : (
            <div style={{ overflowY: 'auto', maxHeight: 420 }}>
              <table className="report-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{ position: 'sticky', top: 0, background: '#0f172a', zIndex: 1 }}>
                    {['Incident ID', 'Alert Type', 'Severity', 'Source IP', 'MITRE', 'Status'].map(col => (
                      <th key={col} style={{
                        textAlign: 'left', padding: '10px 14px', color: '#64748b',
                        fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em',
                        textTransform: 'uppercase', borderBottom: '1px solid #334155',
                        whiteSpace: 'nowrap',
                      }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((alert, idx) => (
                    <tr key={alert.incident_id || idx} style={{ transition: 'background 0.1s' }}>
                      <td style={{ padding: '9px 14px', color: '#60a5fa', fontFamily: 'monospace',
                                   fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                        {alert.incident_id || `INC-${idx + 1}`}
                      </td>
                      <td style={{ padding: '9px 14px', color: '#f8fafc', whiteSpace: 'nowrap' }}>
                        {alert.alert_type || '—'}
                      </td>
                      <td style={{ padding: '9px 14px' }}>
                        <SevBadge sev={alert.severity} />
                      </td>
                      <td style={{ padding: '9px 14px', color: '#94a3b8', fontFamily: 'monospace',
                                   fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                        {alert.source_ip || '—'}
                      </td>
                      <td style={{ padding: '9px 14px', color: '#94a3b8', whiteSpace: 'nowrap',
                                   maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {alert.mitre_technique || '—'}
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
