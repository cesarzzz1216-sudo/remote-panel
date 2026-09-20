'use strict';

const express = require('express');
const http    = require('http');
const { WebSocketServer } = require('ws');
const path    = require('path');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocketServer({ server, path: '/dll' });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ─── Default config — todo OFF hasta que el usuario active ───────────────────
function defaultCfg() {
  return {
    aim_en: false, aim_fov: 150, aim_smooth: 0.0, aim_dist: 200,
    aim_key: 0x45, aim_style: 1, aim_hitbox: 0,
    aim_ignkn: true, aim_ignbt: true, aim_fovshow: false,
    fast_reload: false,
    sil_en: false, sil_fov: 100, sil_key: 1, sil_show: false,
    esp_en: false, esp_box: false, esp_skel: false, esp_hp: false,
    esp_name: false, esp_dist: false, esp_lines: false, esp_gun: false,
    esp_maxd: 300, esp_vis: false, radar: false,
    no_recoil: false, rapid: false, spin: false, spin_spd: 3.0,
    speedhack: false, fastmed: false, freecam: false,
    stream: true, dma_mode: false
  };
}

// ─── Sesiones por DLL conectada ───────────────────────────────────────────────
// Cada DLL que conecta crea una sesión independiente identificada por un ID.
// El panel web selecciona a qual sesión se conecta via ?session=ID
// Se não especificar, usa a primeira disponível.

const sessions = new Map(); // sessionId → { ws, user, diag, game, cfg }

function newSession(ws, user) {
  const id = `sess_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  const s = { id, ws, user, diag: 'connected', game: false, cfg: defaultCfg() };
  sessions.set(id, s);
  return s;
}

function removeSession(id) {
  sessions.delete(id);
}

function getSession(id) {
  if (id && sessions.has(id)) return sessions.get(id);
  // Retorna a primeira sessão disponível se não especificar
  for (const s of sessions.values()) return s;
  return null;
}

function sendToSession(s, obj) {
  if (!s || !s.ws || s.ws.readyState !== 1) return;
  s.ws.send(JSON.stringify(obj));
}

// ─── WebSocket da DLL ─────────────────────────────────────────────────────────
wss.on('connection', (ws) => {
  let session = null;

  ws.on('message', (raw) => {
    const msg = raw.toString();

    let data;
    try { data = JSON.parse(msg); } catch { return; }

    if (data.t === 'hello') {
      const user = data.u || 'unknown';
      session = newSession(ws, user);
      console.log(`[dll] hello user=${user} session=${session.id}`);
      // Manda config atual (tudo OFF por padrão)
      sendToSession(session, { t: 'cfg', ...session.cfg });
      sendToSession(session, { t: 'hello_ack', sid: session.id });

    } else if (data.t === 'status' && session) {
      session.diag = data.diag || '';
      session.game = !!data.game;
      console.log(`[dll] status game=${data.game} diag=${data.diag}`);

    } else if (data.t === 'state' && session && data.d) {
      Object.assign(session.cfg, data.d);

    } else if (data.t === 'hb') {
      // heartbeat — ignora
    }
  });

  ws.on('close', () => {
    if (session) {
      console.log(`[dll] disconnected session=${session.id}`);
      removeSession(session.id);
      session = null;
    }
  });

  ws.on('error', (e) => console.error('[dll] error:', e.message));
});

// ─── API REST ─────────────────────────────────────────────────────────────────

// Lista todas as sessões ativas (para o panel mostrar quais DLLs conectadas)
app.get('/api/sessions', (_, res) => {
  const list = [];
  for (const s of sessions.values()) {
    list.push({ id: s.id, user: s.user, game: s.game, diag: s.diag });
  }
  res.json(list);
});

// Status de uma sessão específica ou da primeira disponível
app.get('/api/status', (req, res) => {
  const s = getSession(req.query.session);
  if (!s) return res.json({ connected: false, user: '', game: false, diag: 'no_dll' });
  res.json({ connected: true, user: s.user, game: s.game, diag: s.diag, sessionId: s.id });
});

// Config atual
app.get('/api/cfg', (req, res) => {
  const s = getSession(req.query.session);
  if (!s) return res.json(defaultCfg());
  res.json(s.cfg);
});

// Atualiza config e envia para a DLL
app.post('/api/cfg', (req, res) => {
  const s = getSession(req.query.session);
  if (!s) return res.status(404).json({ ok: false, error: 'no session' });
  Object.assign(s.cfg, req.body);
  sendToSession(s, { t: 'cfg', ...s.cfg });
  res.json({ ok: true });
});

// Force reconnect
app.post('/api/reconnect', (req, res) => {
  const s = getSession(req.query.session);
  if (!s) return res.status(404).json({ ok: false });
  sendToSession(s, { t: 'cfg', ...s.cfg, force_reconnect: true });
  res.json({ ok: true });
});

// Disconnect — apaga a DLL e remove a sessão
app.post('/api/disconnect', (req, res) => {
  const s = getSession(req.query.session);
  if (!s) return res.status(404).json({ ok: false });
  sendToSession(s, { t: 'cfg', ...s.cfg, shutdown: true });
  setTimeout(() => {
    if (s.ws) s.ws.close();
    removeSession(s.id);
  }, 500);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`[server] port ${PORT}`));
