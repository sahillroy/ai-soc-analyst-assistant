export default function CampaignView({ alerts }) {
  if (!alerts || alerts.length === 0) {
    return (
      <div style={{ color: '#475569', textAlign: 'center', padding: 48 }}>
        No alerts available.
      </div>
    );
  }

  // Group alerts by campaign_id
  const campaigns = alerts.reduce((acc, alert) => {
    const cid = alert.campaign_id;

    if (!cid || cid === 'standalone') return acc;

    if (!acc[cid]) acc[cid] = [];
    acc[cid].push(alert);

    return acc;
  }, {});

  const SEV_ORDER = { Critical: 4, High: 3, Medium: 2, Low: 1, Normal: 0 };

  const SEV_COLOR = {
    Critical: '#8b5cf6',
    High: '#ef4444',
    Medium: '#f59e0b',
    Low: '#10b981',
    Normal: '#475569',
  };

  const campaignList = Object.entries(campaigns)
    .map(([id, group]) => {
      const maxSev = group.reduce(
        (top, a) =>
          SEV_ORDER[a.severity] > SEV_ORDER[top] ? a.severity : top,
        'Normal'
      );

      const ips = [...new Set(group.map(a => a.source_ip))];

      return {
        id,
        alerts: group,
        maxSev,
        ips,
        count: group.length,
      };
    })
    .sort((a, b) => SEV_ORDER[b.maxSev] - SEV_ORDER[a.maxSev]);

  if (campaignList.length === 0) {
    return (
      <div style={{ color: '#475569', textAlign: 'center', padding: 48 }}>
        No campaigns detected. Run analysis to correlate alerts.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {campaignList.map(({ id, alerts, maxSev, ips, count }) => (
        <div
          key={id}
          style={{
            background: '#1e293b',
            borderRadius: 8,
            padding: 20,
            borderLeft: `4px solid ${SEV_COLOR[maxSev]}`,
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <div>
              <span
                style={{
                  color: '#3b82f6',
                  fontWeight: 700,
                  fontFamily: 'monospace',
                }}
              >
                {id}
              </span>

              <span
                style={{
                  marginLeft: 10,
                  padding: '2px 10px',
                  borderRadius: 12,
                  fontSize: 12,
                  background: SEV_COLOR[maxSev] + '22',
                  color: SEV_COLOR[maxSev],
                  border: `1px solid ${SEV_COLOR[maxSev]}44`,
                }}
              >
                {maxSev}
              </span>
            </div>

            <span style={{ color: '#64748b', fontSize: 13 }}>
              {count} alerts
            </span>
          </div>

          {/* Timeline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {alerts.slice(0, 5).map((a, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 12,
                  fontSize: 13,
                  alignItems: 'center',
                }}
              >
                <span
                  style={{
                    color: '#475569',
                    minWidth: 120,
                    fontFamily: 'monospace',
                  }}
                >
                  {new Date(a.timestamp || Date.now()).toLocaleTimeString()}
                </span>

                <span style={{ color: '#94a3b8' }}>
                  {a.alert_type}
                </span>

                <span
                  style={{
                    marginLeft: 'auto',
                    fontFamily: 'monospace',
                    color: '#475569',
                  }}
                >
                  {a.source_ip}
                </span>
              </div>
            ))}

            {alerts.length > 5 && (
              <div style={{ color: '#475569', fontSize: 12 }}>
                +{alerts.length - 5} more alerts
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}