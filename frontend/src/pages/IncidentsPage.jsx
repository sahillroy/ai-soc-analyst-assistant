import React, { useMemo, useState } from 'react';
import AlertTable from '../components/AlertTable';
import IncidentModal from '../components/IncidentModal';

export default function IncidentsPage({ alerts = [], selectedSeverity, selectedCampaign }) {
  const [selectedAlert, setSelectedAlert] = useState(null);

  const filteredAlerts = useMemo(() => {
    let result = alerts;
    if (selectedSeverity) result = result.filter(a => a.severity === selectedSeverity);
    if (selectedCampaign) result = result.filter(a => a.campaign_id === selectedCampaign);
    return result;
  }, [alerts, selectedSeverity, selectedCampaign]);

  const stats = useMemo(() => {
    let totalConfidence = 0;
    let confidenceCount = 0;
    const typeFreq = {};

    alerts.forEach(a => {
      // Calculate confidence
      if (a.confidence != null) {
        let conf = Number(a.confidence);
        if (conf <= 1) conf = conf * 100;
        totalConfidence += conf;
        confidenceCount++;
      }
      // Calculate type frequency
      if (a.alert_type) {
        typeFreq[a.alert_type] = (typeFreq[a.alert_type] || 0) + 1;
      }
    });

    const meanConfidence = confidenceCount > 0 
      ? (totalConfidence / confidenceCount) 
      : 0;

    let mostCommonType = 'None';
    let maxCount = 0;
    Object.entries(typeFreq).forEach(([type, count]) => {
      if (count > maxCount) {
        mostCommonType = type;
        maxCount = count;
      }
    });

    return {
      meanConfidence: meanConfidence.toFixed(1),
      mostCommonType
    };
  }, [filteredAlerts]);

  return (
    <div className="flex flex-col">
      {/* Page Header */}
      <header className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-[28px] font-bold text-[#f8fafc] m-0 leading-tight">Active Threat Alerts</h1>
          <p className="text-[14px] text-[#64748b] mt-1 m-0">
            Monitoring suspicious activity across your network.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
          <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Live Monitoring Active</span>
        </div>
      </header>

      {/* Alert Table Component */}
      <AlertTable alerts={filteredAlerts} onRowClick={setSelectedAlert} />

      {/* Footer Summary Stats */}
      {alerts.length > 0 && (
        <div className="mt-6 flex flex-col sm:flex-row gap-6 bg-[#1e293b] border border-[#334155] rounded-xl p-6">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-1">Mean Detection Confidence</div>
            <div className="text-xl font-bold text-slate-200">{stats.meanConfidence}%</div>
          </div>
          <div className="hidden sm:block w-px bg-[#334155]"></div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-1">Most Common Alert Type</div>
            <div className="text-xl font-bold text-slate-200 truncate">{stats.mostCommonType}</div>
          </div>
        </div>
      )}

      {selectedAlert && <IncidentModal incident={selectedAlert} onClose={() => setSelectedAlert(null)} />}
    </div>
  );
}
