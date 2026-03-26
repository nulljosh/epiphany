import { exec } from 'child_process'
import { readdirSync, statSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { promisify } from 'util'

const execAsync = promisify(exec)
const CODE_DIR = join(homedir(), 'Documents', 'Code')
const EXCLUDED_DIRS = new Set(['dashboard', '_external'])

const LIVE_URLS = {
  monica: 'https://monica.heyitsmejosh.com',
  spark: 'https://spark.heyitsmejosh.com',
  tally: 'https://tally.heyitsmejosh.com',
  chi: 'https://chi.heyitsmejosh.com',
  arthur: 'https://arthur.heyitsmejosh.com',
  rabbit: 'https://rabbit-lyart.vercel.app',
  lingo: 'https://lingo.heyitsmejosh.com',
  dashboard: 'https://dashboard.heyitsmejosh.com',
  journal: 'https://heyitsmejosh.com/journal',
  'nulljosh.github.io': 'https://heyitsmejosh.com',
}

async function run(cmd) {
  try {
    const { stdout } = await execAsync(cmd, { timeout: 8000 })
    return stdout.trim()
  } catch {
    return ''
  }
}

function hasDir(path) {
  try { return statSync(path).isDirectory() } catch { return false }
}

async function getRepo(name) {
  const d = join(CODE_DIR, name)

  const [branch, lastCommit, lastMsg, dirtyOut, ciRaw] = await Promise.all([
    run(`git -C "${d}" branch --show-current`),
    run(`git -C "${d}" log -1 --format=%aI`),
    run(`git -C "${d}" log -1 --format=%s`),
    run(`git -C "${d}" status --porcelain`),
    run(`gh run list -R "nulljosh/${name}" --limit 1 --json conclusion --jq '.[0].conclusion'`),
  ])

  const today = new Date().toISOString().slice(0, 10)
  const dirty = dirtyOut.split('\n').filter(Boolean).length
  const updatedToday = lastCommit.startsWith(today)
  const ci = ciRaw || 'none'

  let vercel = 'none'
  if (hasDir(join(d, '.vercel')) || hasDir(join(d, 'vercel.json'))) {
    const depId = await run(`gh api "repos/nulljosh/${name}/deployments?per_page=1" --jq '.[0].id'`)
    if (depId && depId !== 'null') {
      const vs = await run(`gh api "repos/nulljosh/${name}/deployments/${depId}/statuses" --jq '.[0].state'`)
      vercel = vs || 'none'
    }
  }

  return {
    name,
    branch,
    lastCommit,
    lastMsg: lastMsg.slice(0, 80),
    dirty,
    updatedToday,
    ci,
    vercel,
    liveUrl: LIVE_URLS[name] || null,
    github: `https://github.com/nulljosh/${name}`,
  }
}

async function getRepos() {
  if (!hasDir(CODE_DIR)) return []

  const dirs = readdirSync(CODE_DIR).filter(name => {
    if (EXCLUDED_DIRS.has(name) || name.startsWith('.')) return false
    return hasDir(join(CODE_DIR, name, '.git'))
  })

  return Promise.all(dirs.map(getRepo))
}

let cache = null
let cacheTime = 0
const CACHE_TTL = 60_000

export async function buildData() {
  const now = Date.now()
  if (cache && now - cacheTime < CACHE_TTL) return cache

  const projects = await getRepos()
  const today = new Date().toISOString().slice(0, 10)

  cache = {
    generated: new Date().toISOString(),
    projects,
    stats: {
      totalRepos: projects.length,
      updatedToday: projects.filter(p => p.updatedToday).length,
      date: today,
    },
  }
  cacheTime = now
  return cache
}
