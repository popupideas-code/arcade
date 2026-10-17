'use strict';
(function (W) {
const THREE = window.THREE;
const B = W.bit = { cd:{}, last:{}, idle:0, roomT:0, hintStage:0, scanCd:0, zapCd:3, markers:[], objective:null, ring:null };

/* ---------- body ---------- */
const g = B.group = new THREE.Group(), core = W.box(.36, .36, .36, 0xeeeeee), eye = W.box(.22, .13, .05, 0x00e5ff, 0, 0, .19);
eye.material.emissive = new THREE.Color(0x00e5ff);
g.add(core, eye, W.box(.5, .05, .12, 0xbfe9ff, 0, .12, 0), W.box(.06, .22, .06, 0xffffff, 0, .28, 0));
const tip = W.box(.1, .1, .1, 0xffe66d, 0, .42, 0); tip.material.emissive = new THREE.Color(0xaa8800); g.add(tip);
W.outline(g, 0x1c1740, 1.2); W.scene.add(g);
const pl = new THREE.PointLight(0x7df9ff, .5, 6); g.add(pl);
B.pos = new THREE.Vector3(); B.mood = 'calm';
const MOODS = { calm:0x00e5ff, warn:0xffd23f, angry:0xff4d4d, happy:0xff9ad8, scan:0xffffff };

/* ---------- lines: [group, text...]. snark lines are skipped when chatter is "helpful" ---------- */
const L = {
  start:{ f:'help', t:["Hi Nova! I'm Bit, your guide. Mostly guide. Grab the Pulse Blaster by the beacon, and press B any time for a scan."] },
  blaster:{ f:'help', t:["Pulse Blaster acquired. Tap Shoot, or hold to charge a wave. Try not to shoot me."] },
  pick:{ f:'help', t:["A pick axe! Hold the ability wheel, choose Pick Axe, then Bonk brown rock. Gold ore pays tokens."] },
  ab_hop:{ f:'help', t:["Double Hop! Jump, then jump again in mid-air. Those high ledges are suddenly much less smug."] },
  ab_roll:{ f:'help', t:["Roll Ball! Press Crouch to curl up. Tunnels are your friends now. Also your enemies, depending on spikes."] },
  ab_kick:{ f:'help', t:["Wall Kick! Touch a wall in mid-air, then jump to kick off. Chimneys are basically stairs now."] },
  ab_dash:{ f:'help', t:["Spark Dash! Pick it on the ability wheel, then press Run. It smashes orange blocks. Subtle, it's not."] },
  hurt:{ f:'snark', t:["Ouch. That looked expensive.", "I'd say 'watch out', but that would be after the fact.", "Hearts are a limited resource, you know.", "Fun fact: dodging is free."] },
  hurt2:{ f:'help', t:["Enemies flash and rear back before they strike. Use that moment to move!", "Stomp the slimes from above, or charge a wave to hit several at once."] },
  die:{ f:'snark', t:["And that is why Beacons exist.", "Back to the Beacon. Nothing lost but dignity.", "On the bright side, you can't die twice in the same place. Probably."] },
  fall:{ f:'snark', t:["The floor is down there. You're welcome for the update.", "Gravity: still working.", "That was a jump. Technically."] },
  spikes:{ f:'snark', t:["Spikes. Pointy. Avoid the pointy.", "They go in and out on a rhythm. Learn the rhythm."] },
  dart:{ f:'snark', t:["That wall is shooting at you. Rude wall.", "Darts! Listen for the warning click and move."] },
  pearl:{ f:'help', t:["Heart Pearl! Every four gives you another heart.", "Shiny! Four of those and you get a bigger heart."] },
  token:{ f:'snark', t:["Twist Tokens. Spend them at Bitsy's Burrow. She does not give discounts."] },
  kill:{ f:'snark', t:["Squish. Efficient.", "That one had a family. Probably.", "You're getting good at this."] },
  idle:{ f:'snark', t:["Are we waiting for something? I can hum.", "Take your time. I'm only a floating cube with infinite patience.", "I could scan, if you press B. Just saying."] },
  stuck1:{ f:'hint', t:[] }, stuck2:{ f:'hint', t:[] },
  mine:{ f:'snark', t:["Vandalism! I approve.", "That wall never saw it coming."] },
  gate_hop:{ f:'help', t:["Yellow arrows. That's the Double Hop sign. You need the extra jump."] },
  gate_kick:{ f:'help', t:["Pink chevrons mean Wall Kick. Slick walls are meant for bouncing between."] },
  gate_roll:{ f:'help', t:["Blue ball sign: a tunnel only a ball can enter. Crouch to curl up."] },
  gate_dash:{ f:'help', t:["Orange bolt means Spark Dash. Select it on the wheel and press Run into the cracks."] },
  gate_pound:{ f:'help', t:["Cracked brown floor. Jump, then press Crouch / Down to ground pound it."] },
  lowhp:{ f:'snark', t:["One heart left. Bold strategy.", "Maybe find a Beacon? They heal you."] },
  twist:{ f:'help', t:["A Twist Seed! The room's rules are about to change. Enjoy the weirdness."] },
  twistEnd:{ f:'snark', t:["Back to normal. Mostly. I liked it better weird."] },
  boss1:{ f:'help', t:["Old Mossback charges in straight lines. Let him bonk a wall, then hit him while he's dazed!"] },
  e_r1:{ f:'snark', t:["Hollow Landing. Cozy. Moist."] },
  e_r2:{ f:'help', t:["Mushroom Path. A running jump crosses the chasm. The shiny thing is on the mound."] },
  e_r3:{ f:'snark', t:["Glow Cavern. That north ledge is high. Two jumps' worth of high."] },
  e_r4:{ f:'help', t:["Tunnel Hall. A Beacon here, and a tunnel in the east wall that wants a ball."] },
  e_r5:{ f:'snark', t:["Ledge Nook. Suspiciously quiet."] },
  e_r6:{ f:'help', t:["Spore Shaft. Climb the pillars in a spiral. Falling is allowed, just not recommended."] },
  e_r7:{ f:'snark', t:["Pebble Burrow. Lots of pebbles. Few feelings."] },
  e_r8:{ f:'help', t:["Moss Cellar. That lilac-walled alcove looks weak. If only you were bigger."] },
  e_r9:{ f:'help', t:["Slick Chimney. Kick off one wall, then the other. Pinball, but you."] },
  e_r10:{ f:'help', t:["Spark Grotto. The orange wall to the south is the way to the boss."] },
  e_r11:{ f:'snark', t:["Bitsy sells badges. I'm told they're worth it. I get no commission."] },
  e_r12:{ f:'help', t:["Drip Gallery. Brown cracks hide something under the floor."] },
  e_r13:{ f:'snark', t:["Cracked Crossing. Don't trust the stepping stone. It'll crumble."] },
  e_r14:{ f:'help', t:["The Den. Whatever lives here is big. And grumpy."] },
  scan_none:{ f:'help', t:["Nothing hidden nearby. Try the next room!"] },
  zap:{ f:'help', t:["Zap! You're welcome."] },
  ab_bubble:{ f:'help', t:["Bubble Float! Hold Jump in the air after your last jump, or in water, to rise in a bubble. Updrafts carry you far."] },
  gate_bubble:{ f:'help', t:["Cyan bubble sign: that updraft only lifts a bubble. Jump, jump again, then hold Jump."] },
  slide:{ f:'snark', t:["Wheee. Try to steer. Jumping leaves the track.", "Gold rings! Collect them for style. And tokens on your first run."] },
  mimic:{ f:'snark', t:["That platform bit you. Platforms should not bite.", "Mimic! If it looks too convenient, it probably has teeth."] },
  reverse_fail:{ f:'snark', t:["The dark is hungry. Try again, faster.", "Run, don't browse."] },
  mini1:{ f:'help', t:["Shellbert rolls into walls. When he pops out dizzy, hit him! Pillars knock him silly faster."] },
  mini2:{ f:'help', t:["He's faster now and calls friends. Stay mobile!"] },
  mini3:{ f:'help', t:["Last stretch! One more big bonk."] },
  mini_hit:{ f:'help', t:["Dizzy! Shoot him, bonk him, or stomp his shell."] },
  queen1:{ f:'help', t:["Queen Bubblefin leaps where you stand. Move when the red ring appears, then hit her while she gasps!"] },
  queen2:{ f:'help', t:["The water rose and bubbles are flying. New updrafts appeared, use them!"] },
  queen3:{ f:'help', t:["Flooded! Use Bubble Float and the updrafts. One more big hit."] },
  e_b1:{ f:'help', t:["Brookside Landing. Beacon, shop and a hidden nook. Waterfalls look pretty from here."] },
  e_b2:{ f:'help', t:["Spillway. Swim by tapping Jump. The orb on the middle island is Bubble Float. Careful of platforms that bite."] },
  e_b3:{ f:'help', t:["Updraft Shaft. Ride the vent upward with a bubble to reach the high west door."] },
  e_b4:{ f:'help', t:["Reed Cavern. Rollers on the stairs, and a slide flume starting at the top. Roll into the entry ring."] },
  e_b5:{ f:'snark', t:["Kelp Gallery. That paper chamber looks flimsy. Do not touch. Or do."] },
  e_b6:{ f:'snark', t:["Pearl Grotto. A suspicious number of pearls. I'm not saying it's a trap."] },
  e_b7:{ f:'help', t:["Sluice. Take the slide from the high ledge, and the flooded tunnel needs a ball."] },
  e_b8:{ f:'snark', t:["Flooded Tunnels. Wet. Dark. Wet and dark."] },
  e_b9:{ f:'help', t:["Tide Hall. The violet gate opens after the seed's story. Or pay 25 tokens. Your call."] },
  e_b10:{ f:'help', t:["Whirl Cellar. A junction. The orange wall south hides the Bubble Vault."] },
  e_b11:{ f:'help', t:["Shellbert's Workshop. He's a big rolling shell. Hit him when he's dizzy."] },
  e_b12:{ f:'snark', t:["Bubble Vault. Shiny things. Mimics love shiny things."] },
  e_b13:{ f:'help', t:["The Queen's Lagoon. Big water, big fish. Watch for the red ring."] },
};
let lastKey = null;
B.say = function (key, force) {
  const S = W.S, set = L[key], mode = W.settings.bitChat; if (!set || !S || !set.t.length) return;
  if (!force) {
    if (mode === 'quiet') return; if (mode === 'helpful' && set.f === 'snark') return;
    const now = performance.now(); if (now - (B.lastSay || 0) < 7000 || (B.last[key] && now - B.last[key] < 30000)) return;
  }
  const line = set.t[Math.floor(Math.random() * set.t.length)]; B.last[key] = performance.now(); B.lastSay = performance.now(); lastKey = key;
  W.ui.bit(line); B.pulse = 1; B.mood = set.f === 'snark' ? 'warn' : 'calm'; B.moodT = 2.5;
};
B.onRoom = function (R) {
  B.roomT = 0; B.idle = 0; B.hintStage = 0; B.markers.forEach(m => m.parent && m.parent.remove(m)); B.markers = []; B.zapCd = 3; B.gateSeen = {};
  const S = W.S; if (!S.seenRooms) S.seenRooms = {}; const first = !S.seenRooms[R.id]; S.seenRooms[R.id] = true;
  if (first) setTimeout(() => W.state === 'play' && B.say('e_' + R.id, false), 1200);
  if (R.id === 'r1' && !S.weapons.blaster && !S.seenStart) { S.seenStart = true; setTimeout(() => B.say('start', true), 1500); }
};

/* ---------- objective + scan ---------- */
function objective(S) {
  if (!S.weapons.blaster) return { room:'r1', id:'blaster' };
  if (!S.abilities.hop) return { room:'r2', id:'hop' }; if (!S.abilities.roll) return { room:'r5', id:'roll' };
  if (!S.abilities.kick) return { room:'r7', id:'kick' }; if (!S.abilities.dash) return { room:'r10', id:'dash' };
  if (!S.boss) return { room:'r14', id:'boss' };
  if (!S.abilities.bubble) return { room:'b2', id:'bubble' };
  if (!S.mini) return { room:'b11', id:'mini' };
  if (!S.bossK) return { room:'b13', id:'queen' };
  for (const r of W.ROOMS) for (const it of r.items || []) if ((it.t === 'pearl' && !S.items[it.id]) || (it.t === 'seed' && !S.seeds[it.id])) return { room:r.id, id:it.id, x:it.x, y:it.y, z:it.z };
  return null;
}
function nextRoomToward(from, to) {
  if (from === to) return null; const prev = { [from]:null }, q = [from];
  while (q.length) { const c = q.shift(); for (const d of W.ROOM_BY_ID[c].doors) if (!(d.to in prev)) { prev[d.to] = { from:c, door:d }; q.push(d.to); } }
  if (!(to in prev)) return null; let cur = to; while (prev[cur].from !== from) cur = prev[cur].from; return prev[cur].door;
}
B.targetPoint = function () {
  const S = W.S, R = W.world.room, ob = objective(S); if (!ob) return null;
  if (ob.room === R.id) {
    if (ob.x != null) return { x:ob.x, y:ob.y, z:ob.z, label:'Secret' };
    const it = (R.def.items || []).find(i => i.id === ob.id); if (it) return { x:it.x, y:it.y, z:it.z, label:ob.id === 'blaster' ? 'Pulse Blaster' : (W.ABILITIES[ob.id] || { name:ob.id }).name };
    if (ob.id === 'boss') return { x:17, y:1, z:17, label:'Old Mossback' };
    if (ob.id === 'mini') return { x:17, y:1, z:17, label:'Shellbert' };
    if (ob.id === 'queen') return { x:20, y:3, z:20, label:'Queen Bubblefin' };
  }
  const door = nextRoomToward(R.id, ob.room); if (!door) return null; const c = R.doorCenter(door);
  const q = R.doorRect(door); const wx = door.dir === 'E' ? R.w - .5 : door.dir === 'W' ? .5 : c.x, wz = door.dir === 'N' ? .5 : door.dir === 'S' ? R.d - .5 : c.z;
  return { x:wx, y:q.y, z:wz, label:'Next: ' + W.ROOM_BY_ID[door.to].name };
};
B.scan = function () {
  if (W.state !== 'play' || B.scanCd > 0) return; B.scanCd = 6; B.scanT = 7; W.sfx('scan'); W.sfx('beacon', .4); B.pulse = 1; B.mood = 'scan'; B.moodT = 1.5;
  const R = W.world.room, S = W.S; B.markers.forEach(m => m.parent && m.parent.remove(m)); B.markers = [];
  let secrets = 0;
  for (const it of W.world.items) if (it.alive && ['pearl', 'token', 'seed', 'weapon', 'ability'].includes(it.t)) {
    const c = it.t === 'pearl' ? '#ff9ad8' : it.t === 'seed' ? '#b36bff' : it.t === 'token' ? '#ffd23f' : '#7df9ff'; secrets += it.t === 'pearl' || it.t === 'seed' ? 1 : 0;
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d'); x.strokeStyle = c; x.lineWidth = 6; x.beginPath(); x.arc(32, 32, 22, 0, 7); x.stroke(); x.fillStyle = c; x.beginPath(); x.moveTo(32, 54); x.lineTo(22, 40); x.lineTo(42, 40); x.fill();
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:new THREE.CanvasTexture(cv), depthTest:false, transparent:true })); sp.scale.set(1.5, 1.5, 1); sp.position.set(it.x, it.y + 1.4, it.z); sp.renderOrder = 10; W.world.group.add(sp); B.markers.push(sp);
  }
  const tp = B.targetPoint(); B.objective = tp; 
  if (secrets) W.ui.bit(`Scan: ${secrets} secret${secrets > 1 ? 's' : ''} nearby. Follow the markers!`); else if (!B.markers.length) B.say('scan_none', true); else W.ui.bit('Scan: items marked. The arrow shows where to go next.');
};

/* ---------- per-frame ---------- */
B.update = function (dt, t) {
  const P = W.player, S = W.S, R = W.world.room; if (!S || !R) return;
  B.scanCd -= dt; B.zapCd -= dt; B.roomT += dt; B.moodT -= dt; B.pulse = Math.max(0, (B.pulse || 0) - dt * 2);
  if (B.moodT <= 0) B.mood = 'calm';
  // follow with a lazy spring, orbit while scanning
  const yaw = P.face, scanning = B.scanT > 0; B.scanT -= dt;
  const ox = scanning ? Math.cos(t * 4) * 1.6 : -Math.cos(yaw) * .9 - Math.sin(yaw) * .8, oz = scanning ? Math.sin(t * 4) * 1.6 : Math.sin(yaw) * .9 - Math.cos(yaw) * .8;
  const gy = W.grav > 0 ? -1 : 1, want = new THREE.Vector3(P.x + ox, P.y + (W.grav > 0 ? P.h - 1.9 : 1.9) + Math.sin(t * 3) * .15 * gy + (scanning ? 1 : 0), P.z + oz);
  B.pos.lerp(want, 1 - Math.exp(-5 * dt)); if (B.pos.distanceTo(want) > 12) B.pos.copy(want);
  g.position.copy(B.pos); g.rotation.y = Math.atan2(P.x - B.pos.x, P.z - B.pos.z); g.scale.setScalar(W.giant ? 2.2 : 1 + (B.pulse || 0) * .35);
  eye.material.emissive.setHex(MOODS[B.mood] || MOODS.calm); eye.material.color.setHex(MOODS[B.mood] || MOODS.calm); pl.color.setHex(MOODS[B.mood] || MOODS.calm);
  tip.visible = !(P.inv > 0 && Math.floor(t * 14) % 2);
  // idle snark + stuck hints
  const moving = Math.hypot(P.vx, P.vz) > .5 || !P.ground; B.idle = moving ? 0 : B.idle + dt;
  if (B.idle > 25) { B.idle = -20; B.say('idle'); }
  if (W.state === 'play') {
    if (S.hearts === 1 && W.maxHearts(S) > 1 && !B.lowSaid) { B.lowSaid = true; B.say('lowhp'); } else if (S.hearts > 1) B.lowSaid = false;
    if (B.roomT > 70 && B.hintStage === 0 && W.settings.bitChat !== 'quiet') { B.hintStage = 1; W.ui.bit('Bit: Stuck? ' + W.hintFor(S)[0]); }
    else if (B.roomT > 150 && B.hintStage === 1 && W.settings.bitChat !== 'quiet') { B.hintStage = 2; W.ui.bit('Bit: ' + W.hintFor(S)[1]); }
    // gates: explain the symbol when you walk up to one you can't pass yet
    for (const gt of W.world.gates) {
      if (B.gateSeen[gt.ability]) continue; const need = gt.ability === 'pound' ? false : !S.abilities[gt.ability];
      if ((need || gt.ability === 'pound') && Math.hypot(P.x - gt.x, P.z - gt.z) < 7 && Math.abs(P.y - gt.y) < 7) { B.gateSeen[gt.ability] = true; B.say('gate_' + gt.ability); }
    }
    // zap: stun the enemy that is winding up to hit Nova
    if (B.zapCd <= 0) for (const e of W.Actors.enemies) if (e.alive && !e.parade && (e.state === 'warn' || e.state === 'attack') && Math.hypot(e.x - P.x, e.z - P.z) < 6) {
      e.stun = 1.1; e.state = 'recover'; e.tm = 1.1; B.zapCd = 6; W.sfx('zap'); B.mood = 'angry'; B.moodT = .8; B.pulse = 1;
      for (let i = 0; i <= 8; i++) W.sparkle(W.lerp(B.pos.x, e.x, i / 8), W.lerp(B.pos.y, e.y + .6, i / 8), W.lerp(B.pos.z, e.z, i / 8), 0x7df9ff, 1); if (Math.random() < .4) B.say('zap'); break;
    }
  }
  // scan markers pulse, then fade
  if (B.markers.length) { const k = Math.max(0, Math.min(1, B.scanT / 1.5 + .0)); B.markers.forEach((m, i) => { m.material.opacity = B.scanT > 0 ? 1 : 0; m.position.y += Math.sin(t * 6 + i) * .004; }); if (B.scanT <= 0) { B.markers.forEach(m => m.parent && m.parent.remove(m)); B.markers = []; } }
  W.ui.objective(B.scanT > 0 ? B.targetPoint() : null);
};
})(window.W);
