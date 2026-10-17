'use strict';
(function (W) {
const THREE = window.THREE;
const S = W.Slide = { tracks:[], active:null };
const UP = new THREE.Vector3(0, 1, 0);

function sample(pts) {
  const P = pts.map(p => new THREE.Vector3(...p)), curve = new THREE.CatmullRomCurve3(P, false, 'catmullrom', .5), len = curve.getLength(), n = Math.max(8, Math.ceil(len / .35));
  const pos = [], tan = [], cum = [];
  for (let i = 0; i <= n; i++) { const u = i / n; pos.push(curve.getPoint(u)); tan.push(curve.getTangent(u).normalize()); cum.push(u * len); }
  return { pos, tan, cum, L:len };
}
function at(tr, s) {
  const c = tr.cum, n = c.length - 1; s = Math.max(0, Math.min(tr.L, s)); let i = Math.min(n - 1, Math.floor(s / tr.L * n)); while (i < n - 1 && c[i + 1] < s) i++; while (i > 0 && c[i] > s) i--;
  const k = (s - c[i]) / Math.max(1e-6, c[i + 1] - c[i]); return { p:tr.pos[i].clone().lerp(tr.pos[i + 1], k), t:tr.tan[i].clone().lerp(tr.tan[i + 1], k).normalize() };
}
function rightOf(t) { const r = new THREE.Vector3().crossVectors(t, UP); if (r.lengthSq() < 1e-4) r.set(1, 0, 0); return r.normalize(); }

S.populate = function (R) {
  S.tracks = []; S.active = null; const grp = new THREE.Group(); R.group.add(grp);
  (R.def.tracks || []).forEach((d, ti) => {
    const sm = sample(d.pts), tr = Object.assign(sm, { d, id:d.id || (R.id + '_trk' + ti), width:d.width || 2.4, rings:[], pads:[], got:0 });
    const step = .62, n = Math.floor(tr.L / step), col = d.color || 0xcfe9ff, rail = d.rail || 0xffffff;
    const im = new THREE.InstancedMesh(W.boxGeo, W.patchOcc(new THREE.MeshLambertMaterial()), n * 3), m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), cc = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const a = at(tr, i * step + step / 2), r = rightOf(a.t), u = new THREE.Vector3().crossVectors(r, a.t).normalize(); q.setFromRotationMatrix(m.makeBasis(r, u, a.t));
      for (let k = 0; k < 3; k++) {
        const off = k === 0 ? 0 : (k === 1 ? -1 : 1) * (tr.width / 2 + .1), pos = a.p.clone().addScaledVector(r, off).addScaledVector(u, k === 0 ? -.12 : .1);
        sc.set(k === 0 ? tr.width : .22, k === 0 ? .22 : .5, step * 1.05); m.compose(pos, q, sc); im.setMatrixAt(i * 3 + k, m); cc.setHex(k === 0 ? (i % 2 ? col : col - 0x101010) : rail); im.setColorAt(i * 3 + k, cc);
      }
    }
    im.castShadow = false; im.receiveShadow = true; grp.add(im); tr.mesh = im;
    // boost pads
    for (const f of d.pads || []) {
      const s0 = f * tr.L, a = at(tr, s0), r = rightOf(a.t), u = new THREE.Vector3().crossVectors(r, a.t).normalize();
      const pad = new THREE.Group(); for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(W.boxGeo, new THREE.MeshBasicMaterial({ color:k % 2 ? 0xffd23f : 0xff9f1c })); b.scale.set(tr.width * .8, .08, .35); b.position.z = -.5 + k * .5; pad.add(b); }
      pad.position.copy(a.p).addScaledVector(u, -.0); q.setFromRotationMatrix(m.makeBasis(r, u, a.t)); pad.quaternion.copy(q); grp.add(pad); tr.pads.push({ s:s0, hit:false, g:pad });
    }
    // entry pad
    const a0 = at(tr, 0); const entry = new THREE.Mesh(new THREE.TorusGeometry(1.1, .12, 6, 18), new THREE.MeshBasicMaterial({ color:0x7df9ff })); entry.position.copy(a0.p).add(new THREE.Vector3(0, .5, 0)); entry.rotation.x = Math.PI / 2; grp.add(entry); tr.entry = entry;
    // rings
    for (let s = 2; s < tr.L - 1; s += 1.7) {
      const a = at(tr, s), r = rightOf(a.t), lane = Math.sin(s * .35) * (tr.width * .28), mesh = W.box(.55, .55, .1, 0xffd23f); mesh.material.emissive = new THREE.Color(0x805f00); mesh.castShadow = false;
      mesh.position.copy(a.p).addScaledVector(r, lane).add(new THREE.Vector3(0, .8, 0)); grp.add(mesh); tr.rings.push({ mesh, got:false });
    }
    tr.done = !!W.S.items['trk_' + tr.id]; S.tracks.push(tr);
  });
};

S.begin = function (tr) {
  const P = W.player; P.setMode('ball', true); P.slide = { tr, s:0, v:Math.max(10, Math.hypot(P.vx, P.vz) * .6 + 8), o:0, got:0 }; P.pound = false; P.dashT = 0; P.vy = 0; S.active = tr; W.sfx('roll'); W.sfx('boost', .6); W.shake(.15); W.bit.say('slide');
  for (const p of tr.pads) p.hit = false;
};
S.leave = function (jump, finished) {
  const P = W.player, sl = P.slide; if (!sl) return; const a = at(sl.tr, sl.s), v = sl.v;
  const ev = finished ? Math.min(v, 14) : v; P.vx = a.t.x * ev * .95; P.vz = a.t.z * ev * .95; P.vy = a.t.y * ev + (jump ? 11 : 0) + (finished ? 3 : 0); P.slide = null; P.slideLock = .5; P.jumps = jump ? 1 : 0; P.ground = false; P.airMax = Math.max(11, v);
  S.active = null;
  if (finished) {
    const tr = sl.tr; W.sfx('fanfare', .6);
    if (!tr.done) { tr.done = true; W.S.items['trk_' + tr.id] = true; W.S.tokens += 10; W.ui.banner('Slide complete!', `${sl.got} rings · +10 tokens first run bonus`, '#7df9ff'); W.writeAuto(); }
    else W.ui.toast(`Slide complete! ${sl.got} rings`);
  }
};
S.step = function (d) {
  const P = W.player, sl = P.slide, tr = sl.tr, I = W.input;
  let a = at(tr, sl.s), v = sl.v;
  v += -a.t.y * 34 * d * .95; v -= v * .1 * d; v = Math.max(7, Math.min(38, v));
  const s1 = sl.s + v * d;
  for (const p of tr.pads) if (!p.hit && sl.s < p.s && s1 >= p.s) { p.hit = true; v = Math.min(40, v + 13); W.sfx('boost'); W.sparkle(P.x, P.y + .5, P.z, 0xffd23f, 10); W.shake(.15); }
  sl.s = s1; sl.v = v; a = at(tr, sl.s); const r = rightOf(a.t), u = new THREE.Vector3().crossVectors(r, a.t).normalize();
  const yaw = W.camYaw, cs = Math.cos(yaw), sn = Math.sin(yaw), ax = I.ax, ay = I.ay, wx = ax * cs + ay * sn, wz = -ax * sn + ay * cs, lat = wx * r.x + wz * r.z;
  sl.o += W.clamp(lat, -1, 1) * 5.5 * d; sl.o = W.clamp(sl.o, -(tr.width / 2 - .45), tr.width / 2 - .45);
  const pos = a.p.clone().addScaledVector(r, sl.o).addScaledVector(u, .5);
  P.x = pos.x; P.y = pos.y - .4; P.z = pos.z; P.vx = a.t.x * v; P.vz = a.t.z * v; P.vy = a.t.y * v; P.face = Math.atan2(a.t.x, a.t.z); P.ground = true;
  for (const rg of tr.rings) if (!rg.got && rg.mesh.position.distanceToSquared(pos) < 1.4) { rg.got = true; rg.mesh.visible = false; sl.got++; W.sfx('ring'); }
  if (Math.random() < .5) W.sparkle(P.x - a.t.x, P.y + .2, P.z - a.t.z, 0xbff4ff, 1);
  if (I.pressed.jump) { S.leave(true, false); return; }
  if (sl.s >= tr.L - .05) S.leave(false, true);
};
S.update = function (d, time) {
  const P = W.player;
  for (const tr of S.tracks) {
    tr.entry.rotation.z = time * 2; tr.entry.material.color.setHex(tr.done ? 0x7ed957 : 0x7df9ff);
    for (const rg of tr.rings) if (!rg.got) rg.mesh.rotation.y = time * 3;
  }
  if (P.slide || P.slideLock > 0 || W.state !== 'play') { P.slideLock -= d; return; }
  for (const tr of S.tracks) {
    const a0 = tr.pos[0];
    if (Math.hypot(P.x - a0.x, P.z - a0.z) < 1.5 && Math.abs(P.y - (a0.y - .3)) < 2.6 && W.has('roll') && (P.mode === 'ball' || P.ground || true) && P.hurtT <= 0) { S.begin(tr); break; }
  }
};
S.pathCheck = function (R) {   // dev helper: returns track samples that sit inside solid voxels
  const bad = [];
  for (const tr of S.tracks) for (let s = 1; s < tr.L - 1; s += .5) { const a = at(tr, s); if (R.hitBox(a.p.x, a.p.y + .15, a.p.z, .35, .7)) bad.push([tr.id, +s.toFixed(1), +a.p.x.toFixed(1), +a.p.y.toFixed(1), +a.p.z.toFixed(1)]); }
  return bad;
};
})(window.W);
