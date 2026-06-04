import React, { useState, useCallback, useEffect, useRef } from 'react'
import { api } from '../api.js'
import FilterConfig from './FilterConfig.jsx'
import StatsPanel from './StatsPanel.jsx'
import PresetSelector from './PresetSelector.jsx'

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
      style={{
        width: 82, textAlign: 'right',
        opacity: disabled ? 0.3 : 1,
        fontVariantNumeric: 'tabular-nums',
      }}
    />
  )
}

function CorrInput({ value, onChange, disabled }) {
  if (disabled) return null
  return (
    <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
      <span style={{ fontSize: 10, color: 'var(--muted)' }}>corr</span>
      <input
        type="number" min={0} max={100} step={1}
        value={value ?? 0}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        style={{
          width: 52, textAlign: 'right', fontSize: 11,
          color: 'rgba(255,255,255,0.5)',
          background: 'rgba(118,118,128,0.12)',
          border: '1px solid transparent',
          borderRadius: 6, padding: '1px 4px',
          fontVariantNumeric: 'tabular-nums',
        }}
      />
      <span style={{ fontSize: 10, color: 'var(--muted)' }}>%</span>
    </div>
  )
}

// iOS-style toggle
function Toggle({ value, onChange, label, activeLabel }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
      <div
        onClick={() => onChange(!value)}
        style={{
          width: 38, height: 22, borderRadius: 11,
          background: value ? '#30d158' : 'rgba(118,118,128,0.32)',
          position: 'relative', cursor: 'pointer',
          transition: 'background .22s',
          flexShrink: 0,
          boxShadow: value ? '0 0 8px rgba(48,209,88,0.4)' : 'none',
        }}
      >
        <div style={{
          position: 'absolute',
          top: 2, left: value ? 18 : 2,
          width: 18, height: 18, borderRadius: '50%',
          background: '#ffffff',
          transition: 'left .22s cubic-bezier(.4,0,.2,1)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
        }} />
      </div>
      <span style={{ fontSize: 12, color: value ? '#30d158' : 'var(--muted)' }}>
        {value ? (activeLabel ?? label) : label}
      </span>
    </label>
  )
}

// ── Label textarea ────────────────────────────────────────────────────────────
function LinkLabel({ linkId, initialValue }) {
  const [text, setText] = useState(initialValue ?? '')
  const [status, setStatus] = useState(null)
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
    <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{
          fontSize: 11, fontWeight: 600, color: 'var(--muted)',
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          Notes
        </span>
        <div style={{ flex: 1 }} />
        {status === 'saving' && <span style={{ fontSize: 11, color: 'var(--muted)' }}>Saving…</span>}
        {status === 'saved'  && <span style={{ fontSize: 11, color: '#30d158' }}>Saved</span>}
        {status === 'error'  && <span style={{ fontSize: 11, color: '#ff453a' }}>Save failed</span>}
        <button
          onClick={() => save(text)}
          disabled={!isDirty}
          style={{
            fontSize: 11, padding: '3px 12px',
            borderRadius: 980, border: 'none',
            cursor: isDirty ? 'pointer' : 'default',
            fontWeight: 600, fontFamily: 'inherit',
            background: isDirty ? 'var(--accent)' : 'rgba(255,255,255,0.07)',
            color: isDirty ? '#fff' : 'rgba(255,255,255,0.3)',
            transition: 'background .15s, color .15s',
          }}
        >
          Save
        </button>
      </div>
      <textarea
        value={text}
        onChange={e => { setText(e.target.value); setStatus(null) }}
        onBlur={e => save(e.target.value)}
        placeholder="e.g. PBS CSNAM-12345 — WAN sim for QA rack"
        rows={2}
        style={{
          width: '100%', boxSizing: 'border-box',
          background: isDirty ? 'rgba(118,118,128,0.18)' : 'rgba(118,118,128,0.12)',
          color: '#ffffff',
          border: `1px solid ${isDirty ? 'rgba(10,132,255,0.4)' : 'transparent'}`,
          borderRadius: 10, padding: '7px 11px', fontSize: 13, fontFamily: 'inherit',
          resize: 'vertical', outline: 'none', transition: 'border-color .15s, background .15s',
          lineHeight: 1.5,
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

  const handleSetup = () => act(() => api.setupLink(link.id))
  const handleReset = () => {
    if (!window.confirm(`Clear all impairments on ${link.name}? The bridge stays up.`)) return
    setCycleEnabled(false); setCyclePhase(null); setCycleCountdown(0)
    act(() => api.resetLink(link.id))
  }
  const handleApply = () => {
    setCycleEnabled(false); setCyclePhase(null); setCycleCountdown(0)
    act(() => api.setImpairment(link.id, { enabled, a_to_b: aToB, b_to_a: bToA }))
  }
  const handleClear = () => {
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

  const jitterWithoutDelay = (dir) => dir.jitter_ms > 0 && dir.delay_ms <= 0
  const hasJitterError = jitterWithoutDelay(aToB) || jitterWithoutDelay(bToA)

  const abField = (key, step, max) => {
    const corrKey = CORR_KEY[key]
    const isJitter = key === 'jitter_ms'
    const disabled = isJitter && aToB.delay_ms <= 0
    return (
      <div>
        <NumInput value={aToB[key]} onChange={v => setAToB(d => ({ ...d, [key]: v }))}
          step={step} max={max} disabled={disabled} />
        {corrKey && aToB[key] > 0 && !disabled && (
          <CorrInput value={aToB[corrKey]} onChange={v => setAToB(d => ({ ...d, [corrKey]: v }))} disabled={false} />
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
        <NumInput value={bToA[key]} onChange={v => setBToA(d => ({ ...d, [key]: v }))}
          step={step} max={max} disabled={disabled} />
        {corrKey && bToA[key] > 0 && !disabled && (
          <CorrInput value={bToA[corrKey]} onChange={v => setBToA(d => ({ ...d, [corrKey]: v }))} disabled={false} />
        )}
      </div>
    )
  }

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${link.bridge_up ? 'rgba(255,255,255,0.08)' : 'rgba(255,69,58,0.25)'}`,
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
      marginBottom: 20,
    }}>
      {/* ── Card header ── */}
      <div style={{
        padding: '14px 18px',
        background: 'rgba(255,255,255,0.03)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', marginBottom: 5 }}>
            <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em' }}>
              {link.name}
            </span>
            {link.physical_label && (
              <span style={{
                fontSize: 11, fontWeight: 600, color: '#ff9f0a',
                background: 'rgba(255,159,10,0.12)',
                border: '1px solid rgba(255,159,10,0.25)',
                borderRadius: 6, padding: '1px 7px',
              }}>
                {link.physical_label}
              </span>
            )}
            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 400 }}>
              {link.description}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="tag">{link.iface_a}</span>
            <span style={{ color: 'var(--muted)', fontSize: 11 }}>↔</span>
            <span className="tag">{link.iface_b}</span>
            <span style={{ color: 'rgba(255,255,255,0.22)', fontSize: 11 }}>br: {link.bridge}</span>
            <span className={`badge ${link.bridge_up ? 'badge-up' : 'badge-down'}`}>
              {link.bridge_up ? 'Bridge Up' : 'Bridge Down'}
            </span>
            {link.impairment_enabled && (
              <span className="badge badge-warn">Impaired</span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          <button
            className={`btn ${showStats ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setShowStats(s => !s)}
            style={{ fontSize: 12 }}
          >
            Stats
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
          padding: '9px 18px',
          background: msg.ok ? 'var(--success-tint)' : 'var(--danger-tint)',
          color: msg.ok ? '#30d158' : '#ff453a',
          fontSize: 13, fontWeight: 500,
          borderBottom: '1px solid var(--border)',
        }}>
          {msg.ok ? '✓' : '✗'} {msg.text}
        </div>
      )}

      {/* ── Impairment section ── */}
      <div style={{ padding: '16px 18px' }}>

        {/* ── Apply / Clear row ── */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
          <Toggle
            value={enabled}
            onChange={setEnabled}
            label="Impairment off"
            activeLabel="Impairment on"
          />
          <div style={{ flex: 1 }} />
          <button
            className="btn btn-primary"
            onClick={handleApply}
            disabled={busy || hasJitterError}
            title={hasJitterError ? 'Set a delay before using jitter' : undefined}
          >
            Apply Impairment
          </button>
          <button className="btn btn-neutral" onClick={handleClear} disabled={busy}>
            Clear
          </button>
        </div>

        {/* ── Duty-cycle row ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          padding: '10px 14px', marginBottom: 14,
          background: cycleEnabled ? 'rgba(10,132,255,0.08)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${cycleEnabled ? 'rgba(10,132,255,0.25)' : 'rgba(255,255,255,0.07)'}`,
          borderRadius: 10,
          transition: 'background .2s, border-color .2s',
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={cycleEnabled}
              onChange={e => {
                const want = e.target.checked
                if (want && !enabled) {
                  flash('Apply impairment settings first before starting a cycle', false)
                  return
                }
                const body = { enabled: want, on_secs: cycleOnSecs, off_secs: cycleOffSecs }
                api.setCycle(link.id, body)
                  .then(() => {
                    setCycleEnabled(want)
                    if (!want) { setCyclePhase(null); setCycleCountdown(0) }
                  })
                  .catch(err => flash(err.message, false))
              }}
              disabled={hasJitterError || busy}
              style={{ width: 15, height: 15, accentColor: '#0a84ff', cursor: 'pointer' }}
            />
            <span style={{
              fontSize: 13, fontWeight: 600,
              color: cycleEnabled ? '#0a84ff' : 'var(--muted)',
              letterSpacing: '-0.01em',
            }}>
              Cycle Impairment
            </span>
          </label>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>On</span>
            <input
              type="number" min={1} max={3600} step={1}
              value={cycleOnSecs}
              onChange={e => setCycleOnSecs(Math.max(1, parseInt(e.target.value) || 1))}
              style={{ width: 62, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
            />
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>s</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Off</span>
            <input
              type="number" min={1} max={3600} step={1}
              value={cycleOffSecs}
              onChange={e => setCycleOffSecs(Math.max(1, parseInt(e.target.value) || 1))}
              style={{ width: 62, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
            />
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>s</span>
          </div>

          {/* Live phase indicator */}
          {cyclePhase && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 2 }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                background: cyclePhase === 'on' ? '#ff9f0a' : 'rgba(255,255,255,0.2)',
                boxShadow: cyclePhase === 'on' ? '0 0 7px rgba(255,159,10,0.8)' : 'none',
              }} />
              <span style={{
                fontSize: 12, fontWeight: 600, letterSpacing: '-0.01em',
                color: cyclePhase === 'on' ? '#ff9f0a' : 'rgba(255,255,255,0.35)',
              }}>
                {cyclePhase === 'on' ? 'Impaired' : 'Clear'} — {cycleCountdown}s
              </span>
            </div>
          )}

          {!cycleEnabled && (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginLeft: 2 }}>
              Runs on server — persists after page close
            </span>
          )}
        </div>

        {/* Jitter error */}
        {hasJitterError && (
          <div style={{
            marginBottom: 12, padding: '8px 14px',
            background: 'var(--danger-tint)',
            border: '1px solid rgba(255,69,58,0.25)',
            borderRadius: 10, fontSize: 12, color: '#ff453a',
          }}>
            Jitter requires a delay value greater than 0.
          </div>
        )}

        {/* ── Impairment table ── */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{
                  textAlign: 'left', padding: '7px 10px',
                  color: 'var(--muted)', fontSize: 11, width: 130,
                  fontWeight: 500, letterSpacing: '0.04em',
                }}>
                  Parameter
                </th>
                <th style={{ textAlign: 'center', padding: '7px 10px', fontSize: 12 }}>
                  <span style={{ color: '#0a84ff', fontWeight: 700, letterSpacing: '-0.01em' }}>A → B</span>
                  <div style={{ fontSize: 10, fontWeight: 400, color: 'var(--muted)', fontFamily: 'ui-monospace, monospace' }}>
                    {link.iface_b}
                  </div>
                </th>
                <th style={{ textAlign: 'center', padding: '7px 10px', fontSize: 12 }}>
                  <span style={{ color: '#bf5af2', fontWeight: 700, letterSpacing: '-0.01em' }}>B → A</span>
                  <div style={{ fontSize: 10, fontWeight: 400, color: 'var(--muted)', fontFamily: 'ui-monospace, monospace' }}>
                    {link.iface_a}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {CORE_FIELDS.map(({ key, label, unit, step, max, hint }) => (
                <tr key={key} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '8px 10px' }}>
                    <div style={{ fontSize: 13, fontWeight: 500, letterSpacing: '-0.01em' }}>{label}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{unit}{hint ? ` · ${hint}` : ''}</div>
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                    {abField(key, step, max)}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                    {baField(key, step, max)}
                  </td>
                </tr>
              ))}

              {/* ── Burst loss rows ── */}
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
                <td style={{ padding: '8px 10px' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, letterSpacing: '-0.01em' }}>Burst Loss</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>GE model</div>
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                  <Toggle value={aToB.burst_loss_enabled}
                    onChange={v => setAToB(d => ({ ...d, burst_loss_enabled: v }))}
                    label="off" activeLabel="on" />
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                  <Toggle value={bToA.burst_loss_enabled}
                    onChange={v => setBToA(d => ({ ...d, burst_loss_enabled: v }))}
                    label="off" activeLabel="on" />
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
                <td style={{ padding: '8px 10px' }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)', paddingLeft: 8 }}>Burst prob %</div>
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                  <input type="number" min={0} max={100} step={0.1}
                    value={aToB.burst_loss_prob} disabled={!aToB.burst_loss_enabled}
                    onChange={e => setAToB(d => ({ ...d, burst_loss_prob: parseFloat(e.target.value) || 0 }))}
                    style={{ width: 82, textAlign: 'right', opacity: aToB.burst_loss_enabled ? 1 : 0.3, fontVariantNumeric: 'tabular-nums' }} />
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                  <input type="number" min={0} max={100} step={0.1}
                    value={bToA.burst_loss_prob} disabled={!bToA.burst_loss_enabled}
                    onChange={e => setBToA(d => ({ ...d, burst_loss_prob: parseFloat(e.target.value) || 0 }))}
                    style={{ width: 82, textAlign: 'right', opacity: bToA.burst_loss_enabled ? 1 : 0.3, fontVariantNumeric: 'tabular-nums' }} />
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                <td style={{ padding: '8px 10px' }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)', paddingLeft: 8 }}>Avg burst len</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)', paddingLeft: 8 }}>packets</div>
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                  <input type="number" min={1} max={1000} step={1}
                    value={aToB.burst_loss_avg_length} disabled={!aToB.burst_loss_enabled}
                    onChange={e => setAToB(d => ({ ...d, burst_loss_avg_length: parseFloat(e.target.value) || 2 }))}
                    style={{ width: 82, textAlign: 'right', opacity: aToB.burst_loss_enabled ? 1 : 0.3, fontVariantNumeric: 'tabular-nums' }} />
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                  <input type="number" min={1} max={1000} step={1}
                    value={bToA.burst_loss_avg_length} disabled={!bToA.burst_loss_enabled}
                    onChange={e => setBToA(d => ({ ...d, burst_loss_avg_length: parseFloat(e.target.value) || 2 }))}
                    style={{ width: 82, textAlign: 'right', opacity: bToA.burst_loss_enabled ? 1 : 0.3, fontVariantNumeric: 'tabular-nums' }} />
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
