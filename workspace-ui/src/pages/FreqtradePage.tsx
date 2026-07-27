/**
 * FreqtradePage.tsx — Embeds Freqtrade Web UI into the Workspace
 *
 * Uses an iframe to display the running Freqtrade instance at port 8082.
 * No CORS/X-Frame-Options issues — Freqtrade's API server has neither header set.
 *
 * @since 4.9
 */

export function FreqtradePage() {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Lightweight toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '8px 16px',
        background: 'var(--bg-secondary, #111125)',
        borderBottom: '1px solid var(--border-color, #2a2a4a)',
        fontSize: '12px', color: '#888',
      }}>
        <span style={{ fontWeight: 600, color: '#ccc' }}>🤖 Freqtrade</span>
        <span>·</span>
        <span>fft-micro</span>
        <span>·</span>
        <a
          href="http://localhost:8082/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#60a5fa', textDecoration: 'none' }}
        >
          Open in new tab ↗
        </a>
      </div>

      {/* iframe */}
      <iframe
        src="http://localhost:8082/"
        style={{
          width: '100%',
          flex: 1,
          border: 'none',
          background: '#fff',
        }}
        title="Freqtrade UI"
        sandbox="allow-scripts allow-forms allow-same-origin"
      />
    </div>
  )
}

export default FreqtradePage
