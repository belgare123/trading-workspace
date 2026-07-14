import { useState, useRef, useEffect } from 'react'
import { useLayouts } from '../layouts/LayoutProvider'
import type { WorkspaceLayout } from '../layouts/types'

// ── Layout Switcher ────────────────────────────────────────────────

export function LayoutSwitcher() {
  const {
    layouts,
    activeId,
    switchLayout,
    createLayout,
    duplicateLayout,
    deleteLayout,
    resetLayouts,
    exportLayout,
    importLayout,
  } = useLayouts()

  const [open, setOpen] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importError, setImportError] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const activeLayout: WorkspaceLayout | undefined = layouts.find((l: WorkspaceLayout) => l.id === activeId)

  const handleCreate = () => {
    if (!nameInput.trim()) return
    createLayout(nameInput.trim())
    setNameInput('')
    setShowCreate(false)
  }

  const handleExport = (id: string) => {
    try {
      const json = exportLayout(id)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `layout-${id}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed:', err)
    }
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        importLayout(text)
        setShowImport(false)
        setImportError('')
      } catch {
        setImportError('Invalid layout file')
      }
    }
    input.click()
  }

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        title="Switch workspace layout"
        aria-label={`Workspace layout: ${activeLayout?.name ?? 'Default'}, click to switch`}
        aria-expanded={open}
        aria-haspopup="menu"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          fontSize: 12,
          color: '#e4e8ee',
          background: open ? '#25262b' : 'transparent',
          border: '1px solid #2c2e33',
          borderRadius: 6,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        <span>📐</span>
        <span>{activeLayout?.name ?? 'Layout'}</span>
        <span style={{ fontSize: 8, color: '#5b6a7a' }}>▼</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            width: 240,
            background: '#1a1b1e',
            border: '1px solid #2c2e33',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            zIndex: 600,
            overflow: 'hidden',
          }}
        >
          {/* Layout list */}
          <div style={{ padding: 6 }}>
            {layouts.map((layout: WorkspaceLayout) => (
              <div
                key={layout.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  background: layout.id === activeId ? '#25262b' : 'transparent',
                  color: layout.id === activeId ? '#e4e8ee' : '#8892a4',
                }}
                onClick={() => {
                  switchLayout(layout.id)
                  setOpen(false)
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{layout.name}</div>
                  <div style={{ fontSize: 10, color: '#5b6a7a' }}>
                    {layout.views.active} · {layout.panels.timeline ? 'timeline' : 'no timeline'}
                  </div>
                </div>

                {layout.id !== 'default' && (
                  <div style={{ display: 'flex', gap: 2 }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        duplicateLayout(layout.id, `${layout.name} (copy)`)
                      }}
                      title="Duplicate"
                      style={smallBtnStyle}
                    >
                      📋
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleExport(layout.id)
                      }}
                      title="Export"
                      style={smallBtnStyle}
                    >
                      📤
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm(`Delete "${layout.name}"?`)) {
                          deleteLayout(layout.id)
                        }
                      }}
                      title="Delete"
                      style={smallBtnStyle}
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Actions */}
          <div
            style={{
              borderTop: '1px solid #2c2e33',
              padding: 6,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            {/* Create new */}
            {showCreate ? (
              <div style={{ display: 'flex', gap: 4, padding: '4px 0' }}>
                <input
                  autoFocus
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  placeholder="Layout name..."
                  style={{
                    flex: 1,
                    padding: '4px 8px',
                    fontSize: 12,
                    background: '#25262b',
                    border: '1px solid #3b82f6',
                    borderRadius: 4,
                    color: '#e4e8ee',
                    outline: 'none',
                  }}
                />
                <button onClick={handleCreate} style={actionBtnStyle}>
                  Create
                </button>
                <button onClick={() => setShowCreate(false)} style={actionBtnStyle}>
                  ✕
                </button>
              </div>
            ) : (
              <button onClick={() => setShowCreate(true)} style={menuBtnStyle}>
                + New Layout
              </button>
            )}

            {/* Import */}
            {showImport ? (
              <div>
                {importError && (
                  <div style={{ fontSize: 10, color: '#ef4444', padding: '2px 8px' }}>
                    {importError}
                  </div>
                )}
                <button onClick={handleImport} style={menuBtnStyle}>
                  Select file...
                </button>
                <button onClick={() => setShowImport(false)} style={menuBtnStyle}>
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setShowImport(true)} style={menuBtnStyle}>
                📥 Import Layout
              </button>
            )}

            <button onClick={resetLayouts} style={menuBtnStyle}>
              🔄 Reset to Defaults
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Base styles ────────────────────────────────────────────────────

const smallBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontSize: 11,
  padding: '2px 4px',
  borderRadius: 3,
  opacity: 0.6,
}

const menuBtnStyle: React.CSSProperties = {
  width: '100%',
  textAlign: 'left',
  padding: '5px 8px',
  fontSize: 11,
  color: '#8892a4',
  background: 'transparent',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
}

const actionBtnStyle: React.CSSProperties = {
  padding: '4px 8px',
  fontSize: 11,
  background: '#25262b',
  border: '1px solid #2c2e33',
  borderRadius: 4,
  color: '#e4e8ee',
  cursor: 'pointer',
}
