'use strict';

// ═══════════════════════════════════════════════════════════════════════════════
//  EFFECTS ENGINE — all visual effects controlled by preferences
// ═══════════════════════════════════════════════════════════════════════════════

const FX = {
  mouseX: -1000, mouseY: -1000,
  particles: [], particleCount: 60, particleSpeed: 1.0,
  matrixDrops: [], starfieldStars: [], vortexDots: [],
  trailDots: [],
};

function getAccentRGB() {
  const hex = getComputedStyle(document.documentElement).getPropertyValue('--blue').trim() || '#4D9FFF';
  if (!hex.startsWith('#')) return [77,159,255];
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
}

document.addEventListener('mousemove', e => { FX.mouseX = e.clientX; FX.mouseY = e.clientY; });

// ── Particles ────────────────────────────────────────────────────────────────
function resetParticles() {
  const canvas = document.getElementById('particles-canvas');
  if (!canvas) return;
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  FX.particles = [];
  for (let i = 0; i < FX.particleCount; i++) {
    FX.particles.push({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.5 + 0.5, a: Math.random() * 0.3 + 0.05
    });
  }
}

function drawParticles() {
  const canvas = document.getElementById('particles-canvas');
  if (!canvas || document.body.classList.contains('no-particles')) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const rgb = getAccentRGB();
  const prefs = loadPrefs();
  const repel = prefs['mouse-repel'];
  const lines = prefs['particle-lines'];

  ctx.clearRect(0, 0, W, H);
  for (let i = 0; i < FX.particles.length; i++) {
    const p = FX.particles[i];
    p.x += p.vx * FX.particleSpeed; p.y += p.vy * FX.particleSpeed;
    if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
    if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;

    const dx = FX.mouseX - p.x, dy = FX.mouseY - p.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const glow = dist < 150 ? (1 - dist/150) * 0.5 : 0;

    if (repel && dist < 120 && dist > 0) {
      p.x -= (dx / dist) * 1.5; p.y -= (dy / dist) * 1.5;
    }

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r + glow * 2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${p.a + glow})`;
    ctx.fill();

    if (lines) {
      for (let j = i + 1; j < FX.particles.length; j++) {
        const q = FX.particles[j];
        const lx = p.x - q.x, ly = p.y - q.y;
        const ld = Math.sqrt(lx*lx + ly*ly);
        if (ld < 120) {
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
          ctx.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.04 * (1 - ld/120)})`;
          ctx.stroke();
        }
      }
    }
  }
}

// ── Matrix Rain ──────────────────────────────────────────────────────────────
function initMatrix() {
  const canvas = document.getElementById('matrix-canvas');
  if (!canvas) return;
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  const cols = Math.floor(canvas.width / 14);
  FX.matrixDrops = [];
  for (let i = 0; i < cols; i++) FX.matrixDrops.push(Math.random() * canvas.height);
}

function drawMatrix() {
  const canvas = document.getElementById('matrix-canvas');
  if (!canvas || !document.body.classList.contains('fx-matrix')) return;
  const ctx = canvas.getContext('2d');
  const rgb = getAccentRGB();
  ctx.fillStyle = 'rgba(6,6,8,0.06)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = '12px monospace';

  for (let i = 0; i < FX.matrixDrops.length; i++) {
    const ch = String.fromCharCode(0x30A0 + Math.random() * 96);
    const y = FX.matrixDrops[i];
    const opacity = 0.15 + Math.random() * 0.2;
    ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${opacity})`;
    ctx.fillText(ch, i * 14, y);
    if (y > canvas.height && Math.random() > 0.975) FX.matrixDrops[i] = 0;
    FX.matrixDrops[i] += 10 + Math.random() * 4;
  }
}

// ── Starfield ────────────────────────────────────────────────────────────────
function initStarfield() {
  const canvas = document.getElementById('starfield-canvas');
  if (!canvas) return;
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  FX.starfieldStars = [];
  for (let i = 0; i < 200; i++) {
    FX.starfieldStars.push({
      x: Math.random() * canvas.width - canvas.width/2,
      y: Math.random() * canvas.height - canvas.height/2,
      z: Math.random() * canvas.width
    });
  }
}

function drawStarfield() {
  const canvas = document.getElementById('starfield-canvas');
  if (!canvas || !document.body.classList.contains('fx-starfield')) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W/2, cy = H/2;
  const rgb = getAccentRGB();
  ctx.fillStyle = 'rgba(6,6,8,0.15)';
  ctx.fillRect(0, 0, W, H);

  for (const s of FX.starfieldStars) {
    s.z -= 2;
    if (s.z <= 0) { s.z = W; s.x = Math.random() * W - cx; s.y = Math.random() * H - cy; }
    const sx = (s.x / s.z) * 300 + cx;
    const sy = (s.y / s.z) * 300 + cy;
    const r = Math.max(0.5, (1 - s.z/W) * 2);
    const a = (1 - s.z/W) * 0.5;
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI*2);
    ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
    ctx.fill();
  }
}

// ── Vortex ───────────────────────────────────────────────────────────────────
function initVortex() {
  const canvas = document.getElementById('vortex-canvas');
  if (!canvas) return;
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  FX.vortexDots = [];
  for (let i = 0; i < 120; i++) {
    FX.vortexDots.push({ angle: Math.random() * Math.PI * 2, dist: 50 + Math.random() * 250, speed: 0.003 + Math.random() * 0.008 });
  }
}

let vortexTime = 0;
function drawVortex() {
  const canvas = document.getElementById('vortex-canvas');
  if (!canvas || !document.body.classList.contains('fx-vortex')) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W/2, cy = H/2;
  const rgb = getAccentRGB();
  ctx.fillStyle = 'rgba(6,6,8,0.05)';
  ctx.fillRect(0, 0, W, H);
  vortexTime += 0.01;

  for (const d of FX.vortexDots) {
    d.angle += d.speed;
    const wobble = Math.sin(vortexTime + d.dist * 0.02) * 20;
    const x = cx + Math.cos(d.angle) * (d.dist + wobble);
    const y = cy + Math.sin(d.angle) * (d.dist + wobble) * 0.6;
    const a = 0.1 + (d.dist / 300) * 0.15;
    ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI*2);
    ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
    ctx.fill();
  }
}

// ── Cursor Trail ─────────────────────────────────────────────────────────────
function updateCursorTrail(e) {
  if (!loadPrefs()['cursor-trail']) return;
  const dot = document.createElement('div');
  dot.className = 'cursor-dot';
  dot.style.left = e.clientX + 'px';
  dot.style.top = e.clientY + 'px';
  document.body.appendChild(dot);
  setTimeout(() => dot.remove(), 500);
}

// ── Click Burst ──────────────────────────────────────────────────────────────
function doClickBurst(e) {
  if (!loadPrefs()['click-burst']) return;
  for (let i = 0; i < 8; i++) {
    const dot = document.createElement('div');
    dot.className = 'click-burst';
    const angle = (Math.PI * 2 / 8) * i + Math.random() * 0.4;
    const dist = 8 + Math.random() * 6;
    dot.style.left = e.clientX + 'px';
    dot.style.top = e.clientY + 'px';
    dot.style.setProperty('--bx', Math.cos(angle) * dist + 'px');
    dot.style.setProperty('--by', Math.sin(angle) * dist + 'px');
    document.body.appendChild(dot);
    setTimeout(() => dot.remove(), 600);
  }
}

// ── Card Mouse Glow ──────────────────────────────────────────────────────────
document.addEventListener('mousemove', e => {
  updateCursorTrail(e);
  if (document.body.classList.contains('no-card-glow')) return;
  document.querySelectorAll('.card').forEach(card => {
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mouse-x', ((e.clientX - r.left) / r.width * 100) + '%');
    card.style.setProperty('--mouse-y', ((e.clientY - r.top) / r.height * 100) + '%');
  });
});

// ── Ripple on buttons ────────────────────────────────────────────────────────
document.addEventListener('click', e => {
  doClickBurst(e);
  if (!loadPrefs().ripple) return;
  const btn = e.target.closest('.btn-action, .btn-save, .nav-btn');
  if (!btn) return;
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  const r = btn.getBoundingClientRect();
  const size = Math.max(r.width, r.height);
  ripple.style.width = ripple.style.height = size + 'px';
  ripple.style.left = (e.clientX - r.left - size/2) + 'px';
  ripple.style.top = (e.clientY - r.top - size/2) + 'px';
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 500);
});

// ── Main render loop ─────────────────────────────────────────────────────────
function fxLoop() {
  drawParticles();
  drawMatrix();
  drawStarfield();
  drawVortex();
  requestAnimationFrame(fxLoop);
}

window.addEventListener('resize', () => {
  resetParticles(); initMatrix(); initStarfield(); initVortex();
});
resetParticles(); initMatrix(); initStarfield(); initVortex();
requestAnimationFrame(fxLoop);

// ─── Sesión activa ────────────────────────────────────────────────────────────
let activeSession = null; // ID de la sesión DLL seleccionada

// ── Tabs ──────────────────────────────────────────────────────────────────────
const titles = { esp:'ESP', aim:'Aimbot', silent:'Silent Aim', exploits:'Exploits', misc:'Misc', settings:'Settings' };
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    document.getElementById('page-title').textContent = titles[btn.dataset.tab] || '';
    closeSidebar();
  });
});

// ── Mobile sidebar ────────────────────────────────────────────────────────────
const sidebar   = document.getElementById('sidebar');
const hamburger = document.getElementById('hamburger');
const overlayBg = document.getElementById('overlay-bg');
hamburger.addEventListener('click', () => { sidebar.classList.toggle('open'); overlayBg.classList.toggle('open'); });
overlayBg.addEventListener('click', closeSidebar);
function closeSidebar() { sidebar.classList.remove('open'); overlayBg.classList.remove('open'); }

// ── Toast ─────────────────────────────────────────────────────────────────────
let toastTimer;
function toast(msg, type = '') {
  let el = document.querySelector('.toast');
  if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.className = 'toast ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 2500);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function cb(id)  { return document.getElementById(id); }
function set(id, v) { const el = cb(id); if (el) el.checked = !!v; }
function setVal(id, v) { const el = cb(id); if (el) { el.value = v; el.dispatchEvent(new Event('input')); } }
function getNum(id) { return parseFloat(cb(id)?.value ?? 0); }

const sliders = {
  esp_maxd: 'esp_maxd_v', sil_fov: 'sil_fov_v', spin_spd: 'spin_spd_v'
};
Object.entries(sliders).forEach(([id, labelId]) => {
  const el = cb(id);
  if (el) el.addEventListener('input', () => {
    const lbl = cb(labelId);
    if (lbl) lbl.textContent = parseFloat(el.value).toFixed(el.step?.includes('.') ? 1 : 0);
  });
});

// ── Load / Read config ────────────────────────────────────────────────────────
function loadCfg(c) {
  set('esp_en',c.esp_en); set('esp_box',c.esp_box); set('esp_skel',c.esp_skel);
  set('esp_hp',c.esp_hp); set('esp_name',c.esp_name); set('esp_dist',c.esp_dist);
  set('esp_lines',c.esp_lines); set('esp_gun',c.esp_gun); set('esp_vis',c.esp_vis);
  set('radar',c.radar); setVal('esp_maxd',c.esp_maxd??300);
  set('aim_en',c.aim_en);
  set('fast_reload',c.fast_reload);
  if(cb('aim_style')) cb('aim_style').value=c.aim_style??0;
  set('sil_en',c.sil_en); set('sil_show',c.sil_show); setVal('sil_fov',c.sil_fov??100);
  set('no_recoil',c.no_recoil); set('rapid',c.rapid); set('fastmed',c.fastmed);
  set('speedhack',c.speedhack); set('freecam',c.freecam);
  set('spin',c.spin); setVal('spin_spd',c.spin_spd??3.0);
  set('stream',c.stream); set('dma_mode',c.dma_mode);
}

function readCfg() {
  const g = id => cb(id)?.checked;
  return {
    esp_en:g('esp_en'), esp_box:g('esp_box'), esp_skel:g('esp_skel'),
    esp_hp:g('esp_hp'), esp_name:g('esp_name'), esp_dist:g('esp_dist'),
    esp_lines:g('esp_lines'), esp_gun:g('esp_gun'), esp_vis:g('esp_vis'),
    radar:g('radar'), esp_maxd:getNum('esp_maxd'),
    aim_en:g('aim_en'),
    fast_reload:g('fast_reload'),
    aim_style:parseInt(cb('aim_style')?.value??0),
    sil_en:g('sil_en'), sil_show:g('sil_show'), sil_fov:getNum('sil_fov'),
    no_recoil:g('no_recoil'), rapid:g('rapid'), fastmed:g('fastmed'),
    speedhack:g('speedhack'), freecam:g('freecam'),
    spin:g('spin'), spin_spd:getNum('spin_spd'),
    stream:g('stream'), dma_mode:g('dma_mode')
  };
}

// ── API ───────────────────────────────────────────────────────────────────────
function sessionParam() { return activeSession ? `?session=${activeSession}` : ''; }

async function api(path, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(path, opts);
  return r.json();
}

// ── Botones ───────────────────────────────────────────────────────────────────
cb('btn-save').addEventListener('click', async () => {
  try {
    await api('/api/cfg' + sessionParam(), 'POST', readCfg());
    toast('Applied ✓', 'ok');
  } catch { toast('Failed', 'error'); }
});

cb('btn-reconnect').addEventListener('click', async () => {
  try { await api('/api/reconnect' + sessionParam(), 'POST'); toast('Reconnecting...'); }
  catch { toast('Error', 'error'); }
});

// Disconnect — apaga DLL y va al login
cb('btn-disconnect').addEventListener('click', async () => {
  if (!confirm('Disconnect and shutdown DLL?')) return;
  try { await api('/api/disconnect' + sessionParam(), 'POST'); } catch {}
  sessionStorage.removeItem('asterx_user');
  window.location.href = 'login.html';
});

// Sign Out — solo cierra sesión, DLL sigue
cb('btn-signout').addEventListener('click', () => {
  sessionStorage.removeItem('asterx_user');
  window.location.href = 'login.html';
});

// ── Status ────────────────────────────────────────────────────────────────────
const dot      = cb('dot');
const statusTx = cb('status-text');
const diagTx   = cb('diag-text');
const userTx   = cb('user-text');

async function pollStatus() {
  try {
    // Busca sessões ativas
    const sessions = await api('/api/sessions');

    if (!sessions || sessions.length === 0) {
      // Nenhuma DLL conectada
      dot.className = 'dot offline';
      statusTx.textContent = 'No DLL';
      diagTx.textContent = 'Waiting for connection...';
      userTx.textContent = '';
      activeSession = null;
      return;
    }

    // Seleciona a primeira sessão se não tiver nenhuma ativa
    if (!activeSession || !sessions.find(s => s.id === activeSession)) {
      activeSession = sessions[0].id;
      // Carrega config da sessão
      try {
        const c = await api('/api/cfg' + sessionParam());
        loadCfg(c);
      } catch {}
    }

    const s = sessions.find(s => s.id === activeSession) || sessions[0];

    if (s.game) {
      dot.className = 'dot online'; statusTx.textContent = 'Connected';
    } else {
      dot.className = 'dot partial'; statusTx.textContent = 'No Game';
    }
    diagTx.textContent = s.diag || 'no diag';
    userTx.textContent = s.user ? `User: ${s.user}` : '';

    // Mostra quantas sessões se mais de 1
    if (sessions.length > 1) {
      userTx.textContent += ` (${sessions.length} DLLs)`;
    }
  } catch {
    dot.className = 'dot offline';
    statusTx.textContent = 'Server Error';
    diagTx.textContent = '—';
  }
}

// ── Settings: Theme & Effects ─────────────────────────────────────────────────
const HQ_PREFS_KEY = 'hq_prefs';

function defaultPrefs() {
  return {
    accent: '#4D9FFF', glass: true, glow: true, anim: true, gradient: true,
    particles: true, 'particle-lines': true, aurora: true,
    matrix: false, starfield: false, vortex: false,
    pcount: 60, pspeed: 1.0,
    'card-glow': true, 'card-lift': true, ripple: true,
    'mouse-repel': false, 'cursor-trail': false, 'click-burst': true,
    'logo-pulse': true, 'logo-shimmer': true, 'dot-pulse': true,
    'card-entrance': true, 'topbar-line': true, 'sidebar-line': true,
    'neon-borders': false, scanlines: false
  };
}

function loadPrefs() {
  try { return { ...defaultPrefs(), ...JSON.parse(localStorage.getItem(HQ_PREFS_KEY)) }; }
  catch { return defaultPrefs(); }
}

function savePrefs(p) { localStorage.setItem(HQ_PREFS_KEY, JSON.stringify(p)); }

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return { r, g, b };
}

function darkenHex(hex, factor) {
  const { r, g, b } = hexToRgb(hex);
  const c = v => Math.round(Math.max(0, Math.min(255, v * factor)));
  return `#${c(r).toString(16).padStart(2,'0')}${c(g).toString(16).padStart(2,'0')}${c(b).toString(16).padStart(2,'0')}`;
}

function applyAccent(hex) {
  const { r, g, b } = hexToRgb(hex);
  const s = document.documentElement.style;
  s.setProperty('--blue', hex);
  s.setProperty('--blue2', darkenHex(hex, 0.65));
  s.setProperty('--blueg', `rgba(${r},${g},${b},0.07)`);
  s.setProperty('--blueb', `rgba(${r},${g},${b},0.18)`);
}

function applyAllEffects(p) {
  const b = document.body.classList;
  b.toggle('no-glass', !p.glass);
  b.toggle('no-glow', !p.glow);
  b.toggle('no-anim', !p.anim);
  b.toggle('no-gradient', !p.gradient);
  b.toggle('no-particles', !p.particles);
  b.toggle('no-aurora', !p.aurora);
  b.toggle('fx-matrix', !!p.matrix);
  b.toggle('fx-starfield', !!p.starfield);
  b.toggle('fx-vortex', !!p.vortex);
  b.toggle('no-card-glow', !p['card-glow']);
  b.toggle('no-card-lift', !p['card-lift']);
  b.toggle('no-logo-pulse', !p['logo-pulse']);
  b.toggle('no-logo-shimmer', !p['logo-shimmer']);
  b.toggle('no-dot-pulse', !p['dot-pulse']);
  b.toggle('no-card-entrance', !p['card-entrance']);
  b.toggle('no-topbar-line', !p['topbar-line']);
  b.toggle('no-sidebar-line', !p['sidebar-line']);
  b.toggle('fx-neon-borders', !!p['neon-borders']);
  b.toggle('fx-scanlines', !!p.scanlines);

  FX.particleCount = p.pcount || 60;
  FX.particleSpeed = p.pspeed || 1.0;
}

function initSettings() {
  const p = loadPrefs();
  applyAccent(p.accent);
  applyAllEffects(p);

  const customColor = cb('custom-color');
  if (customColor) customColor.value = p.accent;

  document.querySelectorAll('.color-swatch').forEach(sw => {
    sw.classList.toggle('active', sw.dataset.color.toUpperCase() === p.accent.toUpperCase());
  });

  // Map checkbox IDs to pref keys
  const fxMap = {
    'fx-glass': 'glass', 'fx-glow': 'glow', 'fx-anim': 'anim', 'fx-gradient': 'gradient',
    'fx-particles': 'particles', 'fx-particle-lines': 'particle-lines', 'fx-aurora': 'aurora',
    'fx-matrix': 'matrix', 'fx-starfield': 'starfield', 'fx-vortex': 'vortex',
    'fx-card-glow': 'card-glow', 'fx-card-lift': 'card-lift', 'fx-ripple': 'ripple',
    'fx-mouse-repel': 'mouse-repel', 'fx-cursor-trail': 'cursor-trail', 'fx-click-burst': 'click-burst',
    'fx-logo-pulse': 'logo-pulse', 'fx-logo-shimmer': 'logo-shimmer', 'fx-dot-pulse': 'dot-pulse',
    'fx-card-entrance': 'card-entrance', 'fx-topbar-line': 'topbar-line', 'fx-sidebar-line': 'sidebar-line',
    'fx-neon-borders': 'neon-borders', 'fx-scanlines': 'scanlines'
  };

  // Init checkboxes from prefs
  for (const [elId, key] of Object.entries(fxMap)) {
    const el = cb(elId);
    if (el) el.checked = !!p[key];
  }

  // Init sliders
  if (cb('fx-pcount')) { cb('fx-pcount').value = p.pcount || 60; }
  if (cb('fx-pspeed')) { cb('fx-pspeed').value = p.pspeed || 1.0; }
  if (cb('fx-pcount-v')) cb('fx-pcount-v').textContent = p.pcount || 60;
  if (cb('fx-pspeed-v')) cb('fx-pspeed-v').textContent = (p.pspeed || 1.0).toFixed(1);

  // Bind checkbox changes
  for (const [elId, key] of Object.entries(fxMap)) {
    const el = cb(elId);
    if (el) el.addEventListener('change', () => {
      const prefs = loadPrefs();
      prefs[key] = el.checked;
      savePrefs(prefs);
      applyAllEffects(prefs);
    });
  }

  // Bind sliders
  const pcountEl = cb('fx-pcount');
  if (pcountEl) pcountEl.addEventListener('input', () => {
    if (cb('fx-pcount-v')) cb('fx-pcount-v').textContent = pcountEl.value;
    const prefs = loadPrefs();
    prefs.pcount = parseInt(pcountEl.value);
    savePrefs(prefs);
    FX.particleCount = prefs.pcount;
    resetParticles();
  });

  const pspeedEl = cb('fx-pspeed');
  if (pspeedEl) pspeedEl.addEventListener('input', () => {
    if (cb('fx-pspeed-v')) cb('fx-pspeed-v').textContent = parseFloat(pspeedEl.value).toFixed(1);
    const prefs = loadPrefs();
    prefs.pspeed = parseFloat(pspeedEl.value);
    savePrefs(prefs);
    FX.particleSpeed = prefs.pspeed;
  });

  // Color swatches
  document.querySelectorAll('.color-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      const color = sw.dataset.color;
      applyAccent(color);
      if (customColor) customColor.value = color;
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      const prefs = loadPrefs(); prefs.accent = color; savePrefs(prefs);
    });
  });

  if (customColor) {
    customColor.addEventListener('input', () => {
      const color = customColor.value;
      applyAccent(color);
      document.querySelectorAll('.color-swatch').forEach(s => {
        s.classList.toggle('active', s.dataset.color.toUpperCase() === color.toUpperCase());
      });
      const prefs = loadPrefs(); prefs.accent = color; savePrefs(prefs);
    });
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
(async () => {
  initSettings();

  const user = sessionStorage.getItem('asterx_user');
  if (!user) { window.location.href = 'login.html'; return; }

  const licRow = document.getElementById('license-row');
  const licVal = document.getElementById('license-val');
  if (licRow && licVal) { licVal.textContent = user; licRow.style.display = 'flex'; }

  // El pollStatus se encarga de cargar config cuando haya sesión
  pollStatus();
  setInterval(pollStatus, 3000);
})();
