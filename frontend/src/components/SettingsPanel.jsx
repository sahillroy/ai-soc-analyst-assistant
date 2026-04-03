import React, { useState, useEffect } from 'react'
import { X, Settings, Shield, AlertTriangle, Activity, Database, Cpu } from 'lucide-react'

// Default values as requested
const DEFAULT_SETTINGS = {
  bruteforce_threshold: 5,
  port_scan_threshold: 5,
  traffic_spike_z_score: 3.0,
  contamination: 0.05,
  critical_assets: "10.0.0.5, 192.168.1.1"
}

export default function SettingsPanel({ isOpen, onClose }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)

  // Load from localStorage when opened
  useEffect(() => {
    if (isOpen) {
      try {
        const saved = localStorage.getItem('soc_settings')
        if (saved) {
          setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) })
        }
      } catch (e) {
        console.error("Failed to parse settings", e)
      }
    }
  }, [isOpen])

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = () => {
    // Basic validation / type coercion
    const cleanSettings = {
      ...settings,
      bruteforce_threshold: parseInt(settings.bruteforce_threshold, 10) || 5,
      port_scan_threshold: parseInt(settings.port_scan_threshold, 10) || 5,
      traffic_spike_z_score: parseFloat(settings.traffic_spike_z_score) || 3.0,
      contamination: Math.min(0.20, Math.max(0.01, parseFloat(settings.contamination) || 0.05)),
    }
    
    localStorage.setItem('soc_settings', JSON.stringify(cleanSettings))
    onClose(cleanSettings) // pass them back to dashboard to refresh state if needed
  }

  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(4px)', zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#1e293b', border: '1px solid #334155',
        borderRadius: 12, width: '90%', maxWidth: 500,
        padding: 0, overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #334155',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: '#0f172a'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#f8fafc', fontWeight: 600, fontSize: '16px' }}>
            <Settings size={20} color="#3b82f6" />
            Detection Thresholds
          </div>
          <button onClick={() => onClose()} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={inputGroupStyle}>
            <label style={labelStyle}><Shield size={14} /> Critical Asset IPs</label>
            <input 
              type="text" 
              value={settings.critical_assets} 
              onChange={e => handleChange('critical_assets', e.target.value)}
              placeholder="e.g. 10.0.0.5, 192.168.1.1"
              style={inputStyle}
            />
            <div style={helpStyle}>Comma-separated list. Triggers higher risk multipliers.</div>
          </div>

          <div style={inputGroupStyle}>
            <label style={labelStyle}><AlertTriangle size={14} /> Brute Force Threshold</label>
            <input 
              type="number" 
              value={settings.bruteforce_threshold} 
              onChange={e => handleChange('bruteforce_threshold', e.target.value)}
              style={inputStyle}
            />
            <div style={helpStyle}>Failed logins per IP before alerting.</div>
          </div>

          <div style={inputGroupStyle}>
            <label style={labelStyle}><Database size={14} /> Port Scan Threshold</label>
            <input 
              type="number" 
              value={settings.port_scan_threshold} 
              onChange={e => handleChange('port_scan_threshold', e.target.value)}
              style={inputStyle}
            />
            <div style={helpStyle}>Unique ports touched within a short window.</div>
          </div>

          <div style={inputGroupStyle}>
            <label style={labelStyle}><Activity size={14} /> Traffic Spike Z-Score</label>
            <input 
              type="number" step="0.5"
              value={settings.traffic_spike_z_score} 
              onChange={e => handleChange('traffic_spike_z_score', e.target.value)}
              style={inputStyle}
            />
            <div style={helpStyle}>Standard deviations above mean to flag as exfiltration.</div>
          </div>

          <div style={inputGroupStyle}>
            <label style={labelStyle}><Cpu size={14} /> ML Contamination Rate</label>
            <input 
              type="number" step="0.01" min="0.01" max="0.20"
              value={settings.contamination} 
              onChange={e => handleChange('contamination', e.target.value)}
              style={inputStyle}
            />
            <div style={helpStyle}>Expected percentage of anomalies (0.01 - 0.20). Lower is stricter.</div>
          </div>

        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid #334155',
          display: 'flex', justifyContent: 'flex-end', gap: '12px',
          background: '#0f172a'
        }}>
          <button 
            onClick={() => onClose()}
            style={{ ...btnStyle, background: 'transparent', color: '#94a3b8', border: '1px solid #334155' }}
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            style={{ ...btnStyle, background: '#3b82f6', color: '#fff', border: '1px solid #3b82f6' }}
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  )
}

const inputGroupStyle = { display: 'flex', flexDirection: 'column', gap: '6px' }
const labelStyle = { color: '#cbd5e1', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }
const inputStyle = { 
  background: '#0f172a', border: '1px solid #334155', color: '#f8fafc',
  padding: '10px 12px', borderRadius: '6px', fontSize: '14px', outline: 'none'
}
const helpStyle = { color: '#64748b', fontSize: '12px' }
const btnStyle = { padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }
