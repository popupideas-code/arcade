'use strict';
(function (W) {
const $ = id => document.getElementById(id);
W.state = 'title'; W.transition = null; W.timeScale = 1;

W.startTransition = function (fn, dur = .2) {
  if (W.transition) return; const f = $('fade'); f.style.opacity = 1;
  W.transition = { t:0, dur, fn, did:false };
};
function updateTransition(dt) {
  const T = W.transition; if (!T) return; T.t += dt;
  if (!T.did && T.t >= T.dur) { T.did = true; T.fn(); T.t = 0; }
  else if (T.did && T.t >= T.dur * .8) { $('fade').style.opacity = 0; W.transition = null; }
}

W.startGame = function (S) {
  W.S = S; W.input.resetToggles(); W.applyAccess(); W.grav = -1; W.giant = false; if (W.twist.active) W.twist.cancel();
  UI().closeAll(); W.state = 'play'; W.menuFrom = 'play';
  const br = S.beaconRoom && S.room === S.beaconRoom ? null : null;
  W.loadRoom(S.room || 'r1', null, null);
  if (S.beaconRoom && S.room === S.beaconRoom) { const it = (W.ROOM_BY_ID[S.room].items || []).find(i => i.id === S.beacon); if (it) W.player.place(it.x + 1.8, it.y, it.z); }
  W.music.start(); W.hudPing(); $('hud').style.display = '';
};
const UI = () => W.ui;
W.toTitle = function () {
  W.state = 'title'; $('hud').style.display = 'none'; W.ui.twistBar(null); W.ui.bossBar(false); if (W.twist.active) W.twist.cancel(); W.grav = -1; W.giant = false;
  W.S = W.S || W.newSave(0); W.loadRoom('r1', null, null); W.ui.title();
};

let acc = 0, last = performance.now(), gtime = 0, wheelSel = 'hop';
function fixedStep(dt) {
  const I = W.input;
  if (W.transition) { updateTransition(dt); return; }
  const S = W.S, scale = W.settings.assist.speed * (I.down.wheel ? .25 : 1), d = dt * scale;
  S.time += d;
  W.player.update(d);
  W.twist.update(d);
  W.Traps.update(d);
  W.Actors.update(d);
  W.updateWorld(d, gtime);
  if (I.burst) W.burst();
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - last) / 1000); last = now; gtime += dt;
  const I = W.input; I.poll(dt);
  const nav = I.nav;
  if (W.state === 'title') { W.camYaw += dt * .15; W.camPos = null; const R = W.world.room, p = W.player; p.x = R.w / 2; p.y = R.fy; p.z = R.d / 2; W.camera.position.set(R.w / 2 + Math.sin(W.camYaw) * 18, 9, R.d / 2 + Math.cos(W.camYaw) * 18); W.camera.lookAt(R.w / 2, 3, R.d / 2); W.ui.update(nav); W.heroGroup.visible = false; }
  else {
    W.heroGroup.visible = true;
    if (W.state === 'play') {
      if (I.pressed.menu) { W.ui.openPause(); }
      else if (I.pressed.map) { W.ui.openMap(); W.menuFrom = 'play'; }
      else {
        // ability wheel: slows time and lets the player pick an ability
        if (I.down.wheel) {
          const un = W.ORDER.filter(W.has); wheelSel = W.S.wheel;
          if (un.length) { let i = un.indexOf(wheelSel); if (nav.right || nav.down) i++; if (nav.left || nav.up) i--; for (let n = 1; n <= 6; n++) if (W.input.num === n && W.has(W.ORDER[n - 1])) { i = un.indexOf(W.ORDER[n - 1]); } wheelSel = un[(i + un.length * 4) % un.length]; W.S.wheel = wheelSel; }
          W.ui.wheel(true, wheelSel);
        } else W.ui.wheel(false);
        acc += dt; let n = 0; while (acc >= W.DT && n < 4) { fixedStep(W.DT); acc -= W.DT; n++; for (const k in I.pressed) I.pressed[k] = false; I.burst = false; }
        if (n === 4) acc = 0;
        if (W.transition) updateTransition(dt);
      }
      if (W.state === 'menu') W.ui.wheel(false);
    } else if (W.state === 'menu') {
      W.ui.update(nav);
      if (I.pressed.map && W.menuFrom === 'play') { /* close map with map button */ if ($('mapc')) W.ui.pop(); }
      if (I.pressed.menu && !nav.back) { /* handled via nav.back */ }
    } else if (W.state === 'photo') {
      if (nav.back || I.pressed.menu) W.ui.endPhoto(); if (nav.ok || I.pressed.jump) W.ui.snap();
    }
    if (W.transition && W.state !== 'play') updateTransition(dt);
  }
  W.updateParticles(dt); W.ui.tick(dt); W.Touch.syncState();
  if (W.state !== 'title') { W.bit.group.visible = true; W.bit.update(dt, gtime); } else W.bit.group.visible = false;
  if (W.state === 'play' || W.state === 'menu') W.ui.minimap(dt); else $('mm').style.display = 'none';
  if (W.state !== 'title') { W.updateCamera(dt); }
  if (W.state === 'play' || W.state === 'menu') W.ui.updateHud();
  W.Visuals.occUpdate(); W.Visuals.render();
}
addEventListener('keydown', e => { if (/^Digit[1-6]$/.test(e.code)) W.input.num = +e.code.slice(5); });
addEventListener('keyup', e => { if (/^Digit[1-6]$/.test(e.code)) W.input.num = 0; });

document.getElementById('shotbtn').onclick = () => W.ui.snap(); document.getElementById('exitphoto').onclick = () => W.ui.endPhoto();
// boot
$('hud').style.display = 'none'; W.S = W.newSave(0); W.applyAccess(); W.buildHero(); W.loadRoom('r1', null, null); W.ui.title();
requestAnimationFrame(frame);
})(window.W);
