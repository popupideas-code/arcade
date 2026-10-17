'use strict';
(function (W) {
const THREE = window.THREE;

/* ---------- utils ---------- */
W.hash = (i, j, k) => { const s = Math.sin(i * 12.9898 + j * 78.233 + k * 37.719) * 43758.5453; return s - Math.floor(s); };
W.rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
W.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
W.lerp = (a, b, t) => a + (b - a) * t;
const jget = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const jset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

/* ---------- settings ---------- */
W.DEFAULT_KEYS = { jump:['Space'], run:['ShiftLeft'], shoot:['KeyJ'], bonk:['KeyK'], aim:['KeyL'], crouch:['KeyC'], wheel:['KeyR'], burst:['KeyF'], map:['KeyM'], menu:['Escape'], zoom:['KeyZ'], bit:['KeyB'] };
W.DEFAULT_PAD = { jump:0, bonk:1, run:2, shoot:3, crouch:6, aim:7, wheel:5, burstL:4, map:9, menu:8, zoom:11, bit:10 };
W.ACTION_LABELS = { jump:'Jump', run:'Run', shoot:'Shoot', bonk:'Spin Bonk / Interact', aim:'Aim', crouch:'Crouch / Roll / Pound', wheel:'Ability wheel', burst:'Twist Burst', map:'Map', menu:'Menu', zoom:'Camera zoom', bit:'Bit scan' };
const DEFAULT_SETTINGS = {
  vol:{ music:.6, sfx:.8, voice:.6 },
  keys:JSON.parse(JSON.stringify(W.DEFAULT_KEYS)), pad:JSON.parse(JSON.stringify(W.DEFAULT_PAD)),
  toggle:{ run:false, aim:false, crouch:false, shoot:false },
  assist:{ dmg:1, infinite:false, speed:1, autoaim:false },
  hc:false, cbs:false, shake:1, flash:true, text:1,
  ui:'auto', quality:'auto', minimap:'tr', mapSize:1, hudScale:1, bitChat:'chatty',
};
W.settings = Object.assign({}, DEFAULT_SETTINGS, jget('wd_settings', {}));
for (const k of Object.keys(DEFAULT_SETTINGS)) if (typeof DEFAULT_SETTINGS[k] === 'object') W.settings[k] = Object.assign({}, DEFAULT_SETTINGS[k], W.settings[k]);
W.saveSettings = () => jset('wd_settings', W.settings);

/* ---------- renderer ---------- */
W.renderer = new THREE.WebGLRenderer({ antialias:true });
W.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
W.renderer.setSize(innerWidth, innerHeight);
W.renderer.shadowMap.enabled = true;
document.body.prepend(W.renderer.domElement);
W.scene = new THREE.Scene();
W.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 150);
W.hemi = new THREE.HemisphereLight(0xcfe8ff, 0x6a5a8a, 0.85);
W.sun = new THREE.DirectionalLight(0xffffff, 0.75);
W.sun.castShadow = true; W.sun.shadow.mapSize.set(2048, 2048);
W.scene.add(W.hemi, W.sun, W.sun.target);
addEventListener('resize', () => { W.renderer.setSize(innerWidth, innerHeight); W.camera.aspect = innerWidth / innerHeight; W.camera.updateProjectionMatrix(); });

/* ---------- input: keyboard + gamepad, remappable, hold/toggle ---------- */
const ACTIONS = ['jump', 'run', 'shoot', 'bonk', 'aim', 'crouch', 'wheel', 'map', 'menu', 'zoom', 'bit'];
W.touch = { ax:0, ay:0, cx:0, cy:0, down:{}, burst:false, active:false };
const I = W.input = { ax:0, ay:0, cx:0, cy:0, down:{}, pressed:{}, released:{}, burst:false, nav:{}, anyKey:null, anyPad:null, padName:'' };
const kdown = new Set(), kpress = new Set();
const tog = {}, prevRaw = {};
let padPrev = [], navHold = {}, mouseDX = 0, captured = null;
addEventListener('keydown', e => {
  if (e.repeat) return;
  if (!/^(F5|F12)$/.test(e.code)) e.preventDefault();
  kdown.add(e.code); kpress.add(e.code); I.anyKey = e.code;
});
addEventListener('keyup', e => kdown.delete(e.code));
addEventListener('blur', () => kdown.clear());
let dragging = false;
addEventListener('pointerdown', e => { if (e.target === W.renderer.domElement) dragging = true; });
addEventListener('pointerup', () => dragging = false);
addEventListener('pointermove', e => { if (dragging && e.pointerType === 'mouse') mouseDX += e.movementX || 0; });

function pad() { const l = navigator.getGamepads ? navigator.getGamepads() : []; for (const g of l) if (g && g.connected) return g; return null; }
W.input.poll = function (dt) {
  const s = W.settings, g = pad();
  I.padName = g ? g.id : '';
  const pb = i => !!(g && g.buttons[i] && g.buttons[i].pressed);
  const padNow = g ? g.buttons.map(b => b.pressed) : [];
  I.anyPad = null;
  padNow.forEach((v, i) => { if (v && !padPrev[i]) I.anyPad = i; });
  const kd = a => (s.keys[a] || []).some(c => kdown.has(c));
  // axes
  const dz = v => Math.abs(v) < 0.18 ? 0 : v;
  let ax = (kdown.has('KeyD') || kdown.has('ArrowRight') ? 1 : 0) - (kdown.has('KeyA') || kdown.has('ArrowLeft') ? 1 : 0);
  let ay = (kdown.has('KeyS') || kdown.has('ArrowDown') ? 1 : 0) - (kdown.has('KeyW') || kdown.has('ArrowUp') ? 1 : 0);
  let cx = (kdown.has('KeyE') ? 1 : 0) - (kdown.has('KeyQ') ? 1 : 0), cy = 0;
  if (g) {
    ax += dz(g.axes[0] || 0) + (pb(15) ? 1 : 0) - (pb(14) ? 1 : 0);
    ay += dz(g.axes[1] || 0) + (pb(13) ? 1 : 0) - (pb(12) ? 1 : 0);
    cx += dz(g.axes[2] || 0); cy += dz(g.axes[3] || 0);
  }
  cx += mouseDX * 0.02; mouseDX = 0;
  const T = W.touch; if (T.active) { ax += T.ax; ay += T.ay; cx += T.cx; cy += T.cy; T.cx = T.cy = 0; }
  const l = Math.hypot(ax, ay); if (l > 1) { ax /= l; ay /= l; }
  I.ax = ax; I.ay = ay; I.cx = cx; I.cy = cy;
  // buttons with hold-or-toggle
  const lb = pb(s.pad.burstL), rb = pb(s.pad.wheel);
  for (const a of ACTIONS) {
    let raw = kd(a) || (g && s.pad[a] != null && pb(s.pad[a])) || !!(T.active && T.down[a]);
    if (a === 'wheel') raw = (kd('wheel') || rb) && !(lb && rb);
    const rise = raw && !prevRaw[a];
    let eff = raw;
    if (s.toggle[a]) { if (rise) tog[a] = !tog[a]; eff = !!tog[a]; }
    I.pressed[a] = s.toggle[a] ? (rise && tog[a]) : rise;
    I.released[a] = s.toggle[a] ? (rise && !tog[a]) : (!raw && prevRaw[a]);
    I.down[a] = eff; prevRaw[a] = raw;
  }
  const burstRaw = kd('burst') || (lb && rb) || !!(T.active && T.down.burst);
  I.burst = burstRaw && !prevRaw.burst; prevRaw.burst = burstRaw;
  // menu navigation with repeat
  const nv = { up:kdown.has('ArrowUp') || kdown.has('KeyW') || pb(12) || (g && g.axes[1] < -.6), down:kdown.has('ArrowDown') || kdown.has('KeyS') || pb(13) || (g && g.axes[1] > .6),
    left:kdown.has('ArrowLeft') || kdown.has('KeyA') || pb(14) || (g && g.axes[0] < -.6), right:kdown.has('ArrowRight') || kdown.has('KeyD') || pb(15) || (g && g.axes[0] > .6),
    ok:kdown.has('Enter') || kdown.has('Space') || pb(0), back:kdown.has('Escape') || kdown.has('Backspace') || pb(1), alt:kdown.has('KeyJ') || kdown.has('KeyF') || pb(3) };
  for (const k in nv) {
    const v = !!nv[k], h = navHold[k] || { on:false, t:0 };
    I.nav[k] = false;
    if (v && !h.on) { I.nav[k] = true; h.t = 0.35; }
    else if (v && ['up', 'down', 'left', 'right'].includes(k)) { h.t -= dt; if (h.t <= 0) { I.nav[k] = true; h.t = 0.12; } }
    h.on = v; navHold[k] = h;
  }
  if (kpress.has('KeyP') || kpress.has('Escape')) I.pressed.menu = I.pressed.menu || kpress.has('Escape') || kpress.has('KeyP');
  if (kpress.has('Tab')) I.pressed.map = true;
  padPrev = padNow; kpress.clear();
};
W.input.clearAnyKey = () => { I.anyKey = null; I.anyPad = null; };
W.input.resetToggles = () => { for (const k in tog) tog[k] = false; };

/* ---------- audio: sfx, gibberish voice, layered music ---------- */
let ac, master, gM, gS, gV;
function ctx() {
  if (ac) return ac;
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    gM = ac.createGain(); gS = ac.createGain(); gV = ac.createGain();
    gM.connect(ac.destination); gS.connect(ac.destination); gV.connect(ac.destination);
    W.applyVolumes();
  } catch (e) { ac = null; }
  return ac;
}
W.applyVolumes = () => { if (!ac) return; gM.gain.value = W.settings.vol.music * 0.5; gS.gain.value = W.settings.vol.sfx; gV.gain.value = W.settings.vol.voice; };
addEventListener('pointerdown', ctx); addEventListener('keydown', ctx);
function tone(out, type, f, f2, dur, vol, when = 0) {
  const a = ctx(); if (!a) return;
  const t = a.currentTime + when, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.02);
}
const SFX = {
  jump:[['square', 330, 660, .12, .12]], hop:[['triangle', 520, 1100, .16, .18], ['sine', 1100, 1500, .1, .1, .06]],
  kick:[['sawtooth', 260, 900, .1, .1], ['square', 900, 400, .1, .08, .06]], roll:[['sine', 240, 90, .22, .2], ['triangle', 120, 60, .2, .15]],
  dash:[['sawtooth', 120, 1500, .2, .1], ['square', 1500, 200, .1, .06, .1]], land:[['sine', 140, 60, .09, .18]],
  shoot:[['square', 880, 330, .09, .07]], charge:[['sine', 300, 700, .25, .08]], wave:[['sawtooth', 200, 900, .3, .1], ['sine', 900, 300, .25, .1, .05]],
  bonk:[['square', 200, 100, .15, .14], ['triangle', 400, 200, .1, .1]], hit:[['square', 300, 150, .1, .1]], hurt:[['sawtooth', 300, 90, .35, .14]],
  die:[['triangle', 500, 80, .6, .15]], sparkle:[['sine', 1200, 2000, .2, .08], ['sine', 1600, 2400, .15, .06, .07]],
  pickup:[['square', 988, 988, .07, .06], ['square', 1319, 1319, .12, .06, .07]], pearl:[['sine', 880, 880, .1, .1], ['sine', 1320, 1320, .1, .1, .09], ['sine', 1760, 1760, .2, .1, .18]],
  fanfare:[['square', 523, 523, .14, .08], ['square', 659, 659, .14, .08, .14], ['square', 784, 784, .14, .08, .28], ['square', 1046, 1046, .5, .1, .42]],
  beacon:[['sine', 440, 880, .5, .12], ['sine', 660, 1320, .5, .1, .1]], door:[['sine', 300, 500, .12, .06]],
  twist:[['sawtooth', 200, 800, .5, .1], ['square', 800, 1600, .4, .06, .2]], twistEnd:[['triangle', 900, 300, .5, .1]],
  bubble:[['sine', 500, 900, .12, .08]], pound:[['sine', 160, 40, .35, .3], ['square', 90, 40, .3, .1]], crack:[['sawtooth', 600, 100, .25, .08]],
  splash:[['sine', 400, 120, .25, .12], ['triangle', 800, 300, .15, .06]], boost:[['sawtooth', 200, 1200, .22, .1], ['square', 1200, 1800, .1, .05, .12]], ring:[['square', 1500, 2000, .06, .05]], mine:[['square', 220, 120, .1, .1], ['triangle', 600, 300, .06, .06]], zap:[['sawtooth', 900, 200, .15, .08]], scan:[['sine', 500, 1500, .4, .08]],
  roar:[['sawtooth', 120, 50, .6, .16], ['square', 80, 40, .6, .1]], warn:[['square', 700, 700, .06, .05]], menu:[['square', 600, 600, .04, .04]], flip:[['sine', 400, 100, .4, .12]],
};
W.sfx = (name, vol = 1) => { if (!ctx()) return; if (AF.sfx[name]) return playBuf(AF.sfx[name], gS, vol); for (const s of (SFX[name] || [])) tone(gS, s[0], s[1], s[2], s[3], s[4] * vol, s[5] || 0); };
W.voice = (text, pitch = 1, who = 'bit') => { // gibberish blips, or a recorded clip when audio files exist
  if (!ctx()) return;
  const clips = AF.voice[who]; if (clips && clips.length) { playBuf(clips[Math.floor(Math.random() * clips.length)], gV, 1, pitch * (.95 + Math.random() * .1)); return; }
  const n = Math.min(14, Math.ceil(text.length / 4));
  for (let i = 0; i < n; i++) tone(gV, 'triangle', (380 + Math.random() * 380) * pitch, 0, .07, .12, i * .075);
};

// music: tiny step sequencer. layers: pad, bass, arp, perc. danger thins layers. twist/boss switch style.
const M = W.music = { style:'cave', layers:1, danger:false, step:0, next:0, on:false };
const STYLES = {
  cave:  { bpm:84,  wave:'triangle', roots:[50, 46, 48, 45], scale:[0, 3, 7, 10, 12, 15], vol:1 },
  twist: { bpm:150, wave:'square',   roots:[60, 65, 67, 60], scale:[0, 4, 7, 12, 16, 19], vol:.55 },
  boss:  { bpm:112, wave:'sawtooth', roots:[45, 45, 43, 41], scale:[0, 3, 7, 6, 10, 12], vol:.6 },
};
const mf = n => 440 * Math.pow(2, (n - 69) / 12);
function musicTick() {
  const a = ctx(); if (!a || !M.on) return;
  if (M.synthOff) return;
  const st = STYLES[M.style], dur = 60 / st.bpm / 2;
  while (M.next < a.currentTime + 0.2) {
    const t = Math.max(0, M.next - a.currentTime), s = M.step, bar = Math.floor(s / 16) % 4, root = st.roots[bar], layers = M.danger ? Math.min(M.layers, 2) : M.layers;
    if (s % 16 === 0) tone(gM, st.wave, mf(root + 12), 0, dur * 15, .05 * st.vol, t);                                        // pad
    if (layers >= 2 && s % 4 === 0) tone(gM, 'sine', mf(root - 12), mf(root - 12) * .99, dur * 3, .13 * st.vol, t);           // bass
    if (layers >= 3 && !M.danger && s % 2 === 0) tone(gM, st.wave, mf(root + 24 + st.scale[(s * 3 + bar) % st.scale.length]), 0, dur * 1.4, .035 * st.vol, t); // arp
    if (layers >= 4 && !M.danger && s % 4 === 2) tone(gM, 'square', 180, 60, .05, .03 * st.vol, t);                           // perc
    if (M.style === 'boss' && s % 4 === 0) tone(gM, 'square', 90, 40, .1, .05, t);
    M.next += dur; M.step++;
  }
}
setInterval(musicTick, 40);
W.music.start = () => { const a = ctx(); if (!a) return; M.on = true; M.next = a.currentTime + .1; W.music.setStyle(M.style, true); };
W.music.setStyle = (s, force) => {
  if (M.style === s && !force) return; M.style = s; M.step = 0;
  if (musicSrc) { try { musicSrc.g.gain.setTargetAtTime(0, ctx().currentTime, .3); musicSrc.s.stop(ctx().currentTime + 1.2); } catch (e) {} musicSrc = null; }
  if (AF.music[s] && ctx() && M.on) { musicSrc = playBuf(AF.music[s], gM, 1, 1, true); M.synthOff = true; } else M.synthOff = false;
};

/* ---------- optional audio files (see assets/audio/README.md) ---------- */
const AF = W.audioFiles = { music:{}, voice:{ bit:[], hero:[], enemy:[], boss:[] }, sfx:{} }, MAN = W.AUDIO_MANIFEST || { music:{}, voice:{}, sfx:{} };
let musicSrc = null;
function loadBuf(url, cb) { const a = ctx(); if (!a || !url) return; fetch(url).then(r => r.ok ? r.arrayBuffer() : Promise.reject()).then(b => a.decodeAudioData(b, cb)).catch(() => {}); }
W.loadAudioFiles = function () {
  for (const k in MAN.music || {}) if (MAN.music[k]) loadBuf(MAN.music[k], b => { AF.music[k] = b; if (M.style === k && M.on) W.music.setStyle(k, true); });
  for (const who in MAN.voice || {}) for (const u of MAN.voice[who] || []) loadBuf(u, b => (AF.voice[who] = AF.voice[who] || []).push(b));
  for (const k in MAN.sfx || {}) if (MAN.sfx[k]) loadBuf(MAN.sfx[k], b => { AF.sfx[k] = b; });
};
function playBuf(buf, out, vol = 1, rate = 1, loop = false) { const a = ctx(); const s = a.createBufferSource(), g = a.createGain(); s.buffer = buf; s.loop = loop; s.playbackRate.value = rate; g.gain.value = vol; s.connect(g).connect(out); s.start(); return { s, g }; }
const kickAudio = () => { if (!W.audioLoaded && ctx()) { W.audioLoaded = true; W.loadAudioFiles(); } };
addEventListener('pointerdown', kickAudio); addEventListener('keydown', kickAudio);

/* ---------- save slots ---------- */
W.newSave = slot => ({ slot, abilities:{}, weapons:{}, items:{}, seeds:{}, visited:{ r1:true }, beacons:{}, pins:{}, broken:{}, hearts:5, tokens:0, frags:0, cores:0, room:'r1', beacon:'b1',
  boss:false, badges:{}, equipped:[], look:W.defaultLook(), unlocked:{}, explored:{}, seenRooms:{}, kills:0, time:0, hint:0, burst:3, wheel:'hop' });
W.has = k => !!W.S && (k === 'pick' ? !!W.S.weapons.pick : !!W.S.abilities[k]);
W.saveList = () => [0, 1, 2].map(i => jget('wd_slot_' + i, null));
W.writeSave = S => { S.stamp = Date.now(); jset('wd_slot_' + S.slot, S); };
W.deleteSave = i => { try { localStorage.removeItem('wd_slot_' + i); } catch (e) {} };
W.pearls = S => Object.keys(S.items).filter(k => k.startsWith('p_')).length;
W.maxHearts = S => Math.min(12, 5 + Math.floor(W.pearls(S) / 4));
})(window.W);
