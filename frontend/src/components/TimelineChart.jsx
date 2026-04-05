import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip
} from 'recharts';

// ─── 10-minute bucket helper ─────────────────────────────────────────────────
const bucket = (ts) => {
  try {
    const d = new Date(ts);
    const mins = Math.floor(d.getMinutes() / 10) * 10;
    d.setMinutes(mins, 0, 0);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '??:??';
  }
};

// ─── Severity badge ───────────────────────────────────────────────────────────
const SEV_COLORS = {
  Critical: { bg: '#8B5CF622', color: '#8B5CF6', border: '#8B5CF644' },
  High:     { bg: '#EF444422', color: '#EF4444', border: '#EF444444' },
  Medium:   { bg: '#F59E0B22', color: '#F59E0B', border: '#F59E0B44' },
  Low:      { bg: '#10B98122', color: '#10B981', border: '#10B98144' },
};

function SeverityBadge({ severity }) {
  const s = SEV_COLORS[severity] || { bg: '#47556922', color: '#475569', border: '#47556944' };
  return (
    <span style={{
      display: 'inline-block',
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      borderRadius: 12, padding: '2px 8px', fontSize: 10,
      fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
    }}>{severity || 'Unknown'}</span>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#0F1829', border: '1px solid #334155',
      borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#F1F5F9',
    }}>
      <div style={{ color: '#94a3b8', marginBottom: 4 }}>TIME: {label}</div>
      <div style={{ fontWeight: 700 }}>COUNT: {payload[0].value}</div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TimelineChart({ alerts = [], running = false, onSelectAlert, setActivePage }) {
  const [hoveredRow, setHoveredRow] = useState(null);

  // ── Chart data (10-min buckets) ──────────────────────────────────────────
  const chartData = useMemo(() => {
    if (!alerts.length) return [];
    const counts = {};
    alerts.forEach((a) => {
      const k = bucket(a.timestamp);
      counts[k] = (counts[k] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(([a], [b]) => {
        const toMs = (t) => new Date('1970/01/01 ' + t).getTime();
        return toMs(a) - toMs(b);
      })
      .map(([time, count]) => ({ time, count }));
  }, [alerts]);

  // ── Stat card values ─────────────────────────────────────────────────────
  const peakLoad = chartData.length > 0 ? Math.max(...chartData.map((d) => d.count)) : 0;

  const resolved = alerts.filter((a) => a.status === 'Resolved').length;
  const mitigated = alerts.length > 0
    ? ((resolved / alerts.length) * 100).toFixed(1)
    : '0.0';
  const mitigatedNum = parseFloat(mitigated);

  // ── Forensic events: 10 most recent ─────────────────────────────────────
  const forensicEvents = useMemo(() =>
    [...alerts]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10),
    [alerts]
  );

  const handleRowClick = (alert) => {
    if (onSelectAlert) onSelectAlert(alert);
  };

  return (
    <>
      <style>{`
        @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>

      <div className="grid grid-cols-12 gap-6 w-full">

        {/* ── Incident Velocity Chart ──────────────────────────────────── */}
        <section className="col-span-12 lg:col-span-9 bg-[#0d1526] rounded-xl p-6 border border-[#1e293b] border-b-2 border-b-blue-500/40 relative overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-[17px] font-semibold text-slate-50">Incident Velocity</h3>
              <p className="text-[11px] text-slate-500 font-medium tracking-widest uppercase mt-0.5">Detection Frequency (10-min buckets)</p>
            </div>
            <div className="flex items-center gap-2">
              <span style={{
                width: 10, height: 10, borderRadius: '50%',
                display: 'inline-block',
                background: running ? '#10B981' : '#475569',
                animation: running ? 'pulse-dot 1.5s ease-in-out infinite' : 'none',
              }} />
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: running ? '#10B981' : '#475569' }}>
                {running ? 'Live Feed' : 'Idle'}
              </span>
            </div>
          </div>

          <div style={{ height: 220, background: '#0B1120', borderRadius: 8, padding: '8px 0' }}>
            {chartData.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 13 }}>
                No data — Run Analysis to populate the timeline.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 16, left: -28, bottom: 0 }}>
                  <defs>
                    <linearGradient id="velocityGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="time"
                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis hide />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    fill="url(#velocityGradient)"
                    dot={false}
                    activeDot={{ r: 4, fill: '#3b82f6', stroke: '#0b1326', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* ── Stat Cards ────────────────────────────────────────────────── */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-6">

          {/* Peak Load */}
          <div className="bg-[#0d1526] p-6 rounded-xl border border-[#1e293b] border-b-2 border-b-purple-500/40">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-purple-500/10 rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-purple-500 text-lg">bolt</span>
              </div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Peak Load</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-50">{peakLoad}</span>
              <span className="text-purple-400 text-xs font-bold">alerts</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Total events per second at peak.</p>
          </div>

          {/* Mitigated */}
          <div className="bg-[#0d1526] p-6 rounded-xl border border-[#1e293b] border-b-2 border-b-emerald-500/40">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-emerald-500/10 rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-emerald-500 text-lg">verified_user</span>
              </div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Mitigated</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-50">{mitigated}%</span>
              <span style={{
                fontSize: 11, fontWeight: 700,
                color: mitigatedNum > 0 ? '#10B981' : '#F59E0B',
              }}>
                {mitigatedNum > 0 ? 'Stable' : 'Pending'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Average threat mitigation rate.</p>
          </div>

        </div>

        {/* ── Forensic Events Table ─────────────────────────────────────── */}
        <section className="col-span-12 bg-[#0d1526] rounded-xl overflow-hidden border border-[#1e293b]">
          <div className="p-5 border-b border-[#1e293b] flex items-center justify-between">
            <h3 className="text-[15px] font-semibold text-slate-50">Recent Forensic Events</h3>
            <span
              onClick={() => setActivePage && setActivePage('incidents')}
              style={{ fontSize: 11, fontWeight: 700, color: '#3B82F6', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.08em', textDecoration: 'none' }}
              onMouseEnter={(e) => e.target.style.color = '#60A5FA'}
              onMouseLeave={(e) => e.target.style.color = '#3B82F6'}
            >
              View All Logs →
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, color: '#f1f5f9' }}>
              <thead>
                <tr style={{ background: '#0f172a', borderBottom: '1px solid #1e293b' }}>
                  <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Timestamp</th>
                  <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Severity</th>
                  <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Actor IP</th>
                  <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Signature</th>
                  <th style={{ padding: '12px 20px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {forensicEvents.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#475569', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      No forensic events logged yet.
                    </td>
                  </tr>
                ) : forensicEvents.map((a, i) => (
                  <tr
                    key={a.incident_id || i}
                    onClick={() => handleRowClick(a)}
                    onMouseEnter={() => setHoveredRow(i)}
                    onMouseLeave={() => setHoveredRow(null)}
                    style={{
                      borderBottom: '1px solid #1e293b',
                      background: hoveredRow === i ? '#1E293B' : i % 2 === 0 ? '#0f172a' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                  >
                    <td style={{ padding: '12px 20px', fontFamily: 'monospace', fontSize: 12, color: '#94a3b8' }}>
                      {new Date(a.timestamp).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <SeverityBadge severity={a.severity} />
                    </td>
                    <td style={{ padding: '12px 20px', fontFamily: 'monospace', fontSize: 12, color: '#cbd5e1' }}>
                      {a.source_ip || '—'}
                    </td>
                    <td style={{ padding: '12px 20px', fontSize: 12, color: '#94a3b8', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.alert_type}
                    </td>
                    <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                      <span
                        onClick={(e) => { e.stopPropagation(); handleRowClick(a); }}
                        style={{ color: '#3B82F6', cursor: 'pointer', fontSize: 18, fontWeight: 700 }}
                        onMouseEnter={(e) => e.target.style.color = '#60A5FA'}
                        onMouseLeave={(e) => e.target.style.color = '#3B82F6'}
                      >→</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </>
  );
}