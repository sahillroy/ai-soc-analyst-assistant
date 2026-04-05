import React from 'react';
import UploadPanel from '../components/UploadPanel';
import ThreatMap from '../components/ThreatMap';

export default function LogExplorerPage({ alerts = [], handleUpload, handleDemoData, uploading, handleRunAnalysis, running }) {
  return (
    <div className="flex flex-col gap-8">
      {/* Page Header */}
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-[28px] font-bold text-[#f8fafc] m-0 leading-tight">Data Ingestion Engine</h1>
          <p className="text-[14px] text-[#64748b] mt-1 m-0">Upload and map your network log sources</p>
        </div>
        <button 
          onClick={handleRunAnalysis}
          disabled={running}
          style={{ padding: '8px 16px', background: '#3b82f6', color: '#ffffff', border: 'none', borderRadius: 4, cursor: running ? 'not-allowed' : 'pointer', fontWeight: 500, opacity: running ? 0.7 : 1 }}
        >
          {running ? 'Analysis Running...' : 'Run Analysis on Logs'}
        </button>
      </header>

      {/* Upload and Heatmap Grid layout identical to original specification */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <div className="flex flex-col h-full">
          <UploadPanel 
            onUpload={handleUpload}
            onDemoData={handleDemoData}
            uploading={uploading}
          />
        </div>
        <div className="h-full bg-[#1e293b] border border-[#334155] rounded-xl flex flex-col justify-center">
          <ThreatMap alerts={alerts} />
        </div>
      </div>
    </div>
  );
}
