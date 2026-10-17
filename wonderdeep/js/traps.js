'use strict';
(function (W) {
const THREE = window.THREE, HAZ = 0xff4d1a;
const T = W.Traps = { list:[], crumble:{}, respawn:[], t:0 };
const DIRS = { E:[1, 0], W:[-1, 0], N:[0, -1], S:[0, 1] };

T.populate = function (R) {
  T.list = []; T.crumble = {}; T.respawn = []; T.t = 0;
  for (const d of R.def.traps || []) {
    if (d.t === 'spikes') {
      const g = new THREE.Group(), spikes = [];
      const y0 = d.y != null ? d.y : R.fy; g.add(W.box(d.w, .12, d.d, 0x3a3566, d.x + d.w / 2, y0 + .06, d.z + d.d / 2));
      for (let i = 0; i < d.w * 2; i++) for (let j = 0; j < d.d * 2; j++) {
        const m = W.box(.2, 1, .2, 0xe8e8f0, d.x + .25 + i * .5, y0, d.z + .25 + j * .5); m.geometry = W.boxGeo; m.castShadow = false;
        const tip = W.box(.22, .3, .22, HAZ, 0, .35, 0); m.add(tip); m.position.y = y0 + .1; m.scale.y = .2; spikes.push(m); g.add(m);
      }
      W.world.group.add(g); T.list.push({ t:'spikes', d, g, spikes, y0, off:T.list.length * .9, state:'in' });
    } else if (d.t === 'dart') {
      const g = new THREE.Group(), dir = DIRS[d.dir]; g.add(W.box(.9, .9, .9, 0x2b2650), W.box(.55, .55, .3, 0x111111, dir[0] * .42, 0, dir[1] * .42)); const ring = W.box(.7, .7, .7, HAZ, 0, 0, 0); ring.scale.set(1.02, .12, 1.02); g.add(ring);
      g.position.set(d.x, d.y, d.z); W.world.group.add(g); T.list.push({ t:'dart', d, g, ring, timer:(d.every || 3) * (.4 + Math.random() * .6), warn:0 });
    }
  }
};

function over(P, d) { return P.x + P.hw > d.x && P.x - P.hw < d.x + d.w && P.z + P.hw > d.z && P.z - P.hw < d.z + d.d; }

T.update = function (dt) {
  const R = W.world.room, P = W.player; if (!R) return; T.t += dt;
  for (const tr of T.list) {
    if (tr.t === 'spikes') {
      const c = (T.t + tr.off) % 3.2; let h, state;
      if (c < 1.4) { h = .18; state = 'in'; } else if (c < 2.1) { h = .18 + .22 * Math.abs(Math.sin(c * 30)); state = 'warn'; } else { h = Math.min(1, .2 + (c - 2.1) * 12) * .95; state = 'out'; }
      if (state === 'warn' && tr.state !== 'warn') W.sfx('warn', .5);
      if (state === 'out' && tr.state !== 'out') W.sfx('crack', .3);
      tr.state = state; for (const s of tr.spikes) { s.scale.y = h; s.position.y = tr.y0 + h / 2; }
      if (state === 'out' && over(P, tr.d) && P.y < tr.y0 + .7 && P.y > tr.y0 - 1.2 && P.st !== 'dead') { W.Actors.hurtPlayer(tr.d.x + tr.d.w / 2, tr.d.z + tr.d.d / 2, 1); if (P.hurtT > 0) P.vy = 9; W.bit.say('spikes'); }
    } else {
      tr.timer -= dt; const dir = DIRS[tr.d.dir];
      if (tr.timer < .5 && tr.timer > 0) { tr.ring.material.emissive && tr.ring.material.emissive.setHex(Math.floor(tr.timer * 20) % 2 ? 0xff4d1a : 0); tr.g.position.x = tr.d.x - dir[0] * .08 * Math.sin(tr.timer * 90); if (!tr.warned) { tr.warned = true; W.sfx('warn', .5); } }
      if (tr.timer <= 0) {
        tr.timer = tr.d.every || 3; tr.warned = false; tr.g.position.x = tr.d.x;
        const sx = tr.d.x + dir[0] * 1.0, sz = tr.d.z + dir[1] * 1.0; W.Actors.hostileShot(sx, tr.d.y, sz, sx + dir[0] * 30, tr.d.y, sz + dir[1] * 30, 9, .28); W.sfx('zap', .6); W.bit.say('dart');
      }
    }
  }
  // crumbling blocks (kind 8): shake, drop, return
  if (P.ground && W.grav < 0) {
    const seen = new Set();
    for (const [ox, oz] of [[0, 0], [.3, 0], [-.3, 0], [0, .3], [0, -.3]]) {
      const i = Math.floor(P.x + ox), j = Math.floor(P.y - .1), k = Math.floor(P.z + oz);
      if (R.kindAt(i, j, k) === 8) { const key = i + ',' + j + ',' + k; seen.add(key); if (!T.crumble[key]) T.crumble[key] = { i, j, k, t:0 }; }
    }
  }
  for (const key in T.crumble) {
    const c = T.crumble[key]; c.t += dt;
    if (c.t > .12 && Math.random() < .3) W.debris(c.i + .5, c.j + .9, c.k + .5, W.PAL.crumble);
    if (c.t > .55) { const col = R.c[R.ix(c.i, c.j, c.k)]; R.set(c.i, c.j, c.k, 0, 0); W.sfx('crack', .4); W.debris(c.i + .5, c.j + .5, c.k + .5, col); T.respawn.push({ ...c, col, t:3.6 }); delete T.crumble[key]; }
  }
  for (let n = T.respawn.length - 1; n >= 0; n--) {
    const r = T.respawn[n]; r.t -= dt;
    if (r.t <= 0 && !R.hitBox(P.x, P.y, P.z, P.hw + .1, P.h)) { R.set(r.i, r.j, r.k, r.col, 8); T.respawn.splice(n, 1); }
  }
};
})(window.W);
