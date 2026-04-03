/**
 * hooks/usePipeline.js — Custom hook for SOC pipeline state management
 *
 * Extracts all pipeline-related state and logic out of Dashboard.jsx.
 * Handles: alert fetching, status polling, run-analysis trigger.
 *
 * Usage:
 *   const { alerts, running, loading, error, lastRun, handleRunAnalysis, fetchAlerts } = usePipeline()
 */

import { useState, useEffect, useCallback } from 'react'
import { getAlerts, getStatus, runAnalysis } from '../api/client'
import { ALERTS_FETCH_LIMIT, POLL_INTERVAL_MS } from '../constants/alerts'

export function usePipeline() {
  const [alerts, setAlerts]   = useState([])
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError]     = useState(null)
  const [lastRun, setLastRun] = useState(null)

  const fetchAlerts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [alertsRes, statusRes] = await Promise.all([
        getAlerts({ limit: ALERTS_FETCH_LIMIT }),
        getStatus(),
      ])
      setAlerts(alertsRes.data)
      setLastRun(statusRes.data.last_run)
      setRunning(statusRes.data.running)
    } catch {
      setError('Could not reach backend. Is FastAPI running on port 8000?')
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => { fetchAlerts() }, [fetchAlerts])

  // Poll every 3 s while pipeline is running
  useEffect(() => {
    if (!running) return
    const interval = setInterval(fetchAlerts, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [running, fetchAlerts])

  const handleRunAnalysis = async () => {
    try {
      setRunning(true)
      let settings = {}
      try {
        const saved = localStorage.getItem('soc_settings')
        if (saved) settings = JSON.parse(saved)
      } catch (e) {
        console.error('Failed to load settings before analysis', e)
      }
      await runAnalysis(settings)
      setTimeout(fetchAlerts, 1000)
    } catch {
      setError('Failed to start pipeline.')
      setRunning(false)
    }
  }

  return { alerts, loading, running, error, lastRun, fetchAlerts, handleRunAnalysis }
}
