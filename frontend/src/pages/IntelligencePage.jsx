import React, { useState } from 'react';
import TimelineChart from '../components/TimelineChart';
import IncidentModal from '../components/IncidentModal';

export default function IntelligencePage({ alerts = [], running = false, setActivePage }) {
  const [selectedAlert, setSelectedAlert] = useState(null);

  return (
    <div className="flex flex-col gap-8">
      {/* Page Header */}
      <header>
        <h1 className="text-[28px] font-bold text-[#f8fafc] m-0 leading-tight">Threat Intelligence Timeline</h1>
        <p className="text-[14px] text-[#64748b] mt-1 m-0">Detection frequency and behavioral patterns across your network.</p>
      </header>

      {/* Timeline Chart — contains velocity chart, stat cards, and forensic table */}
      <TimelineChart
        alerts={alerts}
        running={running}
        onSelectAlert={setSelectedAlert}
        setActivePage={setActivePage}
      />

      {/* Incident Modal */}
      {selectedAlert && (
        <IncidentModal
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
        />
      )}
    </div>
  );
}
