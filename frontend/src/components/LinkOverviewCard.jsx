import React from 'react'

export default function LinkOverviewCard({ link, onConfigure }) {
  const bridgeUp = link.bridge_up
  const impaired = link.impairment_enabled

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: `1px solid ${bridgeUp ? 'var(--border)' : '#3b1a1a'}`,
        borderRadius: 10,
        padding: '18px 22px',
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        flexWrap: 'wrap',
      }}
    >
      {/* ── Left: status indicator bar ── */}
      <div style={{
        width: 4, alignSelf: 'stretch', borderRadius: 2, flexShrink: 0,
        background: bridgeUp ? (impaired ? '#f59e0b' : '#22c55e') : '#ef4444',
        minHeight: 48,
      }} />

      {/* ── Centre: link info ── */}
      <div style={{ flex: 1, minWidth: 180 }}>
        {/* Name + physical label */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>{link.name}</span>
          {link.physical_label && (
            <span style={{
              fontSize: 11, fontWeight: 600, color: '#fbbf24',
              background: '#292000', border: '1px solid #78350f',
              borderRadius: 4, padding: '1px 7px',
            }}>
              {link.physical_label}
            </span>
          )}
        </div>

        {/* Interfaces + bridge */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
          <span className="tag">{link.iface_a}</span>
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>↔</span>
          <span className="tag">{link.iface_b}</span>
          <span style={{ color: 'var(--muted)', fontSize: 11 }}>· {link.bridge}</span>
          <span style={{ color: 'var(--muted)', fontSize: 11 }}>· {link.description}</span>
        </div>

        {/* Notes preview */}
        {link.label && (
          <div style={{
            fontSize: 12, color: '#64748b',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            maxWidth: 420,
          }}
            title={link.label}
          >
            {link.label}
          </div>
        )}
      </div>

      {/* ── Right: status badges + button ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end' }}>
          <span className={`badge ${bridgeUp ? 'badge-up' : 'badge-down'}`}>
            {bridgeUp ? '● bridge up' : '○ bridge down'}
          </span>
          {impaired
            ? <span className="badge badge-warn">⚡ impaired</span>
            : <span style={{ fontSize: 11, color: '#334155' }}>no impairment</span>
          }
        </div>

        <button
          className="btn btn-primary"
          onClick={() => onConfigure(link.id)}
          style={{ fontSize: 13, padding: '7px 18px' }}
        >
          Configure →
        </button>
      </div>
    </div>
  )
}
