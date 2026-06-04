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
            background: 'var(--danger-tint)',
            border: '1px solid rgba(255,69,58,0.25)',
            borderRadius: 'var(--radius)',
            padding: '12px 18px', marginBottom: 24, color: '#ff453a',
          }}>
            <strong>Cannot reach backend:</strong> {error}
            <div style={{ fontSize: 12, marginTop: 4, color: 'rgba(255,69,58,0.6)' }}>
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

        <div style={{ marginTop: 36, textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
          WANEmulator v2 · API docs at{' '}
          <a href="/docs" style={{ color: '#0a84ff', textDecoration: 'none' }}>/docs</a>
          {' '}· <code style={{ color: 'rgba(255,255,255,0.25)', fontFamily: 'ui-monospace, monospace' }}>config.yaml</code>
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
            color: 'var(--muted)', fontSize: 13, letterSpacing: '-0.01em', padding: '0 0 16px 0',
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
