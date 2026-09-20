'use strict';

const express    = require('express');
const http       = require('http');
const WebSocket  = require('ws');
const fs         = require('fs');
const path       = require('path');

// ─── Config & defaults ────────────────────────────────────────────────────────

const STATE_FILE = path.join(__dirname, 'state.json');
const PORT       = 3000;

const DEFAULTS = {
  aim_en: true,  aim_fov: 150, aim_smooth: 0.0, aim_dist: 200, aim_key: 0x45,
  aim_style: 1,  aim_hitbox: 0, aim_ignkn: true, aim_ignbt: false, aim_fovshow: false,
  fast_reload: true,
  sil_en: false, sil_fov: 100.0, sil_key: 0x01, sil_show: false,
  esp_en: true,  esp_box: true,  esp_skel: true, esp_hp: true, esp_name: true,
  esp_dist: true, esp_lines: false, esp_gun: false, esp_maxd: 500.0, esp_vis: false, radar: false,
  no_recoil: true, rapid: true, spin: false, spin_spd: 3.0, speedhack: true,
  fastmed: true, freecam: false,
  stream: true, dma_mode: false
};

// ─── State persistence ────────────────────────────────────────────────────────

/** sid -> config object */
let persistedState = {};

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      persistedState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      console.log(`[state] Loaded ${Object.keys(persistedState).length} client(s) from state.json`);
    }
  } catch (e) {
    console.warn('[state] Failed to load state.json:', e.message);
    persistedState = {};
  }
}

function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(persistedState, null, 2), 'utf8');
  } catch (e) {
    console.error('[state] Failed to save state.json:', e.message);
  }
}

function getClientConfig(sid) {
  if (!persistedState[sid]) {
    persistedState[sid] = Object.assign({}, DEFAULTS);
  }
  return persistedState[sid];
}

function mergeAndSaveConfig(sid, updates) {
  const cfg = getClientConfig(sid);
  Object.assign(cfg, updates);
  saveState();
  return cfg;
}

// ─── In-memory connected DLL clients ─────────────────────────────────────────

/**
 * clients: Map<sid, {
 *   ws: WebSocket,
 *   sid: string,
 *   username: string,
 *   diag: string,
 *   game: boolean,
 *   vma: number, elf: number, try: number,
 *   lastSeen: number,
 *   connectedAt: number
 * }>
 */
const clients = new Map();

// ─── Panel connections ────────────────────────────────────────────────────────

const panelSockets = new Set();

function broadcastPanel(obj) {
  const msg = JSON.stringify(obj);
  for (const ws of panelSockets) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}

// ─── Express app ──────────────────────────────────────────────────────────────

const app    = express();
const server = http.createServer(app);

app.use(express.static(path.join(__dirname, 'public')));

// Also serve index.html explicitly for /
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// REST: get all connected clients (for panel initial load)
app.get('/api/clients', (req, res) => {
  const list = [];
  for (const [sid, c] of clients) {
    list.push({
      sid: c.sid,
      username: c.username,
      diag: c.diag,
      game: c.game,
      vma: c.vma,
      elf: c.elf,
      try: c.try,
      lastSeen: c.lastSeen,
      connectedAt: c.connectedAt,
      config: getClientConfig(sid)
    });
  }
  res.json(list);
});

// REST: get config for a specific sid
app.get('/api/config/:sid', (req, res) => {
  res.json(getClientConfig(req.params.sid));
});

// ─── WebSocket server ─────────────────────────────────────────────────────────

const wss = new WebSocket.Server({ server, path: '/dll' });
const wssPanel = new WebSocket.Server({ server, path: '/panel' });

// ── DLL WebSocket ─────────────────────────────────────────────────────────────

wss.on('connection', (ws, req) => {
  const remoteAddr = req.socket.remoteAddress || 'unknown';
  console.log(`[dll ] ++ New DLL connection from ${remoteAddr}`);

  ws._dllSid      = null;
  ws._pingTimer   = null;
  ws._alive       = true;

  // 30s ping to detect dead connections
  ws._pingTimer = setInterval(() => {
    if (!ws._alive) {
      console.log(`[dll ] !! Ping timeout for sid=${ws._dllSid || 'unknown'} — terminating`);
      ws.terminate();
      return;
    }
    ws._alive = false;
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  }, 30000);

  ws.on('pong', () => { ws._alive = true; });

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); }
    catch (e) { console.warn('[dll ] Bad JSON:', data.toString().slice(0, 80)); return; }

    const t = msg.t;

    // ── hello ──────────────────────────────────────────────────────────────
    if (t === 'hello') {
      const sid      = msg.sid || 'unknown';
      const username = msg.u   || 'unknown';
      ws._dllSid = sid;

      console.log(`[dll ] >> hello  sid=${sid}  user=${username}`);

      // Register in clients map
      clients.set(sid, {
        ws,
        sid,
        username,
        diag: 'ok',
        game: false,
        vma: 0, elf: 0, try: 0,
        lastSeen: Date.now(),
        connectedAt: Date.now()
      });

      // hello_ack
      const ack = JSON.stringify({ t: 'hello_ack', sid });
      ws.send(ack);
      console.log(`[dll ] << hello_ack  sid=${sid}`);

      // Send persisted/default config immediately
      const cfg = getClientConfig(sid);
      const cfgMsg = Object.assign({ t: 'cfg' }, cfg);
      ws.send(JSON.stringify(cfgMsg));
      console.log(`[dll ] << cfg (initial)  sid=${sid}`);

      // Notify panel
      broadcastPanel({
        t: 'client_connected',
        sid, username,
        config: cfg,
        connectedAt: clients.get(sid).connectedAt
      });
      return;
    }

    // All further messages require a registered sid
    const sid = ws._dllSid;
    const client = sid ? clients.get(sid) : null;
    if (client) client.lastSeen = Date.now();

    // ── heartbeat ──────────────────────────────────────────────────────────
    if (t === 'hb') {
      ws._alive = true;
      if (client) {
        broadcastPanel({ t: 'hb', sid });
      }
      return;
    }

    // ── status ─────────────────────────────────────────────────────────────
    if (t === 'status') {
      if (client) {
        client.game = !!msg.game;
        client.diag = msg.diag || 'ok';
        client.vma  = msg.vma  || 0;
        client.elf  = msg.elf  || 0;
        client.try  = msg.try  || 0;
        broadcastPanel({
          t: 'status', sid,
          game: client.game,
          diag: client.diag,
          vma:  client.vma,
          elf:  client.elf,
          try:  client.try
        });
      }
      return;
    }

    // ── state (DLL confirms applied config) ────────────────────────────────
    if (t === 'state') {
      if (client && msg.d) {
        // Merge DLL's confirmed state into persisted config
        mergeAndSaveConfig(sid, msg.d);
        broadcastPanel({ t: 'state', sid, d: msg.d });
        console.log(`[dll ] >> state  sid=${sid}`);
      }
      return;
    }

    console.log(`[dll ] ?? Unknown message type="${t}"  sid=${sid || 'unknown'}`);
  });

  ws.on('close', (code, reason) => {
    clearInterval(ws._pingTimer);
    const sid = ws._dllSid;
    if (sid && clients.has(sid)) {
      const c = clients.get(sid);
      console.log(`[dll ] -- Disconnected sid=${sid}  user=${c.username}  code=${code}`);
      clients.delete(sid);
      broadcastPanel({ t: 'client_disconnected', sid });
    } else {
      console.log(`[dll ] -- Unknown client disconnected  code=${code}`);
    }
  });

  ws.on('error', (err) => {
    console.error(`[dll ] !! WS error sid=${ws._dllSid || 'unknown'}:`, err.message);
  });
});

// ── Panel WebSocket ───────────────────────────────────────────────────────────

wssPanel.on('connection', (ws, req) => {
  const remoteAddr = req.socket.remoteAddress || 'unknown';
  console.log(`[panel] ++ Panel connected from ${remoteAddr}`);
  panelSockets.add(ws);

  // Send current client list on connect
  const clientList = [];
  for (const [sid, c] of clients) {
    clientList.push({
      sid: c.sid,
      username: c.username,
      diag: c.diag,
      game: c.game,
      vma: c.vma,
      elf: c.elf,
      try: c.try,
      lastSeen: c.lastSeen,
      connectedAt: c.connectedAt,
      config: getClientConfig(sid)
    });
  }
  ws.send(JSON.stringify({ t: 'init', clients: clientList }));

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch (e) { return; }

    const t   = msg.t;
    const sid = msg.sid;

    // ── Panel sends config update ──────────────────────────────────────────
    if (t === 'cfg') {
      if (!sid) return;
      const updates = Object.assign({}, msg);
      delete updates.t;
      delete updates.sid;

      const newCfg = mergeAndSaveConfig(sid, updates);

      const client = clients.get(sid);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        const cfgMsg = Object.assign({ t: 'cfg' }, newCfg);
        client.ws.send(JSON.stringify(cfgMsg));
        console.log(`[panel] << cfg -> dll  sid=${sid}  keys=${Object.keys(updates).join(',')}`);
      } else {
        console.warn(`[panel] cfg for sid=${sid} but DLL not connected`);
      }

      // Echo back to all panels so they stay in sync
      broadcastPanel({ t: 'cfg_ack', sid, config: newCfg });
      return;
    }

    // ── Disconnect (shutdown) ──────────────────────────────────────────────
    if (t === 'disconnect') {
      if (!sid) return;
      const client = clients.get(sid);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        console.log(`[panel] Sending shutdown to sid=${sid}`);
        client.ws.send(JSON.stringify({ t: 'cfg', shutdown: true }));
        // Give DLL 1s to process then close
        setTimeout(() => {
          if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.close(1000, 'Panel disconnect');
          }
          clients.delete(sid);
          broadcastPanel({ t: 'client_disconnected', sid });
        }, 1000);
      }
      return;
    }

    // ── Force reconnect ────────────────────────────────────────────────────
    if (t === 'force_reconnect') {
      if (!sid) return;
      const client = clients.get(sid);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        console.log(`[panel] Sending force_reconnect to sid=${sid}`);
        client.ws.send(JSON.stringify({ t: 'cfg', force_reconnect: true }));
      }
      return;
    }
  });

  ws.on('close', () => {
    panelSockets.delete(ws);
    console.log(`[panel] -- Panel disconnected`);
  });

  ws.on('error', (err) => {
    panelSockets.delete(ws);
    console.error('[panel] WS error:', err.message);
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

loadState();

server.listen(PORT, () => {
  console.log(`[srv  ] Remote panel server running on http://0.0.0.0:${PORT}`);
  console.log(`[srv  ] DLL WebSocket  -> ws://HOST:${PORT}/dll`);
  console.log(`[srv  ] Panel WebSocket -> ws://HOST:${PORT}/panel`);
  console.log(`[srv  ] Web panel       -> http://HOST:${PORT}/`);
});

server.on('error', (err) => {
  console.error('[srv  ] Server error:', err);
});
