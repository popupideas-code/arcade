'use strict';
(function (W) {
const THREE = window.THREE, P = W.player;
const EVENTS = {
  giant: { name:'Giant Mode', dur:35, hint:'Nova grows to 3x size and smashes walls by walking into them!',
    start(c) { W.giant = true; P.applyGiant(); P.mode = 'stand'; W.zoomOut = false; },
    update() {},
    end(c) { W.giant = false; } },
  waltz: { name:'Gravity Waltz', dur:45, hint:'Gravity flips on the beat every 4 seconds. Platforms spin with it!',
    start(c) { c.beat = 0; c.n = 0; c.ang = 0; this.place(c); },
    update(c, d) {
      c.beat += d;
      if (c.beat > 3.4 && !c.warned) { c.warned = true; W.sfx('warn'); W.flash('#ffffff', .25); W.ui.toast('...beat...'); }
      if (c.beat >= 4) { c.beat = 0; c.warned = false; W.grav *= -1; c.ang += .7; W.sfx('flip'); W.shake(.3); P.pound = false; P.jumps = 0; this.place(c); W.ui.toast(W.grav > 0 ? 'Gravity: UP!' : 'Gravity: DOWN'); }
    },
    place(c) {
      const R = W.world.room; R.k.set(c.snap.k); R.c.set(c.snap.c);
      const rad = Math.min(R.w, R.d) * .28, cx = R.w / 2, cz = R.d / 2;
      for (const y of [R.fy + 4, R.h - 8]) for (let i = 0; i < 3; i++) {
        const a = c.ang + i * Math.PI * 2 / 3 + (y > R.h / 2 ? 1 : 0), x = Math.round(cx + Math.cos(a) * rad) - 1, z = Math.round(cz + Math.sin(a) * rad) - 1;
        if (!R.hitBox(P.x, P.y, P.z, P.hw + .1, P.h + .1) || true) for (let dx = 0; dx < 3; dx++) for (let dz = 0; dz < 3; dz++) if (!R.kindAt(x + dx, y, z + dz) && !(Math.abs(P.x - (x + dx + .5)) < P.hw + .5 && Math.abs(P.z - (z + dz + .5)) < P.hw + .5 && P.y < y + 1 && P.y + P.h > y)) R.set(x + dx, y, z + dz, W.PAL.gpink, 1);
      }
    },
    end(c) { W.grav = -1; } },
  bouncy: { name:'Bouncy Cavern', dur:32, hint:'Every surface bounces! Hold Jump on landing to bounce higher.',
    start(c) { W.bouncy = true; W.zoomOut = true; },
    update() {},
    end(c) { W.bouncy = false; W.zoomOut = false; } },
  paper: { name:'Paper World', dur:36, hint:'The room is folded paper. Press Crouch to slip behind the paper walls.',
    start(c) { W.paper = true; document.body.classList.add('paperworld'); W.renderer.domElement.style.filter = 'sepia(.7) saturate(.55) contrast(1.15) brightness(1.08)'; W.scene.background = new THREE.Color(0xf3ead4); W.scene.fog = new THREE.Fog(0xf3ead4, 30, 90); W.ui.toast('Crouch = slip behind the paper'); },
    update() {},
    end(c) { W.paper = false; W.ghost = false; W.player.ghostT = 0; document.body.classList.remove('paperworld'); W.renderer.domElement.style.filter = ''; const R = W.world.room; W.scene.background = new THREE.Color(R.pal.bg); W.scene.fog = new THREE.Fog(R.pal.bg, 26, 78); } },
  reverse: { name:'Reverse Run', dur:45, hint:'The dark is chasing you! Run to the far west end before it catches up.',
    start(c) {
      const R = W.world.room, rn = R.def.run; W.camLockYaw = -Math.PI / 2; c.dx = rn.x0 + 3; c.speed = 4.6; c.goal = rn.x1 + 2;
      c.wall = new THREE.Mesh(new THREE.BoxGeometry(6, R.h, R.d), new THREE.MeshBasicMaterial({ color:0x05030f, transparent:true, opacity:.92 })); c.wall.position.set(c.dx, R.h / 2, R.d / 2); W.world.group.add(c.wall);
      for (const x of [27, 22, 17, 11]) R.fill(x, 1, 1, 1, 1, R.d - 2, 0xff9f1c, 1);               // hurdles to hop
      R.buildMesh(); W.ui.toast('Run west!'); W.sfx('roar', .5);
    },
    update(c, d) {
      const R = W.world.room, P = W.player; c.speed = Math.min(8.4, c.speed + d * .18); c.dx -= c.speed * d; c.wall.position.x = c.dx;
      const dk = document.getElementById('dark'); if (dk) dk.style.opacity = W.clamp(1 - (P.x - c.dx) / 14, 0, .9);
      if (P.x < c.goal) { c.won = true; c.t = c.dur; }
      else if (P.x > c.dx - 3 + .0 && P.x - c.dx < 3.2) { c.failed = true; c.t = c.dur; }
    },
    end(c) { W.camLockYaw = null; W.world.group.remove(c.wall); const dk = document.getElementById('dark'); if (dk) dk.style.opacity = 0; },
    after(c) {
      const R = W.world.room, S = W.S;
      if (c.won) { S.open.b9W = true; for (const dr of R.def.doors) if (dr.locked === 'tide') R.carveDoor(dr); R.buildMesh(); W.ui.banner('Tide Gate open', 'The violet seal fades. The way west is clear.', '#8a5cff'); }
    } },
  parade: { name:'Enemy Parade', dur:40, hint:'Every enemy lines up to form a bridge. Cross it before the parade ends!',
    start(c) {
      const R = W.world.room, pd = R.def.parade, list = W.Actors.enemies.filter(e => e.alive); c.extra = []; c.slots = [];
      while (list.length < 8) { const e = new W.Enemy('waddler', pd.x0, pd.y - 3, pd.z); W.Actors.enemies.push(e); c.extra.push(e); list.push(e); }
      list.slice(0, 8).forEach((e, i) => {
        const tx = pd.x0 + i * (pd.x1 - pd.x0) / 7;
        e.parade = { t:-i * .12, i, sx:e.x, sy:e.y, sz:e.z, tx, ty:pd.y - 1, tz:pd.z }; e.hidden = false; e.state = 'idle'; c.slots.push({ x:tx, z:pd.z, y:pd.y - 1, hy:1, hx:1.3, hz:1.3 });
      });
      c.laid = false;
    },
    update(c, d) { if (!c.laid && c.slots && c.t > 1.6) { c.laid = true; W.world.room.dyn.push(...c.slots); W.sfx('bubble'); } },
    end(c) {
      const R = W.world.room; R.dyn.length = 0;
      for (const e of W.Actors.enemies) if (e.parade) { if (c.extra.includes(e)) { e.alive = false; W.world.group.remove(e.mesh); W.sparkle(e.x, e.y + .5, e.z, 0xffffff, 8); } else { e.parade = null; e.x = e.hx; e.y = e.hy; e.z = e.hz; e.vx = e.vy = e.vz = 0; e.body.scale.set(1, 1, 1); e.body.position.y = 0; e.state = 'idle'; e.hidden = e.type === 'chomper'; } }
    } },
};
const T = W.twist = {
  active:null, ctx:null,
  begin(id, item) {
    if (T.active || W.state !== 'play') return;
    const ev = EVENTS[id], R = W.world.room, S = W.S; if (!ev) return;
    T.active = ev; T.item = item; T.id = id;
    T.ctx = { t:0, dur:ev.dur, snap:{ k:R.k.slice(), c:R.c.slice() }, pos:{ x:P.x, y:P.y, z:P.z } };
    item.alive = false; W.world.group.remove(item.mesh); W.sparkle(item.x, item.y, item.z, 0xb36bff, 24);
    W.sfx('twist'); W.flash('#b36bff', .5); W.music.setStyle('twist'); W.ui.banner('TWIST SEED: ' + ev.name, ev.hint, '#b36bff'); W.bit.say('twist', true); W.ui.twistBar(ev.name, 1);
    ev.start(T.ctx);
  },
  update(d) {
    if (!T.active) return; const c = T.ctx; c.t += d; T.active.update(c, d); W.ui.twistBar(T.active.name, 1 - c.t / c.dur);
    if (c.t >= c.dur) T.finish(true);
  },
  finish(reward) {
    const ev = T.active, c = T.ctx, R = W.world.room, S = W.S; if (!ev) return;
    if (c.failed) reward = false;
    ev.end(c);
    R.k.set(c.snap.k); R.c.set(c.snap.c); R.dyn.length = 0; R.buildMesh(); R.dirty = false;
    if (ev.after) ev.after(c);
    if (c.failed) { W.world.items.push(new W.Item(T.item.def)); W.Actors.hurtPlayer(P.x + 1, P.z, 1); W.ui.toast('Caught by the dark! Try again.'); W.bit.say('reverse_fail', true); P.place(c.pos.x, c.pos.y, c.pos.z); }
    T.active = null; W.ui.twistBar(null); W.music.setStyle(R.def.boss ? 'boss' : 'cave');
    // never leave Nova embedded in restored blocks
    P.setMode('stand', true); if (P.hits(P.x, P.y, P.z, P.hw, P.h)) { let ok = false; for (let i = 1; i <= 40 && !ok; i++) { P.y += .5; ok = !P.hits(P.x, P.y, P.z, P.hw, P.h); } if (!ok) P.place(c.pos.x, c.pos.y, c.pos.z); }
    if (reward) {
      S.seeds[T.item.id] = true; if (c.pos && ev === EVENTS.paper) { /* done */ } const tok = ev.dur >= 40 ? 20 : 15; S.tokens += tok; S.frags++; W.sfx('twistEnd'); W.sfx('fanfare');
      W.ui.banner('Twist complete!', `+${tok} Twist Tokens and a Seed Fragment (${S.frags}/25).`, '#b36bff'); W.writeSave(S); W.flash('#ffffff', .3); W.bit.say('twistEnd');
    }
  },
  cancel() { T.finish(false); const it = T.item; if (it && !W.S.seeds[it.id]) { /* seed stays available */ } },
};
W.flashMs = 0;

/* ---------- Twist Burst: bubble nearby enemies ---------- */
W.burst = function () {
  const S = W.S; if (S.burst <= 0 || W.state !== 'play') return;
  S.burst--; W.sfx('twist'); W.flash('#7df9ff', .35); W.hudPing();
  for (const e of W.Actors.enemies) if (e.alive && !e.parade && Math.hypot(e.x - P.x, e.z - P.z) < 14) { e.bubble = 4; e.stun = 4; if (e.type === 'chomper') { e.state = 'idle'; e.tm = 4; } W.sparkle(e.x, e.y + .5, e.z, 0x7df9ff, 8); }
  for (const s of W.Actors.shots) if (s.hostile) s.life = 0;
  W.ui.toast('Twist Burst! Nearby enemies float in bubbles.');
};
})(window.W);
