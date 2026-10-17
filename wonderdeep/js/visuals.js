'use strict';
(function (W) {
const THREE = window.THREE;
const V = W.Visuals = {};
const INK = '#1c1740', HAZ = '#ff4d1a';

/* ---------- vector-style critter sprites (hand-drawn look: thick outline, gradients, expressions) ---------- */
const cache = {};
function blob(g, cx, cy, rx, ry, c1, c2) { const gr = g.createRadialGradient(cx - rx * .3, cy - ry * .4, 5, cx, cy, Math.max(rx, ry)); gr.addColorStop(0, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, 7); g.fill(); }
function eyes(g, cx, cy, gap, expr, size = 22) {
  for (const sx of [-1, 1]) {
    const x = cx + sx * gap;
    if (expr === 'hurt') { g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.moveTo(x - 12, cy - 12); g.lineTo(x + 12, cy + 12); g.moveTo(x + 12, cy - 12); g.lineTo(x - 12, cy + 12); g.stroke(); continue; }
    if (expr === 'stun') { g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); for (let a = 0; a < 12; a += .3) g.lineTo(x + Math.cos(a) * a * 1.6, cy + Math.sin(a) * a * 1.6); g.stroke(); continue; }
    if (expr === 'happy') { g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.arc(x, cy + 6, 14, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); continue; }
    const big = expr === 'warn' ? 1.3 : expr === 'attack' ? .7 : 1;
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x, cy, size * big, size * 1.2 * big * (expr === 'attack' ? .6 : 1), 0, 0, 7); g.fill(); g.lineWidth = 5; g.strokeStyle = INK; g.stroke();
    g.fillStyle = INK; g.beginPath(); g.arc(x + (expr === 'warn' ? 0 : 3), cy + 2, size * .5 * big, 0, 7); g.fill();
    if (expr === 'warn' || expr === 'attack') { g.strokeStyle = INK; g.lineWidth = 8; g.beginPath(); g.moveTo(x - sx * -18, cy - 36); g.lineTo(x + sx * -18 * -1 * 0 + sx * 20, cy - 24 - (expr === 'attack' ? 8 : 0)); g.stroke(); }
  }
}
function mouth(g, cx, cy, w, expr) {
  g.strokeStyle = INK; g.lineWidth = 6; g.lineCap = 'round';
  if (expr === 'attack' || expr === 'warn') { g.fillStyle = '#5a0f1f'; g.beginPath(); g.ellipse(cx, cy, w * .6, expr === 'attack' ? 20 : 12, 0, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#fff'; for (const o of [-1, 1]) { g.beginPath(); g.moveTo(cx + o * w * .35 - 6, cy - 12); g.lineTo(cx + o * w * .35 + 6, cy - 12); g.lineTo(cx + o * w * .35, cy + 2); g.fill(); } }
  else if (expr === 'hurt' || expr === 'stun') { g.beginPath(); g.moveTo(cx - w * .4, cy + 8); g.quadraticCurveTo(cx, cy - 10, cx + w * .4, cy + 8); g.stroke(); }
  else { g.beginPath(); g.moveTo(cx - w * .4, cy); g.quadraticCurveTo(cx, cy + (expr === 'happy' ? 24 : 12), cx + w * .4, cy); g.stroke(); }
}
function outlineStroke(g, drawPath) { g.lineJoin = 'round'; g.lineWidth = 22; g.strokeStyle = HAZ; drawPath(); g.stroke(); g.lineWidth = 11; g.strokeStyle = INK; drawPath(); g.stroke(); }
V.critter = function (type, expr) {
  const key = type + expr; if (cache[key]) return cache[key];
  const tall = type === 'chomper', c = document.createElement('canvas'); c.width = type === 'queen' ? 512 : 256; c.height = tall ? 320 : type === 'queen' ? 384 : 256; const g = c.getContext('2d');
  if (type === 'waddler') {
    const path = () => { g.beginPath(); g.ellipse(128, 150, 92, 78, 0, 0, 7); };
    outlineStroke(g, path); blob(g, 128, 150, 92, 78, '#c8ff9a', '#5fc23f');
    g.fillStyle = '#e9ffc9'; g.beginPath(); g.ellipse(128, 190, 52, 34, 0, 0, 7); g.fill();
    for (const sx of [-1, 1]) { g.fillStyle = '#4aa534'; g.strokeStyle = INK; g.lineWidth = 8; g.beginPath(); g.ellipse(128 + sx * 52, 226, 26, 14, 0, 0, 7); g.fill(); g.stroke(); }
    eyes(g, 128, 126, 36, expr); mouth(g, 128, 168, 60, expr);
    g.fillStyle = '#ffffff55'; g.beginPath(); g.ellipse(88, 96, 20, 10, -.5, 0, 7); g.fill();
  } else if (type === 'floater') {
    const path = () => { g.beginPath(); g.ellipse(128, 110, 84, 90, 0, 0, 7); };
    for (let i = -2; i <= 2; i++) { g.strokeStyle = HAZ; g.lineWidth = 22; g.lineCap = 'round'; g.beginPath(); g.moveTo(128 + i * 30, 180); g.quadraticCurveTo(128 + i * 38, 220, 128 + i * 26, 244); g.stroke(); g.strokeStyle = INK; g.lineWidth = 11; g.stroke(); g.strokeStyle = '#ff8fd8'; g.lineWidth = 5; g.stroke(); }
    outlineStroke(g, path); blob(g, 128, 110, 84, 90, '#ffd1f0', '#ff6fc8');
    g.fillStyle = '#ffffff66'; g.beginPath(); g.ellipse(92, 68, 22, 12, -.5, 0, 7); g.fill();
    g.fillStyle = '#ffe66d'; g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.ellipse(128, 24, 14, 20, 0, 0, 7); g.fill(); g.stroke();
    eyes(g, 128, 100, 34, expr); mouth(g, 128, 150, 50, expr);
  } else if (type === 'queen') {
    const cg = g;
    const body = () => { cg.beginPath(); cg.ellipse(250, 210, 190, 120, 0, 0, 7); };
    cg.beginPath(); cg.moveTo(400, 210); cg.lineTo(500, 120); cg.lineTo(480, 210); cg.lineTo(500, 300); cg.closePath(); cg.lineJoin = 'round'; cg.lineWidth = 24; cg.strokeStyle = HAZ; cg.stroke(); cg.lineWidth = 12; cg.strokeStyle = INK; cg.stroke(); cg.fillStyle = '#ff8fd8'; cg.fill();
    outlineStroke(cg, body); const gr = cg.createLinearGradient(0, 90, 0, 330); gr.addColorStop(0, '#ffd1f0'); gr.addColorStop(.55, '#ff6fc8'); gr.addColorStop(1, '#7a3aa8'); cg.fillStyle = gr; body(); cg.fill();
    cg.fillStyle = '#ffffff55'; cg.beginPath(); cg.ellipse(190, 150, 70, 22, -.2, 0, 7); cg.fill();
    cg.fillStyle = '#7df9ff'; cg.strokeStyle = INK; cg.lineWidth = 8; for (const [x, y, r] of [[250, 118, 26], [300, 134, 20], [200, 130, 20]]) { cg.beginPath(); cg.moveTo(x - r, y + 6); cg.lineTo(x, y - r * 1.6); cg.lineTo(x + r, y + 6); cg.closePath(); cg.fill(); cg.stroke(); }  // crown-fin
    cg.beginPath(); cg.ellipse(250, 270, 90, 26, 0, 0, 7); cg.fillStyle = '#ffd1f0'; cg.fill(); cg.stroke();
    for (const sx of [-1, 1]) { const x = 150 + (sx > 0 ? 70 : 0); cg.fillStyle = '#fff'; cg.beginPath(); cg.ellipse(x, 190, 30, expr === 'attack' ? 22 : 36, 0, 0, 7); cg.fill(); cg.stroke(); cg.fillStyle = INK; cg.beginPath(); cg.arc(x + 4, 192, 12, 0, 7); cg.fill(); if (expr !== 'stun') { cg.lineWidth = 10; cg.beginPath(); cg.moveTo(x - 30, 150); cg.lineTo(x + 30, 164 + (sx > 0 ? 0 : -14)); cg.stroke(); cg.lineWidth = 8; } }
    cg.fillStyle = '#4a0f26'; cg.beginPath(); cg.ellipse(150, 252, 48, expr === 'attack' || expr === 'warn' ? 30 : 14, 0, 0, 7); cg.fill(); cg.stroke();
    if (expr === 'stun') { cg.strokeStyle = INK; cg.lineWidth = 6; for (const sx of [100, 330]) { cg.beginPath(); for (let a = 0; a < 14; a += .3) cg.lineTo(sx + Math.cos(a) * a * 3, 80 + Math.sin(a) * a * 3); cg.stroke(); } }
  } else if (type === 'roller') {
    const spiky = expr === 'attack';
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; g.fillStyle = '#e8d4a0'; g.strokeStyle = HAZ; g.lineWidth = 9; g.beginPath(); g.moveTo(128 + Math.cos(a - .18) * 86, 134 + Math.sin(a - .18) * 86); g.lineTo(128 + Math.cos(a) * (spiky ? 122 : 108), 134 + Math.sin(a) * (spiky ? 122 : 108)); g.lineTo(128 + Math.cos(a + .18) * 86, 134 + Math.sin(a + .18) * 86); g.closePath(); g.fill(); g.stroke(); }
    const path = () => { g.beginPath(); g.arc(128, 134, 88, 0, 7); }; outlineStroke(g, path); blob(g, 128, 134, 88, 88, '#ffe3a0', '#b98b45');
    g.strokeStyle = 'rgba(80,50,10,.5)'; g.lineWidth = 6; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(128, 134, 30 + i * 18, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
    if (!spiky) { eyes(g, 128, 124, 30, expr); mouth(g, 128, 168, 50, expr); } else { g.fillStyle = INK; g.beginPath(); g.arc(104, 120, 8, 0, 7); g.arc(152, 120, 8, 0, 7); g.fill(); }
  } else if (type === 'mimic') {
    const path = () => { g.beginPath(); g.roundRect ? g.roundRect(30, 80, 196, 120, 18) : g.rect(30, 80, 196, 120); };
    outlineStroke(g, path); const gr = g.createLinearGradient(0, 80, 0, 200); gr.addColorStop(0, '#c7d2ee'); gr.addColorStop(1, '#7f8db3'); g.fillStyle = gr; path(); g.fill();
    g.fillStyle = '#4a0f26'; g.strokeStyle = INK; g.lineWidth = 8; g.beginPath(); g.ellipse(128, 130, 84, expr === 'idle' ? 22 : 42, 0, 0, 7); g.fill(); g.stroke();
    g.fillStyle = '#fff'; for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(128 + i * 24 - 10, 112); g.lineTo(128 + i * 24 + 10, 112); g.lineTo(128 + i * 24, 140); g.fill(); g.beginPath(); g.moveTo(128 + i * 24 - 10, 150); g.lineTo(128 + i * 24 + 10, 150); g.lineTo(128 + i * 24, 126); g.fill(); }
    g.fillStyle = '#ff6fa0'; g.beginPath(); g.ellipse(128, 168, 30, 16, 0, 0, 7); g.fill();
    eyes(g, 128, 66, 46, expr === 'idle' ? 'warn' : expr, 20);
  } else {
    const path = () => { g.beginPath(); g.roundRect ? g.roundRect(46, 24, 164, 280, 40) : g.rect(46, 24, 164, 280); };
    outlineStroke(g, path); const gr = g.createLinearGradient(46, 0, 210, 0); gr.addColorStop(0, '#ff9a9a'); gr.addColorStop(.6, '#ff5b5b'); gr.addColorStop(1, '#c93a4f'); g.fillStyle = gr; path(); g.fill();
    g.fillStyle = '#ffffff55'; g.fillRect(66, 50, 18, 200);
    eyes(g, 128, 100, 38, expr, 24); g.fillStyle = '#3a0a1a'; g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.ellipse(128, 200, 66, expr === 'attack' || expr === 'warn' ? 54 : 34, 0, 0, 7); g.fill(); g.stroke();
    g.fillStyle = '#fff'; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(128 + i * 24 - 9, 170); g.lineTo(128 + i * 24 + 9, 170); g.lineTo(128 + i * 24, 198); g.fill(); g.beginPath(); g.moveTo(128 + i * 24 - 9, 232); g.lineTo(128 + i * 24 + 9, 232); g.lineTo(128 + i * 24, 206); g.fill(); }
  }
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return cache[key] = t;
};
V.makeSprite = function (type) {
  const sz = { waddler:[1.7, 1.7], floater:[1.9, 1.9], chomper:[1.9, 2.4], roller:[1.7, 1.7], mimic:[2.2, 1.7], queen:[9, 6.75] }[type];
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:V.critter(type, 'idle'), transparent:true, alphaTest:.05 }));
  sp.scale.set(sz[0], sz[1], 1); sp.center.set(.5, type === 'floater' ? .12 : .05); sp.userData.type = type; return sp;
};
V.setExpr = (sp, expr) => { const m = V.critter(sp.userData.type, expr); if (sp.material.map !== m) { sp.material.map = m; sp.material.needsUpdate = true; } };

/* ---------- wall murals (vector art on voxel walls) ---------- */
const murals = [];
function paintMural(kind, seed) {
  const r = W.rng(seed), c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'); g.lineJoin = 'round'; g.lineCap = 'round';
  const glow = (x, y, rad, col) => { const gr = g.createRadialGradient(x, y, 4, x, y, rad); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); };
  const outline = (w, col = INK) => { g.lineWidth = w; g.strokeStyle = col; g.stroke(); };
  if (kind === 0) {                                                // crystal cluster
    glow(256, 330, 230, 'rgba(120,255,230,.45)');
    for (let i = 0; i < 7; i++) {
      const x = 90 + i * 55 + r() * 20, h = 150 + r() * 220, w = 40 + r() * 30, hue = [170, 300, 50][i % 3];
      g.beginPath(); g.moveTo(x - w, 500); g.lineTo(x - w * .7, 500 - h * .8); g.lineTo(x, 500 - h); g.lineTo(x + w * .7, 500 - h * .8); g.lineTo(x + w, 500); g.closePath();
      const gr = g.createLinearGradient(x - w, 0, x + w, 0); gr.addColorStop(0, `hsl(${hue},90%,75%)`); gr.addColorStop(1, `hsl(${hue + 20},80%,45%)`); g.fillStyle = gr; g.fill(); outline(10);
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 5; g.beginPath(); g.moveTo(x - w * .3, 480); g.lineTo(x - w * .25, 500 - h * .75); g.stroke();
    }
  } else if (kind === 1) {                                         // hanging vines with glowing bulbs
    for (let i = 0; i < 6; i++) {
      const x = 40 + i * 85 + r() * 30, len = 160 + r() * 280; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 50, len * .3, x - 50, len * .6, x + 10, len); outline(18); g.strokeStyle = '#5fc23f'; g.lineWidth = 9; g.stroke();
      for (let k = 1; k < 6; k++) { const t = k / 6, lx = x + Math.sin(t * 5 + i) * 25, ly = len * t; g.fillStyle = '#88e05a'; g.beginPath(); g.ellipse(lx + (k % 2 ? 24 : -24), ly, 24, 11, k % 2 ? .5 : -.5, 0, 7); g.fill(); outline(5); }
      glow(x + 10, len, 38, 'rgba(255,230,109,.9)'); g.fillStyle = '#ffe66d'; g.beginPath(); g.arc(x + 10, len, 12, 0, 7); g.fill(); outline(6);
    }
  } else if (kind === 2) {                                         // giant mushroom
    glow(256, 200, 240, 'rgba(255,122,217,.4)');
    g.beginPath(); g.moveTo(222, 500); g.quadraticCurveTo(240, 340, 214, 250); g.lineTo(300, 250); g.quadraticCurveTo(272, 340, 292, 500); g.closePath(); g.fillStyle = '#f3e9d2'; g.fill(); outline(10);
    g.beginPath(); g.ellipse(256, 240, 210, 130, 0, Math.PI, 0); g.closePath(); const gr = g.createLinearGradient(0, 110, 0, 250); gr.addColorStop(0, '#ff9ae6'); gr.addColorStop(1, '#c23fa0'); g.fillStyle = gr; g.fill(); outline(12);
    for (const [x, y, s] of [[170, 190, 24], [270, 150, 30], [350, 205, 20], [230, 215, 14]]) { g.fillStyle = '#ffe6f6'; g.beginPath(); g.arc(x, y, s, 0, 7); g.fill(); outline(5); }
  } else if (kind === 3) {                                         // rune circle
    glow(256, 256, 250, 'rgba(179,107,255,.5)');
    for (const [rad, w] of [[200, 14], [150, 8], [96, 6]]) { g.beginPath(); g.arc(256, 256, rad, 0, 7); outline(w + 8); g.strokeStyle = '#d9a6ff'; g.lineWidth = w; g.stroke(); }
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.beginPath(); g.moveTo(256 + Math.cos(a) * 110, 256 + Math.sin(a) * 110); g.lineTo(256 + Math.cos(a + .2) * 170, 256 + Math.sin(a + .2) * 170); g.lineTo(256 + Math.cos(a - .2) * 170, 256 + Math.sin(a - .2) * 170); g.closePath(); g.fillStyle = '#6bffd4'; g.fill(); outline(5); }
  } else if (kind === 5) {                                         // waterfall
    glow(256, 300, 240, 'rgba(120,220,255,.45)'); g.beginPath(); g.moveTo(130, 20); g.lineTo(382, 20); g.lineTo(400, 500); g.lineTo(112, 500); g.closePath(); const wg = g.createLinearGradient(0, 0, 0, 512); wg.addColorStop(0, '#d8f8ff'); wg.addColorStop(1, '#4fc3f7'); g.fillStyle = wg; g.fill(); outline(12);
    for (let i = 0; i < 9; i++) { g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 6; g.beginPath(); g.moveTo(150 + i * 26, 40 + r() * 40); g.lineTo(150 + i * 26 + 6, 300 + r() * 160); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.ellipse(256, 500, 170, 36, 0, 0, 7); g.fill();
  } else if (kind === 6) {                                         // coral
    for (let i = 0; i < 5; i++) { const x = 70 + i * 90, hue = [330, 20, 170, 280, 50][i]; g.beginPath(); g.moveTo(x, 500); g.quadraticCurveTo(x + 30, 380, x - 20, 280 + r() * 60); outline(26); g.strokeStyle = `hsl(${hue},85%,62%)`; g.lineWidth = 16; g.stroke();
      for (let k = 0; k < 3; k++) { const bx = x + (k - 1) * 22, by = 270 + r() * 80; g.fillStyle = `hsl(${hue},90%,72%)`; g.beginPath(); g.arc(bx, by, 22, 0, 7); g.fill(); outline(7); } }
  } else if (kind === 7) {                                         // fish school
    for (let i = 0; i < 6; i++) { const x = 60 + (i % 3) * 150 + r() * 30, y = 90 + Math.floor(i / 3) * 190 + r() * 40, hue = [190, 40, 330][i % 3]; g.save(); g.translate(x, y); g.rotate(-.15 + r() * .3);
      g.beginPath(); g.ellipse(0, 0, 54, 30, 0, 0, 7); g.fillStyle = `hsl(${hue},85%,62%)`; g.fill(); outline(9); g.beginPath(); g.moveTo(-50, 0); g.lineTo(-90, -28); g.lineTo(-90, 28); g.closePath(); g.fill(); outline(9);
      g.fillStyle = '#fff'; g.beginPath(); g.arc(28, -6, 9, 0, 7); g.fill(); outline(4); g.fillStyle = INK; g.beginPath(); g.arc(30, -6, 4, 0, 7); g.fill(); g.restore(); }
  } else if (kind === 8) {                                         // bubble cluster
    glow(256, 256, 240, 'rgba(180,240,255,.35)'); for (let i = 0; i < 12; i++) { const x = 60 + r() * 390, y = 60 + r() * 390, rad = 22 + r() * 52; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fillStyle = 'rgba(190,245,255,.35)'; g.fill(); outline(8, '#e8fbff'); g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(x - rad * .35, y - rad * .35, rad * .2, 0, 7); g.fill(); }
  } else if (kind === 9) {                                         // spiral shell
    glow(256, 270, 230, 'rgba(255,200,230,.4)'); g.beginPath(); for (let a = 0; a < 14; a += .1) g.lineTo(256 + Math.cos(a) * (10 + a * 17), 270 + Math.sin(a) * (10 + a * 14)); outline(34); g.strokeStyle = '#ffb3d9'; g.lineWidth = 22; g.stroke();
    g.beginPath(); g.moveTo(130, 470); g.quadraticCurveTo(256, 400, 390, 470); g.lineTo(390, 500); g.lineTo(130, 500); g.closePath(); g.fillStyle = '#f3e9d2'; g.fill(); outline(10);
  } else {                                                         // arch of stars
    const gr = g.createLinearGradient(0, 40, 0, 500); gr.addColorStop(0, '#6a5acd'); gr.addColorStop(1, '#1d1b4e'); g.beginPath(); g.moveTo(70, 500); g.lineTo(70, 220); g.arc(256, 220, 186, Math.PI, 0); g.lineTo(442, 500); g.closePath(); g.fillStyle = gr; g.fill(); outline(14);
    for (let i = 0; i < 26; i++) { const x = 90 + r() * 330, y = 60 + r() * 420; g.fillStyle = i % 5 ? '#fff' : '#ffe66d'; g.beginPath(); g.arc(x, y, 2 + r() * 5, 0, 7); g.fill(); }
  }
  return new THREE.CanvasTexture(c);
}
V.murals = () => { if (!murals.length) for (let i = 0; i < 10; i++) murals.push(paintMural(i, 77 + i)); return murals; };
V.decorate = function (R) {
  const T = V.murals(), r = R.rand, g = new THREE.Group(), geo = new THREE.PlaneGeometry(1, 1);
  const spec = [{ ax:'x', fix:1.04, len:R.d, dir:1, rot:Math.PI / 2 }, { ax:'x', fix:R.w - 1.04, len:R.d, dir:-1, rot:-Math.PI / 2 }, { ax:'z', fix:1.04, len:R.w, dir:1, rot:0 }, { ax:'z', fix:R.d - 1.04, len:R.w, dir:-1, rot:Math.PI }];
  const doors = R.def.doors.map(d => ({ d, q:R.doorRect(d) }));
  let wi = 0;
  for (const s of spec) {
    const wall = ['W', 'E', 'N', 'S'][wi++];
    for (let u = 5 + r() * 3; u < s.len - 5; u += 9 + r() * 4) {
      const size = 5 + r() * 3, y = R.fy + 5.5 + r() * Math.max(0, R.h - R.fy - 12), kind = R.pal.murals[Math.floor(r() * 5)];
      if (doors.some(o => o.d.dir === wall && Math.abs(u - (o.q.a0 + o.q.w / 2)) < size / 2 + 2.5 && y - size / 2 < o.q.y + o.q.h + 1)) continue;
      if (y + size / 2 > R.h - 1.2) continue;
      const m = new THREE.Mesh(geo, W.patchOcc(new THREE.MeshBasicMaterial({ map:T[kind], transparent:true, depthWrite:false, fog:true, opacity:.92 })));
      m.scale.set(size, size, 1); m.rotation.y = s.rot;
      if (s.ax === 'x') m.position.set(s.fix, y, u); else m.position.set(u, y, s.fix);
      g.add(m);
    }
  }
  // ambient spores
  const n = W.quality === 'low' ? 40 : 110, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i * 3] = 2 + r() * (R.w - 4); pos[i * 3 + 1] = R.fy + r() * (R.h - R.fy - 2); pos[i * 3 + 2] = 2 + r() * (R.d - 4); }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const sp = new THREE.Points(pg, new THREE.PointsMaterial({ color:R.pal.spore, size:.22, transparent:true, opacity:.7, depthWrite:false, blending:THREE.AdditiveBlending }));
  g.add(sp); V.spores = { pts:sp, R };
  R.group.add(g);
};
V.update = function (dt, t) {
  const s = V.spores; if (!s) return; const a = s.pts.geometry.attributes.position, R = s.R;
  for (let i = 0; i < a.count; i++) { let y = a.getY(i) + dt * (.25 + (i % 5) * .05); if (y > R.h - 2) y = R.fy; a.setY(i, y); a.setX(i, a.getX(i) + Math.sin(t + i) * dt * .3); }
  a.needsUpdate = true;
};

/* ---------- see-through occluders: anything between camera and Nova (above her feet) dithers away ---------- */
W.occ = { uScreen:{ value:new THREE.Vector2(-999, -999) }, uDepth:{ value:0 }, uPy:{ value:0 }, uR:{ value:100 }, uOn:{ value:1 } };
W.patchOcc = function (m) {
  if (m.userData.occ) return m; m.userData.occ = true;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, W.occ);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vOZ; varying float vOY;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n vOZ = -mvPosition.z; vec4 oWp = vec4(transformed, 1.0);\n #ifdef USE_INSTANCING\n oWp = instanceMatrix * oWp;\n #endif\n vOY = (modelMatrix * oWp).y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vOZ; varying float vOY; uniform vec2 uScreen; uniform float uDepth; uniform float uPy; uniform float uR; uniform float uOn;')
      .replace('void main() {', 'void main() {\n if (uOn > .5 && vOZ < uDepth - 1.3 && vOY > uPy) { float dd = distance(gl_FragCoord.xy, uScreen); if (dd < uR * .55) discard; if (dd < uR && mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 2.0) < 1.0) discard; }');
  };
  m.customProgramCacheKey = () => 'occ'; return m;
};
const _v = new THREE.Vector3();
V.occUpdate = function () {
  const P = W.player, cam = W.camera, o = W.occ, r = W.renderer, pr = r.getPixelRatio();
  o.uOn.value = W.settings.seeThrough !== false && (W.state === 'play' || W.state === 'menu') ? 1 : 0;
  _v.set(P.x, P.y + P.h * .55, P.z).project(cam);
  o.uScreen.value.set((_v.x * .5 + .5) * innerWidth * pr, (_v.y * .5 + .5) * innerHeight * pr);
  _v.set(P.x, P.y + P.h * .55, P.z).applyMatrix4(cam.matrixWorldInverse); o.uDepth.value = -_v.z;
  o.uPy.value = P.y + (W.grav > 0 ? -3 : .55); o.uR.value = Math.min(innerWidth, innerHeight) * .2 * pr * (W.giant ? 1.8 : 1);
};

/* ---------- quality / post-processing ---------- */
V.composer = null;
V.setupQuality = function () {
  const q = W.settings.quality, touch = W.isTouch;
  W.quality = q === 'auto' ? (touch ? 'low' : 'high') : q;
  const r = W.renderer, pr = Math.min(devicePixelRatio || 1, W.quality === 'high' ? 2 : W.quality === 'med' ? 1.5 : 1.25);
  r.setPixelRatio(pr); r.setSize(innerWidth, innerHeight);
  r.shadowMap.enabled = W.quality !== 'low'; W.sun.castShadow = W.quality !== 'low'; W.sun.shadow.mapSize.set(W.quality === 'high' ? 2048 : 1024, W.quality === 'high' ? 2048 : 1024);
  if (W.sun.shadow.map) { W.sun.shadow.map.dispose(); W.sun.shadow.map = null; }
  V.composer = null;
  if (W.quality === 'high' && THREE.EffectComposer && THREE.UnrealBloomPass && THREE.RenderPass) {
    const c = new THREE.EffectComposer(r); c.setPixelRatio && c.setPixelRatio(pr); c.setSize(innerWidth, innerHeight);
    c.addPass(new THREE.RenderPass(W.scene, W.camera));
    c.addPass(new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .55, .7, .86)); V.composer = c;
  }
  W.scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
};
addEventListener('resize', () => { if (V.composer) V.composer.setSize(innerWidth, innerHeight); });
V.render = () => V.composer ? V.composer.render() : W.renderer.render(W.scene, W.camera);

/* ---------- blob shadow so characters read on every surface ---------- */
V.blobShadow = function (size) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(0,0,0,.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map:new THREE.CanvasTexture(c), transparent:true, depthWrite:false })); m.rotation.x = -Math.PI / 2; m.renderOrder = 1; return m;
};
})(window.W);
