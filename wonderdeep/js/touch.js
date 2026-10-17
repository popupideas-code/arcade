'use strict';
(function (W) {
const $ = id => document.getElementById(id);
const coarse = () => (window.matchMedia && matchMedia('(pointer:coarse)').matches) || 'ontouchstart' in window || navigator.maxTouchPoints > 1;
const Tch = W.Touch = { layout:'R' };
const T = W.touch;
let stick = null, camId = null, camLast = null;

W.cycleAbility = function () {
  const un = W.ORDER.filter(W.has); if (!un.length) return;
  let i = un.indexOf(W.S.wheel); W.S.wheel = un[(i + 1) % un.length]; W.sfx('menu'); W.ui.toast('Ability: ' + W.ABILITIES[W.S.wheel].name); W.hudPing();
};

Tch.apply = function () {
  const m = W.settings.ui, on = m === 'auto' ? coarse() : m.startsWith('touch');
  W.isTouch = on; T.active = on; Tch.layout = m === 'touchL' ? 'L' : m === 'touchC' ? 'C' : 'R';
  const el = $('touch'); if (!el) return; el.style.display = on ? 'block' : 'none'; el.className = 'lay' + Tch.layout;
  document.body.classList.toggle('istouch', on);
};

function press(a, v) { if (a === 'tool') { if (v) W.cycleAbility(); return; } T.down[a] = v; }

function init() {
  const el = $('touch'); if (!el) return;
  el.addEventListener('pointerdown', e => {
    const b = e.target.closest && e.target.closest('.tb');
    if (b) { b.classList.add('on'); b.dataset.pid = e.pointerId; press(b.dataset.a, true); el.setPointerCapture && el.setPointerCapture(e.pointerId); e.preventDefault(); return; }
    const leftSide = Tch.layout === 'L' ? e.clientX > innerWidth * .5 : e.clientX < innerWidth * .5;
    if (leftSide && !stick) { stick = { id:e.pointerId, x:e.clientX, y:e.clientY }; const b_ = $('tbase'); b_.style.display = 'block'; b_.style.left = e.clientX + 'px'; b_.style.top = e.clientY + 'px'; $('tthumb').style.transform = ''; }
    else if (camId == null) { camId = e.pointerId; camLast = [e.clientX, e.clientY]; }
    el.setPointerCapture && el.setPointerCapture(e.pointerId); e.preventDefault();
  });
  el.addEventListener('pointermove', e => {
    if (stick && e.pointerId === stick.id) {
      const R = 46; let dx = e.clientX - stick.x, dy = e.clientY - stick.y; const l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; }
      T.ax = dx / R; T.ay = dy / R; const dz = .12; if (Math.hypot(T.ax, T.ay) < dz) T.ax = T.ay = 0; $('tthumb').style.transform = `translate(${dx}px,${dy}px)`;
    } else if (e.pointerId === camId) { T.cx += (e.clientX - camLast[0]) * .018; T.cy += (e.clientY - camLast[1]) * .014; camLast = [e.clientX, e.clientY]; }
  });
  const up = e => {
    document.querySelectorAll('.tb.on').forEach(b => { if (b.dataset.pid == e.pointerId) { b.classList.remove('on'); press(b.dataset.a, false); } });
    if (stick && e.pointerId === stick.id) { stick = null; T.ax = T.ay = 0; $('tbase').style.display = 'none'; }
    if (e.pointerId === camId) camId = null;
  };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  document.addEventListener('gesturestart', e => e.preventDefault()); document.addEventListener('dblclick', e => e.preventDefault());
  document.addEventListener('touchmove', e => { if (document.body.dataset.state === 'play') e.preventDefault(); }, { passive:false });
}
Tch.syncState = function () {
  const st = W.state; document.body.dataset.state = st;
  const ic = $('tooltxt'); if (ic && W.S) { const a = W.ABILITIES[W.S.wheel]; const t = a && W.has(W.S.wheel) ? a.name.split(' ')[0] : '—'; if (ic.textContent !== t) ic.textContent = t; }
};
init();
})(window.W);
