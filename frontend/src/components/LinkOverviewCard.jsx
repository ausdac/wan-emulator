import React from 'react'

export default function LinkOverviewCard({ link, onConfigure }) {
  const bridgeUp = link.bridge_up
  const impaired = link.impairment_enabled
  const cycling  = link.cycle?.running

  const statusColor = !bridgeUp ? '#ff453a' : cycling ? '#0a84ff' : impaired ? '#ff9f0a' : '#30d158'

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 'var(--radius)',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        flexWrap: 'wrap',
        transition: 'border-color .2s',
      }}
    >
      {/* ── Status bar ── */}
      <div style={{
        width: 3, alignSelf: 'stretch', borderRadius: 3, flexShrink: 0,
        background: statusColor,
        minHeight: 44,
        boxShadow: `0 0 8px ${statusColor}66`,
      }} />

      {/* ── Link info ── */}
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em' }}>
            {link.name}
          </span>
          {link.physical_label && (
            <span style={{
              fontSize: 11, fontWeight: 600,
              color: '#ff9f0a',
              background: 'rgba(255,159,10,0.12)',
              border: '1px solid rgba(255,159,10,0.25)',
              borderRadius: 6, padding: '1px 7px',
              letterSpacing: '0.01em',
            }}>
              {link.physical_label}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: link.label ? 5 : 0 }}>
          <span className="tag">{link.iface_a}</span>
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>↔</span>
          <span className="tag">{link.iface_b}</span>
          <span style={{ color: 'var(--muted)', fontSize: 11 }}>· {link.bridge}</span>
          <span style={{ color: 'var(--muted)', fontSize: 11 }}>· {link.description}</span>
        </div>

        {link.label && (
          <div style={{
            fontSize: 12, color: 'rgba(255,255,255,0.35)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            maxWidth: 440,
          }} title={link.label}>
            {link.label}
          </div>
        )}
      </div>

      {/* ── Status badges + button ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end' }}>
          <span className={`badge ${bridgeUp ? 'badge-up' : 'badge-down'}`}>
            {bridgeUp ? 'Bridge Up' : 'Bridge Down'}
          </span>
          {cycling
            ? <span className="badge" style={{ background: 'rgba(10,132,255,0.15)', color: '#0a84ff' }}>Cycling</span>
            : impaired
              ? <span className="badge badge-warn">Impaired</span>
              : <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.22)' }}>No impairment</span>
          }
        </div>

        <button
          className="btn btn-primary"
          onClick={() => onConfigure(link.id)}
          style={{ fontSize: 13, padding: '7px 20px' }}
        >
          Configure
        </button>
      </div>
    </div>
  )
}
