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
      <label style={{ display: 'block', marginBottom: 3 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{hint}</div>}
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

  return (
    <div style={{
      border: `1px solid ${f.enabled && activeCount > 0 ? '#4f8ef7' : 'var(--border)'}`,
      borderRadius: 6,
      marginTop: 10,
      overflow: 'hidden',
    }}>
      {/* Toggle header */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          padding: '7px 12px',
          background: '#0f1420',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          userSelect: 'none',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .5 }}>
          ⚙ Filter — {dirLabel}
        </span>
        {f.enabled && activeCount > 0 && (
          <span className="badge badge-up" style={{ fontSize: 10 }}>
            {activeCount} criteria
          </span>
        )}
        {f.enabled && activeCount === 0 && (
          <span className="badge badge-warn" style={{ fontSize: 10 }}>enabled, no criteria</span>
        )}
        <div style={{ flex: 1 }} />
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ padding: '12px 14px', background: '#0a0e1a' }}>
          {/* Enable toggle */}
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              onClick={() => set({ enabled: !f.enabled })}
              style={{
                width: 36, height: 20, borderRadius: 10,
                background: f.enabled ? 'var(--accent)' : 'var(--border)',
                position: 'relative', cursor: 'pointer', transition: 'background .2s', flexShrink: 0,
              }}
            >
              <div style={{
                position: 'absolute', top: 2, left: f.enabled ? 18 : 2,
                width: 16, height: 16, borderRadius: '50%',
                background: '#fff', transition: 'left .2s',
              }} />
            </div>
            <span style={{ fontSize: 12, color: f.enabled ? 'var(--accent)' : 'var(--muted)' }}>
              {f.enabled ? 'Filter active — only matching packets are impaired' : 'Filter disabled — all packets impaired'}
            </span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <Field label="Src IP / CIDR" hint="e.g. 10.0.0.0/8 or 192.168.1.5">
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

            <Field label="DSCP" hint="0–63 (e.g. 46 = EF/VoIP)">
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
            style={{ marginTop: 10, fontSize: 11 }}
            onClick={() => set({
              enabled: false, src_ip: undefined, dst_ip: undefined,
              src_port: undefined, dst_port: undefined, protocol: undefined,
              dscp: undefined, vlan_id: undefined, mpls_label: undefined,
            })}
          >
            Clear filter
          </button>
        </div>
      )}
    </div>
  )
}
