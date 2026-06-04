import React from 'react'

export default function Header({ health, onRefresh }) {
  const ok = health?.status === 'ok'
  return (
    <header style={{
      background: 'rgba(28, 28, 30, 0.82)',
      backdropFilter: 'blur(24px) saturate(180%)',
      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      padding: '0 24px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      height: 56,
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0a84ff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="10" rx="2.5"/>
          <path d="M6 11h4M14 11h4M6 13h2M16 13h2"/>
          <circle cx="12" cy="3" r="1.3" fill="#0a84ff" stroke="none"/>
          <path d="M12 4.3v2.7"/>
          <circle cx="12" cy="21" r="1.3" fill="#0a84ff" stroke="none"/>
          <path d="M12 17v2.7"/>
        </svg>
        <div>
          <div style={{
            fontWeight: 700, fontSize: 15,
            color: '#ffffff',
            letterSpacing: '-0.02em',
          }}>
            WAN-Emulator
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '-0.01em' }}>
            Linux tc/netem
          </div>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {health && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
            background: ok ? '#30d158' : '#ff453a',
            boxShadow: ok ? '0 0 8px rgba(48,209,88,0.7)' : '0 0 8px rgba(255,69,58,0.7)',
            display: 'inline-block',
          }} />
          <span style={{
            fontSize: 12, fontWeight: 600, letterSpacing: '-0.01em',
            color: ok ? '#30d158' : '#ff453a',
          }}>
            {ok ? 'Online' : 'Error'}
          </span>
          {health.dry_run && (
            <span className="badge badge-warn" style={{ marginLeft: 2, fontSize: 10 }}>Dry-run</span>
          )}
        </div>
      )}

      <button
        className="btn btn-ghost"
        onClick={onRefresh}
        title="Refresh"
        style={{ padding: '6px 12px', fontSize: 12 }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <polyline points="23 4 23 10 17 10"/>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
        Refresh
      </button>
    </header>
  )
}
