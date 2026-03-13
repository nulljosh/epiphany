import { useState, useEffect, useRef } from 'react'
import './App.css'

function StatusBadge({ status, type }) {
  const colors = {
    success: '#22c55e',
    failure: '#ef4444',
    none: '#525252',
    pending: '#eab308',
    error: '#ef4444',
  }
  const color = colors[status] || colors.none
  const label = status === 'none' ? '--' : status
  return (
    <span className="badge" style={{ background: color + '22', color, borderColor: color + '44' }}>
      <span className="badge-type">{type} </span>{label}
    </span>
  )
}

function ProjectCard({ project, index }) {
  const commitDate = project.lastCommit ? new Date(project.lastCommit) : null
  const timeAgo = commitDate ? getTimeAgo(commitDate) : 'never'

  return (
    <div className={`card ${project.updatedToday ? 'card-active' : ''}`} style={{ '--i': index }}>
      <div className="card-header">
        <div className="card-title-row">
          <a href={project.github} target="_blank" rel="noopener" className="card-name">{project.name}</a>
          {project.dirty > 0 && <span className="dirty-badge">dirty</span>}
        </div>
        <span className="card-branch">{project.branch}</span>
      </div>
      <p className="card-msg">{project.lastMsg || 'No commits'}</p>
      <div className="card-meta">
        <span className="card-time">{timeAgo}</span>
        <div className="card-badges">
          {project.ci !== 'none' && <StatusBadge status={project.ci} type="CI" />}
          {project.vercel !== 'none' && <StatusBadge status={project.vercel} type="V" />}
        </div>
      </div>
      {project.liveUrl && (
        <a href={project.liveUrl} target="_blank" rel="noopener" className="card-live">
          {project.liveUrl.replace('https://', '')}
        </a>
      )}
    </div>
  )
}

function getTimeAgo(date) {
  const now = new Date()
  const diff = Math.floor((now - date) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago'
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago'
  return Math.floor(diff / 86400) + 'd ago'
}

function ArthurPanel() {
  const [arthur, setArthur] = useState(null)
  const logsRef = useRef(null)

  useEffect(() => {
    fetch('/api/arthur/status')
      .then(r => r.ok ? r.json() : null)
      .then(setArthur)
      .catch(() => {})

    const interval = setInterval(() => {
      fetch('/api/arthur/status')
        .then(r => r.ok ? r.json() : null)
        .then(setArthur)
        .catch(() => {})
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight
  }, [arthur?.logs])

  if (!arthur) return null

  const statusClass = arthur.training ? 'active' : arthur.error ? 'error' : 'idle'
  const statusLabel = arthur.training ? 'Training' : arthur.error ? 'Error' : 'Idle'

  return (
    <div className="arthur-panel">
      <div className="arthur-header">
        <span className="arthur-title">Arthur LLM</span>
        <span className={`arthur-status ${statusClass}`}>{statusLabel}</span>
      </div>
      <div className="arthur-grid">
        <div className="arthur-metric">
          <span className="arthur-metric-label">Version</span>
          <span className="arthur-metric-value">{arthur.version || 'v3'}</span>
        </div>
        <div className="arthur-metric">
          <span className="arthur-metric-label">Last Loss</span>
          <span className="arthur-metric-value">{arthur.lastLoss || '--'}</span>
        </div>
        <div className="arthur-metric">
          <span className="arthur-metric-label">Last Run</span>
          <span className="arthur-metric-value">{arthur.lastRun || '--'}</span>
        </div>
      </div>
      {arthur.logs && arthur.logs.length > 0 && (
        <div className="arthur-logs" ref={logsRef}>
          {arthur.logs.join('\n')}
        </div>
      )}
    </div>
  )
}

function OpenClawPanel() {
  const persisted = (() => {
    try {
      return JSON.parse(localStorage.getItem('openclaw_last_good') || 'null')
    } catch {
      return null
    }
  })()

  const [openclaw, setOpenclaw] = useState({
    gatewayStatus: persisted?.gatewayStatus || 'unknown',
    pairedCount: persisted?.pairedCount || 0,
    logs: Array.isArray(persisted?.logs) ? persisted.logs : [],
    lastCheck: persisted?.lastCheck || '--',
  })
  const [models, setModels] = useState([])
  const [currentModel, setCurrentModel] = useState(persisted?.currentModel || '')
  const [selectedModel, setSelectedModel] = useState(persisted?.currentModel || '')
  const [switching, setSwitching] = useState(false)
  const [switchMessage, setSwitchMessage] = useState('')
  const [apiWarning, setApiWarning] = useState('')
  const logsRef = useRef(null)

  useEffect(() => {
    const fetchJsonWithTimeout = async (url, timeoutMs = 5000) => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const res = await fetch(url, { signal: controller.signal })
        if (!res.ok) return null
        return await res.json()
      } catch {
        return null
      } finally {
        clearTimeout(timer)
      }
    }

    const loadStatus = () => {
      setApiWarning('')
      Promise.all([
        fetchJsonWithTimeout('/api/health', 10000),
        fetchJsonWithTimeout('/api/devices/paired', 6000),
        fetchJsonWithTimeout('/api/logs?n=20', 6000),
      ]).then(([health, paired, logs]) => {
        const pairedCount = Array.isArray(paired)
          ? paired.length
          : typeof paired?.count === 'number'
            ? paired.count
            : typeof paired?.paired === 'number'
              ? paired.paired
              : 0
        const logLines = Array.isArray(logs)
          ? logs.map(line => String(line))
          : Array.isArray(logs?.logs)
            ? logs.logs.map(line => String(line))
            : typeof logs?.logs === 'string'
              ? logs.logs.split('\n')
              : []
        const nextState = {
          gatewayStatus: health?.status || (health?.healthy ? 'healthy' : openclaw.gatewayStatus || 'unknown'),
          pairedCount,
          logs: logLines,
          lastCheck: new Date().toLocaleTimeString(),
        }
        setOpenclaw(nextState)

        if (!health) setApiWarning('Health endpoint timed out')
        try {
          localStorage.setItem('openclaw_last_good', JSON.stringify({
            ...nextState,
            currentModel,
          }))
        } catch {}
      }).catch(() => {})
    }

    const loadModels = () => {
      fetchJsonWithTimeout('/api/openclaw/models', 15000).then((modelData) => {
        if (!modelData) {
          setApiWarning(prev => prev || 'Model endpoint timed out')
          return
        }
        const catalog = Array.isArray(modelData?.models) ? modelData.models : []
        const defaultModel = modelData?.defaultModel || currentModel || ''
        const ensured = catalog.length > 0
          ? catalog
          : (defaultModel ? [{ key: defaultModel, name: defaultModel, available: true }] : [])
        if (defaultModel && !ensured.find(m => m.key === defaultModel)) {
          ensured.unshift({ key: defaultModel, name: defaultModel, available: true })
        }
        setModels(ensured)

        setCurrentModel(defaultModel || '')
        setSelectedModel(defaultModel || '')
        try {
          const existing = JSON.parse(localStorage.getItem('openclaw_last_good') || '{}')
          localStorage.setItem('openclaw_last_good', JSON.stringify({
            ...existing,
            currentModel: defaultModel,
          }))
        } catch {}
      }).catch(() => {})
    }

    loadStatus()
    loadModels()
    const interval = setInterval(loadStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight
  }, [openclaw?.logs])

  const switchModel = async () => {
    if (!selectedModel || switching) return
    setSwitching(true)
    setSwitchMessage('')
    try {
      const res = await fetch('/api/openclaw/models/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selectedModel }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to switch model')
      setCurrentModel(selectedModel)
      setSwitchMessage('Model switched')
      setApiWarning('')
      try {
        const existing = JSON.parse(localStorage.getItem('openclaw_last_good') || '{}')
        localStorage.setItem('openclaw_last_good', JSON.stringify({
          ...existing,
          currentModel: selectedModel,
        }))
      } catch {}
    } catch (e) {
      setSwitchMessage(`Switch failed: ${e.message}`)
    } finally {
      setSwitching(false)
    }
  }

  const statusText = String(openclaw.gatewayStatus || 'unknown')
  const normalized = statusText.toLowerCase()
  const isHealthy = ['healthy', 'ok', 'online', 'up', 'connected'].includes(normalized)
  const isFailing = ['failed', 'failure', 'offline', 'down', 'unhealthy', 'disconnected'].includes(normalized)
  const statusClass = isHealthy ? 'active' : isFailing ? 'error' : 'warn'

  return (
    <div className="openclaw-panel">
      <div className="openclaw-header">
        <span className="openclaw-title">OpenClaw Gateway</span>
        <span className={`openclaw-status-dot ${statusClass}`} title={`Gateway: ${statusText}`} aria-label={`Gateway: ${statusText}`} />
      </div>
      <div className="openclaw-grid">
        <div className="openclaw-metric">
          <span className="openclaw-metric-label">Gateway</span>
          <span className="openclaw-metric-value">{statusText}</span>
        </div>
        <div className="openclaw-metric">
          <span className="openclaw-metric-label">Paired Devices</span>
          <span className="openclaw-metric-value">{openclaw.pairedCount}</span>
        </div>
        <div className="openclaw-metric">
          <span className="openclaw-metric-label">Last Check</span>
          <span className="openclaw-metric-value">{openclaw.lastCheck}</span>
        </div>
      </div>
      <div className="openclaw-model-switch">
        <label className="openclaw-metric-label" htmlFor="model-switch">Default Model</label>
        <div className="openclaw-model-row">
          <select
            id="model-switch"
            className="openclaw-model-select"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={switching}
          >
            {models.map((m) => (
              <option key={m.key} value={m.key}>
                {m.key}
              </option>
            ))}
          </select>
          <button className="openclaw-model-btn" onClick={switchModel} disabled={switching || !selectedModel}>
            {switching ? 'Switching...' : 'Switch'}
          </button>
        </div>
        <div className="openclaw-model-current">
          Current: <code>{currentModel || 'unknown'}</code>
          {switchMessage && <span className="openclaw-model-message">{switchMessage}</span>}
          {apiWarning && <span className="openclaw-model-message">Warning: {apiWarning}</span>}
        </div>
      </div>
      {openclaw.logs && openclaw.logs.length > 0 && (
        <div className="openclaw-logs" ref={logsRef}>
          {openclaw.logs.join('\n')}
        </div>
      )}
    </div>
  )
}

function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme')
      if (saved) return saved === 'dark'
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return false
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  return (
    <button className="theme-toggle" onClick={() => setDark(d => !d)}>
      {dark ? 'Light' : 'Dark'}
    </button>
  )
}

function App() {
  const [data, setData] = useState(null)
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/data.json')
      .then(r => { if (!r.ok) throw new Error('Failed to load'); return r.json() })
      .then(setData)
      .catch(e => setError(e.message))
  }, [])

  if (error) return <div className="app"><p className="error">Failed to load data: {error}</p></div>
  if (!data) return <div className="app"><p className="loading">Loading...</p></div>

  const projects = data.projects || []
  const stats = data.stats || {}

  const filtered = projects.filter(p => {
    if (filter === 'today') return p.updatedToday
    if (filter === 'live') return p.liveUrl
    if (filter === 'failing') return p.ci === 'failure' || p.vercel === 'failure'
    return true
  }).sort((a, b) => {
    if (a.updatedToday && !b.updatedToday) return -1
    if (!a.updatedToday && b.updatedToday) return 1
    return new Date(b.lastCommit) - new Date(a.lastCommit)
  })

  const failCount = projects.filter(p => p.ci === 'failure' || p.vercel === 'failure').length
  const liveCount = projects.filter(p => p.liveUrl).length

  return (
    <div className="app">
      <header>
        <div className="header-top">
          <h1>dash<span>board</span></h1>
          <ThemeToggle />
        </div>
        <div className="stats-row">
          <div className="stat">
            <span className="stat-num">{stats.totalRepos}</span>
            <span className="stat-label">repos</span>
          </div>
          <div className="stat stat-active">
            <span className="stat-num">{stats.updatedToday}</span>
            <span className="stat-label">today</span>
          </div>
          <div className="stat">
            <span className="stat-num">{liveCount}</span>
            <span className="stat-label">live</span>
          </div>
          <div className={`stat ${failCount > 0 ? 'stat-fail' : ''}`}>
            <span className="stat-num">{failCount}</span>
            <span className="stat-label">failing</span>
          </div>
        </div>
      </header>

      <ArthurPanel />
      <OpenClawPanel />

      <div className="filters">
        {['all', 'today', 'live', 'failing'].map(f => (
          <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>
      <main className="grid">
        {filtered.map((p, i) => <ProjectCard key={p.name} project={p} index={i} />)}
        {filtered.length === 0 && <p className="empty">No projects match this filter.</p>}
      </main>
    </div>
  )
}

export default App
