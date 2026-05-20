import React from 'react'

export default function Header({ health, onRefresh }) {
  const ok = health?.status === 'ok'
  return (
    <header style={{
      background: '#13162a',
      borderBottom: '1px solid #2a2d3e',
      padding: '0 24px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      height: 56,
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4f8ef7" strokeWidth="1.8">
          <rect x="2" y="7" width="20" height="10" rx="2"/>
          <path d="M6 11h4M14 11h4M6 13h2M16 13h2"/>
          <circle cx="12" cy="3" r="1.5" fill="#4f8ef7"/>
          <path d="M12 4.5v2.5"/>
          <circle cx="12" cy="21" r="1.5" fill="#4f8ef7"/>
          <path d="M12 17v2.5"/>
        </svg>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#e2e8f0', letterSpacing: .3 }}>
            WANEmulator
          </div>
          <div style={{ fontSize: 11, color: '#64748b' }}>v1.0 · Linux tc/netem</div>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {health && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: ok ? '#22c55e' : '#ef4444',
            boxShadow: ok ? '0 0 6px #22c55e' : '0 0 6px #ef4444',
            display: 'inline-block',
          }} />
          <span style={{ fontSize: 12, color: ok ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
            {ok ? 'ONLINE' : 'ERROR'}
          </span>
          {health.dry_run && (
            <span className="badge badge-warn" style={{ marginLeft: 4 }}>DRY-RUN</span>
          )}
        </div>
      )}

      <button className="btn btn-ghost" onClick={onRefresh} title="Refresh all">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="23 4 23 10 17 10"/>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
        Refresh
      </button>
    </header>
  )
}
