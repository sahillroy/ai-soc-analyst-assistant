import { useState, useRef, useEffect } from 'react';
import {
  Shield, Ban, Wifi, Lock, Bell, Camera, Database, Zap,
  Play, SkipForward, Trash2, Terminal, ChevronRight, Target
} from 'lucide-react';

// ── Playbook Data ────────────────────────────────────────────────────────────
const PLAYBOOKS = [
  {
    id: 'brute_force',
    name: 'BRUTE_FORCE_RESPONSE',
    trigger: 'Brute Force Attempt',
    severity: 'Critical',
    description: 'Immediately contain brute force attacks by blocking the source, invalidating sessions, and escalating to Tier-2.',
    actions: [
      { id: 'block_ip',    name: 'Block Source IP',   icon: Ban,      desc: 'Add source IP to firewall deny list across all nodes',        result: 'Firewall rule ACL-{rand} created. IP blacklisted across 3 nodes.' },
      { id: 'reset_auth',  name: 'Reset Auth Tokens', icon: Lock,     desc: 'Invalidate all active session tokens for affected accounts',  result: 'Session tokens invalidated. Re-auth required for affected accounts.' },
      { id: 'alert_t2',   name: 'Alert Tier-2',      icon: Bell,     desc: 'Create escalation ticket and notify Tier-2 SOC analyst',     result: 'Escalation ticket #SOC-{rand} created and assigned to Tier-2.' },
    ],
  },
  {
    id: 'port_scan',
    name: 'PORT_SCAN_CONTAINMENT',
    trigger: 'Port Scanning Activity',
    severity: 'Medium',
    description: 'Isolate the scanning host, enable deep packet inspection, and forward the event to the SIEM for correlation.',
    actions: [
      { id: 'isolate',     name: 'Isolate Host',     icon: Shield,   desc: 'Quarantine host and suspend network access pending review',   result: 'Host quarantined. Network access suspended pending review.' },
      { id: 'dpi',         name: 'Enable DPI',        icon: Wifi,     desc: 'Enable deep packet inspection on all interfaces',             result: 'Deep packet inspection enabled on interface eth0.' },
      { id: 'log_siem',   name: 'Log to SIEM',       icon: Database, desc: 'Forward the event to SIEM and trigger correlation rules',     result: 'Event forwarded to SIEM. Correlation rule triggered.' },
    ],
  },
  {
    id: 'exfil',
    name: 'EXFIL_INTERCEPT',
    trigger: 'Traffic Spike / Possible Exfiltration',
    severity: 'Medium',
    description: 'Throttle suspicious outbound traffic, capture packets for forensic analysis, and freeze the implicated account.',
    actions: [
      { id: 'throttle',    name: 'Throttle Bandwidth', icon: Zap,      desc: 'Apply 1 Mbps rate limit on source IP outbound traffic',       result: 'Rate limit applied: 1Mbps cap on source IP.' },
      { id: 'capture',     name: 'Capture Packets',    icon: Camera,   desc: 'Start PCAP capture on the suspicious network session',        result: 'PCAP capture started. File: capture_{ts}.pcap' },
      { id: 'freeze_acc', name: 'Freeze Account',     icon: Lock,     desc: 'Suspend account access and notify IT security team',          result: 'Account access suspended. IT notified via ticket.' },
    ],
  },
  {
    id: 'anomaly',
    name: 'ANOMALY_INVESTIGATION',
    trigger: 'Behavioral Anomaly',
    severity: 'Low',
    description: 'Snapshot system state for forensic analysis, verify file integrity, and notify the on-call analyst.',
    actions: [
      { id: 'snapshot',    name: 'Snapshot System',   icon: Database, desc: 'Create memory and disk snapshot for forensic analysis',       result: 'Memory + disk snapshot created: snap_{ts}' },
      { id: 'integrity',   name: 'Integrity Check',   icon: Shield,   desc: 'Run hash verification on all critical system files',          result: 'Hash verification complete. 0 files modified.' },
      { id: 'notify',      name: 'Notify Analyst',    icon: Bell,     desc: 'Send alert to on-call analyst via PagerDuty integration',    result: 'Alert sent to on-call analyst via PagerDuty simulation.' },
    ],
  },
];

const SEV_COLORS = {
  Critical: { bg: 'rgba(168,85,247,0.15)', border: '#a855f7', text: '#d8b4fe' },
  High:     { bg: 'rgba(239,68,68,0.15)',  border: '#ef4444', text: '#fca5a5' },
  Medium:   { bg: 'rgba(245,158,11,0.15)', border: '#f59e0b', text: '#fcd34d' },
  Low:      { bg: 'rgba(16,185,129,0.15)', border: '#10b981', text: '#6ee7b7' },
};

function SevBadge({ sev }) {
  const c = SEV_COLORS[sev] || SEV_COLORS.Low;
  return (
    <span style={{
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      borderRadius: 4, padding: '2px 8px', fontSize: '0.7rem', fontWeight: 700,
      letterSpacing: '0.08em', textTransform: 'uppercase',
    }}>{sev}</span>
  );
}

// Resolve {rand} and {ts} placeholders
function resolveResult(template) {
  const rand = Math.floor(Math.random() * 9000 + 1000);
  const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return template.replace('{rand}', rand).replace('{ts}', ts);
}

export default function AutomationPage() {
  const [selected, setSelected]   = useState(null);
  const [logLines, setLogLines]   = useState([]);
  const [executing, setExecuting] = useState(false);
  const [targetIP, setTargetIP]   = useState('192.168.1.250');
  const [actionsRun, setActionsRun] = useState(0);
  const logEndRef = useRef(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logLines]);

  const appendLines = async (lines) => {
    for (const line of lines) {
      await new Promise(r => setTimeout(r, 300));
      setLogLines(prev => [...prev, line]);
    }
  };

  const executeAction = async (action) => {
    if (executing) return;
    setExecuting(true);
    const ts  = new Date().toLocaleTimeString();
    const ip  = targetIP.trim() || '192.168.1.250';
    const res = resolveResult(action.result);
    await appendLines([
      { type: 'info',    text: `[${ts}] EXECUTING: ${action.name}` },
      { type: 'info',    text: `[${ts}] TARGET: ${ip}` },
      { type: 'success', text: `[${ts}] STATUS: ✓ ${res}` },
      { type: 'success', text: `[${ts}] COMPLETE: Action finished in ${(Math.random() * 2 + 0.5).toFixed(1)}s` },
      { type: 'divider', text: '' },
    ]);
    setActionsRun(n => n + 1);
    setExecuting(false);
  };

  const executeAll = async () => {
    if (executing || !selected) return;
    setExecuting(true);
    const ts = new Date().toLocaleTimeString();
    setLogLines(prev => [...prev,
      { type: 'warning', text: `[${ts}] INITIATING FULL PLAYBOOK: ${selected.name}` },
      { type: 'divider', text: '' },
    ]);
    for (const action of selected.actions) {
      const t   = new Date().toLocaleTimeString();
      const ip  = targetIP.trim() || '192.168.1.250';
      const res = resolveResult(action.result);
      await appendLines([
        { type: 'info',    text: `[${t}] EXECUTING: ${action.name}` },
        { type: 'info',    text: `[${t}] TARGET: ${ip}` },
        { type: 'success', text: `[${t}] STATUS: ✓ ${res}` },
        { type: 'success', text: `[${t}] COMPLETE: Action finished in ${(Math.random() * 2 + 0.5).toFixed(1)}s` },
        { type: 'divider', text: '' },
      ]);
      setActionsRun(n => n + 1);
    }
    const tf = new Date().toLocaleTimeString();
    await appendLines([
      { type: 'warning', text: `[${tf}] PLAYBOOK COMPLETE — All ${selected.actions.length} actions executed.` },
    ]);
    setExecuting(false);
  };

  const lineColor = { info: '#94a3b8', success: '#34d399', warning: '#fbbf24', error: '#f87171' };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px', minHeight: '100vh', background: '#0a0f1e', color: '#f8fafc' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <Terminal size={22} color="#3b82f6" />
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
            AUTOMATION COMMAND CENTER
          </h1>
        </div>
        <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>
          {PLAYBOOKS.length} active playbooks&nbsp;·&nbsp;
          <span style={{ color: '#3b82f6', fontWeight: 600 }}>{actionsRun}</span> actions executed this session
        </p>
      </div>

      {/* 3-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 1fr', gap: 16, alignItems: 'start' }}>

        {/* ── LEFT: Playbook Library ─────────────────────────────────────── */}
        <div>
          <p style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
                      textTransform: 'uppercase', marginBottom: 12 }}>Playbook Library</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {PLAYBOOKS.map(pb => {
              const isSelected = selected?.id === pb.id;
              const sc = SEV_COLORS[pb.severity];
              return (
                <div key={pb.id}
                  onClick={() => setSelected(pb)}
                  style={{
                    background: '#1e293b',
                    border: isSelected ? `1px solid #3b82f6` : '1px solid #334155',
                    borderRadius: 10,
                    padding: '14px 16px',
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 0 0 2px rgba(59,130,246,0.25), 0 0 20px rgba(59,130,246,0.1)' : 'none',
                    transition: 'all 0.18s',
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: isSelected ? '#60a5fa' : '#94a3b8',
                                   letterSpacing: '0.05em', lineHeight: 1.3 }}>{pb.name}</span>
                    <SevBadge sev={pb.severity} />
                  </div>
                  <p style={{ color: '#64748b', fontSize: '0.72rem', margin: '0 0 10px' }}>{pb.trigger}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#475569', fontSize: '0.68rem' }}>{pb.actions.length} actions</span>
                    <button
                      onClick={e => { e.stopPropagation(); setSelected(pb); }}
                      style={{
                        background: isSelected ? '#2563eb' : 'transparent',
                        border: `1px solid ${isSelected ? '#3b82f6' : '#334155'}`,
                        color: isSelected ? '#fff' : '#94a3b8',
                        borderRadius: 5, padding: '3px 10px',
                        fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}>
                      {isSelected ? '✓ LOADED' : 'LOAD'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── MIDDLE: Action Panel ───────────────────────────────────────── */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: 20 }}>
          <p style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
                      textTransform: 'uppercase', marginBottom: 16 }}>Action Panel</p>

          {!selected ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#475569' }}>
              <ChevronRight size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <p style={{ fontSize: '0.85rem' }}>Select a playbook from the library to load its actions.</p>
            </div>
          ) : (
            <>
              {/* Playbook header */}
              <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #334155' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#60a5fa',
                                 letterSpacing: '0.05em' }}>{selected.name}</span>
                  <SevBadge sev={selected.severity} />
                </div>
                <p style={{ color: '#64748b', fontSize: '0.78rem', margin: '0 0 12px' }}>{selected.description}</p>
                {/* Target IP */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Target size={14} color="#94a3b8" />
                  <input
                    value={targetIP}
                    onChange={e => setTargetIP(e.target.value)}
                    placeholder="Target IP (optional)"
                    style={{
                      background: '#0f172a', border: '1px solid #334155', color: '#f8fafc',
                      borderRadius: 6, padding: '6px 12px', fontSize: '0.78rem',
                      outline: 'none', width: '200px',
                    }} />
                </div>
              </div>

              {/* Individual action buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                {selected.actions.map(action => {
                  const Icon = action.icon;
                  return (
                    <div key={action.id} style={{
                      background: '#0f172a', border: '1px solid #334155', borderRadius: 8,
                      padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14,
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 8, background: 'rgba(59,130,246,0.1)',
                        border: '1px solid rgba(59,130,246,0.2)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <Icon size={16} color="#3b82f6" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ color: '#f8fafc', fontSize: '0.82rem', fontWeight: 700, margin: '0 0 2px' }}>{action.name}</p>
                        <p style={{ color: '#64748b', fontSize: '0.7rem', margin: 0 }}>{action.desc}</p>
                      </div>
                      <button
                        onClick={() => executeAction(action)}
                        disabled={executing}
                        style={{
                          background: 'transparent', border: '1px solid #3b82f6', color: '#60a5fa',
                          borderRadius: 6, padding: '5px 14px', fontSize: '0.68rem',
                          fontWeight: 700, letterSpacing: '0.08em', cursor: executing ? 'not-allowed' : 'pointer',
                          opacity: executing ? 0.5 : 1, transition: 'all 0.15s', flexShrink: 0,
                        }}>
                        <Play size={10} style={{ display: 'inline', marginRight: 4 }} />
                        EXECUTE
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Execute All */}
              <button
                onClick={executeAll}
                disabled={executing}
                style={{
                  width: '100%', background: executing ? '#1e3a5f' : '#2563eb',
                  border: 'none', color: '#fff', borderRadius: 8, padding: '12px',
                  fontSize: '0.82rem', fontWeight: 800, letterSpacing: '0.1em',
                  cursor: executing ? 'not-allowed' : 'pointer', transition: 'all 0.18s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                <SkipForward size={16} />
                {executing ? 'EXECUTING...' : 'EXECUTE ALL ACTIONS'}
              </button>
            </>
          )}
        </div>

        {/* ── RIGHT: Execution Log ───────────────────────────────────────── */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, overflow: 'hidden' }}>
          {/* Log header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '12px 16px', borderBottom: '1px solid #334155', background: '#0f172a' }}>
            <span style={{ color: '#34d399', fontSize: '0.72rem', fontWeight: 700,
                           fontFamily: 'monospace', letterSpacing: '0.05em' }}>
              {'> SENTINEL RESPONSE ENGINE v2.1'}
            </span>
            <button
              onClick={() => setLogLines([])}
              style={{
                background: 'transparent', border: '1px solid #334155', color: '#64748b',
                borderRadius: 5, padding: '3px 10px', fontSize: '0.65rem', fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, letterSpacing: '0.08em',
              }}>
              <Trash2 size={11} /> CLEAR LOG
            </button>
          </div>

          {/* Log body */}
          <div style={{
            background: '#050a14', fontFamily: 'monospace', fontSize: '0.75rem',
            color: '#94a3b8', padding: '16px', overflowY: 'auto', maxHeight: 500,
            minHeight: 300,
          }}>
            {logLines.length === 0 ? (
              <span style={{ color: '#1e3a5f' }}>{'// Awaiting command execution...'}</span>
            ) : (
              logLines.map((line, i) =>
                line.type === 'divider'
                  ? <div key={i} style={{ borderBottom: '1px solid #0f172a', margin: '6px 0' }} />
                  : <div key={i} style={{ color: lineColor[line.type] || '#94a3b8', lineHeight: 1.8 }}>
                      {line.text}
                    </div>
              )
            )}
            <div ref={logEndRef} />
          </div>
        </div>

      </div>
    </div>
  );
}
