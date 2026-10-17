'use strict';
(function (W) {
const THREE = window.THREE;
const GRAV = 34, JUMPV = 14.75, WALK = 7, RUN = 11, BALL = 9;
W.grav = -1; W.giant = false; W.camYaw = 0; W.camPitch = 0.45;

/* ---------- particles ---------- */
const pmats = {}, parts = [], pgeo = W.boxGeo;
function pmat(c) { return pmats[c] || (pmats[c] = new THREE.MeshBasicMaterial({ color:c })); }
function spawnPart(x, y, z, c, vx, vy, vz, life, size) {
  if (parts.length > 260) { const o = parts.shift(); W.scene.remove(o.m); }
  const m = new THREE.Mesh(pgeo, pmat(c)); m.position.set(x, y, z); m.scale.setScalar(size); W.scene.add(m);
  parts.push({ m, vx, vy, vz, life, max:life, size });
}
W.sparkle = (x, y, z, c = 0xffffff, n = 8) => { for (let i = 0; i < n; i++) spawnPart(x, y, z, c, (Math.random() - .5) * 6, Math.random() * 5 + 1, (Math.random() - .5) * 6, .6 + Math.random() * .3, .22); };
W.debris = (x, y, z, c) => { for (let i = 0; i < 3; i++) spawnPart(x, y, z, c, (Math.random() - .5) * 7, Math.random() * 6, (Math.random() - .5) * 7, .8, .3); };
W.updateParticles = dt => {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.life -= dt; p.vy -= 16 * dt;
    p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt; p.m.scale.setScalar(p.size * Math.max(0, p.life / p.max));
    if (p.life <= 0) { W.scene.remove(p.m); parts.splice(i, 1); }
  }
};

/* ---------- generic body collision (axis by axis, snapping, ledge step-up) ---------- */
W.stepBody = function (b, d, o) {
  o = o || {};
  const R = W.world.room, gs = o.grav || -1, up = -gs, sm = o.sm;
  b.hitX = b.hitZ = 0; b.ground = false;
  let nx = b.x + b.vx * d;
  if (R.hitBox(nx, b.y, b.z, b.hw, b.h, sm, b.hd)) {
    let stepped = false;
    if (o.step && b.vy * up <= 3) { const ny = b.y + o.step * up; if (!R.hitBox(nx, ny, b.z, b.hw, b.h, sm, b.hd)) { b.y = ny; stepped = true; } }
    if (!stepped) {
      const sx = b.vx > 0 ? Math.floor(nx + b.hw) - b.hw - 1e-3 : Math.floor(nx - b.hw) + 1 + b.hw + 1e-3;
      nx = R.hitBox(sx, b.y, b.z, b.hw, b.h, sm, b.hd) ? b.x : sx; b.hitX = Math.sign(b.vx) || 1; b.vx = 0;
    }
  }
  b.x = nx;
  const hz = b.hd == null ? b.hw : b.hd;
  let nz = b.z + b.vz * d;
  if (R.hitBox(b.x, b.y, nz, b.hw, b.h, sm, b.hd)) {
    let stepped = false;
    if (o.step && b.vy * up <= 3) { const ny = b.y + o.step * up; if (!R.hitBox(b.x, ny, nz, b.hw, b.h, sm, b.hd)) { b.y = ny; stepped = true; } }
    if (!stepped) {
      const sz = b.vz > 0 ? Math.floor(nz + hz) - hz - 1e-3 : Math.floor(nz - hz) + 1 + hz + 1e-3;
      nz = R.hitBox(b.x, b.y, sz, b.hw, b.h, sm, b.hd) ? b.z : sz; b.hitZ = Math.sign(b.vz) || 1; b.vz = 0;
    }
  }
  b.z = nz;
  let ny = b.y + b.vy * d;
  if (R.hitBox(b.x, ny, b.z, b.hw, b.h, sm, b.hd)) {
    if (b.vy < 0) { let sy = Math.floor(ny) + 1; if (R.hitBox(b.x, sy, b.z, b.hw, b.h, sm, b.hd)) sy = b.y; ny = sy; if (gs < 0) b.ground = true; }
    else { let sy = Math.floor(ny + b.h) - b.h - 1e-3; if (R.hitBox(b.x, sy, b.z, b.hw, b.h, sm, b.hd)) sy = b.y; ny = sy; if (gs > 0) b.ground = true; }
    b.vy = 0;
  }
  b.y = ny;
};

/* ---------- outlines ---------- */
W.outline = function (g, color, grow = 1.16) {
  const mats = {};
  const add = [];
  g.traverse(o => { if (o.isMesh && !o.userData.noOutline) add.push(o); });
  for (const m of add) {
    const mt = mats[color] || (mats[color] = new THREE.MeshBasicMaterial({ color, side:THREE.BackSide }));
    const ol = new THREE.Mesh(W.boxGeo, mt); ol.userData.noOutline = true; ol.userData.outline = true; ol.scale.setScalar(grow); m.add(ol);
  }
};

/* ---------- hero model: customisable (hat, suit, trim, cape) ---------- */
W.SUITS = [0xe63946, 0x2a9df4, 0x2ec4a0, 0x9b5de5, 0xff8c42, 0xf72585, 0x4a4e69, 0x1d1d2b];
W.TRIMS = [0xffd23f, 0xffffff, 0x7ed957, 0xff7ad9, 0x00e5ff, 0xff4d4d, 0xc8a165, 0x1c1740];
W.HATS = { cap:{ name:'Explorer Cap' }, beanie:{ name:'Beanie' }, ears:{ name:'Cat Ears', cost:15 }, propeller:{ name:'Propeller Cap', cost:25 }, wizard:{ name:'Wizard Hat', need:'seeds1', needText:'Collect a Twist Seed' }, crown:{ name:'Moss Crown', need:'boss', needText:'Beat Old Mossback' }, diver:{ name:'Diver Dome', need:'bubble', needText:'Find Bubble Float' }, shell:{ name:'Shell Cap', need:'mini', needText:'Beat Shellbert' }, queen:{ name:'Queen Fin', need:'bossK', needText:'Beat Queen Bubblefin' }, helmet:{ name:'Miner Helmet', need:'pick', needText:'Find the Pick Axe' } };
W.CAPES = { none:{ name:'No cape' }, short:{ name:'Short cape' }, long:{ name:'Hero cape', cost:20 } };
W.defaultLook = () => ({ hat:'cap', suit:0, trim:0, cape:'none' });
const hero = new THREE.Group(), parts_ = {};
function hatMesh(name, trim, suit) {
  const g = new THREE.Group(), tc = W.TRIMS[trim], sc = W.SUITS[suit];
  if (name === 'cap') g.add(W.box(.58, .2, .58, tc, 0, .0, 0), W.box(.4, .08, .22, tc, 0, -.07, .36));
  else if (name === 'beanie') g.add(W.box(.56, .22, .56, tc, 0, 0, 0), W.box(.58, .08, .58, sc, 0, -.1, 0), W.box(.16, .16, .16, 0xffffff, 0, .2, 0));
  else if (name === 'ears') g.add(W.box(.58, .06, .58, sc, 0, -.08, 0), W.box(.18, .22, .1, sc, -.2, .1, 0), W.box(.18, .22, .1, sc, .2, .1, 0), W.box(.08, .12, .12, 0xffa0c0, -.2, .08, .02), W.box(.08, .12, .12, 0xffa0c0, .2, .08, .02));
  else if (name === 'propeller') { g.add(W.box(.56, .2, .56, tc), W.box(.06, .16, .06, 0xffffff, 0, .17, 0)); const pr = new THREE.Group(); pr.add(W.box(.7, .03, .12, 0xff4d4d), W.box(.12, .03, .7, 0x2a9df4)); pr.position.y = .27; g.add(pr); parts_.prop = pr; }
  else if (name === 'wizard') g.add(W.box(.8, .06, .8, sc, 0, -.1, 0), W.box(.5, .2, .5, sc, 0, .05, 0), W.box(.36, .2, .36, sc, 0, .25, 0), W.box(.2, .2, .2, sc, .03, .43, 0), W.box(.1, .12, .1, tc, .08, .6, 0), W.box(.52, .05, .52, tc, 0, -.02, 0));
  else if (name === 'crown') g.add(W.box(.56, .14, .56, 0xffd23f, 0, 0, 0), ...[[-.2, -.2], [.2, -.2], [-.2, .2], [.2, .2], [0, 0]].map(([x, z]) => W.box(.1, .16, .1, 0xffd23f, x, .13, z)), W.box(.1, .1, .1, 0x7ed957, 0, .02, .29));
  else if (name === 'diver') { g.add(W.box(.6, .1, .6, 0xcfd3e8, 0, -.08, 0)); const dome = new THREE.Mesh(new THREE.SphereGeometry(.45, 12, 8), new THREE.MeshBasicMaterial({ color:0xbff4ff, transparent:true, opacity:.4 })); dome.position.y = .12; dome.userData.noOutline = true; g.add(dome); g.add(W.box(.08, .2, .08, 0xff4d4d, 0, .55, 0)); }
  else if (name === 'shell') g.add(W.box(.62, .22, .62, 0xc9a25f, 0, 0, 0), W.box(.4, .18, .4, 0xffe0a0, 0, .17, 0), W.box(.2, .14, .2, 0xc9a25f, 0, .3, 0));
  else if (name === 'queen') g.add(W.box(.58, .1, .58, 0xff6fc8, 0, -.05, 0), ...[-.2, 0, .2].map((x, i) => W.box(.12, .22 + (i === 1 ? .14 : 0), .1, 0x7df9ff, x, .12, 0)));
  else if (name === 'helmet') { g.add(W.box(.6, .24, .6, 0xffd23f, 0, 0, 0), W.box(.2, .1, .1, 0xffffff, 0, .02, .31)); const l = W.box(.14, .14, .08, 0xffffcc, 0, .04, .33); l.material.emissive = new THREE.Color(0xffffaa); g.add(l); }
  return g;
}
function buildHero() {
  hero.clear(); for (const k in parts_) if (k !== 'shadow') delete parts_[k];
  const S = W.S, look = Object.assign(W.defaultLook(), S && S.look), body = W.SUITS[look.suit], skin = 0xf2c18d;
  const pivot = (name, x, y, z, child, cy) => { const g = new THREE.Group(); g.position.set(x, y, z); child.position.y = cy; g.add(child); parts_[name] = g; hero.add(g); };
  pivot('legL', -.16, .6, 0, W.box(.28, .6, .28, 0x2a4d9b), -.3); pivot('legR', .16, .6, 0, W.box(.28, .6, .28, 0x2a4d9b), -.3);
  pivot('armL', -.42, 1.2, 0, W.box(.22, .6, .22, skin), -.25); pivot('armR', .42, 1.2, 0, W.box(.22, .6, .22, skin), -.25);
  parts_.torso = W.box(.6, .65, .35, body, 0, .92, 0); parts_.head = W.box(.5, .5, .5, skin, 0, 1.45, 0);
  parts_.eyeL = W.box(.12, .14, .06, 0x111111, -.12, 1.5, .26); parts_.eyeR = W.box(.12, .14, .06, 0x111111, .12, 1.5, .26); parts_.mouth = W.box(.2, .05, .05, 0x7a2a2a, 0, 1.33, .26);
  parts_.ant = W.box(.06, .22, .06, 0xffffff, 0, 1.98, 0); parts_.tip = W.box(.14, .14, .14, 0x6bffd4, 0, 2.12, 0); parts_.tip.material.emissive = new THREE.Color(0x2affd0);
  parts_.hat = hatMesh(look.hat, look.trim, look.suit); parts_.hat.position.y = 1.74;
  if (['wizard', 'propeller', 'crown', 'diver', 'queen'].includes(look.hat)) { parts_.ant.visible = false; parts_.tip.visible = false; parts_.antOff = true; }
  parts_.belt = W.box(.62, .1, .37, W.TRIMS[look.trim], 0, .68, 0);
  hero.add(parts_.torso, parts_.belt, parts_.head, parts_.hat, parts_.eyeL, parts_.eyeR, parts_.mouth, parts_.ant, parts_.tip);
  if (look.cape !== 'none') { const len = look.cape === 'long' ? 1.15 : .65, cp = new THREE.Group(); cp.position.set(0, 1.2, -.2); const m = W.box(.56, len, .06, W.TRIMS[look.trim], 0, -len / 2, 0); cp.add(m); parts_.cape = cp; hero.add(cp); }
  // pick axe prop in the right hand
  const pick = new THREE.Group(); pick.add(W.box(.07, .8, .07, 0x8a5a36, 0, 0, 0), W.box(.62, .1, .1, 0xcfd3e8, 0, .42, 0), W.box(.12, .12, .12, 0xcfd3e8, .3, .36, 0), W.box(.12, .12, .12, 0xcfd3e8, -.3, .36, 0)); pick.position.set(0, -.5, .2); pick.rotation.x = 1.2; pick.visible = false; parts_.armR.add(pick); parts_.pick = pick;
  parts_.ball = W.box(.8, .8, .8, body, 0, .4, 0); parts_.ball.visible = false; hero.add(parts_.ball);
  const bub = new THREE.Mesh(new THREE.SphereGeometry(1.15, 14, 10), new THREE.MeshBasicMaterial({ color:0xbff4ff, transparent:true, opacity:.28, depthWrite:false })); bub.position.y = .95; bub.userData.noOutline = true; bub.visible = false; parts_.bubble = bub; hero.add(bub);
  const st = W.box(.82, .2, .82, W.TRIMS[look.trim], 0, 0, 0); st.scale.set(1.02, .25, 1.02); parts_.ball.add(st);
  W.outline(hero, W.settings.hc ? 0xffffff : 0x1c1740, 1.14);
  if (!parts_.shadow) { parts_.shadow = W.Visuals.blobShadow(1.4); parts_.shadow.position.y = .04; }
}
W.buildHero = buildHero;
W.heroGroup = new THREE.Group(); W.heroGroup.add(hero); W.scene.add(W.heroGroup);

/* ---------- the player ---------- */
const P = W.player = {
  x:0, y:0, z:0, vx:0, vy:0, vz:0, hw:.35, h:1.7, face:Math.PI, mode:'stand', st:'idle', ground:false, coyote:0, jbuf:0, jumps:0, airMax:WALK, dashT:0, dashCd:0, dashUsed:false,
  ghostT:0, ghostCd:0, ghostWas:false, floatT:3.6, floating:false, slide:null, slideLock:0, pound:false, hurtT:0, inv:0, bonkT:0, bonkCd:0, shootHold:0, shootCd:0, cutJump:false, safe:null, t:0, squash:0, roomEntry:null, dashDir:[0, 1], wallN:null, charged:false,
};
const SIZES = { stand:[.35, 1.7], crouch:[.35, 1.1], ball:[.3, .8] };
P.smash = () => W.giant ? Math.floor(P.y + .6) : undefined;
P.place = (x, y, z) => { P.slide = null; P.floating = false; P.x = x; P.y = y; P.z = z; P.vx = P.vy = P.vz = 0; P.mode = 'stand'; P.hw = .35; P.h = 1.7; P.dashT = 0; P.pound = false; P.safe = { x, y, z }; P.inv = 1; P.hurtT = 0; if (W.giant) P.applyGiant(); };
P.applyGiant = () => { P.hw = 1.05; P.h = 5.1; };
P.hits = (x, y, z, hw, h) => W.world.room.hitBox(x, y, z, hw, h, P.smash());
P.setMode = (m, force) => {
  const [hw, h] = W.giant ? [1.05, 5.1] : SIZES[m];
  if (!force && P.hits(P.x, P.y, P.z, hw, h)) return false;
  P.mode = m; P.hw = hw; P.h = h; return true;
};
P.fitToSpace = () => {
  if (!P.hits(P.x, P.y, P.z, P.hw, P.h)) return;
  if (!P.setMode('ball')) for (let i = 1; i < 14; i++) { P.y += .5; if (!P.hits(P.x, P.y, P.z, P.hw, P.h)) break; }
};
P.up = () => -W.grav;

P.mine = function () {
  const R = W.world.room, S = W.S; P.bonkT = 0; P.bonkCd = .4; P.mining = .3;
  const dx = Math.sin(P.face), dz = Math.cos(P.face); let hit = null;
  for (const h of [P.h * .55, .35, P.h * .92]) { for (let t = .45; t <= 2.3 && !hit; t += .25) { const i = Math.floor(P.x + dx * t), j = Math.floor(P.y + h), k = Math.floor(P.z + dz * t), kd = R.kindAt(i, j, k); if (W.isSolidKind(kd)) { if (kd === 9 || kd === 10) hit = { i, j, k, kd }; break; } } if (hit) break; }
  if (!hit) { W.sfx('bonk', .5); return; }
  R.mineHp = R.mineHp || {}; const key = hit.i + ',' + hit.j + ',' + hit.k; R.mineHp[key] = (R.mineHp[key] != null ? R.mineHp[key] : (hit.kd === 10 ? 4 : 3)) - 1;
  W.sfx('mine'); W.shake(.12); W.debris(hit.i + .5, hit.j + .5, hit.k + .5, R.c[R.ix(hit.i, hit.j, hit.k)]); W.debris(hit.i + .5, hit.j + .5, hit.k + .5, 0xffffff);
  if (R.mineHp[key] <= 0) {
    R.set(hit.i, hit.j, hit.k, 0, 0); (S.broken[R.id] = S.broken[R.id] || []).push([hit.i, hit.j, hit.k]);
    if (hit.kd === 10) { S.tokens += 4; W.ui.toast('+4 tokens (gold ore)'); W.sfx('pickup'); W.sparkle(hit.i + .5, hit.j + .5, hit.k + .5, 0xffd23f, 10); }
    W.bit.say('mine');
  }
};

function wallProbe() {
  const R = W.world.room;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (R.hitBox(P.x + dx * .12, P.y + .25, P.z + dz * .12, P.hw, P.h - .5, undefined)) return { x:-dx, z:-dz };
  return null;
}
function supported(x, z, y) { const R = W.world.room; return W.grav > 0 ? true : R.solid(Math.floor(x), Math.floor(y - .4), Math.floor(z)); }

P.aimDir = function () {
  const S = W.settings, I = W.input, cp = W.camPitch, cy = W.camYaw;
  let dx = Math.sin(P.face), dz = Math.cos(P.face), dy = 0;
  if (I.down.aim) { dx = -Math.sin(cy); dz = -Math.cos(cy); dy = Math.sin(cp - .3) * -1 * .8 + .0; dy = -Math.sin(cp - .25); }
  if (S.assist.autoaim || (I.down.aim && Math.hypot(I.cx, I.cy) < .1 && false)) {
    let best = null, bd = 20;
    for (const e of W.Actors.enemies) { if (!e.alive || e.hidden) continue; const ex = e.x - P.x, ez = e.z - P.z, dist = Math.hypot(ex, ez); if (dist > bd) continue; const dot = (ex * dx + ez * dz) / (dist || 1); if (dot > .5) { best = e; bd = dist; } }
    if (best) { const tx = best.x - P.x, tz = best.z - P.z, ty = best.y + best.h * .5 - (P.y + P.h * .6), l = Math.hypot(tx, ty, tz) || 1; return [tx / l, ty / l, tz / l]; }
  }
  const l = Math.hypot(dx, dy, dz); return [dx / l, dy / l, dz / l];
};

P.update = function (d) {
  const R = W.world.room, I = W.input, S = W.S, Sg = W.settings, A = S.abilities, gs = W.grav, up = -gs;
  P.t += d; P.coyote -= d; P.jbuf -= d; P.inv -= d; P.hurtT -= d; P.dashCd -= d; P.bonkCd -= d; P.bonkT -= d; P.shootCd -= d; P.squash *= Math.pow(.001, d);
  const spring = S.equipped.includes('spring') ? .05 : 0;
  if (W.giant) P.applyGiant();
  if (P.slide) { W.Slide.step(d); P.st = 'roll'; P.floating = false; W.animateHero(); return; }
  const sub = W.Water.sub(P), inW = sub > .5, deep = sub > .9, vent = W.Water.ventAt(P.x, P.y + P.h * .5, P.z); P.inW = inW;
  if (P.ghostWas && !W.ghost && P.hits(P.x, P.y, P.z, P.hw, P.h)) { let ok = false; for (let r = .5; r <= 4 && !ok; r += .5) for (let a = 0; a < 6.28 && !ok; a += .785) { const nx = P.x + Math.cos(a) * r, nz = P.z + Math.sin(a) * r; if (!P.hits(nx, P.y, nz, P.hw, P.h)) { P.x = nx; P.z = nz; ok = true; } } if (!ok) { P.x = P.roomEntry.x; P.y = P.roomEntry.y; P.z = P.roomEntry.z; } }
  P.ghostWas = W.ghost;
  if (W.paper) { P.ghostT -= d; P.ghostCd -= d; if (I.pressed.crouch && P.ghostCd <= 0 && P.ghostT <= 0) { P.ghostT = 2.2; P.ghostCd = 3.4; W.sfx('flip'); W.sparkle(P.x, P.y + 1, P.z, 0xffffff, 8); } W.ghost = P.ghostT > 0; } else W.ghost = false;
  // ----- mode (stand / crouch / ball) -----
  const hasRoll = !!A.roll;
  if (!W.giant && P.hurtT <= 0) {
    if (W.paper) { /* crouch slips behind the paper */ }
    else if (hasRoll) {
      if (I.pressed.crouch && P.ground) { if (P.mode === 'ball') { if (P.setMode('stand')) { } } else P.setMode('ball'); W.sfx('roll'); }
    } else {
      if (P.ground && I.down.crouch && P.mode === 'stand') P.setMode('crouch');
      else if (P.mode === 'crouch' && !(I.down.crouch && P.ground)) P.setMode('stand');
    }
  }
  if (P.ground && W.giant) P.mode = 'stand';
  // ----- movement wish -----
  const yaw = W.camYaw, cs = Math.cos(yaw), sn = Math.sin(yaw);
  const ax = I.ax * (gs > 0 ? -1 : 1), ay = I.ay;
  const wx = ax * cs + ay * sn, wz = -ax * sn + ay * cs, mag = Math.min(1, Math.hypot(wx, wz));
  const base = P.mode === 'ball' ? BALL : P.mode === 'crouch' ? 3 : (I.down.run ? RUN : WALK);
  const control = P.hurtT <= 0 && P.dashT <= 0 && P.st !== 'dead', baseW = inW ? .72 : 1;
  if (control) {
    const nx = mag ? wx / mag : 0, nz = mag ? wz / mag : 0;
    if (P.ground) {
      const tx = nx * base * mag * baseW, tz = nz * base * mag * baseW, acc = (mag ? base / .12 : base / .06) * d;
      const dvx = tx - P.vx, dvz = tz - P.vz, dl = Math.hypot(dvx, dvz);
      if (dl <= acc) { P.vx = tx; P.vz = tz; } else { P.vx += dvx / dl * acc; P.vz += dvz / dl * acc; }
    } else {
      const cap = Math.max(P.airMax, base) * baseW, tx = nx * cap * mag, tz = nz * cap * mag, acc = (RUN / .1) * d;
      if (mag) { const dvx = tx - P.vx, dvz = tz - P.vz, dl = Math.hypot(dvx, dvz); if (dl <= acc) { P.vx = tx; P.vz = tz; } else { P.vx += dvx / dl * acc; P.vz += dvz / dl * acc; } }
      else { const k = Math.max(0, 1 - 1.2 * d); P.vx *= k; P.vz *= k; }
    }
    if (I.down.aim) P.face = yaw + Math.PI; else if (Math.hypot(P.vx, P.vz) > .6 && mag) P.face = Math.atan2(P.vx, P.vz);
  }
  // ----- jump buffering / coyote -----
  if (I.pressed.jump) P.jbuf = .1 + spring;
  if (P.ground) { P.coyote = .1 + spring; }
  const wall = (!P.ground && A.kick && !W.giant) ? wallProbe() : null; P.wallN = wall;
  if (P.jbuf > 0 && control && deep) {                                // swim stroke
    P.vy = up * 7.4; P.jbuf = 0; P.jumps = Math.min(P.jumps, 1); P.squash = .15; W.sfx('bubble'); W.sparkle(P.x, P.y + 1, P.z, 0xbff4ff, 5);
  } else if (P.jbuf > 0 && control) {
    if (wall && P.coyote <= 0) {                                    // wall kick
      P.vx = wall.x * 8.5; P.vz = wall.z * 8.5; P.vy = up * JUMPV * .96; P.face = Math.atan2(wall.x, wall.z); P.jumps = 1; P.airMax = 8.5; P.jbuf = 0; P.cutJump = true; P.squash = .3; W.sfx('kick'); W.sparkle(P.x, P.y + 1, P.z, 0xff5d73, 6);
    } else if (P.coyote > 0 || P.ground) {                           // jump
      if (P.mode === 'ball' && !P.setMode('stand')) { /* no headroom */ }
      else { if (P.mode === 'crouch') P.setMode('stand'); P.vy = up * JUMPV; P.jumps = 1; P.coyote = 0; P.jbuf = 0; P.cutJump = true; P.airMax = Math.max(Math.hypot(P.vx, P.vz), base); P.ground = false; P.squash = .3; W.sfx('jump'); }
    } else if (A.hop && P.jumps < 2 && !W.giant) {                    // double hop
      P.vy = up * JUMPV * 1.04; P.jumps = 2; P.jbuf = 0; P.cutJump = true; P.squash = .35; W.sfx('hop'); W.sparkle(P.x, P.y + .2, P.z, 0xffd23f, 10);
    }
  }
  // ----- Bubble Float: hold Jump in the air after your last jump (or in water / updrafts) -----
  if (A.bubble && !W.giant && control && !P.slide) {
    const can = !P.ground && I.down.jump && (P.jumps >= (A.hop ? 2 : 1) || inW || vent) && (P.floating || P.vy * up <= 1.5) && P.floatT > 0;
    if (can && !P.floating) { P.floating = true; W.sfx('bubble'); W.sparkle(P.x, P.y + .8, P.z, 0xbff4ff, 8); }
    if (!can) P.floating = false;
  } else P.floating = false;
  if (P.ground || inW) P.floatT = 3.6;
  if (P.cutJump && !I.down.jump && P.vy * up > 4) { P.vy *= .5; P.cutJump = false; }
  if (P.vy * up <= 0) P.cutJump = false;
  // ----- dash (Spark Dash on the ability wheel; Run press) -----
  if (control && A.dash && S.wheel === 'dash' && I.pressed.run && P.dashCd <= 0 && !P.dashUsed && P.mode !== 'ball') {
    P.dashT = .22; P.dashCd = .55; P.dashUsed = !P.ground; P.dashDir = [Math.sin(P.face), Math.cos(P.face)]; W.sfx('dash'); P.squash = -.3;
  }
  // ----- gravity -----
  if (P.dashT > 0) { P.dashT -= d; P.vx = P.dashDir[0] * 26; P.vz = P.dashDir[1] * 26; P.vy = 0; W.Actors.dashHit(); R.breakNear(P.x + P.dashDir[0] * .8, P.y + .8, P.z + P.dashDir[1] * .8, 1.0, [2], 1.0) && (W.sfx('crack'), W.shake(.25)); if (P.dashT <= 0) { P.vx = P.dashDir[0] * RUN; P.vz = P.dashDir[1] * RUN; P.airMax = RUN; } }
  else if (P.floating) { const tgt = up * (vent ? 8.5 : 2.6); P.vy += (tgt - P.vy) * Math.min(1, 7 * d); if (!vent) P.floatT -= d; }
  else if (P.pound) P.vy = gs * 30;
  else {
    P.vy += gs * GRAV * d * (inW ? .3 : 1);
    if (wall && P.vy * gs > 3) P.vy = gs * 3;                       // wall slide
    P.vy = inW ? W.clamp(P.vy, -6.5, 9) : W.clamp(P.vy, -32, 32);
  }
  // ----- ground pound -----
  if (!P.ground && I.pressed.crouch && !P.pound && P.dashT <= 0 && !(hasRoll && false) && !wall) { P.pound = true; W.sfx('warn'); }
  if (!P.ground && hasRoll && I.pressed.crouch) { /* ball toggle only on ground; pound handled above */ }
  // ----- integrate -----
  const wasGround = P.ground, preVy = P.vy, preVx = P.vx, preVz = P.vz;
  W.stepBody(P, d, { grav:gs, sm:P.smash(), step:.9 });
  if (P.mode === 'ball' && P.ground && control && mag > .3) {          // gentle magnet so the ball slides into 1-wide tunnels
    const ax_ = Math.abs(P.vx) > Math.abs(P.vz), lat = ax_ ? Math.abs(wz) / mag : Math.abs(wx) / mag;
    if (lat < .4) { const c = Math.floor(ax_ ? P.z : P.x) + .5, off = c - (ax_ ? P.z : P.x), step = Math.sign(off) * Math.min(Math.abs(off), 7 * d);
      if (Math.abs(off) > .005 && Math.abs(off) < .5) { const nx = ax_ ? P.x : P.x + step, nz = ax_ ? P.z + step : P.z; if (!P.hits(nx, P.y, nz, P.hw, P.h)) { P.x = nx; P.z = nz; } } }
  }
  if (W.giant) { const n = R.smash(P.x, P.y, P.z, P.hw + .05, P.h, Math.floor(P.y + .6)); if (n) { W.shake(.1); W.sfx('crack', .4); } }
  if (W.bouncy) {                                                      // Bouncy Cavern: every surface bounces
    if (P.ground && preVy < -2.5) { P.vy = Math.min(25, -preVy * .96 + (I.down.jump ? 7 : 0)); P.ground = false; P.jumps = 0; P.squash = -.3; W.sfx('jump', .6); }
    if (P.hitX) P.vx = -preVx * .85; if (P.hitZ) P.vz = -preVz * .85;
  }
  if (P.dashT > 0 && (P.hitX || P.hitZ)) P.dashT = 0;
  if (P.ground && !wasGround) {
    P.jumps = 0; P.dashUsed = false; P.coyote = .1 + spring;
    if (P.pound) { P.pound = false; W.Actors.poundLand(); }
    else if (Math.abs(preVy) > 9) { P.squash = -.35; W.sfx('land'); W.sparkle(P.x, P.y + (gs < 0 ? .1 : P.h - .1), P.z, 0xdddddd, 4); }
  }
  if (P.ground && P.mode !== 'ball') { /* nothing */ }
  if (!P.ground && P.st === 'wall') P.jumps = Math.min(P.jumps, 1);
  // safe spot for pit respawns
  if (P.ground && W.grav < 0 && P.dashT <= 0 && supported(P.x + .9, P.z + .9, P.y) && supported(P.x - .9, P.z + .9, P.y) && supported(P.x + .9, P.z - .9, P.y) && supported(P.x - .9, P.z - .9, P.y)) P.safe = { x:P.x, y:P.y, z:P.z };
  // ----- combat inputs -----
  if (P.hurtT <= 0 && P.st !== 'dead') {
    if (!S.weapons.blaster) { if (I.pressed.shoot && P.shootCd <= 0) { P.shootCd = 1.5; W.ui.toast('No weapon yet. Look for the Pulse Blaster!'); } }
    else {
    if (I.pressed.shoot) { P.shootHold = 0; P.charged = false; }
    if (I.down.shoot) {
      P.shootHold += d; const ct = (S.equipped.includes('charge') ? .45 : .9) - S.cores * .06;
      if (P.shootHold > ct && !P.charged) { P.charged = true; W.sfx('charge'); }
    }
    if (I.released.shoot && P.shootCd <= 0) {
      const dir = P.aimDir(), px = P.x, py = P.y + P.h * .6, pz = P.z;
      if (P.charged) { W.Actors.shoot(px, py, pz, dir, true); W.sfx('wave'); P.shootCd = .5; } else { W.Actors.shoot(px, py, pz, dir, false); W.sfx('shoot'); P.shootCd = .18; }
      P.charged = false; P.shootHold = 0;
    }
    }
    if (I.pressed.bonk && P.bonkCd <= 0) {
      const shop = W.world.items.find(i => i.t === 'shop' && Math.hypot(i.x - P.x, i.z - P.z) < i.r);
      const tide = W.world.room.def.doors.find(dr => dr.locked === 'tide' && !W.S.open.b9W && (() => { const c = W.world.room.doorCenter(dr); return Math.hypot(c.x - P.x, c.z - P.z) < 4.5; })());
      if (tide) W.ui.tideMenu(); else if (shop) W.ui.openShop(); else if (S.wheel === 'pick' && S.weapons.pick) P.mine(); else { P.bonkT = .35; P.bonkCd = .5; W.sfx('bonk'); W.Actors.bonk(); }
    }
  }
  if (I.pressed.bit) W.bit.scan();
  // ----- state label + animation -----
  P.st = P.hurtT > 0 ? 'hurt' : P.dashT > 0 ? 'dash' : P.pound ? 'pound' : P.mode === 'ball' ? 'roll' : P.mode === 'crouch' ? 'crouch' : wall && P.vy * gs > 0 ? 'wall' : !P.ground ? (P.vy * up > 0 ? 'jump' : 'fall') : Math.hypot(P.vx, P.vz) > .8 ? 'run' : 'idle';
  W.animateHero();
  // ----- hazards -----
  if (P.y < -4) W.Actors.fall();
  W.checkDoors();
};

W.animateHero = function () {
  const g = W.heroGroup, t = P.t, spd = Math.hypot(P.vx, P.vz), sc = W.giant ? 3 : 1;
  const inv = W.grav > 0;
  g.position.set(P.x, P.y + (inv ? P.h : 0), P.z); g.rotation.set(inv ? Math.PI : 0, P.face + (inv ? Math.PI : 0), 0);
  const ball = P.mode === 'ball';
  for (const k of ['legL', 'legR', 'armL', 'armR', 'torso', 'belt', 'head', 'hat', 'eyeL', 'eyeR', 'mouth']) parts_[k].visible = !ball;
  if (!parts_.antOff) { parts_.ant.visible = parts_.tip.visible = !ball; } if (parts_.cape) parts_.cape.visible = !ball;
  parts_.ball.visible = ball; if (ball) parts_.ball.rotation.x = t * Math.min(14, spd * 1.6) * (P.ground ? 1 : .3);
  const sw = Math.sin(t * 15) * Math.min(1, spd / 5) * (P.ground ? .9 : .25);
  parts_.legL.rotation.x = sw; parts_.legR.rotation.x = -sw; parts_.armL.rotation.x = -sw; parts_.armR.rotation.x = sw;
  if (P.st === 'jump' || P.st === 'fall' || P.st === 'pound') { parts_.armL.rotation.x = parts_.armR.rotation.x = -2.5; parts_.armL.rotation.z = .3; parts_.armR.rotation.z = -.3; } else { parts_.armL.rotation.z = parts_.armR.rotation.z = 0; }
  if (P.st === 'wall') { parts_.armL.rotation.x = parts_.armR.rotation.x = -2.9; }
  if (P.bonkT > 0) { g.rotation.y += (1 - P.bonkT / .35) * Math.PI * 4; parts_.armL.rotation.z = 1.5; parts_.armR.rotation.z = -1.5; parts_.armL.rotation.x = parts_.armR.rotation.x = 0; }
  // expressions
  const hurt = P.st === 'hurt', happy = W.happyT > 0, open = P.st === 'jump' || P.st === 'fall';
  parts_.eyeL.scale.set(.12, hurt ? .03 : .14, .06); parts_.eyeR.scale.set(.12, hurt ? .03 : .14, .06);
  parts_.mouth.scale.set(hurt ? .12 : happy ? .3 : open ? .14 : .2, hurt ? .14 : open ? .14 : happy ? .1 : .05, .05);
  parts_.tip.material.emissive.setHex(P.charged ? 0xffffff : 0x2affd0);
  const sq = P.squash, crouch = P.mode === 'crouch' ? .65 : 1;
  const mdl = hero; mdl.scale.set(sc * (1 - sq * .35), sc * crouch * (1 + sq * .4), sc * (1 - sq * .35));
  g.visible = (P.inv <= 0 || P.hurtT > 0 || Math.floor(t * 14) % 2 === 0) && !(W.ghost && Math.floor(t * 20) % 3 === 0);
  if (P.charged) { const f = .5 + .5 * Math.sin(t * 30); parts_.torso.material.emissive.setScalar(f * .5); } else parts_.torso.material.emissive.setScalar(0);
  if (parts_.prop) parts_.prop.rotation.y = t * 25;
  if (parts_.bubble) { parts_.bubble.visible = !!P.floating; parts_.bubble.scale.setScalar(1 + Math.sin(t * 9) * .05); }
  if (parts_.cape) parts_.cape.rotation.x = .1 + Math.min(.9, spd * .07) + Math.sin(t * 9) * .06 * Math.min(1, spd / 4) + (P.ground ? 0 : .25);
  const S_ = W.S, pickOn = S_ && S_.wheel === 'pick' && S_.weapons.pick; parts_.pick.visible = !!pickOn && !ball;
  if (P.mining > 0) { P.mining -= 1 / 60; parts_.armR.rotation.x = -2.6 + Math.sin((1 - P.mining / .3) * Math.PI) * 2.2; }
  if (parts_.shadow) { parts_.shadow.position.set(P.x, P.y + (W.grav > 0 ? P.h : 0) + .04, P.z); parts_.shadow.visible = !inv || true; if (!parts_.shadow.parent) W.scene.add(parts_.shadow); parts_.shadow.scale.setScalar(W.giant ? 3 : 1); }
};

W.shake = a => { W.shakeAmt = Math.max(W.shakeAmt || 0, a * W.settings.shake); };
W.snapCamera = () => { W.camPos = null; };

/* camera: orbit, slight lead, zoom, clipped against voxels */
W.updateCamera = function (dt) {
  const P_ = P, R = W.world.room, I = W.input, cam = W.camera;
  if (W.state === 'play' || W.state === 'photo') {
    W.camYaw -= I.cx * dt * 2.4;
    if (W.state === 'photo') W.camPitch = W.clamp(W.camPitch + I.cy * dt * 1.6, -.2, 1.3); else W.camPitch = W.clamp(W.camPitch + I.cy * dt * 1.2, .1, 1.15);
  }
  if (W.input.pressed.zoom) { W.zoomOut = !W.zoomOut; }
  if (P_.slide && Math.abs(I.cx) < .2) { const tl = P_.slide.tr, v = P_.slide.v; const f = Math.atan2(-P_.vx, -P_.vz); let dy = f - W.camYaw; while (dy > Math.PI) dy -= 6.2832; while (dy < -Math.PI) dy += 6.2832; W.camYaw += dy * Math.min(1, 2.2 * dt); }
  if (W.camLockYaw != null) { let dy = W.camLockYaw - W.camYaw; while (dy > Math.PI) dy -= 6.2832; while (dy < -Math.PI) dy += 6.2832; W.camYaw += dy * Math.min(1, 2 * dt); }
  const sc = W.giant ? 3 : 1, dist = (W.zoomOut ? 17 : 10) * (W.giant ? 2.2 : 1);
  const lead = W.state === 'play' ? 1.3 : 0, fx = P_.x + P_.vx * .12 * lead / 6, fz = P_.z + P_.vz * .12 * lead / 6;
  const ty = P_.y + (W.grav > 0 ? P_.h * .4 : P_.h * .6) + (W.grav > 0 ? -1 : 1);
  const cp = W.camPitch, wantX = fx + Math.sin(W.camYaw) * Math.cos(cp) * dist, wantY = ty + Math.sin(cp) * dist * (W.grav > 0 ? -1 : 1), wantZ = fz + Math.cos(W.camYaw) * Math.cos(cp) * dist;
  let k = R.rayFree(fx, ty, fz, wantX, wantY, wantZ); const dx = wantX - fx, dy = wantY - ty, dz = wantZ - fz;
  const cx = fx + dx * Math.max(.18, k - .06), cyy = W.clamp(ty + dy * Math.max(.18, k - .06), 1.2, R.h - 1.6), cz = fz + dz * Math.max(.18, k - .06);
  if (!W.camPos) { W.camPos = new THREE.Vector3(cx, cyy, cz); W.camLook = new THREE.Vector3(fx, ty, fz); W.camRoll = 0; }
  const f = 1 - Math.exp(-9 * dt);
  W.camPos.x += (cx - W.camPos.x) * f; W.camPos.y += (cyy - W.camPos.y) * f; W.camPos.z += (cz - W.camPos.z) * f;
  W.camLook.x += (fx - W.camLook.x) * f; W.camLook.y += (ty - W.camLook.y) * f; W.camLook.z += (fz - W.camLook.z) * f;
  W.camRoll += ((W.grav > 0 ? Math.PI : 0) - W.camRoll) * (1 - Math.exp(-5 * dt));
  cam.position.copy(W.camPos);
  const sh = W.shakeAmt || 0; if (sh > .001) { cam.position.x += (Math.random() - .5) * sh; cam.position.y += (Math.random() - .5) * sh; W.shakeAmt = sh * Math.pow(.01, dt); }
  const rr = W.camRoll, ru = Math.sin(rr); cam.up.set(ru * Math.cos(W.camYaw), Math.cos(rr), -ru * Math.sin(W.camYaw)); cam.lookAt(W.camLook);
  cam.fov = W.lerp(cam.fov, (W.zoomOut ? 70 : 62) + (P_.slide ? Math.min(22, P_.slide.v * .7) : 0), .1); cam.updateProjectionMatrix();
};
})(window.W);
