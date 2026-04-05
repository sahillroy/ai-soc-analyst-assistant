import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getAlerts, getStatus, runAnalysis, uploadLogs, loadSampleData } from '../api/client';
import AlertTable from '../components/AlertTable';
import AlertTypeChart from '../components/AlertTypeChart';
import SeverityChart from '../components/SeverityChart';
import TimelineChart from '../components/TimelineChart';
import CampaignView from '../components/CampaignView';
import UploadPanel from '../components/UploadPanel';
import IncidentModal from '../components/IncidentModal';
import ThreatMap from '../components/ThreatMap';

export default function Dashboard() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [lastRun, setLastRun] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('alerts');
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [runMessage, setRunMessage] = useState(''); // 'starting' | 'running' | 'done' | ''
  const [viewMode, setViewMode] = useState('live'); // 'live' | 'history'

  const fetchData = async () => {
    setLoading(true);
    try {
      const [alertsRes, statusRes] = await Promise.all([
        getAlerts({ limit: 500 }),
        getStatus()
      ]);
      setAlerts(alertsRes.data);
      setRunning(statusRes.data.running || statusRes.data.analysis_in_progress);
      setLastRun(statusRes.data.last_run || statusRes.data.last_analysis_time || new Date().toISOString());
    } catch (err) {
      console.error(err);
      setError('Connection to SOC backend failed');
    } finally {
      setLoading(false);
    }
  };

  // On mount: fetch once, then poll every 15s only in live mode
  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      if (!running && viewMode === 'live') fetchData();
    }, 15000);
    return () => clearInterval(interval);
  }, [viewMode]);

  // When running===true: poll status every 3s, re-fetch alerts when done
  useEffect(() => {
    if (!running) return;
    setRunMessage('running');
    const poll = setInterval(async () => {
      try {
        const statusRes = await getStatus();
        const stillRunning = statusRes.data.running || statusRes.data.analysis_in_progress;
        if (!stillRunning) {
          setRunning(false);
          setLastRun(statusRes.data.last_run || new Date().toISOString());
          setRunMessage('done');
          await fetchData();
          // Clear 'done' message after 4 seconds
          setTimeout(() => setRunMessage(''), 4000);
          clearInterval(poll);
        }
      } catch (e) {
        console.error('Status poll error:', e);
      }
    }, 3000);
    return () => clearInterval(poll);
  }, [running]);

  const handleRunAnalysis = async () => {
    if (running) return; // guard against double-click
    setError(null);
    setRunMessage('starting');
    setRunning(true);
    try {
      await runAnalysis({
        bruteforce_threshold: 10,
        port_scan_threshold: 20,
        traffic_spike_z_score: 3.0,
        ml_contamination: 0.1
      });
      // running=true → polling useEffect takes over from here
    } catch (e) {
      const status = e?.response?.status;
      if (status === 409) {
        // Backend is already running — keep running=true so polling continues
        console.warn('Analysis already in progress (409). Monitoring existing job.');
        setRunMessage('running'); // already running, polling will catch completion
      } else {
        setError('Analysis failed to start. Please try again.');
        setRunning(false);
        setRunMessage('');
      }
    }
  };

  // Accepts a file object directly (compatible with UploadPanel's onUpload prop)
  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      await uploadLogs(file);
      await fetchData();
    } catch (err) {
      console.error(err);
      setError('Failed to upload log file');
    } finally {
      setUploading(false);
    }
  };

  const handleDemoData = async () => {
    setUploading(true);
    try {
      await loadSampleData();
      await fetchData();
    } catch (err) {
      console.error(err);
      setError('Failed to load sample data');
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('soc_auth_token');
    navigate('/');
  };

  const criticalCount = alerts.filter(a => a.severity === 'Critical').length;

  return (
    <>
      <style>{`
        body { background-color: #0b1326; color: #dae2fd; font-family: 'Inter', sans-serif; }
        .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
        .glass-panel { background: rgba(30, 41, 59, 0.6); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.05); }
        .data-glow { box-shadow: 0 0 20px rgba(59, 130, 246, 0.1); }
      `}</style>

      {/* TopNavBar */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-slate-900/60 backdrop-blur-xl flex justify-between items-center px-6 h-16 shadow-2xl shadow-black/40">
        <div className="flex items-center gap-8">
          <span className="text-xl font-bold tracking-tight text-slate-50 font-headline">Sentinel Core</span>
          <div className="hidden md:flex gap-6 items-center">
            <Link className="font-manrope text-sm tracking-tight text-blue-400 border-b-2 border-blue-500 pb-2" to="/dashboard">Dashboard</Link>
            <Link className="font-manrope text-sm tracking-tight text-slate-400 hover:text-slate-200 transition-colors" to="/incidents">Incidents</Link>
            <Link className="font-manrope text-sm tracking-tight text-slate-400 hover:text-slate-200 transition-colors" to="/campaigns">Campaigns</Link>
            <Link className="font-manrope text-sm tracking-tight text-slate-400 hover:text-slate-200 transition-colors" to="/intelligence">Intelligence</Link>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative hidden lg:block">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">search</span>
            <input className="bg-slate-950 border-none rounded-full pl-10 pr-4 py-1.5 text-xs w-64 focus:ring-1 focus:ring-blue-500/50 transition-all text-on-surface" placeholder="Search signals..." type="text"/>
          </div>
          <button className="material-symbols-outlined text-slate-400 hover:text-slate-200 p-2 hover:bg-white/5 rounded-full transition-colors">notifications</button>
          <button onClick={handleLogout} title="Logout" className="material-symbols-outlined text-slate-400 hover:text-slate-200 p-2 hover:bg-white/5 rounded-full transition-colors">logout</button>
          <div className="h-8 w-8 rounded-full bg-blue-600/20 border border-blue-500/30 overflow-hidden">
            <img className="w-full h-full object-cover" data-alt="professional portrait of a cybersecurity analyst" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCA46i-m7N7bv3l7YyF27usukHQUpjh_QD9oYW18iCOs5XZUCD23sMyFtXmMlVjG9SRr2FzaaDnZv0IyMuGgVThOukr3_zO1qguH8ud7KnG5ro12XKAQ8bZqDA14j9q44bSaaBzotpOH7RyBWsuFPNUUtVkh5XwxXp_8YM-2qsR4xDdjsn2h_6Hi8HovPWKnHGMVsD4FbbsL-G8DdXjGAuYEcxj8tRl1C6Kua_RaJoteLApWP4Ml5RnPAMxLA_zqe_3ZAzkR1qQYemC" alt="User Profile"/>
          </div>
        </div>
      </nav>

      {/* SideNavBar */}
      <aside className="fixed left-0 top-16 h-[calc(100vh-64px)] w-64 border-r border-slate-800 bg-slate-900 hidden lg:flex flex-col py-4">
        <div className="px-6 mb-8 flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-blue-600/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-blue-500">security</span>
          </div>
          <div>
            <div className="text-blue-500 font-bold font-headline text-sm uppercase tracking-wider">Tactical Ops</div>
            <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest">{running ? 'Processing...' : 'Active Session'}</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          <Link className="flex items-center gap-3 px-4 py-3 bg-blue-600/10 text-blue-400 border-r-4 border-blue-500 font-manrope text-xs font-semibold uppercase tracking-widest scale-95 transition-transform duration-200" to="/dashboard">
            <span className="material-symbols-outlined">grid_view</span> Overview
          </Link>
          <Link className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 font-manrope text-xs font-semibold uppercase tracking-widest transition-colors" to="/threat-hunting">
            <span className="material-symbols-outlined">radar</span> Threat Hunting
          </Link>
          <Link className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 font-manrope text-xs font-semibold uppercase tracking-widest transition-colors" to="/logs">
            <span className="material-symbols-outlined">database</span> Log Explorer
          </Link>
          <Link className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 font-manrope text-xs font-semibold uppercase tracking-widest transition-colors" to="/automation">
            <span className="material-symbols-outlined">terminal</span> Automation
          </Link>
          <Link className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 font-manrope text-xs font-semibold uppercase tracking-widest transition-colors" to="/reporting">
            <span className="material-symbols-outlined">description</span> Reporting
          </Link>
        </nav>
        <div className="px-6 py-4">
          <button onClick={handleRunAnalysis} disabled={running} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 disabled:opacity-50">
            <span className="material-symbols-outlined text-sm">{running ? 'hourglass_empty' : 'add'}</span>
            {running ? 'Running...' : 'New Investigation'}
          </button>
        </div>
      </aside>

      {/* Main Canvas */}
      <main className="lg:ml-64 pt-24 px-8 pb-12 min-h-screen">
        {/* Header & Action Row */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <h1 className="text-3xl font-extrabold font-headline text-slate-50 tracking-tight mb-2">Operations Dashboard</h1>
            <p className="text-slate-400 text-sm max-w-lg">Real-time telemetrics and anomaly detection across distributed infrastructure. System status: <span className={running ? "text-blue-400" : "text-tertiary"}>{running ? 'Processing' : 'Operational'}</span>{lastRun && ` (Last run: ${new Date(lastRun).toLocaleTimeString()})`}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex bg-slate-900/80 p-1 rounded-xl border border-white/5">
              <button
                onClick={() => { console.log('[Dashboard] Live View clicked'); setViewMode('live'); fetchData(); }}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${viewMode === 'live' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >Live View</button>
              <button
                onClick={() => { console.log('[Dashboard] History clicked'); setViewMode('history'); }}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${viewMode === 'history' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >History</button>
            </div>
            <button onClick={() => { console.log('[Dashboard] Refresh clicked'); setViewMode('live'); setError(null); fetchData(); }} className="material-symbols-outlined text-slate-400 hover:text-slate-200 p-2 bg-slate-900 border border-white/5 rounded-xl">refresh</button>
          </div>
        </header>

        {error && (
          <div className="bg-error/10 border border-error/50 text-error p-4 rounded-xl mb-6 text-sm flex items-center gap-3">
            <span className="material-symbols-outlined">warning</span> {error}
            <button onClick={() => setError(null)} className="ml-auto material-symbols-outlined text-sm">close</button>
          </div>
        )}

        {/* Analysis run status banner */}
        {runMessage === 'starting' && (
          <div className="bg-blue-500/10 border border-blue-500/30 text-blue-400 p-4 rounded-xl mb-6 text-sm flex items-center gap-3">
            <span className="material-symbols-outlined animate-spin">autorenew</span>
            Initiating AI analysis pipeline...
          </div>
        )}
        {runMessage === 'running' && (
          <div className="bg-blue-500/10 border border-blue-500/30 text-blue-400 p-4 rounded-xl mb-6 text-sm flex items-center gap-3">
            <span className="material-symbols-outlined animate-pulse">radar</span>
            Analysis in progress — polling for results every 3 seconds...
          </div>
        )}
        {runMessage === 'done' && (
          <div className="bg-tertiary/10 border border-tertiary/30 text-tertiary p-4 rounded-xl mb-6 text-sm flex items-center gap-3">
            <span className="material-symbols-outlined">check_circle</span>
            Analysis complete — dashboard updated with latest results.
            <button onClick={() => setRunMessage('')} className="ml-auto material-symbols-outlined text-sm">close</button>
          </div>
        )}

        {/* Stat Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {/* Active Alerts */}
          <div className="bg-surface-container-low p-6 rounded-xl border-b-2 border-[#8b5cf6] relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-[#8b5cf6]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 rounded-full bg-[#8b5cf6]/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-[#8b5cf6]" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
              </div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Severity: Critical</span>
            </div>
            <div className="text-4xl font-bold font-headline text-slate-50 mb-1">{alerts.length}</div>
            <div className="text-xs font-semibold text-[#8b5cf6] uppercase tracking-widest">Active Alerts</div>
            <div className="mt-4 flex items-center gap-2 text-[10px] text-slate-500">
              <span className="text-tertiary-fixed-dim flex items-center">{criticalCount} Critical</span> vs last hour
            </div>
          </div>
          {/* Blocked Traffic */}
          <div className="bg-surface-container-low p-6 rounded-xl border-b-2 border-primary relative overflow-hidden group">
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>block</span>
              </div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Filtering</span>
            </div>
            <div className="text-4xl font-bold font-headline text-slate-50 mb-1">8.2k</div>
            <div className="text-xs font-semibold text-primary uppercase tracking-widest">Blocked Traffic</div>
            <div className="mt-4 flex items-center gap-2 text-[10px] text-slate-500">
              <span className="text-tertiary-fixed-dim flex items-center">+3%</span> steady state
            </div>
          </div>
          {/* Active Users */}
          <div className="bg-surface-container-low p-6 rounded-xl border-b-2 border-tertiary relative overflow-hidden group">
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 rounded-full bg-tertiary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
              </div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Identity</span>
            </div>
            <div className="text-4xl font-bold font-headline text-slate-50 mb-1">456</div>
            <div className="text-xs font-semibold text-tertiary uppercase tracking-widest">Concurrent Users</div>
            <div className="mt-4 flex items-center gap-2 text-[10px] text-slate-500">
              <span className="text-error flex items-center">-2%</span> from baseline
            </div>
          </div>
          {/* Campaign Health */}
          <div className="bg-surface-container-low p-6 rounded-xl border-b-2 border-secondary relative overflow-hidden group">
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>target</span>
              </div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Phishing</span>
            </div>
            <div className="text-4xl font-bold font-headline text-slate-50 mb-1">12</div>
            <div className="text-xs font-semibold text-secondary uppercase tracking-widest">Live Campaigns</div>
            <div className="mt-4 flex items-center gap-2 text-[10px] text-slate-500">
              <span className="text-slate-400">0 critical breaches</span>
            </div>
          </div>
        </div>

        {/* Upload & Map Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12 items-stretch">
          {/* Upload Panel */}
          <div className="flex flex-col h-full">
            <UploadPanel
              onUpload={handleUpload}
              onDemoData={handleDemoData}
              uploading={uploading}
            />
          </div>
          {/* Threat Map */}
          <div className="h-full bg-surface-container-low rounded-xl border border-white/5 overflow-hidden relative flex flex-col justify-center">
            <div className="absolute top-4 left-6 z-20">
              <h3 className="text-sm font-bold font-headline text-slate-50 mb-1">Global Ingress Heatmap</h3>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Active Sources</span>
              </div>
            </div>
            {/* Container: height auto-set by ThreatMap internal 2:1 aspect ratio */}
            <div className="w-full pt-14">
              <ThreatMap alerts={alerts} />
            </div>
          </div>
        </div>

        {/* Tabbed Section: Timeline / Campaigns / Charts */}
        <div className="bg-surface-container-low rounded-xl border border-white/5 overflow-hidden mb-12">
          <div className="flex items-center border-b border-white/5 px-6">
            <button
              onClick={() => setActiveTab('alerts')}
              className={`px-6 py-4 text-xs font-bold uppercase tracking-widest transition-colors ${activeTab === 'alerts' ? 'text-blue-400 border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-300'}`}
            >Alert Timeline</button>
            <button
              onClick={() => setActiveTab('campaigns')}
              className={`px-6 py-4 text-xs font-bold uppercase tracking-widest transition-colors ${activeTab === 'campaigns' ? 'text-blue-400 border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-300'}`}
            >Campaign History</button>
            <button
              onClick={() => setActiveTab('table')}
              className={`px-6 py-4 text-xs font-bold uppercase tracking-widest transition-colors ${activeTab === 'table' ? 'text-blue-400 border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-300'}`}
            >Alert Table</button>
          </div>
          <div className="p-8">
            {activeTab === 'alerts' && <TimelineChart alerts={alerts} />}
            {activeTab === 'campaigns' && <CampaignView alerts={alerts} />}
            {activeTab === 'table' && (
              <AlertTable alerts={alerts} onSelectAlert={setSelectedAlert} />
            )}
          </div>
        </div>

        {/* Chart Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <div className="bg-surface-container-low rounded-xl border border-white/5 p-6">
            <SeverityChart alerts={alerts} />
          </div>
          <div className="bg-surface-container-low rounded-xl border border-white/5 p-6">
            <AlertTypeChart alerts={alerts} />
          </div>
        </div>
      </main>

      {/* Incident Modal */}
      {selectedAlert && (
        <IncidentModal
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
        />
      )}

      {/* FAB for quick action */}
      <button
        onClick={handleRunAnalysis}
        disabled={running}
        className="fixed bottom-8 right-8 w-14 h-14 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 z-40">
        <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
          {running ? 'hourglass_empty' : 'bolt'}
        </span>
      </button>
    </>
  );
}
