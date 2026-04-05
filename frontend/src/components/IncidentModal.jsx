import React, { useState } from 'react';
import { updateAlertStatus, updateAlertNotes } from '../api/client';

export default function IncidentModal({ alert: propAlert, incident, onClose, onUpdate }) {
  // Support either prop name seamlessly
  const alert = propAlert || incident;
  if (!alert) return null;

  const initialStatus = (alert.status === 'New' ? 'Open' : alert.status) || 'Open';
  const [status, setStatus] = useState(initialStatus);
  const [notes, setNotes] = useState(alert.notes || '');
  const [notesSaved, setNotesSaved] = useState(false);

  const handleStatusChange = async (e) => {
    const newDisplayStatus = e.target.value;
    setStatus(newDisplayStatus);
    const dbStatus = newDisplayStatus === 'Open' ? 'New' : newDisplayStatus;
    try {
      await updateAlertStatus(alert.incident_id || alert.id, dbStatus);
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  const handleNotesSave = async () => {
    try {
      await updateAlertNotes(alert.incident_id || alert.id, notes);
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Failed to save notes', err);
    }
  };

  // Safe MITRE parsing
  const mitre = (() => {
    try {
      return typeof alert.mitre_technique === 'string'
        ? JSON.parse(alert.mitre_technique)
        : (alert.mitre_technique || {});
    } catch {
      return {};
    }
  })();
  const mitreUrl = mitre.mitre_url || (mitre.technique_id ? `https://attack.mitre.org/techniques/${mitre.technique_id}/` : null);

  const getSeverityStyle = (severity) => {
    switch (severity) {
      case 'Critical': return { bg: '#8b5cf622', border: '#8b5cf6', text: '#8b5cf6' };
      case 'High': return { bg: '#ef444422', border: '#ef4444', text: '#ef4444' };
      case 'Medium': return { bg: '#f59e0b22', border: '#f59e0b', text: '#f59e0b' };
      case 'Low': return { bg: '#10b98122', border: '#10b981', text: '#10b981' };
      default: return { bg: '#47556922', border: '#475569', text: '#475569' };
    }
  };
  const sevStyle = getSeverityStyle(alert.severity);

  // Common Typography classes
  const labelClass = "text-[11px] font-semibold tracking-[0.08em] uppercase text-[#64748b] mb-1 block";
  const valueClass = "text-[14px] text-[#f1f5f9]";
  const cardClass = "bg-[#0d1526] border border-[#1e293b] rounded-[8px] p-[16px]";

  return (
    <div 
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4 font-sans"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
    >
      <div 
        className="w-full relative flex flex-col"
        style={{ 
          background: '#0f1929', 
          border: '1px solid #1e3a5f',
          borderTop: `3px solid ${sevStyle.border}`,
          borderRadius: '12px',
          maxWidth: '900px',
          maxHeight: '85vh',
          overflowY: 'auto'
        }}
      >
        {/* HEADER */}
        <header className="p-6 border-b border-[#1e293b] flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span 
                className="text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full"
                style={{ background: sevStyle.bg, color: sevStyle.text, border: `1px solid ${sevStyle.bg}` }}
              >
                {alert.severity} Incident
              </span>
              <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                ID: {alert.incident_id || alert.id}
              </span>
            </div>
            <h2 className="text-[22px] font-bold text-[#f1f5f9] mb-3">{alert.alert_type}</h2>
            <div className="flex items-center gap-6 text-[13px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 0" }}>schedule</span>
                Detected: {alert.timestamp ? new Date(alert.timestamp).toLocaleString() : 'Unknown'}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 0" }}>location_on</span>
                {alert.destination_ip || 'Internal Network'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={status}
              onChange={handleStatusChange}
              className="bg-[#1e293b] border border-[#334155] text-slate-200 text-sm font-semibold pl-4 pr-10 py-2 rounded-full outline-none focus:border-blue-500 cursor-pointer appearance-none"
              style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M7%2010l5%205%205-5z%22%20fill%3D%22%2394a3b8%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
            >
              <option value="Open">Open</option>
              <option value="Investigating">Investigating</option>
              <option value="Resolved">Resolved</option>
              <option value="False Positive">False Positive</option>
            </select>
            <button 
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </header>

        <div className="p-6 flex flex-col lg:flex-row gap-6">
          {/* Main Column */}
          <div className="flex-1 flex flex-col gap-6">
            
            {/* AI TACTICAL SUMMARY */}
            <section className="bg-[#152338] border-l-4 border-blue-500 p-5 rounded-r-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-blue-400 text-[18px]">auto_awesome</span>
                <span className="text-[11px] font-bold tracking-widest uppercase text-blue-400">AI Tactical Summary</span>
              </div>
              <p className="text-[15px] italic text-slate-200 leading-relaxed">
                {alert.incident_summary || "No summary available for this alert."}
              </p>
            </section>

            {/* RECOMMENDED ACTION */}
            <section className="bg-[#f59e0b11] border border-[#f59e0b33] p-5 rounded-lg flex items-start gap-4">
              <div className="p-2 bg-[#f59e0b22] rounded-lg">
                <span className="material-symbols-outlined text-[#f59e0b]">priority_high</span>
              </div>
              <div>
                <h3 className="text-[#f59e0b] font-bold text-[14px] mb-1">Recommended Action</h3>
                <p className="text-[#f1f5f9] text-[14px] mb-2 leading-relaxed">
                  {alert.recommended_action || "Investigate context and isolate host if malicious pattern is verified."}
                </p>
                {alert.soc_playbook_action && (
                  <p className="text-[13px] text-slate-300 mb-1 border-l-2 border-[#f59e0b66] pl-2">
                    Playbook: {alert.soc_playbook_action}
                  </p>
                )}
                {alert.automation_result && (
                  <p className="text-[12px] text-slate-500">
                    Automation: {alert.automation_result}
                  </p>
                )}
              </div>
            </section>

            {/* TWO-COLUMN DETAIL CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={cardClass}>
                <h4 className={`${labelClass} mb-3 flex items-center gap-2`}><span className="material-symbols-outlined text-[16px]">dns</span> Network Origin</h4>
                <div className="space-y-3">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Source IP</span>
                    <span className="font-mono text-[#f1f5f9] text-[14px]">{alert.source_ip || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Protocol</span>
                    <span className={valueClass}>{alert.protocol || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Campaign</span>
                    <span className={valueClass}>{alert.campaign_id || 'standalone'}</span>
                  </div>
                </div>
              </div>

              <div className={cardClass}>
                <h4 className={`${labelClass} mb-3 flex items-center gap-2`}><span className="material-symbols-outlined text-[16px]">target</span> Target Entity</h4>
                <div className="space-y-3">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Destination</span>
                    <span className="font-mono text-[#f1f5f9] text-[14px]">
                      {alert.destination_ip || '—'}{alert.port ? `:${alert.port}` : ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Risk Score</span>
                    <span className={valueClass}>{alert.risk_score || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Escalation</span>
                    <span className={valueClass}>{alert.escalation || '—'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ANALYST INTELLIGENCE JOURNAL */}
            <section className="bg-[#0b1221] border border-[#1e293b] rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-bold text-[#f1f5f9] flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400 text-[18px]">edit_note</span>
                  Analyst Intelligence Journal
                </h3>
              </div>
              <textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Log investigation findings, pivoting details, or escalation notes..."
                className="w-full h-28 bg-[#0f172a] border border-[#334155] rounded-md p-3 text-[13px] text-slate-200 placeholder:text-slate-600 outline-none focus:border-blue-500 resize-none mb-3"
              />
              <div className="flex justify-end">
                <button 
                  onClick={handleNotesSave}
                  className={`px-4 py-1.5 rounded text-[12px] font-bold transition-colors ${notesSaved ? 'bg-emerald-500 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
                >
                  {notesSaved ? '✓ Saved' : 'Save Entry'}
                </button>
              </div>
            </section>

          </div>

          {/* Sidebar Column */}
          <aside className="lg:w-72 flex flex-col gap-4">
            
            {/* METADATA PANEL */}
            <div className={cardClass}>
              <h4 className={`${labelClass} mb-3`}>Metadata</h4>
              <div className="space-y-2 border-b border-[#1e293b] pb-3 mb-3">
                <div className="flex justify-between items-center">
                  <span className="text-[12px] text-slate-400">Confidence</span>
                  <span className="text-[13px] font-mono text-emerald-400 font-bold">
                    {alert.confidence != null ? `${(Number(alert.confidence) <= 1 ? Number(alert.confidence) * 100 : Number(alert.confidence)).toFixed(1)}%` : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[12px] text-slate-400">Country</span>
                  <span className="text-[13px] text-[#f1f5f9]">{alert.ip_country || '—'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[12px] text-slate-400">Campaign</span>
                  <span className="text-[13px] text-[#f1f5f9] truncate max-w-[120px]">{alert.campaign_id || 'standalone'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[12px] text-slate-400">Escalation</span>
                  <span className="text-[13px] text-[#f1f5f9] truncate max-w-[120px]">{alert.escalation || '—'}</span>
                </div>
              </div>
            </div>

            {/* MITRE ATT&CK */}
            <div className={cardClass}>
              <h4 className={`${labelClass} mb-3`}>MITRE ATT&CK</h4>
              <div className="space-y-2">
                <div className="text-[13px] font-bold text-blue-400 mb-1">
                  {mitre.technique_id || 'Unknown'} — {mitre.technique_name || 'Unclassified Technique'}
                </div>
                <div className="text-[12px] text-slate-300">
                  <span className="text-slate-500">Tactic:</span> {mitre.tactic || '—'}
                </div>
                {mitreUrl && (
                  <a 
                    href={mitreUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 mt-2 text-[12px] text-blue-500 hover:text-blue-400 transition-colors"
                  >
                    View on MITRE <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                  </a>
                )}
              </div>
            </div>

          </aside>
        </div>
      </div>
    </div>
  );
}
