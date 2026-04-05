import React from 'react';

export default function StatCard({ label, value, color = 'blue', icon, subtitle, trend, onClick }) {
  const colors = {
    blue: { iconBg: 'bg-blue-500/10', iconText: 'text-blue-500', borderB: 'border-b-blue-500', cardClass: 'stat-card-blue', defaultIcon: 'security' },
    red: { iconBg: 'bg-red-500/10', iconText: 'text-red-500', borderB: 'border-b-red-500', cardClass: 'stat-card-red', defaultIcon: 'warning' },
    orange: { iconBg: 'bg-orange-500/10', iconText: 'text-orange-500', borderB: 'border-b-orange-500', cardClass: 'stat-card-orange', defaultIcon: 'history' },
    green: { iconBg: 'bg-green-500/10', iconText: 'text-green-500', borderB: 'border-b-green-500', cardClass: 'stat-card-green', defaultIcon: 'task_alt' },
    purple: { iconBg: 'bg-purple-500/10', iconText: 'text-purple-500', borderB: 'border-b-purple-500', cardClass: 'stat-card-purple', defaultIcon: 'bolt' },
  };

  const c = colors[color] || colors.blue;

  return (
    <>
      <style>{`
        .stat-card-blue:hover { border-color: #3b82f6; box-shadow: 0 0 15px rgba(59, 130, 246, 0.3); }
        .stat-card-red:hover { border-color: #ef4444; box-shadow: 0 0 15px rgba(239, 68, 68, 0.3); }
        .stat-card-orange:hover { border-color: #f59e0b; box-shadow: 0 0 15px rgba(245, 158, 11, 0.3); }
        .stat-card-green:hover { border-color: #10b981; box-shadow: 0 0 15px rgba(16, 185, 129, 0.3); }
        .stat-card-purple:hover { border-color: #8b5cf6; box-shadow: 0 0 15px rgba(139, 92, 246, 0.3); }
      `}</style>
      <div 
        onClick={onClick}
        className={`group relative bg-[#1e293b]/60 backdrop-blur-xl border border-[#334155] p-6 rounded-xl transition-all duration-300 ${c.cardClass} border-b-4 ${c.borderB} ${onClick ? 'cursor-pointer' : ''}`}
      >
        <div className="flex justify-between items-start mb-4">
          <div className={`p-2.5 rounded-lg ${c.iconBg} ${c.iconText}`}>
            {typeof icon === 'string' || !icon ? (
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                {icon || c.defaultIcon}
              </span>
            ) : (
              icon
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">{label}</span>
            {trend && (
              <span className={`text-xs ml-2 font-bold ${trend.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
                {trend}
              </span>
            )}
          </div>
        </div>
        <div className="mt-auto">
          <span className="block text-[40px] font-bold font-headline text-slate-50 leading-none">{value}</span>
          {subtitle && (
            <span className="text-xs font-medium text-slate-400 mt-2 block font-body">{subtitle}</span>
          )}
        </div>
      </div>
    </>
  );
}