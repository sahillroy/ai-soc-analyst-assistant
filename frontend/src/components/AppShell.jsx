import React, { useState, useEffect } from 'react';
import { getAlerts, getStatus, runAnalysis, runAnalysisWithLogs, uploadLogs, loadSampleData } from '../api/client';
import { useNavigate, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import OverviewPage from '../pages/OverviewPage';
import IncidentsPage from '../pages/IncidentsPage';
import CampaignsPage from '../pages/CampaignsPage';
import IntelligencePage from '../pages/IntelligencePage';
import LogExplorerPage from '../pages/LogExplorerPage';
import AutomationPage from '../pages/AutomationPage';
import ReportingPage from '../pages/ReportingPage';

// Note: Dashboard.jsx is still present in the codebase but we will mock the content dynamically here until the individual pages are made in step 2.

export default function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();

  const [selectedSeverity, setSelectedSeverity] = useState(null);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  
  // App-level data
  const [alerts, setAlerts] = useState([]);
  const [uploadedLogs, setUploadedLogs] = useState(() => {
    try {
      const saved = localStorage.getItem('soc_uploaded_logs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const displayData = uploadedLogs.length > 0 ? uploadedLogs : alerts;

  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [lastRun, setLastRun] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  // Dashboard-specific temporary state (runMessage, viewMode)
  const [runMessage, setRunMessage] = useState(''); 
  const [viewMode, setViewMode] = useState('live'); 

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

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      if (!running && viewMode === 'live') fetchData();
    }, 15000);
    return () => clearInterval(interval);
  }, [viewMode]);

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
    if (running) return; 
    setError(null);
    setRunMessage('starting');
    setRunning(true);
    try {
      const settings = {
        bruteforce_threshold: 10,
        port_scan_threshold: 20,
        traffic_spike_z_score: 3.0,
        ml_contamination: 0.1
      };
      console.log('[Sentinel] uploadedLogs count:', uploadedLogs.length);
      if (uploadedLogs.length > 0) {
        const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const queryParams = new URLSearchParams(settings).toString();
        const response = await fetch(`${baseURL}/api/run-analysis?${queryParams}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ logs: uploadedLogs })
        });
        if (!response.ok) {
           const errData = await response.json().catch(() => ({}));
           throw { response: { status: response.status, data: errData } };
        }
      } else {
        await runAnalysis(settings);
      }
      setUploadedLogs([]);
      localStorage.removeItem('soc_uploaded_logs');
      fetchData();
      navigate('/dashboard');
    } catch (e) {
      const status = e?.response?.status;
      if (status === 409) {
        console.warn('Analysis already in progress (409). Monitoring existing job.');
        setRunMessage('running');
      } else {
        setError('Analysis failed to start. Please try again.');
        setRunning(false);
        setRunMessage('');
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('soc_auth_token');
    navigate('/');
  };

  // --- Handlers for TopNav/Sidebar styling ---
  const navItemClass = (pageTarget) => {
    const isActive = location.pathname.includes(pageTarget);
    return `flex items-center gap-[10px] px-[16px] py-[10px] font-semibold text-[13px] uppercase tracking-[0.05em] cursor-pointer rounded-[6px] transition-colors ${
      isActive 
        ? 'bg-[#1e40af22] text-[#3b82f6] border-l-[3px] border-[#3b82f6] pl-[13px]' // adjusted padding for border
        : 'text-[#64748b] hover:text-[#94a3b8] hover:bg-[#1e293b]'
    }`;
  };

  const topTabClass = (pageTarget) => {
    const isActive = location.pathname.includes(pageTarget);
    return `text-[13px] font-semibold py-[4px] cursor-pointer transition-colors ${
      isActive 
        ? 'text-[#3b82f6] border-b-[2px] border-[#3b82f6]' 
        : 'text-[#64748b] hover:text-[#94a3b8]'
    }`;
  };

  return (
    <div style={{ backgroundColor: '#0f172a', minHeight: '100vh', color: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
      <style>{`
        body { background-color: #0f172a; margin: 0; }
        .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
      `}</style>
      
      {/* Top Nav */}
      <nav style={{ backgroundColor: '#0d1526', height: '52px', borderBottom: '1px solid #1e293b' }} className="fixed top-0 w-full z-50 flex justify-between items-center px-6">
        <div className="flex items-center gap-8">
          <span style={{ fontWeight: 700, fontSize: '16px', color: '#ffffff' }}>Sentinel Core</span>
          <div className="hidden md:flex" style={{ gap: '24px' }}>
            <div className={topTabClass('dashboard')} onClick={() => { navigate('/dashboard'); setSelectedSeverity(null); setSelectedCampaign(null); }}>Dashboard</div>
            <div className={topTabClass('incidents')} onClick={() => { navigate('/incidents'); setSelectedSeverity(null); setSelectedCampaign(null); }}>Incidents</div>
            <div className={topTabClass('campaigns')} onClick={() => navigate('/campaigns')}>Campaigns</div>
            <div className={topTabClass('intelligence')} onClick={() => navigate('/intelligence')}>Intelligence</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative hidden lg:block">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm" style={{ fontSize: 16 }}>search</span>
            <input className="bg-[#0f172a] border border-[#1e293b] rounded-full pl-9 pr-4 py-1 text-xs w-64 text-[#f8fafc] outline-none focus:border-[#3b82f6]/50" placeholder="Search signals..." type="text"/>
          </div>
          <button className="material-symbols-outlined text-slate-400 hover:text-slate-200">notifications</button>
          
          <div className="flex items-center gap-3 pl-4 border-l border-[#1e293b]">
            <div className="text-xs text-slate-400 hidden sm:block">analyst@sentinel.local</div>
            <button onClick={handleLogout} title="Sign out" className="material-symbols-outlined text-slate-400 hover:text-red-400 transition-colors" style={{ fontSize: 20 }}>logout</button>
          </div>
        </div>
      </nav>

      {/* Sidebar */}
      <aside style={{ backgroundColor: '#0d1526', width: '220px' }} className="fixed left-0 top-[52px] h-[calc(100vh-52px)] border-r border-[#1e293b] hidden lg:flex flex-col py-6">
        <div className="px-4 mb-8 flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-blue-600/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-blue-500" style={{ fontSize: 18 }}>security</span>
          </div>
          <div>
            <div className="text-blue-500 font-bold text-xs uppercase tracking-wider">Tactical Ops</div>
            <div className="text-[9px] text-slate-500 font-semibold uppercase tracking-widest">{running ? 'Processing...' : 'Active Session'}</div>
          </div>
        </div>
        
        <nav className="flex-1 px-3 flex flex-col gap-1">
          <div className={navItemClass('dashboard')} onClick={() => { navigate('/dashboard'); setSelectedSeverity(null); setSelectedCampaign(null); }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>grid_view</span> Overview
          </div>
          <div className={navItemClass('incidents')} onClick={() => { navigate('/incidents'); setSelectedSeverity(null); setSelectedCampaign(null); }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>radar</span> Threat Hunting
          </div>
          <div className={navItemClass('log-explorer')} onClick={() => navigate('/log-explorer')}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>database</span> Log Explorer
          </div>
          <div className={navItemClass('automation')} onClick={() => navigate('/automation')}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>terminal</span> Automation
          </div>
          <div className={navItemClass('reporting')} onClick={() => navigate('/reporting')}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>description</span> Reporting
          </div>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="lg:ml-[220px] pt-[52px]">
        <div style={{ padding: '28px' }}>
          <Routes>
            <Route path="/dashboard" element={
              <OverviewPage 
                alerts={displayData}
                loading={loading}
                running={running}
                lastRun={lastRun}
                handleRunAnalysis={handleRunAnalysis}
                setActivePage={(page) => navigate('/' + page)}
                setSelectedSeverity={setSelectedSeverity}
              />
            } />
            <Route path="/incidents" element={
              <IncidentsPage alerts={displayData} selectedSeverity={selectedSeverity} selectedCampaign={selectedCampaign} />
            } />
            <Route path="/campaigns" element={
              <CampaignsPage alerts={displayData} setActivePage={(page) => navigate('/' + page)} setSelectedCampaign={setSelectedCampaign} />
            } />
            <Route path="/intelligence" element={
              <IntelligencePage alerts={displayData} running={running} setActivePage={(page) => navigate('/' + page)} />
            } />
            <Route path="/log-explorer" element={
              <LogExplorerPage 
                alerts={displayData}
                handleRunAnalysis={handleRunAnalysis}
                handleUpload={async (file) => {
                  if (!file) return;
                  setUploading(true);
                  try {
                    const res = await uploadLogs(file);
                    if (res.data && res.data.data) {
                      setUploadedLogs(res.data.data);
                      localStorage.setItem('soc_uploaded_logs', JSON.stringify(res.data.data));
                    }
                    await fetchData();
                  } catch (err) {
                    console.error(err);
                    setError('Failed to upload log file');
                  } finally {
                    setUploading(false);
                  }
                }}
                handleDemoData={async () => {
                  setUploading(true);
                  try {
                    const res = await loadSampleData();
                    if (res.data && res.data.data) {
                      setUploadedLogs(res.data.data);
                      localStorage.setItem('soc_uploaded_logs', JSON.stringify(res.data.data));
                    }
                    await fetchData();
                  } catch (err) {
                    console.error(err);
                    setError('Failed to load sample data');
                  } finally {
                    setUploading(false);
                  }
                }}
                uploading={uploading}
                running={running}
              />
            } />
            <Route path="/automation" element={<AutomationPage setActivePage={(page) => navigate('/' + page)} />} />
            <Route path="/reporting" element={<ReportingPage setActivePage={(page) => navigate('/' + page)} />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>

        </div>
      </main>
    </div>
  );
}
