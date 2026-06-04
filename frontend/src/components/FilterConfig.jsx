import React, { useState } from 'react'

const PROTO_OPTIONS = [
  { value: '',     label: 'Any protocol' },
  { value: 'tcp',  label: 'TCP' },
  { value: 'udp',  label: 'UDP' },
  { value: 'icmp', label: 'ICMP' },
]

function Field({ label, hint, children }) {
  return (
    <div style={{ flex: '1 1 140px', minWidth: 120 }}>
      <label style={{ display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>{hint}</div>}
    </div>
  )
}

export default function FilterConfig({ value, onChange, dirLabel }) {
  const [open, setOpen] = useState(false)

  const f = value ?? { enabled: false }
  const set = (patch) => onChange({ ...f, ...patch })

  const activeCount = [f.src_ip, f.dst_ip, f.src_port, f.dst_port,
    f.protocol, f.dscp, f.vlan_id, f.mpls_label]
    .filter(v => v !== undefined && v !== null && v !== '').length

  const isActive = f.enabled && activeCount > 0

  return (
    <div style={{
      border: `1px solid ${isActive ? 'rgba(10,132,255,0.35)' : 'var(--border)'}`,
      borderRadius: 'var(--radius-sm)',
      marginTop: 10,
      overflow: 'hidden',
      transition: 'border-color .2s',
    }}>
      {/* Toggle header */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          padding: '8px 12px',
          background: 'rgba(255,255,255,0.03)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          userSelect: 'none',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.04em' }}>
          Filter — {dirLabel}
        </span>
        {isActive && (
          <span className="badge" style={{ background: 'var(--accent-tint)', color: 'var(--accent)', fontSize: 10 }}>
            {activeCount} {activeCount === 1 ? 'criterion' : 'criteria'}
          </span>
        )}
        {f.enabled && activeCount === 0 && (
          <span className="badge badge-warn" style={{ fontSize: 10 }}>no criteria</span>
        )}
        <div style={{ flex: 1 }} />
        <span style={{ color: 'var(--muted)', fontSize: 11 }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)' }}>

          {/* Enable toggle */}
          <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 9 }}>
            <div
              onClick={() => set({ enabled: !f.enabled })}
              style={{
                width: 38, height: 22, borderRadius: 11,
                background: f.enabled ? '#30d158' : 'rgba(118,118,128,0.32)',
                position: 'relative', cursor: 'pointer',
                transition: 'background .22s',
                flexShrink: 0,
                boxShadow: f.enabled ? '0 0 8px rgba(48,209,88,0.35)' : 'none',
              }}
            >
              <div style={{
                position: 'absolute',
                top: 2, left: f.enabled ? 18 : 2,
                width: 18, height: 18, borderRadius: '50%',
                background: '#ffffff',
                transition: 'left .22s cubic-bezier(.4,0,.2,1)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
              }} />
            </div>
            <span style={{ fontSize: 12, color: f.enabled ? 'var(--accent)' : 'var(--muted)' }}>
              {f.enabled ? 'Filter active — only matching packets are impaired' : 'Filter disabled — all packets impaired'}
            </span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <Field label="Src IP / CIDR" hint="e.g. 10.0.0.0/8">
              <input type="text" value={f.src_ip ?? ''} placeholder="0.0.0.0/0"
                onChange={e => set({ src_ip: e.target.value || undefined })} />
            </Field>

            <Field label="Dst IP / CIDR" hint="e.g. 172.16.0.0/12">
              <input type="text" value={f.dst_ip ?? ''} placeholder="0.0.0.0/0"
                onChange={e => set({ dst_ip: e.target.value || undefined })} />
            </Field>

            <Field label="Protocol">
              <select value={f.protocol ?? ''} onChange={e => set({ protocol: e.target.value || undefined })}>
                {PROTO_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>

            <Field label="Src Port" hint="1–65535">
              <input type="number" min={1} max={65535} value={f.src_port ?? ''}
                placeholder="any"
                onChange={e => set({ src_port: e.target.value ? parseInt(e.target.value) : undefined })} />
            </Field>

            <Field label="Dst Port" hint="e.g. 443, 80, 5060">
              <input type="number" min={1} max={65535} value={f.dst_port ?? ''}
                placeholder="any"
                onChange={e => set({ dst_port: e.target.value ? parseInt(e.target.value) : undefined })} />
            </Field>

            <Field label="DSCP" hint="0–63 (46 = EF/VoIP)">
              <input type="number" min={0} max={63} value={f.dscp ?? ''}
                placeholder="any"
                onChange={e => set({ dscp: e.target.value !== '' ? parseInt(e.target.value) : undefined })} />
            </Field>

            <Field label="VLAN ID" hint="802.1Q, 1–4094">
              <input type="number" min={1} max={4094} value={f.vlan_id ?? ''}
                placeholder="any"
                onChange={e => set({ vlan_id: e.target.value ? parseInt(e.target.value) : undefined })} />
            </Field>

            <Field label="MPLS Label" hint="0–1048575">
              <input type="number" min={0} max={1048575} value={f.mpls_label ?? ''}
                placeholder="any"
                onChange={e => set({ mpls_label: e.target.value !== '' ? parseInt(e.target.value) : undefined })} />
            </Field>
          </div>

          <button
            className="btn btn-ghost"
            style={{ marginTop: 12, fontSize: 11 }}
            onClick={() => set({
              enabled: false, src_ip: undefined, dst_ip: undefined,
              src_port: undefined, dst_port: undefined, protocol: undefined,
              dscp: undefined, vlan_id: undefined, mpls_label: undefined,
            })}
          >
            Clear Filter
          </button>
        </div>
      )}
    </div>
  )
}
