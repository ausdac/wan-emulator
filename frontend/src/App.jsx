import React, { useState, useEffect, useCallback } from 'react'
import Header from './components/Header.jsx'
import LinkCard from './components/LinkCard.jsx'
import LinkOverviewCard from './components/LinkOverviewCard.jsx'
import ProfileManager from './components/ProfileManager.jsx'
import { api } from './api.js'

// ── Overview page ─────────────────────────────────────────────────────────────
function OverviewPage({ health, links, error, onConfigure, onRefresh }) {
  return (
    <div style={{ minHeight: '100vh' }}>
      <Header health={health} onRefresh={onRefresh} />
      <main style={{ maxWidth: 860, margin: '0 auto', padding: '32px 16px' }}>

        {error && (
          <div style={{
            background: '#450a0a', border: '1px solid #ef4444', borderRadius: 8,
            padding: '12px 18px', marginBottom: 24, color: '#fca5a5',
          }}>
            <strong>Cannot reach backend:</strong> {error}
            <div style={{ fontSize: 12, marginTop: 4, color: '#9a3412' }}>
              Make sure the WANEmulator service is running on port 8080.
            </div>
          </div>
        )}

        {links.length === 0 && !error && (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
            Loading…
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {links.map(link => (
            <LinkOverviewCard
              key={link.id}
              link={link}
              onConfigure={onConfigure}
            />
          ))}
        </div>

        {links.length > 0 && (
          <ProfileManager links={links} onApplied={onRefresh} />
        )}

        <div style={{ marginTop: 32, textAlign: 'center', fontSize: 12, color: '#334155' }}>
          WANEmulator v1.1 · API docs at{' '}
          <a href="/docs" style={{ color: '#4f8ef7' }}>/docs</a>
          {' '}· Config: <code style={{ color: '#64748b' }}>config.yaml</code>
        </div>
      </main>
    </div>
  )
}

// ── Detail page ───────────────────────────────────────────────────────────────
function DetailPage({ health, link, onBack, onRefresh }) {
  return (
    <div style={{ minHeight: '100vh' }}>
      <Header health={health} onRefresh={onRefresh} />
      <main style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px' }}>

        {/* Back nav */}
        <button
          onClick={onBack}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--muted)', fontSize: 13, padding: '0 0 16px 0',
            transition: 'color .15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#e2e8f0'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--muted)'}
        >
          ← All Links
        </button>

        <LinkCard link={link} onStatusChange={onRefresh} />
      </main>
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [health,         setHealth]         = useState(null)
  const [links,          setLinks]          = useState([])
  const [error,          setError]          = useState(null)
  const [selectedLinkId, setSelectedLinkId] = useState(null)

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

  const selectedLink = links.find(l => l.id === selectedLinkId) ?? null

  if (selectedLink) {
    return (
      <DetailPage
        health={health}
        link={selectedLink}
        onBack={() => setSelectedLinkId(null)}
        onRefresh={refresh}
      />
    )
  }

  return (
    <OverviewPage
      health={health}
      links={links}
      error={error}
      onConfigure={setSelectedLinkId}
      onRefresh={refresh}
    />
  )
}
