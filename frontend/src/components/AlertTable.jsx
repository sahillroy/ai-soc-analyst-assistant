import React, { useState } from 'react';
import IncidentModal from './IncidentModal';

export default function AlertTable({ alerts = [], onRowClick, onSelectAlert }) {
  const handler = onRowClick || onSelectAlert;
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('All Severities');
  const [sortCol, setSortCol] = useState(null);
  const [selected, setSelected] = useState(null);

  const filtered = alerts.filter(a => {
    const s = search.toLowerCase();
    const matchSearch = String(a.incident_id || '').toLowerCase().includes(s) || 
                        String(a.source_ip || '').toLowerCase().includes(s) ||
                        String(a.campaign_id || '').toLowerCase().includes(s);
    const matchSev = severityFilter === 'All Severities' || a.severity === severityFilter;
    return matchSearch && matchSev;
  });

  const sorted = sortCol ? [...filtered].sort((a, b) => {
    if (a[sortCol] < b[sortCol]) return -1;
    if (a[sortCol] > b[sortCol]) return 1;
    return 0;
  }) : filtered;

  const toggleSort = col => {
    if (sortCol === col) {
      setSortCol(null);
    } else {
      setSortCol(col);
    }
  };

  const formatConfidence = (conf) => {
    if (conf == null) return '-';
    let num = Number(conf);
    if (num <= 1) num = num * 100;
    return num.toFixed(2);
  };

  const exportCSV = () => {
    const headers = [
      'incident_id', 'timestamp', 'source_ip', 'destination_ip', 'port',
      'alert_type', 'severity', 'risk_score', 'confidence', 'campaign_id',
      'escalation', 'mitre_technique', 'description', 'recommendation'
    ];

    const escapeCsv = (str) => {
      if (str == null) return '';
      const stringified = String(str);
      if (stringified.includes(',') || stringified.includes('"') || stringified.includes('\n')) {
        return `"${stringified.replace(/"/g, '""')}"`;
      }
      return stringified;
    };

    const csvRows = [headers.map(escapeCsv).join(',')];

    sorted.forEach(a => {
      const row = [
        a.incident_id,
        a.timestamp,
        a.source_ip,
        a.destination_ip,
        a.port,
        a.alert_type,
        a.severity,
        a.risk_score,
        formatConfidence(a.confidence),
        a.campaign_id,
        a.escalation ? 'true' : 'false',
        a.mitre_technique,
        a.incident_summary,
        a.recommended_action
      ];
      csvRows.push(row.map(escapeCsv).join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const now = new Date();
    const ts = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `soc_alerts_${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getSeverityStyle = (severity) => {
    switch (severity) {
      case 'Critical': return { background: '#8b5cf622', color: '#8b5cf6', border: '1px solid #8b5cf644', borderRadius: 12, padding: '2px 8px', fontSize: 12, display: 'inline-block' };
      case 'High': return { background: '#ef444422', color: '#ef4444', border: '1px solid #ef444444', borderRadius: 12, padding: '2px 8px', fontSize: 12, display: 'inline-block' };
      case 'Medium': return { background: '#f59e0b22', color: '#f59e0b', border: '1px solid #f59e0b44', borderRadius: 12, padding: '2px 8px', fontSize: 12, display: 'inline-block' };
      case 'Low': return { background: '#10b98122', color: '#10b981', border: '1px solid #10b98144', borderRadius: 12, padding: '2px 8px', fontSize: 12, display: 'inline-block' };
      default: return { background: '#47556922', color: '#475569', border: '1px solid #47556944', borderRadius: 12, padding: '2px 8px', fontSize: 12, display: 'inline-block' }; // Normal
    }
  };

  return (
    <div style={{ marginTop: 24, fontFamily: 'Inter, sans-serif' }}>
      {/* Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <input 
          style={{ flex: 1, minWidth: 200, maxWidth: 400, padding: '8px 12px', background: '#1e293b', border: '1px solid #334155', color: '#f8fafc', borderRadius: 4, outline: 'none' }}
          placeholder="Search items..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 16 }}>
          <select 
            style={{ padding: '8px 12px', background: '#1e293b', border: '1px solid #334155', color: '#f8fafc', borderRadius: 4, outline: 'none', cursor: 'pointer' }}
            value={severityFilter}
            onChange={e => setSeverityFilter(e.target.value)}
          >
            <option>All Severities</option>
            <option>Critical</option>
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
          <button 
            style={{ padding: '8px 16px', background: '#3b82f6', color: '#ffffff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
            onClick={exportCSV}
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', background: '#0f172a', borderRadius: 8, border: '1px solid #1e293b' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: '#f8fafc', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e293b', background: '#1e293b', color: '#94a3b8', fontSize: 12, textTransform: 'uppercase' }}>
              <th onClick={() => toggleSort('incident_id')} style={{ padding: '12px 16px', cursor: 'pointer' }}>Incident ID</th>
              <th onClick={() => toggleSort('source_ip')} style={{ padding: '12px 16px', cursor: 'pointer' }}>Source IP</th>
              <th onClick={() => toggleSort('alert_type')} style={{ padding: '12px 16px', cursor: 'pointer' }}>Alert Type</th>
              <th onClick={() => toggleSort('severity')} style={{ padding: '12px 16px', cursor: 'pointer' }}>Severity</th>
              <th onClick={() => toggleSort('risk_score')} style={{ padding: '12px 16px', cursor: 'pointer' }}>Risk Score</th>
              <th onClick={() => toggleSort('confidence')} style={{ padding: '12px 16px', cursor: 'pointer' }}>Confidence</th>
              <th onClick={() => toggleSort('campaign_id')} style={{ padding: '12px 16px', cursor: 'pointer' }}>Campaign</th>
              <th onClick={() => toggleSort('escalation')} style={{ padding: '12px 16px', cursor: 'pointer' }}>Escalation</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <div style={{ textAlign: 'center', color: '#475569', padding: 32 }}>
                    No alerts match the current filter.
                  </div>
                </td>
              </tr>
            ) : (
              sorted.map((alert, index) => {
                const isEven = index % 2 === 0;
                return (
                  <tr 
                    key={alert.incident_id || index} 
                    onClick={() => handler ? handler(alert) : setSelected(alert)}
                    style={{ 
                      cursor: 'pointer', 
                      borderBottom: '1px solid #1e293b',
                      background: isEven ? '#0f172a' : 'transparent',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#334155'}
                    onMouseLeave={(e) => e.currentTarget.style.background = isEven ? '#0f172a' : 'transparent'}
                  >
                    <td style={{ padding: '12px 16px', fontWeight: 500 }}>{alert.incident_id}</td>
                    <td style={{ padding: '12px 16px', opacity: 0.9 }}>{alert.source_ip}</td>
                    <td style={{ padding: '12px 16px' }}>{alert.alert_type}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={getSeverityStyle(alert.severity)}>{alert.severity || 'Normal'}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>{alert.risk_score}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {alert.confidence != null ? `${formatConfidence(alert.confidence)}%` : '-'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {alert.campaign_id && alert.campaign_id.toLowerCase() !== 'standalone' ? (
                        <span style={{ background: '#8b5cf622', color: '#8b5cf6', borderRadius: 12, padding: '2px 8px', fontSize: 12, display: 'inline-block' }}>
                          {alert.campaign_id}
                        </span>
                      ) : (
                        <span style={{ color: '#64748b' }}>{alert.campaign_id || 'standalone'}</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {alert.escalation === 'Escalated to Tier-2' ? (
                        <span style={{ color: '#ef4444', fontSize: 12 }}>{alert.escalation}</span>
                      ) : (
                        <span style={{ color: '#64748b', fontSize: 12 }}>{alert.escalation || 'Under Review'}</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {selected && !handler && (
        <IncidentModal incident={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}