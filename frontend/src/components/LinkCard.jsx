import React, { useState, useCallback, useEffect, useRef } from 'react'
import { api } from '../api.js'
import FilterConfig from './FilterConfig.jsx'
import StatsPanel from './StatsPanel.jsx'
import PresetSelector from './PresetSelector.jsx'

// Parameters that have a netem correlation option
const CORR_KEY = {
  delay_ms:          'delay_correlation',
  loss_percent:      'loss_correlation',
  duplicate_percent: 'duplicate_correlation',
  corrupt_percent:   'corrupt_correlation',
  reorder_percent:   'reorder_correlation',
}

const CORE_FIELDS = [
  { key: 'delay_ms',          label: 'Delay',      unit: 'ms',   step: 1,    max: 60000 },
  { key: 'jitter_ms',         label: 'Jitter',     unit: 'ms',   step: 1,    max: 10000,
    hint: 'Requires delay > 0' },
  { key: 'loss_percent',      label: 'Loss',       unit: '%',    step: 0.1,  max: 100   },
  { key: 'duplicate_percent', label: 'Duplicate',  unit: '%',    step: 0.1,  max: 100   },
  { key: 'reorder_percent',   label: 'Reorder',    unit: '%',    step: 0.1,  max: 100   },
  { key: 'corrupt_percent',   label: 'Corruption', unit: '%',    step: 0.01, max: 100,
    hint: 'Bit-error injection' },
  { key: 'bandwidth_mbit',    label: 'Bandwidth',  unit: 'Mbit', step: 1,    max: 400000,
    hint: '0 = unlimited' },
]

const emptyDir = () => ({
  delay_ms: 0, jitter_ms: 0, delay_correlation: 0,
  loss_percent: 0, loss_correlation: 0,
  duplicate_percent: 0, duplicate_correlation: 0,
  reorder_percent: 0, reorder_correlation: 0,
  bandwidth_mbit: 0,
  corrupt_percent: 0, corrupt_correlation: 0,
  burst_loss_enabled: false, burst_loss_prob: 0, burst_loss_avg_length: 2,
  filter: { enabled: false },
})

function NumInput({ value, onChange, step, max, disabled }) {
  return (
    <input
      type="number" min={0} max={max} step={step}
      value={value ?? 0}
      disabled={disabled}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
      style={{ width: 80, textAlign: 'right', opacity: disabled ? 0.35 : 1 }}
    />
  )
}

function CorrInput({ value, onChange, disabled }) {
  if (disabled) return null
  return (
    <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
      <span style={{ fontSize: 10, color: '#475569' }}>corr</span>
      <input
        type="number" min={0} max={100} step={1}
        value={value ?? 0}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        style={{ width: 54, textAlign: 'right', fontSize: 11, color: '#94a3b8',
                 background: '#0f1629', border: '1px solid #1e2235', borderRadius: 4, padding: '1px 4px' }}
      />
      <span style={{ fontSize: 10, color: '#475569' }}>%</span>
    </div>
  )
}

function Toggle({ value, onChange, label, activeLabel }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
      <div
        onClick={() => onChange(!value)}
        style={{
          width: 34, height: 18, borderRadius: 9,
          background: value ? 'var(--accent)' : 'var(--border)',
          position: 'relative', cursor: 'pointer', transition: 'background .2s', flexShrink: 0,
        }}
      >
        <div style={{
          position: 'absolute', top: 2, left: value ? 16 : 2,
          width: 14, height: 14, borderRadius: '50%',
          background: '#fff', transition: 'left .2s',
        }} />
      </div>
      <span style={{ fontSize: 12, color: value ? 'var(--accent)' : 'var(--muted)' }}>
        {value ? (activeLabel ?? label) : label}
      </span>
    </label>
  )
}

// ── Label textarea ────────────────────────────────────────────────────────────
function LinkLabel({ linkId, initialValue }) {
  const [text, setText] = useState(initialValue ?? '')
  const [status, setStatus] = useState(null) // null | 'saving' | 'saved' | 'error'
  const savedRef = useRef(initialValue ?? '')

  useEffect(() => { setText(initialValue ?? ''); savedRef.current = initialValue ?? '' }, [initialValue])

  const save = (v) => {
    if (v === savedRef.current) return
    setStatus('saving')
    api.setLabel(linkId, v)
      .then(() => { savedRef.current = v; setStatus('saved') })
      .catch(() => setStatus('error'))
  }

  const isDirty = text !== savedRef.current

  return (
    <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>
          Notes / Label
        </span>
        <div style={{ flex: 1 }} />
        {status === 'saving' && <span style={{ fontSize: 11, color: '#475569' }}>Saving…</span>}
        {status === 'saved'  && <span style={{ fontSize: 11, color: '#22c55e' }}>✓ Saved</span>}
        {status === 'error'  && <span style={{ fontSize: 11, color: '#ef4444' }}>Save failed</span>}
        <button
          onClick={() => save(text)}
          disabled={!isDirty}
          style={{
            fontSize: 11, padding: '2px 10px', borderRadius: 4, cursor: isDirty ? 'pointer' : 'default',
            background: isDirty ? 'var(--accent)' : '#1e2235',
            color: isDirty ? '#fff' : '#475569',
            border: 'none', transition: 'background .15s',
          }}
        >
          Save
        </button>
      </div>
      <textarea
        value={text}
        onChange={e => { setText(e.target.value); setStatus(null) }}
        onBlur={e => save(e.target.value)}
        placeholder="e.g. Dachel, A: PBS CSNAM-12345 — WAN sim for QA rack"
        rows={2}
        style={{
          width: '100%', boxSizing: 'border-box',
          background: '#0d1120', color: '#e2e8f0',
          border: `1px solid ${isDirty ? '#3b4a6b' : 'var(--border)'}`,
          borderRadius: 6, padding: '6px 10px', fontSize: 13, fontFamily: 'inherit',
          resize: 'vertical', outline: 'none', transition: 'border-color .15s',
        }}
      />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LinkCard({ link, onStatusChange }) {
  const current = link.current_settings ?? {}
  const [enabled,    setEnabled]   = useState(current.enabled ?? false)
  const [aToB,       setAToB]      = useState({ ...emptyDir(), ...(current.a_to_b ?? {}) })
  const [bToA,       setBToA]      = useState({ ...emptyDir(), ...(current.b_to_a ?? {}) })
  const [busy,       setBusy]      = useState(false)
  const [msg,        setMsg]       = useState(null)
  const [showStats,  setShowStats] = useState(false)

  // ── Duty-cycle state (server-owned) ────────────────────────────────────────
  const serverCycle = link.cycle ?? {}
  const [cycleEnabled,   setCycleEnabled]   = useState(serverCycle.running ?? false)
  const [cycleOnSecs,    setCycleOnSecs]    = useState(serverCycle.on_secs  || 10)
  const [cycleOffSecs,   setCycleOffSecs]   = useState(serverCycle.off_secs || 20)
  const [cyclePhase,     setCyclePhase]     = useState(serverCycle.phase    ?? null)
  const [cycleCountdown, setCycleCountdown] = useState(serverCycle.countdown ?? 0)

  // Poll cycle status from server every 2s while running
  useEffect(() => {
    if (!cycleEnabled) return
    const id = setInterval(() => {
      api.getCycle(link.id).then(s => {
        if (!s.running) {
          setCycleEnabled(false)
          setCyclePhase(null)
          setCycleCountdown(0)
        } else {
          setCyclePhase(s.phase)
          setCycleCountdown(Math.round(s.countdown))
        }
      }).catch(() => {})
    }, 2000)
    return () => clearInterval(id)
  }, [cycleEnabled, link.id])

  const flash = (text, ok = true) => {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 5000)
  }

  const act = useCallback(async (fn) => {
    setBusy(true)
    try {
      const r = await fn()
      flash(r.message ?? r.msg ?? 'OK', r.success !== false)
      onStatusChange()
    } catch (e) {
      flash(e.message, false)
    } finally {
      setBusy(false)
    }
  }, [onStatusChange])

  const handleSetup   = () => act(() => api.setupLink(link.id))
  const handleReset   = () => {
    if (!window.confirm(`Clear all impairments on ${link.name}? The bridge stays up — inline traffic is unaffected.`)) return
    setCycleEnabled(false); setCyclePhase(null); setCycleCountdown(0)
    act(() => api.resetLink(link.id))
  }
  const handleApply   = () => {
    setCycleEnabled(false); setCyclePhase(null); setCycleCountdown(0)
    act(() => api.setImpairment(link.id, { enabled, a_to_b: aToB, b_to_a: bToA }))
  }
  const handleClear   = () => {
    setCycleEnabled(false); setCyclePhase(null); setCycleCountdown(0)
    const blank = emptyDir()
    setAToB(blank); setBToA({ ...blank }); setEnabled(false)
    act(() => api.setImpairment(link.id, { enabled: false, a_to_b: blank, b_to_a: blank }))
  }
  const handlePreviewParams = (params) => {
    const dir = {
      ...emptyDir(),
      delay_ms: params.delay_ms ?? 0,
      jitter_ms: params.jitter_ms ?? 0,
      loss_percent: params.loss_percent ?? 0,
      duplicate_percent: params.duplicate_percent ?? 0,
      reorder_percent: params.reorder_percent ?? 0,
      bandwidth_mbit: params.bandwidth_mbit ?? 0,
    }
    setAToB({ ...dir }); setBToA({ ...dir }); setEnabled(true)
    flash('Fields filled from preset — review and click Apply', true)
  }

  // Jitter requires delay validation
  const jitterWithoutDelay = (dir) => dir.jitter_ms > 0 && dir.delay_ms <= 0
  const hasJitterError = jitterWithoutDelay(aToB) || jitterWithoutDelay(bToA)

  const abField = (key, step, max) => {
    const corrKey = CORR_KEY[key]
    const isJitter = key === 'jitter_ms'
    const disabled = isJitter && aToB.delay_ms <= 0
    return (
      <div>
        <NumInput
          value={aToB[key]}
          onChange={v => setAToB(d => ({ ...d, [key]: v }))}
          step={step} max={max} disabled={disabled}
        />
        {corrKey && aToB[key] > 0 && !disabled && (
          <CorrInput
            value={aToB[corrKey]}
            onChange={v => setAToB(d => ({ ...d, [corrKey]: v }))}
            disabled={false}
          />
        )}
      </div>
    )
  }

  const baField = (key, step, max) => {
    const corrKey = CORR_KEY[key]
    const isJitter = key === 'jitter_ms'
    const disabled = isJitter && bToA.delay_ms <= 0
    return (
      <div>
        <NumInput
          value={bToA[key]}
          onChange={v => setBToA(d => ({ ...d, [key]: v }))}
          step={step} max={max} disabled={disabled}
        />
        {corrKey && bToA[key] > 0 && !disabled && (
          <CorrInput
            value={bToA[corrKey]}
            onChange={v => setBToA(d => ({ ...d, [corrKey]: v }))}
            disabled={false}
          />
        )}
      </div>
    )
  }

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${link.bridge_up ? 'var(--border)' : '#3b1a1a'}`,
      borderRadius: 10,
      overflow: 'hidden',
      marginBottom: 20,
    }}>
      {/* ── Card header ── */}
      <div style={{
        padding: '12px 18px',
        background: '#13162a',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{link.name}</span>
            {link.physical_label && (
              <span style={{
                fontSize: 12, fontWeight: 600, color: '#fbbf24',
                background: '#292000', border: '1px solid #78350f',
                borderRadius: 4, padding: '1px 7px',
              }}>
                {link.physical_label}
              </span>
            )}
            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>
              {link.description}
            </span>
          </div>
          <div style={{ marginTop: 3, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="tag">{link.iface_a}</span>
            <span style={{ color: 'var(--muted)' }}>↔</span>
            <span className="tag">{link.iface_b}</span>
            <span style={{ color: 'var(--muted)', fontSize: 10 }}>br: {link.bridge}</span>
            <span className={`badge ${link.bridge_up ? 'badge-up' : 'badge-down'}`}>
              {link.bridge_up ? 'bridge up' : 'bridge down'}
            </span>
            {link.impairment_enabled && <span className="badge badge-warn">impaired</span>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            className={`btn ${showStats ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setShowStats(s => !s)}
            style={{ fontSize: 12 }}
          >
            📊 Stats
          </button>
          {!link.bridge_up && (
            <button className="btn btn-ghost" onClick={handleSetup} disabled={busy} style={{ fontSize: 12 }}>
              Restore Bridge
            </button>
          )}
          <button className="btn btn-danger" onClick={handleReset} disabled={busy} style={{ fontSize: 12 }}>
            Clear Impairments
          </button>
        </div>
      </div>

      {/* ── Label / notes ── */}
      <LinkLabel linkId={link.id} initialValue={link.label} />

      {/* ── Live stats panel ── */}
      {showStats && (
        <StatsPanel linkId={link.id} ifaceA={link.iface_a} ifaceB={link.iface_b} />
      )}

      {/* ── Preset selector ── */}
      <PresetSelector
        linkId={link.id}
        onApplied={onStatusChange}
        onPreviewParams={handlePreviewParams}
      />

      {/* ── Flash message ── */}
      {msg && (
        <div style={{
          padding: '8px 18px',
          background: msg.ok ? '#052e16' : '#450a0a',
          color: msg.ok ? '#86efac' : '#fca5a5',
          fontSize: 13,
          borderBottom: '1px solid var(--border)',
        }}>
          {msg.ok ? '✓' : '✗'} {msg.text}
        </div>
      )}

      {/* ── Impairment table ── */}
      <div style={{ padding: '16px 18px' }}>

        {/* ── Apply / Clear row — top of section ── */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
          <Toggle
            value={enabled}
            onChange={setEnabled}
            label="Impairment disabled"
            activeLabel="Impairment ENABLED"
          />
          <div style={{ flex: 1 }} />
          <button
            className="btn btn-primary"
            onClick={handleApply}
            disabled={busy || hasJitterError}
            title={hasJitterError ? 'Set a delay value before using jitter' : undefined}
          >
            ▶ Apply Impairment
          </button>
          <button className="btn btn-neutral" onClick={handleClear} disabled={busy}>
            Clear
          </button>
        </div>

        {/* ── Duty-cycle row ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          padding: '8px 12px', marginBottom: 12,
          background: cycleEnabled ? '#0a1628' : '#0d1120',
          border: `1px solid ${cycleEnabled ? '#1e3a5f' : '#1e2235'}`,
          borderRadius: 7,
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={cycleEnabled}
              onChange={e => {
                const want = e.target.checked
                if (want && !enabled) { flash('Apply impairment settings first before starting a cycle', false); return }
                const body = { enabled: want, on_secs: cycleOnSecs, off_secs: cycleOffSecs }
                api.setCycle(link.id, body)
                  .then(() => {
                    setCycleEnabled(want)
                    if (!want) { setCyclePhase(null); setCycleCountdown(0) }
                  })
                  .catch(err => flash(err.message, false))
              }}
              disabled={hasJitterError || busy}
              style={{ width: 14, height: 14, accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
            <span style={{ fontSize: 13, fontWeight: 600, color: cycleEnabled ? '#7dd3fc' : 'var(--muted)' }}>
              Cycle Impairment
            </span>
          </label>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>On</span>
            <input
              type="number" min={1} max={3600} step={1}
              value={cycleOnSecs}
              onChange={e => setCycleOnSecs(Math.max(1, parseInt(e.target.value) || 1))}
              style={{ width: 60, textAlign: 'right' }}
            />
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>s</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Off</span>
            <input
              type="number" min={1} max={3600} step={1}
              value={cycleOffSecs}
              onChange={e => setCycleOffSecs(Math.max(1, parseInt(e.target.value) || 1))}
              style={{ width: 60, textAlign: 'right' }}
            />
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>s</span>
          </div>

          {/* Live status indicator */}
          {cyclePhase && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: cyclePhase === 'on' ? '#f59e0b' : '#334155',
                boxShadow: cyclePhase === 'on' ? '0 0 6px #f59e0b' : 'none',
              }} />
              <span style={{ fontSize: 12, fontWeight: 600,
                color: cyclePhase === 'on' ? '#fbbf24' : '#64748b' }}>
                {cyclePhase === 'on' ? 'IMPAIRED' : 'CLEAR'} — {cycleCountdown}s
              </span>
            </div>
          )}

          {!cycleEnabled && (
            <span style={{ fontSize: 11, color: '#334155', marginLeft: 2 }}>
              Cycles endlessly once enabled — manual Apply/Clear stops the cycle
            </span>
          )}
        </div>

        {hasJitterError && (
          <div style={{
            marginBottom: 10, padding: '6px 12px',
            background: '#431407', border: '1px solid #7c2d12',
            borderRadius: 6, fontSize: 12, color: '#fdba74',
          }}>
            ⚠ Jitter requires a delay value greater than 0.
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--muted)', fontSize: 11, width: 130 }}>
                  Parameter
                </th>
                <th style={{ textAlign: 'center', padding: '6px 10px', color: '#7dd3fc', fontSize: 12, fontWeight: 700 }}>
                  A → B
                  <div style={{ fontSize: 10, fontWeight: 400, color: 'var(--muted)', fontFamily: 'monospace' }}>
                    egress: {link.iface_b}
                  </div>
                </th>
                <th style={{ textAlign: 'center', padding: '6px 10px', color: '#c4b5fd', fontSize: 12, fontWeight: 700 }}>
                  B → A
                  <div style={{ fontSize: 10, fontWeight: 400, color: 'var(--muted)', fontFamily: 'monospace' }}>
                    egress: {link.iface_a}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {CORE_FIELDS.map(({ key, label, unit, step, max, hint }) => (
                <tr key={key} style={{ borderBottom: '1px solid #1e2235' }}>
                  <td style={{ padding: '7px 10px' }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{unit}{hint ? ` · ${hint}` : ''}</div>
                  </td>
                  <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                    {abField(key, step, max)}
                  </td>
                  <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                    {baField(key, step, max)}
                  </td>
                </tr>
              ))}

              {/* ── Burst loss rows ── */}
              <tr style={{ borderBottom: '1px solid #1e2235', background: '#0d1120' }}>
                <td style={{ padding: '7px 10px' }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>Burst Loss</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>GE model</div>
                </td>
                <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                  <Toggle value={aToB.burst_loss_enabled}
                    onChange={v => setAToB(d => ({ ...d, burst_loss_enabled: v }))}
                    label="off" activeLabel="on" />
                </td>
                <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                  <Toggle value={bToA.burst_loss_enabled}
                    onChange={v => setBToA(d => ({ ...d, burst_loss_enabled: v }))}
                    label="off" activeLabel="on" />
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #1e2235', background: '#0d1120' }}>
                <td style={{ padding: '7px 10px' }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)', paddingLeft: 8 }}>Burst prob %</div>
                </td>
                <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                  <input type="number" min={0} max={100} step={0.1}
                    value={aToB.burst_loss_prob} disabled={!aToB.burst_loss_enabled}
                    onChange={e => setAToB(d => ({ ...d, burst_loss_prob: parseFloat(e.target.value) || 0 }))}
                    style={{ width: 80, textAlign: 'right', opacity: aToB.burst_loss_enabled ? 1 : 0.35 }} />
                </td>
                <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                  <input type="number" min={0} max={100} step={0.1}
                    value={bToA.burst_loss_prob} disabled={!bToA.burst_loss_enabled}
                    onChange={e => setBToA(d => ({ ...d, burst_loss_prob: parseFloat(e.target.value) || 0 }))}
                    style={{ width: 80, textAlign: 'right', opacity: bToA.burst_loss_enabled ? 1 : 0.35 }} />
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border)', background: '#0d1120' }}>
                <td style={{ padding: '7px 10px' }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)', paddingLeft: 8 }}>Avg burst len</div>
                  <div style={{ fontSize: 10, color: '#334155', paddingLeft: 8 }}>packets</div>
                </td>
                <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                  <input type="number" min={1} max={1000} step={1}
                    value={aToB.burst_loss_avg_length} disabled={!aToB.burst_loss_enabled}
                    onChange={e => setAToB(d => ({ ...d, burst_loss_avg_length: parseFloat(e.target.value) || 2 }))}
                    style={{ width: 80, textAlign: 'right', opacity: aToB.burst_loss_enabled ? 1 : 0.35 }} />
                </td>
                <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                  <input type="number" min={1} max={1000} step={1}
                    value={bToA.burst_loss_avg_length} disabled={!bToA.burst_loss_enabled}
                    onChange={e => setBToA(d => ({ ...d, burst_loss_avg_length: parseFloat(e.target.value) || 2 }))}
                    style={{ width: 80, textAlign: 'right', opacity: bToA.burst_loss_enabled ? 1 : 0.35 }} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── Per-direction filters ── */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
          <div style={{ flex: '1 1 300px' }}>
            <FilterConfig value={aToB.filter} onChange={f => setAToB(d => ({ ...d, filter: f }))} dirLabel="A → B" />
          </div>
          <div style={{ flex: '1 1 300px' }}>
            <FilterConfig value={bToA.filter} onChange={f => setBToA(d => ({ ...d, filter: f }))} dirLabel="B → A" />
          </div>
        </div>

      </div>
    </div>
  )
}
