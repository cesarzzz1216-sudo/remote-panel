'use strict';

// ── Floating Particles ───────────────────────────────────────────────────────
(function initParticles() {
  const canvas = document.getElementById('particles-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H;
  const particles = [];
  const COUNT = 50;

  function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
  window.addEventListener('resize', resize);
  resize();

  for (let i = 0; i < COUNT; i++) {
    particles.push({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
      r: Math.random() * 1.5 + 0.5, a: Math.random() * 0.25 + 0.05
    });
  }

  let mouseX = -1000, mouseY = -1000;
  document.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });

  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;

      const dx = mouseX - p.x, dy = mouseY - p.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const glow = dist < 150 ? (1 - dist/150) * 0.4 : 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + glow * 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(77,166,255,${p.a + glow})`;
      ctx.fill();

      for (let j = i + 1; j < particles.length; j++) {
        const q = particles[j];
        const lx = p.x - q.x, ly = p.y - q.y;
        const ld = Math.sqrt(lx*lx + ly*ly);
        if (ld < 100) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
          ctx.strokeStyle = `rgba(77,166,255,${0.04 * (1 - ld/100)})`;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(draw);
  }
  draw();
})();

// Apply saved accent color to login page
try {
  const _p = JSON.parse(localStorage.getItem('hq_prefs'));
  if (_p && _p.accent) {
    const h = _p.accent, r = parseInt(h.slice(1,3),16), g = parseInt(h.slice(3,5),16), b = parseInt(h.slice(5,7),16);
    document.documentElement.style.setProperty('--blue', h);
  }
} catch {}

const input     = document.getElementById('license-input');
const btnLogin  = document.getElementById('btn-login');
const remember  = document.getElementById('remember-me');

// Restore saved key
const saved = localStorage.getItem('asterx_key');
if (saved) { input.value = saved; remember.checked = true; }

btnLogin.addEventListener('click', doLogin);
input.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

function doLogin() {
  const key = input.value.trim();
  if (!key) {
    input.classList.remove('shake');
    void input.offsetWidth; // reflow para reiniciar animação
    input.classList.add('shake');
    input.focus();
    return;
  }

  if (remember.checked) {
    localStorage.setItem('asterx_key', key);
  } else {
    localStorage.removeItem('asterx_key');
  }

  // Guarda o username para mostrar no painel
  sessionStorage.setItem('asterx_user', key);

  // Redireciona para o painel
  window.location.href = 'index.html';
}
