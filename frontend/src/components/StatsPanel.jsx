import React, { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../api.js'

// ── Sparkline SVG ─────────────────────────────────────────────────────────────
function Sparkline({ data, color, label, width = 200, height = 50 }) {
  if (!data || data.length < 2) {
    return (
      <div style={{ display: 'inline-block', width, textAlign: 'center',
        fontSize: 11, color: 'var(--muted)', lineHeight: `${height}px` }}>
        {label}: collecting…
      </div>
    )
  }

  const max = Math.max(...data, 0.001)
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (width - 4) + 2
    const y = height - 4 - ((v / max) * (height - 8))
    return `${x},${y}`
  })
  const latest = data[data.length - 1]

  return (
    <div style={{ display: 'inline-block' }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>
        {label}: <span style={{ color, fontWeight: 700 }}>{latest.toFixed(1)}/s</span>
      </div>
      <svg width={width} height={height} style={{ display: 'block', background: '#0a0d18', borderRadius: 4 }}>
        <polyline
          points={pts.join(' ')}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* Latest value dot */}
        {pts.length > 0 && (() => {
          const [lx, ly] = pts[pts.length - 1].split(',')
          return <circle cx={lx} cy={ly} r="2.5" fill={color} />
        })()}
      </svg>
    </div>
  )
}

// ── Counter card ──────────────────────────────────────────────────────────────
function CounterCard({ label, value, unit = '', color }) {
  return (
    <div style={{
      background: '#0a0d18', borderRadius: 6, padding: '8px 12px',
      minWidth: 100, textAlign: 'center',
    }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color ?? 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      {unit && <div style={{ fontSize: 10, color: 'var(--muted)' }}>{unit}</div>}
    </div>
  )
}

function fmt(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + ' G'
  if (n >= 1e6) return (n / 1e6).toFixed(2) + ' M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + ' K'
  return String(n)
}

// ── Per-interface stats block ─────────────────────────────────────────────────
function IfaceStats({ label, data }) {
  if (!data) return null
  const pktHistory  = (data.history ?? []).map(s => s.pkt_rate)
  const dropHistory = (data.history ?? []).map(s => s.drop_rate)

  return (
    <div style={{ flex: 1, minWidth: 260 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)',
        textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <CounterCard label="Packets"  value={fmt(data.packets_sent)} />
        <CounterCard label="Bytes"    value={fmt(data.bytes_sent)} unit="bytes" />
        <CounterCard label="Dropped"  value={fmt(data.dropped)} color={data.dropped > 0 ? '#ef4444' : undefined} />
        <CounterCard label="Drop %"   value={data.drop_percent.toFixed(1)}
          unit="%" color={data.drop_percent > 1 ? '#f59e0b' : data.drop_percent > 0 ? '#fde68a' : undefined} />
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Sparkline data={pktHistory}  color="#22c55e" label="Pkts" />
        <Sparkline data={dropHistory} color="#ef4444" label="Drops" />
      </div>
    </div>
  )
}

// ── Main StatsPanel ───────────────────────────────────────────────────────────
export default function StatsPanel({ linkId, ifaceA, ifaceB }) {
  const [data,   setData]   = useState(null)
  const [error,  setError]  = useState(null)
  const timerRef = useRef(null)

  const poll = useCallback(async () => {
    try {
      const d = await api.getLiveStats(linkId)
      setData(d)
      setError(null)
    } catch (e) {
      setError(e.message)
    }
  }, [linkId])

  useEffect(() => {
    poll()
    timerRef.current = setInterval(poll, 2000)
    return () => clearInterval(timerRef.current)
  }, [poll])

  return (
    <div style={{
      padding: '14px 16px',
      background: '#0a0d18',
      borderTop: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#4f8ef7',
        textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
        Live Stats — polling every 2s
        {error && <span style={{ color: '#ef4444', marginLeft: 10, fontWeight: 400 }}>{error}</span>}
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <IfaceStats label={`← ${ifaceA} (B→A egress)`} data={data?.iface_a} />
        <IfaceStats label={`→ ${ifaceB} (A→B egress)`} data={data?.iface_b} />
      </div>

      <div style={{ marginTop: 8, fontSize: 10, color: '#334155' }}>
        Sparklines show per-interval rates (packets/s and drops/s) over the last 2 minutes.
        Counters are cumulative since last impairment apply.
      </div>
    </div>
  )
}
