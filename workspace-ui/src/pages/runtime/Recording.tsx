import { useState } from 'react'

const C = {
  bg: '#0B0E14', card: '#151922', border: '#1E2433',
  text: '#E2E8F0', muted: '#64748B', accent: '#3B82F6',
  green: '#22C55E', red: '#EF4444', yellow: '#EAB308',
  key: '#818CF8', input: '#0F131A',
}

// ── Recording ────────────────────────────────────────────────────────
export function Recording() {
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [profiles, setProfiles] = useState<{ name: string; time: string; dur: string; size: string }[]>([
    { name: 'market-peak-12-30',     time: '12:30:15', dur: '34.2s', size: '2.4 MB' },
    { name: 'strategy-bench-12-35',  time: '12:35:00', dur: '60.0s', size: '4.1 MB' },
    { name: 'heatmap-performance',   time: '12:28:44', dur: '15.3s', size: '1.1 MB' },
  ])
  const [selectedProfile, setSelectedProfile] = useState<number | null>(null)

  const startRecording = () => {
    setRecording(true)
    setElapsed(0)
    const interval = setInterval(() => {
      setElapsed(e => {
        if (e >= 60) {
          clearInterval(interval)
          setRecording(false)
          // Auto-save
          setProfiles(prev => [{
            name: `profile-${new Date().toLocaleTimeString('en-US', { hour12: false }).replace(/:/g, '-')}`,
            time: new Date().toLocaleTimeString('en-US', { hour12: false }),
            dur: `${e}s`,
            size: `${(e * 0.07).toFixed(1)} MB`,
          }, ...prev])
          return 0
        }
        return e + 1
      })
    }, 1000)
  }

  const stopRecording = () => {
    setRecording(false)
    if (elapsed > 5) {
      setProfiles(prev => [{
        name: `profile-${new Date().toLocaleTimeString('en-US', { hour12: false }).replace(/:/g, '-')}`,
        time: new Date().toLocaleTimeString('en-US', { hour12: false }),
        dur: `${elapsed.toFixed(1)}s`,
        size: `${(elapsed * 0.07).toFixed(1)} MB`,
      }, ...prev])
    }
    setElapsed(0)
  }

  const loadProfile = () => {
    // Visual feedback only
  }

  return (
    <div style={{ display: 'flex', gap: 12, height: '100%', minHeight: 250 }}>
      {/* Left: recorder */}
      <div style={{
        flex: 1, maxWidth: 320, background: C.card, borderRadius: 6, border: `1px solid ${C.border}`,
        padding: 16, display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'center',
        alignItems: 'center',
      }}>
        {/* Recording indicator */}
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: recording ? C.red + '22' : C.input,
          border: `2px solid ${recording ? C.red : C.border}`,
          transition: 'all 0.2s',
        }}>
          <span style={{
            width: recording ? 30 : 40, height: recording ? 30 : 40,
            borderRadius: recording ? 4 : '50%',
            background: recording ? C.red : C.muted,
            transition: 'all 0.2s',
          }} />
        </div>

        {/* Timer */}
        <div style={{
          fontSize: 32, fontWeight: 700, fontFamily: 'monospace',
          color: recording ? C.red : C.text,
        }}>
          {recording ? `${elapsed}s` : '—'}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 8 }}>
          {!recording ? (
            <button onClick={startRecording}
              style={{
                padding: '8px 24px', border: 'none', borderRadius: 6,
                background: C.red, color: '#fff', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#fff' }} />
              Start Recording
            </button>
          ) : (
            <button onClick={stopRecording}
              style={{
                padding: '8px 24px', border: 'none', borderRadius: 6,
                background: C.red + '22', color: C.red, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <span style={{ width: 10, height: 10, background: C.red, borderRadius: 2 }} />
              Stop
            </button>
          )}
        </div>

        <div style={{ fontSize: 10, color: C.muted, textAlign: 'center' }}>
          Profiles are auto-saved on stop
        </div>
      </div>

      {/* Right: profile list */}
      <div style={{
        flex: 2, background: C.card, borderRadius: 6, border: `1px solid ${C.border}`,
        padding: 12, display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>
            Saved Profiles · <span style={{ color: C.accent }}>{profiles.length}</span>
          </span>
          <button onClick={loadProfile}
            style={{
              padding: '3px 10px', border: 'none', borderRadius: 3,
              background: C.accent, color: '#fff', fontSize: 11, cursor: 'pointer',
            }}
          >
            Load
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {profiles.map((p, i) => (
            <button
              key={i}
              onClick={() => setSelectedProfile(selectedProfile === i ? null : i)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '7px 10px', border: 'none', textAlign: 'left',
                background: selectedProfile === i ? C.input : 'transparent',
                color: C.text, fontSize: 11, cursor: 'pointer', borderRadius: 3,
                border: `1px solid ${selectedProfile === i ? C.accent + '44' : 'transparent'}`,
              }}
            >
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: i === 0 ? C.accent : C.muted, flexShrink: 0,
              }} />
              <div style={{ flex: 1 }}>
                <div style={{
                  fontFamily: 'monospace', fontWeight: selectedProfile === i ? 600 : 400,
                }}>
                  {p.name}
                </div>
                <div style={{ color: C.muted, fontSize: 10 }}>
                  {p.time} · {p.dur} · {p.size}
                </div>
              </div>
              <span style={{ fontSize: 10, color: C.muted }}>↗</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
