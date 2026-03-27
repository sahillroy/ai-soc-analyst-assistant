import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Shield, AlertTriangle } from 'lucide-react'
import { getAlerts, getStats, getStatus, runAnalysis } from '../api/client'
import StatCard from '../components/StatCard'
import SeverityChart from '../components/SeverityChart'
import AlertTable from '../components/AlertTable'
import AlertTypeChart from "../components/AlertTypeChart";
import CampaignView from "../components/CampaignView";

export default function Dashboard() {
  const [alerts, setAlerts]         = useState([])
  const [loading, setLoading]       = useState(false)
  const [running, setRunning]       = useState(false)
  const [error, setError]           = useState(null)
  const [lastRun, setLastRun]       = useState(null)
  const [view, setView]             = useState("alerts")

  const fetchAlerts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [alertsRes, statusRes] = await Promise.all([
        getAlerts({ limit: 500 }),
        getStatus(),
      ])
      setAlerts(alertsRes.data)
      setLastRun(statusRes.data.last_run)
      setRunning(statusRes.data.running)
    } catch (err) {
      setError('Could not reach backend. Is FastAPI running on port 8000?')
    } finally {
      setLoading(false)
    }
  }, [])

  // Load alerts on mount
  useEffect(() => { fetchAlerts() }, [fetchAlerts])

  // Poll status while pipeline is running
  useEffect(() => {
    if (!running) return
    const interval = setInterval(fetchAlerts, 3000)
    return () => clearInterval(interval)
  }, [running, fetchAlerts])

  const handleRunAnalysis = async () => {
    try {
      setRunning(true)
      await runAnalysis()
      // Wait a moment then start polling
      setTimeout(fetchAlerts, 1000)
    } catch (err) {
      setError('Failed to start pipeline.')
      setRunning(false)
    }
  }

  // Compute stat counts from alerts array
  const count = (sev) => alerts.filter(a => a.severity === sev).length
  const topIPs = Object.entries(
    alerts.reduce((acc, a) => {
      acc[a.source_ip] = (acc[a.source_ip] || 0) + 1
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 5)

  return (
    <div style={{ background: '#0f172a', minHeight: '100vh', padding: 28, color: '#f8fafc', fontFamily: 'Segoe UI, sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, borderBottom: '1px solid #334155', paddingBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Shield size={24} color="#3b82f6" />
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>AI-Powered SOC Command Center</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {lastRun && (
            <span style={{ color: '#475569', fontSize: 13 }}>
              Last run: {new Date(lastRun).toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={handleRunAnalysis}
            disabled={running || loading}
            style={{
              background: running ? '#334155' : '#3b82f6',
              color: '#fff', border: 'none', borderRadius: 6,
              padding: '9px 18px', cursor: running ? 'not-allowed' : 'pointer',
              fontSize: 14, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <RefreshCw size={15} style={{ animation: running ? 'spin 1s linear infinite' : 'none' }} />
            {running ? 'Running...' : 'Run Analysis'}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ background: '#ef444422', border: '1px solid #ef4444', borderRadius: 6, padding: '10px 16px', marginBottom: 20, display: 'flex', gap: 8, alignItems: 'center' }}>
          <AlertTriangle size={16} color="#ef4444" />
          <span style={{ color: '#ef4444', fontSize: 14 }}>{error}</span>
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <StatCard label="Total alerts"    value={alerts.length}   color="blue" />
        <StatCard label="Critical"        value={count('Critical')} color="purple" />
        <StatCard label="High"            value={count('High')}   color="red" />
        <StatCard label="Medium"          value={count('Medium')} color="orange" />
        <StatCard label="Low"             value={count('Low')}    color="green" />
      </div>

      <TimelineChart alerts={alerts} />

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
        <SeverityChart alerts={alerts} />
        <AlertTypeChart alerts={alerts} />
      
                {/* Top suspicious IPs */}
                <div style={{ background: '#1e293b', borderRadius: 8, padding: 20 }}>
                  <h2 style={{ margin: '0 0 16px', fontSize: 16, color: '#f8fafc' }}>Top Source IPs</h2>
                  {topIPs.length === 0
                    ? <div style={{ color: '#475569' }}>No data yet</div>
                    : topIPs.map(([ip, count]) => (
                      <div key={ip} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontFamily: 'monospace', color: '#94a3b8', fontSize: 13 }}>{ip}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: Math.max(30, (count / (topIPs[0]?.[1] || 1)) * 120),
                            height: 6, background: '#ef4444', borderRadius: 3,
                          }} />
                          <span style={{ color: '#f8fafc', fontSize: 13, minWidth: 24 }}>{count}</span>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>
      
            <div>
        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
          {['alerts', 'campaigns'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '8px 18px',
                borderRadius: 6,
                border: 'none',
                background: activeTab === tab ? '#3b82f6' : '#1e293b',
                color: activeTab === tab ? '#fff' : '#94a3b8',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
                textTransform: 'capitalize',
              }}
            >
              {tab}
      
        {/* Campaign count badge */}
        {tab === 'campaigns' && (
          <span style={{
            marginLeft: 8,
            background: '#ffffff22',
            borderRadius: 10,
            padding: '1px 7px',
            fontSize: 12
          }}>
            {
              [...new Set(
                alerts
                  .map(a => a.campaign_id)
                  .filter(c => c && c !== 'standalone')
              )].length
            }
          </span>
        )}
      </button>
    ))}
  </div>

  {/* Conditional views */}
  {activeTab === 'alerts' && <AlertTable alerts={alerts} />}
  {activeTab === 'campaigns' && <CampaignView alerts={alerts} />}
</div>

      {/* CSS for spinner */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}