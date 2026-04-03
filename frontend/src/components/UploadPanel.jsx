import React, { useState } from 'react'
import { loadSampleData, uploadLogs } from '../api/client'
import { UploadCloud, Database, ChevronDown, ChevronUp, CheckCircle, AlertCircle } from 'lucide-react'

export default function UploadPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [status, setStatus] = useState(null) // { type: 'loading' | 'success' | 'error', text: '', details: null }

  const handleDemoData = async () => {
    setStatus({ type: 'loading', text: 'Loading synthetic dataset...' })
    try {
      const res = await loadSampleData()
      if (res.data.success) {
        setStatus({ type: 'success', text: res.data.message })
      } else {
        setStatus({ type: 'error', text: res.data.error || 'Failed to load demo data' })
      }
    } catch (err) {
      setStatus({ type: 'error', text: err.response?.data?.error || err.message })
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setStatus({ type: 'loading', text: 'Uploading and parsing logs...' })
    try {
      const res = await uploadLogs(file)
      if (res.data.success) {
        setStatus({
          type: 'success',
          text: `✓ Uploaded ${res.data.rows} rows`,
          details: res.data.mapping
        })
      } else {
        setStatus({ type: 'error', text: res.data.error || 'Failed to map columns' })
      }
    } catch (err) {
      setStatus({ type: 'error', text: err.response?.data?.error || err.message })
    }
    // reset input
    e.target.value = ''
  }

  return (
    <div style={{
      background: '#1e293b',
      borderRadius: '12px',
      border: '1px solid #334155',
      marginBottom: '24px',
      overflow: 'hidden'
    }}>
      {/* Header / Toggle */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '16px 24px', display: 'flex', alignItems: 'center', cursor: 'pointer',
          justifyContent: 'space-between', userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#f8fafc', fontWeight: 600 }}>
          <Database size={20} color="#3b82f6" />
          Data Source Configuration
        </div>
        <div style={{ color: '#94a3b8' }}>
          {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </div>

      {/* Expanded Content */}
      {isOpen && (
        <div style={{ padding: '0 24px 24px 24px', borderTop: '1px solid #334155' }}>
          <div style={{ color: '#94a3b8', fontSize: '14px', marginTop: '16px', marginBottom: '20px' }}>
            Upload real network logs (CSV/JSON/Syslog/AWS Flow) or load the synthetic demo dataset 
            to start searching for threats.
          </div>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {/* Upload Button */}
            <label style={{
              background: '#3b82f6', color: '#fff', padding: '10px 20px', borderRadius: '8px',
              fontWeight: 600, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
              transition: 'background 0.2s'
            }}>
              <UploadCloud size={18} />
              Upload Your Logs
              <input 
                type="file" 
                accept=".csv,.json,.log,.txt" 
                onChange={handleFileUpload} 
                style={{ display: 'none' }} 
              />
            </label>

            {/* Demo Button */}
            <button 
              onClick={handleDemoData}
              style={{
                background: 'transparent', color: '#3b82f6', padding: '10px 20px', borderRadius: '8px',
                border: '1px solid #3b82f6', fontWeight: 600, fontSize: '14px', cursor: 'pointer',
                transition: 'background 0.2s'
              }}
            >
              Use Demo Data
            </button>
          </div>

          {/* Status Feedback */}
          {status && (
            <div style={{ 
              marginTop: '20px', padding: '12px 16px', borderRadius: '8px', fontSize: '14px',
              background: status.type === 'error' ? '#ef444422' : status.type === 'success' ? '#10b98122' : '#f59e0b22',
              color: status.type === 'error' ? '#ef4444' : status.type === 'success' ? '#10b981' : '#f59e0b',
              border: `1px solid ${status.type === 'error' ? '#ef444444' : status.type === 'success' ? '#10b98144' : '#f59e0b44'}`,
              display: 'flex', alignItems: 'flex-start', gap: '10px'
            }}>
              {status.type === 'error' ? <AlertCircle size={18} /> : status.type === 'success' ? <CheckCircle size={18} /> : <div className="loader" style={spinnerStyle} />}
              
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{status.text}</div>
                
                {/* Mapping Report Details */}
                {status.details && Object.keys(status.details).length > 0 && (
                  <div style={{ marginTop: '8px', fontSize: '13px', color: '#cbd5e1' }}>
                    <div style={{ marginBottom: '4px', color: '#94a3b8' }}>Auto-mapped columns:</div>
                    <ul style={{ margin: 0, paddingLeft: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '4px' }}>
                      {Object.entries(status.details).map(([orig, mapped]) => (
                        <li key={orig}>
                          <span style={{ color: '#ef4444' }}>{orig}</span> → <span style={{ color: '#10b981' }}>{mapped}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const spinnerStyle = {
  width: '18px',
  height: '18px',
  border: '2px solid transparent',
  borderTopColor: 'currentColor',
  borderRadius: '50%',
  animation: 'spin 1s linear infinite'
}
