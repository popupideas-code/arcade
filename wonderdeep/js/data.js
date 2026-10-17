'use strict';
window.W = window.W || {};
(function (W) {
W.DT = 1 / 60;

/* ---------- abilities (the progress locks) ---------- */
W.ABILITIES = {
  hop:  { name:'Double Hop', color:'#ffd23f', sym:'arrows', desc:'One extra jump in mid-air. Opens high ledges and tall shafts.' },
  kick: { name:'Wall Kick',  color:'#ff5d73', sym:'chevron', desc:'Cling to a wall, then kick off it. Opens tall smooth walls.' },
  roll: { name:'Roll Ball',  color:'#4d8bff', sym:'ball',   desc:'Crouch to curl into a ball and roll through narrow tunnels.' },
  dash: { name:'Spark Dash', color:'#ff9f1c', sym:'bolt',   desc:'A burst of speed that breaks marked orange blocks.' },
};
W.ABILITIES.pick = { name:'Pick Axe', color:'#c8a165', sym:'pick', desc:'Mine brown rock walls and gold ore. Select it on the ability wheel, then press Bonk.', tool:true };
W.ORDER = ['hop', 'kick', 'roll', 'dash', 'pick'];

/* ---------- enemies: data driven ---------- */
W.ENEMIES = {
  waddler: { name:'Waddler', hp:3, speed:2.2, hw:.5, h:1.0, color:0x7ed957, belly:0xd6ffb0, warn:.5, dmg:1, sense:5.5 },
  floater: { name:'Floater', hp:2, speed:1.6, hw:.5, h:1.0, color:0xff8fd8, belly:0xffd1f0, warn:.55, dmg:1, sense:16, every:3.2 },
  chomper: { name:'Chomper', hp:4, speed:0,   hw:.6, h:1.0, color:0xff6b6b, belly:0xffe0a0, warn:.5, dmg:1, sense:4.8, every:2.6 },
};

W.BADGES = {
  magnet: { name:'Pearl Magnet', desc:'Pickups fly to you from farther away.', cost:15 },
  spring: { name:'Bouncy Boots', desc:'Jump buffer and ledge grace last 3 frames longer.', cost:20 },
  bonk:   { name:'Big Bonk', desc:'Spin Bonk reaches farther and hits harder.', cost:25 },
  charge: { name:'Quick Charge', desc:'Charged waves charge in half the time.', cost:25 },
  shell:  { name:'Cozy Shell', desc:'Longer invulnerability after a hit.', cost:30 },
};

W.OUTFITS = {
  nova: { name:'Nova Classic', body:0xe63946, cap:0xffd23f, need:null, needText:'Starting outfit' },
  sky:  { name:'Skyline',      body:0x2a9df4, cap:0xffffff, need:'seeds1', needText:'Collect 1 Twist Seed' },
  mint: { name:'Minty Fresh',  body:0x2ec4a0, cap:0xfff3a0, need:'seeds2', needText:'Collect 2 Twist Seeds' },
  gold: { name:'Mossback Pal', body:0x9b5de5, cap:0x7ed957, need:'boss', needText:'Beat Old Mossback' },
};

/* ---------- palette (Crash Hollow: mossy caves, glowing mushrooms) ---------- */
W.PAL = {
  wall:0x5b4b8a, wall2:0x6d5aa3, dirt:0x7a5a45, moss:0x88e05a, moss2:0x6fcf4a, stone:0xb3b8d9, stone2:0xa0a6cc,
  slick:0xb9f0ff, crackDash:0xff9f1c, crackPound:0xa8845a, brittle:0xd9a6ff, bedrock:0x3a3566,
  gcyan:0x6bffd4, gpink:0xff7ad9, gyellow:0xffe66d, stem:0xf3e9d2, ped:0xd9c7ff, gate:0x4a3d7a, rock:0xb08a5c, ore:0xffd23f, crumble:0xd8c08a,
};

/* ---------- biome themes ---------- */
W.THEMES = {
  hollow: { name:'Crash Hollow', bg:0x24204a, top1:W.PAL.moss, top2:W.PAL.moss2, dirt:W.PAL.dirt, wall:W.PAL.wall, wall2:W.PAL.wall2, bedrock:W.PAL.bedrock, stem:W.PAL.stem, glow:[W.PAL.gcyan, W.PAL.gpink, W.PAL.gyellow], stone:W.PAL.stone, stone2:W.PAL.stone2, murals:[0, 1, 2, 3, 4], spore:0xb8fff0 },
  brook:  { name:'Brook Burrows', bg:0x0f3a5c, top1:0x3ac7b8, top2:0x2fb0a6, dirt:0x1d5f7d, wall:0x23507f, wall2:0x2e6296, bedrock:0x143459, stem:0x2fa86b, glow:[0x7df9ff, 0xffe66d, 0xff9ad8, 0xb8ff8a], stone:0xbfd6e8, stone2:0x9fbdd6, murals:[5, 6, 7, 8, 9], spore:0xbff4ff },
};
W.PAL.paper = 0xf5f0e1; W.PAL.tide = 0x8a5cff;
W.ENEMIES.roller = { name:'Roller', hp:3, speed:3, hw:.55, h:1.1, color:0xc9a25f, belly:0xffe0a0, warn:.55, dmg:1, sense:12 };
W.ENEMIES.mimic = { name:'Mimic', hp:4, speed:2.6, hw:.9, h:1.0, color:0x9aa7c7, belly:0xffffff, warn:.5, dmg:1, sense:1.6 };
W.ABILITIES.bubble = { name:'Bubble Float', color:'#4de0ff', sym:'bubble', desc:'Hold Jump in the air (or in water) to float up inside a bubble. Rides updrafts.' };
W.ORDER = ['hop', 'kick', 'roll', 'dash', 'bubble', 'pick'];
Object.assign(W.BADGES, {
  fins:    { name:'Flippers', desc:'Swim faster and stroke higher.', cost:20 },
  slick:   { name:'Slick Shell', desc:'Slides keep more speed and boost pads hit harder.', cost:25 },
  lantern: { name:'Lantern', desc:'Bit shines brighter and scans reach farther.', cost:20 },
  heart:   { name:'Heart Charm', desc:'Beacons also refill your Twist Burst.', cost:30 },
  sprout:  { name:'Lucky Sprout', desc:'Enemies drop more tokens.', cost:25 },
});

/* ---------- rooms ---------- */
const P = W.PAL;
const stoneBlock = (R, x, y, z, w, h, d) => R.fill(x, y, z, w, h, d, P.stone);

W.ROOMS = [
{ id:'r1', name:'Hollow Landing', gx:0, gy:1, w:28, h:16, d:28, spawn:[6, 14],
  doors:[{ dir:'E', to:'r2' }],
  build(R) {
    R.base();
    stoneBlock(R, 12, 1, 5, 4, 1, 4); stoneBlock(R, 16, 1, 9, 4, 2, 4); stoneBlock(R, 20, 1, 5, 5, 3, 5);
    stoneBlock(R, 8, 1, 20, 3, 1, 3);
    R.nook(22, 1, 21, 6, 4, 6);                         // rock-walled nook: mine it open
    R.shrooms(12);
  },
  items:[{ t:'beacon', id:'b1', x:5, y:1, z:9 }, { t:'weapon', id:'blaster', x:9.5, y:2.2, z:14.5 }, { t:'weapon', id:'pick', x:22.5, y:5.4, z:7.5 },
         { t:'pearl', id:'p_r1', x:24.5, y:2.6, z:23.5 }],
  enemies:[{ t:'waddler', x:14, z:19 }, { t:'waddler', x:21, z:20 }],
  signs:[{ x:20, z:17, text:'Brown rock can be mined with a pick axe. The tall steps have one.' }],
},
{ id:'r2', name:'Mushroom Path', gx:1, gy:1, w:30, h:18, d:24, spawn:[3, 12],
  doors:[{ dir:'W', to:'r1', at:12 }, { dir:'E', to:'r3', at:17 }, { dir:'S', to:'r11', at:7 }],
  build(R) {
    R.base();
    R.clear(12, 0, 1, 4, 1, 22);                       // 4-wide chasm: a running jump crosses it
    stoneBlock(R, 20, 1, 3, 8, 1, 8); stoneBlock(R, 22, 1, 4, 6, 2, 6); stoneBlock(R, 24, 1, 5, 4, 3, 4);
    R.fill(25, 4, 6, 2, 1, 2, P.ped);                  // pedestal
    stoneBlock(R, 16, 1, 17, 3, 2, 3); stoneBlock(R, 20, 1, 19, 2, 3, 2); R.fill(20, 4, 19, 2, 1, 2, P.crumble, 8);
    R.shrooms(14);
  },
  items:[{ t:'ability', id:'hop', x:26, y:5.4, z:7 }, { t:'pearl', id:'p_r2', x:21, y:5.6, z:20 }, { t:'token', id:'t_r2a', x:6, y:1.8, z:6 }],
  enemies:[{ t:'waddler', x:7, z:6 }, { t:'waddler', x:24, z:16 }, { t:'floater', x:18, y:5, z:12 }],
  traps:[{ t:'spikes', x:18, z:12, w:2, d:3 }, { t:'dart', x:22.5, y:2.2, z:23, dir:'N', every:3 }],
  signs:[{ x:9, z:12, text:'A glowing orb sits on the mound to the north-east. Take the stairs! Mind the spikes.' }],
},
{ id:'r3', name:'Glow Cavern', gx:2, gy:1, w:32, h:24, d:28, spawn:[3, 6],
  doors:[{ dir:'W', to:'r2', at:6 }, { dir:'E', to:'r4', at:22 }, { dir:'N', to:'r5', at:16, y:6 }],
  build(R) {
    R.base();
    stoneBlock(R, 12, 1, 1, 9, 5, 7);                  // high north ledge (top y=6)
    stoneBlock(R, 1, 1, 19, 4, 2, 4); stoneBlock(R, 1, 1, 15, 4, 5, 4); stoneBlock(R, 1, 1, 11, 4, 8, 4);   // west stairs up to plateau A (top y=9)
    stoneBlock(R, 27, 1, 11, 4, 8, 4);                 // plateau B (top y=9), too tall to reach from the ground
    R.shrooms(16);
  },
  items:[{ t:'pearl', id:'p_r3', x:28.5, y:10.4, z:12.5 }, { t:'token', id:'t_r3a', x:16, y:7.8, z:4 }, { t:'seed', id:'s_r3', ev:'parade', x:2.5, y:9.9, z:12.5 }],
  gates:[{ ability:'hop', x:16, y:8.6, z:8.6 }, { ability:'roll', x:2.5, y:11.2, z:12.5 }],
  tracks:[{ id:'flume', pts:[[2.5, 9.15, 12.5], [2.5, 8.9, 16.5], [6, 6, 20.5], [12, 3.5, 24.5], [20, 1.8, 24.5], [27, 1.25, 22]], pads:[.3, .62], color:0xb8e6ff }],
  traps:[{ t:'dart', x:8.5, y:3, z:1, dir:'S', every:3.2 }, { t:'dart', x:24.5, y:3, z:27, dir:'N', every:3.6 }],
  enemies:[{ t:'chomper', x:10, z:25 }, { t:'chomper', x:24, z:24 }, { t:'waddler', x:22, z:10 }, { t:'waddler', x:16, z:18 }],
  signs:[{ x:16, z:11, text:'The north door sits high on a ledge. Two jumps might do it.' }],
  parade:{ z:12.5, y:9, x0:6, x1:24.2 },
},
{ id:'r4', name:'Tunnel Hall', gx:3, gy:1, w:30, h:16, d:26, spawn:[3, 13],
  doors:[{ dir:'W', to:'r3', at:13 }, { dir:'N', to:'r6', at:15 }, { dir:'S', to:'r8', at:15 }, { dir:'E', to:'r7', at:13, w:1, h:1 }],
  build(R) {
    R.base();
    stoneBlock(R, 20, 1, 8, 9, 4, 11);
    R.clear(20, 1, 13, 9, 1, 1);                       // 1x1 tunnel, ball-sized
    for (const [x, y, z] of [[22, 1, 8], [23, 2, 8], [24, 1, 8], [22, 3, 8], [26, 2, 18], [25, 1, 18], [27, 3, 18]]) R.set(x, y, z, P.ore, 10);   // gold ore veins in the block's faces
    R.nook(2, 1, 19, 5, 4, 5);
    R.shrooms(10);
  },
  items:[{ t:'beacon', id:'b2', x:6, y:1, z:6 }, { t:'token', id:'t_r4n1', x:3.5, y:1.8, z:21.5 }, { t:'token', id:'t_r4n2', x:4.5, y:1.8, z:22.5 }, { t:'token', id:'t_r4n3', x:3.5, y:1.8, z:22.5 }],
  traps:[{ t:'spikes', x:12, z:5, w:3, d:3 }, { t:'spikes', x:12, z:18, w:3, d:3 }],
  gates:[{ ability:'roll', x:19, y:2.6, z:13.5 }],
  enemies:[{ t:'waddler', x:10, z:18 }, { t:'waddler', x:12, z:8 }, { t:'floater', x:14, y:5, z:13 }],
},
{ id:'r5', name:'Ledge Nook', gx:2, gy:0, w:24, h:14, d:24, spawn:[12, 20],
  doors:[{ dir:'S', to:'r3', at:12 }, { dir:'E', to:'r6', at:12 }],
  build(R) {
    R.base();
    R.fill(11, 1, 7, 3, 1, 3, P.ped);
    stoneBlock(R, 2, 1, 2, 4, 5, 4);
    R.shrooms(10);
  },
  items:[{ t:'ability', id:'roll', x:12.5, y:3.3, z:8.5 }, { t:'pearl', id:'p_r5', x:4, y:7.6, z:4 }],
  enemies:[{ t:'floater', x:12, y:4, z:13 }, { t:'floater', x:6, y:6, z:18 }, { t:'waddler', x:18, z:18 }],
},
{ id:'r6', name:'Spore Shaft', gx:3, gy:0, w:22, h:26, d:22, spawn:[3, 3],
  doors:[{ dir:'W', to:'r5', at:3 }, { dir:'S', to:'r4', at:3 }],
  build(R) {
    R.base();
    for (let i = 0; i < 10; i++) {
      const a = i * 0.62, x = Math.round(11 + 7.5 * Math.cos(a)), z = Math.round(11 + 7.5 * Math.sin(a)), top = 3 + 2 * i;
      R.fill(x - 1, 1, z - 1, 3, top - 1, 3, i % 2 ? P.stone : P.stone2);
    }
    R.shrooms(10);
  },
  items:[{ t:'pearl', id:'p_r6', x:Math.round(11 + 7.5 * Math.cos(5.58)), y:22.6, z:Math.round(11 + 7.5 * Math.sin(5.58)) },
         { t:'pearl', id:'p_r6w', x:11, y:23.3, z:11 }, { t:'seed', id:'s_r6', ev:'waltz', x:11, y:1.9, z:11 }],
  enemies:[{ t:'floater', x:8, y:7, z:8 }, { t:'floater', x:15, y:12, z:15 }, { t:'floater', x:11, y:16, z:6 }],
},
{ id:'r7', name:'Pebble Burrow', gx:4, gy:1, w:26, h:16, d:26, spawn:[2.6, 13],
  doors:[{ dir:'W', to:'r4', at:13, w:1, h:1 }, { dir:'E', to:'r9', at:13 }],
  build(R) {
    R.base();
    R.fill(12, 1, 12, 3, 1, 3, P.ped);
    stoneBlock(R, 20, 1, 2, 4, 4, 3);
    R.shrooms(12);
  },
  items:[{ t:'ability', id:'kick', x:13.5, y:3.3, z:13.5 }, { t:'pearl', id:'p_r7', x:22, y:6.6, z:3.5 }],
  traps:[{ t:'spikes', x:9, z:9, w:2, d:2 }, { t:'spikes', x:16, z:16, w:2, d:2 }, { t:'dart', x:25, y:2.4, z:6.5, dir:'W', every:3.4 }],
  enemies:[{ t:'waddler', x:6, z:6 }, { t:'waddler', x:20, z:20 }, { t:'chomper', x:6, z:20 }, { t:'chomper', x:20, z:9 }],
},
{ id:'r8', name:'Moss Cellar', gx:3, gy:2, w:28, h:16, d:28, spawn:[14, 2.6],
  doors:[{ dir:'N', to:'r4', at:14 }, { dir:'E', to:'r12', at:14 }],
  build(R) {
    R.base();
    R.fill(22, 1, 20, 5, 5, 5, P.brittle, 5); R.clear(23, 1, 21, 3, 3, 3);       // weak-walled alcove
    for (const [x, y, z] of [[3, 1, 12], [3, 2, 13], [3, 1, 14]]) R.set(x, y, z, P.ore, 10);
    R.fill(1, 1, 11, 3, 4, 5, P.rock, 9); R.fill(1, 1, 13, 2, 2, 1, P.ore, 10);
    R.shrooms(12);
  },
  traps:[{ t:'spikes', x:12, z:11, w:3, d:2 }, { t:'dart', x:27, y:2.2, z:5.5, dir:'W', every:3 }],
  tracks:[{ id:'run', pts:[[3, 1.2, 25], [10, 1.2, 25], [15, 3.5, 22], [17, 5.5, 16], [17, 3, 10], [13, 1.2, 6], [7, 1.2, 5]], pads:[.2, .5, .75], color:0xffe8a8 }],
  gates:[{ ability:'roll', x:3, y:3.2, z:24.2 }],
  items:[{ t:'pearl', id:'p_r8s', x:5, y:2.3, z:5 }, { t:'pearl', id:'p_r8', x:24.5, y:2.6, z:22.5 }, { t:'seed', id:'s_r8', ev:'giant', x:4, y:1.9, z:23 }, { t:'token', id:'t_r8a', x:14, y:1.8, z:14 }],
  enemies:[{ t:'chomper', x:8, z:8 }, { t:'chomper', x:20, z:10 }, { t:'waddler', x:8, z:20 }, { t:'waddler', x:14, z:20 }],
  signs:[{ x:20, z:17, text:'The walls of that little alcove look... weak. If only you were bigger.' }],
},
{ id:'r9', name:'Slick Chimney', gx:5, gy:1, w:24, h:22, d:24, spawn:[2.6, 12],
  doors:[{ dir:'W', to:'r7', at:12 }, { dir:'E', to:'r10', at:12, y:15 }, { dir:'S', to:'r13', at:5 }],
  build(R) {
    R.base();
    R.fill(10, 1, 8, 1, 14, 8, P.slick);               // two slick walls form a chimney
    R.fill(14, 1, 8, 9, 14, 8, P.slick);               // second wall doubles as the ledge (top y=15)
    R.shrooms(8);
  },
  gates:[{ ability:'kick', x:12.5, y:3.4, z:16.8 }],
  traps:[{ t:'spikes', x:11, z:9, w:3, d:5 }],
  items:[{ t:'token', id:'t_r9a', x:18, y:16.8, z:12 }],
  enemies:[{ t:'waddler', x:5, z:6 }, { t:'waddler', x:6, z:19 }, { t:'waddler', x:18, z:19 }],
},
{ id:'r10', name:'Spark Grotto', gx:6, gy:1, w:28, h:16, d:28, spawn:[2.6, 14],
  doors:[{ dir:'W', to:'r9', at:14 }, { dir:'S', to:'r14', at:14 }],
  build(R) {
    R.base();
    R.fill(13, 1, 7, 3, 1, 3, P.ped);
    R.shrooms(12);
  },
  seal:[{ x:12, y:1, z:24, w:4, h:4, d:4, door:'S' }],
  items:[{ t:'ability', id:'dash', x:14.5, y:3.3, z:8.5 }, { t:'beacon', id:'b3', x:6, y:1, z:6 }],
  gates:[{ ability:'dash', x:13.5, y:3.4, z:22.6 }],
  traps:[{ t:'dart', x:0.5, y:2.2, z:8.5, dir:'E', every:3 }, { t:'spikes', x:8, z:12, w:2, d:3 }],
  enemies:[{ t:'waddler', x:8, z:18 }, { t:'waddler', x:20, z:18 }, { t:'floater', x:14, y:5, z:14 }],
},
{ id:'r11', name:"Bitsy's Burrow", gx:1, gy:2, w:18, h:12, d:18, spawn:[9, 3],
  doors:[{ dir:'N', to:'r2', at:9 }],
  build(R) { R.base(); R.fill(7, 1, 5, 5, 1, 1, P.ped); R.shrooms(6); },
  items:[{ t:'shop', id:'shop', x:9.5, y:1, z:4 }],
  signs:[{ x:9, z:8, text:'Welcome! Spend Twist Tokens on badges. Press Bonk next to me to shop.' }],
},
{ id:'r12', name:'Drip Gallery', gx:4, gy:2, w:30, h:22, d:24, fy:6, spawn:[2.6, 12],
  doors:[{ dir:'W', to:'r8', at:12 }, { dir:'E', to:'r13', at:12 }],
  build(R) {
    R.base(6);
    R.clear(8, 1, 8, 7, 4, 5);                         // hidden cellar under the cracked cap
    R.fill(9, 5, 9, 5, 1, 3, P.crackPound, 3);
    R.fill(9, 1, 9, 2, 2, 3, P.stone); R.fill(11, 1, 9, 2, 4, 3, P.stone);
    R.shrooms(12);
  },
  items:[{ t:'pearl', id:'p_r12', x:13.5, y:2.6, z:10.5 }, { t:'token', id:'t_r12a', x:20, y:7.8, z:6 }],
  gates:[{ ability:'pound', x:11.5, y:8, z:10.5 }],
  traps:[{ t:'spikes', x:17, z:10, w:3, d:4 }, { t:'dart', x:29, y:8.2, z:16.5, dir:'W', every:3 }],
  enemies:[{ t:'floater', x:10, y:10, z:16 }, { t:'floater', x:20, y:10, z:8 }, { t:'waddler', x:24, z:16 }, { t:'waddler', x:5, z:18 }, { t:'chomper', x:20, z:12 }],
  signs:[{ x:6, z:12, text:'Cracked brown floor. Something heavy might break it. (Jump, then press Crouch / Down.)' }],
},
{ id:'r13', name:'Cracked Crossing', gx:5, gy:2, w:26, h:16, d:26, spawn:[2.6, 13],
  doors:[{ dir:'W', to:'r12', at:13 }, { dir:'N', to:'r9', at:13 }, { dir:'E', to:'r14', at:13 }],
  build(R) {
    R.base(); R.clear(11, 0, 10, 4, 1, 6); R.fill(12, 0, 12, 2, 1, 2, P.crumble, 8);   // pit with a crumbling stepping stone
    stoneBlock(R, 4, 1, 4, 3, 2, 3); R.nook(18, 1, 20, 5, 4, 5); R.shrooms(12);
  },
  items:[{ t:'pearl', id:'p_r13', x:20.5, y:2.6, z:22.5 }],
  traps:[{ t:'spikes', x:18, z:8, w:3, d:2 }, { t:'dart', x:25, y:2.2, z:6.5, dir:'W', every:3 }],
  seal:[{ x:22, y:1, z:11, w:4, h:4, d:4, door:'E' }],
  gates:[{ ability:'dash', x:21, y:3.4, z:13.5 }],
  enemies:[{ t:'chomper', x:6, z:6 }, { t:'chomper', x:6, z:20 }, { t:'waddler', x:18, z:8 }, { t:'waddler', x:18, z:18 }, { t:'floater', x:12, y:5, z:13 }],
},
{ id:'r14', name:"Old Mossback's Den", gx:6, gy:2, w:34, h:20, d:34, spawn:[17, 3],
  doors:[{ dir:'N', to:'r10', at:17 }, { dir:'W', to:'r13', at:17 }],
  boss:true,
  build(R) {
    R.base();
    R.shrooms(18);
  },
},
];
W.ROOM_BY_ID = {}; W.ROOMS.forEach(r => W.ROOM_BY_ID[r.id] = r);

/* ---------- Bit's layered hints: nudge, direction, solution ---------- */
W.hintFor = function (S) {
  const A = S.abilities;
  if (!A.hop) return ['Something shiny is waiting in the second room.', 'Head east from the beacon into Mushroom Path. Look at the mound in the north-east.', 'In Mushroom Path, cross the chasm, climb the stairs on the north-east mound and touch the yellow orb for Double Hop.'];
  if (!A.roll) return ['Yellow arrows mark a ledge in Glow Cavern.', 'Glow Cavern is east of Mushroom Path. The north door is up on a high ledge: jump, then jump again in mid-air.', 'Double Hop onto the north ledge of Glow Cavern, go through to Ledge Nook and touch the blue orb for Roll Ball.'];
  if (!A.kick) return ['A tiny tunnel in Tunnel Hall is just your size.', 'Tunnel Hall is east of Glow Cavern. The east wall has a 1-block tunnel: press Crouch to curl into a ball.', 'Roll through the tunnel into Pebble Burrow and touch the pink orb for Wall Kick.'];
  if (!A.dash) return ['Slick walls in Slick Chimney are made for kicking.', 'East of Pebble Burrow. Jump into the gap between the slick walls, cling and kick off alternately. The east door is on top.', 'Kick-climb the chimney, take the high east door to Spark Grotto and touch the orange orb for Spark Dash.'];
  if (!S.boss) return ['Orange cracked blocks seal the way south.', 'In Spark Grotto, use the ability wheel (hold R / hold R key) to pick Spark Dash, then press Run to dash into the orange wall.', 'Dash through the south wall of Spark Grotto and face Old Mossback. He gets dazed when he bonks a wall!'];
  if (!A.bubble) return ['The path south from the boss room leads to Brook Burrows.', 'Beat Mossback, take the south door of his Den, then go west from Brookside Landing into the Spillway.', 'In the Spillway, swim to the middle island and touch the cyan orb for Bubble Float.'];
  if (!S.mini) return ['Shellbert guards the way to the Queen.', 'Shellbert is in the Workshop west of the Whirl Cellar (south-west of the hub). Reach it from Kelp Gallery or the Whirl Cellar.', 'Take the Tide Hall west door (finish the Reverse Run or pay 25 tokens), then the Whirl Cellar west door into the Workshop. Hit Shellbert when he is dizzy.'];
  if (!S.bossK) return ['The Queen waits south of the Workshop.', 'Go through the south door of the Workshop, which opens after Shellbert falls.', 'Dodge the red ring, hit Queen Bubblefin while she gasps, and use the updrafts as the water rises.'];
  return ['You cleared two biomes! Seek out remaining secrets.', 'Twist Seeds glow violet. Pearls hide behind paper walls, rock nooks and slide routes.', 'Seeds: Glow Cavern, Spore Shaft, Moss Cellar, Updraft Shaft, Kelp Gallery, Tide Hall. Slide flumes in Glow Cavern, Moss Cellar, Reed Cavern and Sluice.'];
};
})(window.W);
