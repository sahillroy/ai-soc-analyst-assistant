import React, { useRef, useState } from 'react';

export default function UploadPanel({ onUpload, onDemoData, uploading }) {
  const fileRef = useRef(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);

  const handleFileChange = async (e) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const file = e.target.files[0];
        const formData = new FormData();
        formData.append("file", file);

        await fetch("/api/upload-logs", {
          method: "POST",
          body: formData
        });

        // The UI handles its own parsing via onUpload
        try { await onUpload(file); } catch (e) {}

        setSuccessMsg(`Successfully uploaded log file.`);
      } catch (err) {
        const detail = err.message || 'Upload failed.';
        setErrorMsg(`Upload error: ${detail}`);
        console.error('[Sentinel] Upload failed:', err);
      }
    }
  };

  const handleDemo = async () => {
    setSuccessMsg('');
    try {
      await onDemoData();
      setSuccessMsg('Successfully loaded synthetic threat data.');
    } catch (err) {
      setSuccessMsg('');
    }
  };

  return (
    <div className="flex flex-col gap-8 w-full h-full max-w-7xl">
      <style>{`
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
            display: inline-block;
            line-height: 1;
            text-transform: none;
            letter-spacing: normal;
            word-wrap: normal;
            white-space: nowrap;
            direction: ltr;
        }
        .tonal-shift-bg { background-color: rgba(11, 19, 38, 0.8); }
      `}</style>

      {/* Header Section */}
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold font-headline text-on-surface">Data Ingestion Engine</h1>
        <p className="text-on-surface-variant text-sm font-body">Manage and map telemetry sources for tactical analysis.</p>
      </header>

      {/* Redesigned Upload Panel Section */}
      <section className="flex flex-col gap-6">
        {/* Collapsed State (Slim Bar) */}
        <div 
          onClick={() => setIsExpanded(!isExpanded)}
          className="bg-surface-container-low rounded-xl px-6 h-14 flex items-center justify-between group cursor-pointer hover:bg-surface-container transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className={`material-symbols-outlined text-primary ${uploading ? 'animate-spin' : ''}`}>
              {uploading ? 'autorenew' : 'upload_file'}
            </span>
            <span className="font-headline font-semibold text-sm tracking-tight text-on-surface">
              Log Ingestion Status: {uploading ? 'Processing Data...' : successMsg ? 'Ingestion Complete' : 'Waiting for Data'}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-label uppercase tracking-widest text-outline">v2.4.0-Tactical</span>
            <span className={`material-symbols-outlined text-outline group-hover:text-on-surface transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
              expand_more
            </span>
          </div>
        </div>

        {/* Expanded State */}
        {isExpanded && (
          <div className="bg-surface-container rounded-xl overflow-hidden border border-white/5 transition-all duration-300">
            <div className="p-8 flex flex-col gap-8">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Upload Button (Dashed Drop Zone) */}
                <button 
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="relative group flex flex-col items-center justify-center gap-4 p-10 rounded-xl border-2 border-dashed border-outline-variant hover:border-primary/50 hover:bg-primary/10 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <input type="file" className="hidden" ref={fileRef} onChange={handleFileChange} />
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-3xl">cloud_upload</span>
                  </div>
                  <div className="text-center">
                    <h3 className="font-headline font-bold text-on-surface">Upload Your Logs</h3>
                    <p className="text-sm font-body text-outline mt-1">Drag and drop .JSON, .CSV, or .LOG files here</p>
                  </div>
                </button>

                {/* Demo Data Button */}
                <button 
                  onClick={handleDemo}
                  disabled={uploading}
                  className="relative group flex flex-col items-center justify-center gap-4 p-10 rounded-xl bg-surface-container-high border border-white/5 hover:bg-surface-container-highest transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="w-16 h-16 rounded-full bg-tertiary/10 flex items-center justify-center text-tertiary group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-3xl">database</span>
                  </div>
                  <div className="text-center">
                    <h3 className="font-headline font-bold text-on-surface">Use Demo Data</h3>
                    <p className="text-sm font-body text-outline mt-1">Populate with tactical sample threat logs</p>
                  </div>
                </button>
              </div>

              {/* Success Message Banner */}
              {successMsg && (
                <div className="bg-tertiary-container/20 border border-tertiary-container/30 rounded-lg p-4 flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-tertiary flex items-center justify-center text-on-tertiary shrink-0">
                    <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-tertiary">Upload Successful</p>
                    <p className="text-xs text-on-tertiary-container/80 font-body">{successMsg}</p>
                  </div>
                  <button onClick={() => setSuccessMsg('')} className="text-outline hover:text-on-surface">
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
              )}

              {/* Error Message Banner */}
              {errorMsg && (
                <div className="bg-error-container/20 border border-error-container/30 rounded-lg p-4 flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-error flex items-center justify-center text-on-error shrink-0">
                    <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-error">Upload Error</p>
                    <p className="text-xs text-on-error-container/80 font-body">{errorMsg}</p>
                  </div>
                  <button onClick={() => setErrorMsg('')} className="text-outline hover:text-on-surface">
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
              )}

              {/* Column Mapping Table */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-headline font-semibold text-sm text-on-surface-variant flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">reorder</span>
                    Schema Field Mapping
                  </h4>
                  <span className="text-[10px] font-label font-bold uppercase tracking-tighter bg-surface-container-highest px-2 py-1 rounded text-outline">Detected Auto-Map</span>
                </div>
                <div className="overflow-hidden rounded-xl bg-surface-container-low border border-white/5">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-container-high/50 text-[11px] font-label font-semibold text-outline uppercase tracking-widest border-b border-white/5">
                        <th className="px-6 py-3">Source Key</th>
                        <th className="px-6 py-3">Direction</th>
                        <th className="px-6 py-3">Sentinel Field</th>
                        <th className="px-6 py-3">Data Type</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm font-body cursor-default">
                      <tr className="hover:bg-surface-container-highest/30 transition-colors border-b border-white/5">
                        <td className="px-6 py-4 font-mono text-primary">timestamp_utc</td>
                        <td className="px-6 py-4 text-outline"><span className="material-symbols-outlined text-sm">arrow_forward</span></td>
                        <td className="px-6 py-4 font-semibold text-on-surface">event_time</td>
                        <td className="px-6 py-4"><span className="px-2 py-0.5 rounded bg-surface-container-highest text-[10px] font-bold text-outline uppercase">DateTime</span></td>
                      </tr>
                      <tr className="hover:bg-surface-container-highest/30 transition-colors border-b border-white/5">
                        <td className="px-6 py-4 font-mono text-primary">src_ipv4</td>
                        <td className="px-6 py-4 text-outline"><span className="material-symbols-outlined text-sm">arrow_forward</span></td>
                        <td className="px-6 py-4 font-semibold text-on-surface">source_address</td>
                        <td className="px-6 py-4"><span className="px-2 py-0.5 rounded bg-surface-container-highest text-[10px] font-bold text-outline uppercase">IPv4</span></td>
                      </tr>
                      <tr className="hover:bg-surface-container-highest/30 transition-colors border-b border-white/5">
                        <td className="px-6 py-4 font-mono text-primary">dest_port</td>
                        <td className="px-6 py-4 text-outline"><span className="material-symbols-outlined text-sm">arrow_forward</span></td>
                        <td className="px-6 py-4 font-semibold text-on-surface">destination_port</td>
                        <td className="px-6 py-4"><span className="px-2 py-0.5 rounded bg-surface-container-highest text-[10px] font-bold text-outline uppercase">Integer</span></td>
                      </tr>
                      <tr className="hover:bg-surface-container-highest/30 transition-colors">
                        <td className="px-6 py-4 font-mono text-primary">action_taken</td>
                        <td className="px-6 py-4 text-outline"><span className="material-symbols-outlined text-sm">arrow_forward</span></td>
                        <td className="px-6 py-4 font-semibold text-on-surface">outcome</td>
                        <td className="px-6 py-4"><span className="px-2 py-0.5 rounded bg-surface-container-highest text-[10px] font-bold text-outline uppercase">String</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Footer */}
              <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                <button className="px-6 py-2 rounded-lg font-headline font-semibold text-sm text-on-surface-variant hover:bg-surface-container-highest transition-colors">Reset Mapping</button>
                <button className="px-6 py-2 rounded-lg bg-primary text-on-primary font-headline font-bold text-sm shadow-lg shadow-primary/20 hover:opacity-90 transition-all opacity-50 cursor-not-allowed">Execute Ingestion</button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Bento Grid Insights (Contextual Support) */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {/* Recent Ingestions */}
        <div className="bg-surface-container-low rounded-xl p-6 flex flex-col gap-4 border border-white/5">
          <div className="flex items-center justify-between">
            <h3 className="font-headline font-bold text-on-surface">Recent Ingestions</h3>
            <button className="text-xs text-primary font-semibold hover:underline">View All</button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface-container-high/40 p-4 rounded-lg border-l-2 border-tertiary flex flex-col gap-2">
              <div className="text-[10px] font-label font-bold text-outline uppercase tracking-widest">AWS CloudTrail</div>
              <div className="text-lg font-headline font-bold text-on-surface">4.2 GB</div>
              <div className="text-[10px] text-tertiary flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">check_circle</span> Complete
              </div>
            </div>
            <div className="bg-surface-container-high/40 p-4 rounded-lg border-l-2 border-error flex flex-col gap-2">
              <div className="text-[10px] font-label font-bold text-outline uppercase tracking-widest">Cisco Firepower</div>
              <div className="text-lg font-headline font-bold text-on-surface">812 MB</div>
              <div className="text-[10px] text-error flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">warning</span> Partial Error
              </div>
            </div>
          </div>
        </div>

        {/* AI Mapping Assist */}
        <div className="bg-surface-container-low border border-white/5 rounded-xl p-6 relative overflow-hidden flex flex-col justify-between group">
          <div className="relative z-10 flex flex-col gap-3">
            <h3 className="font-headline font-bold text-on-surface">AI Mapping Assist</h3>
            <p className="text-xs text-outline leading-relaxed group-hover:text-on-surface-variant transition-colors line-clamp-3">Our neural engine has identified 98% confidence in matching your uploaded keys to the OCSF standard.</p>
          </div>
          <div className="mt-4 flex items-center gap-2 relative z-10">
            <div className="h-1.5 flex-1 bg-surface-container-highest rounded-full overflow-hidden">
              <div className="h-full w-[98%] bg-primary shadow-[0_0_8px_rgba(173,198,255,0.6)]"></div>
            </div>
            <span className="text-[10px] font-bold text-primary">98%</span>
          </div>
          <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none group-hover:scale-110 group-hover:opacity-10 transition-all duration-500">
            <span className="material-symbols-outlined text-[120px]">psychology</span>
          </div>
        </div>
      </section>

    </div>
  );
}
