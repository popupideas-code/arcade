'use strict';
(function (W) {
const THREE = window.THREE;
const Wt = W.Water = { vols:[], vents:[], falls:[], t:0, inWas:false };

function waveTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#7fe3ff'; g.fillRect(0, 0, 128, 128); g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 3; g.lineCap = 'round';
  for (let i = 0; i < 9; i++) { const x = (i * 37) % 128, y = (i * 53) % 128; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 14, y - 8, x + 28, y); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function fallTex() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d'); g.fillStyle = 'rgba(120,220,255,.55)'; g.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 18; i++) { g.fillStyle = `rgba(255,255,255,${.25 + (i % 4) * .15})`; g.fillRect((i * 13) % 60, (i * 71) % 230, 4 + (i % 3) * 2, 40 + (i % 5) * 14); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function bubbleTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.arc(32, 32, 24, 0, 7); g.stroke(); g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(24, 24, 7, 0, 7); g.fill(); return new THREE.CanvasTexture(c);
}
let WT, FT, BT;

Wt.populate = function (R) {
  WT = WT || waveTex(); FT = FT || fallTex(); BT = BT || bubbleTex();
  Wt.vols = []; Wt.vents = []; Wt.falls = []; Wt.t = 0; Wt.inWas = false;
  const grp = new THREE.Group(); R.group.add(grp);
  for (const d of R.def.water || []) {
    const w = d.x1 - d.x0, dz = d.z1 - d.z0, y0 = d.y0 != null ? d.y0 : R.fy, col = d.color || 0x3fd0ff;
    const vol = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color:col, transparent:true, opacity:.26, side:THREE.DoubleSide, depthWrite:false, fog:true }));
    const tex = WT.clone(); tex.needsUpdate = true; tex.repeat.set(w / 4, dz / 4);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(w, dz), new THREE.MeshBasicMaterial({ map:tex, color:0xbff4ff, transparent:true, opacity:.55, depthWrite:false, fog:true })); top.rotation.x = -Math.PI / 2;
    grp.add(vol, top); const v = { d, vol, top, tex, x0:d.x0, x1:d.x1, z0:d.z0, z1:d.z1, y0, level:d.level };
    Wt.vols.push(v); Wt.setLevel(v, d.level);
  }
  for (const f of R.def.falls || []) {
    const h = f.y1 - f.y0, t = FT.clone(); t.needsUpdate = true; t.repeat.set(1, h / 5);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(f.w, h), new THREE.MeshBasicMaterial({ map:t, transparent:true, side:THREE.DoubleSide, depthWrite:false, fog:true }));
    if (f.axis === 'x') { m.rotation.y = Math.PI / 2; m.position.set(f.x, f.y0 + h / 2, f.z + f.w / 2); } else m.position.set(f.x + f.w / 2, f.y0 + h / 2, f.z);
    grp.add(m); Wt.falls.push({ f, m, t });
  }
  Wt.grp = grp; for (const vt of R.def.vents || []) Wt.addVent(vt);
};
Wt.addVent = function (vt) {
  const h = vt.y1 - vt.y0, grp = Wt.grp, cyl = new THREE.Mesh(new THREE.CylinderGeometry(vt.r, vt.r, h, 14, 1, true), new THREE.MeshBasicMaterial({ color:0xaef6ff, transparent:true, opacity:.14, side:THREE.DoubleSide, depthWrite:false, fog:true }));
  cyl.position.set(vt.x, vt.y0 + h / 2, vt.z); grp.add(cyl);
  const n = 26, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, r = Math.random() * vt.r; pos[i * 3] = vt.x + Math.cos(a) * r; pos[i * 3 + 1] = vt.y0 + Math.random() * h; pos[i * 3 + 2] = vt.z + Math.sin(a) * r; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ map:BT || (BT = bubbleTex()), size:.7, transparent:true, depthWrite:false, opacity:.85 })); grp.add(pts); Wt.vents.push({ vt, pts, cyl }); W.sparkle(vt.x, vt.y0 + 1, vt.z, 0xaef6ff, 10);
};
Wt.setLevel = function (v, lvl) {
  v.level = lvl; const h = Math.max(.01, lvl - v.y0);
  v.vol.scale.set(v.x1 - v.x0, h, v.z1 - v.z0); v.vol.position.set((v.x0 + v.x1) / 2, v.y0 + h / 2, (v.z0 + v.z1) / 2); v.top.position.set((v.x0 + v.x1) / 2, lvl + .02, (v.z0 + v.z1) / 2);
};
Wt.levelAt = function (x, z) { for (const v of Wt.vols) if (x >= v.x0 && x <= v.x1 && z >= v.z0 && z <= v.z1) return v.level; return null; };
Wt.ventAt = function (x, y, z) { for (const e of Wt.vents) { const vt = e.vt; if (y >= vt.y0 && y <= vt.y1 && Math.hypot(x - vt.x, z - vt.z) < vt.r) return vt; } return null; };
Wt.update = function (dt, t) {
  Wt.t += dt;
  for (const v of Wt.vols) { v.tex.offset.x += dt * .05; v.tex.offset.y += dt * .03; if (v.target != null) { const df = v.target - v.level, st = Math.min(Math.abs(df), dt * 1.1) * Math.sign(df); Wt.setLevel(v, v.level + st); if (Math.abs(df) < .01) v.target = null; } }
  for (const f of Wt.falls) f.t.offset.y -= dt * 1.4;
  for (const e of Wt.vents) { const a = e.pts.geometry.attributes.position, vt = e.vt; for (let i = 0; i < a.count; i++) { let y = a.getY(i) + dt * (3 + (i % 4)); if (y > vt.y1) y = vt.y0; a.setY(i, y); } a.needsUpdate = true; }
  // splash + underwater tint
  const P = W.player, lv = Wt.levelAt(P.x, P.z), inW = lv != null && P.y + .45 < lv;
  if (inW !== Wt.inWas && Math.abs(P.vy) > 2) { W.sfx('splash'); for (let i = 0; i < 12; i++) W.sparkle(P.x, lv, P.z, 0xbff4ff, 1); }
  Wt.inWas = inW;
  const cl = Wt.levelAt(W.camera.position.x, W.camera.position.z), under = cl != null && W.camera.position.y < cl;
  const uw = document.getElementById('uw'); if (uw) uw.style.opacity = under ? 1 : 0;
};
Wt.sub = P => { const lv = Wt.levelAt(P.x, P.z); return lv == null ? -1 : lv - P.y; };   // metres of Nova's body under the surface
})(window.W);
