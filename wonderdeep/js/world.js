'use strict';
(function (W) {
const THREE = window.THREE, P = W.PAL;
W.isSolidKind = k => (k >= 1 && k <= 5) || (k >= 8 && k <= 11);   // 8 crumble, 9 mineable rock, 10 ore
const boxGeo = W.boxGeo = new THREE.BoxGeometry(1, 1, 1);
const mat = c => W.patchOcc ? W.patchOcc(new THREE.MeshLambertMaterial({ color:c })) : new THREE.MeshLambertMaterial({ color:c });
W.mat = mat;
W.box = (w, h, d, c, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(boxGeo, mat(c)); m.scale.set(w, h, d); m.position.set(x, y, z); m.castShadow = true; return m; };

/* ---------- gate / ability symbols (shape + colour, colour-blind safe) ---------- */
W.symbolCanvas = function (sym, color, size = 128, label) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), s = size, cx = s / 2;
  g.fillStyle = 'rgba(20,16,46,.82)'; g.beginPath(); g.arc(cx, cx, s * .46, 0, 7); g.fill();
  g.lineWidth = s * .05; g.strokeStyle = color; g.stroke();
  g.fillStyle = color; g.strokeStyle = color; g.lineCap = g.lineJoin = 'round'; g.lineWidth = s * .08;
  const chev = (x, y, w, up) => { g.beginPath(); g.moveTo(x - w, y + (up ? w * .6 : -w * .6)); g.lineTo(x, y + (up ? -w * .4 : w * .4)); g.lineTo(x + w, y + (up ? w * .6 : -w * .6)); g.stroke(); };
  if (sym === 'arrows') { chev(cx, s * .34, s * .2, true); chev(cx, s * .5, s * .2, true); chev(cx, s * .66, s * .2, true); }
  else if (sym === 'chevron') { g.beginPath(); g.moveTo(s * .46, s * .26); g.lineTo(s * .3, s * .5); g.lineTo(s * .46, s * .74); g.moveTo(s * .7, s * .26); g.lineTo(s * .54, s * .5); g.lineTo(s * .7, s * .74); g.stroke(); }
  else if (sym === 'ball') { g.beginPath(); g.arc(cx, cx, s * .22, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(cx - s * .08, cx - s * .08, s * .06, 0, 7); g.fill(); }
  else if (sym === 'bolt') { g.beginPath(); g.moveTo(s * .56, s * .18); g.lineTo(s * .32, s * .54); g.lineTo(s * .48, s * .54); g.lineTo(s * .42, s * .82); g.lineTo(s * .68, s * .44); g.lineTo(s * .52, s * .44); g.closePath(); g.fill(); }
  else if (sym === 'bubble') { g.beginPath(); g.arc(cx, cx, s * .26, 0, 7); g.stroke(); g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(cx - s * .1, cx - s * .1, s * .06, 0, 7); g.fill(); g.beginPath(); g.arc(cx + s * .22, cx - s * .24, s * .06, 0, 7); g.stroke(); }
  else if (sym === 'pick') { g.beginPath(); g.moveTo(s * .3, s * .72); g.lineTo(s * .66, s * .32); g.stroke(); g.beginPath(); g.moveTo(s * .4, s * .26); g.quadraticCurveTo(s * .62, s * .2, s * .78, s * .46); g.stroke(); }
  else if (sym === 'pound') { g.beginPath(); g.moveTo(cx, s * .24); g.lineTo(cx, s * .6); g.stroke(); chev(cx, s * .6, s * .18, false); g.fillRect(s * .3, s * .74, s * .4, s * .06); }
  if (label) { g.font = `bold ${s * .13}px sans-serif`; g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText(label, cx, s * .93); }
  return c;
};
const symTex = {};
function symbolSprite(key, scale) {
  const a = W.ABILITIES[key] || { sym:'pound', color:'#c8a165', name:'Ground Pound' };
  const ck = key + (W.settings.cbs ? 'L' : '');
  if (!symTex[ck]) symTex[ck] = new THREE.CanvasTexture(W.symbolCanvas(a.sym, a.color, 128, W.settings.cbs ? a.name.split(' ')[0].toUpperCase() : null));
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:symTex[ck], transparent:true, depthWrite:false }));
  sp.scale.set(scale, scale, 1);
  return sp;
}
W.symbolSprite = symbolSprite;

/* ---------- Room: dense voxel grid ---------- */
class Room {
  constructor(def) {
    this.def = def; this.id = def.id; this.w = def.w; this.h = def.h; this.d = def.d; this.fy = def.fy || 1;
    const n = this.w * this.h * this.d; this.k = new Uint8Array(n); this.c = new Uint32Array(n);
    this.dyn = []; this.dirty = false; this.group = new THREE.Group(); this.rand = W.rng(def.id.split('').reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7));
    this.locked = []; this.mesh = null; this.pal = W.THEMES[def.theme || 'hollow'];
  }
  ix(x, y, z) { return (y * this.d + z) * this.w + x; }
  inb(x, y, z) { return x >= 0 && x < this.w && y >= 0 && y < this.h && z >= 0 && z < this.d; }
  kindAt(x, y, z) { if (x < 0 || x >= this.w || z < 0 || z >= this.d || y >= this.h) return 4; if (y < 0) return 0; return this.k[this.ix(x, y, z)]; }
  solid(x, y, z) { return W.isSolidKind(this.kindAt(x, y, z)); }
  set(x, y, z, c, k = 1) { if (this.inb(x, y, z)) { const i = this.ix(x, y, z); this.k[i] = k; this.c[i] = c; this.dirty = true; } }
  fill(x, y, z, w, h, d, c, k = 1) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) for (let l = z; l < z + d; l++) this.set(i, j, l, c, k); }
  clear(x, y, z, w, h, d) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) for (let l = z; l < z + d; l++) this.set(i, j, l, 0, 0); }
  base(fy = this.fy) {
    this.fy = fy; const pl = this.pal;
    for (let x = 0; x < this.w; x++) for (let z = 0; z < this.d; z++) {
      for (let y = 0; y < fy; y++) this.set(x, y, z, y === fy - 1 ? (W.hash(x, 0, z) > .5 ? pl.top1 : pl.top2) : pl.dirt, 1);
      const edge = x === 0 || z === 0 || x === this.w - 1 || z === this.d - 1;
      if (edge) for (let y = fy; y < this.h; y++) this.set(x, y, z, W.hash(x, y, z) > .5 ? pl.wall : pl.wall2, 4);
      this.set(x, this.h - 1, z, W.hash(x, 9, z) > .5 ? pl.bedrock : pl.wall, 4);
    }
  }
  shrooms(n) {
    const r = this.rand, cols = this.pal.glow, nc = cols.length;
    for (let t = 0; t < n; t++) {
      let x = 2 + Math.floor(r() * (this.w - 4)), z = 2 + Math.floor(r() * (this.d - 4)); const hgt = 3 + Math.floor(r() * 3), c = cols[Math.floor(r() * nc)], fy = this.fy;
      if (r() < .5) x = r() < .5 ? 2 + Math.floor(r() * 2) : this.w - 4 + Math.floor(r() * 2); else z = r() < .5 ? 2 + Math.floor(r() * 2) : this.d - 4 + Math.floor(r() * 2);   // hug the walls so caps stay out of the camera's way
      if (this.kindAt(x, fy, z) || !this.solid(x, fy - 1, z)) continue;
      for (let y = 0; y < hgt; y++) this.set(x, fy + y, z, this.pal.stem, 7);
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if ((!dx || !dz) && !this.kindAt(x + dx, fy + hgt, z + dz)) this.set(x + dx, fy + hgt, z + dz, c, 6);
    }
    for (let t = 0; t < 10; t++) {   // stalactites
      const x = 2 + Math.floor(r() * (this.w - 4)), z = 2 + Math.floor(r() * (this.d - 4)), len = 1 + Math.floor(r() * 3);
      for (let y = 0; y < len; y++) if (!this.kindAt(x, this.h - 2 - y, z)) this.set(x, this.h - 2 - y, z, this.pal.stone2, 7);
    }
  }
  nook(x, y, z, w, h, d) { this.fill(x, y, z, w, h, d, P.rock, 9); this.clear(x + 1, y, z + 1, w - 2, h - 1, d - 2); }
  doorRect(dr) {
    const w = dr.w || 4, h = dr.h || 4, y = dr.y != null ? dr.y : this.fy, horiz = dr.dir === 'E' || dr.dir === 'W';
    const at = dr.at != null ? dr.at : Math.floor((horiz ? this.d : this.w) / 2), a0 = at - Math.floor(w / 2);
    return { a0, w, h, y, horiz };
  }
  carveDoor(dr) {
    const q = this.doorRect(dr);
    for (let a = q.a0; a < q.a0 + q.w; a++) for (let y = q.y; y < q.y + q.h; y++) {
      if (dr.dir === 'E') this.set(this.w - 1, y, a, 0, 0); else if (dr.dir === 'W') this.set(0, y, a, 0, 0);
      else if (dr.dir === 'N') this.set(a, y, 0, 0, 0); else this.set(a, y, this.d - 1, 0, 0);
    }
  }
  doorCenter(dr) { // arrival position inside this room for a door
    const q = this.doorRect(dr), along = q.a0 + q.w / 2, inset = 1.7;
    if (dr.dir === 'E') return { x:this.w - 1 - inset, z:along, y:q.y };
    if (dr.dir === 'W') return { x:1 + inset, z:along, y:q.y };
    if (dr.dir === 'N') return { x:along, z:1 + inset, y:q.y };
    return { x:along, z:this.d - 1 - inset, y:q.y };
  }
  hitBox(x, y, z, hw, h, sm, hd) {
    const e = 1e-4, hz = hd == null ? hw : hd;
    for (let i = Math.floor(x - hw); i <= Math.floor(x + hw - e); i++)
      for (let j = Math.floor(y); j <= Math.floor(y + h - e); j++)
        for (let k = Math.floor(z - hz); k <= Math.floor(z + hz - e); k++) {
          const kd = this.kindAt(i, j, k);
          if (!W.isSolidKind(kd) || (kd === 11 && W.ghost)) continue;
          if (sm !== undefined && kd !== 4 && j >= sm) continue;
          return true;
        }
    for (const b of this.dyn) if (Math.abs(x - b.x) < hw + b.hx && Math.abs(z - b.z) < hz + b.hz && y < b.y + b.hy && y + h > b.y) return true;
    return false;
  }
  smash(x, y, z, hw, h, sm) {
    let n = 0;
    for (let i = Math.floor(x - hw - .1); i <= Math.floor(x + hw + .1); i++)
      for (let j = Math.max(sm, Math.floor(y)); j <= Math.floor(y + h); j++)
        for (let k = Math.floor(z - hw - .1); k <= Math.floor(z + hw + .1); k++) {
          const kd = this.kindAt(i, j, k);
          if (W.isSolidKind(kd) && kd !== 4 && this.inb(i, j, k)) { W.debris(i + .5, j + .5, k + .5, this.c[this.ix(i, j, k)]); this.set(i, j, k, 0, 0); n++; }
        }
    return n;
  }
  // break marked blocks (kind 2 dash / 3 pound) near a point; persists
  breakNear(x, y, z, r, kinds, ry = r) {
    let n = 0;
    for (let i = Math.floor(x - r); i <= Math.floor(x + r); i++) for (let j = Math.floor(y - ry); j <= Math.floor(y + ry); j++) for (let k = Math.floor(z - r); k <= Math.floor(z + r); k++) {
      const kd = this.kindAt(i, j, k);
      if (kinds.includes(kd) && this.inb(i, j, k)) {
        W.debris(i + .5, j + .5, k + .5, this.c[this.ix(i, j, k)]); this.set(i, j, k, 0, 0); n++;
        const b = W.S.broken[this.id] = W.S.broken[this.id] || []; b.push([i, j, k]);
      }
    }
    return n;
  }
  rayFree(ax, ay, az, bx, by, bz) { // camera clipping: returns fraction of the segment that is free
    const n = 24;
    for (let s = 1; s <= n; s++) { const t = s / n; if (this.solid(Math.floor(ax + (bx - ax) * t), Math.floor(ay + (by - ay) * t), Math.floor(az + (bz - az) * t))) return Math.max(0, (s - 1) / n); }
    return 1;
  }
  buildMesh() {
    if (this.mesh) { this.group.remove(this.mesh); this.mesh.children.forEach(m => m.dispose && m.dispose()); }
    const lam = [], bas = [], w = this.w, h = this.h, d = this.d, k = this.k, so = (x, y, z) => this.solid(x, y, z);
    for (let y = 0; y < h; y++) for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) {
      const kd = k[(y * d + z) * w + x]; if (!kd) continue;
      if (kd === 6 || kd === 10) bas.push(x, y, z);
      else if (kd === 7 || !(so(x + 1, y, z) && so(x - 1, y, z) && so(x, y + 1, z) && so(x, y - 1, z) && so(x, y, z + 1) && so(x, y, z - 1))) lam.push(x, y, z);
    }
    const g = new THREE.Group(), m = new THREE.Matrix4(), col = new THREE.Color();
    const make = (list, material, shadow) => {
      const im = new THREE.InstancedMesh(boxGeo, material, list.length / 3);
      for (let i = 0; i < list.length; i += 3) {
        const x = list[i], y = list[i + 1], z = list[i + 2], kd = k[(y * d + z) * w + x];
        m.setPosition(x + .5, y + .5, z + .5); im.setMatrixAt(i / 3, m);
        let f = 0.9 + W.hash(x, y, z) * 0.2;
        if (kd === 2 || kd === 3 || kd === 8) f *= ((x + y + z) & 1) ? 0.72 : 1.1;
        if (kd === 9) f *= (W.hash(x, z, y) > .6) ? .7 : 1.05;
        col.setHex(this.c[(y * d + z) * w + x]).multiplyScalar(f); im.setColorAt(i / 3, col);
      }
      im.castShadow = shadow; im.receiveShadow = shadow; g.add(im);
    };
    make(lam, W.patchOcc(new THREE.MeshLambertMaterial()), true);
    make(bas, W.patchOcc(new THREE.MeshBasicMaterial({ transparent:true, opacity:.5 })), false);
    this.mesh = g; this.group.add(g); this.dirty = false; this.ver = (this.ver || 0) + 1;
  }
  lockDoor(dr) {
    const q = this.doorRect(dr), col = dr.locked === 'tide' ? W.PAL.tide : P.gate;
    for (let a = q.a0; a < q.a0 + q.w; a++) for (let y = q.y; y < q.y + q.h; y++) {
      const x = dr.dir === 'E' ? this.w - 1 : dr.dir === 'W' ? 0 : a, z = dr.dir === 'N' ? 0 : dr.dir === 'S' ? this.d - 1 : a; this.set(x, y, z, col, 4);
    }
  }
  lockDoors(on) {
    for (const dr of this.def.doors) {
      const q = this.doorRect(dr);
      for (let a = q.a0; a < q.a0 + q.w; a++) for (let y = q.y; y < q.y + q.h; y++) {
        const x = dr.dir === 'E' ? this.w - 1 : dr.dir === 'W' ? 0 : a, z = dr.dir === 'N' ? 0 : dr.dir === 'S' ? this.d - 1 : a;
        if (on) this.set(x, y, z, P.gate, 4); else this.set(x, y, z, 0, 0);
      }
    }
  }
}
W.Room = Room;

/* ---------- world / room loading ---------- */
const W_ = W.world = { room:null, items:[], signs:[], gates:[], group:new THREE.Group() };
W.scene.add(W_.group);

W.doorOpen = dr => { const S = W.S; return dr.locked === 'boss' ? !!S.boss : dr.locked === 'mini' ? !!S.mini : dr.locked === 'tide' ? !!S.open.b9W : true; };
W.loadRoom = function (id, arriveDoor, spawnPos) {
  const S = W.S, def = W.ROOM_BY_ID[id];
  if (W.twist && W.twist.active) W.twist.cancel();
  if (W_.room) W_.group.remove(W_.room.group);
  W_.group.clear(); W_.items = []; W_.signs = []; W_.gates = [];
  const R = new Room(def); def.build(R);
  for (const dr of def.doors) R.carveDoor(dr);
  S.open = S.open || {};
  if (arriveDoor && arriveDoor.locked === 'tide') S.open.b9W = true;
  for (const dr of def.doors) if (dr.locked && !W.doorOpen(dr)) R.lockDoor(dr);
  for (const s of def.seal || []) {                       // coming through a sealed door from the far side opens the shortcut for good
    if (arriveDoor && arriveDoor.dir === s.door) S.open[id + s.door] = true;
    if (!S.open[id + s.door]) R.fill(s.x, s.y, s.z, s.w, s.h, s.d, P.crackDash, 2);
  }
  for (const b of S.broken[id] || []) R.set(b[0], b[1], b[2], 0, 0);
  R.buildMesh(); W_.room = R; W_.group.add(R.group);
  S.visited[id] = true; S.room = id;
  // lighting + fog
  W.scene.background = new THREE.Color(R.pal.bg); W.scene.fog = new THREE.Fog(R.pal.bg, 26, 78);
  W.sun.position.set(R.w * .5 + 12, R.h + 8, R.d * .5 + 10); W.sun.target.position.set(R.w * .5, 0, R.d * .5);
  const sc = W.sun.shadow.camera, ext = Math.max(R.w, R.d) * .75;
  sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = R.h + 70; sc.updateProjectionMatrix();
  // gates (sign boards)
  for (const g of def.gates || []) { const sp = symbolSprite(g.ability, 1.7); sp.position.set(g.x, g.y, g.z); W_.group.add(sp); W_.gates.push({ sp, ...g }); }
  // signs
  for (const sg of def.signs || []) {
    const m = new THREE.Group(); m.add(W.box(.2, 1.1, .2, 0x8a5a36, 0, .55, 0), W.box(1, .6, .15, 0xf3e9d2, 0, 1.2, 0));
    const y = R.fy; m.position.set(sg.x, y, sg.z); W_.group.add(m); W_.signs.push({ ...sg, shown:false });
  }
  // items
  for (const it of def.items || []) {
    if ((it.t === 'weapon' && S.weapons[it.id]) || (it.t === 'ability' && S.abilities[it.id]) || (['pearl', 'token', 'core'].includes(it.t) && S.items[it.id]) || (it.t === 'seed' && S.seeds[it.id])) continue;
    W_.items.push(new W.Item(it));
  }
  W.Actors.populate(R);
  W.Traps.populate(R);
  W.Water.populate(R);
  W.Slide.populate(R);
  W.Visuals.decorate(R);
  W.bit.onRoom(R);
  if (def.boss) W.boss.setup(R);
  if (def.mini) W.boss.setupMini(R);
  if (def.boss2) W.boss.setupQueen(R);
  // place player
  const P1 = W.player;
  if (spawnPos) P1.place(spawnPos.x, spawnPos.y, spawnPos.z);
  else if (arriveDoor) { const c = R.doorCenter(arriveDoor); P1.place(c.x, c.y, c.z); P1.fitToSpace(); }
  else P1.place(def.spawn[0], R.fy, def.spawn[1]);
  P1.roomEntry = { x:P1.x, y:P1.y, z:P1.z };
  W.snapCamera();
  if (W.ui) W.ui.roomName(def.name);
  W.music.setStyle(def.boss && !S.boss ? 'boss' : 'cave');
  W.music.layers = Math.min(4, 1 + Math.floor(Object.keys(S.visited).length / 3));
};

/* ---------- items ---------- */
class Item {
  constructor(def) {
    this.def = def; this.t = def.t; this.id = def.id; this.x = def.x; this.y = def.y; this.z = def.z; this.alive = true; this.t0 = Math.random() * 6;
    const g = this.mesh = new THREE.Group();
    const a = W.ABILITIES[def.id];
    if (def.t === 'ability') { const c = parseInt(a.color.slice(1), 16); g.add(W.box(.9, .9, .9, c)); const sp = symbolSprite(def.id, 1.8); sp.position.y = 1.4; g.add(sp); g.children[0].material.emissive = new THREE.Color(c).multiplyScalar(.5); this.r = 1.4; }
    else if (def.t === 'pearl') { const m = W.box(.55, .55, .55, 0xfff0fa); m.material.emissive = new THREE.Color(0xff9ad8).multiplyScalar(.6); g.add(m, W.box(.9, .22, .22, 0xffc2ea), W.box(.22, .9, .22, 0xffc2ea)); this.r = 1.3; }
    else if (def.t === 'token') { const m = W.box(.5, .5, .12, 0xffd23f); m.material.emissive = new THREE.Color(0x805f00); g.add(m); this.r = 1.1; }
    else if (def.t === 'seed') { const m = W.box(.7, .7, .7, 0xb36bff); m.material.emissive = new THREE.Color(0x7a2cff).multiplyScalar(.8); g.add(m, W.box(.35, 1.1, .35, 0xe0b8ff)); this.r = 1.6; }
    else if (def.t === 'beacon') {
      g.add(W.box(.9, .5, .9, 0x6a5acd, 0, .25, 0)); this.crystal = W.box(.6, 1.6, .6, 0x6bffd4, 0, 1.4, 0); this.crystal.material.emissive = new THREE.Color(0x1a6a5a); g.add(this.crystal); this.r = 1.8;
      this.light = new THREE.PointLight(0x6bffd4, .0, 10); this.light.position.y = 2; g.add(this.light);
    } else if (def.t === 'core') { const m = W.box(.8, .8, .8, 0x7df9ff); m.material.emissive = new THREE.Color(0x2aa8c0); g.add(m, W.box(1.1, .12, 1.1, 0xffffff)); this.r = 1.5;
    } else if (def.t === 'weapon') {
      if (def.id === 'blaster') { const b = W.box(.9, .45, .45, 0x7df9ff); b.material.emissive = new THREE.Color(0x1a8a9a); g.add(b, W.box(.4, .6, .35, 0x3a3566, -.2, -.35, 0), W.box(.3, .3, .3, 0xffffff, .55, 0, 0)); }
      else { g.add(W.box(.15, 1.2, .15, 0x8a5a36, 0, 0, 0), W.box(1.0, .22, .22, 0xcfd3e8, 0, .55, 0), W.box(.22, .22, .22, 0xcfd3e8, .52, .42, 0), W.box(.22, .22, .22, 0xcfd3e8, -.52, .42, 0)); }
      this.r = 1.6;
    } else if (def.t === 'shop') { g.add(W.box(.9, .9, .9, 0xffb347, 0, .6, 0), W.box(.2, .2, .1, 0x222222, -.2, .8, .46), W.box(.2, .2, .1, 0x222222, .2, .8, .46), W.box(1.1, .2, 1.1, 0xff7ad9, 0, 1.2, 0)); this.r = 2.6; }
    g.position.set(this.x, this.y, this.z); W_.group.add(g);
    if (def.t !== 'beacon' && def.t !== 'shop') g.children.forEach(c => c.castShadow = false);
    if (def.t === 'weapon' || def.t === 'ability') { const l = new THREE.PointLight(def.t === 'ability' ? 0xffffff : 0x7df9ff, .6, 7); g.add(l); }
  }
  update(dt, time) {
    const P1 = W.player, m = this.mesh, dx = P1.x - this.x, dy = (P1.y + P1.h / 2) - this.y, dz = P1.z - this.z;
    if (this.t !== 'shop' && this.t !== 'beacon') { m.rotation.y = time * 2.4; m.position.y = this.y + Math.sin(time * 3 + this.t0) * .12; }
    if (this.t === 'beacon') {
      const on = W.S.beacons[this.id]; this.crystal.rotation.y = time; this.light.intensity = on ? 1.2 : .15;
      this.crystal.material.emissive.setHex(on ? 0x2affd0 : 0x113a33);
    }
    const dist = Math.hypot(dx, dy, dz), mag = (W.S.equipped.includes('magnet') ? 4 : 0) + (this.t === 'token' ? 3.5 : 0);
    if (['pearl', 'token', 'core'].includes(this.t) && dist < 4 + mag && dist > .6 && mag) { const k = Math.min(1, dt * 7); this.x -= dx * k; this.y -= dy * k * .6; this.z -= dz * k; }
    if (dist < this.r && W.state === 'play') this.touch();
  }
  touch() {
    const S = W.S, d = this.def, ui = W.ui;
    if (this.t === 'ability') {
      S.abilities[d.id] = true; S.wheel = d.id === 'hop' || d.id === 'kick' || d.id === 'bubble' ? S.wheel : d.id; this.remove(); W.sfx('fanfare'); W.sfx(d.id === 'hop' ? 'hop' : d.id === 'dash' ? 'dash' : d.id === 'roll' ? 'roll' : 'kick');
      const a = W.ABILITIES[d.id]; ui.banner('NEW ABILITY: ' + a.name, a.desc, a.color); W.bit.say('ab_' + d.id, true); W.writeAuto(); W.hudPing();
    } else if (this.t === 'pearl') {
      const old = W.maxHearts(S); S.items[d.id] = true; this.remove(); W.sfx('pearl'); W.bit.say('pearl');
      const mx = W.maxHearts(S); if (mx > old) { S.hearts = mx; ui.banner('Heart Pearls: +1 heart!', '4 pearls grant a new heart.', '#ff7ad9'); } else ui.toast(`Heart Pearl ${W.pearls(S) % 4 || 4}/4`);
      W.hudPing();
    } else if (this.t === 'token') { if (!d.temp) S.items[d.id] = true; S.tokens += 3; this.remove(); W.sfx('pickup'); ui.toast('+3 Twist Tokens'); W.bit.say('token'); }
    else if (this.t === 'beacon') {
      if (!S.beacons[d.id]) { S.beacons[d.id] = true; S.beacon = d.id; S.beaconRoom = W.world.room.id; S.hearts = W.maxHearts(S); S.burst = 3; W.sfx('beacon'); ui.banner('Beacon lit', 'Progress saved. Beacons work as fast-travel points on the map.', '#6bffd4'); W.writeAuto(); }
      else if (S.beaconRoom !== W.world.room.id || S.beacon !== d.id) { S.beacon = d.id; S.beaconRoom = W.world.room.id; }
      if (S.hearts < W.maxHearts(S)) { S.hearts = W.maxHearts(S); W.sfx('pickup'); W.hudPing(); }
    } else if (this.t === 'weapon') {
      S.weapons[d.id] = true; this.remove(); W.sfx('fanfare');
      if (d.id === 'blaster') { ui.banner('Pulse Blaster', 'Tap Shoot for pulses, hold to charge a wave.', '#7df9ff'); W.bit.say('blaster', true); }
      else { S.wheel = 'pick'; ui.banner('Pick Axe', 'Hold the ability wheel and choose Pick Axe, then press Bonk to mine brown rock and ore.', '#c8a165'); W.bit.say('pick', true); }
      W.writeAuto(); W.hudPing();
    } else if (this.t === 'core') { S.items[d.id] = true; S.cores++; this.remove(); W.sfx('fanfare'); ui.banner('Power Core', 'Your shots hit harder and charge faster.', '#7df9ff'); W.writeAuto(); W.hudPing();
    } else if (this.t === 'seed') { if (W.twist) W.twist.begin(d.ev, this); }
    else if (this.t === 'shop') { /* opened with Bonk */ }
  }
  remove() { this.alive = false; W_.group.remove(this.mesh); W.sparkle(this.x, this.y, this.z, 0xffffff, 10); }
}
W.Item = Item;

W.updateWorld = function (dt, time) {
  const R = W_.room; if (!R) return;
  for (const it of W_.items) if (it.alive) it.update(dt, time);
  W_.items = W_.items.filter(i => i.alive || i.t === 'shop');
  for (const g of W_.gates) g.sp.position.y = g.y + Math.sin(time * 2) * .08;
  W.Visuals.update(dt, time); W.Water.update(dt, time); W.Slide.update(dt, time);
  const P1 = W.player;
  for (const s of W_.signs) {
    const near = Math.hypot(P1.x - s.x, P1.z - s.z) < 3 && Math.abs(P1.y - R.fy) < 6;
    if (near && !s.shown) { s.shown = true; W.ui.bit('Bit: ' + s.text); } else if (!near) s.shown = false;
  }
  if (R.dirty) { R.dirtyT = (R.dirtyT || 0) + dt; if (R.dirtyT > 0.06 || !W.twist.active) { R.dirtyT = 0; R.buildMesh(); } }
};
W.writeAuto = () => { W.S.time = W.S.time; W.writeSave(W.S); };

/* ---------- door transitions (< 0.5 s) ---------- */
W.checkDoors = function () {
  const R = W_.room, P1 = W.player; if (!R || W.transition) return;
  for (const dr of R.def.doors) {
    const q = R.doorRect(dr); let along, inside;
    if (dr.dir === 'E') { along = P1.z; inside = P1.x > R.w - 1 + .3; } else if (dr.dir === 'W') { along = P1.z; inside = P1.x < .7; }
    else if (dr.dir === 'N') { along = P1.x; inside = P1.z < .7; } else { along = P1.x; inside = P1.z > R.d - 1 + .3; }
    if (inside && along > q.a0 - .2 && along < q.a0 + q.w + .2 && P1.y > q.y - .6 && P1.y < q.y + q.h) { W.goDoor(dr); return; }
  }
};
const OPP = { E:'W', W:'E', N:'S', S:'N' };
W.goDoor = function (dr) {
  const to = W.ROOM_BY_ID[dr.to], back = to.doors.find(d => d.dir === OPP[dr.dir] && d.to === W.world.room.id) || to.doors.find(d => d.to === W.world.room.id);
  W.sfx('door');
  W.startTransition(() => { W.loadRoom(dr.to, back); });
};
})(window.W);
