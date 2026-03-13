import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { readFile, readdir, stat, writeFile } from 'fs/promises';
import { execSync } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';
import { createServer as createViteServer } from 'vite';

const HOME = process.env.HOME;
const OC = join(HOME, '.openclaw');
const PORT = 3847;

// Ensure PATH includes homebrew + local bins for spawned commands
process.env.PATH = `/opt/homebrew/bin:/usr/local/bin:${HOME}/.local/bin:${process.env.PATH || ''}`;

const app = express();
app.use(express.json());

function execJson(command, timeout = 10000) {
  const raw = execSync(command, { timeout }).toString();
  const clean = raw.replace(/\x1b\[[0-9;]*m/g, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`JSON parse failed for command: ${command}`);
  }
  return JSON.parse(clean.slice(start, end + 1));
}

// --- API Routes ---

// Gateway health
app.get('/api/health', async (req, res) => {
  try {
    const raw = execSync('openclaw health 2>&1', { timeout: 30000 }).toString();
    let healthState = null;
    try { healthState = JSON.parse(await readFile(join(OC, 'health-state.json'), 'utf-8')); } catch {}
    const pid = getPid();
    const status = pid ? 'healthy' : 'offline';
    res.json({ raw, pid, healthState, status, healthy: Boolean(pid) });
  } catch (e) {
    res.json({ raw: e.message, pid: null, healthState: null, status: 'offline', healthy: false });
  }
});

// Paired devices
app.get('/api/devices/paired', async (req, res) => {
  try {
    const data = JSON.parse(await readFile(join(OC, 'devices/paired.json'), 'utf-8'));
    res.json(data);
  } catch (e) {
    res.json({});
  }
});

// Pending devices
app.get('/api/devices/pending', async (req, res) => {
  try {
    const data = JSON.parse(await readFile(join(OC, 'devices/pending.json'), 'utf-8'));
    res.json(data);
  } catch (e) {
    res.json({});
  }
});

// Approve pending device
app.post('/api/devices/approve/:requestId', async (req, res) => {
  try {
    const pendingPath = join(OC, 'devices/pending.json');
    const pairedPath = join(OC, 'devices/paired.json');
    const pending = JSON.parse(await readFile(pendingPath, 'utf-8'));
    const paired = JSON.parse(await readFile(pairedPath, 'utf-8'));

    const entry = pending[req.params.requestId];
    if (!entry) return res.status(404).json({ error: 'Not found' });

    paired[entry.deviceId] = { ...entry, approvedAtMs: Date.now() };
    delete pending[req.params.requestId];

    await writeFile(pairedPath, JSON.stringify(paired, null, 2));
    await writeFile(pendingPath, JSON.stringify(pending, null, 2));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// OpenClaw config
app.get('/api/config', async (req, res) => {
  try {
    const data = JSON.parse(await readFile(join(OC, 'openclaw.json'), 'utf-8'));
    res.json(data);
  } catch (e) {
    res.json({});
  }
});

// Save config
app.put('/api/config', async (req, res) => {
  try {
    await writeFile(join(OC, 'openclaw.json'), JSON.stringify(req.body, null, 2));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Gateway logs (last N lines)
app.get('/api/logs', async (req, res) => {
  const n = parseInt(req.query.n) || 100;
  try {
    const logPath = join(OC, 'logs/gateway.err.log');
    const content = await readFile(logPath, 'utf-8');
    const lines = content.trim().split('\n');
    res.json({ lines: lines.slice(-n) });
  } catch (e) {
    res.json({ lines: [] });
  }
});

// Sessions
app.get('/api/sessions', async (req, res) => {
  try {
    const sessPath = join(OC, 'agents/main/sessions/sessions.json');
    const data = JSON.parse(await readFile(sessPath, 'utf-8'));
    res.json(data);
  } catch (e) {
    res.json({});
  }
});

// Gateway restart
app.post('/api/gateway/restart', (req, res) => {
  try {
    execSync('launchctl kickstart -k gui/$(id -u)/ai.openclaw.gateway 2>&1 || (launchctl stop ai.openclaw.gateway && launchctl start ai.openclaw.gateway)', { timeout: 10000 });
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// Ollama models
app.get('/api/models', (req, res) => {
  try {
    const raw = execSync('ollama list 2>&1', { timeout: 10000 }).toString();
    const running = execSync('ollama ps 2>&1', { timeout: 5000 }).toString();
    res.json({ installed: raw, running });
  } catch (e) {
    res.json({ installed: '', running: '', error: e.message });
  }
});

// OpenClaw models catalog + current default
app.get('/api/openclaw/models', (req, res) => {
  try {
    const status = execJson('openclaw models status --json 2>&1');
    const list = execJson('openclaw models list --all --json 2>&1', 30000);
    const models = Array.isArray(list?.models) ? list.models : [];
    res.json({
      defaultModel: status?.defaultModel || null,
      allowed: Array.isArray(status?.allowed) ? status.allowed : [],
      models: models.map((m) => ({
        key: m.key,
        name: m.name,
        available: Boolean(m.available),
      })),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Set OpenClaw default model via CLI
app.post('/api/openclaw/models/set', (req, res) => {
  try {
    const model = String(req.body?.model || '').trim();
    if (!model || !/^[a-z0-9._:/-]+$/i.test(model)) {
      return res.status(400).json({ error: 'Invalid model id' });
    }

    const result = execSync(`openclaw models set ${model} 2>&1`, { timeout: 30000 }).toString();
    res.json({ ok: true, model, result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Switch primary model in openclaw.json
app.post('/api/models/switch', async (req, res) => {
  try {
    const { primary, fallbacks } = req.body;
    const configPath = join(OC, 'openclaw.json');
    const config = JSON.parse(await readFile(configPath, 'utf-8'));
    if (primary) config.agents.defaults.model.primary = primary;
    if (fallbacks) config.agents.defaults.model.fallbacks = fallbacks;
    await writeFile(configPath, JSON.stringify(config, null, 2));
    res.json({ ok: true, model: config.agents.defaults.model });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Version info
app.get('/api/version', (req, res) => {
  try {
    const ocVersion = execSync('openclaw --version 2>&1', { timeout: 5000 }).toString().trim();
    const nodeVersion = process.version;
    const gitVersion = execSync('git --version 2>&1', { timeout: 3000 }).toString().trim();
    const ollamaVersion = execSync('ollama --version 2>&1', { timeout: 3000 }).toString().trim();
    res.json({ openclaw: ocVersion, node: nodeVersion, git: gitVersion, ollama: ollamaVersion });
  } catch (e) {
    res.json({ error: e.message });
  }
});

// Launchd status
app.get('/api/gateway/status', (req, res) => {
  try {
    const raw = execSync('launchctl list | grep openclaw 2>&1', { timeout: 5000 }).toString();
    res.json({ raw, running: raw.includes('ai.openclaw.gateway') });
  } catch (e) {
    res.json({ raw: '', running: false });
  }
});

function getPid() {
  try {
    const out = execSync('launchctl list | grep ai.openclaw.gateway', { timeout: 5000 }).toString();
    const pid = out.trim().split(/\s+/)[0];
    return pid === '-' ? null : parseInt(pid);
  } catch { return null; }
}

// --- Watchdog API ---

const WATCHDOG_LOG = join(HOME, '.cache/watchdog.log');
const WATCHDOG_JOURNAL_DIR = join(HOME, '.cache/watchdog-journal');

app.get('/api/watchdog/status', (req, res) => {
  try {
    let running = false;
    let pid = null;
    try {
      const raw = execSync('launchctl list | grep watchdog 2>&1', { timeout: 5000 }).toString();
      running = raw.includes('com.joshua.watchdog');
      const parts = raw.trim().split(/\s+/);
      pid = parts[0] !== '-' ? parseInt(parts[0]) : null;
    } catch {}

    let lastCycle = null;
    try {
      const content = execSync(`tail -200 "${WATCHDOG_LOG}" 2>/dev/null`, { timeout: 5000 }).toString();
      const lines = content.trim().split('\n').reverse();
      for (const line of lines) {
        const match = line.match(/^\[(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})/);
        if (match) { lastCycle = match[1]; break; }
      }
    } catch {}

    const hour = new Date().getHours();
    const mode = (hour >= 6 && hour < 22) ? 'day' : 'night';

    res.json({ running, pid, mode, lastCycle });
  } catch (e) {
    res.json({ running: false, pid: null, mode: null, lastCycle: null, error: e.message });
  }
});

app.get('/api/watchdog/logs', async (req, res) => {
  const n = parseInt(req.query.n) || 100;
  try {
    const content = await readFile(WATCHDOG_LOG, 'utf-8');
    const lines = content.trim().split('\n');
    res.json({ lines: lines.slice(-n) });
  } catch (e) {
    res.json({ lines: [] });
  }
});

app.get('/api/watchdog/journal', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const mdPath = join(WATCHDOG_JOURNAL_DIR, `${today}.md`);
    if (existsSync(mdPath)) {
      const content = await readFile(mdPath, 'utf-8');
      res.json({ content, date: today });
    } else {
      // Try listing directory for closest match
      const files = await readdir(WATCHDOG_JOURNAL_DIR);
      const todayFiles = files.filter(f => f.startsWith(today));
      if (todayFiles.length > 0) {
        const content = await readFile(join(WATCHDOG_JOURNAL_DIR, todayFiles[0]), 'utf-8');
        res.json({ content, date: today, file: todayFiles[0] });
      } else {
        res.json({ content: null, date: today });
      }
    }
  } catch (e) {
    res.json({ content: null, error: e.message });
  }
});

// --- Arthur LLM API ---

const ARTHUR_DIR = join(HOME, 'Documents/Code/arthur');
const ARTHUR_LOGS = join(ARTHUR_DIR, 'logs');

app.get('/api/arthur/status', async (req, res) => {
  try {
    const result = { training: false, error: false, version: 'v3', lastLoss: null, lastRun: null, logs: [] };

    // Read watchdog log for current state
    try {
      const wdLog = await readFile(join(ARTHUR_LOGS, 'watchdog.log'), 'utf-8');
      const lines = wdLog.trim().split('\n').slice(-20);
      result.logs = lines.slice(-10);

      // Check if training is active
      for (const line of lines.reverse()) {
        if (line.includes('Training') || line.includes('training')) { result.training = true; break; }
        if (line.includes('Done') || line.includes('idle') || line.includes('No checkpoint')) break;
      }
    } catch {}

    // Find latest cron log for loss/run info
    try {
      const files = await readdir(ARTHUR_LOGS);
      const cronLogs = files.filter(f => f.startsWith('cron_')).sort().reverse();
      if (cronLogs.length > 0) {
        const latest = await readFile(join(ARTHUR_LOGS, cronLogs[0]), 'utf-8');
        const lines = latest.trim().split('\n');

        // Extract last run timestamp from filename
        const match = cronLogs[0].match(/cron_(\d{4}-\d{2}-\d{2})_(\d{2})(\d{2})/);
        if (match) result.lastRun = `${match[1]} ${match[2]}:${match[3]}`;

        // Extract loss value
        for (const line of lines.reverse()) {
          const lossMatch = line.match(/loss[:\s]+(\d+\.\d+)/i);
          if (lossMatch) { result.lastLoss = lossMatch[1]; break; }
        }
      }
    } catch {}

    res.json(result);
  } catch (e) {
    res.json({ error: true, message: e.message });
  }
});

app.get('/api/arthur/logs', async (req, res) => {
  const n = parseInt(req.query.n) || 50;
  try {
    const files = await readdir(ARTHUR_LOGS);
    const cronLogs = files.filter(f => f.startsWith('cron_')).sort().reverse();
    if (cronLogs.length === 0) return res.json({ lines: [] });
    const content = await readFile(join(ARTHUR_LOGS, cronLogs[0]), 'utf-8');
    const lines = content.trim().split('\n');
    res.json({ lines: lines.slice(-n), file: cronLogs[0] });
  } catch (e) {
    res.json({ lines: [], error: e.message });
  }
});

app.get('/api/arthur/report', async (req, res) => {
  try {
    const files = await readdir(ARTHUR_LOGS);
    const reports = files.filter(f => f.includes('overnight') && f.endsWith('.log')).sort().reverse();
    if (reports.length === 0) return res.json({ content: null });
    const content = await readFile(join(ARTHUR_LOGS, reports[0]), 'utf-8');
    res.json({ content, file: reports[0] });
  } catch (e) {
    res.json({ content: null, error: e.message });
  }
});

// --- Vite Dev Server + WebSocket ---

async function start() {
  const server = createServer(app);

  // WebSocket for live log tailing
  const wss = new WebSocketServer({ server, path: '/ws/logs' });
  wss.on('connection', (ws) => {
    const logPath = join(OC, 'logs/gateway.err.log');
    let lastSize = 0;

    const poll = setInterval(async () => {
      try {
        const s = await stat(logPath);
        if (s.size > lastSize) {
          const content = await readFile(logPath, 'utf-8');
          const lines = content.trim().split('\n');
          const newLines = lastSize === 0 ? lines.slice(-30) : lines.slice(-10);
          ws.send(JSON.stringify({ lines: newLines }));
          lastSize = s.size;
        }
      } catch {}
    }, 2000);

    ws.on('close', () => clearInterval(poll));
  });

  // WebSocket for watchdog live log tailing
  const wdWss = new WebSocketServer({ server, path: '/ws/watchdog' });
  wdWss.on('connection', (ws) => {
    let lastSize = 0;

    const poll = setInterval(async () => {
      try {
        const s = await stat(WATCHDOG_LOG);
        if (s.size > lastSize) {
          const content = await readFile(WATCHDOG_LOG, 'utf-8');
          const lines = content.trim().split('\n');
          const newLines = lastSize === 0 ? lines.slice(-30) : lines.slice(-10);
          ws.send(JSON.stringify({ lines: newLines }));
          lastSize = s.size;
        }
      } catch {}
    }, 3000);

    ws.on('close', () => clearInterval(poll));
  });

  // WebSocket for Arthur live log tailing
  const arthurWss = new WebSocketServer({ server, path: '/ws/arthur' });
  arthurWss.on('connection', (ws) => {
    const logPath = join(ARTHUR_LOGS, 'watchdog.log');
    let lastSize = 0;

    const poll = setInterval(async () => {
      try {
        const s = await stat(logPath);
        if (s.size > lastSize) {
          const content = await readFile(logPath, 'utf-8');
          const lines = content.trim().split('\n');
          const newLines = lastSize === 0 ? lines.slice(-20) : lines.slice(-5);
          ws.send(JSON.stringify({ lines: newLines }));
          lastSize = s.size;
        }
      } catch {}
    }, 5000);

    ws.on('close', () => clearInterval(poll));
  });

  // Vite middleware for dev
  const vite = await createViteServer({
    server: { middlewareMode: true, allowedHosts: true },
    root: import.meta.dirname,
    appType: 'spa'
  });
  app.use(vite.middlewares);

  server.listen(PORT, () => {
    console.log(`OpenClaw Dashboard: http://localhost:${PORT}`);
  });
}

start();
