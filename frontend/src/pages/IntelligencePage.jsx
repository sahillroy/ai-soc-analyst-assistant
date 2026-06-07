import { useState, useEffect } from 'react';
import { Globe, MapPin, AlertTriangle, TrendingUp, Shield, Wifi } from 'lucide-react';
import { getAlerts } from '../api/client';
import IncidentModal from '../components/IncidentModal';

// ── IP classification ─────────────────────────────────────────────────────────
function classifyIP(ip) {
  if (!ip) return 'Unknown';
  if (ip.startsWith('192.168.') || ip.startsWith('10.') || /^172\.(1[6-9]|2\d|3[01])\./.test(ip))
    return 'Internal / RFC1918';
  return 'External';
}

// ── Severity colours ──────────────────────────────────────────────────────────
const SEV = {
  Critical: { bg: 'rgba(168,85,247,0.15)', border: '#a855f7', text: '#d8b4fe' },
  High:     { bg: 'rgba(239,68,68,0.15)',  border: '#ef4444', text: '#fca5a5' },
  Medium:   { bg: 'rgba(245,158,11,0.15)', border: '#f59e0b', text: '#fcd34d' },
  Low:      { bg: 'rgba(16,185,129,0.15)', border: '#10b981', text: '#6ee7b7' },
};
function SevBadge({ sev }) {
  const c = SEV[sev] || { bg: '#1e293b', border: '#334155', text: '#94a3b8' };
  return (
    <span style={{
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      borderRadius: 4, padding: '2px 8px', fontSize: '0.67rem', fontWeight: 700,
      letterSpacing: '0.08em', textTransform: 'uppercase',
    }}>{sev || '—'}</span>
  );
}

// ── Country flag helper ───────────────────────────────────────────────────────
const COUNTRY_FLAGS = {
  'India': '🇮🇳', 'United States': '🇺🇸', 'China': '🇨🇳', 'Russia': '🇷🇺',
  'Germany': '🇩🇪', 'United Kingdom': '🇬🇧', 'Brazil': '🇧🇷', 'France': '🇫🇷',
  'Canada': '🇨🇦', 'Australia': '🇦🇺', 'Japan': '🇯🇵', 'South Korea': '🇰🇷',
  'Netherlands': '🇳🇱', 'Singapore': '🇸🇬', 'Ukraine': '🇺🇦',
  'Internal / RFC1918': '🏠', 'Unknown': '❓',
};

// ── Free geo lookup (ip-api, no key needed) ───────────────────────────────────
async function geoIP(ip) {
  if (classifyIP(ip) === 'Internal / RFC1918')
    return { country: 'Internal / RFC1918', countryCode: 'INT' };
  try {
    const res  = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode`);
    const data = await res.json();
    if (data.status === 'success') return { country: data.country, countryCode: data.countryCode };
  } catch { /* ignore */ }
  return { country: 'Unknown', countryCode: '??' };
}

export default function IntelligencePage({ alerts: propAlerts = [], running = false, setActivePage }) {
  const [alerts, setAlerts]           = useState(propAlerts);
  const [geoData, setGeoData]         = useState({});
  const [geoLoading, setGeoLoading]   = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [loadingAlerts, setLoadingAlerts] = useState(propAlerts.length === 0);

  // Fetch alerts if not passed from parent
  useEffect(() => {
    if (propAlerts.length > 0) { setAlerts(propAlerts); setLoadingAlerts(false); return; }
    getAlerts()
      .then(res => setAlerts(res.data?.alerts || res.data || []))
      .catch(console.error)
      .finally(() => setLoadingAlerts(false));
  }, [propAlerts]);

  // Geolocate unique external IPs (batch, rate-limited)
  useEffect(() => {
    if (alerts.length === 0) return;
    const uniqueIPs = [...new Set(alerts.map(a => a.source_ip).filter(Boolean))];
    setGeoLoading(true);

    // Batch in groups of 5 to respect rate limit (45 req/min for free tier)
    const batchGeo = async () => {
      const results = {};
      const BATCH   = 5;
      for (let i = 0; i < uniqueIPs.length; i += BATCH) {
        const batch = uniqueIPs.slice(i, i + BATCH);
        const settled = await Promise.allSettled(batch.map(ip => geoIP(ip)));
        settled.forEach((r, j) => {
          if (r.status === 'fulfilled') results[batch[j]] = r.value;
        });
        if (i + BATCH < uniqueIPs.length) await new Promise(r => setTimeout(r, 1400));
      }
      setGeoData(results);
      setGeoLoading(false);
    };
    batchGeo();
  }, [alerts]);

  // ── Derived data ────────────────────────────────────────────────────────────
  const threatActors = Object.values(
    alerts.reduce((acc, alert) => {
      const ip = alert.source_ip || 'Unknown';
      if (!acc[ip]) acc[ip] = { ip, count: 0, types: new Set(), severity: alert.severity, lastSeen: alert.timestamp };
      acc[ip].count++;
      acc[ip].types.add(alert.alert_type);
      if (alert.timestamp > acc[ip].lastSeen) acc[ip].lastSeen = alert.timestamp;
      return acc;
    }, {})
  ).sort((a, b) => b.count - a.count);

  const countryBreakdown = Object.values(
    alerts.reduce((acc, alert) => {
      const geo = geoData[alert.source_ip];
      const country = geo?.country || (classifyIP(alert.source_ip) === 'Internal / RFC1918' ? 'Internal / RFC1918' : 'Unknown');
      if (!acc[country]) acc[country] = { country, count: 0 };
      acc[country].count++;
      return acc;
    }, {})
  ).sort((a, b) => b.count - a.count).slice(0, 10);

  const maxCountryCount = countryBreakdown[0]?.count || 1;
  const uniqueCountries = new Set(
    Object.values(geoData).map(g => g.country).filter(c => c !== 'Internal / RFC1918' && c !== 'Unknown')
  ).size;
  const uniqueActors = threatActors.length;
  const externalActors = threatActors.filter(t => classifyIP(t.ip) !== 'Internal / RFC1918').length;

  return (
    <div style={{ padding: '24px', minHeight: '100vh', background: '#0a0f1e', color: '#f8fafc' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Globe size={22} color="#3b82f6" />
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
            THREAT INTELLIGENCE CENTER
          </h1>
        </div>
        <p style={{ color: '#64748b', fontSize: '0.82rem', margin: 0 }}>
          <span style={{ color: '#3b82f6', fontWeight: 600 }}>{uniqueActors}</span> unique threat actors&nbsp;·&nbsp;
          <span style={{ color: '#3b82f6', fontWeight: 600 }}>{uniqueCountries}</span> countries identified&nbsp;·&nbsp;
          {geoLoading && <span style={{ color: '#f59e0b' }}>🌍 Geolocating IPs...</span>}
        </p>
      </div>

      {/* ── Summary Bar ────────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20,
      }}>
        {[
          { label: 'Total Alerts',      value: alerts.length,     color: '#3b82f6',  Icon: AlertTriangle },
          { label: 'Unique Threat IPs', value: uniqueActors,      color: '#a855f7',  Icon: MapPin },
          { label: 'External Actors',   value: externalActors,    color: '#ef4444',  Icon: Globe },
          { label: 'Countries Mapped',  value: uniqueCountries || (geoLoading ? '…' : '—'), color: '#10b981', Icon: TrendingUp },
        ].map(({ label, value, color, Icon }) => (
          <div key={label} style={{
            background: '#111827', border: `1px solid #1e293b`,
            borderTop: `3px solid ${color}`,
            borderRadius: 10, padding: '16px 20px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <p style={{ color: '#64748b', fontSize: '0.62rem', fontWeight: 700,
                          letterSpacing: '0.12em', textTransform: 'uppercase', margin: 0 }}>{label}</p>
              <Icon size={15} color={color} />
            </div>
            <p style={{ fontSize: '1.8rem', fontWeight: 800, color, margin: 0, lineHeight: 1 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Two column ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

        {/* Geographic Distribution */}
        <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid #1e293b',
                        background: 'rgba(59,130,246,0.05)' }}>
            <span style={{ color: '#3b82f6', fontSize: '0.65rem', fontWeight: 700,
                           letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              Geographic Distribution
            </span>
          </div>
          <div style={{ padding: 16 }}>
            {countryBreakdown.length === 0 ? (
              <p style={{ color: '#475569', fontSize: '0.82rem', textAlign: 'center', padding: '24px 0' }}>
                {geoLoading ? '🌍 Loading geo data...' : 'No geo data available'}
              </p>
            ) : (
              countryBreakdown.map(({ country, count }) => {
                const pct = Math.round((count / maxCountryCount) * 100);
                const flag = COUNTRY_FLAGS[country] || '🌐';
                const isInternal = country === 'Internal / RFC1918';
                const barColor = isInternal ? '#64748b' : '#3b82f6';
                return (
                  <div key={country} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between',
                                  alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ color: '#f8fafc', fontSize: '0.78rem', fontWeight: 500 }}>
                        {flag} {country}
                      </span>
                      <span style={{ color: '#94a3b8', fontSize: '0.72rem', fontFamily: 'monospace', fontWeight: 600 }}>
                        {count} alert{count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div style={{ background: '#1e293b', borderRadius: 3, height: 6 }}>
                      <div style={{
                        background: barColor, height: 6, borderRadius: 3,
                        width: `${pct}%`, transition: 'width 0.5s ease',
                      }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Attack Type Breakdown */}
        <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid #1e293b',
                        background: 'rgba(59,130,246,0.05)' }}>
            <span style={{ color: '#3b82f6', fontSize: '0.65rem', fontWeight: 700,
                           letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              Attack Type Breakdown
            </span>
          </div>
          <div style={{ padding: 16 }}>
            {Object.entries(
              alerts.reduce((acc, a) => { acc[a.alert_type || 'Unknown'] = (acc[a.alert_type || 'Unknown'] || 0) + 1; return acc; }, {})
            ).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
              const maxCount = alerts.length || 1;
              const pct = Math.round((count / maxCount) * 100);
              const colors = ['#ef4444', '#a855f7', '#f59e0b', '#3b82f6', '#10b981', '#06b6d4'];
              const colorIdx = Math.abs(type.split('').reduce((s, c) => s + c.charCodeAt(0), 0)) % colors.length;
              return (
                <div key={type} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between',
                                alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ color: '#f8fafc', fontSize: '0.78rem', fontWeight: 500 }}>{type}</span>
                    <span style={{ color: '#94a3b8', fontSize: '0.72rem', fontFamily: 'monospace', fontWeight: 600 }}>
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div style={{ background: '#1e293b', borderRadius: 3, height: 6 }}>
                    <div style={{
                      background: colors[colorIdx], height: 6, borderRadius: 3,
                      width: `${pct}%`, transition: 'width 0.5s ease',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Threat Actor Table ──────────────────────────────────────────────── */}
      <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '10px 20px', borderBottom: '1px solid #1e293b',
                      background: 'rgba(59,130,246,0.05)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#3b82f6', fontSize: '0.65rem', fontWeight: 700,
                         letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            Threat Actor Profiles
          </span>
          <span style={{
            background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)',
            color: '#60a5fa', borderRadius: 20, padding: '2px 10px',
            fontSize: '0.65rem', fontWeight: 700,
          }}>{uniqueActors} actors</span>
        </div>
        <div style={{ overflowY: 'auto', maxHeight: 380 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead>
              <tr style={{ position: 'sticky', top: 0, background: '#0d1929', zIndex: 1 }}>
                {['Rank', 'Source IP', 'Classification', 'Alert Count', 'Attack Types', 'Max Severity', 'Country'].map(col => (
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
              {threatActors.map((actor, idx) => {
                const isInternal = classifyIP(actor.ip) === 'Internal / RFC1918';
                const geo = geoData[actor.ip];
                const country = geo?.country || (isInternal ? 'Internal / RFC1918' : (geoLoading ? '…' : 'Unknown'));
                const flag = COUNTRY_FLAGS[country] || '🌐';
                return (
                  <tr key={actor.ip}
                      style={{ background: idx % 2 === 0 ? '#0d1929' : '#111827', transition: 'background 0.1s' }}>
                    <td style={{ padding: '9px 14px', color: '#64748b', fontWeight: 700, fontFamily: 'monospace' }}>
                      #{idx + 1}
                    </td>
                    <td style={{ padding: '9px 14px', color: '#60a5fa',
                                 fontFamily: 'monospace', fontSize: '0.72rem' }}>
                      {actor.ip}
                    </td>
                    <td style={{ padding: '9px 14px' }}>
                      <span style={{
                        color: isInternal ? '#94a3b8' : '#f87171',
                        fontSize: '0.7rem', fontWeight: 600,
                      }}>
                        {isInternal ? '🏠 Internal' : '🌐 External'}
                      </span>
                    </td>
                    <td style={{ padding: '9px 14px' }}>
                      <span style={{
                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                        color: '#f87171', borderRadius: 4, padding: '2px 8px',
                        fontFamily: 'monospace', fontWeight: 700, fontSize: '0.72rem',
                      }}>{actor.count}</span>
                    </td>
                    <td style={{ padding: '9px 14px', color: '#94a3b8', fontSize: '0.7rem' }}>
                      {[...actor.types].slice(0, 2).join(', ')}{actor.types.size > 2 ? ` +${actor.types.size - 2}` : ''}
                    </td>
                    <td style={{ padding: '9px 14px' }}>
                      <SevBadge sev={actor.severity} />
                    </td>
                    <td style={{ padding: '9px 14px', color: '#94a3b8', fontSize: '0.7rem' }}>
                      {flag} {country}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedAlert && (
        <IncidentModal alert={selectedAlert} onClose={() => setSelectedAlert(null)} />
      )}
    </div>
  );
}
