import React, { useState, useMemo } from 'react';
import StatCard from '../components/StatCard';
import SeverityChart from '../components/SeverityChart';
import AlertTypeChart from '../components/AlertTypeChart';
import SettingsPanel from '../components/SettingsPanel';
import IncidentModal from '../components/IncidentModal';

export default function OverviewPage({ alerts = [], loading, running, lastRun, handleRunAnalysis, setActivePage, setSelectedSeverity }) {
  const [showSettings, setShowSettings] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);

  const totalAlerts = alerts.length;
  const criticalAlerts = alerts.filter(a => a.severity === 'Critical').length;
  const highAlerts = alerts.filter(a => a.severity === 'High').length;
  const mediumAlerts = alerts.filter(a => a.severity === 'Medium').length;
  const lowAlerts = alerts.filter(a => a.severity === 'Low').length;

  const topIps = useMemo(() => {
    const counts = {};
    alerts.forEach(a => {
      if (a.source_ip) counts[a.source_ip] = (counts[a.source_ip] || 0) + 1;
    });
    return Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 5);
  }, [alerts]);

  const recentAlerts = alerts.slice(0, 5);

  const getSeverityStyle = (severity) => {
    switch (severity) {
      case 'Critical': return { background: '#8b5cf622', color: '#8b5cf6', border: '1px solid #8b5cf644' };
      case 'High': return { background: '#ef444422', color: '#ef4444', border: '1px solid #ef444444' };
      case 'Medium': return { background: '#f59e0b22', color: '#f59e0b', border: '1px solid #f59e0b44' };
      case 'Low': return { background: '#10b98122', color: '#10b981', border: '1px solid #10b98144' };
      default: return { background: '#47556922', color: '#475569', border: '1px solid #47556944' }; 
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* 1. Page Header */}
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-[28px] font-bold text-[#f8fafc] m-0 leading-tight">Operations Dashboard</h1>
          <p className="text-[14px] text-[#64748b] mt-1 m-0">
            System status: <span className={running ? "text-blue-400" : "text-emerald-500"}>{running ? 'Analysis Running' : 'Operational'}</span>
            {lastRun && `  |  Last run: ${new Date(lastRun).toLocaleTimeString()}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2.5 rounded-lg bg-[#1e293b] border border-[#334155] text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center">
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>settings</span>
          </button>
          <button 
            onClick={handleRunAnalysis} disabled={running}
            className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-[13px] tracking-wide flex items-center gap-2 transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{running ? 'sync' : 'radar'}</span>
            {running ? 'Running...' : 'Run Analysis'}
          </button>
        </div>
      </header>

      {/* 2. Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard 
          label="Total Alerts" value={totalAlerts} color="blue" icon="monitoring" subtitle="All detections" 
          onClick={() => { setActivePage('incidents'); setSelectedSeverity(null); }} 
        />
        <StatCard 
          label="Critical" value={criticalAlerts} color="purple" icon="error" subtitle="Immediate action" 
          onClick={() => { setActivePage('incidents'); setSelectedSeverity('Critical'); }} 
        />
        <StatCard 
          label="High" value={highAlerts} color="red" icon="warning" subtitle="Requires review" 
          onClick={() => { setActivePage('incidents'); setSelectedSeverity('High'); }} 
        />
        <StatCard 
          label="Medium" value={mediumAlerts} color="orange" icon="history" subtitle="Investigation needed" 
          onClick={() => { setActivePage('incidents'); setSelectedSeverity('Medium'); }} 
        />
        <StatCard 
          label="Low" value={lowAlerts} color="green" icon="info" subtitle="Informational" 
          onClick={() => { setActivePage('incidents'); setSelectedSeverity('Low'); }} 
        />
      </div>

      {/* 3. Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-6 h-full flex flex-col justify-center">
          <SeverityChart alerts={alerts} />
        </div>
        <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-6 h-full flex flex-col justify-center">
          <AlertTypeChart alerts={alerts} />
        </div>
      </div>

      {/* 4. Bottom Row: Top IPs & Alerts Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Top Source IPs */}
        <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-6 flex flex-col col-span-1">
          <h3 className="text-[14px] font-bold text-slate-200 mb-4 tracking-wide uppercase">Top Source IPs</h3>
          <div className="flex-1 flex flex-col gap-3">
            {topIps.length === 0 ? (
              <div className="text-slate-500 text-sm text-center py-8">No data available</div>
            ) : topIps.map(([ip, count], i) => (
              <div key={ip} className="flex justify-between items-center bg-[#0f172a] p-3 rounded-lg border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">
                    #{i + 1}
                  </div>
                  <span className="font-mono text-[13px] text-slate-300">{ip}</span>
                </div>
                <span className="text-[12px] font-bold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-md">{count} hits</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Alerts Preview */}
        <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-6 flex flex-col lg:col-span-2 relative">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[14px] font-bold text-slate-200 tracking-wide uppercase">Recent Alerts</h3>
            <button 
              onClick={() => setActivePage('incidents')}
              className="text-[#3b82f6] hover:text-[#60a5fa] text-[12px] font-semibold flex items-center gap-1 transition-colors">
              View all alerts <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
            </button>
          </div>
          <div className="flex-1 flex flex-col gap-2">
            {recentAlerts.length === 0 ? (
              <div className="text-slate-500 text-sm text-center py-8">No alerts found</div>
            ) : recentAlerts.map(a => (
              <div 
                key={a.incident_id || a.id || a.source_ip + a.timestamp} 
                onClick={() => setSelectedAlert(a)}
                className="flex items-center justify-between p-3 bg-[#0f172a] hover:bg-slate-800 rounded-lg cursor-pointer transition-colors group border border-transparent hover:border-[#334155]">
                <div className="flex items-center gap-4">
                  <span className="text-[11px] text-slate-500 font-mono w-16">{new Date(a.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  <span className="text-[11px] font-bold uppercase rounded-full px-2 py-0.5 w-20 text-center" style={getSeverityStyle(a.severity)}>{a.severity}</span>
                  <span className="font-mono text-[13px] text-slate-300 w-32">{a.source_ip}</span>
                  <span className="text-[13px] text-slate-400 truncate max-w-[200px]">{a.alert_type}</span>
                </div>
                <span className="material-symbols-outlined text-slate-600 group-hover:text-blue-400 transition-colors" style={{ fontSize: 18 }}>chevron_right</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {showSettings && <SettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />}
      {selectedAlert && <IncidentModal incident={selectedAlert} onClose={() => setSelectedAlert(null)} />}
    </div>
  );
}
