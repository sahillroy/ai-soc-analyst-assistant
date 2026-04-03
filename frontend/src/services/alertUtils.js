/**
 * services/alertUtils.js — Pure utility functions for alert data processing
 *
 * Stateless helpers that transform raw alert arrays into derived values
 * used by Dashboard and its child components.
 *
 * Keeping these out of components makes them easy to unit-test.
 */

import { TOP_IPS_LIMIT } from '../constants/alerts'

/** Count alerts matching a given severity level */
export function countBySeverity(alerts, severity) {
  return alerts.filter(a => a.severity === severity).length
}

/** Return the top-N source IPs by alert frequency */
export function getTopSourceIPs(alerts, limit = TOP_IPS_LIMIT) {
  const counts = alerts.reduce((acc, a) => {
    acc[a.source_ip] = (acc[a.source_ip] || 0) + 1
    return acc
  }, {})

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
}

/** Count distinct non-standalone campaign IDs */
export function getCampaignCount(alerts) {
  return new Set(
    alerts.map(a => a.campaign_id).filter(c => c && c !== 'standalone')
  ).size
}
