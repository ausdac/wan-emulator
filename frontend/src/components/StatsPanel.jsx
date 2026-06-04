import React, { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../api.js'

// ── Sparkline SVG ─────────────────────────────────────────────────────────────
function Sparkline({ data, color, label, width = 200, height = 48 }) {
  if (!data || data.length < 2) {
    return (
      <div style={{
        display: 'inline-block', width, textAlign: 'center',
        fontSize: 11, color: 'var(--muted)', lineHeight: `${height}px`,
      }}>
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
      <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 3 }}>
        {label}: <span style={{ color, fontWeight: 700 }}>{latest.toFixed(1)}/s</span>
      </div>
      <svg width={width} height={height} style={{
        display: 'block',
        background: 'rgba(255,255,255,0.04)',
        borderRadius: 8,
      }}>
        <polyline
          points={pts.join(' ')}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
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
      background: 'rgba(255,255,255,0.05)',
      borderRadius: 10,
      padding: '8px 14px',
      minWidth: 92,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 3, letterSpacing: '0.03em' }}>
        {label}
      </div>
      <div style={{
        fontSize: 19, fontWeight: 700,
        color: color ?? 'var(--text)',
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-0.02em',
      }}>
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
      <div style={{
        fontSize: 11, fontWeight: 600, color: 'var(--muted)',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
      }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 12 }}>
        <CounterCard label="Packets"  value={fmt(data.packets_sent)} />
        <CounterCard label="Bytes"    value={fmt(data.bytes_sent)} unit="bytes" />
        <CounterCard label="Dropped"  value={fmt(data.dropped)}
          color={data.dropped > 0 ? '#ff453a' : undefined} />
        <CounterCard label="Drop %"   value={data.drop_percent.toFixed(1)} unit="%"
          color={data.drop_percent > 1 ? '#ff9f0a' : data.drop_percent > 0 ? 'rgba(255,159,10,0.7)' : undefined} />
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Sparkline data={pktHistory}  color="#30d158" label="Pkts" />
        <Sparkline data={dropHistory} color="#ff453a" label="Drops" />
      </div>
    </div>
  )
}

// ── Main StatsPanel ───────────────────────────────────────────────────────────
export default function StatsPanel({ linkId, ifaceA, ifaceB }) {
  const [data,  setData]  = useState(null)
  const [error, setError] = useState(null)
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

  const handleClearStats = async () => {
    try {
      await api.clearStats(linkId)
      setData(null)
    } catch {}
  }

  return (
    <div style={{
      padding: '16px 18px',
      background: 'rgba(255,255,255,0.03)',
      borderTop: '1px solid var(--border)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', marginBottom: 14,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 600, color: '#0a84ff',
          textTransform: 'uppercase', letterSpacing: '0.07em',
        }}>
          Live Stats
          <span style={{ color: 'var(--muted)', fontWeight: 400, marginLeft: 6 }}>· every 2s</span>
        </div>
        {error && (
          <span style={{ color: '#ff453a', marginLeft: 10, fontSize: 11 }}>{error}</span>
        )}
        <div style={{ flex: 1 }} />
        <button
          className="btn btn-ghost"
          onClick={handleClearStats}
          style={{ fontSize: 11, padding: '4px 12px' }}
        >
          Reset Counters
        </button>
      </div>

      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
        <IfaceStats label={`← ${ifaceA} (B→A egress)`} data={data?.iface_a} />
        <IfaceStats label={`→ ${ifaceB} (A→B egress)`} data={data?.iface_b} />
      </div>

      <div style={{ marginTop: 10, fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>
        Sparklines show per-interval rates over the last 2 minutes. Counters are cumulative since last reset.
      </div>
    </div>
  )
}
