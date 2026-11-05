/* Breakneck Baller — an endless neon-vector ball runner.
 * Plain JS + Three.js r128 (cdnjs). No build step. Progress is stored locally only. */
(() => {
'use strict';

/* ===================================================================== */
/* constants & utils                                                      */
/* ===================================================================== */
const W = 8, HALF = W / 2, R = 0.5, LIM = HALF - R - 0.1;      // corridor width, ball radius, steer limit
const GRAV = 40, HOP_V = 7.5, JUMP_V = 17, JUMP2_V = 15.5, SLAM_V = 38;
const SLIDE_T = 0.8, SLIDE_Y = 0.225;
const DASH_T = 0.35, DASH_SPEED = 46, DASH_RECHARGE = 3.6, PERFECT_T = 0.13;
const LIGHT = 35, HEAVY = 70, SHIELD_MAX = 100;
const STEP = 1 / 90, LOOK = 190, SEG = 40, TILE = 2;
const TUBE_R = 4.6, TUBE_BOOST = 1.45, TJUMP_V = 12.5, TJUMP2_V = 12;   // speed-tube radius, speed multiplier, radial jump speeds
const FALL_H = 28;
const STYLE_EVERY = (() => { try { const n = Number(new URLSearchParams(location.search).get('gate')); return n >= 100 ? n : 5000; } catch (e) { return 5000; } })();   // metres between style-shift walls
const PLAT_T = 0.6, STEP_TOL = 0.35, STEP_H = 1.25, SPRING_V = 26;      // platforms: slab thickness, auto-step height, rise per stair, spring launch speed
const CANNON_V = 15, CANNON_CHARGE = 0.9;
const LAVA_STIFF = 55, LAVA_DAMP = 8;                                  // slippery obsidian: steering overshoots a little                                                    // height meteors drop from

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const $ = (id) => document.getElementById(id);
const speedAt = (d) => lerp(17, 36, clamp(d / 7500, 0, 1));
const diffAt = (d) => clamp(d / 6500, 0, 1);

/* ===================================================================== */
/* local save                                                             */
/* ===================================================================== */
const SAVE_KEY = 'breakneckBaller.v1';
const UPS = [
  { id: 'hearts', name: 'Extra Heart',  desc: '+1 max heart',               max: 2, cost: [150, 350] },
  { id: 'dash',   name: 'Dash Cell',    desc: '+1 dash charge',             max: 2, cost: [200, 420] },
  { id: 'shield', name: 'Shield Core',  desc: 'Shield recharges faster',    max: 3, cost: [120, 240, 400] },
  { id: 'magnet', name: 'Magnet Coil',  desc: 'Magnet power-up lasts longer', max: 3, cost: [100, 220, 380] },
];
function loadSave() {
  const def = { best: 0, coins: 0, up: { hearts: 0, dash: 0, shield: 0, magnet: 0 }, left: false, mute: false, seen: {}, style: 'neon' };
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (s && typeof s === 'object') return Object.assign(def, s, { up: Object.assign(def.up, s.up), seen: Object.assign({}, s.seen) });
  } catch (e) { /* storage blocked */ }
  return def;
}
const save = loadSave();
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ } }
const maxHearts = () => 3 + save.up.hearts;
const maxDash = () => 3 + save.up.dash;
const shieldRegen = () => 14 * (1 + 0.4 * save.up.shield);
const magnetDur = () => 6 + 2.5 * save.up.magnet;

/* ===================================================================== */
/* renderer, scene, camera                                                */
/* ===================================================================== */
const stage = $('stage');
const canvas = $('c');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  $('noWebgl').style.display = 'block';
  $('playBtn').disabled = true;
  return;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const BG = 0x05060f;
const scene = new THREE.Scene();
scene.background = new THREE.Color(BG);
scene.fog = new THREE.Fog(BG, 55, 170);
const camera = new THREE.PerspectiveCamera(70, 0.6, 0.1, 260);

let baseFov = 70;
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // keep the whole corridor on screen in tall/narrow portrait
  const half = Math.atan(5.1 / 12.6 / camera.aspect);
  baseFov = clamp(THREE.MathUtils.radToDeg(half) * 2, 62, 86);
  camera.fov = baseFov;
  camera.updateProjectionMatrix();
  if (post.mat) rebuildPost();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 150));

/* ===================================================================== */
/* visual styles: Neon draws straight to the canvas; Pixel / Comic / Pencil */
/* draw the same scene into a render target and restyle it in one shader.  */
/* ===================================================================== */
const STYLES = ['neon', 'pixel', 'comic', 'watercolor'];
if (save.style === 'pencil') save.style = 'watercolor';          // Pencil was replaced by Watercolor
let style = STYLES.includes(save.style) ? save.style : 'neon';
const post = { rt: null, mat: null, scene: null, cam: null, depthOK: false };
const dummyTex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); dummyTex.needsUpdate = true;
const POST_VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const POST_FRAG = `
precision highp float;
uniform sampler2D tColor; uniform sampler2D tDepth;
uniform vec2 uTexel, uLow; uniform float uPx, uDpr, uTime, uStyle, uNear, uFar, uUseDepth, uDither, uMaxMix, uLevels, uGamma; uniform vec3 uTone;
varying vec2 vUv;
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
vec3 tex(vec2 uv) { return texture2D(tColor, uv).rgb; }
float iz(vec2 uv) { float z = texture2D(tDepth, uv).x * 2.0 - 1.0; return (uFar + uNear - z * (uFar - uNear)) / (2.0 * uNear * uFar); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
// silhouette edges from depth: second difference of inverse depth is ~0 on flat floors, large at object borders
float depthEdge(vec2 uv, float k) {
  if (uUseDepth < 0.5) return 0.0;
  vec2 o = uTexel * uPx * k;
  float c = iz(uv);
  float e = abs(iz(uv + vec2(o.x, 0.0)) + iz(uv - vec2(o.x, 0.0)) - 2.0 * c) + abs(iz(uv + vec2(0.0, o.y)) + iz(uv - vec2(0.0, o.y)) - 2.0 * c);
  return smoothstep(0.12, 0.45, e / max(c, 0.004));
}
void main() {
  vec3 col;
  if (uStyle < 0.5) {                                     // PIXEL: scene is rendered at 2x, each chunky pixel averages its 2x2 block (no popping lines), gentle dither
    vec2 cell = (floor(vUv * uLow) + 0.5) / uLow;
    vec2 h = 0.25 / uLow;
    vec3 a = tex(cell + vec2(-h.x, -h.y)), b = tex(cell + vec2(h.x, -h.y)), c2 = tex(cell + vec2(-h.x, h.y)), d = tex(cell + vec2(h.x, h.y));
    vec3 c = mix((a + b + c2 + d) * 0.25, max(max(a, b), max(c2, d)), uMaxMix);     // keep thin bright lines solid but let them fade in smoothly
    c = pow(c, vec3(uGamma));                                                   // averaging dims 1px lines; lift them back
    float bay = bayer4(floor(vUv * uLow));
    col = clamp(floor(c * uLevels + 0.5 + (bay - 0.5) * uDither) / uLevels, 0.0, 1.0);
  } else if (uStyle < 1.5) {                              // COMIC: flat poster colours, old offset-print misregistration, light halftone, ink outlines
    vec2 px = uTexel * uPx;                               // one css pixel in uv
    vec3 s = vec3(tex(vUv + px * vec2(1.6, -1.0)).r, tex(vUv + px * vec2(-1.2, 1.4)).g, tex(vUv + px * vec2(0.4, 1.8)).b);   // colour plates slip a little
    vec3 c = pow(s, vec3(0.55));                          // lift the dark neon palette into bright poster colours
    float l = luma(c);
    c = clamp(mix(vec3(l), c, 1.6), 0.0, 1.0);
    c = floor(c * 4.0 + 0.5) / 4.0;                       // flat colour: few levels per channel
    float ang = 0.7854; mat2 R = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
    vec2 cell = fract((R * gl_FragCoord.xy) / (5.0 * uDpr)) - 0.5;
    float rad = (0.55 - l) * 0.9;
    float dots = (1.0 - smoothstep(rad - 0.08, rad + 0.02, length(cell))) * step(l, 0.5);
    c = mix(c, c * 0.62, dots * 0.55);                    // light halftone in the shadows
    vec2 fc = gl_FragCoord.xy / uDpr;
    float grain = vnoise(fc * 1.3) * 0.5 + vnoise(fc * 3.7) * 0.5;
    c = mix(c, c * vec3(0.98, 0.94, 0.85), 0.55) * (0.95 + 0.07 * grain);   // cheap newsprint
    vec2 inkOff = px * vec2(-2.2, 1.6);                   // the black plate slips the other way
    float e = max(depthEdge(vUv + inkOff, 1.0), depthEdge(vUv + inkOff, 2.0) * 0.85);
    col = mix(c, vec3(0.06, 0.04, 0.08), e);
  } else {                                                // WATERCOLOR: soft pigment washes on paper. Fully static: no wobble, no hatching, nothing animated
    vec2 o = uTexel * uPx * 1.6;
    vec3 c0 = tex(vUv);
    vec3 c = c0 * 0.4 + (tex(vUv + vec2(o.x, 0.0)) + tex(vUv - vec2(o.x, 0.0)) + tex(vUv + vec2(0.0, o.y)) + tex(vUv - vec2(0.0, o.y))) * 0.15;   // soft bleed for the washes
    float V = max(c.r, max(c.g, c.b));
    float V0 = max(c0.r, max(c0.g, c0.b));
    float L = luma(c);
    vec3 hue = c / max(V, 0.08);
    vec2 fc = gl_FragCoord.xy / uDpr;
    float blot = vnoise(fc * 0.018) * 0.6 + vnoise(fc * 0.05) * 0.4;          // pigment pooling
    float grain = vnoise(fc * 1.1) * 0.5 + vnoise(fc * 3.1) * 0.5;            // paper tooth
    float f = smoothstep(0.18, 0.85, V * 0.85 + L * 0.15);                    // mid-bright areas (horizon glow) get a light wash too
    vec3 paper = vec3(0.96, 0.94, 0.88) * uTone * (0.95 + 0.07 * grain);
    vec3 pigment = mix(hue, vec3(1.0), 0.1) * (0.9 - 0.12 * blot);
    float amt = clamp(f * (0.66 + 0.5 * blot), 0.0, 0.97);
    col = paper * mix(vec3(1.0), pigment, amt);
    float stroke = smoothstep(0.06, 0.3, max(V0 - V, 0.0));                    // thin bright lines survive the bleed as crisp coloured brush strokes
    col = mix(col, paper * (c0 / max(V0, 0.08)) * 0.62, stroke * 0.85);
    vec2 e1 = uTexel * uPx * 1.2;
    float gx = luma(tex(vUv + vec2(e1.x, 0.0))) - luma(tex(vUv - vec2(e1.x, 0.0)));
    float gy = luma(tex(vUv + vec2(0.0, e1.y))) - luma(tex(vUv - vec2(0.0, e1.y)));
    float edge = max(smoothstep(0.08, 0.35, length(vec2(gx, gy))), depthEdge(vUv, 1.2) * 0.8);
    col *= 1.0 - 0.34 * edge;                                                  // wet-edge: pigment pools at borders
    col = mix(col, hue * 0.4, edge * 0.3);                                     // faint coloured line
    col *= 1.0 - 0.14 * pow(length(vUv - 0.5) * 1.3, 2.4);                     // soft vignette
  }
  gl_FragColor = vec4(col, 1.0);
}`;
function initPost() {
  post.depthOK = renderer.capabilities.isWebGL2 || renderer.extensions.has('WEBGL_depth_texture');
  post.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  post.mat = new THREE.ShaderMaterial({
    vertexShader: POST_VERT, fragmentShader: POST_FRAG, depthTest: false, depthWrite: false,
    uniforms: { tColor: { value: null }, tDepth: { value: dummyTex }, uTexel: { value: new THREE.Vector2(1, 1) }, uLow: { value: new THREE.Vector2(1, 1) }, uPx: { value: 1 }, uDpr: { value: 1 },
      uTime: { value: 0 }, uStyle: { value: 0 }, uNear: { value: 0.1 }, uFar: { value: 260 }, uUseDepth: { value: 0 }, uTone: { value: new THREE.Vector3(1, 1, 1) }, uDither: { value: 0.45 }, uMaxMix: { value: 0 }, uLevels: { value: 7 }, uGamma: { value: 1 } },   // tuned by measuring frame-to-frame popping (see README)
  });
  post.scene = new THREE.Scene(); post.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post.mat));
}
function rebuildPost() {
  if (post.rt) { if (post.rt.depthTexture) post.rt.depthTexture.dispose(); post.rt.dispose(); post.rt = null; }
  if (style === 'neon') return;
  const w = stage.clientWidth || 390, h = stage.clientHeight || 844, dpr = renderer.getPixelRatio();
  let rw, rh, filt, px;
  if (style === 'pixel') { rh = 480; rw = Math.max(160, Math.round(rh * w / h)); filt = THREE.LinearFilter; px = rh / h; }      // 2x the 240px art grid, averaged down in the shader
  else { const sc = Math.max(1.25, Math.min(dpr, 1.75)); rw = Math.round(w * sc); rh = Math.round(h * sc); filt = THREE.LinearFilter; px = sc; }
  const useDepth = post.depthOK && style !== 'pixel';
  post.rt = new THREE.WebGLRenderTarget(rw, rh, { minFilter: filt, magFilter: filt, format: THREE.RGBAFormat, depthBuffer: true, stencilBuffer: false });
  if (useDepth) post.rt.depthTexture = new THREE.DepthTexture(rw, rh, THREE.UnsignedIntType);
  const u = post.mat.uniforms;
  u.tColor.value = post.rt.texture; u.tDepth.value = useDepth ? post.rt.depthTexture : dummyTex;
  u.uTexel.value.set(1 / rw, 1 / rh); u.uLow.value.set(rw / 2, rh / 2); u.uPx.value = px; u.uDpr.value = dpr; u.uUseDepth.value = useDepth ? 1 : 0;
  u.uStyle.value = style === 'pixel' ? 0 : style === 'comic' ? 1 : 2; u.uNear.value = camera.near; u.uFar.value = camera.far;
}
function renderFrame(now) {
  if (style === 'neon' || !post.rt) { renderer.render(scene, camera); return; }
  renderer.setRenderTarget(post.rt); renderer.render(scene, camera); renderer.setRenderTarget(null);
  post.mat.uniforms.uTime.value = now / 1000;
  renderer.render(post.scene, post.cam);
}
function setStyle(name, quiet) {
  style = STYLES.includes(name) ? name : 'neon';
  document.body.dataset.style = style;
  ballWire.visible = style !== 'pixel';            // the wire overlay turns a 7px ball into flickering noise at pixel resolution
  if (post.mat) rebuildPost();
  if (!quiet) { save.style = style; persist(); renderMenu(); }
}

/* ===================================================================== */
/* textures, materials, shared geometry                                   */
/* ===================================================================== */
function canvasTex(size, draw, repeat = true) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); draw(g, size);
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
const gridTex = canvasTex(128, (g, s) => {
  g.fillStyle = '#14202e'; g.fillRect(0, 0, s, s);          // greys: the palette tints these per time of day
  g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, s - 3, s - 3);
});
const brickTex = canvasTex(128, (g, s) => {
  g.fillStyle = '#2b0b10'; g.fillRect(0, 0, s, s);
  g.strokeStyle = '#ff4a2e'; g.lineWidth = 4;
  const bh = s / 4;
  for (let r = 0; r < 4; r++) {
    const y = r * bh; g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke();
    const off = (r % 2) * s / 4;
    for (let x = off; x < s; x += s / 2) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + bh); g.stroke(); }
  }
});
const stripeTex = canvasTex(64, (g, s) => {
  g.fillStyle = '#240509'; g.fillRect(0, 0, s, s);
  g.fillStyle = '#d6301f';
  for (let i = -s; i < s * 2; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 16, 0); g.lineTo(i + 16 + s, s); g.lineTo(i + s, s); g.fill(); }
});
const hatchTex = canvasTex(64, (g, s) => {
  g.clearRect(0, 0, s, s); g.strokeStyle = 'rgba(160,255,250,1)'; g.lineWidth = 2.5;
  for (let i = -s; i < s * 2; i += 16) { g.beginPath(); g.moveTo(i, s); g.lineTo(i + s, 0); g.stroke(); }
});
const chevTex = canvasTex(128, (g, s) => {
  g.clearRect(0, 0, s, s); g.strokeStyle = '#fff'; g.lineWidth = 15; g.lineJoin = 'miter';
  for (let i = 0; i < 2; i++) {
    const y = s * (0.3 + 0.5 * i);
    g.beginPath(); g.moveTo(s * 0.14, y + s * 0.2); g.lineTo(s * 0.5, y - s * 0.1); g.lineTo(s * 0.86, y + s * 0.2); g.stroke();
  }
});
const ballTex = canvasTex(128, (g, s) => {
  g.fillStyle = '#ff7a1a'; g.fillRect(0, 0, s, s);
  g.fillStyle = '#ff2fa8';
  for (let i = 0; i < 4; i++) g.fillRect(0, i * (s / 4) + s / 16, s, s / 8);
  g.fillStyle = '#ffd23f'; g.fillRect(s * 0.1, 0, s * 0.1, s);
}, false);
ballTex.wrapS = THREE.RepeatWrapping;

function textTex(text, color, w, h, font) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = color; g.shadowBlur = 22; g.fillStyle = color; g.fillText(text, w / 2, h / 2);
  g.shadowBlur = 6; g.fillStyle = '#fff'; g.fillText(text, w / 2, h / 2);
  return new THREE.CanvasTexture(c);
}
const slideSignTex = textTex('\u25BC SLIDE \u25BC', '#ff3df0', 512, 128, 'italic 900 70px "Trebuchet MS", Arial, sans-serif');
function makeGlow(stops) {
  return canvasTex(128, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    stops.forEach(([p, c]) => gr.addColorStop(p, c));
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  }, false);
}
const glowOrange = makeGlow([[0, 'rgba(255,170,60,.95)'], [0.35, 'rgba(255,90,40,.35)'], [1, 'rgba(255,60,40,0)']]);
const glowYellow = makeGlow([[0, 'rgba(255,255,200,1)'], [0.3, 'rgba(255,230,60,.7)'], [1, 'rgba(255,210,40,0)']]);
const glowCyan = makeGlow([[0, 'rgba(210,255,255,.95)'], [0.3, 'rgba(90,240,255,.45)'], [1, 'rgba(60,220,255,0)']]);
const sunTex = canvasTex(256, (g, s) => {
  const gr = g.createLinearGradient(0, 0, 0, s);
  gr.addColorStop(0, '#ffe45a'); gr.addColorStop(0.5, '#ff7a3a'); gr.addColorStop(1, '#ff2fa8');
  g.fillStyle = gr; g.beginPath(); g.arc(s / 2, s / 2, s * 0.46, 0, Math.PI * 2); g.fill();
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 6; i++) g.fillRect(0, s * 0.52 + i * s * 0.08, s, 3 + i * 2.2);
}, false);

function iconTex(draw, color) {
  return canvasTex(128, (g, s) => {
    g.fillStyle = 'rgba(0,0,0,.55)'; g.beginPath(); g.arc(64, 64, 58, 0, 7); g.fill();
    g.lineWidth = 6; g.strokeStyle = color; g.beginPath(); g.arc(64, 64, 56, 0, 7); g.stroke();
    g.fillStyle = color; g.strokeStyle = color; g.lineJoin = 'round'; g.lineCap = 'round';
    draw(g);
  }, false);
}
const iconTexes = {
  heart: iconTex((g) => { g.beginPath(); g.moveTo(64, 98); g.bezierCurveTo(16, 62, 26, 26, 64, 46); g.bezierCurveTo(102, 26, 112, 62, 64, 98); g.fill(); }, '#ff4d6d'),
  shield: iconTex((g) => { g.beginPath(); g.moveTo(64, 26); g.lineTo(98, 40); g.lineTo(94, 72); g.quadraticCurveTo(80, 94, 64, 102); g.quadraticCurveTo(48, 94, 34, 72); g.lineTo(30, 40); g.closePath(); g.fill(); }, '#4de6ff'),
  magnet: iconTex((g) => { g.lineWidth = 15; g.beginPath(); g.arc(64, 62, 26, Math.PI, 0); g.lineTo(90, 96); g.moveTo(38, 62); g.lineTo(38, 96); g.stroke(); }, '#ffd23f'),
  surge: iconTex((g) => { g.beginPath(); g.moveTo(74, 22); g.lineTo(40, 70); g.lineTo(62, 70); g.lineTo(52, 108); g.lineTo(88, 56); g.lineTo(66, 56); g.closePath(); g.fill(); }, '#b8ff5a'),
};

const matFloor = new THREE.MeshBasicMaterial({ map: gridTex });
const matBrick = new THREE.MeshBasicMaterial({ map: brickTex });
const matStripe = new THREE.MeshBasicMaterial({ map: stripeTex });
const matSmash = new THREE.MeshBasicMaterial({ map: hatchTex, color: 0x59e8ff, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending });
const matWall = new THREE.MeshBasicMaterial({ color: 0x0a1a3a, side: THREE.DoubleSide });
const matBuilding = new THREE.MeshBasicMaterial({ color: 0x070818 });
const matSpike = new THREE.MeshBasicMaterial({ color: 0x3a0a10 });
const lineLethal = new THREE.LineBasicMaterial({ color: 0xff5a3c });
const lineSmash = new THREE.LineBasicMaterial({ color: 0x9ffff4 });
const lineWall = new THREE.LineBasicMaterial({ color: 0x2fb8ff });
const lineAmber = new THREE.LineBasicMaterial({ color: 0xffa21a });
const lineCoin = new THREE.LineBasicMaterial({ color: 0xfff2a0 });
const buildingLines = [0xff3df0, 0x3dd9ff, 0x9b6bff].map((c) => new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.8 }));
const matChevRed = new THREE.MeshBasicMaterial({ map: chevTex, color: 0xff3b2e, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending });
const matChevAmber = new THREE.MeshBasicMaterial({ map: chevTex, color: 0xffb02e, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending });
const matChevGreen = new THREE.MeshBasicMaterial({ map: chevTex, color: 0x5aff9a, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending });
const matChevMag = new THREE.MeshBasicMaterial({ map: chevTex, color: 0xff3df0, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
const matBrickDS = new THREE.MeshBasicMaterial({ map: brickTex, side: THREE.DoubleSide });
const matTube = new THREE.MeshBasicMaterial({ map: gridTex, side: THREE.BackSide });
const matTubeRing = new THREE.MeshBasicMaterial({ color: 0x5aff9a, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const matMagBar = new THREE.MeshBasicMaterial({ color: 0xff3df0 });
const matSlit = new THREE.MeshBasicMaterial({ color: 0xff3df0, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const matMeteor = new THREE.MeshBasicMaterial({ color: 0x3a0a10 });
const lavaTex = canvasTex(256, (g, s) => {
  g.fillStyle = '#5a0c04'; g.fillRect(0, 0, s, s);
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 46; i++) {
    const x = Math.random() * s, y = Math.random() * s, r = 12 + Math.random() * 30;
    for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) {           // draw wrapped copies so the tile is seamless
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      gr.addColorStop(0, 'rgba(255,190,60,.85)'); gr.addColorStop(0.45, 'rgba(255,90,20,.45)'); gr.addColorStop(1, 'rgba(255,60,10,0)');
      g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    }
  }
});
const matLava = new THREE.MeshBasicMaterial({ map: lavaTex });
const matObsidian = new THREE.MeshBasicMaterial({ color: 0x33222b });
const lineLava = new THREE.LineBasicMaterial({ color: 0xffa040 });
const matChevLava = new THREE.MeshBasicMaterial({ map: chevTex, color: 0xff5a1a, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
const matBubble = new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false });
const matBubbleWire = new THREE.MeshBasicMaterial({ color: 0xffd060, wireframe: true, transparent: true, opacity: 0.7 });
const bubbleGeo = new THREE.SphereGeometry(0.9, 14, 10);
const matPlat = new THREE.MeshBasicMaterial({ color: 0x1d2a3a });
const linePlat = new THREE.LineBasicMaterial({ color: 0x8dff6a });
const matSpringPad = new THREE.MeshBasicMaterial({ color: 0xffd23f });
const lineSpring = new THREE.LineBasicMaterial({ color: 0xfff2a0 });
const springBaseGeo = new THREE.CylinderGeometry(1.0, 1.0, 0.16, 14);
const springCoilGeo = (() => { const pts = []; for (let i = 0; i < 7; i++) { const a0 = i * 1.2, a1 = (i + 1) * 1.2, y0 = 0.16 + i * 0.07, y1 = 0.16 + (i + 1) * 0.07; pts.push(Math.cos(a0) * 0.5, y0, Math.sin(a0) * 0.5, Math.cos(a1) * 0.5, y1, Math.sin(a1) * 0.5); } return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); })();
const matChevLime = new THREE.MeshBasicMaterial({ map: chevTex, color: 0xb8ff5a, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
const matMetal = new THREE.MeshBasicMaterial({ color: 0x252b36 });
const barrelGeo = new THREE.CylinderGeometry(0.42, 0.5, 1.5, 10).rotateZ(Math.PI / 2);
const sawGeo = new THREE.CylinderGeometry(1, 1, 0.3, 16).rotateX(Math.PI / 2), sawRimGeo = new THREE.TorusGeometry(1, 0.11, 6, 20);
const matSawFill = new THREE.MeshBasicMaterial({ color: 0x2a1308 });
const matOrb = new THREE.MeshBasicMaterial({ color: 0xff5a2a, transparent: true, opacity: 0.92 });
const matOrbWire = new THREE.MeshBasicMaterial({ color: 0xffe0a0, wireframe: true });
const sightMat = new THREE.MeshBasicMaterial({ color: 0xff3b2e, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });   // laser sight beam
const muzzleRingGeo = new THREE.TorusGeometry(0.5, 0.09, 6, 14).rotateY(Math.PI / 2), matMuzzleRing = new THREE.MeshBasicMaterial({ color: 0xff8a2a });
const crushPadGeo = new THREE.PlaneGeometry(2.6, 2.6).rotateX(-Math.PI / 2);
const matRoller = new THREE.MeshBasicMaterial({ color: 0x2a0a10 }), matRollerWire = new THREE.MeshBasicMaterial({ color: 0xff3b2e, wireframe: true });
const matHopper = new THREE.MeshBasicMaterial({ color: 0x0f3a22 }), matHopperWire = new THREE.MeshBasicMaterial({ color: 0x7dff6a, wireframe: true });
const decorMats = [0, 1, 2].map(() => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
const beamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const beamGeo = new THREE.ConeGeometry(2.4, 48, 12, 1, true).translate(0, 24, 0);
const dustN = 160, dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute('position', new THREE.Float32BufferAttribute(Array.from({ length: dustN * 3 }, (_, i) => i % 3 === 0 ? rnd(-16, 16) : i % 3 === 1 ? rnd(0.3, 10) : rnd(-80, 14)), 3));
const dustMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2.4, sizeAttenuation: false, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
const dust = new THREE.Points(dustGeo, dustMat); dust.frustumCulled = false; scene.add(dust);
const signMat = new THREE.SpriteMaterial({ map: slideSignTex, transparent: true, depthWrite: false });
const styleSignTex = textTex('\u00BB STYLE SHIFT \u00AB', '#ffffff', 640, 128, 'italic 900 62px "Trebuchet MS", Arial, sans-serif');
const matPrism = new THREE.MeshBasicMaterial({ map: hatchTex, color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending });
const matPrismSolid = new THREE.MeshBasicMaterial({ color: 0xffffff });
const linePrism = new THREE.LineBasicMaterial({ color: 0xffffff });
const matChevPrism = new THREE.MeshBasicMaterial({ map: chevTex, color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
const signPrismMat = new THREE.SpriteMaterial({ map: styleSignTex, transparent: true, depthWrite: false });

const geoCache = new Map();
function boxGeo(w, h, d) {
  const k = w + 'x' + h + 'x' + d;
  let g = geoCache.get(k);
  if (!g) {
    g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      const f = Math.floor(i / 4);              // 0,1: ±x  2,3: ±y  4,5: ±z
      const su = f < 2 ? d : w, sv = f < 2 ? h : (f < 4 ? d : h);
      uv.setXY(i, uv.getX(i) * su / TILE, uv.getY(i) * sv / TILE);
    }
    g.userData.edges = new THREE.EdgesGeometry(g);
    geoCache.set(k, g);
  }
  return g;
}
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitEdges = new THREE.EdgesGeometry(unitBox);
const unitPlane = new THREE.PlaneGeometry(1, 1), unitPlaneEdges = new THREE.EdgesGeometry(unitPlane);
const spikeGeo = new THREE.ConeGeometry(0.46, 1, 4); spikeGeo.translate(0, 0.5, 0); spikeGeo.rotateY(Math.PI / 4);
const spikeEdges = new THREE.EdgesGeometry(spikeGeo);
const coinGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.07, 14); coinGeo.rotateX(Math.PI / 2);
const coinEdges = new THREE.EdgesGeometry(coinGeo);
const matCoin = new THREE.MeshBasicMaterial({ color: 0xffc928 });
const domeGeo = new THREE.SphereGeometry(0.9, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
const droneGeo = new THREE.OctahedronGeometry(0.75);
const ringGeo = new THREE.TorusGeometry(0.98, 0.045, 4, 20); ringGeo.rotateX(Math.PI / 2);
const meteorGeo = new THREE.IcosahedronGeometry(1.05, 0), meteorEdges = new THREE.EdgesGeometry(meteorGeo);
const shadowDiscGeo = new THREE.CircleGeometry(1.8, 28).rotateX(-Math.PI / 2);
const shadowRingGeo = new THREE.RingGeometry(1.55, 1.85, 32).rotateX(-Math.PI / 2);
const trailGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 16, 0, -0.5, 0, 0, -0.9, 11, 0.3, 0.5, 0, 0, 0.9, 11, -0.3, 0, 0, 0.5, 0.2, 9, 1.1], 3));
const trailMat = new THREE.LineBasicMaterial({ color: 0xffa04a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending });
const tubeRingGeo = new THREE.RingGeometry(TUBE_R - 0.25, TUBE_R + 0.05, 40);

function spriteMat(tex, color) {
  return new THREE.SpriteMaterial({ map: tex, color: color === undefined ? 0xffffff : color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
}
function sprite(tex, scale, color) {
  const s = new THREE.Sprite(spriteMat(tex, color)); s.scale.set(scale, scale, 1); return s;
}

/* ===================================================================== */
/* ball, shadow, backdrop, streaks, particles                             */
/* ===================================================================== */
const ball = new THREE.Group(); scene.add(ball);
const ballCore = new THREE.Mesh(new THREE.SphereGeometry(R, 20, 14), new THREE.MeshBasicMaterial({ map: ballTex }));
const ballWire = new THREE.Mesh(new THREE.SphereGeometry(R * 1.035, 12, 9), new THREE.MeshBasicMaterial({ color: 0xfff1c9, wireframe: true, transparent: true, opacity: 0.55 }));
ballCore.add(ballWire);
const ballGlow = sprite(glowOrange, 3.4);
ball.add(ballCore, ballGlow);

const shadowMat = new THREE.MeshBasicMaterial({ color: 0x7dfff0, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
const shadow = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.52, 28).rotateX(-Math.PI / 2), shadowMat);
scene.add(shadow);

const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, transparent: true, depthWrite: false, fog: false }));
sun.scale.set(120, 120, 1); sun.renderOrder = -10; scene.add(sun);
const moonTex = canvasTex(256, (g, s) => {
  const gr = g.createRadialGradient(s / 2, s / 2, s * 0.2, s / 2, s / 2, s * 0.5);
  gr.addColorStop(0, 'rgba(220,235,255,.35)'); gr.addColorStop(1, 'rgba(220,235,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s);
  g.fillStyle = '#e8f0ff'; g.beginPath(); g.arc(s / 2, s / 2, s * 0.27, 0, 7); g.fill();
  g.fillStyle = 'rgba(120,140,190,.35)';
  [[0.45, 0.45, 0.05], [0.58, 0.55, 0.07], [0.5, 0.63, 0.04]].forEach(([x, y, r]) => { g.beginPath(); g.arc(s * x, s * y, s * r, 0, 7); g.fill(); });
}, false);
const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, transparent: true, depthWrite: false, fog: false, opacity: 0 }));
moon.scale.set(70, 70, 1); moon.renderOrder = -10; scene.add(moon);
const SKY_R = 205;
const skyGeo = new THREE.SphereGeometry(SKY_R, 22, 14);
skyGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(skyGeo.attributes.position.count * 3), 3));
const dome = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
dome.renderOrder = -20; dome.frustumCulled = false; scene.add(dome);
const starPts = [];
for (let i = 0; i < 260; i++) { const a = rnd(0, Math.PI * 2), y = rnd(0.08, 1), r = Math.sqrt(1 - y * y); starPts.push(Math.cos(a) * r * 195, y * 195, Math.sin(a) * r * 195); }
const stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(starPts, 3)),
  new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
stars.frustumCulled = false; stars.renderOrder = -15; scene.add(stars);

/* ---- time of day / colour palettes: the world drifts through these every PAL_LEN metres ---- */
const hex = (h) => [(h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255];
const PALETTES = [
  { name: 'NEON DUSK',   top: hex(0x0a0620), bot: hex(0x4a1450), grid: hex(0x46e1ff), a: hex(0xff3df0), b: hex(0x3dd9ff), c: hex(0x9b6bff), sun: 1,    sunY: 34, tint: hex(0xffffff), moon: 0,    stars: 0.2 },
  { name: 'MIDNIGHT',    top: hex(0x01020a), bot: hex(0x0b1238), grid: hex(0x5aa0ff), a: hex(0x6a8bff), b: hex(0x3dd9ff), c: hex(0xb26bff), sun: 0,    sunY: 10, tint: hex(0xffffff), moon: 1,    stars: 1 },
  { name: 'DAWN BREAK',  top: hex(0x1a1650), bot: hex(0xc2507a), grid: hex(0x5af0d0), a: hex(0xffa0c0), b: hex(0x7dfff0), c: hex(0xffd23f), sun: 0.95, sunY: 22, tint: hex(0xffe3c8), moon: 0,    stars: 0.3 },
  { name: 'GOLDEN HOUR', top: hex(0x13225a), bot: hex(0xb86428), grid: hex(0xffd060), a: hex(0xff8a1f), b: hex(0xffd23f), c: hex(0xff5a8a), sun: 1,    sunY: 58, tint: hex(0xfff0b0), moon: 0,    stars: 0 },
  { name: 'ACID RAIN',   top: hex(0x021208), bot: hex(0x0c4a2a), grid: hex(0x8dff6a), a: hex(0xb8ff5a), b: hex(0x3dffb0), c: hex(0x3dd9ff), sun: 0,    sunY: 10, tint: hex(0xffffff), moon: 0.75, stars: 0.6 },
  { name: 'VAPORWAVE',   top: hex(0x14052e), bot: hex(0x8a2a8a), grid: hex(0xff6ad5), a: hex(0xff3df0), b: hex(0x7df9ff), c: hex(0xffd23f), sun: 1,    sunY: 26, tint: hex(0xffb0ff), moon: 0,    stars: 0.25 },
];
const PAL_LEN = 1000, PAL_FADE = 240;
const cur = { top: [0, 0, 0], bot: [0, 0, 0], grid: [0, 0, 0], a: [0, 0, 0], b: [0, 0, 0], c: [0, 0, 0], tint: [1, 1, 1], sun: 1, sunY: 30, moon: 0, stars: 0, idx: -1, key: '' };
const mix3 = (o, a, b, t) => { for (let k = 0; k < 3; k++) o[k] = a[k] + (b[k] - a[k]) * t; };
const setC = (col, a, m) => col.setRGB(a[0] * (m || 1), a[1] * (m || 1), a[2] * (m || 1));
function paintDome() {
  const pos = skyGeo.attributes.position, col = skyGeo.attributes.color;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / SKY_R;
    if (y <= 0) { col.setXYZ(i, cur.bot[0] * 0.7, cur.bot[1] * 0.7, cur.bot[2] * 0.7); continue; }
    const h = Math.pow(y, 0.5);
    col.setXYZ(i, lerp(cur.bot[0], cur.top[0], h), lerp(cur.bot[1], cur.top[1], h), lerp(cur.bot[2], cur.top[2], h));
  }
  col.needsUpdate = true;
}
function applyPalette(d) {
  const i = Math.floor(d / PAL_LEN);
  const f0 = clamp((d - i * PAL_LEN - (PAL_LEN - PAL_FADE)) / PAL_FADE, 0, 1), t = f0 * f0 * (3 - 2 * f0);
  const A = PALETTES[i % PALETTES.length], B = PALETTES[(i + 1) % PALETTES.length];
  if (i !== cur.idx) { const first = cur.idx < 0; cur.idx = i; if (!first && mode === 'play') pop(A.name, 'cyan'); }
  const key = i + ':' + t.toFixed(3);
  if (key === cur.key) return;
  cur.key = key;
  for (const k of ['top', 'bot', 'grid', 'a', 'b', 'c', 'tint']) mix3(cur[k], A[k], B[k], t);
  for (const k of ['sun', 'sunY', 'moon', 'stars']) cur[k] = lerp(A[k], B[k], t);
  setC(scene.fog.color, cur.bot, 0.8); setC(scene.background, cur.bot, 0.8);
  setC(matFloor.color, cur.grid); setC(matTube.color, cur.grid); setC(lineWall.color, cur.grid); setC(matWall.color, cur.grid, 0.12);
  setC(buildingLines[0].color, cur.a); setC(buildingLines[1].color, cur.b); setC(buildingLines[2].color, cur.c);
  matBuilding.color.setRGB(cur.bot[0] * 0.16 + 0.01, cur.bot[1] * 0.16 + 0.01, cur.bot[2] * 0.16 + 0.02);
  setC(sun.material.color, cur.tint); sun.material.opacity = cur.sun; moon.material.opacity = cur.moon; stars.material.opacity = cur.stars;
  setC(decorMats[0].color, cur.a); setC(decorMats[1].color, cur.b); setC(decorMats[2].color, cur.c); setC(beamMat.color, cur.b); setC(dustMat.color, cur.c);
  paintDome();
  if (post.mat) {                                  // watercolor paper: warm in the sun's tint, cool and darker at night
    const night = clamp(cur.moon, 0, 1) * 0.8;
    post.mat.uniforms.uTone.value.set(lerp(lerp(1, cur.tint[0], 0.5), 0.66, night), lerp(lerp(1, cur.tint[1], 0.5), 0.72, night), lerp(lerp(1, cur.tint[2], 0.5), 0.9, night));
  }
}

const streakMat = new THREE.LineBasicMaterial({ color: 0x9ffff4, transparent: true, opacity: 0.2 });
const streaks = [];
for (let i = 0; i < 26; i++) {
  const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, -7], 3));
  const l = new THREE.LineSegments(g, streakMat); l.userData = { d: 0 };
  scene.add(l); streaks.push(l);
}
function placeStreak(s, ahead) {
  const side = Math.random() < 0.5 ? -1 : 1;
  s.userData.d = P.d + ahead + rnd(0, 70);
  s.position.set(side * rnd(2.2, 9.5), rnd(0.3, 7), -s.userData.d);
}

const shardGeo = new THREE.BoxGeometry(0.3, 0.05, 0.2);
const shardMats = {
  green: new THREE.MeshBasicMaterial({ color: 0x7dff6a }),
  cyan: new THREE.MeshBasicMaterial({ color: 0x9ffff4 }), red: new THREE.MeshBasicMaterial({ color: 0xff5a3c }),
  gold: new THREE.MeshBasicMaterial({ color: 0xffd23f }), mag: new THREE.MeshBasicMaterial({ color: 0xff3df0 }),
  orange: new THREE.MeshBasicMaterial({ color: 0xff8a1f }), white: new THREE.MeshBasicMaterial({ color: 0xffffff }),
};
const shards = [];
for (let i = 0; i < 180; i++) {
  const m = new THREE.Mesh(shardGeo, shardMats.cyan); m.visible = false; scene.add(m);
  shards.push({ m, vx: 0, vy: 0, vz: 0, life: 0, max: 1, rx: 0, ry: 0 });
}
let shardIdx = 0;
function burst(x, y, d, color, n, spd, up) {
  for (let i = 0; i < n; i++) {
    const s = shards[shardIdx]; shardIdx = (shardIdx + 1) % shards.length;
    s.m.material = shardMats[color] || shardMats.cyan;
    s.m.position.set(x + rnd(-0.3, 0.3), y + rnd(-0.3, 0.3), -d + rnd(-0.3, 0.3));
    const a = rnd(0, Math.PI * 2), sp = rnd(0.3, 1) * spd;
    s.vx = Math.cos(a) * sp; s.vz = Math.sin(a) * sp * 0.8; s.vy = rnd(0.2, 1) * spd * 0.7 + (up || 0);
    s.life = s.max = rnd(0.55, 1.1); s.rx = rnd(-12, 12); s.ry = rnd(-12, 12);
    s.m.visible = true; s.m.scale.setScalar(1);
  }
}
function updateShards(dt) {
  for (const s of shards) {
    if (!s.m.visible) continue;
    s.life -= dt;
    if (s.life <= 0) { s.m.visible = false; continue; }
    s.vy -= 24 * dt;
    s.m.position.x += s.vx * dt; s.m.position.y += s.vy * dt; s.m.position.z += s.vz * dt;
    if (s.m.position.y < 0.03) { s.m.position.y = 0.03; s.vy *= -0.35; }
    s.m.rotation.x += s.rx * dt; s.m.rotation.y += s.ry * dt;
    s.m.scale.setScalar(Math.min(1, s.life / s.max * 1.6));
  }
}

const waves = [];
for (let i = 0; i < 3; i++) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.88, 1, 44).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x9ffff4, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  m.visible = false; scene.add(m); waves.push({ m, t: 0, life: 0 });
}
function wave(x, d, color, size, y) {
  const w = waves.find((q) => !q.m.visible) || waves[0];
  w.m.position.set(x, y === undefined ? 0.06 : y, -d); w.t = 0; w.life = 0.32; w.size = size || 3.8; w.m.visible = true; w.m.material.color.setHex(color || 0x9ffff4);
}
function updateWaves(dt) {
  for (const w of waves) {
    if (!w.m.visible) continue;
    w.t += dt; const k = w.t / w.life;
    if (k >= 1) { w.m.visible = false; continue; }
    w.m.scale.setScalar(0.4 + k * w.size); w.m.material.opacity = (1 - k) * 0.9;
  }
}

/* ===================================================================== */
/* world: entities, boxes, items, floor segments                          */
/* ===================================================================== */
const world = {
  ents: [], boxes: [], items: [], enemies: [], holes: [], hints: [], segs: [], tubes: [], falls: [], bubbles: [], plats: [], cannons: [], hazards: [], wallOver: [], blinkers: [], beams: [],
  genD: 0, segD: 0, patCount: 0, nextStyleD: STYLE_EVERY, intro: [], sinceBreather: 0, lastType: '', time: 0, cullT: 0, attract: true,
};

function clearWorld() {
  for (const e of world.ents.slice()) removeEnt(e);
  for (const it of world.items) { scene.remove(it.m); if (it.k !== 'coin') it.m.material.dispose(); }
  for (const s of world.segs) removeSeg(s);
  world.ents.length = world.boxes.length = world.items.length = world.enemies.length = world.holes.length = world.hints.length = world.segs.length = world.tubes.length = world.falls.length = world.bubbles.length = world.plats.length = world.cannons.length = world.hazards.length = world.wallOver.length = world.blinkers.length = world.beams.length = 0;
  for (const s of shards) s.m.visible = false;
  for (const w of waves) w.m.visible = false;
}
const ownG = (g) => { g.userData.own = true; return g; };
const ownM = (m) => { m.userData.own = true; return m; };
const mbm = (o) => ownM(new THREE.MeshBasicMaterial(o));
const sphG = (r, w, h) => ownG(new THREE.SphereGeometry(r, w, h));
const bufG = (arr) => ownG(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)));
function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry && o.geometry.userData && o.geometry.userData.own) o.geometry.dispose();
    const m = o.material; if (m && (o.isSprite || (m.userData && m.userData.own))) m.dispose();
  });
}
function newEnt(d) {
  const group = new THREE.Group(); group.position.z = -d; scene.add(group);
  const e = { group, d, dEnd: d, geos: [], mats: [] }; world.ents.push(e); return e;
}
function removeEnt(e) {
  scene.remove(e.group); disposeTree(e.group);
  e.geos.forEach((g) => g.dispose()); e.mats.forEach((m) => m.dispose());
  world.ents = world.ents.filter((q) => q !== e);
  world.falls = world.falls.filter((f) => f.e !== e);
  world.bubbles = world.bubbles.filter((b) => b.e !== e);
  world.boxes = world.boxes.filter((b) => b.e !== e);
  world.enemies = world.enemies.filter((q) => q.e !== e);
  world.plats = world.plats.filter((q) => q.e !== e);
  world.cannons = world.cannons.filter((q) => q.e !== e);
  world.hazards = world.hazards.filter((q) => q.e !== e);
}
function mkBox(kind, w, h, d, parent) {
  const g = boxGeo(w, h, d);
  const m = new THREE.Mesh(g, kind === 'brick' ? matBrick : kind === 'stripe' ? matStripe : kind === 'prism' ? matPrism : matSmash);
  m.add(new THREE.LineSegments(g.userData.edges, kind === 'smash' ? lineSmash : kind === 'prism' ? linePrism : lineLethal));
  parent.add(m);
  return m;
}
/** add a collision box + mesh. y is the BOTTOM of the box, dd the centre distance along the track. */
function addBox(e, t, kind, x, y, dd, w, h, len, extra) {
  const m = kind ? mkBox(kind, w, h, len, e.group) : null;
  if (m) m.position.set(x, y + h / 2, e.d - dd);
  const b = Object.assign({ t, x, y: y + h / 2, d: dd, hx: w / 2, hy: h / 2, hd: len / 2, mesh: m, e, dead: false }, extra);
  world.boxes.push(b);
  e.dEnd = Math.max(e.dEnd, dd + len / 2);
  return b;
}
function coin(x, y, d) {
  const m = new THREE.Mesh(coinGeo, matCoin);
  m.position.set(x, y, -d); scene.add(m);
  world.items.push({ k: 'coin', x, y, d, m, ph: Math.random() * 6 });
}
function pickup(kind, x, y, d) {
  const m = sprite(iconTexes[kind], 1.5); m.position.set(x, y, -d); scene.add(m);
  world.items.push({ k: kind, x, y, d, m, ph: Math.random() * 6 });
}
function chevrons(e, d0, len, mat) {
  const g = new THREE.PlaneGeometry(W - 0.6, len).rotateX(-Math.PI / 2);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (W - 0.6) / 4, uv.getY(i) * len / 4);
  e.geos.push(g);
  const m = new THREE.Mesh(g, mat); m.position.set(0, 0.04, e.d - (d0 - len / 2)); e.group.add(m);
}

/* ---- floor / wall segments ---- */
function mergeBoxes(list) {
  const pos = [], idx = [], edge = [], tri = [[0, 1, 2], [0, 2, 3], [4, 6, 5], [4, 7, 6], [0, 4, 5], [0, 5, 1], [3, 2, 6], [3, 6, 7], [0, 3, 7], [0, 7, 4], [1, 5, 6], [1, 6, 2]];
  const ed = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
  for (const b of list) {
    const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, y0 = b.y - b.h / 2, y1 = b.y + b.h / 2, z0 = b.z - b.d / 2, z1 = b.z + b.d / 2, base = pos.length / 3;
    const c = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
    c.forEach((v) => pos.push(v[0], v[1], v[2])); tri.forEach((t) => idx.push(base + t[0], base + t[1], base + t[2]));
    ed.forEach(([a, e]) => edge.push(...c[a], ...c[e]));
  }
  const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  return { fill: g, edges: new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(edge, 3)) };
}
function removeSeg(s) {
  scene.remove(s.group); s.geos.forEach((g) => g.dispose()); s.mats.forEach((m) => m.dispose());
  world.blinkers = world.blinkers.filter((b) => b.seg !== s); world.beams = world.beams.filter((b) => b.seg !== s);
}
/** wall height varies slowly along the track; patterns can force it taller (cannons) via world.wallOver */
function wallH(d, side) {
  let h = 1.8 + 1.5 * Math.sin(d * 0.0113 + side * 1.7) + 0.9 * Math.sin(d * 0.0291 + 0.6 + side);
  h = Math.round(clamp(h, 1.0, 4.6) * 2) / 2;
  for (const o of world.wallOver) if (d >= o.d0 && d <= o.d1) h = Math.max(h, o.h);
  return h;
}
function decorate(seg, a, b) {
  const add = (m) => seg.group.add(m);
  const lineGeo = (pts) => { const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); seg.geos.push(g); return g; };
  // gantry arch with a row of lights (skipped over stairs so it never clips the climb)
  if (Math.random() < 0.22 && !world.plats.some((p) => p.d1 > a - 6 && p.d0 < b + 6)) {
    const H = 14, dz = a + rnd(8, SEG - 8), pg = boxGeo(0.7, H, 0.7), bg = boxGeo(W + 3, 0.7, 1.0);
    for (const sx of [-1, 1]) { const m = new THREE.Mesh(pg, matBuilding); m.position.set(sx * (HALF + 1.1), H / 2, -dz); m.add(new THREE.LineSegments(pg.userData.edges, buildingLines[1])); add(m); }
    const bm = new THREE.Mesh(bg, matBuilding); bm.position.set(0, H, -dz); bm.add(new THREE.LineSegments(bg.userData.edges, buildingLines[0])); add(bm);
    const lm = mergeBoxes(Array.from({ length: 7 }, (_, i) => ({ x: -HALF - 0.4 + i * ((W + 0.8) / 6), y: H - 0.5, z: -dz, w: 0.55, h: 0.25, d: 0.55 }))); seg.geos.push(lm.fill, lm.edges); add(new THREE.Mesh(lm.fill, decorMats[0]));
  }
  for (const side of [-1, 1]) {
    if (Math.random() < 0.45) {                                           // holographic billboard
      const w = rnd(3, 5), h = rnd(2, 3.2), k = Math.floor(rnd(0, 3));
      const bm = new THREE.Mesh(unitPlane, decorMats[k]); bm.scale.set(w, h, 1);
      bm.position.set(side * (HALF + rnd(3.5, 7)), rnd(4.5, 9), -(a + rnd(0, SEG))); bm.rotation.y = side < 0 ? Math.PI / 2 - 0.35 : -Math.PI / 2 + 0.35;
      const gl = [-0.5, -0.5, 0.01, 0.5, -0.5, 0.01, 0.5, -0.5, 0.01, 0.5, 0.5, 0.01, 0.5, 0.5, 0.01, -0.5, 0.5, 0.01, -0.5, 0.5, 0.01, -0.5, -0.5, 0.01];
      for (let i = 0; i < 3; i++) { const y = rnd(-0.35, 0.35), x0 = rnd(-0.4, 0), x1 = rnd(0.05, 0.4); gl.push(x0, y, 0.01, x1, y, 0.01); }
      bm.add(new THREE.LineSegments(lineGeo(gl), buildingLines[k])); add(bm);
    }
    if (Math.random() < 0.5) {                                            // pylon with a blinking light
      const H = rnd(8, 20), px = side * (HALF + rnd(2, 9)), pz = a + rnd(0, SEG), k = Math.floor(rnd(0, 3));
      const m = new THREE.LineSegments(unitEdges, buildingLines[k]); m.scale.set(0.35, H, 0.35); m.position.set(px, H / 2, -pz); add(m);
      const sp = sprite(glowOrange, 2.6); seg.mats.push(sp.material); sp.position.set(px, H + 0.3, -pz); add(sp);
      world.blinkers.push({ s: sp, ph: rnd(0, 6.3), seg });
    }
    if (Math.random() < 0.2) {                                            // sweeping searchlight
      const m = new THREE.Mesh(beamGeo, beamMat); m.position.set(side * (HALF + rnd(6, 16)), 0, -(a + rnd(0, SEG))); m.rotation.z = -side * 0.35; add(m);
      world.beams.push({ m, ph: rnd(0, 6.3), a0: -side * 0.35, seg });
    }
    if (Math.random() < 0.12) {                                           // distant spire
      const h = rnd(40, 62), m = new THREE.LineSegments(unitEdges, buildingLines[2]); m.scale.set(1.4, h, 1.4);
      m.position.set(side * (HALF + rnd(14, 34)), h / 2, -(a + rnd(0, SEG))); add(m);
    }
  }
  const dash = []; for (let z = 0; z < SEG; z += 4) for (const sx of [-1, 1]) dash.push(sx * (HALF - 0.03), 0.07, -(a + z), sx * (HALF - 0.03), 0.07, -(a + z + 2));
  add(new THREE.LineSegments(lineGeo(dash), buildingLines[1]));          // dashed light strip along both wall bases
}
function buildSegment(a) {
  const b = a + SEG;
  const seg = { a, b, group: new THREE.Group(), geos: [], mats: [] };
  scene.add(seg.group);
  const piece = (x0, x1, d0, d1) => {
    if (x1 - x0 < 0.05 || d1 - d0 < 0.05) return;
    const g = new THREE.PlaneGeometry(x1 - x0, d1 - d0).rotateX(-Math.PI / 2);
    g.translate((x0 + x1) / 2, 0, -(d0 + d1) / 2);
    const pos = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 4, -pos.getZ(i) / 4);
    seg.geos.push(g); seg.group.add(new THREE.Mesh(g, matFloor));
  };
  const hs = world.holes.filter((h) => h.d1 > a && h.d0 < b).sort((p, q) => p.d0 - q.d0);
  let cur = a;
  for (const h of hs) {
    const d0 = Math.max(h.d0, a), d1 = Math.min(h.d1, b);
    if (d0 > cur) piece(-HALF, HALF, cur, d0);
    piece(-HALF, h.x0, d0, d1); piece(h.x1, HALF, d0, d1);
    cur = Math.max(cur, d1);
    if (h.d0 >= a && !h.tube && !h.lava) {                                   // pit outline once, in the segment where it starts
      const r = (y) => [[h.x0, y, -h.d0], [h.x1, y, -h.d0], [h.x1, y, -h.d0], [h.x1, y, -h.d1], [h.x1, y, -h.d1], [h.x0, y, -h.d1], [h.x0, y, -h.d1], [h.x0, y, -h.d0]];
      const pts = [].concat(r(0.02), r(-6));
      [[h.x0, -h.d0], [h.x1, -h.d0], [h.x1, -h.d1], [h.x0, -h.d1]].forEach(([x, z]) => pts.push([x, 0.02, z], [x, -6, z]));
      const lg = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3));
      seg.geos.push(lg); seg.group.add(new THREE.LineSegments(lg, lineAmber));
    }
  }
  if (cur < b) piece(-HALF, HALF, cur, b);

  for (const side of [-1, 1]) {                         // side walls (varying height) with ticks
    const ticks = [], blocks = [];
    for (let i = 0; i < SEG / 10; i++) {
      const dm = a + 5 + i * 10, h = wallH(dm, side);
      blocks.push({ x: side * (HALF + 0.3), y: h / 2, z: -dm, w: 0.6, h, d: 10 });
      for (const z of [0, 5]) { const hh = wallH(dm - 5 + z, side); ticks.push(side * HALF, 0, -(dm - 5 + z), side * HALF, hh, -(dm - 5 + z)); }
    }
    const mb = mergeBoxes(blocks); seg.geos.push(mb.fill, mb.edges);          // the whole wall run is one mesh + one outline
    const wm = new THREE.Mesh(mb.fill, matWall); wm.add(new THREE.LineSegments(mb.edges, lineWall)); seg.group.add(wm);
    const lg = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(ticks, 3));
    seg.geos.push(lg); seg.group.add(new THREE.LineSegments(lg, lineWall));
    for (let i = 0; i < 2; i++) {                       // distant skyline
      const w = rnd(4, 10), h = rnd(6, 34), dp = rnd(6, 14);
      const bm = new THREE.Mesh(unitBox, matBuilding);
      bm.scale.set(w, h, dp); bm.position.set(side * (HALF + rnd(4, 24) + w / 2), h / 2 - 0.5, -(a + rnd(0, SEG)));
      bm.add(new THREE.LineSegments(unitEdges, pick(buildingLines))); seg.group.add(bm);
    }
  }
  decorate(seg, a, b);
  world.segs.push(seg);
}
function hasFloor(x, d) {
  for (const h of world.holes) {
    if (d > h.d0 && d < h.d1 && x > h.x0 && x < h.x1) {
      if (h.stones) return h.stones.some((s) => d > s.d0 && d < s.d1 && x > s.x0 && x < s.x1);   // lava: only the stones are solid
      return false;
    }
  }
  return true;
}
/** the platform (if any) whose top the ball's feet can stand on: top no more than STEP_TOL above the feet */
function platSupport(x, d, bottom) {
  let best = null;
  for (const p of world.plats) {
    if (d > p.d0 && d < p.d1 && x > p.x0 - 0.25 && x < p.x1 + 0.25 && p.top <= bottom + STEP_TOL && (!best || p.top > best.top)) best = p;
  }
  return best;
}
function lavaAt(d) { for (const h of world.holes) if (h.lava && d > h.d0 && d < h.d1) return h; return null; }
function stoneAt(x, d) { const h = lavaAt(d); return h ? (h.stones.find((s) => d > s.d0 && d < s.d1 && x > s.x0 && x < s.x1) || null) : null; }

/* ===================================================================== */
/* enemies                                                                */
/* ===================================================================== */
function makeBeetle() {
  const g = new THREE.Group();
  const dome = new THREE.Mesh(domeGeo, mbm({ color: 0x1a0b2e })); dome.scale.set(1, 0.8, 1.15);
  const wire = new THREE.Mesh(domeGeo, mbm({ color: 0xff3df0, wireframe: true })); wire.scale.set(1.02, 0.82, 1.17);
  const weak = sprite(glowYellow, 1.7); weak.position.set(0, 0.8, 0);
  const core = new THREE.Mesh(sphG(0.17, 8, 6), mbm({ color: 0xffffcc })); core.position.set(0, 0.74, 0);
  const legs = [];
  for (const s of [-1, 1]) for (const z of [-0.6, 0, 0.6]) legs.push(s * 0.8, 0.05, z, s * 1.25, 0.3, z * 1.3);
  const lg = bufG(legs);
  g.add(dome, wire, weak, core, new THREE.LineSegments(lg, ownM(new THREE.LineBasicMaterial({ color: 0xff3df0 }))));
  g.userData.weak = weak;
  return g;
}
function makeDrone() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(droneGeo, mbm({ color: 0x1e0d05 })); body.scale.set(1.2, 0.8, 1);
  const wire = new THREE.Mesh(droneGeo, mbm({ color: 0xff8a1f, wireframe: true })); wire.scale.set(1.24, 0.83, 1.03);
  const ring = new THREE.Mesh(ringGeo, mbm({ color: 0xff3df0 }));
  const weak = sprite(glowYellow, 1.6); weak.position.set(0, 0, 0.72);
  const core = new THREE.Mesh(sphG(0.2, 8, 6), mbm({ color: 0xffffcc })); core.position.set(0, 0, 0.66);
  g.add(body, wire, ring, weak, core);
  g.userData.ring = ring; g.userData.weak = weak;
  return g;
}
function makeRoller() {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3, 1), matRoller);
  const wire = new THREE.Mesh(new THREE.IcosahedronGeometry(1.36, 1), matRollerWire);
  const spikes = []; for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; spikes.push(Math.cos(a) * 1.3, Math.sin(a) * 1.3, 0, Math.cos(a) * 1.85, Math.sin(a) * 1.85, 0); }
  const sg = bufG(spikes);
  const spin = new THREE.Group(); spin.add(ball, wire, new THREE.LineSegments(sg, lineLethal)); g.add(spin);
  g.userData.spin = spin; g.userData.weak = { scale: { set() {} } };
  return g;
}
function makeHopper() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(sphG(0.85, 12, 9), matHopper), wire = new THREE.Mesh(sphG(0.89, 9, 7), matHopperWire);
  const legs = []; for (const sx of [-1, 1]) for (const z of [-0.5, 0.5]) legs.push(sx * 0.6, -0.5, z, sx * 1.15, -0.95, z * 1.4);
  const lg = bufG(legs);
  const weak = sprite(glowYellow, 1.7); weak.position.set(0, 0.3, 0.7);
  const eyes = new THREE.Mesh(sphG(0.17, 8, 6), mbm({ color: 0xffffcc })); eyes.position.set(0, 0.3, 0.72);
  g.add(body, wire, new THREE.LineSegments(lg, ownM(new THREE.LineBasicMaterial({ color: 0x7dff6a }))), weak, eyes);
  g.userData.weak = weak;
  return g;
}
function addEnemy(type, d0, x0, amp, spd) {
  const e = newEnt(d0);
  const mesh = type === 'beetle' ? makeBeetle() : type === 'roller' ? makeRoller() : type === 'hopper' ? makeHopper() : makeDrone();
  e.group.add(mesh);
  const baseY = type === 'beetle' ? 0.45 : 1.5;
  const b = type === 'beetle' ? addBox(e, 'beetle', null, x0, 0, d0, 2.6, 1.3, 2.7, {})
    : type === 'roller' ? addBox(e, 'roller', null, x0, 0, d0, 2.6, 2.6, 2.6, {})
    : type === 'hopper' ? addBox(e, 'hopper', null, x0, 0.1, d0, 1.9, 1.9, 1.9, {})
    : addBox(e, 'drone', null, x0, 0.6, d0, 2.3, 1.8, 2.0, {});
  b.mesh = mesh;                                           // the enemy mesh stands in for the box mesh
  mesh.scale.setScalar(type === 'roller' ? 1 : type === 'hopper' ? 1.2 : 1.45);
  mesh.position.set(x0, type === 'beetle' ? 0 : type === 'roller' ? 1.3 : type === 'hopper' ? 1.05 : 1.5, 0);
  world.enemies.push({ type, e, box: b, mesh, x0, amp, spd, ph: rnd(0, 6.28), baseY });
}
function updateEnemies() {
  for (const en of world.enemies) {
    if (en.box.dead) continue;
    const x = en.x0 + en.amp * Math.sin(world.time * en.spd + en.ph);
    en.box.x = x; en.mesh.position.x = x;
    const pulse = 1.5 + Math.sin(world.time * 8 + en.ph) * 0.25;
    en.mesh.userData.weak.scale.set(pulse, pulse, 1);
    if (en.type === 'drone') {
      const y = 1.5 + 0.22 * Math.sin(world.time * 3 + en.ph);
      en.mesh.position.y = y; en.box.y = y; en.mesh.userData.ring.rotation.y += 0.12;
    } else if (en.type === 'roller') {
      en.mesh.userData.spin.rotation.z = -x * 0.9;                        // rolls as it travels
    } else if (en.type === 'hopper') {
      const y = 1.05 + 2.1 * Math.abs(Math.sin(world.time * 2.6 + en.ph));
      en.mesh.position.y = y; en.box.y = y + 0.05;
    }
  }
}
function killEnemy(b, byDash) {
  if (b.dead) return;
  b.dead = true; b.mesh.visible = false;
  const wx = b.x, wy = (b.t === 'drone' || b.t === 'hopper') ? b.y : 0.6;
  burst(wx, wy, b.d, 'gold', 14, 9); burst(wx, wy, b.d, b.t === 'drone' ? 'orange' : b.t === 'hopper' ? 'green' : 'mag', 16, 8);
  sfx.smash(); shake = Math.max(shake, 0.35);
  award(b.t === 'drone' ? 60 : b.t === 'hopper' ? 60 : 50, b.t === 'drone' ? 'CORE HIT' : b.t === 'hopper' ? 'SQUASHED' : 'CRACKED', 'mag');
  if (byDash) refund('WEAK POINT');
}

/* ===================================================================== */
/* patterns                                                               */
/* ===================================================================== */
const CHEV = 13;
const q4 = (v) => Math.round(v * 4) / 4;      // keep box sizes on a 0.25 grid so shared geometry stays bounded
function pCoins(d0) {
  const n = 9, x0 = rnd(-2, 2), amp = rnd(0.8, 1.8);
  for (let i = 0; i < n; i++) coin(clamp(x0 + Math.sin(i * 0.6) * amp, -LIM, LIM), 0.95, d0 + i * 2.2);
  return n * 2.2;
}
function pGlass(d0) {
  const e = newEnt(d0 + 1);
  addBox(e, 'smash', 'smash', 0, 0, d0 + 1, W, 8.5, 0.8, {});
  for (let i = 0; i < 5; i++) coin(0, 1, d0 + 4 + i * 1.8);
  return 9;
}
function pCubes(d0) {
  const lanes = [-2.7, 0, 2.7], free = Math.floor(Math.random() * 3), e = newEnt(d0 + 1);
  lanes.forEach((x, i) => { if (i === free) { for (let k = 0; k < 4; k++) coin(x, 0.95, d0 + k * 2); } else addBox(e, 'smash', 'smash', x, 0, d0 + 1, 2.3, 2.3, 2.3, { aoe: true }); });
  return 9;
}
function pBrick(d0) {
  const e = newEnt(d0);
  addBox(e, 'lethal', 'brick', 0, 0, d0, W, 1.5, 1.2, {});
  for (let i = 0; i < 7; i++) coin(0, 2.2 + 2.2 * Math.sin(Math.PI * i / 6), d0 - 6 + i * 2);
  return 7;
}
function pGapWall(d0) {
  const e = newEnt(d0), gw = 3.5, gx = q4(rnd(-2, 2));
  const lw = gx - gw / 2 + HALF, rw = HALF - (gx + gw / 2);
  if (lw > 0.1) addBox(e, 'lethal', 'brick', -HALF + lw / 2, 0, d0, lw, 9, 1.4, {});
  if (rw > 0.1) addBox(e, 'lethal', 'brick', HALF - rw / 2, 0, d0, rw, 9, 1.4, {});
  for (let i = 0; i < 4; i++) coin(gx, 0.95, d0 - 3 + i * 2);
  return 7;
}
function pHole(d0, S) {
  const L = clamp(S * 0.55 * rnd(0.95, 1.1), 9, 21);
  const full = Math.random() < 0.7 || diffAt(d0) < 0.12;
  let x0 = -HALF, x1 = HALF;
  if (!full) { if (Math.random() < 0.5) x0 = -HALF + 3.4; else x1 = HALF - 3.4; }
  world.holes.push({ x0, x1, d0, d1: d0 + L });
  const e = newEnt(d0 - CHEV / 2); chevrons(e, d0, CHEV, matChevAmber);
  const cx = (x0 + x1) / 2;
  for (let i = 0; i < 7; i++) coin(clamp(cx, -LIM, LIM), 1.2 + 2.6 * Math.sin(Math.PI * i / 6), d0 - 1 + i * (L + 2) / 6);
  return L + 3;
}
function pSpikes(d0) {
  const e = newEnt(d0 + 1.3);
  let x0 = -HALF, x1 = HALF;
  if (Math.random() < 0.3) { if (Math.random() < 0.5) x0 = -HALF + 3.5; else x1 = HALF - 3.5; }
  const w = x1 - x0, cx = (x0 + x1) / 2;
  for (let r = 0; r < 3; r++) for (let c = 0; c < Math.floor(w / 1.0); c++) {
    const m = new THREE.Mesh(spikeGeo, matSpike);
    m.add(new THREE.LineSegments(spikeEdges, lineLethal));
    m.position.set(x0 + 0.5 + c * (w / Math.floor(w / 1.0)) + 0.0, 0, e.d - (d0 + r * 0.9));
    e.group.add(m);
  }
  addBox(e, 'spike', null, cx, 0, d0 + 0.9, w, 1.0, 2.6, {});
  const mk = newEnt(d0 - CHEV / 2); chevrons(mk, d0, CHEV, matChevRed);
  for (let i = 0; i < 5; i++) coin(clamp(cx, -LIM, LIM), 2 + 1.8 * Math.sin(Math.PI * i / 4), d0 - 2 + i * 1.5);
  return 5;
}
function pGate(d0) {
  const e = newEnt(d0 + 1.5);
  addBox(e, 'lethal', 'stripe', 0, 1.1, d0 + 1.5, W, 8, 3, {});
  // unmistakable "go under" cues, all in the slide button's magenta: glowing lip, lit opening, floating sign, floor chevrons
  const bar = new THREE.Mesh(boxGeo(W, 0.18, 3.1), matMagBar); bar.position.set(0, 1.19, 0); e.group.add(bar);
  const slit = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.2, 1.05), matSlit); slit.position.set(0, 0.55, 1.52); e.group.add(slit); e.geos.push(slit.geometry);
  const sign = new THREE.Sprite(signMat); sign.scale.set(6.4, 1.6, 1); sign.position.set(0, 4.4, 2.2); e.group.add(sign);
  const mk = newEnt(d0 - CHEV / 2); chevrons(mk, d0, CHEV, matChevMag);
  for (let i = 0; i < 5; i++) coin(0, 0.45, d0 + i * 1.2);
  return 7;
}
function pWindow(d0) {
  const e = newEnt(d0), wx = q4(rnd(-2, 2)), ww = 3.5, wh = 3.5;
  const lw = wx - ww / 2 + HALF, rw = HALF - (wx + ww / 2);
  addBox(e, 'lethal', 'brick', -HALF + lw / 2, 0, d0, lw, 9, 1.2, {});
  addBox(e, 'lethal', 'brick', HALF - rw / 2, 0, d0, rw, 9, 1.2, {});
  addBox(e, 'lethal', 'brick', wx, wh, d0, ww, 9 - wh, 1.2, {});
  addBox(e, 'smash', 'smash', wx, 0, d0, ww, wh, 0.5, {});
  for (let i = 0; i < 4; i++) coin(wx, 1.1, d0 + 3 + i * 1.8);
  return 8;
}
function pBeetle(d0, S) {
  const two = diffAt(d0) > 0.45 && Math.random() < 0.5;
  const amp = rnd(1, 2.2);
  addEnemy('beetle', d0, rnd(-LIM + amp, LIM - amp), amp, rnd(1.2, 2));
  if (two) addEnemy('beetle', d0 + 9, rnd(-LIM + amp, LIM - amp), amp, rnd(1.2, 2));
  for (let i = 0; i < 3; i++) coin(0, 3.7, d0 - 2 + i * 2);
  return two ? 13 : 6;
}
function pDrone(d0) {
  const two = diffAt(d0) > 0.5 && Math.random() < 0.5;
  const amp = rnd(1.2, 2.6);
  addEnemy('drone', d0, rnd(-LIM + amp, LIM - amp), amp, rnd(1.4, 2.4));
  if (two) addEnemy('drone', d0 + 8, rnd(-LIM + amp, LIM - amp), amp, rnd(1.4, 2.4));
  return two ? 12 : 5;
}
function pBreather(d0) {
  const n = 9, x0 = rnd(-1.5, 1.5);
  for (let i = 0; i < n; i++) coin(clamp(x0 + Math.sin(i * 0.7) * 1.4, -LIM, LIM), 0.95, d0 + i * 2.2);
  let kind = null;
  const r = Math.random();
  if (P.hearts < P.maxHearts && r < 0.5) kind = 'heart';
  else if (P.shield < 60 && r < 0.75) kind = 'shield';
  else if (r < 0.22) kind = pick(['magnet', 'surge']);
  else if (r < 0.3) kind = 'shield';
  if (kind) pickup(kind, x0, 1.3, d0 + n * 1.1);
  return n * 2.2;
}
/* ---- meteors: a red shadow marks where it lands; get out of it ---- */
function addFall(x, d, T) {
  const e = newEnt(d);
  const dm = new THREE.MeshBasicMaterial({ color: 0xff3b2e, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
  const rm = new THREE.MeshBasicMaterial({ color: 0xff6a3c, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  e.mats.push(dm, rm);
  const disc = new THREE.Mesh(shadowDiscGeo, dm), ring = new THREE.Mesh(shadowRingGeo, rm);
  disc.position.set(x, 0.05, 0); ring.position.set(x, 0.06, 0);
  const m = new THREE.Mesh(meteorGeo, matMeteor); m.add(new THREE.LineSegments(meteorEdges, lineLethal)); m.add(sprite(glowOrange, 4.4));
  m.position.set(x, FALL_H, 0); m.visible = false;
  const trail = new THREE.LineSegments(trailGeo, trailMat); trail.visible = false; trail.position.set(x, FALL_H, 0);
  e.group.add(disc, ring, m, trail);
  world.falls.push({ e, x, d, T, active: false, landed: false, t: 0, y: FALL_H, m, disc, ring, trail });
}
function updateFalls(dt) {
  for (const f of world.falls) {
    if (f.landed) continue;
    if (!f.active) {
      const far = f.d - P.d;
      f.disc.material.opacity = 0.26 + 0.1 * Math.sin(world.time * 7);
      if (far <= 0) f.landed = true;
      else if (far <= curSpeed * f.T) { f.active = true; f.t = 0; f.m.visible = f.trail.visible = true; sfx.whistle(); }
      continue;
    }
    f.t += dt;
    const k = Math.min(1, f.t / f.T);
    f.y = FALL_H * (1 - k * k) + 0.9;
    f.m.position.y = f.y; f.trail.position.y = f.y; f.m.rotation.x += dt * 4; f.m.rotation.z += dt * 3;
    f.disc.material.opacity = 0.35 + 0.5 * k; f.ring.scale.setScalar(1.35 - 0.35 * k); f.ring.material.opacity = 0.5 + 0.5 * k;
    const dx = P.x - f.x, dy = P.y - f.y, dd = P.d - f.d;
    if (dx * dx + dy * dy + dd * dd < 2.2) hurt(HEAVY);          // clipped it on the way down
    if (k >= 1) {
      f.landed = true; f.m.visible = f.trail.visible = false; f.disc.visible = f.ring.visible = false;
      burst(f.x, 0.3, f.d, 'orange', 18, 10); burst(f.x, 0.3, f.d, 'red', 10, 8);
      wave(f.x, f.d, 0xff5a3c, 4.6); sfx.slam(); shake = Math.max(shake, 0.45);
      if (!P.tube && Math.abs(P.x - f.x) < 1.75 && Math.abs(P.d - f.d) < 1.9 && P.y < 2.4) hurt(HEAVY);
    }
  }
}
function pRain(d0, S) {
  const n = 3 + Math.round(diffAt(d0) * 3), sp = Math.max(S * 0.55 + 3, 15);
  let px = rnd(-2.5, 2.5);
  for (let i = 0; i < n; i++) {
    px = clamp(px + rnd(-3.4, 3.4), -LIM, LIM);
    const d = d0 + 8 + i * sp;
    addFall(px, d, 1.0);
    coin(clamp(-px * 0.7 + rnd(-0.5, 0.5), -LIM, LIM), 0.95, d);        // the safe side pays
  }
  return 8 + n * sp;
}

/* ---- speed tube: roll round the inside of a pipe at 1.45x speed; walls have gaps to rotate to, or jump them ---- */
function tubeAt(d) { for (const t of world.tubes) if (d > t.d0 && d < t.d1) return t; return null; }
function pTube(d0, S) {
  const sp = clamp(S * TUBE_BOOST * 0.85, 22, 48), nr = diffAt(d0) > 0.4 ? 4 : 3;
  const first = d0 + 22, d1 = first + (nr - 1) * sp + 24, len = d1 - d0, mid = (d0 + d1) / 2;
  world.holes.push({ x0: -HALF, x1: HALF, d0, d1, tube: true });          // no flat floor in here
  const tb = { d0, d1, rings: [] }; world.tubes.push(tb);
  const e = newEnt(mid); e.dEnd = d1;
  const sg = new THREE.CylinderGeometry(TUBE_R, TUBE_R, len, 28, 1, true); sg.rotateX(Math.PI / 2);
  const uv = sg.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2 * Math.PI * TUBE_R / 4, uv.getY(i) * len / 4);
  sg.translate(0, TUBE_R, 0); e.geos.push(sg);
  e.group.add(new THREE.Mesh(sg, matTube));
  for (const zz of [len / 2, -len / 2]) { const rg = new THREE.Mesh(tubeRingGeo, matTubeRing); rg.position.set(0, TUBE_R, zz); e.group.add(rg); }
  let g = rnd(-1, 1);
  for (let r = 0; r < nr; r++) {
    const dr = first + r * sp;
    if (r > 0) g += rnd(-1.5, 1.5);
    tb.rings.push({ d: dr, g });
    const gw = 0.9, th0 = g + gw, thLen = Math.PI * 2 - gw * 2;           // wall covers everything except the gap
    const rg = new THREE.RingGeometry(TUBE_R - 1.5, TUBE_R - 0.02, 40, 1, th0 - Math.PI / 2, thLen);
    const eg = new THREE.EdgesGeometry(rg); e.geos.push(rg, eg);
    const rm = new THREE.Mesh(rg, matBrickDS); rm.position.set(0, TUBE_R, mid - dr);
    rm.add(new THREE.LineSegments(eg, lineLethal)); e.group.add(rm);
    for (let a = th0 + 0.18; a < th0 + thLen; a += 0.36) {
      const rc = TUBE_R - 0.8;
      addBox(e, 'lethal', null, rc * Math.sin(a), TUBE_R - rc * Math.cos(a) - 0.85, dr, 1.7, 1.7, 1.4, { tube: true });
    }
  }
  const wps = [[d0 + 4, 0]]; tb.rings.forEach((r) => wps.push([r.d, r.g])); wps.push([d1 - 6, tb.rings[nr - 1].g * 0.5]);
  for (let dc = d0 + 6; dc < d1 - 6; dc += 2.4) {                          // coins trace the safe line through the gaps
    let k = 0; while (k < wps.length - 2 && dc > wps[k + 1][0]) k++;
    const t = clamp((dc - wps[k][0]) / (wps[k + 1][0] - wps[k][0]), 0, 1), th = lerp(wps[k][1], wps[k + 1][1], t), rc = TUBE_R - 0.9;
    coin(rc * Math.sin(th), TUBE_R - rc * Math.cos(th), dc);
  }
  const mk = newEnt(d0 - CHEV / 2); chevrons(mk, d0, CHEV, matChevGreen);
  return len + 8;
}
/* ---- lava run: the floor is lava; hop between obsidian stones, dash through rising bubbles ---- */
function addBubble(x, d, T) {
  const e = newEnt(d);
  const m = new THREE.Mesh(bubbleGeo, matBubble); m.add(new THREE.Mesh(bubbleGeo, matBubbleWire)); m.add(sprite(glowOrange, 3.4));
  m.position.set(x, -1.4, 0); m.visible = false; e.group.add(m);
  world.bubbles.push({ e, x, d, T, active: false, done: false, t: 0, y: -1.4, m });
}
function popBubble(b, loud) {
  b.done = true; b.m.visible = false;
  burst(b.x, Math.max(b.y, 0.3), b.d, 'orange', 14, 8); burst(b.x, Math.max(b.y, 0.3), b.d, 'gold', 8, 6);
  if (loud) sfx.pop();
}
function updateBubbles(dt) {
  for (const b of world.bubbles) {
    if (b.done) continue;
    if (!b.active) {
      const far = b.d - P.d;
      if (far <= 0) b.done = true; else if (far <= curSpeed * b.T) { b.active = true; b.m.visible = true; }
      continue;
    }
    b.t += dt;
    b.y = -1.3 + 2.7 * (b.t / b.T);                       // reaches ball height just as the player arrives
    b.m.position.y = b.y; b.m.scale.setScalar(0.88 + 0.12 * Math.sin(b.t * 14));
    if (b.t > b.T * 1.7) { popBubble(b, false); continue; }
    const dx = P.x - b.x, dy = P.y - b.y, dd = P.d - b.d;
    if (dx * dx + dy * dy + dd * dd < 1.8) {
      if (P.dashT > 0) { popBubble(b, true); award(40, 'BUBBLE', 'gold'); if (!P.perfectUsed) { P.perfectUsed = true; refund('BUBBLE'); } }
      else if (P.slam) { popBubble(b, true); award(25, 'POP', 'gold'); }
      else { popBubble(b, true); hurt(LIGHT); }
    }
  }
}
function pLava(d0, S) {
  const n = 5 + Math.round(diffAt(d0) * 3);
  const stones = []; let d = d0, xc = 0;
  for (let i = 0; i < n; i++) {
    const edge = i === 0 || i === n - 1;
    const len = edge ? 10 : q4(clamp(S * 0.55 * rnd(0.85, 1.15), 8, 20));
    const w = edge ? W : q4(rnd(3.5, 5));
    if (!edge) xc = q4(clamp(xc + rnd(-2.6, 2.6), -(HALF - w / 2), HALF - w / 2)); else xc = 0;
    stones.push({ x0: xc - w / 2, x1: xc + w / 2, d0: d, d1: d + len, xc, first: i === 0 });
    d += len;
    if (i < n - 1) d += q4(S * 0.4 * rnd(0.92, 1.08));   // gap: a plain hop falls short, a JUMP clears it
  }
  const d1 = d, len = d1 - d0, hole = { x0: -HALF, x1: HALF, d0, d1, lava: true, stones };
  stones.forEach((st) => { st.z = hole; });
  world.holes.push(hole);
  const e = newEnt((d0 + d1) / 2); e.dEnd = d1;
  const pg = new THREE.PlaneGeometry(W + 0.2, len).rotateX(-Math.PI / 2);
  const uv = pg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (W + 0.2) / 6, uv.getY(i) * len / 6);
  pg.translate(0, -0.32, 0); e.geos.push(pg); e.group.add(new THREE.Mesh(pg, matLava));
  for (const st of stones) {
    const m = new THREE.Mesh(unitBox, matObsidian);
    m.scale.set(st.x1 - st.x0, 0.8, st.d1 - st.d0); m.position.set((st.x0 + st.x1) / 2, -0.4, e.d - (st.d0 + st.d1) / 2);
    m.add(new THREE.LineSegments(unitEdges, lineLava)); e.group.add(m);
  }
  const mk = newEnt(d0 - CHEV / 2); chevrons(mk, d0, CHEV, matChevLava);
  for (let i = 0; i < n - 1; i++) {                       // coin arcs over each gap pay for the jump; bubbles rise mid-gap
    const a = stones[i], b = stones[i + 1], gx0 = a.d1, gx1 = b.d0, gl = gx1 - gx0;
    for (let k = 0; k < 5; k++) { const t = k / 4; coin(clamp(lerp(a.xc, b.xc, t), -LIM, LIM), 1.1 + 2.4 * Math.sin(Math.PI * t), gx0 - 1 + t * (gl + 2)); }
    if (i > 0 && Math.random() < 0.5 + diffAt(d0) * 0.3) addBubble(lerp(a.xc, b.xc, 0.5), gx0 + gl * 0.5, 1.0);
  }
  return len + 6;
}
/* ---- style-shift wall: rainbow glass; breaking it cycles the visual style for the rest of the run ---- */
function pStyleGate(d0) {
  const e = newEnt(d0 + 1), H = 12;
  const g = addBox(e, 'smash', 'prism', 0, 0, d0 + 1, W, H, 0.8, { styleGate: true });
  // frame and sign are children of the glass, so they vanish with it when it shatters
  for (const x of [-HALF + 0.2, HALF - 0.2]) { const m = new THREE.Mesh(boxGeo(0.4, H + 0.4, 1), matPrismSolid); m.position.set(x, 0, 0); g.mesh.add(m); }
  const top = new THREE.Mesh(boxGeo(W, 0.4, 1), matPrismSolid); top.position.set(0, H / 2 + 0.2, 0); g.mesh.add(top);
  const sign = new THREE.Sprite(signPrismMat); sign.scale.set(8, 1.6, 1); sign.position.set(0, 6.2 - H / 2, 1.8); g.mesh.add(sign);
  const mk = newEnt(d0 - CHEV / 2); chevrons(mk, d0, CHEV, matChevPrism);
  for (let i = 0; i < 7; i++) coin(Math.sin(i * 0.9) * 1.6, 1, d0 + 4 + i * 1.8);
  return 11;
}
/* ---- stairs: hovering slabs climbing 1.25m a step; some carry a spring pad that fires you ~8m up ---- */
function addPlatform(e, p) {
  const w = p.x1 - p.x0, len = p.d1 - p.d0;
  const m = new THREE.Mesh(unitBox, matPlat); m.scale.set(w, PLAT_T, len); m.position.set((p.x0 + p.x1) / 2, p.top - PLAT_T / 2, e.d - (p.d0 + p.d1) / 2);
  m.add(new THREE.LineSegments(unitEdges, linePlat)); e.group.add(m);
  const cx0 = p.x0 + 0.3, cx1 = p.x1 - 0.3, z0 = e.d - p.d0 - 0.3, z1 = e.d - p.d1 + 0.3, yb = p.top - PLAT_T;      // posts so the height reads
  const lg = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([cx0, 0, z0, cx0, yb, z0, cx1, 0, z0, cx1, yb, z0, cx0, 0, z1, cx0, yb, z1, cx1, 0, z1, cx1, yb, z1], 3));
  e.geos.push(lg); e.group.add(new THREE.LineSegments(lg, linePlat));
  if (p.spring) {
    const g = new THREE.Group(), base = new THREE.Mesh(springBaseGeo, matSpringPad), top = new THREE.Mesh(springBaseGeo, matSpringPad);
    base.position.y = 0.08; top.position.y = 0.76;
    g.add(base, top, new THREE.LineSegments(springCoilGeo, lineSpring), sprite(glowYellow, 2.6));
    g.children[3].position.y = 0.9;
    g.position.set(p.spring.x, p.top, e.d - p.spring.d); e.group.add(g); p.pad = g;
  }
  p.e = e; world.plats.push(p);
}
function pStairs(d0, S) {
  const n = 5 + Math.round(diffAt(d0) * 3), L = q4(clamp(S * 0.5, 8, 16)), gap = q4(clamp(S * 0.22, 3.5, 8));
  const e = newEnt(d0), grp = {}; let d = d0, xc = rnd(-1, 1), top = 0;
  const ps = [];
  for (let i = 0; i < n; i++) {
    top += STEP_H;
    const w = q4(rnd(5, 7)), last = i === n - 1;
    xc = q4(clamp(xc + rnd(-1.4, 1.4), -(HALF - w / 2), HALF - w / 2));
    const len = last ? 14 : L;
    const p = { x0: xc - w / 2, x1: xc + w / 2, d0: d, d1: d + len, top, bot: top - PLAT_T, grp, xc, spring: null, springT: 0, pad: null };
    if (i >= 1 && !last && Math.random() < 0.35) p.spring = { x: xc + q4(rnd(-w / 2 + 1.2, w / 2 - 1.2)), d: d + len - 2.4, r: 1.0 };
    ps.push(p); addPlatform(e, p); d += len + (last ? 0 : gap);
  }
  e.dEnd = d;
  ps.forEach((p, i) => {
    const len = p.d1 - p.d0;
    for (let k = 0; k < 3; k++) coin(p.xc, p.top + 1, p.d0 + len * (0.3 + 0.25 * k));
    if (i < n - 1) { const q = ps[i + 1]; for (let k = 0; k < 4; k++) { const t = (k + 1) / 5; coin(lerp(p.xc, q.xc, t), lerp(p.top, q.top, t) + 1.4 + 1.6 * Math.sin(Math.PI * t), p.d1 + (q.d0 - p.d1) * t); } }
    if (p.spring) for (let k = 0; k < 6; k++) coin(p.spring.x, p.top + 2 + k * 1.1, p.spring.d + 1 + k * 1.5);   // the spring's flight path
  });
  const last = ps[n - 1];
  if (Math.random() < 0.6) pickup(pick(['heart', 'shield', 'magnet']), last.xc, last.top + 1.4, last.d0 + 7);
  const mk = newEnt(d0 - CHEV / 2); chevrons(mk, d0, CHEV, matChevLime);
  return d - d0 + 8;
}

/* ---- wall cannons: charge (red sight line shows the shot's height), then fire a saw (jump it) or an orb (slide under it) ---- */
function makeSaw() {
  const g = new THREE.Group(); const spin = new THREE.Group();
  spin.add(new THREE.Mesh(sawGeo, matSawFill), new THREE.Mesh(sawRimGeo, mbm({ color: 0xff8a2a })));
  const teeth = []; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; teeth.push(Math.cos(a) * 1.0, Math.sin(a) * 1.0, 0, Math.cos(a) * 1.4, Math.sin(a) * 1.4, 0); }
  spin.add(new THREE.LineSegments(bufG(teeth), lineLethal));
  g.add(spin, sprite(glowOrange, 4)); g.userData.spin = spin; return g;
}
function makeOrb() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(bubbleGeo, matOrb), new THREE.Mesh(bubbleGeo, matOrbWire), sprite(glowOrange, 4.4)); g.scale.setScalar(1.05); return g;
}
function addCannon(d, side, kind) {
  const e = newEnt(d), y = kind === 'orb' ? 2.4 : 0.75, hg = boxGeo(1.0, kind === 'orb' ? 1.7 : 1.4, 1.9);
  const housing = new THREE.Mesh(hg, matMetal); housing.position.set(side * (HALF + 0.25), y, 0); housing.add(new THREE.LineSegments(hg.userData.edges, lineLethal));
  const barrel = new THREE.Mesh(barrelGeo, matMetal); barrel.position.set(side * (HALF + 0.05), y, 0);
  const muzzle = sprite(glowOrange, 1.2); muzzle.position.set(side * (HALF - 0.8), y, 0); muzzle.visible = false;
  const len = W - 1.6, sight = new THREE.Mesh(unitBox, sightMat); sight.scale.set(len, 0.16, 0.16); sight.position.set(side * (HALF - 0.8) - side * len / 2, y, 0); sight.visible = false;
  const ring = new THREE.Mesh(muzzleRingGeo, matMuzzleRing); ring.position.set(side * (HALF - 0.65), y, 0);
  e.group.add(housing, barrel, muzzle, sight, ring);
  world.wallOver.push({ d0: d - 5, d1: d + 5, h: y + 1.3 });             // raise the walls round a high cannon so it has something to sit in
  world.cannons.push({ e, d, side, kind, y, state: 'idle', t: 0, tTravel: 0, aimX: 0, muzzle, barrel, sight, shot: null, mesh: null });
}
function updateCannons(dt) {
  for (const c of world.cannons) {
    if (c.state === 'done') continue;
    const far = c.d - P.d, startX = c.side * (HALF - 0.8);
    if (c.state === 'idle') {
      if (far <= 0) { c.state = 'done'; continue; }
      c.aimX = clamp(P.x, -LIM, LIM);                               // aimed where you are when it starts to charge
      const tTravel = Math.abs(c.aimX - startX) / CANNON_V;
      if (far <= curSpeed * (CANNON_CHARGE + tTravel)) { c.state = 'charge'; c.t = 0; c.muzzle.visible = c.sight.visible = true; sfx.charge(); }
    } else if (c.state === 'charge') {
      c.t += dt;
      const k = c.t / CANNON_CHARGE, pulse = 1 + 0.5 * Math.sin(c.t * 30);
      c.muzzle.scale.set(1.4 + 2.6 * k * pulse, 1.4 + 2.6 * k * pulse, 1); sightMat.opacity = 0.45 + 0.5 * k * (0.7 + 0.3 * pulse);
      if (c.t >= CANNON_CHARGE) {
        c.state = 'fly'; c.sight.visible = false;
        c.mesh = c.kind === 'orb' ? makeOrb() : makeSaw(); c.mesh.position.set(startX, c.y, 0); c.e.group.add(c.mesh);
        c.shot = { x: startX, dir: -c.side, hit: false };
        burst(startX, c.y, c.d, 'orange', 8, 6); sfx.cannon(); shake = Math.max(shake, 0.12);
      }
    } else if (c.state === 'fly') {
      const sh = c.shot; sh.x += sh.dir * CANNON_V * dt; c.mesh.position.x = sh.x;
      if (c.kind === 'saw') c.mesh.userData.spin.rotation.z -= sh.dir * dt * 14; else c.mesh.scale.setScalar(1.05 + 0.08 * Math.sin(world.time * 25));
      const dx = P.x - sh.x, dy = P.y - c.y, dd = P.d - c.d, r = (c.kind === 'saw' ? 1.0 : 0.95) + 0.42;
      if (!sh.hit && dx * dx + dy * dy + dd * dd < r * r) { sh.hit = true; burst(sh.x, c.y, c.d, 'orange', 12, 8); hurt(LIGHT); }
      if (Math.abs(sh.x) > HALF + 0.4) { c.state = 'done'; c.mesh.visible = false; c.muzzle.visible = false; burst(sh.x, c.y, c.d, 'orange', 6, 5); }
    }
  }
}
function pCannons(d0, S) {
  const diff = diffAt(d0), n = 2 + Math.round(diff * 2), sp = Math.max(S * 0.9 + 4, 22);
  let side = Math.random() < 0.5 ? -1 : 1;
  for (let i = 0; i < n; i++) {
    const kind = Math.random() < 0.4 + diff * 0.15 ? 'orb' : 'saw', d = d0 + 12 + i * sp;
    addCannon(d, side, kind); side = -side;
    if (kind === 'saw') for (let k = 0; k < 3; k++) coin(0, 2.4 + 0.5 * Math.sin(k * 1.4), d - 2 + k * 2);      // jump path
    else for (let k = 0; k < 3; k++) coin(0, 0.45, d - 2 + k * 2);                                                // slide path
  }
  return 12 + n * sp;
}

/* ---- hazards on a clock: swinging blade, crushers ---- */
function addPendulum(d, phase) {
  const e = newEnt(d), H = 9;
  const box = addBox(e, 'lethal', null, 0, 0, d, 2.0, 2.0, 1.4, { pend: true });
  const blade = new THREE.Group(), spin = new THREE.Group();
  spin.add(new THREE.Mesh(sawGeo, matSawFill), new THREE.Mesh(sawRimGeo, mbm({ color: 0xff3b2e })));
  blade.add(spin); blade.userData.spin = spin; blade.position.set(0, 1.0, 0); box.mesh = blade;
  const rg = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, H, 0, 0, 1.0, 0], 3)); e.geos.push(rg);
  const rope = new THREE.LineSegments(rg, lineLethal), bg = boxGeo(W, 0.5, 0.8), beam = new THREE.Mesh(bg, matMetal);
  beam.position.set(0, H, 0); beam.add(new THREE.LineSegments(bg.userData.edges, lineLethal));
  e.group.add(blade, rope, beam);
  world.hazards.push({ type: 'pend', e, box, blade, rg, A: 3.0, w: 2.6, ph: phase, H });
}
const CRUSH_T = 2.6;
function crushBottom(t) {
  if (t < 1.2) return 8;
  if (t < 1.7) return 8 - 0.8 * ((t - 1.2) / 0.5);
  if (t < 1.82) return lerp(7.2, 0, (t - 1.7) / 0.12);
  if (t < 2.2) return 0;
  return lerp(0, 8, (t - 2.2) / 0.4);
}
function addCrusher(d, x, phase) {
  const e = newEnt(d);
  const plate = mkBox('stripe', 2.6, 1.2, 2.6, e.group); plate.position.set(x, 8.6, 0);
  const box = addBox(e, 'lethal', null, x, 7.4, d, 2.6, 1.2, 2.6, { crush: true }); box.mesh = plate;
  const rod = new THREE.Mesh(unitBox, matMetal); rod.scale.set(0.45, 10, 0.45); e.group.add(rod);
  const padMat = new THREE.MeshBasicMaterial({ color: 0xff3b2e, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending, depthWrite: false }); e.mats.push(padMat);
  const pad = new THREE.Mesh(crushPadGeo, padMat); pad.position.set(x, 0.05, 0); e.group.add(pad);
  world.hazards.push({ type: 'crush', e, box, plate, rod, padMat, ph: phase, x, d, slammed: false });
}
function updateHazards() {
  for (const h of world.hazards) {
    if (h.type === 'pend') {
      const x = h.A * Math.sin(world.time * h.w + h.ph);
      h.blade.position.x = x; h.box.x = x; h.blade.userData.spin.rotation.z = -world.time * 5;
      h.rg.attributes.position.setXYZ(1, x, 1.0, 0); h.rg.attributes.position.needsUpdate = true;
    } else {
      const t = (world.time + h.ph) % CRUSH_T, bot = crushBottom(t);
      h.plate.position.y = bot + 0.6; h.box.y = bot + 0.6;
      h.rod.scale.y = 14 - (bot + 1.2); h.rod.position.set(h.x, (bot + 1.2 + 14) / 2, 0);
      h.padMat.opacity = t >= 1.0 && t < 1.82 ? 0.25 + 0.6 * Math.abs(Math.sin(world.time * 18)) : (t < 2.2 ? 0.6 : 0.12);
      if (t >= 1.82 && t < 2.0 && !h.slammed) { h.slammed = true; if (Math.abs(h.d - P.d) < 26) { sfx.slam(); shake = Math.max(shake, Math.abs(h.d - P.d) < 12 ? 0.3 : 0.12); burst(h.x, 0.2, h.d, 'orange', 6, 6); } }
      if (t < 1.0) h.slammed = false;
    }
  }
}
function pPendulum(d0, S) {
  const n = 1 + Math.round(diffAt(d0) * 2), sp = Math.max(14, S * 0.7);
  for (let i = 0; i < n; i++) { const d = d0 + 4 + i * sp; addPendulum(d, rnd(0, 6.28)); for (let k = 0; k < 3; k++) coin(0, 3.4 + 0.4 * Math.sin(k), d - 2 + k * 2); }
  return 8 + n * sp;
}
function pCrusher(d0, S) {
  const rows = 1 + (diffAt(d0) > 0.45 ? 1 : 0), sp = Math.max(16, S * 0.8);
  for (let r = 0; r < rows; r++) {
    const d = d0 + 4 + r * sp;
    for (const x of [-2.7, 0, 2.7]) addCrusher(d, x, rnd(0, CRUSH_T));
    for (let k = 0; k < 4; k++) coin(rnd(-2.7, 2.7) * (k % 2), 0.95, d - 3 + k * 2);
  }
  const mk = newEnt(d0 - CHEV / 2); chevrons(mk, d0, CHEV, matChevRed);
  return 8 + rows * sp;
}
function pRoller(d0, S) {
  const two = diffAt(d0) > 0.5 && Math.random() < 0.5, amp = rnd(1.7, 2.1), sp = Math.max(14, S * 0.85 + 3);   // far enough apart to land and jump again
  addEnemy('roller', d0, rnd(-0.8, 0.8), amp, rnd(1.3, 1.9));
  if (two) addEnemy('roller', d0 + sp, rnd(-0.8, 0.8), amp, rnd(1.3, 1.9));
  for (let k = 0; k < 4; k++) coin(0, 3.8, d0 - 3 + k * 2);
  return two ? sp + 5 : 7;
}
function pHopper(d0, S) {
  const two = diffAt(d0) > 0.45 && Math.random() < 0.5, sp = Math.max(10, S * 0.5 + 2);
  addEnemy('hopper', d0, rnd(-1.5, 1.5), rnd(0.8, 1.6), rnd(0.9, 1.4));
  if (two) addEnemy('hopper', d0 + sp, rnd(-1.5, 1.5), rnd(0.8, 1.6), rnd(0.9, 1.4));
  return two ? sp + 5 : 6;
}
const CHAIN_POOL = ['hole', 'glass', 'spikes', 'gate', 'window', 'gapwall', 'beetle', 'drone', 'brick', 'roller', 'pendulum', 'hopper', 'crusher'];
function pChain(d0, S) {
  const n = diffAt(d0) > 0.5 && Math.random() < 0.5 ? 3 : 2;
  const gap = Math.max(15, S * 0.6 + 4);
  let d = d0, prev = '';
  for (let i = 0; i < n; i++) {
    let t; do { t = pick(CHAIN_POOL); } while (t === prev);
    const unlocked = PATTERNS[t].min <= d0; if (!unlocked) { i--; continue; }
    prev = t; const len = PATTERNS[t].build(d, S);
    d += len + gap;
  }
  return d - d0 - gap;
}
const PATTERNS = {
  coins:   { min: 0,   w: 3, build: pCoins, hint: 'DRAG to steer · grab coins' },
  glass:   { min: 0,   w: 5, build: pGlass, hint: 'Glowing glass? Hit DASH!' },
  cubes:   { min: 80,  w: 3, build: pCubes },
  brick:   { min: 60,  w: 4, build: pBrick, hint: 'Solid brick is deadly — JUMP over it' },
  gapwall: { min: 130, w: 4, build: pGapWall },
  hole:    { min: 100, w: 5, build: pHole, hint: 'Holes! JUMP — tap twice to float' },
  spikes:  { min: 160, w: 4, build: pSpikes, hint: 'Spikes! JUMP over them' },
  gate:    { min: 220, w: 4, build: pGate, hint: 'Magenta bar = SLIDE under it (bottom button)' },
  window:  { min: 280, w: 4, build: pWindow, hint: 'Line up and DASH through the window' },
  beetle:  { min: 340, w: 3, build: pBeetle, hint: 'Jump high, then SLAM its glowing back' },
  drone:   { min: 400, w: 3, build: pDrone, hint: 'DASH into the glowing core' },
  rain:    { min: 300, w: 4, build: pRain, hint: 'Red shadow = something is falling. Move!' },
  stylegate: { min: Infinity, w: 0, build: pStyleGate, hint: 'Rainbow glass = STYLE SHIFT! Dash through it to change the look' },
  roller:  { min: 450, w: 3, build: pRoller, hint: 'Spike roller! JUMP over it' },
  pendulum: { min: 500, w: 3, build: pPendulum, hint: 'Swinging blade! JUMP it' },
  hopper:  { min: 520, w: 3, build: pHopper, hint: 'Hopper! DASH or SLAM it' },
  crusher: { min: 600, w: 3, build: pCrusher, hint: 'Crushers! Take a lane whose red pad is calm' },
  cannons: { min: 750, w: 4, build: pCannons, hint: 'Wall cannons! The red line shows the shot: JUMP low ones, SLIDE under high ones' },
  stairs:  { min: 900, w: 3, build: pStairs, hint: 'Platforms! JUMP up the steps. Spring pads bounce you higher' },
  lava:    { min: 550, w: 3, build: pLava, hint: 'FLOOR IS LAVA! Jump stone to stone — DASH through the bubbles' },
  tube:    { min: 450, w: 2, build: pTube, hint: 'SPEED TUBE! Steer round the walls — or JUMP them' },
  chain:   { min: 650, w: 5, build: pChain },
};
const INTRO = ['coins', 'glass', 'brick', 'hole', 'spikes', 'gate', 'rain', 'window', 'beetle', 'drone', 'tube', 'lava', 'roller', 'pendulum', 'hopper', 'crusher', 'cannons', 'stairs'];

function choosePattern(d) {
  if (world.attract) return 'coins';
  if (world.intro.length) return world.intro.shift();
  if (world.sinceBreather >= 4) { world.sinceBreather = 0; return 'breather'; }
  const diff = diffAt(d);
  const opts = [];
  for (const [k, p] of Object.entries(PATTERNS)) {
    if (p.min > d || k === world.lastType) continue;
    let w = p.w;
    if (k === 'coins') w = lerp(3, 0.6, diff);
    else if (k === 'chain') w = lerp(1, 6, diff);
    opts.push([k, w]);
  }
  let r = Math.random() * opts.reduce((s, o) => s + o[1], 0);
  for (const [k, w] of opts) { r -= w; if (r <= 0) return k; }
  return opts[0][0];
}
function genUntil(limit) {
  while (world.genD < limit) {
    const S = speedAt(world.genD), diff = diffAt(world.genD);
    const gap = world.patCount === 0 ? 34 : Math.max(lerp(34, 17, diff) * rnd(0.9, 1.2), S * 0.55 + 4);
    const due = !world.attract && world.genD + gap >= world.nextStyleD;      // first free gap at/after each STYLE_EVERY metres
    const type = due ? 'stylegate' : choosePattern(world.genD);
    if (due) { world.nextStyleD += STYLE_EVERY; world.sinceBreather = Math.max(world.sinceBreather, 4); }
    const d0 = world.genD + (type === 'breather' ? Math.min(gap, 22) : gap);
    const len = type === 'breather' ? pBreather(d0) : PATTERNS[type].build(d0, S);
    const p = PATTERNS[type];
    if (p && p.hint && !world.attract && !save.seen[type]) world.hints.push({ type, text: p.hint, d0: d0 - 42, d1: d0 + len * 0.7, done: false });
    if (type !== 'breather') { world.sinceBreather++; world.lastType = type; }
    world.genD = d0 + len;
    world.patCount++;
  }
  while (world.segD + SEG <= world.genD && world.segD < P.d + LOOK) { buildSegment(world.segD); world.segD += SEG; }
}
function cullWorld() {
  const behind = P.d - 25;
  for (const e of world.ents.slice()) if (e.dEnd < behind) removeEnt(e);
  world.items = world.items.filter((it) => { if (it.d < behind) { scene.remove(it.m); if (it.k !== 'coin') it.m.material.dispose(); return false; } return true; });
  world.holes = world.holes.filter((h) => h.d1 > behind - 20);
  world.tubes = world.tubes.filter((t) => t.d1 > behind - 20);
  world.wallOver = world.wallOver.filter((o) => o.d1 > behind - 20);
  world.hints = world.hints.filter((h) => !h.done || h.d1 > behind);
  while (world.segs.length && world.segs[0].b < P.d - 45) removeSeg(world.segs.shift());
}

/* ===================================================================== */
/* player                                                                 */
/* ===================================================================== */
const P = { god: false };
let mode = 'menu';            // menu | play | dying | over
let paused = false;
let dieT = 0, shake = 0, curSpeed = 17, flashT = 0;

function initPlayer() {
  Object.assign(P, {
    x: 0, tx: 0, y: R, d: 0, vy: 0,
    hearts: maxHearts(), maxHearts: maxHearts(), shield: SHIELD_MAX, shieldDelay: 0,
    charges: maxDash(), maxDash: maxDash(), dashProg: 0, dashT: 0, dashEl: 0, perfectUsed: false,
    jumps: 0, sliding: 0, slam: false, inv: 0, speedMul: 1, magnet: 0, od: 0,
    combo: 0, comboT: 0, bestCombo: 0, bonus: 0, coins: 0, smashes: 0, sq: 0, dead: false,
    keyDir: 0, buf: { jump: 0, smash: 0 }, wall: 0, scrapeT: 0, trailT: 0, rollX: 0,
    tube: false, th: 0, tth: 0, tubeH: 0, tvy: 0, boost: 1, xv: 0, stone: null, zone: null, hops: 0, gy: 0, plat: null, pd: 0,
  });
}
const mult = () => Math.min(8, 1 + Math.floor(P.combo / 3));
const scoreNow = () => Math.floor(P.d * 0.5) + P.bonus;

const buzz = (ms) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* unsupported */ } };
function award(base, label, cls) {
  P.combo++; P.comboT = 5; P.bestCombo = Math.max(P.bestCombo, P.combo); P.smashes++;
  const pts = base * mult(); P.bonus += pts;
  pop(label + ' +' + pts, cls || 'gold');
}
function refund(label) {
  if (P.charges < P.maxDash) { P.charges++; pop('+DASH', 'cyan'); }
  sfx.perfect();
}
function hurt(power, ignoreShield) {
  if (P.inv > 0 || P.dead || mode !== 'play' || P.god) return;
  P.inv = 1.5; P.combo = 0; P.comboT = 0; P.shieldDelay = 4; P.speedMul = 0.55; P.dashT = 0; P.slam = false;
  if (!ignoreShield && P.shield >= power) {
    P.shield -= power; buzz(30); flash('rgba(70,220,255,.5)'); sfx.shieldHit(); shake = Math.max(shake, 0.4); pop('SHIELD', 'cyan');
    burst(P.x, P.y, P.d, 'cyan', 12, 7);
  } else {
    if (!ignoreShield) P.shield = 0;
    P.hearts--; buzz(90); flash('rgba(255,50,50,.55)'); sfx.hurt(); shake = Math.max(shake, 0.8);
    burst(P.x, P.y, P.d, 'red', 18, 9);
    if (P.hearts <= 0) { die(); return; }
    pop('OUCH', 'red');
  }
}
function die() {
  P.dead = true; mode = 'dying'; dieT = 1.15;
  burst(P.x, P.y, P.d, 'orange', 36, 12); burst(P.x, P.y, P.d, 'gold', 20, 9); burst(P.x, P.y, P.d, 'mag', 16, 8);
  buzz([60, 40, 160]); flash('rgba(255,60,60,.6)'); sfx.die(); shake = 1.1; ball.visible = false; shadow.visible = false;
}
function fall() {
  hurt(100, true);
  if (P.dead) return;
  let dest = P.d + 4;
  for (const h of world.holes) if (!h.tube && !h.lava && P.d >= h.d0 - 1 && P.d <= h.d1 + 1) dest = Math.max(dest, h.d1 + 3);
  P.d = dest; P.y = 3; P.vy = 0; P.inv = 2; P.dashT = 0; P.sliding = 0;
  if (!hasFloor(P.x, P.d)) P.tx = P.x = 0;
  sfx.fall(); pop('FELL!', 'red');
}

function tryJump() {
  if (P.dashT > 0 || P.jumps >= 2) return false;
  P.sliding = 0; P.slam = false;
  if (P.tube) { P.tvy = P.jumps === 0 ? TJUMP_V : TJUMP2_V; P.jumps++; P.sq = -0.4; sfx.jump(P.jumps); return true; }
  P.vy = P.jumps === 0 ? JUMP_V : JUMP2_V; P.jumps++; P.sq = -0.45;
  sfx.jump(P.jumps);
  if (P.jumps === 2) { wave(P.x, P.d, 0x8dff6a, 2.2, Math.max(0.06, P.y - 0.4)); burst(P.x, P.y - 0.3, P.d, 'white', 8, 5); }
  return true;
}
function tryDash() {
  if (P.dashT > 0) return false;
  if (P.od <= 0 && P.charges < 1) { sfx.empty(); btnEmpty(); return false; }
  if (P.od <= 0) P.charges--;
  P.dashT = DASH_T; P.dashEl = 0; P.perfectUsed = false; P.slam = false; P.sliding = 0; P.vy = 0;
  sfx.dash(); shake = Math.max(shake, 0.15);
  return true;
}
function landOnStone() {
  const st = stoneAt(P.x, P.d);
  if (!st || st === P.stone) return;
  P.stone = st;
  if (st.z !== P.zone) { P.zone = st.z; P.hops = 0; }
  if (st.first) return;
  P.hops++;
  award(30 + 10 * Math.min(P.hops, 10), 'HOP x' + P.hops, 'gold');
}
function landOnPlat(p) {
  if (p === P.plat) return;
  P.plat = p;
  if (p.grp !== P.zone) { P.zone = p.grp; P.hops = 0; }
  P.hops++;
  award(25 + 10 * Math.min(P.hops, 10), 'STEP x' + P.hops, 'gold');
}
function springHit(p) { return Math.hypot(P.x - p.spring.x, P.d - p.spring.d) < p.spring.r + 0.35; }
function springLaunch(p) {
  P.vy = SPRING_V; P.sq = 0.8; p.springT = 0.3; P.bonus += 15;
  burst(p.spring.x, p.top + 0.3, p.spring.d, 'gold', 14, 7, 4); pop('BOING!', 'gold'); sfx.boing(); shake = Math.max(shake, 0.25);
}
/** platforms are solid: running into a slab's side is a bonk (light hit, shoved back); jumping into its underside bumps your head */
function platCollide() {
  if (P.tube) return;
  for (const p of world.plats) {
    if (P.d < p.d0 - 0.5 || P.d > p.d1 + 0.5 || P.x < p.x0 - 0.5 || P.x > p.x1 + 0.5) continue;
    const bottom = P.y - R, topB = P.y + (P.sliding > 0 ? 0.2 : 0.42);
    if (bottom >= p.top - STEP_TOL || topB <= p.bot) continue;            // standing on it, or passing underneath
    if (P.pd <= p.d0 - 0.45 && P.d < (p.d0 + p.d1) / 2) P.d = p.d0 - 0.5;   // came from the front: shove back out
    else if (P.y <= p.bot) { P.y = p.bot - 0.43; if (P.vy > 0) P.vy = 0; continue; }   // already under it and jumped: bumped head
    else { P.x = P.x < (p.x0 + p.x1) / 2 ? p.x0 - 0.5 : p.x1 + 0.5; P.tx = P.x; }      // clipped its side: shove sideways
    P.dashT = 0;
    if (P.inv <= 0) { burst(P.x, P.y, P.d, 'white', 8, 6); hurt(LIGHT); }
    P.speedMul = Math.min(P.speedMul, 0.3);
  }
}
function lavaBurn() {
  P.y = R; P.vy = 15; P.jumps = 0; P.slam = false; P.sq = 0.6; P.stone = null; P.hops = 0;
  burst(P.x, 0.3, P.d, 'orange', 22, 10); burst(P.x, 0.3, P.d, 'gold', 10, 8); wave(P.x, P.d, 0xff7a1a, 4);
  sfx.lava(); hurt(HEAVY);
}
function trySmash() {
  if (P.dashT > 0) return false;
  if (P.tube) { if (P.tubeH > 0.4 && !P.slam) { P.slam = true; P.tvy = -34; sfx.slamStart(); } return true; }
  if (P.y - (P.gy || 0) > 2.1) {                         // airborne: ground pound
    if (P.slam) return true;
    P.slam = true; P.vy = -SLAM_V; P.sliding = 0; sfx.slamStart();
  } else {                                               // low: slide
    if (P.sliding > 0) return true;
    P.slam = false; P.sliding = SLIDE_T; P.vy = 0; P.y = (P.gy || 0) + SLIDE_Y; P.jumps = 0; sfx.slide();
  }
  return true;
}
function pressJump() { if (mode === 'play' && !paused && !tryJump()) P.buf.jump = 0.14; }
function pressDash() { if (mode === 'play' && !paused) tryDash(); }
function pressSmash() { if (mode === 'play' && !paused && !trySmash()) P.buf.smash = 0.14; }

function smashBox(b, perfectOK) {
  if (b.dead) return;
  b.dead = true; b.mesh.visible = false;
  const n = clamp(Math.round(b.hx * b.hy * 2.2), 8, 26);
  burst(b.x, b.y, b.d, 'cyan', n, 9); burst(b.x, b.y, b.d, 'white', Math.floor(n / 3), 8);
  sfx.smash(); buzz(15); shake = Math.max(shake, 0.3);
  if (b.styleGate) shiftStyle(b);
  if (perfectOK && P.dashEl < PERFECT_T && !P.perfectUsed) {
    P.perfectUsed = true; award(50, 'PERFECT', 'gold'); refund('PERFECT');
  } else award(25, 'SMASH', 'cyan');
}
function shiftStyle(b) {
  const next = STYLES[(STYLES.indexOf(style) + 1) % STYLES.length];
  setStyle(next, true);                       // for this run only; the saved Style is where the next run starts
  renderMenu();
  const bonus = 500 * mult(); P.bonus += bonus;
  pop(next.toUpperCase() + ' STYLE!', 'cyan'); pop('STYLE SHIFT +' + bonus, 'gold');
  for (const c of ['cyan', 'gold', 'mag', 'orange', 'white']) burst(b.x, 3, b.d, c, 12, 11, 4);
  const f = $('styleFlash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
  const cv = $('c'); cv.classList.remove('tear'); void cv.offsetWidth; cv.classList.add('tear');
  sfx.shift(); shake = Math.max(shake, 0.7); buzz([30, 30, 70]);
}
function shockwave() {
  wave(P.x, P.d, 0x9ffff4, 7.6, (P.gy || 0) + 0.06); sfx.slam(); shake = Math.max(shake, 0.55);
  burst(P.x, (P.gy || 0) + 0.2, P.d, 'cyan', 12, 8);
  for (const b of world.boxes) {
    if (b.dead || !(b.t === 'beetle' || b.t === 'hopper' || (b.t === 'smash' && b.aoe))) continue;
    const dx = Math.max(0, Math.abs(b.x - P.x) - b.hx), dd = Math.max(0, Math.abs(b.d - P.d) - b.hd);
    if (dx * dx + dd * dd < 3.8 * 3.8) { if (b.t === 'beetle' || b.t === 'hopper') killEnemy(b, false); else smashBox(b, false); }
  }
}

function collide() {
  const hy = P.sliding > 0 ? 0.2 : 0.42, hx = 0.42, hd = 0.42;
  for (const b of world.boxes) {
    if (b.dead || Math.abs(b.d - P.d) >= b.hd + hd) continue;
    if (Math.abs(b.x - P.x) >= b.hx + hx || Math.abs(b.y - P.y) >= b.hy + hy) continue;
    switch (b.t) {
      case 'smash':
        if (P.dashT > 0) smashBox(b, true);
        else if (P.slam) smashBox(b, false);
        else { smashBox(b, false); hurt(LIGHT); }
        break;
      case 'lethal': case 'spike': hurt(HEAVY); break;
      case 'beetle': if (P.slam) killEnemy(b, false); else hurt(LIGHT); break;
      case 'drone': if (P.dashT > 0) killEnemy(b, true); else hurt(LIGHT); break;
      case 'roller': hurt(HEAVY); break;
      case 'hopper': if (P.dashT > 0 || P.slam) killEnemy(b, P.dashT > 0); else hurt(LIGHT); break;
    }
    if (P.dead) return;
  }
}

function updateItems(dt) {
  const magnet = P.magnet > 0;
  for (let i = world.items.length - 1; i >= 0; i--) {
    const it = world.items[i];
    it.ph += dt;
    if (it.k === 'coin') it.m.rotation.y += dt * 5;
    else { it.m.position.y = it.y + Math.sin(it.ph * 3) * 0.18; const s = 1.5 + Math.sin(it.ph * 5) * 0.12; it.m.scale.set(s, s, 1); }
    if (magnet && it.k === 'coin') {
      const dx = P.x - it.x, dy = P.y - it.y, dd = P.d - it.d;
      if (dx * dx + dy * dy + dd * dd < 90) { const k = 1 - Math.exp(-9 * dt); it.x += dx * k; it.y += dy * k; it.d += dd * k; }
    }
    it.m.position.x = it.x; it.m.position.z = -it.d; if (it.k === 'coin') it.m.position.y = it.y;
    if (Math.abs(it.d - P.d) < 0.9 && Math.abs(it.x - P.x) < 0.95 && Math.abs(it.y - P.y) < 1.1) {
      scene.remove(it.m); if (it.k !== 'coin') it.m.material.dispose(); world.items.splice(i, 1);
      if (it.k === 'coin') { P.coins++; P.bonus += 2; sfx.coin(); }
      else if (it.k === 'heart') { if (P.hearts < P.maxHearts) { P.hearts++; pop('+HEART', 'red'); } else { P.bonus += 100; pop('+100', 'gold'); } sfx.pickup(); burst(it.x, it.y, it.d, 'red', 10, 6); }
      else if (it.k === 'shield') { P.shield = SHIELD_MAX; pop('SHIELD UP', 'cyan'); sfx.pickup(); burst(it.x, it.y, it.d, 'cyan', 10, 6); }
      else if (it.k === 'magnet') { P.magnet = magnetDur(); pop('MAGNET', 'gold'); sfx.pickup(); }
      else if (it.k === 'surge') { P.od = 6; P.charges = P.maxDash; pop('SURGE: FREE DASH', 'green'); sfx.pickup(); }
    }
  }
}

function rebaseSteer() { steerX0 = lastPX; steerTx0 = P.tx; steerTh0 = P.tth; }
function enterTube() {
  P.tube = true; P.th = P.tth = Math.asin(clamp(P.x / (TUBE_R - R), -1, 1));
  P.tubeH = Math.max(0, P.y - R); P.tvy = 0; P.slam = false; P.sliding = 0; P.jumps = 0;
  sfx.boost(); pop('SPEED TUBE', 'green'); shake = Math.max(shake, 0.35); buzz(25); rebaseSteer();
}
function exitTube() {
  const rb = (TUBE_R - R) - P.tubeH;
  P.tube = false; P.x = clamp(rb * Math.sin(P.th), -LIM, LIM); P.tx = P.x;
  P.y = Math.max(R, TUBE_R - rb * Math.cos(P.th)); P.vy = Math.max(P.tvy, 0) + 10; P.jumps = 0; P.tubeH = 0;
  sfx.boost(); pop('LAUNCH!', 'green'); shake = Math.max(shake, 0.3); rebaseSteer();
}
function step(dt) {
  world.time += dt;
  if (mode === 'dying') { dieT -= dt; if (dieT <= 0) showOver(); return; }
  if (mode === 'over') return;
  const playing = mode === 'play';

  /* timers */
  P.inv = Math.max(0, P.inv - dt); P.magnet = Math.max(0, P.magnet - dt); P.od = Math.max(0, P.od - dt);
  if (P.comboT > 0) { P.comboT -= dt; if (P.comboT <= 0) P.combo = 0; }
  if (P.shieldDelay > 0) P.shieldDelay -= dt; else if (P.shield < SHIELD_MAX) P.shield = Math.min(SHIELD_MAX, P.shield + shieldRegen() * dt);
  if (P.charges < P.maxDash) { P.dashProg += dt / DASH_RECHARGE; if (P.dashProg >= 1) { P.dashProg = 0; P.charges++; } } else P.dashProg = 0;

  /* speed & dash */
  P.speedMul += (1 - P.speedMul) * Math.min(1, dt * 2.4);
  const tb = playing ? tubeAt(P.d) : null;
  if (tb && !P.tube) enterTube(); else if (!tb && P.tube) exitTube();
  P.boost += ((P.tube ? TUBE_BOOST : 1) - P.boost) * Math.min(1, dt * 4);
  const base = playing ? speedAt(P.d) : 13;
  let fv = base * P.speedMul * P.boost;
  if (P.dashT > 0) {
    fv += DASH_SPEED; P.dashT -= dt; P.dashEl += dt;
    P.trailT -= dt; if (P.trailT <= 0) { P.trailT = 0.03; burst(P.x, P.y, P.d - 0.5, 'cyan', 1, 3); }
    if (P.dashT <= 0) P.dashT = 0;
  }
  curSpeed = fv;
  P.pd = P.d;                                  // where we were last step: tells a head-on bonk from a bump underneath
  P.d += fv * dt;

  /* steering */
  if (P.tube) { if (P.keyDir) P.tth += P.keyDir * 2.6 * dt; } else {
  if (!playing) P.tx = Math.sin(world.time * 0.7) * 2.2;
  else if (P.keyDir) P.tx = clamp(P.tx + P.keyDir * 13 * dt, -LIM, LIM);
  if (playing && lavaAt(P.d)) { P.xv += ((P.tx - P.x) * LAVA_STIFF - P.xv * LAVA_DAMP) * dt; P.x += P.xv * dt; if (Math.abs(P.x) > LIM) P.xv = 0; }
    else { P.xv = 0; P.x += (P.tx - P.x) * Math.min(1, (P.dashT > 0 ? 5 : 18) * dt); }
  P.x = clamp(P.x, -LIM, LIM);
  const onWall = Math.abs(P.x) > LIM - 0.06 && Math.abs(P.tx - P.x) > 0.02;
  if (onWall && playing) {
    P.speedMul = Math.min(P.speedMul, 0.94);
    P.scrapeT -= dt; if (P.scrapeT <= 0) { P.scrapeT = 0.06; burst(Math.sign(P.x) * (HALF - 0.1), P.y, P.d, 'gold', 2, 5); sfx.scrape(); }
  }
  }

  /* vertical */
  if (P.tube) {
    P.th += (P.tth - P.th) * Math.min(1, 16 * dt);
    if (P.dashT > 0) P.tvy = 0; else if (P.slam) P.tvy = -34; else P.tvy -= 30 * dt;
    P.tubeH = Math.min(3.2, P.tubeH + P.tvy * dt);
    if (P.tubeH <= 0) {
      if (P.slam) { P.slam = false; wave(P.x, P.d, 0x9ffff4, 4.5, P.y); sfx.slam(); shake = Math.max(shake, 0.4); }
      if (P.tvy < -4) P.sq = 0.4;
      P.tubeH = 0; P.tvy = 0; P.jumps = 0;
    }
    const rb = (TUBE_R - R) - P.tubeH;
    P.x = rb * Math.sin(P.th); P.y = TUBE_R - rb * Math.cos(P.th); P.gy = 0;
  } else {
    const bottom0 = P.y - R;
    const sup = platSupport(P.x, P.d, bottom0);                       // a platform under the feet, if any
    const gy = sup ? sup.top : (hasFloor(P.x, P.d) ? 0 : null);       // surface height under the ball (null = nothing: hole / lava)
    const floor = gy !== null;
    P.gy = floor ? gy : 0;
    if (P.dashT > 0) { P.vy = 0; P.y = Math.max(P.y, R + P.gy); }
    else if (P.sliding > 0 && floor) { P.sliding -= dt; P.vy = 0; P.y = gy + SLIDE_Y; if (Math.random() < 0.6) burst(P.x, gy + 0.05, P.d + 0.3, 'gold', 1, 3); }
    else {
      P.sliding = 0;
      if (P.slam) P.vy = -SLAM_V; else P.vy -= GRAV * dt;
      P.y += P.vy * dt;
      if (!floor && playing && P.y <= R && P.vy < 0 && lavaAt(P.d)) lavaBurn();
      if (floor && P.y - R <= gy && P.vy < 0) {
        P.y = gy + R; P.jumps = 0; P.sq = 0.5; if (playing) { landOnStone(); if (sup) landOnPlat(sup); }
        if (P.slam) { P.slam = false; P.vy = 11; shockwave(); }
        else if (sup && sup.spring && playing && springHit(sup)) springLaunch(sup);
        else { P.vy = HOP_V; if (playing) sfx.bounce(); }
      }
    }
  }

  /* buffered inputs */
  if (P.buf.jump > 0) { P.buf.jump -= dt; if (tryJump()) P.buf.jump = 0; }
  if (P.buf.smash > 0) { P.buf.smash -= dt; if (trySmash()) P.buf.smash = 0; }

  /* world */
  updateEnemies(); updateHazards();
  if (playing) {
    platCollide();
    collide();
    updateFalls(dt); updateBubbles(dt); updateCannons(dt);
    if (!P.tube && P.y < -8) fall();
  }
  updateItems(dt);
  if (playing && lavaAt(P.d) && Math.random() < 0.12) burst(rnd(-3.8, 3.8), -0.1, P.d + rnd(2, 30), 'orange', 1, 1.5, 6);   // embers
  genUntil(P.d + LOOK);
  world.cullT -= dt; if (world.cullT <= 0) { world.cullT = 0.5; cullWorld(); }

  /* hints */
  if (playing) {
    let active = null;
    for (const h of world.hints) {
      if (h.done) continue;
      if (P.d > h.d1) { h.done = true; continue; }
      if (P.d >= h.d0 && !active) {
        active = h.text;
        if (!save.seen[h.type]) {                                   // shown once, ever: remember it now and drop queued repeats of it
          save.seen[h.type] = 1; persist();
          for (const o of world.hints) if (o !== h && o.type === h.type) o.done = true;
        }
      }
    }
    setHint(active);
  }
}

/* ===================================================================== */
/* visuals, camera                                                        */
/* ===================================================================== */
const cam = { x: 0, y: 5.6, ly: 1.5, fov: 70, tube: 0 };
function updateVisuals(dt) {
  applyPalette(dbgPal === null ? P.d : dbgPal);
  { const hue = (world.time * 0.35) % 1;
    matPrism.color.setHSL(hue, 1, 0.6); linePrism.color.setHSL((hue + 0.3) % 1, 1, 0.75); matPrismSolid.color.setHSL((hue + 0.6) % 1, 1, 0.55);
    signPrismMat.color.setHSL(hue, 1, 0.8); matChevPrism.color.setHSL((hue + 0.15) % 1, 1, 0.6); }
  lavaTex.offset.set((world.time * 0.012) % 1, (-world.time * 0.05) % 1);
  /* ball */
  P.sq += (0 - P.sq) * Math.min(1, dt * 12);
  const stretch = clamp(Math.abs(P.vy) / 70, 0, 0.22);
  let sy = P.sliding > 0 ? 0.45 : clamp(1 - 0.35 * P.sq + stretch, 0.45, 1.5);
  let sx = P.sliding > 0 ? 1.35 : 1 / Math.sqrt(sy);
  let sz = sx;
  if (P.dashT > 0) { sz = 1.8; sy = 0.85; sx = 0.85; }
  if (P.slam) { sy = 1.5; sx = 0.8; sz = 0.8; }
  const bottom = P.sliding > 0 ? (P.gy || 0) : P.y - R;
  ball.position.set(P.x, bottom + R * sy, -P.d);
  ball.scale.set(sx, sy, sz);
  ballCore.rotation.x -= curSpeed * dt / R * (mode === 'dying' ? 0 : 1);
  ballCore.rotation.z += (P.tx - P.x) * dt * 6;
  if (mode !== 'dying' && mode !== 'over') {
    ball.visible = !(P.inv > 0 && Math.floor(P.inv * 16) % 2 === 0);
    ballGlow.material.map = P.dashT > 0 || P.od > 0 ? glowCyan : glowOrange;
  }
  const supV = P.tube ? null : platSupport(P.x, P.d, P.y - R);
  const gsh = supV ? supV.top : (!P.tube && hasFloor(P.x, P.d) ? 0 : null);
  shadow.visible = gsh !== null && mode !== 'dying' && mode !== 'over';
  shadow.position.set(P.x, (gsh || 0) + 0.05, -P.d);
  const hgt = Math.max(0, P.y - R - (gsh || 0));
  shadow.scale.setScalar(clamp(1.3 - hgt * 0.12, 0.45, 1.3));
  shadowMat.opacity = clamp(0.75 - hgt * 0.07, 0.2, 0.75);

  /* camera */
  cam.x += (P.x * 0.6 - cam.x) * Math.min(1, dt * 6);
  shake = Math.max(0, shake - dt * 2.4);
  const sh = shake * shake;
  cam.tube += ((P.tube ? 1 : 0) - cam.tube) * Math.min(1, dt * 3.5);
  const k = cam.tube;
  const targetFov = baseFov + (P.dashT > 0 ? 11 : 0) + (mode === 'play' ? (curSpeed - 17) * 0.15 : 0) + k * 6;
  cam.fov += (targetFov - cam.fov) * Math.min(1, dt * 10);
  if (Math.abs(camera.fov - cam.fov) > 0.01) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
  const gyc = P.tube ? 0 : (P.gy || 0);                       // climb with the player when they're up on platforms
  cam.y += (5.6 + Math.min(gyc, 10) * 0.62 + Math.min(Math.max(P.y - R - gyc, 0), 5) * 0.18 - cam.y) * Math.min(1, dt * 4);
  cam.ly += (1.5 + Math.min(gyc, 10) * 0.5 - cam.ly) * Math.min(1, dt * 4);
  camera.position.set(lerp(cam.x, 0, k) + rnd(-1, 1) * sh * 0.5, lerp(cam.y, TUBE_R * 0.8, k) + rnd(-1, 1) * sh * 0.4, lerp(-P.d + 11.8, -P.d + 10.5, k));
  camera.lookAt(lerp(cam.x * 0.9, 0, k), lerp(cam.ly, TUBE_R * 0.7, k), -P.d - 9);
  dome.position.copy(camera.position); stars.position.copy(camera.position);
  sun.position.set(camera.position.x * 0.2, cur.sunY, camera.position.z - 215);
  moon.position.set(camera.position.x * 0.2 - 45, 58, camera.position.z - 210);

  /* streaks */
  streakMat.opacity = P.dashT > 0 ? 0.65 : (P.tube ? 0.4 : 0.18);
  for (const s of streaks) if (s.userData.d < P.d - 6) placeStreak(s, 90);
  updateShards(dt); updateWaves(dt);
  for (const p of world.plats) if (p.pad) { if (p.springT > 0) p.springT = Math.max(0, p.springT - dt); p.pad.scale.y = 1 - 0.6 * (p.springT / 0.3); }
  for (const bl of world.blinkers) bl.s.material.opacity = 0.2 + 0.8 * (0.5 + 0.5 * Math.sin(world.time * 3 + bl.ph));
  for (const bm of world.beams) { bm.m.rotation.z = bm.a0 + 0.3 * Math.sin(world.time * 0.6 + bm.ph); bm.m.rotation.x = 0.25 * Math.sin(world.time * 0.45 + bm.ph * 2); }
  { const dp = dustGeo.attributes.position.array, cz = camera.position.z, cx = camera.position.x;     // drifting dust / embers streaming past
    for (let i = 0; i < dustN; i++) {
      let z = dp[i * 3 + 2]; while (z > cz + 14) z -= 90; while (z < cz - 76) z += 90;
      dp[i * 3 + 2] = z; dp[i * 3 + 1] += Math.sin(world.time * 0.7 + i) * 0.004;
      if (dp[i * 3] > cx + 16) dp[i * 3] -= 32; else if (dp[i * 3] < cx - 16) dp[i * 3] += 32;
    }
    dustGeo.attributes.position.needsUpdate = true; }

  /* pickups sprites face camera automatically; hole warning etc. are static */
  updateHud();
}

/* ===================================================================== */
/* HUD & UI                                                               */
/* ===================================================================== */
const hudCache = {};
function setText(el, key, v) { if (hudCache[key] !== v) { hudCache[key] = v; el.textContent = v; } }
function updateHud() {
  if (mode === 'menu') return;
  const h = P.hearts + '/' + P.maxHearts;
  if (hudCache.h !== h) { hudCache.h = h; $('hearts').innerHTML = '<span class="on">' + '♥'.repeat(Math.max(0, P.hearts)) + '</span><span class="off">' + '♥'.repeat(Math.max(0, P.maxHearts - P.hearts)) + '</span>'; }
  const sp = Math.round(P.shield);
  if (hudCache.sp !== sp) { hudCache.sp = sp; $('shieldFill').style.width = sp + '%'; $('shield').classList.toggle('low', sp < 35); }
  setText($('score'), 's', String(scoreNow()));
  setText($('coins'), 'c', '● ' + P.coins);
  const cm = P.combo > 0 ? 'x' + mult() + ' · ' + P.combo + ' CHAIN' : '';
  const ck = cm + '|' + Math.round(P.comboT * 10);
  if (hudCache.cm !== ck) { hudCache.cm = ck; $('combo').innerHTML = cm ? cm + '<i><b style="width:' + clamp(P.comboT / 5, 0, 1) * 100 + '%"></b></i>' : ''; }
  let pips = '';
  for (let i = 0; i < P.maxDash; i++) pips += i < P.charges ? '<span class="pip full"></span>' : (i === P.charges ? '<span class="pip chg" style="--p:' + P.dashProg.toFixed(2) + '"></span>' : '<span class="pip"></span>');
  if (P.od > 0) pips = '<span class="pip full" style="width:34px"></span>';
  if (hudCache.pips !== pips) { hudCache.pips = pips; $('pips').innerHTML = pips; }
  $('bDash').classList.toggle('empty', P.od <= 0 && P.charges < 1);
}
function pop(text, cls) {
  const d = document.createElement('div');
  d.className = 'pop ' + (cls || 'gold') + (text.length < 10 ? ' big' : '');
  d.textContent = text; d.style.marginLeft = rnd(-50, 50) + 'px';
  $('popups').appendChild(d); setTimeout(() => d.remove(), 1000);
  while ($('popups').children.length > 5) $('popups').firstChild.remove();
}
function flash(color) { const f = $('flash'); f.style.background = color; f.classList.add('on'); void f.offsetWidth; requestAnimationFrame(() => f.classList.remove('on')); }
let hintCur = null;
function setHint(t) { if (t === hintCur) return; hintCur = t; const h = $('hint'); if (t) h.textContent = t; h.classList.toggle('show', !!t); }
function btnEmpty() { const b = $('bDash'); b.animate([{ transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'none' }], { duration: 160 }); }

const screens = ['menu', 'shop', 'over', 'pause'];
function showScreen(id) { screens.forEach((s) => $(s).classList.toggle('hidden', s !== id)); }

function renderMenu() {
  $('mBest').textContent = save.best; $('mCoins').textContent = save.coins;
  ['handBtn', 'handBtn2'].forEach((id) => { $(id).textContent = 'Buttons: ' + (save.left ? 'LEFT HAND' : 'RIGHT HAND'); });
  ['muteBtn', 'muteBtn2'].forEach((id) => { $(id).textContent = 'Sound: ' + (save.mute ? 'OFF' : 'ON'); });
  ['styleBtn', 'styleBtn2'].forEach((id) => { $(id).textContent = 'Style: ' + style.toUpperCase(); });
  $('controls').classList.toggle('lefty', !!save.left);
}
function renderShop() {
  $('sCoins').textContent = save.coins;
  const list = $('shopList'); list.innerHTML = '';
  UPS.forEach((u) => {
    const lv = save.up[u.id] || 0, maxed = lv >= u.max, cost = u.cost[lv];
    const row = document.createElement('div'); row.className = 'up';
    row.innerHTML = '<div><strong>' + u.name + '</strong><small>' + u.desc + '</small><div class="lv">' + '■'.repeat(lv) + '□'.repeat(u.max - lv) + '</div></div>';
    const btn = document.createElement('button');
    btn.textContent = maxed ? 'MAX' : '● ' + cost; btn.disabled = maxed || save.coins < cost;
    btn.onclick = () => { if (save.coins >= cost && !maxed) { save.coins -= cost; save.up[u.id] = lv + 1; persist(); sfx.pickup(); renderShop(); renderMenu(); } };
    row.appendChild(btn); list.appendChild(row);
  });
}
function showMenu() {
  sfx.init(); cur.idx = -1; cur.key = '';
  if (style !== save.style) setStyle(save.style, true);
  clearWorld(); initPlayer(); world.attract = true; world.nextStyleD = STYLE_EVERY; world.genD = 20; world.segD = -SEG; world.patCount = 0; world.sinceBreather = 0;
  mode = 'menu'; paused = false;
  document.body.classList.remove('playing', 'paused');
  ball.visible = true; setHint(null);
  for (const s of streaks) placeStreak(s, 0);
  renderMenu(); showScreen('menu');
  genUntil(P.d + LOOK);
}
function startRun() {
  sfx.init(); sfx.music(true); cur.idx = -1; cur.key = '';
  if (style !== save.style) setStyle(save.style, true);
  clearWorld(); initPlayer();
  world.attract = false; world.nextStyleD = STYLE_EVERY; world.genD = 20; world.segD = -SEG; world.patCount = 0; world.sinceBreather = 0; world.lastType = '';
  world.intro = INTRO.filter((t) => !save.seen[t]);
  mode = 'play'; paused = false;
  document.body.classList.add('playing'); document.body.classList.remove('paused');
  ball.visible = true; shadow.visible = true; shake = 0;
  Object.keys(hudCache).forEach((k) => delete hudCache[k]);
  showScreen('');
  $('popups').innerHTML = '';
  for (const s of streaks) placeStreak(s, 0);
  genUntil(P.d + LOOK);
  if (!save.seen.drag) {                                        // shown once, ever
    save.seen.drag = 1; persist();
    const dh = $('dragHint'); dh.classList.add('show'); setTimeout(() => dh.classList.remove('show'), 4500);
  }
}
function showOver() {
  mode = 'over';
  const sc = scoreNow(), isBest = sc > save.best;
  if (isBest) save.best = sc;
  save.coins += P.coins; persist();
  $('overScore').textContent = sc; $('overNew').textContent = isBest ? '★ NEW BEST ★' : '';
  $('oDist').textContent = Math.floor(P.d) + 'm'; $('oSmash').textContent = P.smashes; $('oCoins').textContent = P.coins;
  $('oCombo').textContent = P.bestCombo; $('oBest').textContent = save.best; $('oBank').textContent = save.coins;
  document.body.classList.remove('playing'); setHint(null);
  showScreen('over');
}
function setPaused(p) {
  if (mode !== 'play' || paused === p) return;
  if (p) renderMenu();
  paused = p; document.body.classList.toggle('paused', p); showScreen(p ? 'pause' : '');
  sfx.suspend(p);
}

/* ===================================================================== */
/* input                                                                  */
/* ===================================================================== */
let steerId = null, steerX0 = 0, steerTx0 = 0, steerTh0 = 0, lastPX = 0;
stage.addEventListener('pointerdown', (e) => {
  sfx.init();
  if (mode !== 'play' || paused || e.target.closest('.btn,.screen,#pauseBtn')) return;
  if (steerId !== null) return;
  steerId = e.pointerId; steerX0 = lastPX = e.clientX; steerTx0 = P.tx; steerTh0 = P.tth;
  try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
});
stage.addEventListener('pointermove', (e) => {
  if (e.pointerId !== steerId || mode !== 'play') return;
  lastPX = e.clientX;
  if (P.tube) P.tth = steerTh0 + (e.clientX - steerX0) / stage.clientWidth * Math.PI * 2 * 1.1;
  else P.tx = clamp(steerTx0 + (e.clientX - steerX0) / stage.clientWidth * W * 1.3, -LIM, LIM);
});
const endSteer = (e) => { if (e.pointerId === steerId) steerId = null; };
stage.addEventListener('pointerup', endSteer); stage.addEventListener('pointercancel', endSteer);
stage.addEventListener('contextmenu', (e) => e.preventDefault());

function bindBtn(id, fn) {
  const b = $(id);
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); b.classList.add('down'); fn(); });
  const up = () => b.classList.remove('down');
  b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
}
bindBtn('bJump', pressJump); bindBtn('bDash', pressDash); bindBtn('bSmash', pressSmash);

const keys = {};
window.addEventListener('keydown', (e) => {
  if (e.repeat) { if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); return; }
  sfx.init();
  keys[e.code] = true;
  const c = e.code;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(c)) e.preventDefault();
  if (c === 'ArrowLeft' || c === 'KeyA') P.keyDir = -1;
  else if (c === 'ArrowRight' || c === 'KeyD') P.keyDir = 1;
  else if (c === 'Space' || c === 'ArrowUp' || c === 'KeyW') {
    if (mode === 'menu' && !$('menu').classList.contains('hidden')) startRun();
    else if (mode === 'over') startRun();
    else pressJump();
  }
  else if (c === 'ShiftLeft' || c === 'ShiftRight' || c === 'KeyJ' || c === 'KeyX') pressDash();
  else if (c === 'ArrowDown' || c === 'KeyS' || c === 'ControlLeft' || c === 'KeyK' || c === 'KeyC') pressSmash();
  else if (c === 'Escape' || c === 'KeyP') setPaused(!paused);
  else if (c === 'Enter') { if (mode === 'menu' && !$('menu').classList.contains('hidden')) startRun(); else if (mode === 'over') startRun(); }
});
window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
  if ((e.code === 'ArrowLeft' || e.code === 'KeyA') && P.keyDir < 0) P.keyDir = keys.ArrowRight || keys.KeyD ? 1 : 0;
  if ((e.code === 'ArrowRight' || e.code === 'KeyD') && P.keyDir > 0) P.keyDir = keys.ArrowLeft || keys.KeyA ? -1 : 0;
});
document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });
// Only pause when the page is actually hidden. (A window 'blur' also fires from touches/drags in some embedded views.)
window.addEventListener('blur', () => { P.keyDir = 0; for (const k in keys) keys[k] = false; });

$('playBtn').onclick = startRun;
$('againBtn').onclick = startRun;
$('menuBtn').onclick = showMenu;
$('upBtn').onclick = () => { renderShop(); showScreen('shop'); };
$('shopBack').onclick = () => { renderMenu(); showScreen('menu'); };
['handBtn', 'handBtn2'].forEach((id) => { $(id).onclick = () => { save.left = !save.left; persist(); renderMenu(); }; });
['styleBtn', 'styleBtn2'].forEach((id) => { $(id).onclick = () => setStyle(STYLES[(STYLES.indexOf(style) + 1) % STYLES.length]); });
['muteBtn', 'muteBtn2'].forEach((id) => { $(id).onclick = () => { save.mute = !save.mute; persist(); sfx.mute(save.mute); renderMenu(); }; });
$('pauseBtn').addEventListener('pointerdown', (e) => { e.stopPropagation(); setPaused(true); });
$('resumeBtn').onclick = () => setPaused(false);
$('quitBtn').onclick = () => { paused = false; sfx.suspend(false); showMenu(); };

/* ===================================================================== */
/* audio (all synthesised — no asset downloads)                            */
/* ===================================================================== */
const sfx = (() => {
  let ctx = null, master = null, mGain = null, noiseBuf = null, timer = null, nextT = 0, stepI = 0, musicOn = false;
  const ROOT = [55, 43.65, 65.41, 49], CH = [[220, 261.6, 329.6], [174.6, 220, 261.6], [261.6, 329.6, 392], [196, 246.9, 293.7]];
  function init() {
    if (ctx) { if (ctx.state === 'suspended' && !paused) ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try {
      ctx = new AC(); master = ctx.createGain(); master.gain.value = save.mute ? 0 : 0.55; master.connect(ctx.destination);
      mGain = ctx.createGain(); mGain.gain.value = 0.32; mGain.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ctx = null; }
  }
  function tone(f0, f1, dur, type, vol, delay, dest) {
    if (!ctx || save.mute) return;
    const t = ctx.currentTime + (delay || 0), o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || master); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, f0, f1, delay, type, dest) {
    if (!ctx || save.mute) return;
    const t = ctx.currentTime + (delay || 0), s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = type || 'bandpass'; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || master); s.start(t); s.stop(t + dur + 0.05);
  }
  function sched() {
    if (!ctx || !musicOn || ctx.state !== 'running') return;
    const bpm = 120 + diffAt(P.d) * 22, sd = 60 / bpm / 4;
    while (nextT < ctx.currentTime + 0.25) {
      const s = stepI % 16, bar = Math.floor(stepI / 16) % 4, t = nextT - ctx.currentTime;
      if (s % 4 === 0) tone(130, 42, 0.16, 'sine', 0.9, t, mGain);
      if (s % 4 === 2) noise(0.04, 0.35, 7000, 5000, t, 'highpass', mGain);
      if (s % 2 === 0) tone(ROOT[bar] * (s % 8 === 6 ? 2 : 1), ROOT[bar] * (s % 8 === 6 ? 2 : 1), sd * 1.7, 'sawtooth', 0.32, t, mGain);
      if (s % 2 === 1) tone(CH[bar][(s >> 1) % 3], CH[bar][(s >> 1) % 3], sd * 1.2, 'square', 0.1, t, mGain);
      nextT += sd; stepI++;
    }
  }
  return {
    init,
    music(on) { init(); if (!ctx) return; musicOn = on; if (on && !timer) { nextT = ctx.currentTime + 0.05; stepI = 0; timer = setInterval(sched, 60); } mGain.gain.value = on ? 0.32 : 0; },
    mute(m) { if (master) master.gain.value = m ? 0 : 0.55; },
    suspend(p) { if (!ctx) return; if (p) ctx.suspend(); else ctx.resume(); },
    bounce() { tone(170, 90, 0.08, 'sine', 0.12); },
    jump(n) { tone(n === 1 ? 300 : 460, n === 1 ? 620 : 900, 0.14, 'square', 0.1); },
    dash() { noise(0.28, 0.5, 400, 4200, 0, 'bandpass'); tone(180, 760, 0.25, 'sawtooth', 0.12); },
    smash() { noise(0.35, 0.7, 5200, 500, 0, 'bandpass'); tone(1500, 300, 0.22, 'triangle', 0.18); tone(2300, 700, 0.12, 'square', 0.05); },
    perfect() { [660, 880, 1320].forEach((f, i) => tone(f, f, 0.12, 'square', 0.1, i * 0.05)); },
    coin() { tone(988, 988, 0.07, 'square', 0.08); tone(1480, 1480, 0.12, 'square', 0.08, 0.06); },
    pickup() { [440, 660, 880, 1320].forEach((f, i) => tone(f, f, 0.12, 'triangle', 0.16, i * 0.06)); },
    hurt() { tone(260, 55, 0.35, 'sawtooth', 0.3); noise(0.3, 0.5, 1800, 200); },
    shieldHit() { tone(900, 300, 0.25, 'triangle', 0.25); noise(0.2, 0.3, 4000, 800); },
    slamStart() { tone(500, 90, 0.2, 'sawtooth', 0.14); },
    slam() { tone(120, 38, 0.3, 'sine', 0.7); noise(0.3, 0.6, 1400, 120, 0, 'lowpass'); },
    slide() { noise(0.55, 0.28, 2200, 700, 0, 'bandpass'); },
    lava() { noise(0.5, 0.6, 900, 120, 0, 'lowpass'); tone(160, 50, 0.35, 'sawtooth', 0.25); },
    pop() { tone(500, 1100, 0.1, 'sine', 0.2); noise(0.12, 0.3, 4000, 1500); },
    boing() { tone(200, 900, 0.22, 'sine', 0.3); tone(400, 1200, 0.15, 'triangle', 0.15, 0.05); },
    charge() { tone(180, 640, 0.9, 'sawtooth', 0.05); },
    cannon() { noise(0.25, 0.7, 2500, 150, 0, 'lowpass'); tone(110, 45, 0.25, 'sine', 0.6); },
    shift() { noise(0.6, 0.6, 200, 7000, 0, 'bandpass'); [330, 440, 554, 740, 988].forEach((f, i) => tone(f, f, 0.18, 'square', 0.12, i * 0.06)); tone(90, 40, 0.5, 'sine', 0.5); },
    whistle() { tone(1400, 260, 0.9, 'sine', 0.07); },
    boost() { noise(0.5, 0.5, 300, 5200, 0, 'bandpass'); tone(150, 600, 0.4, 'sawtooth', 0.16); },
    scrape() { noise(0.08, 0.12, 3500, 2500); },
    empty() { tone(120, 90, 0.08, 'square', 0.1); },
    fall() { tone(500, 60, 0.6, 'sine', 0.3); },
    die() { tone(440, 40, 0.9, 'sawtooth', 0.3); noise(0.8, 0.6, 3000, 80); if (mGain) mGain.gain.value = 0.1; },
  };
})();

/* ===================================================================== */
/* main loop                                                              */
/* ===================================================================== */
let last = performance.now(), acc = 0, dbgHold = false, dbgPal = null, dbgFreezeVis = false;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (!paused) {
    acc += dt; let n = 0;
    while (acc >= STEP && n < 9) { if (!dbgHold) step(STEP); acc -= STEP; n++; }
    if (n >= 9) acc = 0;
    if (!dbgFreezeVis) updateVisuals(dt);
  }
  renderFrame(now);
}

initPost();
setStyle(style, true);
resize();
showMenu();
requestAnimationFrame(frame);

if (/[?&]debug\b/.test(location.search)) {
  // test hooks (only with ?debug): freeze a single pattern in front of the ball for screenshots
  const isolate = (type, ahead) => {
    startRun(); clearWorld(); initPlayer(); world.attract = true; world.segD = -SEG; world.genD = 20;
    PATTERNS[type].build(60, 20); world.genD = 1e9; genUntil(0); P.d = 60 - (ahead || 26);
    dbgHold = true;
  };
  window.__bb = { wallH, platSupport, renderer, setStyle, get style() { return style; }, post, P, world, save, scene, camera, startRun, showMenu, step, get mode() { return mode; }, pop, patterns: PATTERNS, genUntil, isolate, hold(v) { dbgHold = v; }, setPal(v) { dbgPal = v; },
    // deterministic single frame for A/B measurements: n fixed sim steps, one fixed visual update, one render
    stepFrame(n, dtv) { dbgFreezeVis = true; for (let i = 0; i < n; i++) step(STEP); updateVisuals(dtv); renderFrame(performance.now()); } };
}
})();
