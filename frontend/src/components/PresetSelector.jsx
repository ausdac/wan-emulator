import React, { useState, useEffect } from 'react'
import { api } from '../api.js'

const CATEGORY_ORDER = ['Mobile', 'Satellite', 'Broadband', 'Wireless', 'WAN', 'Testing']

export default function PresetSelector({ linkId, onApplied, onPreviewParams }) {
  const [presets,  setPresets]  = useState([])
  const [selected, setSelected] = useState('')
  const [busy,     setBusy]     = useState(false)
  const [msg,      setMsg]      = useState(null)

  useEffect(() => {
    api.getPresets().then(list => {
      setPresets(list)
      if (list.length) setSelected(list[0].name)
    }).catch(() => {})
  }, [])

  const flash = (text, ok = true) => {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 3500)
  }

  const handleApply = async () => {
    if (!selected || !linkId) return
    setBusy(true)
    try {
      const r = await api.applyPreset(selected, linkId)
      flash(r.message ?? 'Preset applied', r.success !== false)
      onApplied?.()
    } catch (e) {
      flash(e.message, false)
    } finally {
      setBusy(false)
    }
  }

  const handlePreview = async () => {
    if (!selected) return
    try {
      const p = await api.getPreset(selected)
      onPreviewParams?.(p.params)
    } catch {}
  }

  const grouped = CATEGORY_ORDER.reduce((acc, cat) => {
    const items = presets.filter(p => p.category === cat)
    if (items.length) acc[cat] = items
    return acc
  }, {})

  const description = presets.find(x => x.name === selected)?.description

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8,
      padding: '10px 16px',
      background: 'rgba(255,255,255,0.02)',
      borderBottom: '1px solid var(--border)',
    }}>
      <span style={{
        fontSize: 11, fontWeight: 600, color: 'var(--muted)',
        textTransform: 'uppercase', letterSpacing: '0.06em',
        whiteSpace: 'nowrap',
      }}>
        Quick Preset
      </span>

      <select
        value={selected}
        onChange={e => setSelected(e.target.value)}
        style={{ flex: '1 1 200px', maxWidth: 280 }}
      >
        {Object.entries(grouped).map(([cat, items]) => (
          <optgroup key={cat} label={cat}>
            {items.map(p => (
              <option key={p.name} value={p.name}>{p.name}</option>
            ))}
          </optgroup>
        ))}
      </select>

      {description && (
        <span style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic', flex: '1 1 160px' }}>
          {description}
        </span>
      )}

      <button className="btn btn-ghost" onClick={handlePreview} disabled={!selected}
        style={{ fontSize: 12 }}>
        Preview
      </button>
      <button className="btn btn-primary" onClick={handleApply} disabled={busy || !selected}>
        Apply Preset
      </button>

      {msg && (
        <span style={{
          fontSize: 12, fontWeight: 500,
          color: msg.ok ? '#30d158' : '#ff453a',
          whiteSpace: 'nowrap',
        }}>
          {msg.ok ? '✓' : '✗'} {msg.text}
        </span>
      )}
    </div>
  )
}
