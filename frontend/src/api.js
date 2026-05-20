/**
 * WANEmulator V2 API client.
 * All paths are relative (same-origin in production; dev proxy rewrites to backend).
 */

async function req(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } }
  if (body !== undefined) opts.body = JSON.stringify(body)
  const res = await fetch(path, opts)
  if (!res.ok) {
    const text = await res.text()
    let detail = text
    try { detail = JSON.parse(text).detail ?? text } catch {}
    throw new Error(`${res.status} ${res.statusText}: ${detail}`)
  }
  return res.json()
}

export const api = {
  // Core
  health:        ()           => req('GET',    '/health'),
  getLinks:      ()           => req('GET',    '/links'),
  setupLink:     (id)         => req('POST',   `/links/${id}/setup`),
  setImpairment: (id, body)   => req('POST',   `/links/${id}/impairment`, body),
  resetLink:     (id)         => req('POST',   `/links/${id}/reset`),

  // Stats (V1 raw + V2 live structured)
  getStats:      (id)         => req('GET',    `/links/${id}/stats`),
  getLiveStats:  (id)         => req('GET',    `/links/${id}/stats/live`),

  // Profiles
  getProfiles:   ()           => req('GET',    '/profiles'),
  saveProfile:   (body)       => req('POST',   '/profiles', body),
  getProfile:    (name)       => req('GET',    `/profiles/${encodeURIComponent(name)}`),
  applyProfile:  (name)       => req('POST',   `/profiles/${encodeURIComponent(name)}/apply`),
  deleteProfile: (name)       => req('DELETE', `/profiles/${encodeURIComponent(name)}`),

  // Presets (V2)
  getPresets:    ()           => req('GET',    '/presets'),
  getPreset:     (name)       => req('GET',    `/presets/${encodeURIComponent(name)}`),
  applyPreset:   (name, id)   => req('POST',   `/presets/${encodeURIComponent(name)}/apply/${id}`),

  // Labels (V1.1)
  setLabel:      (id, label)  => req('PUT',    `/links/${id}/label`, { label }),
}
