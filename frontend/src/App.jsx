import React, { useState, useEffect, useCallback } from 'react'
import Header from './components/Header.jsx'
import LinkCard from './components/LinkCard.jsx'
import ProfileManager from './components/ProfileManager.jsx'
import { api } from './api.js'

export default function App() {
  const [health, setHealth] = useState(null)
  const [links,  setLinks]  = useState([])
  const [error,  setError]  = useState(null)

  const refresh = useCallback(async () => {
    try {
      const [h, l] = await Promise.all([api.health(), api.getLinks()])
      setHealth(h)
      setLinks(l)
      setError(null)
    } catch (e) {
      setError(e.message)
    }
  }, [])

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 8000)
    return () => clearInterval(t)
  }, [refresh])

  return (
    <div style={{ minHeight: '100vh' }}>
      <Header health={health} onRefresh={refresh} />

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
        {error && (
          <div style={{
            background: '#450a0a', border: '1px solid #ef4444', borderRadius: 8,
            padding: '12px 18px', marginBottom: 20, color: '#fca5a5',
          }}>
            <strong>Cannot reach backend:</strong> {error}
            <div style={{ fontSize: 12, marginTop: 4, color: '#9a3412' }}>
              Make sure the WANEmulator service is running on port 8080.
            </div>
          </div>
        )}

        {links.length === 0 && !error && (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
            Loading links…
          </div>
        )}

        {links.map(link => (
          <LinkCard key={link.id} link={link} onStatusChange={refresh} />
        ))}

        <ProfileManager links={links} onApplied={refresh} />

        {/* Footer hint */}
        <div style={{
          marginTop: 32, textAlign: 'center',
          fontSize: 12, color: '#334155',
        }}>
          WANEmulator v1.0 · API docs at{' '}
          <a href="/docs" style={{ color: '#4f8ef7' }}>/docs</a>
          {' '}· Config: <code style={{ color: '#64748b' }}>config.yaml</code>
        </div>
      </main>
    </div>
  )
}
