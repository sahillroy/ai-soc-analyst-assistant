import React from 'react';

export default function ReportingPage({ setActivePage }) {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <div className="w-24 h-24 bg-blue-600/10 rounded-full flex items-center justify-center mb-6 border border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.15)]">
        <span className="material-symbols-outlined text-[48px] text-blue-500">description</span>
      </div>
      <h2 className="text-3xl font-bold text-slate-50 mb-4 font-headline">Compliance & Exec Reporting</h2>
      <p className="text-slate-400 max-w-md mb-8 text-[14px]">
        This feature is coming soon. The reporting module will allow one-click generation of SOC2, HIPAA, and executive summary documents based on network telemetrics.
      </p>
      <button 
        onClick={() => setActivePage('dashboard')}
        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors shadow-lg"
      >
        Return to Dashboard
      </button>
    </div>
  );
}
