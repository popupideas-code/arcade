'use strict';
(function (W) {
const $ = id => document.getElementById(id);
const UI = W.ui = {};
let stack = [], focus = [], capture = null, pingT = -9, toastT = 0, bannerT = 0, bitT = 0;

/* ---------- HUD ---------- */
const heartSvg = (on) => `<span class="heart ${on ? 'on' : ''}">${on ? '♥' : '♡'}</span>`;
W.hudPing = () => { pingT = performance.now(); };
UI.updateHud = function () {
  const S = W.S; if (!S) return;
  const mx = W.maxHearts(S); let h = ''; for (let i = 0; i < mx; i++) h += heartSvg(i < S.hearts);
  if ($('hearts').dataset.k !== h) { $('hearts').innerHTML = h; $('hearts').dataset.k = h; }
  let b = ''; for (let i = 0; i < 3; i++) b += `<span class="pip ${i < S.burst ? 'on' : ''}"></span>`;
  if ($('burst').dataset.k !== b) { $('burst').innerHTML = b; $('burst').dataset.k = b; }
  $('stats').textContent = `${W.pearls(S)}♥ ${S.tokens}◈ ${S.frags}/25`;
  const a = W.ABILITIES[S.wheel]; const key = S.wheel + (W.has(S.wheel) ? '1' : '0') + W.settings.cbs;
  if ($('abil').dataset.k !== key) { $('abil').dataset.k = key; $('abil').innerHTML = ''; if (a && W.has(S.wheel)) { const c = W.symbolCanvas(a.sym, a.color, 64, W.settings.cbs ? a.name.split(' ')[0] : null); c.style.width = c.style.height = '100%'; $('abil').appendChild(c); } }
  const calm = performance.now() - pingT > 3000, danger = W.Actors.enemies.some(e => e.state === 'warn' || e.state === 'attack') || (W.Actors.boss && W.Actors.boss.state !== 'wait');
  $('hud').style.opacity = (calm && !danger && W.state === 'play' && S.hearts >= W.maxHearts(S)) ? .3 : 1;
  W.music.danger = !!danger;
};
UI.roomName = name => { const el = $('roomname'); el.textContent = name; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); W.hudPing(); };
// Notices live in a narrow column at the screen edge so they never cover the play area.
function feed(cls, html, ttl) {
  const f = $('feed'), d = document.createElement('div'); d.className = 'fi ' + cls; d.innerHTML = html;
  if (cls === 'bitline') f.querySelectorAll('.bitline').forEach(n => n.remove());
  f.appendChild(d); while (f.children.length > 3) f.removeChild(f.firstChild);
  setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 450); }, ttl * 1000);
}
UI.toast = txt => feed('toast', txt, 2.6);
UI.bit = txt => { const t = txt.replace(/^Bit: /, ''); feed('bitline', '<b>◆ Bit</b>' + t, 4 + t.length * .035); W.voice(t, 1.2, 'bit'); };
UI.banner = (title, sub, color) => { feed('banner', `<h3 style="color:${color || '#ffd23f'}">${title}</h3><p>${sub || ''}</p>`, 5.5); W.hudPing(); };
UI.bossBar = (on, name) => { $('boss').style.display = on ? 'block' : 'none'; if (name) $('bossname').textContent = name; };
UI.bossHp = f => { $('bossfill').style.width = Math.max(0, f * 100) + '%'; };
UI.twistBar = (name, f) => { const el = $('twist'); if (name == null) { el.style.display = 'none'; return; } el.style.display = 'block'; $('twistname').textContent = name; $('twistfill').style.width = Math.max(0, f * 100) + '%'; };
UI.tick = dt => {};
UI.objective = tp => {
  const el = $('obj'); if (!tp) { el.style.display = 'none'; return; }
  const P = W.player, dx = tp.x - P.x, dz = tp.z - P.z, c = Math.cos(W.camYaw), sn = Math.sin(W.camYaw), sx = dx * c - dz * sn, sy = dx * sn + dz * c;
  el.style.display = 'flex'; $('objarrow').style.transform = `rotate(${Math.atan2(sx, -sy) * 180 / Math.PI}deg)`;
  $('objtxt').textContent = `${tp.label} · ${Math.round(Math.hypot(dx, dz))}m${Math.abs(tp.y - P.y) > 2.5 ? (tp.y > P.y ? ' ↑' : ' ↓') : ''}`;
};

/* ---------- mini map: fills in as you explore ---------- */
const b64 = bytes => { let s_ = ''; for (let i = 0; i < bytes.length; i++) s_ += String.fromCharCode(bytes[i]); return btoa(s_); };
const unb64 = (str, n) => { const out = new Uint8Array(n); try { const r = atob(str); for (let i = 0; i < Math.min(n, r.length); i++) out[i] = r.charCodeAt(i); } catch (e) {} return out; };
let mm = null, mmT = 0, mmSave = 0;
function mmLoad(R) {
  const S = W.S, n = R.w * R.d; mm = { id:R.id, ex:S.explored[R.id] ? unb64(S.explored[R.id], n) : new Uint8Array(n), ver:-1, top:new Int16Array(n), dirty:false };
}
function mmHeights(R) { for (let x = 0; x < R.w; x++) for (let z = 0; z < R.d; z++) { let y = R.h - 2; while (y >= 0 && !R.solid(x, y, z)) y--; mm.top[z * R.w + x] = y; } mm.ver = R.ver || 0; }
UI.minimap = function (dt) {
  const S = W.S, R = W.world.room, cv = $('mm'), set = W.settings; if (!S || !R) return;
  if (set.minimap === 'off' || W.state === 'photo') { cv.style.display = 'none'; return; }
  cv.style.display = 'block'; cv.className = 'mm-' + set.minimap;
  if (!mm || mm.id !== R.id) mmLoad(R);
  const P = W.player, px = Math.floor(P.x), pz = Math.floor(P.z), rad = 8;
  for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) if (dx * dx + dz * dz <= rad * rad) { const x = px + dx, z = pz + dz; if (x >= 0 && z >= 0 && x < R.w && z < R.d && !mm.ex[z * R.w + x]) { mm.ex[z * R.w + x] = 1; mm.dirty = true; } }
  mmSave += dt; if (mm.dirty && mmSave > 2) { S.explored[R.id] = b64(mm.ex); mm.dirty = false; mmSave = 0; }
  mmT += dt; if (mmT < 1 / 20) return; mmT = 0;
  if (mm.ver !== (R.ver || 0)) mmHeights(R);
  const size = Math.round(130 * set.mapSize), view = 12, sc = size / (view * 2); if (cv.width !== size) { cv.width = cv.height = size; }
  const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, size, size);
  g.save(); g.beginPath(); g.arc(size / 2, size / 2, size / 2 - 2, 0, 7); g.clip(); g.fillStyle = 'rgba(8,6,28,.78)'; g.fillRect(0, 0, size, size);
  g.translate(size / 2, size / 2); g.rotate(W.camYaw); g.scale(sc, sc); g.translate(-P.x, -P.z);
  const x0 = Math.max(0, Math.floor(P.x - view * 1.5)), x1 = Math.min(R.w - 1, Math.ceil(P.x + view * 1.5)), z0 = Math.max(0, Math.floor(P.z - view * 1.5)), z1 = Math.min(R.d - 1, Math.ceil(P.z + view * 1.5));
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    if (!mm.ex[z * R.w + x]) continue; const t = mm.top[z * R.w + x], edge = x === 0 || z === 0 || x === R.w - 1 || z === R.d - 1;
    const wl = W.Water.levelAt(x + .5, z + .5); g.fillStyle = edge ? '#3a3470' : (wl != null && t < wl) ? '#2a7fbf' : t < 0 ? '#050310' : `hsl(${150 + Math.min(80, (t - R.fy) * 8)},${45}%,${28 + Math.max(0, Math.min(40, (t - P.y + 2) * 5 + 12))}%)`;
    g.fillRect(x, z, 1.05, 1.05);
  }
  const ex = (x, z) => mm.ex[Math.floor(z) * R.w + Math.floor(x)];
  for (const dr of R.def.doors) { const q = R.doorRect(dr), c = q.a0 + q.w / 2; g.fillStyle = '#ffd23f'; if (dr.dir === 'E') g.fillRect(R.w - 1, c - q.w / 2, 1, q.w); else if (dr.dir === 'W') g.fillRect(0, c - q.w / 2, 1, q.w); else if (dr.dir === 'N') g.fillRect(c - q.w / 2, 0, q.w, 1); else g.fillRect(c - q.w / 2, R.d - 1, q.w, 1); }
  for (const gt of W.world.gates) if (ex(gt.x, gt.z)) { const a = W.ABILITIES[gt.ability]; g.fillStyle = a ? a.color : '#c8a165'; g.beginPath(); g.arc(gt.x, gt.z, .9, 0, 7); g.fill(); }
  for (const it of W.world.items) if (it.alive && ex(it.x, it.z)) { g.fillStyle = it.t === 'pearl' ? '#ff9ad8' : it.t === 'seed' ? '#b36bff' : it.t === 'token' ? '#ffd23f' : it.t === 'beacon' ? '#6bffd4' : it.t === 'shop' ? '#ff9f1c' : '#7df9ff'; g.beginPath(); if (it.t === 'beacon') g.rect(it.x - .8, it.z - .8, 1.6, 1.6); else g.arc(it.x, it.z, .8, 0, 7); g.fill(); }
  for (const e of W.Actors.enemies) if (e.alive && !e.hidden && Math.hypot(e.x - P.x, e.z - P.z) < 10) { g.fillStyle = '#ff4d1a'; g.beginPath(); g.arc(e.x, e.z, .8, 0, 7); g.fill(); }
  if (W.Actors.boss && W.Actors.boss.alive && W.Actors.boss.state !== 'wait') { g.fillStyle = '#ff4d1a'; g.beginPath(); g.arc(W.Actors.boss.hx, W.Actors.boss.hz, 2, 0, 7); g.fill(); }
  g.translate(P.x, P.z); g.rotate(Math.PI - P.face); g.fillStyle = '#fff'; g.strokeStyle = '#1c1740'; g.lineWidth = .35; g.beginPath(); g.moveTo(0, -1.6); g.lineTo(1.1, 1.1); g.lineTo(0, .5); g.lineTo(-1.1, 1.1); g.closePath(); g.fill(); g.stroke();
  g.restore(); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 3; g.beginPath(); g.arc(size / 2, size / 2, size / 2 - 2, 0, 7); g.stroke();
};
W.flash = (color, a = .35) => { const el = $('flash'); if (!W.settings.flash) { a = Math.min(a, .08); } el.style.background = color; el.style.opacity = a; setTimeout(() => el.style.opacity = 0, 90); };
UI.wheel = function (on, sel) {
  const el = $('wheel'); el.style.display = on ? 'flex' : 'none'; if (!on) return;
  el.innerHTML = W.ORDER.map(k => { const a = W.ABILITIES[k], has = W.has(k); return `<div class="wi ${k === sel ? 'sel' : ''} ${has ? '' : 'lock'}" style="border-color:${a.color}"><div>${has ? a.name : '???'}</div><small>${has ? (k === 'dash' ? 'Run = dash' : k === 'roll' ? 'Crouch = ball' : k === 'pick' ? 'Bonk = mine' : 'passive') : 'locked'}</small></div>`; }).join('');
};
UI.endCard = (n) => {
  W.state = 'menu'; UI.push({ title:n === 2 ? 'Brook Burrows Cleared!' : 'Crash Hollow Cleared!', note:() => (n === 2 ? 'Queen Bubblefin now guards the Landing pond.\nThe Clockwork Canopy is still ahead...' : 'Old Mossback is now a helper at the Landing.\nThe path south to Brook Burrows is open!') + `\nHeart Pearls ${W.pearls(W.S)} · Twist Seeds ${Object.keys(W.S.seeds).length}/6 · Seed Fragments ${W.S.frags}/25`, items:[{ label:() => 'Keep exploring', act:() => UI.closeAll() }, { label:() => 'Quit to title', act:() => W.toTitle() }] });
};

/* ---------- menu engine ---------- */
function render() {
  const m = stack[stack.length - 1], el = $('menu'); if (!m) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  if (m.custom) { return m.render && m.render(el); }
  const f = focus[focus.length - 1];
  el.innerHTML = `<div class="panel"><h1>${m.title}</h1>${m.note ? `<p class="note">${m.note().replace(/\n/g, '<br>')}</p>` : ''}<div class="items">${m.items.map((it, i) => `<div class="it ${i === f ? 'foc' : ''} ${it.disabled && it.disabled() ? 'dis' : ''}" data-i="${i}"><span>${it.label()}</span>${it.val ? `<em>${it.val()}</em>` : ''}</div>`).join('')}</div><p class="hint">${m.hint || 'Up/Down choose · Enter/B confirm · Esc/A back'}</p></div>`;
  el.querySelectorAll('.it').forEach(n => { n.onclick = () => { focus[focus.length - 1] = +n.dataset.i; UI.activate(); }; });
  const fe = el.querySelector('.foc'); fe && fe.scrollIntoView({ block:'nearest' });
}
UI.push = def => { stack.push(def); focus.push(def.focus || 0); if (W.state !== 'menu') { W.menuFrom = W.state; W.state = 'menu'; } W.input.resetToggles(); render(); W.sfx('menu'); };
UI.pop = () => { stack.pop(); focus.pop(); if (!stack.length) UI.closeAll(); else render(); };
UI.closeAll = () => { stack = []; focus = []; $('menu').style.display = 'none'; if (W.state === 'menu' || W.state === 'map') W.state = W.menuFrom === 'title' ? 'title' : 'play'; if (W.state !== 'title') W.hudPing(); };
UI.activate = () => { const m = stack[stack.length - 1], it = m.items[focus[focus.length - 1]]; if (it && !(it.disabled && it.disabled()) && it.act) { W.sfx('menu'); it.act(); render(); } };
UI.refresh = render;
UI.update = function (nav) {
  if (capture) {
    const I = W.input; let done = false;
    if (I.anyKey) { if (I.anyKey === 'Delete') done = true; else { W.settings.keys[capture] = [I.anyKey]; done = true; } }
    else if (I.anyPad != null) { W.settings.pad[capture] = I.anyPad; done = true; }
    if (done) { capture = null; W.saveSettings(); W.input.clearAnyKey(); $('capture').style.display = 'none'; render(); }
    return;
  }
  const m = stack[stack.length - 1]; if (!m) return;
  if (m.custom) return m.update && m.update(nav);
  const f = focus.length - 1, n = m.items.length;
  const skip = dir => { let k = 0; do { focus[f] = (focus[f] + dir + n) % n; k++; } while (m.items[focus[f]].disabled && m.items[focus[f]].disabled() && k < n); };
  if (nav.up) { skip(-1); W.sfx('menu'); render(); } else if (nav.down) { skip(1); W.sfx('menu'); render(); }
  const it = m.items[focus[f]];
  if (nav.left && it.left) { it.left(); W.sfx('menu'); render(); } else if (nav.right && it.right) { it.right(); W.sfx('menu'); render(); }
  else if (nav.ok) UI.activate();
  else if (nav.back && m.back !== false) { if (m.onBack) m.onBack(); UI.pop(); }
};
UI.startCapture = act => { capture = act; $('capture').style.display = 'flex'; $('capturetxt').textContent = 'Press a key or gamepad button for "' + W.ACTION_LABELS[act] + '" (Delete to cancel)'; W.input.clearAnyKey(); };

const cycle = (arr, cur, dir) => arr[(arr.indexOf(cur) + dir + arr.length) % arr.length];
const vol = k => ({ label:() => k[0].toUpperCase() + k.slice(1) + ' volume', val:() => '◀ ' + Math.round(W.settings.vol[k] * 100) + '% ▶', left:() => { W.settings.vol[k] = Math.max(0, +(W.settings.vol[k] - .1).toFixed(2)); W.applyVolumes(); W.saveSettings(); W.sfx('pickup'); }, right:() => { W.settings.vol[k] = Math.min(1, +(W.settings.vol[k] + .1).toFixed(2)); W.applyVolumes(); W.saveSettings(); W.sfx('pickup'); } });
const opt = (label, get, set, vals, fmt = v => v) => ({ label:() => label, val:() => '◀ ' + fmt(get()) + ' ▶', left:() => { set(cycle(vals, get(), -1)); W.saveSettings(); W.applyAccess(); }, right:() => { set(cycle(vals, get(), 1)); W.saveSettings(); W.applyAccess(); }, act:() => { set(cycle(vals, get(), 1)); W.saveSettings(); W.applyAccess(); } });
const onoff = (label, get, set) => opt(label, get, set, [false, true], v => v ? 'On' : 'Off');
const holdTog = (label, k) => opt(label, () => W.settings.toggle[k], v => { W.settings.toggle[k] = v; W.input.resetToggles(); }, [false, true], v => v ? 'Toggle' : 'Hold');

W.applyAccess = function () {
  const s = W.settings; document.body.classList.toggle('hc', s.hc); document.documentElement.style.setProperty('--ts', s.text); document.documentElement.style.setProperty('--hs', s.hudScale);
  if (W.buildHero) { W.buildHero(); }
  if (W.Touch) W.Touch.apply(); if (W.Visuals && W.Visuals.setupQuality && W.lastQuality !== s.quality + W.isTouch) { W.lastQuality = s.quality + W.isTouch; W.Visuals.setupQuality(); }
};
const keyName = c => (c || '?').replace('Key', '').replace('Arrow', '↑↓←→'.slice(0, 0)).replace('Space', 'Space').replace('Left', '');
UI.controlsMenu = () => ({ title:'Controls (remap)', hint:'Select an action to rebind keyboard + gamepad. Burst is L+R on pads.',
  items:[...Object.keys(W.ACTION_LABELS).map(a => ({ label:() => W.ACTION_LABELS[a], val:() => `Key ${(W.settings.keys[a] || ['-']).join('/')} · Pad ${a === 'burst' ? 'L+R' : W.settings.pad[a] != null ? 'B' + W.settings.pad[a] : '-'}`, act:() => UI.startCapture(a) })),
    { label:() => 'Reset to defaults', act:() => { W.settings.keys = JSON.parse(JSON.stringify(W.DEFAULT_KEYS)); W.settings.pad = JSON.parse(JSON.stringify(W.DEFAULT_PAD)); W.saveSettings(); } }, { label:() => 'Back', act:() => UI.pop() }] });
UI.assistMenu = () => ({ title:'Assist Mode', hint:'Make the game easier. Nothing here is a penalty.',
  items:[opt('Damage taken', () => W.settings.assist.dmg, v => W.settings.assist.dmg = v, [1, .5, .25, 0], v => v * 100 + '%'), onoff('Infinite hearts', () => W.settings.assist.infinite, v => W.settings.assist.infinite = v),
    opt('Game speed', () => W.settings.assist.speed, v => W.settings.assist.speed = v, [1, .8, .65, .5], v => v * 100 + '%'), onoff('Auto-aim', () => W.settings.assist.autoaim, v => W.settings.assist.autoaim = v),
    holdTog('Run', 'run'), holdTog('Aim', 'aim'), holdTog('Crouch / Roll', 'crouch'), holdTog('Shoot / charge', 'shoot'), { label:() => 'Back', act:() => UI.pop() }] });
UI.accessMenu = () => ({ title:'Accessibility', items:[onoff('High contrast', () => W.settings.hc, v => W.settings.hc = v), onoff('Colour-blind labels on symbols', () => W.settings.cbs, v => W.settings.cbs = v),
  opt('Screen shake', () => W.settings.shake, v => W.settings.shake = v, [1, .5, 0], v => v === 1 ? 'Full' : v ? 'Half' : 'Off'), opt('Flashes', () => W.settings.flash, v => W.settings.flash = v, [true, false], v => v ? 'Normal' : 'Reduced'),
  opt('Text size', () => W.settings.text, v => W.settings.text = v, [1, 1.25, 1.5], v => v * 100 + '%'), { label:() => 'Back', act:() => UI.pop() }] });
UI.optionsMenu = () => ({ title:'Options', items:[vol('music'), vol('sfx'), vol('voice'),
  opt('Controls / UI', () => W.settings.ui, v => W.settings.ui = v, ['auto', 'desktop', 'touchR', 'touchL', 'touchC'], v => ({ auto:'Auto-detect', desktop:'Keyboard / gamepad', touchR:'Touch (right-handed)', touchL:'Touch (left-handed)', touchC:'Touch (compact)' })[v]),
  opt('See through blockers', () => W.settings.seeThrough !== false, v => W.settings.seeThrough = v, [true, false], v => v ? 'On' : 'Off'),
  opt('Graphics', () => W.settings.quality, v => W.settings.quality = v, ['auto', 'low', 'med', 'high'], v => ({ auto:'Auto', low:'Low (phones)', med:'Medium', high:'High (glow)' })[v]),
  opt('Mini map', () => W.settings.minimap, v => W.settings.minimap = v, ['tr', 'tl', 'off'], v => ({ tr:'Top right', tl:'Top left', off:'Off' })[v]),
  opt('Mini map size', () => W.settings.mapSize, v => W.settings.mapSize = v, [.8, 1, 1.4], v => v === 1 ? 'Normal' : v < 1 ? 'Small' : 'Large'),
  opt('HUD size', () => W.settings.hudScale, v => W.settings.hudScale = v, [.8, 1, 1.25, 1.5], v => v * 100 + '%'),
  opt('Bit chatter', () => W.settings.bitChat, v => W.settings.bitChat = v, ['chatty', 'helpful', 'quiet'], v => ({ chatty:'Chatty + snarky', helpful:'Helpful only', quiet:'Quiet (hints on request)' })[v]),
  { label:() => 'Assist Mode…', act:() => UI.push(UI.assistMenu()) }, { label:() => 'Accessibility…', act:() => UI.push(UI.accessMenu()) }, { label:() => 'Controls remap…', act:() => UI.push(UI.controlsMenu()) }, { label:() => 'Back', act:() => UI.pop() }] });

/* ---------- pause menu & sub screens ---------- */
UI.openPause = () => {
  const S = W.S, boss = W.Actors.boss && W.Actors.boss.state !== 'wait' && W.Actors.boss.alive;
  UI.push({ title:'Paused', back:true, onBack:() => {}, items:[
    { label:() => 'Resume', act:() => UI.closeAll() }, { label:() => 'Map', act:() => UI.openMap() }, { label:() => 'Journal', act:() => UI.push(UI.journal()) },
    { label:() => 'Badges', act:() => UI.push(UI.badges()) }, { label:() => 'Wardrobe', act:() => UI.push(UI.wardrobe()) }, { label:() => 'Photo Mode', act:() => UI.photo() },
    { label:() => 'Options', act:() => UI.push(UI.optionsMenu()) }, { label:() => 'Ask Bit for a hint', act:() => { S.hint = Math.min(2, S.hint + 1); UI.push(UI.journal()); } },
    ...(boss && (W.settings.assist.dmg < 1 || W.settings.assist.infinite) ? [{ label:() => 'Assist: skip boss (smaller reward)', act:() => { W.Actors.boss.hp = 0; W.Actors.boss.state = 'dazed'; W.Actors.boss.defeat(); S.cores--; S.frags--; UI.closeAll(); } }] : []),
    { label:() => 'Save', act:() => { W.writeSave(S); UI.toast('Saved'); } }, { label:() => 'Quit to title', act:() => { W.writeSave(S); W.toTitle(); } }] });
};
UI.journal = () => ({ title:'Journal', note:() => {
  const S = W.S, h = W.hintFor(S), ab = W.ORDER.map(k => `${W.has(k) ? '✔' : '✘'} ${W.ABILITIES[k].name}`).join(' · ');
  const lv = ['Nudge', 'Direction', 'Solution'];
  return `Abilities: ${ab}\nHeart Pearls ${W.pearls(S)} (hearts ${W.maxHearts(S)}/12) · Twist Seeds ${Object.keys(S.seeds).length}/6 · Fragments ${S.frags}/25 · Power Cores ${S.cores}\nDefeated ${S.kills} critters · Play time ${Math.floor(S.time / 60)} min\n\n◆ Bit's hint (${lv[S.hint]}): ${h[S.hint]}`; },
  items:[{ label:() => 'Ask Bit for a stronger hint', act:() => { W.S.hint = Math.min(2, W.S.hint + 1); } }, { label:() => 'Back', act:() => UI.pop() }] });
UI.badges = () => ({ title:'Badges (equip up to 3)', note:() => `Equipped ${W.S.equipped.length}/3. Buy more at Bitsy's Burrow with Twist Tokens.`, items:[...Object.keys(W.BADGES).map(k => ({ label:() => (W.S.badges[k] ? (W.S.equipped.includes(k) ? '[x] ' : '[ ] ') : '[?] ') + W.BADGES[k].name, val:() => W.S.badges[k] ? W.BADGES[k].desc : 'Not owned',
  act:() => { const S = W.S; if (!S.badges[k]) return; const i = S.equipped.indexOf(k); if (i >= 0) S.equipped.splice(i, 1); else if (S.equipped.length < 3) S.equipped.push(k); } })), { label:() => 'Back', act:() => UI.pop() }] });
const hatOk = (S, k) => { const h = W.HATS[k]; return (!h.cost || S.unlocked['hat_' + k]) && (!h.need || (h.need === 'seeds1' && Object.keys(S.seeds).length >= 1) || (h.need === 'boss' && S.boss) || (h.need === 'pick' && S.weapons.pick) || (h.need === 'bubble' && S.abilities.bubble) || (h.need === 'mini' && S.mini) || (h.need === 'bossK' && S.bossK)); };
const capeOk = (S, k) => !W.CAPES[k].cost || S.unlocked['cape_' + k];
const cycleSel = (arr, cur, dir, ok) => { let i = arr.indexOf(cur); for (let n = 0; n < arr.length; n++) { i = (i + dir + arr.length) % arr.length; if (ok(arr[i])) return arr[i]; } return cur; };
UI.wardrobe = () => {
  const S = W.S, upd = () => { W.buildHero(); W.hudPing(); };
  const hats = Object.keys(W.HATS), capes = Object.keys(W.CAPES), idx = [0, 1, 2, 3, 4, 5, 6, 7];
  const row = (label, get, set, fmt, arr, ok) => ({ label:() => label, val:() => '◀ ' + fmt(get()) + ' ▶', left:() => { set(cycleSel(arr, get(), -1, ok)); upd(); }, right:() => { set(cycleSel(arr, get(), 1, ok)); upd(); }, act:() => { set(cycleSel(arr, get(), 1, ok)); upd(); } });
  return { title:'Wardrobe', note:() => 'Cosmetic only. Mix a hat, suit colour, trim colour and cape. Locked hats unlock through play or at Bitsy\'s Burrow.', items:[
    row('Hat', () => S.look.hat, v => S.look.hat = v, v => W.HATS[v].name + (hatOk(S, v) ? '' : ' 🔒'), hats, v => hatOk(S, v)),
    row('Suit colour', () => S.look.suit, v => S.look.suit = v, v => '#' + (v + 1), idx, () => true),
    row('Trim colour', () => S.look.trim, v => S.look.trim = v, v => '#' + (v + 1), idx, () => true),
    row('Cape', () => S.look.cape, v => S.look.cape = v, v => W.CAPES[v].name, capes, v => capeOk(S, v)),
    { label:() => 'Locked hats', val:() => hats.filter(h => !hatOk(S, h)).map(h => W.HATS[h].name + ': ' + (W.HATS[h].cost ? 'buy at the shop' : W.HATS[h].needText)).join(' · ') || 'All unlocked' },
    { label:() => 'Back', act:() => UI.pop() }] };
};
UI.tideMenu = () => {
  UI.push({ title:'The Tide Gate', note:() => 'A violet seal. It opens when the Twist Seed in this hall has finished its story.\nOr you can skip the story for 25 Twist Tokens (you have ' + W.S.tokens + ').', items:[
    { label:() => 'Pay 25 tokens and open', disabled:() => W.S.tokens < 25, act:() => { const S = W.S, R = W.world.room; S.tokens -= 25; S.open.b9W = true; for (const dr of R.def.doors) if (dr.locked === 'tide') R.carveDoor(dr); R.buildMesh(); W.sfx('fanfare'); W.writeSave(S); UI.closeAll(); UI.banner('Tide Gate open', 'You skipped the story. The way west is clear.', '#8a5cff'); } },
    { label:() => 'Not now', act:() => UI.pop() }] });
};
UI.openShop = () => {
  UI.push({ title:"Bitsy's Burrow", note:() => `Twist Tokens: ${W.S.tokens}`, items:[...Object.keys(W.BADGES).map(k => ({ label:() => W.BADGES[k].name + (W.S.badges[k] ? ' (owned)' : ''), val:() => W.S.badges[k] ? 'Owned' : W.BADGES[k].cost + ' tokens — ' + W.BADGES[k].desc,
    act:() => { const S = W.S, b = W.BADGES[k]; if (S.badges[k]) return; if (S.tokens >= b.cost) { S.tokens -= b.cost; S.badges[k] = true; if (S.equipped.length < 3) S.equipped.push(k); W.sfx('fanfare'); W.writeSave(S); } else { W.sfx('hurt'); } } })), ...Object.keys(W.HATS).filter(k => W.HATS[k].cost).map(k => ({ label:() => 'Hat: ' + W.HATS[k].name + (W.S.unlocked['hat_' + k] ? ' (owned)' : ''), val:() => W.S.unlocked['hat_' + k] ? 'Owned' : W.HATS[k].cost + ' tokens', act:() => buyCosmetic('hat_' + k, W.HATS[k].cost) })),
    ...Object.keys(W.CAPES).filter(k => W.CAPES[k].cost).map(k => ({ label:() => 'Cape: ' + W.CAPES[k].name + (W.S.unlocked['cape_' + k] ? ' (owned)' : ''), val:() => W.S.unlocked['cape_' + k] ? 'Owned' : W.CAPES[k].cost + ' tokens', act:() => buyCosmetic('cape_' + k, W.CAPES[k].cost) })),
    { label:() => 'Leave', act:() => UI.pop() }] });
};
function buyCosmetic(key, cost) { const S = W.S; if (S.unlocked[key]) return; if (S.tokens >= cost) { S.tokens -= cost; S.unlocked[key] = true; W.sfx('fanfare'); W.writeSave(S); } else W.sfx('hurt'); }

/* ---------- map ---------- */
UI.openMap = () => {
  const S = W.S, cw = 112, ch = 56, ox = 40, oy = 56, cur = { x:W.world.room.def.gx, y:W.world.room.def.gy };
  let cursor = { x:cur.x, y:cur.y };
  const byPos = {}; W.ROOMS.forEach(r => byPos[r.gx + ',' + r.gy] = r);
  const draw = canvas => {
    const g = canvas.getContext('2d'); g.clearRect(0, 0, canvas.width, canvas.height);
    g.fillStyle = '#fff'; g.font = 'bold 22px sans-serif'; g.fillText('World Map — Crash Hollow (top) · Brook Burrows (below)', 40, 34);
    for (const r of W.ROOMS) {
      const x = ox + r.gx * cw, y = oy + r.gy * ch, seen = S.visited[r.id], adj = r.doors.some(d => S.visited[d.to]);
      if (!seen && !adj) continue;
      g.fillStyle = seen ? (r.id === W.world.room.id ? '#5b4b8a' : r.theme === 'brook' ? '#1f4f7a' : '#3a3a6e') : 'rgba(255,255,255,.05)'; g.fillRect(x + 4, y + 4, cw - 8, ch - 8);
      g.strokeStyle = seen ? '#9fd8ff' : 'rgba(255,255,255,.3)'; g.setLineDash(seen ? [] : [4, 4]); g.lineWidth = 2; g.strokeRect(x + 4, y + 4, cw - 8, ch - 8); g.setLineDash([]);
      if (!seen) { g.fillStyle = 'rgba(255,255,255,.5)'; g.font = '20px sans-serif'; g.fillText('?', x + cw / 2 - 5, y + ch / 2 + 7); continue; }
      g.fillStyle = '#ffd23f'; for (const d of r.doors) { const t = W.ROOM_BY_ID[d.to]; const dx = t.gx - r.gx, dy = t.gy - r.gy; g.fillRect(x + cw / 2 - 6 + dx * (cw / 2 - 4), y + ch / 2 - 4 + dy * (ch / 2 - 4), 12, 8); }
      g.fillStyle = '#fff'; g.font = '10px sans-serif'; g.fillText(r.name, x + 8, y + 16);
      let gx = x + 12; for (const gt of r.gates || []) { const a = W.ABILITIES[gt.ability]; g.fillStyle = a ? a.color : '#c8a165'; g.beginPath(); g.arc(gx, y + ch - 12, 5, 0, 7); g.fill(); gx += 14; }
      for (const it of r.items || []) if (it.t === 'beacon') { g.fillStyle = S.beacons[it.id] ? '#6bffd4' : '#456'; g.fillRect(x + cw - 24, y + ch - 24, 12, 12); }
      if (r.boss) { g.fillStyle = '#ff6b6b'; g.font = 'bold 16px sans-serif'; g.fillText('☠', x + cw - 28, y + 38); }
      if (r.mini) { g.fillStyle = '#ffd23f'; g.font = 'bold 14px sans-serif'; g.fillText('☠', x + cw - 26, y + 36); }
      if (r.id === W.world.room.id) { g.fillStyle = '#ff5d73'; g.beginPath(); g.arc(x + cw - 20, y + 22, 6 + Math.sin(performance.now() / 200) * 2, 0, 7); g.fill(); }
      if (S.pins[r.id]) { g.fillStyle = '#ff7ad9'; g.fillText('⚑', x + 12, y + 44); }
    }
    g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(ox + cursor.x * cw, oy + cursor.y * ch, cw, ch);
    const rr = byPos[cursor.x + ',' + cursor.y];
    g.fillStyle = '#fff'; g.font = '16px sans-serif'; g.fillText(rr && S.visited[rr.id] ? rr.name : 'Unexplored', 40, oy + 6 * ch + 22);
    g.font = '14px sans-serif'; g.fillStyle = '#cfd8ff'; g.fillText('Move / tap: choose room · Confirm: pin · Alt (J/F/X): fast travel from a Beacon · Back: close', 40, oy + 6 * ch + 46);
    g.fillText('Gate colours: yellow=Double Hop · pink=Wall Kick · blue=Roll · orange=Spark Dash · cyan=Bubble Float · tan=Ground Pound   ◼ beacon   ☠ boss   ⚑ pin', 40, oy + 6 * ch + 66);
  };
  const pin = () => { const rr = byPos[cursor.x + ',' + cursor.y]; if (rr) { if (S.pins[rr.id]) delete S.pins[rr.id]; else S.pins[rr.id] = true; W.sfx('menu'); } };
  const travel = () => {
    const rr = byPos[cursor.x + ',' + cursor.y]; if (!rr) return;
    const here = W.world.items.find(i => i.t === 'beacon' && Math.hypot(i.x - W.player.x, i.z - W.player.z) < 5);
    const bit = (rr.items || []).find(i => i.t === 'beacon' && S.beacons[i.id]);
    if (!here) UI.toast('Fast travel works while standing at a Beacon.'); else if (!bit) UI.toast('Pick a room with a lit Beacon.');
    else { UI.closeAll(); W.sfx('beacon'); W.startTransition(() => { W.loadRoom(rr.id, null, { x:bit.x + 1.8, y:bit.y, z:bit.z }); }); }
  };
  UI.push({ custom:true, render:el => {
    el.innerHTML = '<div class="mapwrap"><canvas id="mapc" width="900" height="480"></canvas><div class="mapbtns"><button id="mpin">Pin room</button><button id="mtravel">Fast travel</button><button id="mclose">Close</button></div></div>'; draw($('mapc'));
    $('mapc').onclick = e => { const r = $('mapc').getBoundingClientRect(), x = (e.clientX - r.left) * 900 / r.width, y = (e.clientY - r.top) * 480 / r.height, cx = Math.floor((x - ox) / cw), cy = Math.floor((y - oy) / ch); if (cx >= 0 && cx <= 6 && cy >= 0 && cy <= 5) { cursor = { x:cx, y:cy }; draw($('mapc')); } };
    $('mpin').onclick = () => { pin(); draw($('mapc')); }; $('mtravel').onclick = travel; $('mclose').onclick = () => UI.pop();
  }, update:nav => {
    if (nav.left) cursor.x = Math.max(0, cursor.x - 1); if (nav.right) cursor.x = Math.min(6, cursor.x + 1); if (nav.up) cursor.y = Math.max(0, cursor.y - 1); if (nav.down) cursor.y = Math.min(5, cursor.y + 1);
    if (nav.ok) pin(); if (nav.alt) travel(); if (nav.back) UI.pop();
    const c = $('mapc'); c && draw(c);
  } });
  W.state = 'menu';
};
UI.photo = () => {
  UI.closeAll(); W.state = 'photo'; $('minimapbox') && ($('minimapbox').style.display = 'none'); $('hud').style.display = 'none'; $('photo').style.display = 'block'; W.menuFrom = 'play';
};
UI.endPhoto = () => { $('photo').style.display = 'none'; $('hud').style.display = ''; W.state = 'play'; };
UI.snap = () => { W.renderer.render(W.scene, W.camera); W.renderer.domElement.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'wonderdeep-photo.png'; a.click(); }); UI.toast('Photo saved'); };

/* ---------- title / slots ---------- */
UI.title = () => {
  UI.closeAll(); W.state = 'title'; W.menuFrom = 'title';
  const slots = W.saveList();
  UI.push({ title:'WONDERDEEP', note:() => 'Nova and Bit explore Crash Hollow — a 3D voxel metroidvania (first playable)\nControls: WASD move · Space jump · Shift run · J shoot · K bonk · C crouch/roll · R ability wheel · F burst · M map · Esc menu', back:false,
    items:[...[0, 1, 2].map(i => ({ label:() => `Slot ${i + 1}: ` + (W.saveList()[i] ? `${W.pearls(W.saveList()[i])} pearls · ${Object.keys(W.saveList()[i].abilities).length}/5 abilities · ${Math.floor(W.saveList()[i].time / 60)} min` : 'New Game'),
      act:() => { const sv = W.saveList()[i]; W.startGame(sv ? Object.assign(W.newSave(i), sv) : W.newSave(i)); } })),
      { label:() => 'Delete a slot…', act:() => UI.push({ title:'Delete which slot?', items:[...[0, 1, 2].map(i => ({ label:() => 'Delete slot ' + (i + 1), disabled:() => !W.saveList()[i], act:() => { W.deleteSave(i); UI.pop(); UI.title(); } })), { label:() => 'Back', act:() => UI.pop() }] }) },
      { label:() => 'Options', act:() => UI.push(UI.optionsMenu()) }] });
};
})(window.W);
