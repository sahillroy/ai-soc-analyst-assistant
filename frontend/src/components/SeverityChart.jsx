import React, { useMemo, useState } from 'react';

export default function SeverityChart({ alerts = [] }) {
  const [hovered, setHovered] = useState(null);

  const { data, total } = useMemo(() => {
    const counts = { Critical: 0, High: 0, Medium: 0, Low: 0, Normal: 0 };
    alerts.forEach(a => { 
      if (counts[a.severity] !== undefined) {
        counts[a.severity]++; 
      } else {
        counts.Normal++; // If any fall outside known
      }
    });
    
    let currentOffset = 0;
    const total = alerts.length;
    
    // Order matters for donut rendering: Critical -> High -> Medium -> Low -> Normal
    const mapped = [
      { name: 'Critical', value: counts.Critical, color: '#8b5cf6' },
      { name: 'High', value: counts.High, color: '#ef4444' },
      { name: 'Medium', value: counts.Medium, color: '#f59e0b' },
      { name: 'Low', value: counts.Low, color: '#10b981' },
      { name: 'Normal', value: counts.Normal, color: '#475569' }
    ].filter(d => d.value > 0).map(item => {
      const segmentLength = total === 0 ? 0 : (item.value / total) * 251.2;
      const prevOffset = currentOffset;
      currentOffset += segmentLength;
      
      return {
        ...item,
        dashArray: `${segmentLength} 251.2`,
        dashOffset: -prevOffset,
        percentage: total === 0 ? 0 : ((item.value / total) * 100).toFixed(1)
      };
    });

    return { data: mapped, total };
  }, [alerts]);

  return (
    <div className="col-span-12 lg:col-span-5 glass-panel rounded-xl p-8 flex flex-col items-center justify-between min-h-[440px]">
      <div className="w-full flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold text-slate-50 font-headline">Incident Severity</h2>
        <span className="material-symbols-outlined text-slate-500 cursor-help" data-icon="info">info</span>
      </div>

      <div className="relative w-full flex-1 flex flex-col items-center justify-center">
        <div className="relative w-64 h-64 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            {/* Normal Track */}
            <circle className="opacity-20" cx="50" cy="50" fill="transparent" r="40" stroke="#475569" strokeDasharray="251.2" strokeDashoffset="0" strokeWidth="8"></circle>
            
            {/* Segments */}
            {data.map((item, index) => (
              <circle 
                key={item.name}
                cx="50" 
                cy="50" 
                fill="transparent" 
                r="40" 
                stroke={item.color} 
                strokeDasharray={item.dashArray} 
                strokeDashoffset={item.dashOffset} 
                strokeLinecap={item.value > 0 && item.value !== total ? "round" : "butt"} 
                strokeWidth="8"
                style={{ transition: 'stroke-dasharray 0.5s ease, stroke-dashoffset 0.5s ease' }}
                onMouseEnter={() => setHovered(item)}
                onMouseLeave={() => setHovered(null)}
              ></circle>
            ))}
          </svg>

          {/* Center Label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <span className="text-4xl font-extrabold text-white font-headline tracking-tighter">{total}</span>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Alerts</span>
          </div>
        </div>

        {/* Tooltip Mockup => Dynamic */}
        <div className={`absolute top-0 right-0 bg-[#1e293b] border border-white/10 rounded-lg p-3 shadow-2xl z-10 hidden sm:block pointer-events-none transition-opacity duration-200 ${hovered ? 'opacity-100' : 'opacity-0'}`}>
          {hovered && (
            <>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: hovered.color }}></span>
                <span className="text-xs font-semibold text-slate-200">{hovered.name}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold text-white">{hovered.value}</span>
                <span className="text-[10px] text-slate-400">{hovered.percentage}% of total</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="w-full mt-8 flex flex-wrap justify-center gap-2 sm:gap-x-4 px-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#8b5cf6]"></span>
          <span className="text-[11px] font-medium text-slate-400 font-label">Critical</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#ef4444]"></span>
          <span className="text-[11px] font-medium text-slate-400 font-label">High</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#f59e0b]"></span>
          <span className="text-[11px] font-medium text-slate-400 font-label">Medium</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#10b981]"></span>
          <span className="text-[11px] font-medium text-slate-400 font-label">Low</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#475569]"></span>
          <span className="text-[11px] font-medium text-slate-400 font-label">Normal</span>
        </div>
      </div>
    </div>
  );
}