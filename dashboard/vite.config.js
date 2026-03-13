import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync, mkdirSync } from 'fs'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { execSync } from 'child_process'

const DASHBOARD_PASS = process.env.DASHBOARD_PASS || 'hunter2'

const LOGIN_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dashboard Login</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#000;color:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
display:flex;align-items:center;justify-content:center;min-height:100vh}
form{display:flex;flex-direction:column;gap:0.75rem;width:min(320px,90vw)}
h1{font-size:1.25rem;font-weight:600;letter-spacing:-0.03em;text-align:center;margin-bottom:0.5rem}
h1 span{color:#636366}
input{background:#111;border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:0.6rem 0.8rem;
color:#f5f5f7;font-size:0.85rem;outline:none}
input:focus{border-color:#0a84ff}
button{background:#f5f5f7;color:#000;border:none;border-radius:8px;padding:0.55rem;
font-size:0.8rem;font-weight:600;cursor:pointer}
button:hover{background:#e5e5ea}
.err{color:#ef4444;font-size:0.75rem;text-align:center}
</style></head><body>
<form method="POST" action="/__auth">
<h1>dash<span>board</span></h1>
<input type="password" name="password" placeholder="Password" autofocus required>
<button type="submit">Login</button>
</form></body></html>`

const AUTH_BYPASS = ['/@vite/', '/@react-refresh', '/node_modules/', '/__vite_ping']

const passwordGate = {
  name: 'password-gate',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (AUTH_BYPASS.some(p => req.url.startsWith(p))) return next()

      if (req.url === '/__auth' && req.method === 'POST') {
        const chunks = []
        req.on('data', c => chunks.push(c))
        req.on('end', () => {
          const body = Buffer.concat(chunks).toString()
          const params = new URLSearchParams(body)
          if (params.get('password') === DASHBOARD_PASS) {
            res.setHeader('Set-Cookie', 'dashboard_auth=1; Path=/; HttpOnly; SameSite=Lax')
            res.writeHead(302, { Location: '/' })
            res.end()
          } else {
            res.setHeader('Content-Type', 'text/html')
            res.end(LOGIN_HTML.replace('</form>', '<p class="err">Wrong password</p></form>'))
          }
        })
        return
      }

      const cookies = req.headers.cookie || ''
      if (cookies.split(';').some(c => c.trim() === 'dashboard_auth=1')) return next()

      res.setHeader('Content-Type', 'text/html')
      res.end(LOGIN_HTML)
    })
  },
}

const HOME = process.env.HOME
const OC = join(HOME, '.openclaw')
const MODELS_CACHE_MS = 5 * 60 * 1000
let modelsCache = {
  updatedAt: 0,
  defaultModel: null,
  models: [],
}

function execJson(command, timeout = 10000) {
  const raw = execSync(command, { timeout }).toString()
  const clean = raw.replace(/\x1b\[[0-9;]*m/g, '').trim()
  const start = clean.indexOf('{')
  const end = clean.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`JSON parse failed for command: ${command}`)
  }
  return JSON.parse(clean.slice(start, end + 1))
}

function readJsonSafe(path, fallback) {
  return readFile(path, 'utf-8').then(JSON.parse).catch(() => fallback)
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

const dashboardData = {
  name: 'dashboard-data',
  apply: 'serve',
  async configureServer(server) {
    const { buildData } = await import('./server/collect.js')
    server.middlewares.use('/data.json', async (_req, res) => {
      try {
        const data = await buildData()
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(data))
      } catch (err) {
        res.statusCode = 500
        res.end(JSON.stringify({ error: err.message }))
      }
    })

    server.middlewares.use('/api/health', async (_req, res) => {
      try {
        const statusRaw = execSync('launchctl list | grep ai.openclaw.gateway 2>&1', { timeout: 5000 }).toString()
        const pid = Number.parseInt(statusRaw.trim().split(/\s+/)[0], 10)
        const running = Number.isFinite(pid)
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ status: running ? 'healthy' : 'offline', healthy: running }))
      } catch (err) {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ status: 'offline', healthy: false }))
      }
    })

    server.middlewares.use('/api/devices/paired', async (_req, res) => {
      const data = await readJsonSafe(join(OC, 'devices/paired.json'), {})
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(data))
    })

    server.middlewares.use('/api/logs', async (_req, res) => {
      const logPath = join(OC, 'logs/gateway.err.log')
      try {
        const content = await readFile(logPath, 'utf-8')
        const lines = content.trim().split('\n').slice(-20)
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ logs: lines }))
      } catch {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ logs: [] }))
      }
    })

    server.middlewares.use('/api/openclaw/models', async (_req, res) => {
      try {
        const cfg = await readJsonSafe(join(OC, 'openclaw.json'), {})
        const configuredPrimary = cfg?.agents?.defaults?.model?.primary || null
        const now = Date.now()
        let defaultModel = configuredPrimary || modelsCache.defaultModel || null

        let modelList = modelsCache.models
        if (now - modelsCache.updatedAt > MODELS_CACHE_MS || modelList.length === 0) {
          try {
            const [status, list] = await Promise.all([
              withTimeout(
                Promise.resolve(execJson('openclaw models status --json 2>&1', 30000)),
                8000,
              ),
              withTimeout(
                Promise.resolve(execJson('openclaw models list --all --json 2>&1', 30000)),
                8000,
              ),
            ])
            defaultModel =
              status?.resolvedDefault ||
              status?.defaultModel ||
              configuredPrimary ||
              defaultModel
            const parsed = Array.isArray(list?.models) ? list.models : []
            modelList = parsed
              .filter((m) =>
                Boolean(m?.key) && (
                  String(m.key).startsWith('openai-codex/') ||
                  String(m.key).startsWith('openai/') ||
                  String(m.key).startsWith('anthropic/')
                ),
              )
              .map((m) => ({
                key: m.key,
                name: m.name || m.key,
                available: Boolean(m.available),
              }))
              .sort((a, b) => {
                if (a.key === defaultModel) return -1
                if (b.key === defaultModel) return 1
                if (a.available !== b.available) return a.available ? -1 : 1
                return a.name.localeCompare(b.name)
              })
              .slice(0, 20)
            modelsCache = { updatedAt: now, defaultModel, models: modelList }
          } catch {
            modelList = modelsCache.models
          }
        }

        if (!Array.isArray(modelList) || modelList.length === 0) {
          modelList = [
            'openai-codex/gpt-5.3-codex',
            'openai-codex/gpt-5.2-codex',
            'openai/gpt-5-codex',
            'anthropic/claude-opus-4-6',
            'anthropic/claude-sonnet-4-6',
            'anthropic/claude-haiku-4-5',
          ]
            .filter(Boolean)
            .map((key) => ({ key, name: key, available: true }))
        }

        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({
          defaultModel,
          models: modelList,
        }))
      } catch (err) {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({
          defaultModel: modelsCache.defaultModel || null,
          models: modelsCache.models || [],
        }))
      }
    })

    server.middlewares.use('/api/openclaw/models/set', (req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 405
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'Method not allowed' }))
        return
      }

      const chunks = []
      req.on('data', (chunk) => chunks.push(chunk))
      req.on('end', () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}')
          const model = String(body?.model || '').trim()
          if (!model || !/^[a-z0-9._:/-]+$/i.test(model)) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Invalid model id' }))
            return
          }

          const result = execSync(`openclaw models set ${model} 2>&1`, { timeout: 30000 }).toString()
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: true, model, result }))
        } catch (err) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: String(err?.message || err) }))
        }
      })
    })
  },
}

const dashboardBuild = {
  name: 'dashboard-data-build',
  apply: 'build',
  async buildStart() {
    const { buildData } = await import('./server/collect.js')
    const data = await buildData()
    mkdirSync(join(process.cwd(), 'public'), { recursive: true })
    writeFileSync(join(process.cwd(), 'public', 'data.json'), JSON.stringify(data))
    console.log(`[dashboard] wrote public/data.json (${data.projects.length} repos)`)
  },
}

export default defineConfig({
  plugins: [react(), passwordGate, dashboardData, dashboardBuild],
  server: {
    allowedHosts: ['.ngrok-free.app', '.ngrok.io', 'localhost', '127.0.0.1', 'dashboard.heyitsmejosh.com'],
  },
})
