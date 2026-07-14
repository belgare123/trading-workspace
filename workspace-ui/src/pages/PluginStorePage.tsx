import { useEffect, useState, useCallback, useRef } from 'react'
import type { PluginSummary, PluginDetail, Category } from '../types'
import { getPlugins, getPluginDetail, getCategories, installPlugin, removePlugin, updatePlugin, getUpdates } from '../api/plugins'

const TRUST_COLORS: Record<string, { label: string; color: string; icon: string; bg: string }> = {
  official: { label: 'Official', color: '#58a6ff', icon: '🟢', bg: 'rgba(88,166,255,0.12)' },
  verified: { label: 'Verified', color: '#3fb950', icon: '🟢', bg: 'rgba(63,185,80,0.12)' },
  community: { label: 'Community', color: '#d29922', icon: '🟡', bg: 'rgba(210,153,34,0.12)' },
  experimental: { label: 'Experimental', color: '#f0883e', icon: '🟠', bg: 'rgba(240,136,62,0.12)' },
  untrusted: { label: 'Untrusted', color: '#f85149', icon: '🔴', bg: 'rgba(248,81,73,0.12)' },
  unsafe: { label: 'Unsafe', color: '#da3633', icon: '⚫', bg: 'rgba(218,54,51,0.12)' },
}

function nl2br(text: string) {
  return text.split('\n').map((line, i) => <span key={i}>{line}<br /></span>)
}

export default function PluginStorePage() {
  // Data state
  const [plugins, setPlugins] = useState<PluginSummary[]>([])
  const [detail, setDetail] = useState<PluginDetail | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

  // Filter state
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [trust, setTrust] = useState('')
  const [showInstalled, setShowInstalled] = useState(false)

  // Detail panel visibility
  const [detailVisible, setDetailVisible] = useState(true)
  const detailRef = useRef<HTMLDivElement>(null)

  // Updates tab
  const [activeTab, setActiveTab] = useState<'browse' | 'updates'>('browse')
  const [updates, setUpdates] = useState<{ name: string; display_name: string; installed_version: string; latest_version: string; icon: string; trust_level: string }[]>([])
  const [updatesLoading, setUpdatesLoading] = useState(false)

  // Load plugins
  const loadPlugins = useCallback(async () => {
    try {
      const data = await getPlugins(category || undefined, search || undefined, trust || undefined)
      setPlugins(data)
    } catch { /* ignore */ }
    setInitialLoading(false)
  }, [category, search, trust])

  // Load categories once
  useEffect(() => {
    getCategories().then(setCategories).catch(() => {})
  }, [])

  // Load updates when tab switches to updates
  useEffect(() => {
    if (activeTab === 'updates') {
      setUpdatesLoading(true)
      getUpdates().then(setUpdates).catch(() => setUpdates([])).finally(() => setUpdatesLoading(false))
    }
  }, [activeTab])

  // Reload plugins when filters change
  useEffect(() => {
    loadPlugins()
  }, [loadPlugins])

  // Load detail
  const openDetail = useCallback(async (name: string) => {
    setDetailLoading(true)
    setDetailVisible(true)
    try {
      const data = await getPluginDetail(name)
      setDetail(data)
    } catch {
      setDetail(null)
    }
    setDetailLoading(false)
  }, [])

  // Install/Remove/Update handlers
  const handleInstall = useCallback(async (name: string) => {
    await installPlugin(name)
    openDetail(name)
    loadPlugins()
  }, [openDetail, loadPlugins])

  const handleRemove = useCallback(async (name: string) => {
    await removePlugin(name)
    openDetail(name)
    loadPlugins()
  }, [openDetail, loadPlugins])

  const handleUpdate = useCallback(async (name: string) => {
    await updatePlugin(name)
    openDetail(name)
    loadPlugins()
  }, [openDetail, loadPlugins])

  // Filter for installed
  const filteredPlugins = showInstalled
    ? plugins.filter(p => p.name === detail?.name ? detail?.installed : false)
    : plugins

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--bg-primary)' }}>
      {/* ── Header: Search + Filters ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}>
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none" style={{ color: 'var(--text-tertiary)' }}>🔍</span>
          <input
            type="text"
            placeholder="Search packages..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border px-8 py-1.5 text-sm outline-none transition-all"
            style={{
              background: 'var(--bg-primary)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
            onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
            onBlur={e => { e.target.style.borderColor = 'var(--border-color)' }}
          />
          {search && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs cursor-pointer"
              style={{ color: 'var(--text-tertiary)' }}
              onClick={() => setSearch('')}
            >✕</button>
          )}
        </div>

        {/* Category filter */}
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="rounded-lg border px-3 py-1.5 text-sm outline-none cursor-pointer"
          style={{
            background: 'var(--bg-primary)',
            borderColor: 'var(--border-color)',
            color: 'var(--text-primary)',
          }}
        >
          <option value="">All Categories</option>
          {categories.map(c => (
            <option key={c.name} value={c.name}>{c.name} ({c.count})</option>
          ))}
        </select>

        {/* Trust filter */}
        <select
          value={trust}
          onChange={e => setTrust(e.target.value)}
          className="rounded-lg border px-3 py-1.5 text-sm outline-none cursor-pointer"
          style={{
            background: 'var(--bg-primary)',
            borderColor: 'var(--border-color)',
            color: 'var(--text-primary)',
          }}
        >
          <option value="">All Trust</option>
          {Object.entries(TRUST_COLORS).map(([k, v]) => (
            <option key={k} value={k}>{v.icon} {v.label}</option>
          ))}
        </select>

        {/* Installed toggle */}
        <button
          onClick={() => setShowInstalled(!showInstalled)}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm cursor-pointer transition-all"
          style={{
            background: showInstalled ? 'var(--accent)' : 'var(--bg-primary)',
            borderColor: showInstalled ? 'var(--accent)' : 'var(--border-color)',
            color: showInstalled ? '#fff' : 'var(--text-primary)',
          }}
        >
          {showInstalled ? '✓' : ''} Installed
        </button>

        {/* Toggle detail panel */}
        <button
          onClick={() => setDetailVisible(!detailVisible)}
          className="ml-auto rounded-lg border px-3 py-1.5 text-sm cursor-pointer"
          style={{
            background: 'var(--bg-primary)',
            borderColor: 'var(--border-color)',
            color: 'var(--text-secondary)',
          }}
          title="Toggle detail panel"
        >
          {detailVisible ? '▸ List Only' : '◂ Show Details'}
        </button>
      </div>

      {/* ── Tab bar: Browse | Updates ── */}
      <div className="flex shrink-0 border-b" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)', padding: '0 16px' }}>
        <button
          onClick={() => setActiveTab('browse')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-all cursor-pointer`}
          style={{
            color: activeTab === 'browse' ? 'var(--accent)' : 'var(--text-secondary)',
            borderBottomColor: activeTab === 'browse' ? 'var(--accent)' : 'transparent',
          }}
        >Browse</button>
        <button
          onClick={() => { setActiveTab('updates'); setDetailVisible(false) }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-all cursor-pointer`}
          style={{
            color: activeTab === 'updates' ? 'var(--accent)' : 'var(--text-secondary)',
            borderBottomColor: activeTab === 'updates' ? 'var(--accent)' : 'transparent',
          }}
        >
          Updates
          {updates.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full" style={{ background: 'var(--accent)', color: '#fff' }}>
              {updates.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Main Content ── */}
      {activeTab === 'updates' ? (
        /* ── Updates View ── */
        <div className="flex-1 overflow-y-auto p-4">
          {updatesLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-6 w-6 border-2" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
            </div>
          ) : updates.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--text-tertiary)' }}>
              All packages are up to date ✓
            </div>
          ) : (
            <div className="max-w-xl mx-auto space-y-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Available Updates</h3>
                <button
                  onClick={async () => {
                    for (const u of updates) await updatePlugin(u.name)
                    const fresh = await getUpdates()
                    setUpdates(fresh)
                  }}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-all"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >Update All ({updates.length})</button>
              </div>
              {updates.map(u => (
                <div key={u.name} className="flex items-center gap-3 rounded-xl p-3 border" style={{
                  background: 'var(--bg-secondary)',
                  borderColor: 'var(--border-color)',
                }}>
                  <span className="text-xl">{u.icon}</span>
                  <div className="flex-1">
                    <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{u.display_name}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                      {u.installed_version} <span style={{ color: 'var(--text-secondary)' }}>→</span> <strong style={{ color: 'var(--accent)' }}>{u.latest_version}</strong>
                    </div>
                  </div>
                  <button
                    onClick={async () => { await updatePlugin(u.name); const fresh = await getUpdates(); setUpdates(fresh) }}
                    className="px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all border shrink-0"
                    style={{
                      background: 'rgba(88,166,255,0.1)',
                      borderColor: 'rgba(88,166,255,0.3)',
                      color: '#58a6ff',
                    }}
                  >Update</button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ── Browse View (existing two-panel layout) ── */
        <div className="flex flex-1 min-h-0">
        {/* Left: Package List */}
        <div className={`overflow-y-auto ${detailVisible ? 'w-1/3 min-w-[320px]' : 'flex-1'}`}
          style={{ borderRight: detailVisible ? '1px solid var(--border-color)' : 'none' }}>
          {initialLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-6 w-6 border-2" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
            </div>
          ) : filteredPlugins.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--text-tertiary)' }}>
              No packages found
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredPlugins.map(pkg => {
                const t = TRUST_COLORS[pkg.trust_level] || TRUST_COLORS.community
                const isSelected = detail?.name === pkg.name
                return (
                  <div
                    key={pkg.name}
                    onClick={() => openDetail(pkg.name)}
                    className="flex items-start gap-3 rounded-lg p-3 cursor-pointer transition-all"
                    style={{
                      background: isSelected ? 'var(--bg-hover)' : 'transparent',
                      outline: isSelected ? '1px solid var(--accent)' : '1px solid transparent',
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-hover)' }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                  >
                    {/* Icon */}
                    <span className="text-2xl shrink-0 mt-0.5">{pkg.icon}</span>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{pkg.display_name}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded shrink-0" style={{ background: t.bg, color: t.color }}>{t.label}</span>
                      </div>
                      <div className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{pkg.description}</div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        <span>{pkg.author}</span>
                        <span>v{pkg.latest_version}</span>
                        <span>{pkg.install_count.toLocaleString()} installs</span>
                        <span>{pkg.stars_display}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right: Package Detail */}
        {detailVisible && (
          <div ref={detailRef} className="flex-1 overflow-y-auto bg-[var(--bg-primary)]">
            {detailLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-6 w-6 border-2" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
              </div>
            ) : detail ? (
              <div className="p-6 space-y-6 max-w-2xl">
                {/* ── Header ── */}
                <div className="flex items-start gap-4">
                  <span className="text-4xl">{detail.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{detail.display_name}</h2>
                      {detail.trust && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
                          style={{ background: `${detail.trust.color}20`, color: detail.trust.color, border: `1px solid ${detail.trust.color}40` }}>
                          {detail.trust.icon} {detail.trust.label}
                        </span>
                      )}
                      {detail.installed ? (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
                          style={{ background: 'rgba(63,185,80,0.12)', color: '#3fb950', border: '1px solid rgba(63,185,80,0.3)' }}>
                          ✓ Installed
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
                          style={{ background: 'rgba(139,148,158,0.12)', color: 'var(--text-tertiary)', border: '1px solid rgba(139,148,158,0.3)' }}>
                          Not installed
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <span>by {detail.author}</span>
                      <span>v{detail.latest_version}</span>
                      <span>{detail.license}</span>
                      <span>{detail.package_type}</span>
                    </div>
                    {/* Tags */}
                    {detail.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {detail.tags.map(tag => (
                          <span key={tag} className="text-xs px-2 py-0.5 rounded"
                            style={{ background: 'var(--bg-hover)', color: 'var(--text-tertiary)' }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Action Buttons ── */}
                <div className="flex gap-2">
                  {detail.installed ? (
                    <>
                      <button
                        onClick={() => handleRemove(detail.name)}
                        className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all border"
                        style={{
                          background: 'rgba(248,81,73,0.1)',
                          borderColor: 'rgba(248,81,73,0.3)',
                          color: '#f85149',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,81,73,0.2)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(248,81,73,0.1)' }}
                      >Remove</button>
                      <button
                        onClick={() => handleUpdate(detail.name)}
                        className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all border"
                        style={{
                          background: 'rgba(88,166,255,0.1)',
                          borderColor: 'rgba(88,166,255,0.3)',
                          color: '#58a6ff',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(88,166,255,0.2)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(88,166,255,0.1)' }}
                      >Update</button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleInstall(detail.name)}
                      className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all"
                      style={{
                        background: 'var(--accent)',
                        color: '#fff',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
                    >Install</button>
                  )}
                </div>

                {/* ── Passport ── */}
                {detail.passport && (
                  <div className="rounded-xl p-4 border" style={{
                    background: 'var(--bg-secondary)',
                    borderColor: 'var(--border-color)',
                  }}>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                      🛂 Strategy Passport
                    </h3>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                      <Row label="Version" value={`v${detail.passport.version}`} />
                      <Row label="Author" value={detail.passport.author} />
                      <Row label="Type" value={detail.passport.strategy_type} />
                      <Row label="Signed" value="✓" color="#3fb950" />
                      {detail.passport.trust_level && (
                        <Row label="Trust" value={detail.passport.trust_level} />
                      )}
                      <Row label="License" value={detail.passport.license} />
                      {detail.passport.timeframes.length > 0 && (
                        <Row label="Timeframes" value={detail.passport.timeframes.join(', ')} />
                      )}
                      {detail.passport.exchanges.length > 0 && (
                        <Row label="Exchanges" value={detail.passport.exchanges.join(', ')} />
                      )}
                    </div>
                    {/* Rating */}
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
                      <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                        ⭐ {detail.passport.rating} ({detail.passport.rating_count})
                      </span>
                      {detail.community && (
                        <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                          👥 {detail.community.active_users.toLocaleString()} active users
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Description / README ── */}
                <div>
                  <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>README</h3>
                  <div className="text-sm leading-relaxed rounded-xl p-4 border" style={{
                    color: 'var(--text-secondary)',
                    background: 'var(--bg-secondary)',
                    borderColor: 'var(--border-color)',
                  }}>
                    {nl2br(detail.description)}
                  </div>
                </div>

                {/* ── Capabilities ── */}
                {detail.passport && detail.passport.indicators.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Capabilities</h3>
                    <div className="flex flex-wrap gap-2">
                      {detail.passport.indicators.map(ind => (
                        <span key={ind} className="text-xs px-2.5 py-1 rounded-lg border" style={{
                          background: 'rgba(63,185,80,0.08)',
                          borderColor: 'rgba(63,185,80,0.25)',
                          color: '#3fb950',
                        }}>
                          ✓ {ind}
                        </span>
                      ))}
                      {detail.passport.features_used.map(f => (
                        <span key={f} className="text-xs px-2.5 py-1 rounded-lg border" style={{
                          background: 'rgba(88,166,255,0.08)',
                          borderColor: 'rgba(88,166,255,0.25)',
                          color: '#58a6ff',
                        }}>
                          ✓ {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Versions ── */}
                {detail.versions && detail.versions.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Versions</h3>
                    <div className="text-sm rounded-xl border" style={{ borderColor: 'var(--border-color)', overflow: 'hidden' }}>
                      {detail.versions.slice(-3).reverse().map((ver, i) => {
                        // Find which channel this version belongs to
                        let channelLabel = ''
                        if (detail.channels) {
                          for (const [ch, vers] of Object.entries(detail.channels)) {
                            if (Array.isArray(vers) && vers.includes(ver)) {
                              channelLabel = ch
                              break
                            }
                          }
                        }
                        return (
                          <div key={ver} className="px-4 py-2.5 flex items-center justify-between" style={{
                            borderBottom: i < Math.min(detail.versions.length, 3) - 1 ? '1px solid var(--border-color)' : 'none',
                            background: i === 0 ? 'var(--bg-secondary)' : 'transparent',
                          }}>
                            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>v{ver}</span>
                            {channelLabel && (
                              <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--bg-hover)', color: 'var(--text-tertiary)' }}>
                                {channelLabel}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* ── Benchmarks ── */}
                {detail.benchmarks && detail.benchmarks.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Benchmarks</h3>
                    {detail.benchmarks.map((b, i) => (
                      <div key={i} className="rounded-xl p-4 mb-3 border" style={{
                        background: 'var(--bg-secondary)',
                        borderColor: 'var(--border-color)',
                      }}>
                        <div className="flex items-center gap-2 text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
                          <span>{b.symbol} · {b.timeframe}</span>
                          <span>{b.period}</span>
                        </div>
                        <div className="grid grid-cols-4 gap-3 text-center">
                          <BenchStat label="Return" value={`${b.winrate.toFixed(1)}%`} color="#3fb950" />
                          <BenchStat label="Sharpe" value={b.sharpe_ratio.toFixed(2)} color="#58a6ff" />
                          <BenchStat label="Win Rate" value={`${(b.win_trades / b.total_trades * 100).toFixed(1)}%`} color="#d29922" />
                          <BenchStat label="Max DD" value={`${(b.max_drawdown * 100).toFixed(1)}%`} color={b.max_drawdown < -0.05 ? '#f85149' : '#d29922'} />
                        </div>
                        <div className="flex items-center gap-3 mt-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                          <span>Profit Factor: {b.profit_factor.toFixed(2)}</span>
                          <span>Trades: {b.total_trades} ({b.win_trades}W / {b.loss_trades}L)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Compatibility ── */}
                {detail.compatibility && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Compatibility</h3>
                    <div className="text-sm rounded-xl p-3 border" style={{
                      background: detail.compatibility.can_install ? 'rgba(63,185,80,0.06)' : 'rgba(248,81,73,0.06)',
                      borderColor: detail.compatibility.can_install ? 'rgba(63,185,80,0.2)' : 'rgba(248,81,73,0.2)',
                      color: detail.compatibility.can_install ? '#3fb950' : '#f85149',
                    }}>
                      <div className="flex items-center gap-2">
                        {detail.compatibility.can_install ? '✓' : '✕'} Package v{detail.compatibility.version}
                        {detail.compatibility.core_compatible ? ' · core compatible' : ' · core incompatible'}
                        {detail.compatibility.api_compatible ? '' : ' · API mismatch'}
                      </div>
                      {detail.compatibility.warnings?.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {detail.compatibility.warnings.map((w, i) => (
                            <li key={i} className="text-xs">{w}</li>
                          ))}
                        </ul>
                      )}
                      {detail.compatibility.errors?.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {detail.compatibility.errors.map((e, i) => (
                            <li key={i} className="text-xs">⚠ {e}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Community ── */}
                {detail.community && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Community</h3>
                    <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <span>⭐ {detail.community.rating} ({detail.community.rating_count})</span>
                      <span>💬 {detail.community.review_count} reviews</span>
                      <span>📥 {detail.community.install_count.toLocaleString()} installs</span>
                      <span>👥 {detail.community.active_users.toLocaleString()} active</span>
                      {detail.community.trending_score > 0 && (
                        <span>🔥 {Math.round(detail.community.trending_score * 100)}% trending</span>
                      )}
                    </div>
                  </div>
                )}

                {/* bottom spacing */}
                <div className="h-8" />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--text-tertiary)' }}>
                Select a package to view details
              </div>
            )}
          </div>
        )}
        </div>
      )}
    </div>
  )
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{label}</span>
      <span className="font-medium text-sm" style={{ color: color || 'var(--text-primary)' }}>{value}</span>
    </div>
  )
}

function BenchStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg p-2" style={{ background: 'var(--bg-primary)' }}>
      <div className="text-lg font-bold" style={{ color }}>{value}</div>
      <div className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{label}</div>
    </div>
  )
}
