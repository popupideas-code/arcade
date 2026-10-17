'use strict';
// Brook Burrows: waterfalls, flooded tunnels, Bubble Float, slide flumes, Queen Bubblefin.
(function (W) {
const SB = (R, x, y, z, w, h, d) => R.fill(x, y, z, w, h, d, R.pal.stone);
const SD = (R, x, y, z, w, h, d) => R.fill(x, y, z, w, h, d, R.pal.stone2);
const pool = (R, x, z, w, d, fy = 3) => R.clear(x, 1, z, w, fy - 1, d);          // carve a pool down to a 1-thick bottom
const T = { theme:'brook', biome:'brook' };

W.ROOMS.find(r => r.id === 'r14').doors.push({ dir:'S', to:'b1', at:17, locked:'boss' });
W.ROOMS.find(r => r.id === 'r14').gx = 6;

W.ROOMS.push(
{ id:'b1', name:'Brookside Landing', gx:6, gy:3, w:30, h:18, d:30, fy:3, spawn:[6, 15], ...T,
  doors:[{ dir:'N', to:'r14', at:15 }, { dir:'W', to:'b2', at:15 }, { dir:'S', to:'b7', at:15 }],
  build(R) {
    R.base(); pool(R, 9, 18, 12, 9); SB(R, 4, 3, 20, 3, 1, 3); SB(R, 24, 3, 12, 4, 2, 4);
    R.nook(24, 3, 22, 5, 4, 5); R.shrooms(10);
  },
  water:[{ x0:9, x1:21, z0:18, z1:27, y0:1, level:2.7 }],
  falls:[{ axis:'z', x:5, z:1.05, w:5, y0:3, y1:16 }, { axis:'z', x:20, z:1.05, w:5, y0:3, y1:16 }],
  items:[{ t:'beacon', id:'k1', x:6, y:3, z:13 }, { t:'shop', id:'shop2', x:23.5, y:3, z:6 }, { t:'pearl', id:'p_k1', x:26.5, y:4.6, z:24.5 }, { t:'token', id:'t_k1a', x:15, y:3.8, z:23 }],
  signs:[{ x:9, z:10, text:'Brook Burrows! Waterfalls, flooded tunnels and a new trick: Bubble Float, west of here.' }, { x:22, z:9, text:'The Kelp Kiosk sells badges and cosmetics. Bonk the merchant.' }],
},
{ id:'b2', name:'Spillway', gx:5, gy:3, w:32, h:20, d:26, fy:3, spawn:[2.6, 13], ...T,
  doors:[{ dir:'E', to:'b1', at:13 }, { dir:'W', to:'b3', at:13 }],
  build(R) {
    R.base(); pool(R, 3, 3, 26, 20); SB(R, 7, 1, 11, 4, 4, 4); SB(R, 13, 1, 10, 5, 4, 5); SB(R, 21, 1, 11, 4, 4, 4);
    R.fill(15, 5, 12, 1, 1, 1, R.pal.stone2); SB(R, 26, 1, 4, 3, 13, 3); R.shrooms(10);
  },
  water:[{ x0:3, x1:29, z0:3, z1:23, y0:1, level:4.4 }],
  vents:[{ x:22.5, z:6.5, r:1.7, y0:1, y1:17 }],
  falls:[{ axis:'z', x:8, z:1.05, w:6, y0:5, y1:19 }],
  items:[{ t:'ability', id:'bubble', x:15.5, y:6.5, z:12.5 }, { t:'pearl', id:'p_k2', x:27.5, y:14.6, z:5.5 }, { t:'token', id:'t_k2a', x:9, y:6.1, z:13 }, { t:'token', id:'t_k2b', x:22.5, y:6.1, z:12.5 }],
  gates:[{ ability:'bubble', x:22.5, y:7.5, z:9.5 }],
  enemies:[{ t:'mimic', x:11.5, y:4, z:12.5 }, { t:'mimic', x:19.5, y:4, z:12.5 }, { t:'floater', x:14, y:8, z:18 }, { t:'floater', x:20, y:9, z:7 }],
  traps:[{ t:'spikes', x:7.5, z:12, w:1, d:2, y:5 }],
},
{ id:'b3', name:'Updraft Shaft', gx:4, gy:3, w:26, h:34, d:26, fy:1, spawn:[22, 13], ...T,
  doors:[{ dir:'E', to:'b2', at:13 }, { dir:'W', to:'b4', at:13, y:24 }, { dir:'S', to:'b9', at:13 }],
  build(R) {
    R.base(); SB(R, 1, 1, 10, 5, 23, 6);                                        // west ledge (top y=24): reach it riding the updraft
    [[2.3, 3], [2.9, 5], [3.5, 7], [4.1, 9], [4.7, 11]].forEach(([a, top]) => { const x = Math.round(13 + 8.2 * Math.cos(a)), z = Math.round(13 + 8.2 * Math.sin(a)); SD(R, x - 1, 1, z - 1, 3, top - 1, 3); });
    SB(R, 21, 1, 20, 3, 14, 3); R.shrooms(10);
  },
  vents:[{ x:13.5, z:13.5, r:2.4, y0:1, y1:31 }],
  falls:[{ axis:'x', x:1.05, z:17, w:6, y0:1, y1:18 }],
  items:[{ t:'seed', id:'s_k3', ev:'bouncy', x:20, y:1.9, z:6 }, { t:'pearl', id:'p_k3', x:22.5, y:15.6, z:21.5 }, { t:'token', id:'t_k3a', x:3, y:25.1, z:13 }],
  gates:[{ ability:'bubble', x:13.5, y:6, z:9 }],
  enemies:[{ t:'floater', x:8, y:12, z:8 }, { t:'floater', x:18, y:18, z:18 }, { t:'floater', x:9, y:25, z:16 }, { t:'waddler', x:20, z:12 }],
  traps:[{ t:'dart', x:25, y:3, z:9.5, dir:'W', every:3.4 }],
  signs:[{ x:13.5, z:17, text:'Bubbles rise from the vent. Hold Jump in the air to float up it. The high west door is the way.' }],
  bounce:true,
},
{ id:'b4', name:'Reed Cavern', gx:3, gy:3, w:34, h:22, d:28, fy:3, spawn:[2.6, 14], ...T,
  doors:[{ dir:'E', to:'b3', at:14 }, { dir:'W', to:'b5', at:14 }, { dir:'S', to:'b10', at:17 }],
  build(R) {
    R.base(); pool(R, 10, 12, 13, 11);
    for (let i = 0; i < 7; i++) SD(R, 2 + i * 2, 3, 3, 2, i + 1, 5);              // staircase rollers tumble down
    R.shrooms(10);
  },
  water:[{ x0:10, x1:23, z0:12, z1:23, y0:1, level:4.2 }],
  tracks:[{ id:'reeds', pts:[[14.5, 10.15, 5.5], [18, 9.8, 5.5], [24, 7.5, 8], [29, 5.2, 14], [30, 3.6, 20], [27, 3.25, 25]], pads:[.3, .65], color:0x9fe6ff }],
  gates:[{ ability:'roll', x:14.5, y:12.2, z:5.5 }],
  items:[{ t:'pearl', id:'p_k4', x:24, y:4.6, z:25.2 }, { t:'token', id:'t_k4a', x:7, y:7.2, z:3.4 }, { t:'token', id:'t_k4b', x:16, y:4.8, z:26 }],
  enemies:[{ t:'roller', x:13, y:10, z:5.5 }, { t:'roller', x:9, y:7, z:5.5 }, { t:'waddler', x:28, z:8 }, { t:'waddler', x:6, z:20 }, { t:'chomper', x:28, z:24 }],
  traps:[{ t:'spikes', x:12, z:24, w:3, d:2, y:3 }],
},
{ id:'b5', name:'Kelp Gallery', gx:2, gy:3, w:30, h:18, d:30, fy:3, spawn:[26, 14], ...T,
  doors:[{ dir:'E', to:'b4', at:14 }, { dir:'W', to:'b6', at:14 }, { dir:'S', to:'b11', at:15 }],
  build(R) {
    R.base(); pool(R, 8, 8, 13, 13); SB(R, 4, 3, 4, 3, 2, 3);
    R.fill(24, 3, 22, 5, 4, 5, W.PAL.paper, 11); R.clear(25, 3, 23, 3, 3, 3);       // paper-walled chamber: only slips open during Paper World
    R.shrooms(12);
  },
  water:[{ x0:8, x1:21, z0:8, z1:21, y0:1, level:4.0 }],
  falls:[{ axis:'z', x:12, z:1.05, w:6, y0:3, y1:17 }],
  items:[{ t:'seed', id:'s_k5', ev:'paper', x:5.5, y:5.4, z:5.5 }, { t:'pearl', id:'p_k5', x:26.5, y:4.6, z:24.5 }, { t:'token', id:'t_k5a', x:14.5, y:4.6, z:14.5 }],
  enemies:[{ t:'mimic', x:12.5, y:3.4, z:12.5 }, { t:'mimic', x:17.5, y:3.4, z:17.5 }, { t:'waddler', x:24, z:8 }, { t:'floater', x:14, y:7, z:6 }],
  signs:[{ x:23, z:19, text:'That chamber is wrapped in thin paper. Strange. Even a pick axe just tears through nothing.' }],
},
{ id:'b6', name:'Pearl Grotto', gx:1, gy:3, w:28, h:24, d:28, fy:3, spawn:[2.6, 14], ...T,
  doors:[{ dir:'E', to:'b5', at:14 }],
  build(R) {
    R.base(); R.fill(10, 3, 8, 1, 14, 8, R.pal.stone2 && W.PAL.slick); R.fill(14, 3, 8, 6, 14, 8, W.PAL.slick);   // slick chimney
    R.nook(2, 3, 2, 5, 4, 5); pool(R, 16, 18, 9, 8); for (const [x, y, z] of [[22, 4, 3], [22, 5, 3], [23, 4, 3]]) R.set(x, y, z, W.PAL.ore, 10); R.fill(21, 3, 1, 4, 4, 3, W.PAL.rock, 9);
    R.shrooms(10);
  },
  water:[{ x0:16, x1:25, z0:18, z1:26, y0:1, level:4.0 }],
  gates:[{ ability:'kick', x:12.5, y:6.4, z:16.8 }],
  items:[{ t:'pearl', id:'p_k6a', x:17, y:20.6, z:12 }, { t:'pearl', id:'p_k6b', x:4.5, y:4.6, z:4.5 }, { t:'pearl', id:'p_k6c', x:20.5, y:2.3, z:22 }, { t:'token', id:'t_k6a', x:6, y:4.8, z:20 }],
  enemies:[{ t:'chomper', x:6, z:22 }, { t:'chomper', x:24, z:10 }, { t:'mimic', x:12.5, y:3, z:22 }],
  traps:[{ t:'spikes', x:11, z:9, w:3, d:5, y:3 }, { t:'dart', x:27, y:5, z:20, dir:'W', every:3 }],
},
{ id:'b7', name:'Sluice', gx:6, gy:4, w:28, h:18, d:26, fy:1, spawn:[15, 3], ...T,
  doors:[{ dir:'N', to:'b1', at:15 }, { dir:'W', to:'b8', at:13, w:1, h:1 }],
  build(R) {
    R.base(); SB(R, 1, 1, 8, 9, 4, 11); R.clear(1, 1, 13, 9, 1, 1);               // flooded ball tunnel
    SB(R, 2, 1, 2, 5, 6, 5); R.shrooms(10);
  },
  water:[{ x0:1, x1:10, z0:13, z1:14, y0:1, level:2.0 }],
  tracks:[{ id:'sluice', pts:[[4.5, 7.15, 4.5], [10, 6.8, 4.5], [16, 4.8, 8], [22, 3, 13], [23, 1.8, 19], [17, 1.25, 23], [9, 1.25, 22]], pads:[.25, .5, .75], color:0xbfe6ff }],
  gates:[{ ability:'roll', x:3.4, y:9.3, z:4.5 }, { ability:'roll', x:11, y:3, z:13.5 }],
  items:[{ t:'pearl', id:'p_k7', x:6.5, y:2.4, z:22.5 }, { t:'token', id:'t_k7a', x:20, y:1.8, z:4 }],
  enemies:[{ t:'roller', x:22, z:8 }, { t:'roller', x:22, z:18 }, { t:'floater', x:14, y:6, z:12 }],
  traps:[{ t:'spikes', x:14, z:15, w:3, d:2 }, { t:'dart', x:27, y:2.2, z:7.5, dir:'W', every:3 }],
},
{ id:'b8', name:'Flooded Tunnels', gx:5, gy:4, w:34, h:14, d:30, fy:1, spawn:[31, 15], ...T,
  doors:[{ dir:'E', to:'b7', at:13, w:1, h:1 }, { dir:'W', to:'b9', at:15 }],
  build(R) {
    R.base(); SB(R, 27, 1, 9, 6, 4, 9); R.clear(27, 1, 13, 6, 1, 1);               // ball tunnel on the east side
    SB(R, 8, 1, 1, 2, 9, 21); SB(R, 15, 1, 9, 2, 9, 20); SB(R, 22, 1, 1, 2, 9, 21);   // maze walls with alternating gaps
    R.shrooms(8);
  },
  water:[{ x0:1, x1:33, z0:1, z1:29, y0:1, level:10 }],
  items:[{ t:'pearl', id:'p_k8', x:12.5, y:2.2, z:24 }, { t:'token', id:'t_k8a', x:19, y:2.2, z:4 }, { t:'token', id:'t_k8b', x:25, y:2.2, z:25 }],
  enemies:[{ t:'floater', x:12, y:5, z:12 }, { t:'floater', x:19, y:6, z:20 }, { t:'floater', x:26, y:5, z:8 }, { t:'chomper', x:4, z:6 }],
  traps:[{ t:'spikes', x:3, z:20, w:4, d:3 }, { t:'spikes', x:18, z:3, w:3, d:4 }],
  signs:[{ x:30, z:20, text:'Flooded tunnels ahead. Tap Jump to swim up. Hold it for a bubble.' }],
},
{ id:'b9', name:'Tide Hall', gx:4, gy:4, w:36, h:16, d:24, fy:1, spawn:[13, 3], ...T,
  doors:[{ dir:'N', to:'b3', at:13 }, { dir:'E', to:'b8', at:12 }, { dir:'W', to:'b10', at:12, locked:'tide' }],
  build(R) { R.base(); SB(R, 14, 1, 14, 6, 3, 5); R.shrooms(10); },
  items:[{ t:'seed', id:'s_k9', ev:'reverse', x:32, y:1.9, z:12, mandatory:true }, { t:'token', id:'t_k9a', x:17, y:4.8, z:16.5 }],
  enemies:[{ t:'waddler', x:12, z:18 }, { t:'waddler', x:22, z:5 }, { t:'mimic', x:26, y:1, z:12 }],
  falls:[{ axis:'z', x:6, z:1.05, w:6, y0:1, y1:15 }],
  signs:[{ x:30, z:15, text:'The violet Tide Gate to the west only opens once the seed here has told its story. Or pay 25 tokens at the gate.' }],
  run:{ x0:32, x1:4, z:12 },
},
{ id:'b10', name:'Whirl Cellar', gx:3, gy:4, w:30, h:20, d:30, fy:3, spawn:[26, 15], ...T,
  doors:[{ dir:'E', to:'b9', at:15 }, { dir:'N', to:'b4', at:17 }, { dir:'S', to:'b12', at:15 }, { dir:'W', to:'b11', at:15 }],
  build(R) {
    R.base(); pool(R, 9, 9, 12, 12);
    for (const [x, z] of [[11, 14], [14, 14], [17, 14], [14, 10], [14, 18]]) R.fill(x, 2, z, 2, 1, 2, W.PAL.crumble, 8);   // crumbling stepping stones
    R.shrooms(10);
  },
  water:[{ x0:9, x1:21, z0:9, z1:21, y0:1, level:3.4 }],
  seal:[{ x:13, y:3, z:26, w:4, h:4, d:4, door:'S' }],
  gates:[{ ability:'dash', x:14, y:6.2, z:24.2 }],
  enemies:[{ t:'roller', x:4, z:6 }, { t:'roller', x:25, z:24 }, { t:'waddler', x:5, z:24 }, { t:'chomper', x:25, z:6 }, { t:'floater', x:15, y:8, z:15 }],
  traps:[{ t:'dart', x:29, y:5, z:7, dir:'W', every:3.2 }, { t:'spikes', x:4, z:12, w:2, d:3 }],
  items:[{ t:'beacon', id:'k2', x:26, y:3, z:25 }],
},
{ id:'b11', name:"Shellbert's Workshop", gx:2, gy:4, w:34, h:18, d:34, fy:1, spawn:[28, 17], ...T, mini:true,
  doors:[{ dir:'E', to:'b10', at:15 }, { dir:'N', to:'b5', at:15 }, { dir:'S', to:'b13', at:17, locked:'mini' }],
  build(R) { R.base(); R.shrooms(14); },
  items:[],
},
{ id:'b12', name:'Bubble Vault', gx:3, gy:5, w:26, h:20, d:26, fy:1, spawn:[13, 3], ...T,
  doors:[{ dir:'N', to:'b10', at:15 }],
  build(R) {
    R.base(); SB(R, 20, 1, 20, 4, 10, 4); SB(R, 3, 1, 3, 4, 4, 4); R.nook(3, 1, 18, 6, 4, 6); R.shrooms(8);
  },
  vents:[{ x:13.5, z:13.5, r:2.1, y0:1, y1:19 }],
  gates:[{ ability:'bubble', x:13.5, y:5, z:9.5 }],
  items:[{ t:'pearl', id:'p_k12a', x:22, y:12.6, z:22 }, { t:'pearl', id:'p_k12b', x:5, y:6.4, z:5 }, { t:'pearl', id:'p_k12c', x:6, y:2.6, z:21 }, { t:'core', id:'core_k', x:13.5, y:2, z:20 }, { t:'token', id:'t_k12a', x:13, y:2, z:6 }],
  enemies:[{ t:'mimic', x:9, y:1, z:13 }, { t:'mimic', x:18, y:1, z:13 }, { t:'floater', x:13, y:9, z:8 }],
  traps:[{ t:'dart', x:25, y:3, z:12.5, dir:'W', every:2.8 }],
},
{ id:'b13', name:"Queen's Lagoon", gx:2, gy:5, w:40, h:26, d:40, fy:3, spawn:[19, 3], ...T,
  doors:[{ dir:'N', to:'b11', at:19 }],
  boss2:true,
  build(R) {
    R.base(); pool(R, 3, 3, 34, 34);
    [[8, 8], [31, 8], [8, 31], [31, 31], [19, 19]].forEach(([x, z]) => SB(R, x - 2, 1, z - 2, 5, 7, 5));          // islands (top y=8)
    [[19, 8], [8, 19], [31, 19], [19, 31]].forEach(([x, z]) => SD(R, x - 1, 1, z - 1, 3, 4, 3));                  // small stones (top y=5)
    R.shrooms(8);
  },
  water:[{ x0:3, x1:37, z0:3, z1:37, y0:1, level:3.3 }],
},
);
W.ROOM_BY_ID = {}; W.ROOMS.forEach(r => W.ROOM_BY_ID[r.id] = r);
})(window.W);
