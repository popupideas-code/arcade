'use strict';
(function (W) {
const THREE = window.THREE;
const HAZ = 0xff4d1a;
const A = W.Actors = { enemies:[], shots:[], boss:null };

/* ---------- enemy ---------- */
class Enemy {
  constructor(type, x, y, z) {
    const df = W.ENEMIES[type]; this.type = type; this.df = df; this.x = this.hx = x; this.y = this.hy = y; this.z = this.hz = z;
    this.vx = this.vy = this.vz = 0; this.hw = df.hw; this.h = df.h; this.hp = df.hp; this.alive = true; this.state = 'idle'; this.tm = 1 + Math.random(); this.face = 0;
    this.dir = [Math.random() < .5 ? 1 : 0, 0]; this.dir[1] = this.dir[0] ? 0 : 1; this.sgn = Math.random() < .5 ? 1 : -1; this.stun = 0; this.bubble = 0; this.flash = 0; this.hidden = type === 'chomper'; this.parade = null; this.t0 = Math.random() * 9;
    const g = this.mesh = new THREE.Group(), body = this.body = new THREE.Group(); g.add(body);
    this.spr = W.Visuals.makeSprite(type); body.add(this.spr);
    if (type === 'floater') this.hw = .5; if (type === 'chomper') this.h = 2.2;
    this.shadow = W.Visuals.blobShadow(1.5); this.shadow.position.y = .05; g.add(this.shadow);
    this.platform = W.box(2.6, .3, 2.6, 0xb36bff, 0, .85, 0); this.platform.material.emissive = new THREE.Color(0x5a2a9a); this.platform.visible = false; this.platform.castShadow = false; g.add(this.platform);
    if (type === 'mimic') {
      this.disguised = true; this.hidden = true; this.spr.visible = false; this.hw = .9; const R0 = W.world.room;
      this.disg = W.box(1.8, 1, 1.8, R0.pal.stone, 0, .5, 0); g.add(this.disg); this.shadow.visible = false; R0.dyn.push(this.dynBox = { x, z, y, hx:.9, hz:.9, hy:1 });
    }
    g.position.set(x, y, z); W.world.group.add(g); this.mats = [];
    const ex = W.box(.12, .35, .12, 0xffee00, 0, 1.8, 0), ex2 = W.box(.12, .12, .12, 0xffee00, 0, 1.5, 0); this.warnIcon = new THREE.Group(); this.warnIcon.add(ex, ex2); this.warnIcon.visible = false; this.warnIcon.position.y = this.h + .4; g.add(this.warnIcon);
    this.warnIcon.children.forEach(c => { c.position.y -= 1.4; c.userData.noOutline = true; });
  }
  hurt(n, sx, sz) {
    if (!this.alive || this.hidden || this.parade) return false;
    this.hp -= n; this.flash = .15; W.sfx('hit'); this.stun = this.type === 'chomper' ? this.stun : Math.max(this.stun, .25);
    if (sx != null) { const dx = this.x - sx, dz = this.z - sz, l = Math.hypot(dx, dz) || 1; this.vx = dx / l * 4; this.vz = dz / l * 4; if (this.type === 'waddler') this.vy = 4; }
    if (this.hp <= 0) this.die();
    return true;
  }
  die() {
    this.alive = false; W.world.group.remove(this.mesh); W.sparkle(this.x, this.y + .6, this.z, this.df.color, 16); W.sparkle(this.x, this.y + .6, this.z, 0xffffff, 8); W.sfx('sparkle');
    W.bit.say('kill'); const S = W.S; S.kills++; if (S.kills % 4 === 0 && S.burst < 3) { S.burst++; W.ui.toast('Twist Burst charge +1'); W.hudPing(); }
    if (Math.random() < .35) W.world.items.push(new W.Item({ t:'token', temp:true, x:this.x, y:this.y + .8, z:this.z }));
  }
  update(d) {
    const P = W.player, df = this.df, R = W.world.room;
    this.t0 += d; this.flash -= d; this.stun -= d;
    W.Visuals.setExpr(this.spr, this.parade ? 'happy' : this.flash > 0 ? 'hurt' : this.stun > 0 || this.bubble > 0 ? 'stun' : this.state === 'warn' ? 'warn' : (this.state === 'attack' || this.state === 'up') ? 'attack' : 'idle');
    this.spr.material.color.setScalar(this.state === 'warn' ? .8 + .4 * Math.sin(this.t0 * 40) : 1);
    this.platform.visible = !!this.parade; this.shadow.visible = !this.hidden && !this.parade;
    this.warnIcon.visible = this.state === 'warn';
    if (this.parade) return this.updateParade(d);
    if (this.disguised) return this.updateDisguised(d);
    if (this.bubble > 0) { this.bubble -= d; this.y += d * 1.2; this.mesh.position.set(this.x, this.y, this.z); this.body.scale.setScalar(1.25); if (this.bubble <= 0) this.body.scale.setScalar(1); return; }
    const dx = P.x - this.x, dz = P.z - this.z, dist = Math.hypot(dx, dz), near = dist < df.sense && Math.abs(P.y - this.y) < 2.5;
    let sq = 1;
    if (this.type === 'waddler' || this.type === 'mimic') {
      if (this.stun > 0) { /* stunned */ }
      else if (this.state === 'idle') {
        this.vx = this.dir[0] * this.sgn * df.speed; this.vz = this.dir[1] * this.sgn * df.speed; this.face = Math.atan2(this.vx, this.vz);
        const fx = this.x + this.dir[0] * this.sgn * .8, fz = this.z + this.dir[1] * this.sgn * .8;
        if (!R.solid(Math.floor(fx), Math.floor(this.y - .3), Math.floor(fz)) && this.ground) this.sgn *= -1;
        if (this.hitX || this.hitZ) this.sgn *= -1;
        if (near && P.inv <= 0 && !W.giant) { this.state = 'warn'; this.tm = df.warn; W.sfx('warn'); }
      } else if (this.state === 'warn') { this.vx = this.vz = 0; this.face = Math.atan2(dx, dz); sq = 1 - Math.sin((1 - this.tm / df.warn) * Math.PI) * .25; this.tm -= d; if (this.tm <= 0) { this.state = 'attack'; this.tm = .35; this.lx = dx / (dist || 1); this.lz = dz / (dist || 1); } }
      else if (this.state === 'attack') { this.vx = this.lx * 9; this.vz = this.lz * 9; this.tm -= d; if (this.tm <= 0 || this.hitX || this.hitZ) { this.state = 'recover'; this.tm = .7; } }
      else if (this.state === 'recover') { this.vx *= .8; this.vz *= .8; this.tm -= d; sq = 1.1; if (this.tm <= 0) this.state = 'idle'; }
      this.vy -= 34 * d; if (this.vy < -30) this.vy = -30;
      if (this.stun > 0) { this.vx *= .9; this.vz *= .9; }
      W.stepBody(this, d, {}); this.ground = this.ground;
      // keep patrol on the platform: if we fell below a ledge ignore
      if (this.y < -6) { this.x = this.hx; this.y = this.hy; this.z = this.hz; this.vy = 0; }
    } else if (this.type === 'roller') {
      const ax = this.dir[0] ? 'x' : 'z', along = ax === 'x' ? dx : dz, lat = ax === 'x' ? dz : dx, spd = Math.hypot(this.vx, this.vz);
      if (this.stun > 0) { this.vx *= .9; this.vz *= .9; }
      else if (this.state === 'idle') {
        this.vx = this.dir[0] * this.sgn * df.speed; this.vz = this.dir[1] * this.sgn * df.speed; this.face = Math.atan2(this.vx, this.vz);
        if (this.hitX || this.hitZ) this.sgn *= -1;
        if (!R.solid(Math.floor(this.x + this.dir[0] * this.sgn * .9), Math.floor(this.y - .3), Math.floor(this.z + this.dir[1] * this.sgn * .9)) && this.ground) this.sgn *= -1;
        if (Math.abs(along) < df.sense && Math.abs(lat) < 1.7 && Math.abs(P.y - this.y) < 2 && !W.giant) { this.state = 'warn'; this.tm = df.warn; this.sgn = Math.sign(along) || 1; W.sfx('warn'); }
      } else if (this.state === 'warn') { this.vx = this.vz = 0; this.tm -= d; this.spr.material.rotation += d * 20; if (this.tm <= 0) { this.state = 'attack'; this.tm = 2.6; this.bounces = 0; } }
      else if (this.state === 'attack') {
        const sp = 11 * (this.bounces ? .75 : 1); this.vx = this.dir[0] * this.sgn * sp; this.vz = this.dir[1] * this.sgn * sp; this.tm -= d;
        if (this.hitX || this.hitZ) { this.sgn *= -1; this.bounces++; W.shake(.1); W.sfx('bonk', .5); }
        if (this.bounces >= 3 || this.tm <= 0) { this.state = 'recover'; this.tm = .9; }
      } else if (this.state === 'recover') { this.vx *= .85; this.vz *= .85; this.tm -= d; if (this.tm <= 0) this.state = 'idle'; }
      this.vy -= 34 * d; W.stepBody(this, d, { step:.9 });
      this.spr.material.rotation += (this.vx * this.dir[0] + this.vz * this.dir[1]) * d * .5; if (this.state === 'idle' || this.stun > 0) this.spr.material.rotation *= .9;
      if (this.y < -6) { this.x = this.hx; this.y = this.hy; this.z = this.hz; this.vy = 0; }
    } else if (this.type === 'floater') {
      this.x = this.hx + Math.sin(this.t0 * .7) * 2.5; this.z = this.hz + Math.cos(this.t0 * .55) * 2.5; this.y = this.hy + Math.sin(this.t0 * 1.3) * .7; this.face = Math.atan2(dx, dz);
      if (this.stun <= 0) {
        this.tm -= d;
        if (this.state === 'idle' && this.tm <= 0 && dist < df.sense) { this.state = 'warn'; this.tm = df.warn; W.sfx('warn'); }
        else if (this.state === 'warn') { sq = 1 + Math.sin((1 - this.tm / df.warn) * Math.PI) * .3; if (this.tm <= 0) { A.hostileShot(this.x, this.y + .5, this.z, P.x, P.y + P.h * .5, P.z, 5, .45); this.state = 'idle'; this.tm = df.every; W.sfx('bubble'); } }
      }
    } else if (this.type === 'chomper') {
      this.tm -= d; let off = -2.0;
      if (this.state === 'idle') { this.hidden = true; if (this.tm <= 0 && near && !W.giant) { this.state = 'warn'; this.tm = df.warn; W.sfx('warn'); } else if (this.tm <= 0) this.tm = .4; }
      else if (this.state === 'warn') { this.hidden = true; off = -2 + .5 + Math.sin(this.t0 * 60) * .1; if (this.tm <= 0) { this.state = 'up'; this.tm = .9; this.hidden = false; this.face = Math.atan2(dx, dz); W.sfx('roar', .4); } }
      else if (this.state === 'up') { this.hidden = false; off = this.tm > .55 ? -2 + (.9 - this.tm) / .35 * 2 : 0; if (this.tm <= 0) { this.state = 'down'; this.tm = .4; } }
      else if (this.state === 'down') { this.hidden = false; off = -(.4 - this.tm) / .4 * 2; if (this.tm <= 0) { this.state = 'idle'; this.tm = df.every; this.hidden = true; } }
      if (this.stun > 0 && this.hidden === false) { this.state = 'up'; }
      this.y = this.hy + off; this.mesh.rotation.y = this.face;
      this.mesh.position.set(this.x, this.y, this.z); this.body.scale.set(1, 1, 1);
      this.hurtbox = !this.hidden;
      return this.contact();
    }
    this.mesh.position.set(this.x, this.y, this.z); this.mesh.rotation.y = this.face; this.body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq)); if (this.type === 'mimic') this.body.scale.set(1, 1, 1);
    this.contact();
  }
  updateDisguised(d) {
    const P = W.player, R = W.world.room; this.mesh.position.set(this.x, this.y, this.z);
    const near = Math.abs(P.x - this.x) < 1.5 && Math.abs(P.z - this.z) < 1.5 && P.y < this.y + 2 && P.y > this.y - .6;
    if (this.state !== 'warn' && near && !W.giant) { this.state = 'warn'; this.tm = .55; W.sfx('warn'); }
    if (this.state === 'warn') { this.tm -= d; this.disg.position.x = Math.sin(this.tm * 90) * .06; if (this.tm <= 0) this.reveal(); }
  }
  reveal() {
    const P = W.player, R = W.world.room, i = R.dyn.indexOf(this.dynBox); if (i >= 0) R.dyn.splice(i, 1);
    this.disguised = false; this.hidden = false; this.disg.visible = false; this.spr.visible = true; this.shadow.visible = true; this.state = 'attack'; this.tm = .5;
    this.lx = Math.sign(P.x - this.x) * .7; this.lz = Math.sign(P.z - this.z) * .7; this.vy = 7; W.sfx('roar', .5); W.shake(.3); W.sparkle(this.x, this.y + 1, this.z, 0xffffff, 12);
    if (Math.abs(P.x - this.x) < 1.1 && Math.abs(P.z - this.z) < 1.1 && P.y > this.y + .4) { P.vy = 9; A.hurtPlayer(this.x, this.z, 1); }
    W.bit.say('mimic');
  }
  updateParade(d) {
    const pr = this.parade; pr.t += d; const k = Math.min(1, pr.t / 1.2), e = k * k * (3 - 2 * k);
    this.x = W.lerp(pr.sx, pr.tx, e); this.z = W.lerp(pr.sz, pr.tz, e); this.y = W.lerp(pr.sy, pr.ty, e) + (k >= 1 ? Math.sin(pr.t * 4 + pr.i) * .06 : Math.sin(pr.t * 9) * .3);
    this.mesh.position.set(this.x, this.y, this.z); this.body.position.y = 1.0; this.body.scale.set(1, this.type === 'chomper' ? .5 : 1, 1); this.mesh.rotation.y = 0; this.warnIcon.visible = false;
  }
  contact() {
    const P = W.player; if (this.hidden || this.parade || this.stun > 0 && this.type !== 'chomper') { if (this.stun <= 0 || this.hidden) return; }
    const hh = this.type === 'chomper' ? 2.2 : this.h, pw = this.hw + P.hw;
    if (Math.abs(P.x - this.x) < pw && Math.abs(P.z - this.z) < pw && P.y < this.y + hh && P.y + P.h > this.y) {
      if (W.giant) { this.hurt(3, P.x, P.z); return; }
      const top = this.y + hh, falling = P.vy * -W.grav < 0 || P.pound;
      if (falling && W.grav < 0 && P.y > top - .6 && !(this.type === 'chomper' && this.state === 'down') && !(this.type === 'roller' && this.state === 'attack')) { this.hurt(P.pound ? 3 : 1.5, P.x, P.z); P.vy = 11; P.jumps = 1; P.pound = false; P.squash = .3; W.sparkle(P.x, P.y, P.z, 0xffffff, 6); W.sfx('bonk'); }
      else if (this.stun <= 0 && this.bubble <= 0) A.hurtPlayer(this.x, this.z, this.df.dmg);
    }
  }
}
W.Enemy = Enemy;

A.populate = function (R) {
  A.enemies = []; A.shots.forEach(s => s.mesh.parent && s.mesh.parent.remove(s.mesh)); A.shots = []; A.boss = null;
  for (const e of R.def.enemies || []) A.enemies.push(new Enemy(e.t, e.x, e.y != null ? e.y : R.fy, e.z));
  if (R.id === 'b1' && W.S.bossK) { const q = W.Visuals.makeSprite('queen'); q.scale.set(3.2, 2.4, 1); q.position.set(15, 2.4, 23); W.world.group.add(q); W.world.signs.push({ x:15, z:20, text:'Queen Bubblefin: "Blub. Fine. You win. I will guard the pond."', shown:false }); }
  if (R.id === 'r1' && W.S.boss) { // Old Mossback joined the hub
    const g = new THREE.Group(); for (let i = 0; i < 4; i++) g.add(W.box(1.6 - i * .15, 1.4 - i * .1, 1.6 - i * .15, i ? 0x6fcf4a : 0x88e05a, 0, .7, i * 1.5));
    g.add(W.box(.3, .3, .1, 0x111111, -.4, 1.1, -.8), W.box(.3, .3, .1, 0x111111, .4, 1.1, -.8)); g.position.set(20, R.fy, 20); g.rotation.y = Math.PI; W.outline(g, 0x1c1740); W.world.group.add(g);
    W.world.signs.push({ x:20, z:19, text:'Old Mossback: "Rrrumble... sorry about the bonk-fest. I will guard the Landing now!"', shown:false });
  }
};
A.update = function (d) {
  for (const e of A.enemies) if (e.alive) e.update(d);
  A.enemies = A.enemies.filter(e => e.alive);
  for (let i = A.shots.length - 1; i >= 0; i--) { const s = A.shots[i]; if (!updateShot(s, d)) { s.mesh.parent && s.mesh.parent.remove(s.mesh); A.shots.splice(i, 1); } }
  if (A.boss) A.boss.update(d);
};
const shotGeo = W.boxGeo;
A.shoot = function (x, y, z, dir, wave) {
  const S = W.S, dmgBoost = 1 + S.cores * .25;
  const m = new THREE.Mesh(shotGeo, new THREE.MeshBasicMaterial({ color:wave ? 0x9bf6ff : 0xffffff })); m.scale.set(wave ? 2.6 : .35, wave ? 2.6 : .35, wave ? .5 : .35);
  m.position.set(x + dir[0] * .8, y + dir[1] * .8, z + dir[2] * .8); m.lookAt(m.position.clone().add(new THREE.Vector3(dir[0], dir[1], dir[2]))); W.world.group.add(m);
  A.shots.push({ mesh:m, x:m.position.x, y:m.position.y, z:m.position.z, vx:dir[0] * (wave ? 18 : 26), vy:dir[1] * (wave ? 18 : 26), vz:dir[2] * (wave ? 18 : 26), life:wave ? 1.1 : .5, dmg:(wave ? 3 : 1) * dmgBoost, r:wave ? 1.4 : .4, pierce:wave, hostile:false, hit:new Set() });
};
A.hostileShot = function (x, y, z, tx, ty, tz, speed, r) {
  const dx = tx - x, dy = ty - y, dz = tz - z, l = Math.hypot(dx, dy, dz) || 1;
  const m = new THREE.Mesh(shotGeo, new THREE.MeshLambertMaterial({ color:0xff9ad8, emissive:0xaa2266 })); m.scale.setScalar(r * 2); W.outline(m, HAZ, 1.25); m.position.set(x, y, z); W.world.group.add(m);
  A.shots.push({ mesh:m, x, y, z, vx:dx / l * speed, vy:dy / l * speed, vz:dz / l * speed, life:5, dmg:1, r, hostile:true, hit:new Set() });
};
function updateShot(s, d) {
  const R = W.world.room, P = W.player; s.life -= d; if (s.life <= 0) return false;
  s.x += s.vx * d; s.y += s.vy * d; s.z += s.vz * d; s.mesh.position.set(s.x, s.y, s.z); s.mesh.rotation.y += d * 5;
  const kd = R.kindAt(Math.floor(s.x), Math.floor(s.y), Math.floor(s.z));
  if (W.isSolidKind(kd)) { W.sparkle(s.x, s.y, s.z, s.hostile ? 0xff9ad8 : 0x9bf6ff, 4); return false; }
  if (s.hostile) { if (Math.abs(P.x - s.x) < P.hw + s.r && Math.abs(P.z - s.z) < P.hw + s.r && s.y > P.y - s.r && s.y < P.y + P.h + s.r) { A.hurtPlayer(s.x - s.vx, s.z - s.vz, 1); W.sparkle(s.x, s.y, s.z, 0xff9ad8, 6); return false; } return true; }
  for (const e of A.enemies) {
    if (!e.alive || s.hit.has(e)) continue;
    const hh = e.type === 'chomper' ? 2.2 : e.h;
    if (Math.abs(e.x - s.x) < e.hw + s.r && Math.abs(e.z - s.z) < e.hw + s.r && s.y > e.y - s.r && s.y < e.y + hh + s.r) {
      if (e.hidden) { W.sparkle(s.x, s.y, s.z, 0xffffff, 3); W.sfx('warn'); return false; }
      s.hit.add(e); e.hurt(s.dmg, P.x, P.z); if (!s.pierce) return false;
    }
  }
  if (A.boss && A.boss.hitTest(s.x, s.y, s.z, s.r)) { A.boss.hurt(s.dmg, 'shot'); if (!s.pierce) return false; }
  return true;
}
A.bonk = function () {
  const P = W.player, r = W.S.equipped.includes('bonk') ? 3.1 : 2.4, dmg = W.S.equipped.includes('bonk') ? 3 : 2;
  const cx = P.x, cy = P.y + P.h * .5, cz = P.z; W.sparkle(cx, cy, cz, 0xffe66d, 10);
  for (const e of A.enemies) {
    if (!e.alive || e.parade) continue;
    const dx = e.x - cx, dz = e.z - cz, dy = (e.y + e.h * .5) - cy;
    if (Math.hypot(dx, dz) < r + e.hw && Math.abs(dy) < 2.2) { if (e.hidden) continue; if (e.hurt(dmg, cx, cz)) W.shake(.2); }
  }
  for (const s of A.shots) if (s.hostile && Math.hypot(s.x - cx, s.z - cz) < r + 1) { s.hostile = false; s.vx *= -1.6; s.vy = 0; s.vz *= -1.6; s.dmg = 2; s.life = 1.2; s.hit = new Set(); s.mesh.children.forEach(c => c.visible = false); }
  if (A.boss && A.boss.hitTest(cx, cy, cz, r)) A.boss.hurt(dmg, 'bonk');
};
A.dashHit = function () {
  const P = W.player;
  for (const e of A.enemies) if (e.alive && !e.hidden && !e.parade && Math.hypot(e.x - P.x, e.z - P.z) < e.hw + 1.1 && Math.abs(e.y - P.y) < 2) { if (e.dashHitT == null || W.player.t - e.dashHitT > .4) { e.dashHitT = W.player.t; e.hurt(2, P.x, P.z); } }
  if (A.boss && A.boss.hitTest(P.x, P.y + .8, P.z, 1.2) && (A.boss.dashT == null || P.t - A.boss.dashT > .4)) { A.boss.dashT = P.t; A.boss.hurt(2, 'dash'); }
};
A.poundLand = function () {
  const P = W.player, R = W.world.room; W.shake(.5); W.sfx('pound'); W.sparkle(P.x, P.y + .1, P.z, 0xffffff, 16);
  const broke = R.breakNear(P.x, P.y - 1, P.z, 1.7, [3], 1.5); if (broke) W.sfx('crack');
  for (const e of A.enemies) if (e.alive && !e.parade && Math.hypot(e.x - P.x, e.z - P.z) < 4.2 && Math.abs(e.y - P.y) < 2) { if (e.hidden) { e.state = 'idle'; e.tm = 1.5; continue; } e.stun = 2.5; e.hurt(1, P.x, P.z); }
  if (A.boss && Math.hypot(A.boss.hx - P.x, A.boss.hz - P.z) < 3.4) A.boss.hurt(2, 'pound');
};
A.hurtPlayer = function (sx, sz, dmg) {
  const P = W.player, S = W.S, As = W.settings.assist;
  if (P.inv > 0 || W.state !== 'play' || P.st === 'dead') return;
  if (P.slide) W.Slide.leave(false, false);
  if (!As.infinite) S.hearts -= Math.max(As.dmg === 0 ? 0 : 1, Math.round(dmg * As.dmg));
  const dx = P.x - sx, dz = P.z - sz, l = Math.hypot(dx, dz) || 1; P.vx = dx / l * 7; P.vz = dz / l * 7; P.vy = -W.grav * 8; P.hurtT = .35; P.inv = 1.5 + (S.equipped.includes('shell') ? .8 : 0);
  P.dashT = 0; P.pound = false; W.sfx('hurt'); W.shake(.4); W.flash('#ff4040'); W.hudPing(); W.bit.say(Math.random() < .5 ? 'hurt' : 'hurt2');
  if (S.hearts <= 0) A.die();
};
A.die = function () {
  const P = W.player, S = W.S; P.st = 'dead'; W.sfx('die'); W.sparkle(P.x, P.y + 1, P.z, 0xffffff, 18);
  W.startTransition(() => {
    S.hearts = W.maxHearts(S); P.st = 'idle'; W.grav = -1; W.giant = false; W.hudPing();
    const br = S.beaconRoom || 'r1', def = W.ROOM_BY_ID[br], it = (def.items || []).find(i => i.id === S.beacon);
    W.loadRoom(br, null, it ? { x:it.x + 1.8, y:it.y, z:it.z } : null);
    W.ui.toast('Back at the last Beacon. Nothing was lost!'); W.bit.say('die', true);
  }, .5);
};
A.fall = function () {
  const P = W.player, S = W.S;
  if (P.st === 'dead' || W.transition) return;
  if (S.hearts > 1 && !W.settings.assist.infinite) S.hearts--; W.sfx('hurt'); W.hudPing(); W.bit.say('fall');
  W.startTransition(() => { const s = P.safe || P.roomEntry; P.place(s.x, s.y, s.z); P.inv = 1.5; W.snapCamera(); }, .2);
};

/* ---------- boss: Old Mossback ---------- */
const B = W.boss = {
  setup(R) {
    A.boss = null; if (W.S.boss) { R.lockDoors(false); return; }
    const b = A.boss = new Mossback(R); b.start = false;
  },
};
class Mossback {
  constructor(R) {
    this.R = R; this.hx = 17; this.hz = 10; this.hy = R.fy; this.vx = this.vz = 0; this.hp = 12; this.max = 12; this.state = 'wait'; this.tm = 0; this.phase = 1; this.dazeT = 0; this.alive = true; this.segs = []; this.flash = 0;
    this.g = new THREE.Group(); this.head = new THREE.Group();
    this.head.add(W.box(2.4, 2, 2.4, 0x88e05a, 0, 1, 0), W.box(.5, .5, .15, 0xffffff, -.6, 1.4, 1.2), W.box(.5, .5, .15, 0xffffff, .6, 1.4, 1.2), W.box(.2, .3, .1, 0x111111, -.6, 1.4, 1.28), W.box(.2, .3, .1, 0x111111, .6, 1.4, 1.28), W.box(1.4, .3, .1, 0x3a0a0a, 0, .55, 1.22), W.box(.3, .8, .3, 0xff9f1c, -.6, 2.3, 0), W.box(.3, .8, .3, 0xff9f1c, .6, 2.3, 0));
    this.g.add(this.head);
    for (let i = 0; i < 6; i++) { const s = new THREE.Group(), sz = 2.2 - i * .18; s.add(W.box(sz, sz * .85, sz, i % 2 ? 0x6fcf4a : 0x88e05a, 0, sz * .42, 0), W.box(sz * .5, .5, sz * .5, i % 2 ? 0xff9f1c : 0xffd23f, 0, sz * .9, 0)); this.segs.push({ g:s, x:this.hx, z:this.hz - (i + 1) * 1.9, sz }); this.g.add(s); }
    this.mats = []; this.g.traverse(o => { if (o.isMesh) this.mats.push(o.material); });
    W.outline(this.g, 0x1c1740, 1.07); W.world.group.add(this.g); this.pillars = [];
  }
  hitTest(x, y, z, r) {
    if (this.state === 'wait' || this.state === 'defeated') return false;
    if (Math.hypot(x - this.hx, z - this.hz) < 1.5 + r && y > this.hy - r && y < this.hy + 2.6 + r) return true;
    return this.segs.some(s => Math.hypot(x - s.x, z - s.z) < s.sz * .55 + r && y > this.hy - r && y < this.hy + s.sz + r);
  }
  hurt(n, src) {
    if (this.state !== 'dazed') { W.sfx('warn'); W.sparkle(this.hx, this.hy + 1.5, this.hz, 0xffffff, 3); return; }
    this.hp -= n; this.flash = .2; W.sfx('hit'); W.shake(.2); W.sparkle(this.hx, this.hy + 2, this.hz, 0xffe66d, 8);
    const th = this.phase === 1 ? 8 : this.phase === 2 ? 4 : 0;
    if (this.hp <= 0) return this.defeat();
    if (this.hp <= th) { this.phase++; this.state = 'phasechange'; this.tm = 2; W.sfx('roar'); W.ui.bit(this.phase === 2 ? 'Bit: The mushrooms are growing! Use the pillars!' : 'Bit: He is furious! Keep bonking him into walls!'); this.arena(); }
  }
  arena() {
    const R = this.R;
    if (this.phase === 2) { this.pillars = [[8, 8], [24, 8], [8, 24], [24, 24]]; this.rise = 0; }
    if (this.phase === 3) { for (let i = 0; i < 2; i++) A.enemies.push(new Enemy('waddler', 6 + i * 22, R.fy, 28)); }
  }
  update(d) {
    const R = this.R, P = W.player, S = W.S;
    this.flash -= d; for (const m of this.mats) m.emissive && m.emissive.setScalar(this.flash > 0 ? .7 : this.state === 'telegraph' ? .25 + .25 * Math.sin(W.player.t * 30) : 0);
    if (this.rise !== undefined && this.rise < 6) { this.rise += d * 4; const h = Math.floor(this.rise); for (const [x, z] of this.pillars) for (let y = R.fy; y < R.fy + h; y++) if (!R.solid(x, y, z)) R.fill(x - 1, y, z - 1, 3, 1, 3, 0x9a8fd0, 1); }
    if (this.state === 'wait') {
      if (Math.hypot(P.x - P.roomEntry.x, P.z - P.roomEntry.z) > 5.5 && W.state === 'play') { this.state = 'intro'; this.tm = 2.2; R.lockDoors(true); W.sfx('roar'); W.shake(.6); W.ui.bossBar(true, 'Old Mossback'); W.bit.say('boss1', true); W.music.setStyle('boss'); }
    } else if (this.state === 'intro') { this.tm -= d; this.face = Math.atan2(P.x - this.hx, P.z - this.hz); if (this.tm <= 0) { this.state = 'idle'; this.tm = 1.2; } }
    else if (this.state === 'idle') {
      this.face = Math.atan2(P.x - this.hx, P.z - this.hz); this.tm -= d;
      if (this.phase >= 2 && Math.abs(this.tm - .6) < d) for (let i = -1; i <= 1; i++) { const a = this.face + i * .35; A.hostileShot(this.hx, this.hy + 1.6, this.hz, this.hx + Math.sin(a) * 9, this.hy + 1.6, this.hz + Math.cos(a) * 9, 6, .4); }
      if (this.tm <= 0) { this.state = 'telegraph'; this.tm = this.phase === 3 ? .75 : .95; W.sfx('warn'); this.lock = [Math.sin(this.face), Math.cos(this.face)]; }
    } else if (this.state === 'telegraph') {
      this.tm -= d; this.face = Math.atan2(P.x - this.hx, P.z - this.hz); this.lock = [Math.sin(this.face), Math.cos(this.face)]; this.o = [-this.lock[0] * .5 * (1 - this.tm), 0, -this.lock[1] * .5 * (1 - this.tm)];
      if (this.tm <= 0) { this.state = 'charge'; this.tm = 2.4; this.o = [0, 0, 0]; W.sfx('roar', .6); }
    } else if (this.state === 'charge') {
      const sp = this.phase === 3 ? 17 : 14; this.tm -= d; this.vx = this.lock[0] * sp; this.vz = this.lock[1] * sp;
      const nx = this.hx + this.vx * d, nz = this.hz + this.vz * d;
      if (R.hitBox(nx, this.hy, nz, 1.3, 2.2) || this.tm <= 0) { if (this.tm > 0) { this.state = 'dazed'; this.dazeT = 3.6; W.shake(.9); W.sfx('pound'); W.sparkle(this.hx + this.lock[0] * 1.5, this.hy + 1, this.hz + this.lock[1] * 1.5, 0xffe66d, 18); W.ui.bit('Bit: He is dazed! Hit him!'); } else { this.state = 'idle'; this.tm = .6; } }
      else { this.hx = nx; this.hz = nz; }
    } else if (this.state === 'dazed') { this.dazeT -= d; this.o = [0, -.2, 0]; this.head.rotation.z = Math.sin(W.player.t * 8) * .12; if (this.dazeT <= 0) { this.state = 'idle'; this.tm = this.phase === 3 ? .6 : 1; this.head.rotation.z = 0; this.o = [0, 0, 0]; } }
    else if (this.state === 'phasechange') { this.tm -= d; this.o = [0, Math.sin(W.player.t * 40) * .1, 0]; if (this.tm <= 0) { this.o = [0, 0, 0]; this.state = 'idle'; this.tm = 1; } }
    else if (this.state === 'defeated') { this.tm -= d; if (this.tm > 0 && Math.random() < .2) W.sparkle(this.hx + (Math.random() - .5) * 3, this.hy + 1 + Math.random() * 2, this.hz + (Math.random() - .5) * 3, 0xffe66d, 3); }
    // segments follow the head
    let px = this.hx, pz = this.hz;
    for (const s of this.segs) { const dx = s.x - px, dz = s.z - pz, l = Math.hypot(dx, dz) || 1, sp = this.state === 'dazed' ? 1.35 : 1.9; s.x = px + dx / l * sp; s.z = pz + dz / l * sp; px = s.x; pz = s.z; }
    const o = this.o || [0, 0, 0]; this.head.position.set(this.hx + o[0], this.hy + o[1], this.hz + o[2]); this.head.rotation.y = this.face || 0;
    this.segs.forEach((s, i) => { s.g.position.set(s.x, this.hy + (this.state === 'dazed' ? -.3 : Math.abs(Math.sin(W.player.t * 6 + i)) * .1), s.z); s.g.scale.y = this.state === 'dazed' ? .7 : 1; });
    // contact damage
    if (this.state !== 'dazed' && this.state !== 'defeated' && this.state !== 'wait') {
      if (Math.hypot(P.x - this.hx, P.z - this.hz) < 1.45 + P.hw && P.y < this.hy + 2.4 || this.segs.some(s => Math.hypot(P.x - s.x, P.z - s.z) < s.sz * .5 + P.hw && P.y < this.hy + s.sz)) A.hurtPlayer(this.hx, this.hz, 1);
    }
    // stomp on the dazed head
    if (this.state === 'dazed' && Math.hypot(P.x - this.hx, P.z - this.hz) < 1.6 && P.vy < 0 && P.y > this.hy + 1.6 && P.y < this.hy + 2.8) { this.hurt(P.pound ? 3 : 2, 'stomp'); P.vy = 12; P.pound = false; }
    W.ui.bossHp(this.hp / this.max);
  }
  defeat() {
    this.state = 'defeated'; this.tm = 4; this.alive = false; const S = W.S;
    S.boss = true; S.frags++; S.cores++; S.items.core_boss = true; W.sfx('fanfare'); W.sfx('roar', .5); W.shake(.7); W.ui.bossBar(false);
    this.R.lockDoors(false); this.R.buildMesh(); W.music.setStyle('cave');
    W.ui.banner('Old Mossback is dazed!', 'He will join the Landing as your helper. You earned a Seed Fragment and a Power Core.', '#88e05a');
    for (let i = 0; i < 2; i++) { const id = 'p_boss' + i; if (!S.items[id]) W.world.items.push(new W.Item({ t:'pearl', id, x:15 + i * 4, y:this.R.fy + 1.2, z:20 })); }
    W.writeSave(S);
    setTimeout(() => { if (W.state === 'play') W.ui.endCard(); }, 4500);
  }
}

/* ---------- mini-boss: Shellbert (rolls around, bounces, pops out dizzy) ---------- */
B.setupMini = function (R) { A.boss = null; if (W.S.mini) { R.lockDoors(false); return; } A.boss = new Shellbert(R); };
class Shellbert {
  constructor(R) {
    this.R = R; this.hx = 17; this.hz = 8; this.hy = R.fy; this.hp = 10; this.max = 10; this.phase = 1; this.state = 'wait'; this.tm = 0; this.alive = true; this.vx = this.vz = 0; this.bounces = 0; this.flash = 0; this.name = 'Shellbert';
    this.spr = W.Visuals.makeSprite('roller'); this.spr.scale.set(4.2, 4.2, 1); this.spr.center.set(.5, 0); this.mesh = new THREE.Group(); this.mesh.add(this.spr); W.world.group.add(this.mesh);
    this.shadow = W.Visuals.blobShadow(4); this.shadow.position.y = .05; this.mesh.add(this.shadow);
    [[8, 8], [26, 8], [8, 26], [26, 26], [17, 17]].forEach(([x, z]) => R.fill(x - 1, 1, z - 1, 3, 5, 3, R.pal.stone, 1)); R.buildMesh();
  }
  hitTest(x, y, z, r) { return this.state !== 'wait' && this.state !== 'defeated' && Math.hypot(x - this.hx, z - this.hz) < 2 + r && y > this.hy - r && y < this.hy + 4 + r; }
  hurt(n) {
    if (this.state !== 'dizzy') { W.sfx('warn'); W.sparkle(this.hx, this.hy + 2, this.hz, 0xffffff, 3); return; }
    this.hp -= n; this.flash = .2; W.sfx('hit'); W.shake(.25); W.sparkle(this.hx, this.hy + 2.5, this.hz, 0xffe66d, 8);
    if (this.hp <= 0) return this.defeat();
    const th = this.phase === 1 ? 7 : this.phase === 2 ? 3 : -1;
    if (this.hp <= th) { this.phase++; this.state = 'phase'; this.tm = 1.6; W.sfx('roar'); W.bit.say(this.phase === 2 ? 'mini2' : 'mini3', true); for (let i = 0; i < 2; i++) A.enemies.push(new Enemy('roller', 6 + i * 22, this.R.fy, 28)); }
  }
  update(d) {
    const R = this.R, P = W.player, ph = this.phase; this.flash -= d; this.spr.material.color.setScalar(this.flash > 0 ? 2 : 1);
    W.Visuals.setExpr(this.spr, this.state === 'dizzy' ? 'stun' : this.state === 'roll' ? 'attack' : this.state === 'curl' ? 'warn' : this.flash > 0 ? 'hurt' : 'idle');
    if (this.state === 'wait') { if (Math.hypot(P.x - P.roomEntry.x, P.z - P.roomEntry.z) > 5.5 && W.state === 'play') { this.state = 'intro'; this.tm = 2; R.lockDoors(true); W.sfx('roar'); W.shake(.5); W.ui.bossBar(true, "Shellbert"); W.bit.say('mini1', true); W.music.setStyle('boss'); } }
    else if (this.state === 'intro') { this.tm -= d; if (this.tm <= 0) { this.state = 'idle'; this.tm = 1; } }
    else if (this.state === 'idle') { this.tm -= d; if (this.tm <= 0) { this.state = 'curl'; this.tm = ph === 3 ? .6 : .85; W.sfx('warn'); } }
    else if (this.state === 'curl') { this.tm -= d; this.spr.material.rotation += d * 25; const dx = P.x - this.hx, dz = P.z - this.hz, l = Math.hypot(dx, dz) || 1; this.dirx = dx / l; this.dirz = dz / l; if (this.tm <= 0) { this.state = 'roll'; this.tm = 4; this.bounces = 0; W.sfx('roar', .5); } }
    else if (this.state === 'roll') {
      const sp = [0, 12, 15, 18][ph]; this.tm -= d; this.spr.material.rotation += d * 18;
      const nx = this.hx + this.dirx * sp * d, nz = this.hz + this.dirz * sp * d;
      if (R.hitBox(nx, this.hy, nz, 1.7, 3)) {
        const ex = R.hitBox(nx, this.hy, this.hz, 1.7, 3), ez = R.hitBox(this.hx, this.hy, nz, 1.7, 3), pillar = this.pillarHit(nx, nz);
        if (ex) this.dirx *= -1; if (ez) this.dirz *= -1; if (!ex && !ez) { this.dirx *= -1; this.dirz *= -1; }
        this.bounces++; W.shake(.35); W.sfx('pound'); W.sparkle(this.hx, this.hy + 1.5, this.hz, 0xffe66d, 10);
        if (pillar || this.bounces >= (ph === 3 ? 4 : 3)) { this.state = 'dizzy'; this.tm = 3.4 - ph * .3; W.bit.say('mini_hit'); }
      } else { this.hx = nx; this.hz = nz; }
      if (this.tm <= 0 && this.state === 'roll') { this.state = 'idle'; this.tm = .5; }
    }
    else if (this.state === 'dizzy') { this.tm -= d; this.spr.material.rotation = Math.sin(W.player.t * 9) * .2; if (this.tm <= 0) { this.state = 'idle'; this.tm = .8; this.spr.material.rotation = 0; } }
    else if (this.state === 'phase') { this.tm -= d; this.spr.material.rotation += d * 20; if (this.tm <= 0) { this.state = 'idle'; this.tm = .6; } }
    else if (this.state === 'defeated') { this.tm -= d; if (this.tm > 0 && Math.random() < .25) W.sparkle(this.hx + (Math.random() - .5) * 3, this.hy + 1 + Math.random() * 3, this.hz + (Math.random() - .5) * 3, 0xffe66d, 3); }
    this.mesh.position.set(this.hx, this.hy, this.hz);
    if (this.state !== 'dizzy' && this.state !== 'defeated' && this.state !== 'wait' && Math.hypot(P.x - this.hx, P.z - this.hz) < 2 + P.hw && P.y < this.hy + 3.6) A.hurtPlayer(this.hx, this.hz, 1);
    if (this.state === 'dizzy' && Math.hypot(P.x - this.hx, P.z - this.hz) < 2.1 && P.vy < 0 && P.y > this.hy + 2.6 && P.y < this.hy + 4.4) { this.hurt(P.pound ? 3 : 2); P.vy = 12; P.pound = false; }
    W.ui.bossHp(this.hp / this.max);
  }
  pillarHit(nx, nz) { const R = this.R; for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) { const i = Math.floor(nx + dx), k = Math.floor(nz + dz); if (R.kindAt(i, R.fy, k) === 1 && i > 1 && k > 1 && i < R.w - 2 && k < R.d - 2) return true; } return false; }
  defeat() {
    this.state = 'defeated'; this.tm = 3; this.alive = false; const S = W.S; S.mini = true; S.frags++; W.sfx('fanfare'); W.shake(.6); W.ui.bossBar(false); this.R.lockDoors(false); this.R.buildMesh(); W.music.setStyle('cave');
    W.ui.banner('Shellbert is dizzy for good!', 'The south door to the Queen\'s Lagoon is open. +1 Seed Fragment.', '#ffd23f');
    for (let i = 0; i < 2; i++) { const id = 'p_mini' + i; if (!S.items[id]) W.world.items.push(new W.Item({ t:'pearl', id, x:14 + i * 5, y:this.R.fy + 1.2, z:22 })); }
    for (const e of A.enemies) if (e.alive) e.die(); W.writeSave(S);
  }
}

/* ---------- boss: Queen Bubblefin (water rises each phase) ---------- */
B.setupQueen = function (R) { A.boss = null; if (W.S.bossK) { R.lockDoors(false); const v = W.Water.vols[0]; v && W.Water.setLevel(v, 3.3); return; } A.boss = new Queen(R); };
class Queen {
  constructor(R) {
    this.R = R; this.hp = 16; this.max = 16; this.phase = 1; this.state = 'wait'; this.tm = 0; this.alive = true; this.hx = 20; this.hz = 28; this.hy = 2; this.flash = 0; this.name = 'Queen Bubblefin'; this.ang = 0; this.fireT = 2;
    this.spr = W.Visuals.makeSprite('queen'); this.spr.center.set(.5, .15); this.mesh = new THREE.Group(); this.mesh.add(this.spr); W.world.group.add(this.mesh);
    this.mark = new THREE.Mesh(new THREE.RingGeometry(3.2, 3.8, 28), new THREE.MeshBasicMaterial({ color:0xff4d1a, transparent:true, opacity:.8, side:THREE.DoubleSide, depthTest:false })); this.mark.rotation.x = -Math.PI / 2; this.mark.visible = false; this.mark.renderOrder = 5; W.world.group.add(this.mark);
    this.wave = new THREE.Mesh(new THREE.RingGeometry(.9, 1.2, 36), new THREE.MeshBasicMaterial({ color:0xbff4ff, transparent:true, opacity:.8, side:THREE.DoubleSide })); this.wave.rotation.x = -Math.PI / 2; this.wave.visible = false; W.world.group.add(this.wave);
    this.vol = W.Water.vols[0]; this.levels = [3.3, 5.6, 8.2];
  }
  level() { return this.vol ? this.vol.level : 3.3; }
  hitTest(x, y, z, r) { return this.state !== 'wait' && this.state !== 'defeated' && Math.hypot(x - this.hx, z - this.hz) < 3.4 + r && y > this.hy - r && y < this.hy + 4.5 + r; }
  hurt(n) {
    if (this.state !== 'gasp') { W.sfx('warn'); W.sparkle(this.hx, this.hy + 2, this.hz, 0xffffff, 3); return; }
    this.hp -= n; this.flash = .2; W.sfx('hit'); W.shake(.25); W.sparkle(this.hx, this.hy + 2.5, this.hz, 0xffe66d, 8);
    if (this.hp <= 0) return this.defeat();
    const th = this.phase === 1 ? 11 : this.phase === 2 ? 6 : -1;
    if (this.hp <= th) { this.phase++; this.state = 'phase'; this.tm = 3; W.sfx('roar'); this.vol.target = this.levels[this.phase - 1]; W.bit.say(this.phase === 2 ? 'queen2' : 'queen3', true);
      if (this.phase === 2) { W.Water.addVent({ x:8, z:8, r:1.8, y0:1, y1:20 }); W.Water.addVent({ x:32, z:32, r:1.8, y0:1, y1:20 }); } else { W.Water.addVent({ x:32, z:8, r:1.8, y0:1, y1:22 }); W.Water.addVent({ x:8, z:32, r:1.8, y0:1, y1:22 }); }
      const R = this.R; [[19, 8], [8, 19], [31, 19], [19, 31]].forEach(([x, z]) => R.fill(x - 1, 5, z - 1, 3, this.phase === 2 ? 3 : 6, 3, R.pal.stone2, 1)); R.buildMesh(); }
  }
  update(d) {
    const R = this.R, P = W.player, lv = this.level(), ph = this.phase; this.flash -= d; this.spr.material.color.setScalar(this.flash > 0 ? 2 : 1);
    W.Visuals.setExpr(this.spr, this.state === 'gasp' ? 'stun' : (this.state === 'leap' || this.state === 'telegraph') ? 'attack' : this.flash > 0 ? 'hurt' : 'idle');
    if (this.state === 'wait') { if (Math.hypot(P.x - P.roomEntry.x, P.z - P.roomEntry.z) > 5.5 && W.state === 'play') { this.state = 'intro'; this.tm = 2.5; R.lockDoors(true); W.sfx('roar'); W.shake(.6); W.ui.bossBar(true, 'Queen Bubblefin'); W.bit.say('queen1', true); W.music.setStyle('boss'); } }
    else if (this.state === 'intro') { this.tm -= d; this.hy = lv - 2 + (1 - this.tm / 2.5) * 2; this.hx = 20; this.hz = 28; if (this.tm <= 0) { this.state = 'swim'; this.tm = 3.2; } }
    else if (this.state === 'swim') {
      this.tm -= d; this.ang += d * (.8 + ph * .25); const cx = 20, cz = 20, rad = 12;
      const tx = cx + Math.cos(this.ang) * rad, tz = cz + Math.sin(this.ang) * rad; this.hx += (tx - this.hx) * Math.min(1, 3 * d); this.hz += (tz - this.hz) * Math.min(1, 3 * d); this.hy = lv - 2.2 + Math.sin(W.player.t * 3) * .3;
      this.fireT -= d; if (ph >= 2 && this.fireT <= 0) { this.fireT = 1.8; this.hy = lv - 1; W.sfx('bubble'); const a0 = Math.atan2(P.x - this.hx, P.z - this.hz); for (let i = -1; i <= 1; i++) { const a = a0 + i * .3; A.hostileShot(this.hx, lv + .8, this.hz, this.hx + Math.sin(a) * 12, lv + .8, this.hz + Math.cos(a) * 12, 6, .45); } }
      if (this.tm <= 0) { this.state = 'telegraph'; this.tm = ph === 3 ? .8 : 1.1; this.tx = P.x; this.tz = P.z; this.mark.visible = true; W.sfx('warn'); this.sx = this.hx; this.sz = this.hz; }
    }
    else if (this.state === 'telegraph') {
      this.tm -= d; this.tx += (P.x - this.tx) * Math.min(1, 2 * d); this.tz += (P.z - this.tz) * Math.min(1, 2 * d); this.mark.position.set(this.tx, Math.max(lv, R.fy) + .1, this.tz); this.mark.scale.setScalar(1 + Math.sin(W.player.t * 20) * .06);
      this.hy = lv - 1 + (1 - this.tm / 1.1) * .8 + Math.sin(W.player.t * 50) * .08; this.hx += (this.sx - this.hx) * .1;
      if (this.tm <= 0) { this.state = 'leap'; this.tm = .95; this.mark.position.set(this.tx, Math.max(lv, R.fy) + .1, this.tz); this.lx0 = this.hx; this.lz0 = this.hz; this.ly0 = this.hy; W.sfx('roar', .6); }
    }
    else if (this.state === 'leap') {
      this.tm -= d; const k = 1 - Math.max(0, this.tm) / .95, ground = Math.max(lv, this.groundAt(this.tx, this.tz)); this.hx = W.lerp(this.lx0, this.tx, k); this.hz = W.lerp(this.lz0, this.tz, k); this.hy = W.lerp(this.ly0, ground, k) + Math.sin(k * Math.PI) * 6.5;
      if (this.tm <= 0) { this.state = 'gasp'; this.tm = [0, 3.8, 3, 2.4][ph]; this.hy = ground; this.mark.visible = false; this.slam(ground); }
    }
    else if (this.state === 'gasp') { this.tm -= d; this.spr.material.rotation = Math.sin(W.player.t * 10) * .1; if (this.tm <= 0) { this.state = 'swim'; this.tm = 3.2 - ph * .3; this.spr.material.rotation = 0; this.hy = lv - 2; W.sfx('splash'); } }
    else if (this.state === 'phase') { this.tm -= d; this.hy = this.level() - 2; this.spr.material.rotation = Math.sin(W.player.t * 30) * .08; if (this.tm <= 0) { this.state = 'swim'; this.tm = 2; this.spr.material.rotation = 0; } }
    else if (this.state === 'defeated') { this.tm -= d; if (this.tm > 0 && Math.random() < .3) W.sparkle(this.hx + (Math.random() - .5) * 5, this.hy + 1 + Math.random() * 4, this.hz + (Math.random() - .5) * 5, 0xbff4ff, 3); }
    // shockwave ring
    if (this.waveT > 0) { this.waveT -= d; const k = 1 - this.waveT / .6, r = k * 11; this.wave.visible = true; this.wave.scale.setScalar(r + .1); this.wave.material.opacity = .8 * (1 - k); this.wave.position.set(this.hx, this.waveY + .1, this.hz);
      const dist = Math.hypot(P.x - this.hx, P.z - this.hz); if (Math.abs(dist - r) < 1.2 && P.y < this.waveY + 1.2 && !this.waveHit) { this.waveHit = true; A.hurtPlayer(this.hx, this.hz, 1); } if (this.waveT <= 0) this.wave.visible = false; }
    this.mesh.position.set(this.hx, this.hy, this.hz);
    // contact: leaping / gasping fish hurts when you touch her side while she is not stunned
    if (this.state === 'leap' && Math.hypot(P.x - this.hx, P.z - this.hz) < 3 && Math.abs(P.y - this.hy) < 3.5) A.hurtPlayer(this.hx, this.hz, 1);
    if (this.state === 'gasp' && Math.hypot(P.x - this.hx, P.z - this.hz) < 3.2 && P.vy < 0 && P.y > this.hy + 3 && P.y < this.hy + 5.2) { this.hurt(P.pound ? 3 : 2); P.vy = 12; P.pound = false; }
    W.ui.bossHp(this.hp / this.max);
  }
  groundAt(x, z) { const R = this.R; for (let y = R.h - 2; y >= 0; y--) if (R.solid(Math.floor(x), y, Math.floor(z))) return y + 1; return 0; }
  slam(y) { this.waveT = .6; this.waveY = y; this.waveHit = false; W.shake(.7); W.sfx('pound'); W.sfx('splash'); for (let i = 0; i < 20; i++) W.sparkle(this.hx, y + .5, this.hz, 0xbff4ff, 1); }
  defeat() {
    this.state = 'defeated'; this.tm = 4; this.alive = false; const S = W.S; S.bossK = true; S.frags++; S.cores++; S.items.core_q = true; W.sfx('fanfare'); W.sfx('roar', .5); W.shake(.7); W.ui.bossBar(false);
    this.R.lockDoors(false); this.R.buildMesh(); W.music.setStyle('cave'); this.mark.visible = false;
    W.ui.banner('Queen Bubblefin is beaten!', 'She will watch the Landing pond. +1 Seed Fragment and a Power Core.', '#7df9ff');
    for (let i = 0; i < 3; i++) { const id = 'p_q' + i; if (!S.items[id]) W.world.items.push(new W.Item({ t:'pearl', id, x:17 + i * 3, y:this.R.fy + 1.4, z:10 })); }
    W.writeSave(S); setTimeout(() => { if (W.state === 'play') W.ui.endCard(2); }, 4500);
  }
}
})(window.W);
