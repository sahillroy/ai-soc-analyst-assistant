import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

// ─── Constants ───────────────────────────────────────────────────────────────
const SEV_ORDER = { Critical: 4, High: 3, Medium: 2, Low: 1, Normal: 0 };
const SEV_COLORS = {
  Critical: '#8b5cf6',
  High:     '#ef4444',
  Medium:   '#f59e0b',
  Low:      '#10b981',
  Normal:   '#475569',
};

const BADGE_STYLE = (color) => ({
  background: `${color}22`,
  color,
  border: `1px solid ${color}44`,
  borderRadius: 20,
  padding: '3px 10px',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  display: 'inline-block',
  whiteSpace: 'nowrap',
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
const mostFrequent = (arr) => {
  if (!arr.length) return null;
  const freq = {};
  let top = arr[0], topN = 0;
  for (const v of arr) {
    if (!v) continue;
    freq[v] = (freq[v] || 0) + 1;
    if (freq[v] > topN) { topN = freq[v]; top = v; }
  }
  return top;
};

const fmtTime = (iso) => {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { return '—'; }
};

const threatBarColor = (pct) =>
  pct >= 70 ? '#EF4444' : pct >= 40 ? '#F59E0B' : '#3B82F6';

const parseMitre = (raw) => {
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : (raw || {});
  } catch { return {}; }
};

const bucketHour = (h) =>
  h < 4 ? '00:00' : h < 8 ? '04:00' : h < 12 ? '08:00'
    : h < 16 ? '12:00' : h < 20 ? '16:00' : '20:00';

// ─── SVG Network Graph ────────────────────────────────────────────────────────
function NetworkGraph({ centerIp, sourceIps }) {
  const spokes = [...new Set(sourceIps)].slice(0, 8);
  const W = 200, H = 150, cx = W / 2, cy = H / 2, R = 55, r = 10, cr = 14;

  const nodes = spokes.map((ip, i) => {
    const angle = (2 * Math.PI * i) / spokes.length - Math.PI / 2;
    return { ip, x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle) };
  });

  return (
    <svg width={W} height={H} style={{ overflow: 'visible' }}>
      {nodes.map((n) => (
        <line key={n.ip} x1={cx} y1={cy} x2={n.x} y2={n.y} stroke="#334155" strokeWidth={1} />
      ))}
      {nodes.map((n) => (
        <circle key={n.ip} cx={n.x} cy={n.y} r={r} fill="#8B5CF6" opacity={0.85} />
      ))}
      <circle cx={cx} cy={cy} r={cr} fill="#3B82F6" />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize={6} fill="#fff" fontWeight={700}>
        {centerIp ? centerIp.split('.').slice(-1)[0] : '?'}
      </text>
    </svg>
  );
}

// ─── Distribution Chart ───────────────────────────────────────────────────────
function DistributionChart({ campaignAlerts }) {
  const data = useMemo(() => {
    const b = { '00:00': 0, '04:00': 0, '08:00': 0, '12:00': 0, '16:00': 0, '20:00': 0 };
    campaignAlerts.forEach((a) => {
      const h = new Date(a.timestamp).getHours();
      b[bucketHour(h)]++;
    });
    const maxVal = Math.max(...Object.values(b));
    return Object.entries(b).map(([time, count]) => ({
      time: count === maxVal && count > 0 ? `${time} (Peak)` : time,
      count,
      isPeak: count === maxVal && count > 0,
    }));
  }, [campaignAlerts]);

  return (
    <div style={{ width: '100%', height: 120, background: '#0B1120', borderRadius: 8, padding: '8px 0' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
          <XAxis
            dataKey="time"
            tick={{ fill: '#64748b', fontSize: 9 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis tick={false} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6, fontSize: 12 }}
            itemStyle={{ color: '#f1f5f9' }}
            labelStyle={{ color: '#94a3b8' }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.time} fill={entry.isPeak ? '#3B82F6' : '#1E3A6E'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CampaignView({ alerts = [], setActivePage, setSelectedCampaign }) {
  const [expandedAI, setExpandedAI] = useState({});
  const [expandedChart, setExpandedChart] = useState({});

  const campaigns = useMemo(() => {
    // Group by campaign_id, skip standalone
    const groups = {};
    for (const a of alerts) {
      if (!a.campaign_id || a.campaign_id.toLowerCase() === 'standalone') continue;
      (groups[a.campaign_id] = groups[a.campaign_id] || []).push(a);
    }

    return Object.entries(groups)
      .map(([campaign_id, grp]) => {
        const totalSignals = grp.length;
        const uniqueDests = new Set(grp.map((a) => a.destination_ip).filter(Boolean));
        const hostCount = uniqueDests.size;
        const topOrigin = mostFrequent(grp.map((a) => a.source_ip)) || '—';
        const topDest = [...uniqueDests][0] || null;
        const timestamps = grp.map((a) => new Date(a.timestamp).getTime()).filter(Boolean);
        const lastMs = timestamps.length ? Math.max(...timestamps) : 0;
        const lastActivity = lastMs ? fmtTime(new Date(lastMs).toISOString()) : '—';

        // Escalation: prefer "Escalated to Tier-2" if any
        const hasEscalated = grp.some((a) => a.escalation === 'Escalated to Tier-2');
        const escalation = hasEscalated ? 'Escalated to Tier-2' : (grp[0]?.escalation || 'Under Review');

        // maxSeverity
        let maxSevVal = -1, maxSeverity = 'Normal';
        for (const a of grp) {
          const v = SEV_ORDER[a.severity] ?? 0;
          if (v > maxSevVal) { maxSevVal = v; maxSeverity = a.severity || 'Normal'; }
        }

        // threatLevel = (Critical count / total) * 100
        const critCount = grp.filter((a) => a.severity === 'Critical').length;
        const threatLevel = totalSignals > 0
          ? parseFloat(((critCount / totalSignals) * 100).toFixed(1))
          : 0;

        // alertType = most common alert_type
        const alertType = mostFrequent(grp.map((a) => a.alert_type)) || 'Unknown Activity';
        const campaign_name = alertType + ' Operation';
        const alert_types = [...new Set(grp.map((a) => a.alert_type).filter(Boolean))];

        // attackChain = last 5 by timestamp DESC
        const attackChain = [...grp]
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(0, 5);

        // AI: highest-risk alert (by risk_score)
        const aiAlert = [...grp].sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0))[0];
        const mitre = parseMitre(aiAlert?.mitre_technique);
        const mitreStr = mitre.technique_id
          ? `${mitre.technique_id} — ${mitre.technique_name || '—'} [${mitre.tactic || '—'}]`
          : '—';

        return {
          campaign_id,
          totalSignals,
          hostCount,
          topOrigin,
          topDest,
          lastActivity,
          escalation,
          maxSeverity,
          maxSevVal,
          threatLevel,
          alertType,
          campaign_name,
          alert_types,
          attackChain,
          aiAlert,
          mitreStr,
          mitreId: mitre.technique_id,
          grp,
          sourceIps: grp.map((a) => a.source_ip).filter(Boolean),
          ipCountry: mostFrequent(grp.map((a) => a.ip_country).filter(Boolean)) || 'Unknown Actor',
        };
      })
      .sort((a, b) => b.maxSevVal - a.maxSevVal);
  }, [alerts]);

  const handleViewAlerts = (campaign_id) => {
    if (setActivePage) setActivePage('incidents');
    if (setSelectedCampaign) setSelectedCampaign(campaign_id);
  };

  if (!campaigns.length) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 64, textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
        <h2 style={{ color: '#cbd5e1', fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>No campaigns detected.</h2>
        <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>Run Analysis to correlate alerts into campaigns.</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* PAGE HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#f8fafc', margin: '0 0 6px', lineHeight: 1.2 }}>Active Campaigns</h1>
          <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>
            Tracking <strong style={{ color: '#94a3b8' }}>{campaigns.length}</strong> correlated attack patterns across <strong style={{ color: '#94a3b8' }}>{alerts.length}</strong> total signals.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: '8px 16px' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 6px #10b981' }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#10b981', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Live Signals: {alerts.length} / window
          </span>
        </div>
      </div>

      {/* CAMPAIGN CARDS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {campaigns.map((c) => {
          const sevColor = SEV_COLORS[c.maxSeverity] || SEV_COLORS.Normal;
          const barColor = threatBarColor(c.threatLevel);
          const aiOpen = expandedAI[c.campaign_id];
          const chartOpen = expandedChart[c.campaign_id];

          return (
            <div key={c.campaign_id} style={{
              background: '#0d1526',
              border: '1px solid #1e293b',
              borderLeft: `4px solid ${sevColor}`,
              borderRadius: 10,
              overflow: 'hidden',
            }}>
              {/* ── Card body ──────────────────────────────── */}
              <div style={{ padding: 24, display: 'flex', gap: 32, flexWrap: 'wrap' }}>

                {/* LEFT COLUMN */}
                <div style={{ flex: '1 1 280px', display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {/* Badge + ID row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <span style={BADGE_STYLE(sevColor)}>{c.maxSeverity} ALERT</span>
                    <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      ID: {c.campaign_id}
                    </span>
                  </div>

                  {/* Campaign name + description */}
                  <div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: '#f8fafc', margin: '0 0 6px' }}>{c.campaign_name}</h2>
                    <p style={{ fontSize: 13, color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                      {c.alert_types.join(', ')} patterns detected across {c.hostCount} distinct destination host{c.hostCount !== 1 ? 's' : ''}.
                    </p>
                  </div>

                  {/* Threat Level Index bar */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.06em' }}>Threat Level Index</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: barColor }}>{c.threatLevel}%</span>
                    </div>
                    <div style={{ background: '#1e293b', borderRadius: 4, height: 4, overflow: 'hidden' }}>
                      <div style={{ background: barColor, width: `${Math.min(100, c.threatLevel)}%`, height: '100%', transition: 'width 0.4s ease' }} />
                    </div>
                  </div>

                  {/* Stat boxes */}
                  <div style={{ display: 'flex', gap: 12 }}>
                    {[
                      { label: 'Total Signals', value: c.totalSignals },
                      { label: 'Host Count', value: c.hostCount },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ flex: 1, background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: '12px 14px' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: '#f8fafc', lineHeight: 1.1 }}>{value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Metadata row */}
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
                    <span style={{ color: '#64748b' }}>
                      🌐 Top Origin: <span style={{ color: '#f1f5f9', fontFamily: 'monospace' }}>{c.topOrigin}</span>
                    </span>
                    <span style={{ color: '#64748b', borderLeft: '1px solid #1e293b', paddingLeft: 12 }}>
                      🕐 Last Activity: <span style={{ color: '#f1f5f9' }}>{c.lastActivity}</span>
                    </span>
                    <span style={{ color: '#64748b', borderLeft: '1px solid #1e293b', paddingLeft: 12 }}>
                      ⚠ Escalation: <span style={{ color: c.escalation === 'Escalated to Tier-2' ? '#ef4444' : '#94a3b8' }}>{c.escalation}</span>
                    </span>
                  </div>

                  {/* View All Alerts link */}
                  <button
                    onClick={() => handleViewAlerts(c.campaign_id)}
                    style={{
                      alignSelf: 'flex-start', background: 'transparent', border: '1px solid #334155',
                      color: '#3b82f6', borderRadius: 6, padding: '6px 14px', fontSize: 12,
                      fontWeight: 700, cursor: 'pointer', letterSpacing: '0.06em', transition: 'border-color 0.2s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = '#334155'}
                  >
                    VIEW ALL ALERTS →
                  </button>
                </div>

                {/* RIGHT COLUMN — Attack Chain Timeline */}
                <div style={{ flex: '1 1 260px', borderLeft: '1px solid #1e293b', paddingLeft: 28 }}>
                  <h3 style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 20, marginTop: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    ⏱ Attack Chain Timeline
                  </h3>

                  <div style={{ position: 'relative', paddingLeft: 4 }}>
                    {c.attackChain.map((a, i) => {
                      const ac = SEV_COLORS[a.severity] || SEV_COLORS.Normal;
                      const isLast = i === c.attackChain.length - 1 && c.totalSignals <= 5;
                      return (
                        <div key={a.incident_id || i} style={{
                          display: 'flex', alignItems: 'flex-start', gap: 12,
                          paddingBottom: isLast ? 0 : 16,
                          borderLeft: isLast ? '1px solid transparent' : '1px solid #1e293b',
                          paddingLeft: 16, position: 'relative',
                        }}>
                          <div style={{
                            width: 10, height: 10, borderRadius: '50%',
                            background: ac, border: `2px solid ${ac}`,
                            position: 'absolute', left: -5.5, top: 4,
                            boxShadow: `0 0 8px ${ac}88`,
                          }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', lineHeight: 1.3 }}>{a.alert_type}</span>
                              <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#64748b', whiteSpace: 'nowrap', paddingTop: 2 }}>
                                {fmtTime(a.timestamp)} UTC
                              </span>
                            </div>
                            <p style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 0', lineHeight: 1.4 }}>
                              Connection detected from <span style={{ fontFamily: 'monospace', color: '#cbd5e1' }}>{a.source_ip}</span> categorized as <span style={{ color: ac }}>{a.severity}</span> severity.
                            </p>
                          </div>
                        </div>
                      );
                    })}

                    {c.totalSignals > 5 && (
                      <div style={{ paddingLeft: 16, position: 'relative', borderLeft: '1px solid transparent' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#334155', position: 'absolute', left: -4, top: 4 }} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          + {c.totalSignals - 5} more signals in this campaign
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* FAR RIGHT — Enrichment Sidebar */}
                <div style={{ flex: '0 0 180px', display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {/* Metadata panel */}
                  <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: '14px 16px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Enrichment</div>
                    {[
                      { label: 'Top Origin', value: c.topOrigin, mono: true },
                      { label: 'Attribution', value: c.ipCountry },
                      { label: 'Reoccurrence', value: `Last activity ${c.lastActivity}` },
                    ].map(({ label, value, mono }) => (
                      <div key={label} style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 12, color: '#f1f5f9', fontFamily: mono ? 'monospace' : 'inherit', wordBreak: 'break-all' }}>{value}</div>
                      </div>
                    ))}
                  </div>

                  {/* SVG Network graph */}
                  <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Threat Cluster</div>
                    <NetworkGraph centerIp={c.topDest} sourceIps={c.sourceIps} />
                    <div style={{ fontSize: 9, color: '#475569', marginTop: 4 }}>
                      ● Dest &nbsp; ● Origins ({[...new Set(c.sourceIps)].length})
                    </div>
                  </div>

                </div>
              </div>

              {/* ── Distribution Chart Toggle ──────────────── */}
              <div style={{ borderTop: '1px solid #1e293b' }}>
                <button
                  onClick={() => setExpandedChart((p) => ({ ...p, [c.campaign_id]: !p[c.campaign_id] }))}
                  style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 24px', background: '#0d1526', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}
                >
                  <span>📊 Anomalous Distribution Chart</span>
                  <span style={{ transform: chartOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
                </button>
                {chartOpen && (
                  <div style={{ padding: '0 24px 16px' }}>
                    <DistributionChart campaignAlerts={c.grp} />
                  </div>
                )}
              </div>

              {/* ── AI Analysis Accordion ─────────────────── */}
              <div style={{ borderTop: '1px solid #1e293b' }}>
                <button
                  onClick={() => setExpandedAI((p) => ({ ...p, [c.campaign_id]: !p[c.campaign_id] }))}
                  style={{
                    width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 24px', background: '#0a1628', border: 'none', cursor: 'pointer',
                    color: '#3b82f6', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>✦</span> AI Analysis Available
                    {c.aiAlert?.incident_summary && <span style={{ background: '#3b82f633', border: '1px solid #3b82f644', borderRadius: 20, padding: '1px 8px', fontSize: 10 }}>LLM Report Ready</span>}
                  </span>
                  <span style={{ transform: aiOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
                </button>

                {aiOpen && c.aiAlert && (
                  <div style={{ padding: '16px 24px 24px', background: '#080f1d', display: 'flex', flexDirection: 'column', gap: 12 }}>

                    {c.aiAlert.incident_summary && (
                      <div style={{ borderLeft: '3px solid #3b82f6', paddingLeft: 14 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Incident Summary</div>
                        <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>{c.aiAlert.incident_summary}</p>
                      </div>
                    )}

                    {c.aiAlert.recommended_action && (
                      <div style={{ borderLeft: '3px solid #f59e0b', paddingLeft: 14 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Recommended Action</div>
                        <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.6, margin: 0 }}>{c.aiAlert.recommended_action}</p>
                      </div>
                    )}

                    {c.mitreStr !== '—' && (
                      <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 6, padding: '8px 12px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>MITRE ATT&CK</div>
                        <div style={{ fontSize: 12, color: '#93c5fd', fontFamily: 'monospace' }}>
                          {c.mitreId ? (
                            <a 
                              href={`https://attack.mitre.org/techniques/${c.mitreId}/`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              style={{ color: 'inherit', textDecoration: 'none', cursor: 'pointer' }}
                              onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
                              onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
                            >
                              {c.mitreStr}
                            </a>
                          ) : c.mitreStr}
                        </div>
                      </div>
                    )}

                    {c.aiAlert.automation_result && (
                      <div style={{ borderLeft: '3px solid #8b5cf6', paddingLeft: 14 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Automation Result</div>
                        <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5, margin: 0, fontFamily: 'monospace' }}>{c.aiAlert.automation_result}</p>
                      </div>
                    )}

                  </div>
                )}
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}