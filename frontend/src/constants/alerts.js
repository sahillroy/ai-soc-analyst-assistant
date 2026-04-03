/**
 * constants/alerts.js — App-wide alert constants
 *
 * Single source of truth for severity labels, colours, and tab names.
 * Components import from here instead of hardcoding strings.
 */

export const SEVERITY_LEVELS = ['Critical', 'High', 'Medium', 'Low']

export const SEVERITY_COLORS = {
  Critical: '#a855f7',
  High:     '#ef4444',
  Medium:   '#f97316',
  Low:      '#22c55e',
  blue:     '#3b82f6',
}

export const ALERT_TABS = ['alerts', 'campaigns']

export const STATUS_OPTIONS = ['New', 'Investigating', 'Resolved', 'False Positive']

export const DEFAULT_SETTINGS = {
  bruteforce_threshold:  5,
  port_scan_threshold:   5,
  traffic_spike_z_score: 3.0,
  contamination:         0.05,
  critical_assets:       '10.0.0.5, 192.168.1.1',
}

export const TOP_IPS_LIMIT = 5
export const ALERTS_FETCH_LIMIT = 500
export const POLL_INTERVAL_MS = 3000
