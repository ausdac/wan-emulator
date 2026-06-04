import React, { useState, useEffect } from 'react'
import { api } from '../api.js'

export default function ProfileManager({ links, onApplied }) {
  const [profiles, setProfiles] = useState([])
  const [saveName, setSaveName] = useState('')
  const [saveDesc, setSaveDesc] = useState('')
  const [selected, setSelected] = useState('')
  const [msg,      setMsg]      = useState(null)
  const [busy,     setBusy]     = useState(false)
  const [open,     setOpen]     = useState(false)

  const flash = (text, ok = true) => {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 4000)
  }

  const loadProfiles = async () => {
    try {
      const list = await api.getProfiles()
      setProfiles(list)
      if (list.length && !selected) setSelected(list[0].name)
    } catch {}
  }

  useEffect(() => { if (open) loadProfiles() }, [open])

  const handleSave = async () => {
    if (!saveName.trim()) { flash('Profile name required', false); return }
    setBusy(true)
    try {
      const settings = {}
      for (const link of links) {
        if (link.current_settings) settings[link.id] = link.current_settings
      }
      await api.saveProfile({ name: saveName.trim(), description: saveDesc.trim(), settings })
      flash(`"${saveName}" saved`)
      setSaveName(''); setSaveDesc('')
      loadProfiles()
    } catch (e) { flash(e.message, false) }
    finally { setBusy(false) }
  }

  const handleApply = async () => {
    if (!selected) return
    setBusy(true)
    try {
      await api.applyProfile(selected)
      flash(`"${selected}" applied`)
      onApplied()
    } catch (e) { flash(e.message, false) }
    finally { setBusy(false) }
  }

  const handleDelete = async () => {
    if (!selected) return
    if (!window.confirm(`Delete profile "${selected}"?`)) return
    setBusy(true)
    try {
      await api.deleteProfile(selected)
      flash(`"${selected}" deleted`)
      setSelected('')
      loadProfiles()
    } catch (e) { flash(e.message, false) }
    finally { setBusy(false) }
  }

  const handleExport = async () => {
    if (!selected) return
    try {
      const profile = await api.getProfile(selected)
      const blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `${selected}.json`; a.click()
      URL.revokeObjectURL(url)
    } catch (e) { flash(e.message, false) }
  }

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const profile = JSON.parse(text)
      if (!profile.name || !profile.settings) {
        flash('Invalid profile JSON (needs name + settings)', false); return
      }
      await api.saveProfile({
        name: profile.name,
        description: profile.description ?? '',
        settings: profile.settings,
      })
      flash(`"${profile.name}" imported`)
      loadProfiles()
    } catch (e) { flash(e.message, false) }
    e.target.value = ''
  }

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
      marginTop: 16,
    }}>
      {/* Header toggle */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          padding: '13px 18px',
          background: 'rgba(255,255,255,0.03)',
          borderBottom: open ? '1px solid var(--border)' : 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          userSelect: 'none',
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.01em' }}>
          Profile Manager
        </span>
        <span style={{ color: 'var(--muted)', fontSize: 12 }}>
          {profiles.length ? `${profiles.length} saved` : 'Save & load configurations'}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ padding: '16px 18px' }}>
          {msg && (
            <div style={{
              padding: '9px 14px', borderRadius: 10, marginBottom: 14,
              background: msg.ok ? 'var(--success-tint)' : 'var(--danger-tint)',
              color: msg.ok ? '#30d158' : '#ff453a',
              fontSize: 13, fontWeight: 500,
              border: `1px solid ${msg.ok ? 'rgba(48,209,88,0.2)' : 'rgba(255,69,58,0.2)'}`,
            }}>
              {msg.ok ? '✓' : '✗'} {msg.text}
            </div>
          )}

          {/* ── Save ── */}
          <div style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 11, fontWeight: 600, color: 'var(--muted)',
              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
            }}>
              Save Current Settings
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 160px' }}>
                <label style={{ display: 'block', marginBottom: 5 }}>Profile name</label>
                <input type="text" value={saveName} onChange={e => setSaveName(e.target.value)}
                  placeholder="e.g. satellite-link" />
              </div>
              <div style={{ flex: '2 1 220px' }}>
                <label style={{ display: 'block', marginBottom: 5 }}>Description (optional)</label>
                <input type="text" value={saveDesc} onChange={e => setSaveDesc(e.target.value)}
                  placeholder="Short description" />
              </div>
              <button className="btn btn-primary" onClick={handleSave} disabled={busy}>
                Save
              </button>
            </div>
          </div>

          {/* ── Load / manage ── */}
          <div>
            <div style={{
              fontSize: 11, fontWeight: 600, color: 'var(--muted)',
              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
            }}>
              Load / Manage
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <select value={selected} onChange={e => setSelected(e.target.value)}
                style={{ flex: '1 1 180px' }}>
                {profiles.length === 0 && <option value="">No profiles saved</option>}
                {profiles.map(p => (
                  <option key={p.name} value={p.name}>
                    {p.name}{p.description ? ` — ${p.description}` : ''}
                  </option>
                ))}
              </select>
              <button className="btn btn-success" onClick={handleApply} disabled={busy || !selected}>
                Apply
              </button>
              <button className="btn btn-ghost" onClick={handleExport} disabled={!selected}>
                Export
              </button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={busy || !selected}>
                Delete
              </button>
            </div>

            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                cursor: 'pointer', padding: '6px 16px',
                background: 'rgba(255,255,255,0.08)',
                borderRadius: 980, fontSize: 13, fontWeight: 600,
                color: 'rgba(255,255,255,0.7)',
              }}>
                Import JSON
                <input type="file" accept=".json" onChange={handleImport}
                  style={{ display: 'none' }} />
              </label>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                Import a previously exported profile
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
