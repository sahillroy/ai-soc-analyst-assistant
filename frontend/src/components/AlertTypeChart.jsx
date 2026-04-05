import React, { useMemo } from 'react';

export default function AlertTypeChart({ alerts = [] }) {
  const data = useMemo(() => {
    const counts = {};
    alerts.forEach(a => {
      const type = a.alert_type || 'Unknown';
      counts[type] = (counts[type] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // top 5
  }, [alerts]);

  const maxVal = data[0]?.value || 1;

  const colorSchemes = [
    { text: 'text-violet-400', gradient: 'from-violet-600/20 to-violet-500', glow: 'bg-violet-400' },
    { text: 'text-red-400', gradient: 'from-red-600/20 to-red-500', glow: 'bg-red-400' },
    { text: 'text-amber-400', gradient: 'from-amber-600/20 to-amber-500', glow: 'bg-amber-400' },
    { text: 'text-emerald-400', gradient: 'from-emerald-600/20 to-emerald-500', glow: 'bg-emerald-400' },
    { text: 'text-slate-400', gradient: 'from-slate-700/20 to-slate-600', glow: 'bg-slate-500' }
  ];

  return (
    <>
      <style>{`
        .glass-panel {
          background: #1e293b;
          border: 1px solid rgba(51, 65, 85, 0.4);
        }
      `}</style>
      <section className="glass-panel rounded-2xl p-6 shadow-2xl shadow-black/60 relative overflow-hidden" style={{ minHeight: '440px' }}>
        {/* Tonal Background Layering */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[100px] -z-10 rounded-full"></div>
        
        <div className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-primary rounded-full"></div>
            <h2 className="text-lg font-semibold text-slate-50 font-headline">Alert Type Volume</h2>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1 text-[11px] font-bold uppercase tracking-widest rounded-lg bg-surface-container-high text-slate-300 border border-white/5 hover:bg-surface-container-highest transition-colors">24H</button>
            <button className="px-3 py-1 text-[11px] font-bold uppercase tracking-widest rounded-lg text-slate-500 hover:text-slate-300 transition-colors">7D</button>
          </div>
        </div>
        
        {/* Custom Visual Bar Chart Simulation */}
        <div className="space-y-6 relative z-10">
          {data.length > 0 ? (
            data.map((item, index) => {
              const scheme = colorSchemes[index] || colorSchemes[colorSchemes.length - 1];
              const widthPct = Math.max(2, (item.value / maxVal) * 100);
              return (
                <div key={item.name} className="group">
                  <div className="flex justify-between items-end mb-2 px-1">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest truncate max-w-[200px]" title={item.name}>{item.name}</span>
                    <span className={`text-sm font-headline font-bold ${scheme.text}`}>{item.value}</span>
                  </div>
                  <div className="h-10 bg-slate-900/40 rounded-full overflow-hidden border border-white/5 relative">
                    <div 
                      className={`h-full bg-gradient-to-r ${scheme.gradient} rounded-full transition-all duration-700 ease-out group-hover:brightness-110`} 
                      style={{ width: `${widthPct}%` }}
                    >
                      <div className={`absolute inset-y-0 right-0 w-1 ${scheme.glow} blur-[2px]`}></div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-500 text-sm font-semibold">
              No vector data available
            </div>
          )}
        </div>
        
        {/* Metadata Footer */}
        <div className="mt-10 pt-6 border-t border-white/5 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-tighter">Engine status: Operational</span>
          </div>
          <div className="text-[11px] text-slate-500 font-mono">Last update: T-{new Date().toLocaleTimeString('en-US', { hour12: false })}</div>
        </div>
      </section>
    </>
  );
}