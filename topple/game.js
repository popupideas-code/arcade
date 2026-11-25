(function(){
'use strict';
/* ============================== TOPPLE ============================== */
const Q=new URLSearchParams(location.search),qn=(k,d)=>Q.has(k)?+Q.get(k):d;
const SP=qn('sp',.62), GRAV=qn('g',40), HSTEP=1/qn('hz',120);
const TY={
  n:{w:.5,h:1,t:.15,m:1,cap:600,pts:10},
  T:{w:.8,h:2,t:.25,m:2.2,cap:80,pts:40},
  W:{w:2.4,h:1,t:.15,m:1.8,cap:80,pts:25}
};
const SAMPLE={n:[[0,.21]],T:[[0,.38]],W:[[-.9,.21],[0,.21],[.9,.21]]};
const MAXD=560;
const V3=THREE.Vector3;
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const wrap=a=>{while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a};
const LS={get(k,d){try{const v=localStorage.getItem('topple.'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem('topple.'+k,JSON.stringify(v))}catch(e){}}};
function rng(seed){let a=seed>>>0;return function(){a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}

/* ------------------------------ progress ------------------------------ */
const S=Object.assign({pts:0,bestFree:0,bestChain:0,skin:'rainbow',floor:'wood',snd:true,daily:{},streak:0,lastDay:'',runs:0,gap:.62,seenHelp:false},LS.get('save',{}));
function saveS(){LS.set('save',S)}
const MODS=[
  {id:'straight',name:'Straight',at:0},{id:'curve',name:'Curve',at:0},
  {id:'snake',name:'Snake',at:400},{id:'fork',name:'Fork',at:1000},
  {id:'fan',name:'Fan',at:2200},{id:'stairs',name:'Hill',at:4000},
  {id:'jump',name:'Jump',at:6500},{id:'spiral',name:'Spiral',at:9000},
  {id:'block',name:'Block',at:13000}
];
const SKINS=[
  {id:'rainbow',name:'Rainbow',at:0},{id:'ivory',name:'Ivory',at:0},
  {id:'sunset',name:'Sunset',at:800},{id:'ocean',name:'Ocean',at:2000},
  {id:'candy',name:'Candy',at:5000},{id:'gold',name:'Gold & Ink',at:8000}
];
const FLOORS=[
  {id:'wood',name:'Oak Table',at:0},{id:'felt',name:'Green Felt',at:1200},
  {id:'blue',name:'Blueprint',at:3000},{id:'night',name:'Neon Night',at:7000}
];
const unlocked=(it,daily)=>S.pts>=it.at||(daily&&MODS.includes(it));
function skinColor(c){
  const k=S.skin,col=new THREE.Color();
  if(k==='ivory')return col.setRGB(.95,.92,.84);
  if(k==='gold')return (c&1)?col.setRGB(.9,.68,.12):col.setRGB(.16,.15,.2);
  if(k==='candy'){const a=[0xff7eb6,0x7ff2d0,0xffe27a,0xb79bff];return col.setHex(a[c%4])}
  const t=Math.abs(((c*.035)%2)-1);
  if(k==='sunset')return col.setHSL((.98+t*.15)%1,.85,.6);
  if(k==='ocean')return col.setHSL(.5+t*.16,.75,.56);
  return col.setHSL((c*.014)%1,.72,.6);
}

/* ------------------------------ renderer / scene ------------------------------ */
const cv=$('gl');
const renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputEncoding=THREE.sRGBEncoding;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(50,1,.1,300);
scene.add(new THREE.HemisphereLight(0xffffff,0x5a4d7a,.78));
const sun=new THREE.DirectionalLight(0xfff3dd,.95);
sun.position.set(-9,16,7);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.0004;sun.shadow.normalBias=.02;
const sc=sun.shadow.camera;sc.left=-22;sc.right=22;sc.top=22;sc.bottom=-22;sc.near=1;sc.far=60;
scene.add(sun);scene.add(sun.target);

function faceTex(){
  const c=document.createElement('canvas');c.width=64;c.height=128;const g=c.getContext('2d');
  g.fillStyle='#fff';g.fillRect(0,0,64,128);
  g.fillStyle='#2a2438';g.fillRect(6,62,52,4);
  const pip=(x,y)=>{g.beginPath();g.arc(x,y,5,0,7);g.fill()};
  [[20,18],[44,18],[32,40],[20,98],[44,98],[32,110],[20,118],[44,118]].forEach(p=>pip(p[0],p[1]));
  const t=new THREE.CanvasTexture(c);t.anisotropy=4;t.encoding=THREE.sRGBEncoding;return t;
}
const tex=faceTex();
const sideM=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.45,metalness:0});
const faceM=new THREE.MeshStandardMaterial({color:0xffffff,map:tex,roughness:.45,metalness:0});
const plainM=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.45,metalness:0});
const geo={},inst={},ghost={};
const ghostMat=new THREE.MeshBasicMaterial({color:0x7cffb2,transparent:true,opacity:.55,depthWrite:false});
const ghostBad=new THREE.MeshBasicMaterial({color:0xff5a6e,transparent:true,opacity:.55,depthWrite:false});
for(const k in TY){
  const d=TY[k];
  geo[k]=new THREE.BoxGeometry(d.w,d.h,d.t);
  const mats=k==='W'?plainM:[sideM,sideM,sideM,sideM,faceM,faceM];
  inst[k]=new THREE.InstancedMesh(geo[k],mats,d.cap);
  inst[k].setColorAt(0,new THREE.Color(1,1,1));inst[k].castShadow=inst[k].receiveShadow=true;inst[k].frustumCulled=false;inst[k].count=0;
  inst[k].instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(inst[k]);
  ghost[k]=new THREE.InstancedMesh(geo[k],ghostMat,90);ghost[k].frustumCulled=false;ghost[k].count=0;ghost[k].renderOrder=5;scene.add(ghost[k]);
}
const unitBox=new THREE.BoxGeometry(1,1,1);
const propGroup=new THREE.Group(),decoGroup=new THREE.Group(),ghostProps=new THREE.Group(),fxGroup=new THREE.Group();
scene.add(propGroup,decoGroup,ghostProps,fxGroup);
const stepMat=new THREE.MeshStandardMaterial({color:0x9a8fb4,roughness:.8});
const obstMat=new THREE.MeshStandardMaterial({color:0x4b3d70,roughness:.7});
const poolMat=new THREE.MeshStandardMaterial({color:0x1b5fb0,roughness:.25,metalness:.1,transparent:true,opacity:.9});
for(let i=0;i<24;i++){const m=new THREE.Mesh(unitBox,ghostMat);m.visible=false;ghostProps.add(m)}
// start arrow & cursor
const arrow=new THREE.Group();
{const cone=new THREE.Mesh(new THREE.ConeGeometry(.2,.5,16),new THREE.MeshBasicMaterial({color:0x6bf2b0}));cone.rotation.x=Math.PI/2;cone.position.z=.35;
 const tail=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,.5,10),new THREE.MeshBasicMaterial({color:0x6bf2b0}));tail.rotation.x=Math.PI/2;tail.position.z=-.05;arrow.add(cone,tail)}
arrow.visible=false;scene.add(arrow);
const cursor=new THREE.Mesh(new THREE.RingGeometry(.5,.62,32),new THREE.MeshBasicMaterial({color:0xff6b8a,transparent:true,opacity:.8,side:THREE.DoubleSide}));
cursor.rotation.x=-Math.PI/2;cursor.position.y=.03;cursor.visible=false;scene.add(cursor);

/* floor themes */
let floorMesh=null,groundMesh=null,rimGroup=new THREE.Group();scene.add(rimGroup);
const FT={
  wood:{bg:0x2a2038,draw(g){g.fillStyle='#b98a5a';g.fillRect(0,0,512,512);for(let i=0;i<4;i++){g.fillStyle=i%2?'#c4966a':'#ae7f50';g.fillRect(0,i*128,512,126);g.fillStyle='rgba(60,30,10,.35)';g.fillRect(0,i*128+126,512,2)}
    for(let i=0;i<260;i++){g.fillStyle='rgba(70,35,10,'+(Math.random()*.1)+')';g.fillRect(Math.random()*512,Math.random()*512,Math.random()*90+10,1)}},grid:'rgba(255,255,255,.07)'},
  felt:{bg:0x14281f,draw(g){g.fillStyle='#1f6b4a';g.fillRect(0,0,512,512);for(let i=0;i<3000;i++){g.fillStyle='rgba(255,255,255,'+Math.random()*.05+')';g.fillRect(Math.random()*512,Math.random()*512,2,2)}},grid:'rgba(255,255,255,.1)'},
  blue:{bg:0x0c1a33,draw(g){g.fillStyle='#17407a';g.fillRect(0,0,512,512);g.strokeStyle='rgba(255,255,255,.12)';g.lineWidth=1;for(let i=0;i<=16;i++){g.beginPath();g.moveTo(i*32,0);g.lineTo(i*32,512);g.moveTo(0,i*32);g.lineTo(512,i*32);g.stroke()}},grid:'rgba(255,255,255,.35)'},
  night:{bg:0x07040f,draw(g){g.fillStyle='#16102a';g.fillRect(0,0,512,512)},grid:'rgba(88,184,255,.5)'}
};
function floorTexture(id){
  const th=FT[id]||FT.wood,c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d');
  th.draw(g);g.strokeStyle=th.grid;g.lineWidth=3;g.strokeRect(0,0,512,512);
  g.lineWidth=1;g.beginPath();g.moveTo(256,0);g.lineTo(256,512);g.moveTo(0,256);g.lineTo(512,256);g.stroke();
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;t.encoding=THREE.sRGBEncoding;return t;
}
let FW=40,FD=40;
function setFloor(w,d){
  FW=w;FD=d;
  const th=FT[S.floor]||FT.wood;
  if(floorMesh){scene.remove(floorMesh);floorMesh.material.map.dispose();floorMesh.material.dispose();floorMesh.geometry.dispose()}
  const t=floorTexture(S.floor);t.repeat.set(w/4,d/4);
  floorMesh=new THREE.Mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshStandardMaterial({map:t,roughness:.85}));
  floorMesh.rotation.x=-Math.PI/2;floorMesh.receiveShadow=true;scene.add(floorMesh);
  if(!groundMesh){groundMesh=new THREE.Mesh(new THREE.PlaneGeometry(400,400),new THREE.MeshBasicMaterial({color:th.bg}));groundMesh.rotation.x=-Math.PI/2;groundMesh.position.y=-.05;scene.add(groundMesh)}
  groundMesh.material.color.setHex(th.bg);scene.background=new THREE.Color(th.bg);scene.fog=new THREE.Fog(th.bg,60,150);
  while(rimGroup.children.length)rimGroup.remove(rimGroup.children[0]);
  const rm=new THREE.MeshStandardMaterial({color:0x2c2440,roughness:.6});
  [[0,-d/2-.25,w+1,.5],[0,d/2+.25,w+1,.5],[-w/2-.25,0,.5,d],[w/2+.25,0,.5,d]].forEach(r=>{const m=new THREE.Mesh(unitBox,rm);m.position.set(r[0],.25,r[1]);m.scale.set(r[2],.5,r[3]);m.castShadow=m.receiveShadow=true;rimGroup.add(m)});
  const hs=Math.max(w,d)/2+4;sc.left=-hs;sc.right=hs;sc.top=hs;sc.bottom=-hs;sc.updateProjectionMatrix();
}

/* ------------------------------ layout ------------------------------ */
let L=newLayout();
function newLayout(){return{d:[],p:[],f:[],deco:[],targets:[],g:{},start:null,uid:1,n:0,daily:null,fw:40,fd:40,budget:Infinity,kit:null}}
const mat4=new THREE.Matrix4(),quat=new THREE.Quaternion(),pos=new V3(),one=new V3(1,1,1),yAxis=new V3(0,1,0);
let dirty=true,undoStack=[];
function snap(){return JSON.stringify({d:L.d,p:L.p,g:L.g,start:L.start,uid:L.uid,n:L.n,kit:L.kit})}
function pushUndo(s){undoStack.push(s||snap());if(undoStack.length>40)undoStack.shift();updHud()}
function restore(s){const o=JSON.parse(s);L.d=o.d;L.p=o.p;L.g=o.g;L.start=o.start;L.uid=o.uid;L.n=o.n;L.kit=o.kit;dirty=true;updHud()}
function undo(){if(!undoStack.length)return;restore(undoStack.pop());saveFree()}
function userCount(){let n=0;for(const d of L.d)if(!d.lock)n++;return n}
function addDom(x,z,r,ty,y,gid,lock){
  const d={id:L.uid++,x,z,r,ty,y:y||0,c:L.n++,g:gid};if(lock)d.lock=1;L.d.push(d);return d;
}
function pointsOf(x,z,r,ty){
  const s=SAMPLE[ty],cr=Math.cos(r),sr=Math.sin(r),out=[];
  for(const p of s)out.push([x+p[0]*cr,z-p[0]*sr,p[1]]);
  return out;
}
function inRect(px,pz,o,pad){
  const dx=px-o.x,dz=pz-o.z,c=Math.cos(o.r||0),s=Math.sin(o.r||0);
  const lx=dx*c-dz*s,lz=dx*s+dz*c;
  return Math.abs(lx)<o.w/2+pad&&Math.abs(lz)<o.d/2+pad;
}
function blockedAt(x,z,r,ty,y,ign){
  const pts=pointsOf(x,z,r,ty);
  for(const q of pts){
    if(Math.abs(q[0])>L.fw/2-.4||Math.abs(q[1])>L.fd/2-.4)return true;
    for(const o of L.f)if(y<o.h-.02&&inRect(q[0],q[1],o,q[2]))return true;
    for(const o of L.deco)if(o.nogo&&inRect(q[0],q[1],o,q[2]))return true;
    for(const o of L.p)if(y<o.h-.02&&inRect(q[0],q[1],o,q[2]))return true;
  }
  const R=pts.length>1?1.3:.5;
  for(const e of L.d){
    if(ign&&ign.has(e))continue;
    if(Math.abs(e.x-x)>R+1.3||Math.abs(e.z-z)>R+1.3)continue;
    if(Math.abs((e.y||0)-y)>.9)continue;
    const ep=pointsOf(e.x,e.z,e.r,e.ty);
    for(const a of pts)for(const b of ep){const dx=a[0]-b[0],dz=a[1]-b[1],rr=(a[2]+b[2])*.96;if(dx*dx+dz*dz<rr*rr)return true}
  }
  return false;
}

/* ---- module builders (local frame: first domino at origin, forward = +z) ---- */
function Tt(){this.x=0;this.z=0;this.h=0;this.it=[]}
Tt.prototype={
  dom(ty,y){this.it.push({x:this.x,z:this.z,r:this.h,ty:ty||'n',y:y||0});return this},
  mv(d){this.x+=Math.sin(this.h)*d;this.z+=Math.cos(this.h)*d;return this},
  straight(n){for(let i=0;i<n;i++){this.mv(SP);this.dom()}return this},
  turn(deg,n){const dh=deg*Math.PI/180/n;for(let i=0;i<n;i++){this.h+=dh/2;this.mv(SP);this.h+=dh/2;this.dom()}return this},
  last(){const a=this.it[this.it.length-1];return{x:a.x,z:a.z,r:a.r}}
};
function plate(t,ty){t.mv(SP);t.dom(ty||'W');return t.z}
const BUILD={
  straight(){const t=new Tt();t.dom().straight(7);return{it:t.it,exits:[t.last()]}},
  curve(){const t=new Tt();t.dom().turn(90,7);return{it:t.it,exits:[t.last()]}},
  snake(){const t=new Tt();t.dom().turn(40,4).turn(-80,8).turn(40,4);return{it:t.it,exits:[t.last()]}},
  fork(){
    const t=new Tt();t.dom().straight(2);const pz=plate(t);const it=t.it.slice(),exits=[];
    [-1,1].forEach(s=>{const b=new Tt();b.x=s*.75;b.z=pz+SP;b.dom().turn(s*45,6).straight(4);it.push(...b.it);exits.push(b.last())});
    return{it,exits};
  },
  fan(){
    const t=new Tt();t.dom().straight(2);const pz=plate(t);const it=t.it.slice(),exits=[];
    [[-.9,-28],[-.3,-9],[.3,9],[.9,28]].forEach(a=>{const b=new Tt();b.x=a[0];b.z=pz+SP;b.h=a[1]*Math.PI/180;b.dom().straight(5);it.push(...b.it);exits.push(b.last())});
    return{it,exits};
  },
  stairs(){
    const ys=[0,0,.14,.28,.42,.56,.7,.7,.7,.7,.56,.42,.28,.14,0,0];
    const it=[],pr=[];
    ys.forEach((y,i)=>{it.push({x:0,z:i*SP,r:0,ty:'n',y});if(y>0)pr.push({x:0,z:i*SP,r:0,w:1.3,d:SP,h:y})});
    return{it,pr,exits:[{x:0,z:(ys.length-1)*SP,r:0}]};
  },
  jump(){
    const t=new Tt();t.dom().straight(2);const zT=t.z+.62;
    const it=t.it.slice();it.push({x:0,z:zT,r:0,ty:'T',y:0});
    const zR=zT+1.75;const b=new Tt();b.z=zR;b.dom().straight(4);it.push(...b.it);
    return{it,deco:[{k:'pool',x:0,z:(zT+zR)/2,w:2.2,d:zR-zT-.7}],exits:[b.last()]};
  },
  spiral(){
    const r0=1.35,k=1.3/(2*Math.PI),thMax=3.3*Math.PI,pts=[];let th=0;
    while(th<thMax){const r=r0+k*th;pts.push([r*Math.cos(th),r*Math.sin(th)]);th+=SP/Math.sqrt(r*r+k*k)}
    const hd=i=>{const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)];return Math.atan2(b[0]-a[0],b[1]-a[1])};
    const h0=Math.atan2(pts[1][0]-pts[0][0],pts[1][1]-pts[0][1]),a=-h0,c=Math.cos(a),s=Math.sin(a);
    const it=pts.map((p,i)=>{const dx=p[0]-pts[0][0],dz=p[1]-pts[0][1];return{x:dx*c+dz*s,z:-dx*s+dz*c,r:hd(i)+a,ty:'n',y:0}});
    const l=it[it.length-1];return{it,exits:[{x:l.x,z:l.z,r:l.r}]};
  },
  block(){
    const t=new Tt();t.dom().straight(1);const pz=plate(t);const it=t.it.slice();
    for(let r=0;r<8;r++)[-.9,-.3,.3,.9].forEach(x=>it.push({x,z:pz+SP*(r+1),r:0,ty:'n',y:0}));
    return{it,exits:[]};
  }
};
// the spiral builder uses a mathematical frame; normalise orientation check at startup via tests
const modCache={};
function modDef(id,mirror){
  const key=id+(mirror?'m':'');if(modCache[key])return modCache[key];
  const b=BUILD[id]();
  const f=o=>mirror?Object.assign({},o,{x:-o.x,r:-(o.r||0)}):o;
  const out={it:b.it.map(f),pr:(b.pr||[]).map(f),deco:(b.deco||[]).map(f),exits:b.exits.map(f)};
  return modCache[key]=out;
}
const MODSET={};
function xform(def,ax,az,a){
  const c=Math.cos(a),s=Math.sin(a),T=(x,z)=>[ax+x*c+z*s,az-x*s+z*c];
  return{
    it:def.it.map(o=>{const p=T(o.x,o.z);return{x:p[0],z:p[1],r:o.r+a,ty:o.ty,y:o.y}}),
    pr:def.pr.map(o=>{const p=T(o.x,o.z);return{x:p[0],z:p[1],r:(o.r||0)+a,w:o.w,d:o.d,h:o.h}}),
    deco:def.deco.map(o=>{const p=T(o.x,o.z);return{k:o.k,x:p[0],z:p[1],r:(o.r||0)+a,w:o.w,d:o.d}}),
    exits:def.exits.map(o=>{const p=T(o.x,o.z);return{x:p[0],z:p[1],r:o.r+a}})
  };
}
function stampCheck(w,count){
  if(userCount()+w.it.length>L.budget)return'budget';
  if(w.it.length>L.budget-userCount())return'budget';
  for(const o of w.it)if(blockedAt(o.x,o.z,o.r,o.ty,o.y,null))return'blocked';
  for(const pr of w.pr){ // props must not swallow existing ground dominos
    for(const e of L.d){if((e.y||0)<pr.h-.02){for(const q of pointsOf(e.x,e.z,e.r,e.ty))if(inRect(q[0],q[1],pr,q[2]))return'blocked'}}
  }
  return'';
}
function stampCommit(id,w,fromLoad){
  const gid='g'+L.uid++;const first=L.d.length;
  for(const o of w.it)addDom(o.x,o.z,o.r,o.ty,o.y,gid);
  for(const pr of w.pr)L.p.push(Object.assign({id:L.uid++,g:gid,y:0},pr));
  for(const d of w.deco)L.deco.push(d);
  L.g[gid]={exits:[]};
  // exits tied to nearest placed dominos
  for(const e of w.exits){let best=null,bd=1e9;for(let i=first;i<L.d.length;i++){const d=L.d[i],dd=(d.x-e.x)**2+(d.z-e.z)**2;if(dd<bd){bd=dd;best=d}}if(best)L.g[gid].exits.push({x:e.x,z:e.z,r:e.r,id:best.id})}
  if(L.start==null&&!L.daily&&L.d.length>first)L.start=L.d[first].id;
  dirty=true;
  return gid;
}
function endsList(){
  const out=[],alive=new Set(L.d.map(d=>d.id));
  for(const g in L.g)for(const e of L.g[g].exits)if(alive.has(e.id))out.push(e);
  if(L.daily&&L.d[0]&&L.d[0].lock)out.push({x:L.d[0].x,z:L.d[0].z,r:L.d[0].r,id:L.d[0].id});
  return out;
}
function nearestEnd(p,rad){let b=null,bd=rad*rad;for(const e of endsList()){const d=(e.x-p.x)**2+(e.z-p.z)**2;if(d<bd){bd=d;b=e}}return b}

/* ------------------------------ render sync ------------------------------ */
const _c=new THREE.Color();
function refresh(){
  const cnt={n:0,T:0,W:0};
  for(const d of L.d){
    const k=d.ty,i=cnt[k]++;d._i=i;
    quat.setFromAxisAngle(yAxis,d.r);pos.set(d.x,(d.y||0)+TY[k].h/2,d.z);
    mat4.compose(pos,quat,one);inst[k].setMatrixAt(i,mat4);
    inst[k].setColorAt(i,skinColor(d.c));
  }
  for(const k in TY){inst[k].count=cnt[k];inst[k].instanceMatrix.needsUpdate=true;if(inst[k].instanceColor)inst[k].instanceColor.needsUpdate=true}
  // props + deco
  while(propGroup.children.length)propGroup.remove(propGroup.children[0]);
  const mk=(o,m)=>{const e=new THREE.Mesh(unitBox,m);e.position.set(o.x,o.h/2,o.z);e.rotation.y=o.r||0;e.scale.set(o.w,o.h,o.d);e.castShadow=e.receiveShadow=true;propGroup.add(e)};
  L.p.forEach(o=>mk(o,stepMat));L.f.forEach(o=>mk(o,obstMat));
  while(decoGroup.children.length)decoGroup.remove(decoGroup.children[0]);
  L.deco.forEach(o=>{const e=new THREE.Mesh(unitBox,poolMat);e.position.set(o.x,.015,o.z);e.rotation.y=o.r||0;e.scale.set(o.w,.03,o.d);e.receiveShadow=true;decoGroup.add(e)});
  L.targets.forEach(t=>{if(!t._m){const g=new THREE.Group();const ring=new THREE.Mesh(new THREE.RingGeometry(t.r-.22,t.r,40),new THREE.MeshBasicMaterial({color:0xffc21f,side:THREE.DoubleSide,transparent:true,opacity:.95}));
    const disc=new THREE.Mesh(new THREE.CircleGeometry(t.r-.22,40),new THREE.MeshBasicMaterial({color:0xffc21f,transparent:true,opacity:.3,side:THREE.DoubleSide}));
    ring.rotation.x=disc.rotation.x=-Math.PI/2;ring.position.y=.04;disc.position.y=.035;g.add(ring,disc);g.position.set(t.x,0,t.z);t._m=g;t._ring=ring;t._disc=disc}
    if(!t._m.parent)fxGroup.add(t._m)});
  dirty=false;
}
function recolor(){dirty=true}

/* ------------------------------ camera ------------------------------ */
const camState={tx:0,tz:0,dist:24,pitch:1.0};
const C={pos:new V3(0,20,14),look:new V3(0,0,0)};
const chase={front:new V3(),dir:new V3(0,0,-1),spread:0,init:false};
let camMode='chase',timeScale=1;
function buildPose(){const p=camState.pitch,d=camState.dist;return{pos:new V3(camState.tx,d*Math.sin(p),camState.tz+d*Math.cos(p)),look:new V3(camState.tx,0,camState.tz)}}
function fitBuild(){
  const a=innerWidth/innerHeight,need=Math.max(L.fw/(a*1.35),L.fd*.8);
  camState.dist=clamp(Math.min(need,44),14,52);camState.tx=0;camState.tz=0;
  const asp=innerWidth/innerHeight;
  if(L.daily){camState.dist=clamp(Math.max(L.fd*.95,L.fw/asp*.9)*.9,20,52);camState.tz=2.5}else camState.dist=innerWidth<700?24:22;
}
function resize(){
  const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=w/h<.8?58:48;camera.updateProjectionMatrix();
}
addEventListener('resize',resize);addEventListener('orientationchange',()=>setTimeout(resize,200));

const ray=new THREE.Raycaster(),ndc=new THREE.Vector2(),gplane=new THREE.Plane(new V3(0,1,0),0),hitv=new V3();
function toWorld(cx,cy){
  const r=cv.getBoundingClientRect();ndc.set((cx-r.left)/r.width*2-1,-((cy-r.top)/r.height*2-1));
  ray.setFromCamera(ndc,camera);return ray.ray.intersectPlane(gplane,hitv)?{x:hitv.x,z:hitv.z}:null;
}

/* ------------------------------ audio ------------------------------ */
let AC=null,lastClick=0;
function audioInit(){if(AC)return;try{AC=new(window.AudioContext||window.webkitAudioContext)()}catch(e){}if(AC&&AC.state==='suspended')AC.resume()}
const SCALE=[0,2,4,7,9];
function click(streak,big){
  if(!S.snd||!AC||demo)return;const t=AC.currentTime;if(t-lastClick<.03)return;lastClick=t;
  const i=Math.min(streak,34),n=SCALE[i%5]+12*Math.floor(i/5%3);
  const f=(big?196:330)*Math.pow(2,n/12);
  const o=AC.createOscillator(),g=AC.createGain();o.type=big?'sine':'triangle';o.frequency.value=f;
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(big?.16:.07,t+.004);g.gain.exponentialRampToValueAtTime(.0001,t+(big?.35:.11));
  o.connect(g);g.connect(AC.destination);o.start(t);o.stop(t+(big?.4:.13));
}
function chime(){if(!S.snd||!AC)return;[0,4,7,12].forEach((n,i)=>{const t=AC.currentTime+i*.09,o=AC.createOscillator(),g=AC.createGain();o.type='sine';o.frequency.value=392*Math.pow(2,n/12);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.14,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+.5);o.connect(g);g.connect(AC.destination);o.start(t);o.stop(t+.55)})}

/* ------------------------------ UI helpers ------------------------------ */
let toastT=0;
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),1700)}
const fmt=n=>Math.round(n).toLocaleString();
function popup(txt,p,cls){
  const v=new V3(p.x,.8,p.z).project(camera);if(v.z>1)return;
  const e=document.createElement('div');e.className='pop '+(cls||'');e.textContent=txt;
  e.style.left=((v.x+1)/2*innerWidth)+'px';e.style.top=((1-v.y)/2*innerHeight)+'px';
  $('app').appendChild(e);e.addEventListener('animationend',()=>e.remove());
}
function dayKey(){const d=new Date();return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0')}
function modIcon(id){
  const b=modDef(id,false);let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;
  b.it.forEach(o=>{x0=Math.min(x0,o.x);x1=Math.max(x1,o.x);z0=Math.min(z0,o.z);z1=Math.max(z1,o.z)});
  const w=x1-x0+1.4,h=z1-z0+1.4,sc=Math.min(34/w,28/h);let s='';
  b.it.forEach(o=>{const px=17+(o.x-(x0+x1)/2)*sc,py=14-(o.z-(z0+z1)/2)*sc;const tw=TY[o.ty].w*sc,th=Math.max(1.4,TY[o.ty].t*sc*1.4);
    s+=`<rect x="${-tw/2}" y="${-th/2}" width="${tw}" height="${th}" rx=".6" transform="translate(${px} ${py}) rotate(${o.r*180/Math.PI})" fill="#ffd9a0"/>`});
  return`<svg viewBox="0 0 34 28">${s}</svg>`;
}

/* ------------------------------ state ------------------------------ */
let mode='menu',kind='free',demo=false,tool='draw',stamp={id:'straight',rot:Math.PI,mirror:false};
function setMode(m){
  mode=m;
  $('menu').classList.toggle('hide',m!=='menu');
  $('hudBuild').classList.toggle('hide',m!=='build');
  $('hudPlay').classList.toggle('hide',!(m==='play'||m==='result'));
}
function updHud(){
  const used=userCount(),max=L.budget===Infinity?MAXD:L.budget;
  $('cnt').innerHTML=(L.daily?'Daily '+L.daily.key:'Freestyle')+'<br>'+used+' / '+(L.budget===Infinity?'∞':max)+'<small>dominos</small>';
  $('cnt').innerHTML=`<small>${L.daily?'Daily · '+L.daily.key:'Freestyle'}</small>${used} / ${L.budget===Infinity?'∞':L.budget}`;
  $('bUndo').disabled=!undoStack.length;
  $('bSnd').style.opacity=S.snd?1:.4;
  renderOpts();
}
function renderOpts(){
  const o=$('opts');
  document.querySelectorAll('#tools [data-tool]').forEach(b=>b.classList.toggle('on',b.dataset.tool===tool));
  if(tool==='draw'){
    o.innerHTML=`<span class="lbl">Tight</span><input id="gapR" type="range" min="45" max="85" value="${Math.round(S.gap*100)}"><span class="lbl">Wide</span>`;
    $('gapR').oninput=e=>{S.gap=e.target.value/100;saveS()};
  }else if(tool==='stamp'){
    const tiles=MODS.map(m=>{
      const lock=!(S.pts>=m.at||L.daily),left=L.kit&&L.kit[m.id]!=null?L.kit[m.id]:null;
      return`<div class="tile ${stamp.id===m.id?'sel':''} ${lock?'lock':''}" data-mod="${m.id}">${modIcon(m.id)}<span>${m.name}</span>${left!=null?`<span class="bd">×${left}</span>`:''}${lock?`<span class="lk">🔒 ${fmt(m.at)}</span>`:''}</div>`}).join('');
    o.innerHTML=`<div id="tray">${tiles}</div><button class="btn sq" id="bRot">⟳</button><button class="btn sq ${stamp.mirror?'on':''}" id="bMir">⇋</button>`;
    o.querySelectorAll('.tile').forEach(t=>{t.addEventListener('pointerdown',e=>tileDown(e,t.dataset.mod))});
    $('bRot').onclick=()=>{stamp.rot-=Math.PI/4;stampStep()};$('bMir').onclick=()=>{stamp.mirror=!stamp.mirror;renderOpts()};
  }else if(tool==='erase'){o.innerHTML='<div id="hint">Drag across dominos to erase them. Tap a hill step to remove it.</div>';}
  else{o.innerHTML='<div id="hint">Tap the domino you want to <b>start</b> the chain. It tips along the way it faces (green arrow).</div>'}
}
function setTool(t){
  if(L.daily&&t==='start')return;tool=t;ghostClear();cursor.visible=false;renderOpts();
}

/* ------------------------------ ghost / stamp ------------------------------ */
let ghostOK=false,ghostW=null,sDrag=null;
function ghostClear(){for(const k in ghost)ghost[k].count=0;ghostProps.children.forEach(m=>m.visible=false);ghostW=null}
function showGhost(w,ok){
  ghostClear();ghostW=w;ghostOK=ok;const cnt={n:0,T:0,W:0};
  for(const o of w.it){const k=o.ty;if(cnt[k]>=90)continue;quat.setFromAxisAngle(yAxis,o.r);pos.set(o.x,(o.y||0)+TY[k].h/2,o.z);mat4.compose(pos,quat,one);ghost[k].setMatrixAt(cnt[k]++,mat4);ghost[k].material=ok?ghostMat:ghostBad}
  for(const k in ghost){ghost[k].count=cnt[k];ghost[k].instanceMatrix.needsUpdate=true}
  w.pr.forEach((o,i)=>{const m=ghostProps.children[i];if(!m)return;m.visible=true;m.material=ok?ghostMat:ghostBad;m.position.set(o.x,o.h/2,o.z);m.rotation.y=o.r;m.scale.set(o.w,o.h,o.d)});
}
let lastStampPt=null;
function stampAt(p){
  lastStampPt=p;
  const m=MODS.find(m=>m.id===stamp.id);if(!(S.pts>=m.at||L.daily)){ghostClear();return}
  const def=modDef(stamp.id,stamp.mirror);let ax=p.x,az=p.z,a=stamp.rot;
  const e=nearestEnd(p,1.5);
  if(e){a=e.r+(stamp.rot-Math.PI);ax=e.x+Math.sin(e.r)*SP;az=e.z+Math.cos(e.r)*SP}
  const w=xform(def,ax,az,a);const err=stampCheck(w);
  const kitLeft=L.kit&&L.kit[stamp.id]!=null?L.kit[stamp.id]:1;
  showGhost(w,!err&&kitLeft>0);
}
function stampStep(){if(lastStampPt&&(sDrag||tool==='stamp'))stampAt(lastStampPt)}
function stampPlace(){
  if(!ghostW)return false;
  if(!ghostOK){toast(L.kit&&L.kit[stamp.id]===0?'None left of that piece':(stampCheck(ghostW)==='budget'?'Out of dominos':'No room there'));ghostClear();return false}
  pushUndo();const w=ghostW;
  if(L.kit&&L.kit[stamp.id]!=null)L.kit[stamp.id]--;
  stampCommit(stamp.id,w);ghostClear();saveFree();updHud();return true;
}
function tileDown(e,id){
  const m=MODS.find(m=>m.id===id);
  if(!(S.pts>=m.at||L.daily)){toast('Unlocks at '+fmt(m.at)+' points');return}
  stamp.id=id;audioInit();
  document.querySelectorAll('.tile').forEach(t=>t.classList.toggle('sel',t.dataset.mod===id));
  sDrag={id:e.pointerId,moved:false,sx:e.clientX,sy:e.clientY};
}
addEventListener('pointermove',e=>{
  if(!sDrag||e.pointerId!==sDrag.id)return;
  if(Math.abs(e.clientX-sDrag.sx)+Math.abs(e.clientY-sDrag.sy)>10)sDrag.moved=true;
  if(!sDrag.moved)return;
  const o=$('opts').getBoundingClientRect();
  if(e.clientY>o.top-4){ghostClear();return}
  const p=toWorld(e.clientX,e.clientY);if(p)stampAt(p);
});
function endTileDrag(e,cancel){
  if(!sDrag||e.pointerId!==sDrag.id)return;
  const was=sDrag;sDrag=null;
  if(was.moved&&!cancel){const o=$('opts').getBoundingClientRect();if(e.clientY<=o.top-4)stampPlace();else ghostClear()}
  else ghostClear();
  renderOpts();
}
addEventListener('pointerup',e=>endTileDrag(e,false));
addEventListener('pointercancel',e=>endTileDrag(e,true));

/* ------------------------------ canvas input ------------------------------ */
const ptrs=new Map();let gesture=null,act=null,spaceDown=false;
addEventListener('keydown',e=>{if(e.code==='Space')spaceDown=true;if(mode==='build'){if(e.key==='z'&&(e.ctrlKey||e.metaKey))undo();if(e.key==='r')stampStepRot()}});
addEventListener('keyup',e=>{if(e.code==='Space')spaceDown=false});
function stampStepRot(){stamp.rot-=Math.PI/4;stampStep()}
cv.addEventListener('contextmenu',e=>e.preventDefault());
cv.addEventListener('wheel',e=>{if(mode!=='build')return;e.preventDefault();camState.dist=clamp(camState.dist*Math.exp(e.deltaY*.001),8,52)},{passive:false});
cv.addEventListener('pointerdown',e=>{
  if(mode!=='build')return;audioInit();
  cv.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(ptrs.size>=2){endAct();startGesture();return}
  if(e.pointerType==='mouse'&&(e.button!==0||spaceDown)){gesture={mouse:true,x:e.clientX,y:e.clientY};return}
  beginAct(e);
});
cv.addEventListener('pointermove',e=>{
  if(mode!=='build'){return}
  const pr=ptrs.get(e.pointerId);
  if(!pr){if(e.pointerType==='mouse'&&(tool==='erase'||tool==='start')){const p=toWorld(e.clientX,e.clientY);if(p){cursor.position.set(p.x,.03,p.z);cursor.visible=true}}
    else if(e.pointerType==='mouse'&&tool==='stamp'&&!sDrag){const p=toWorld(e.clientX,e.clientY);if(p)stampAt(p)}
    return}
  const old={x:pr.x,y:pr.y};pr.x=e.clientX;pr.y=e.clientY;
  if(gesture&&gesture.mouse){panBy(old.x,old.y,e.clientX,e.clientY);return}
  if(ptrs.size>=2&&gesture){moveGesture();return}
  if(act)moveAct(e);
});
function upPtr(e){
  if(!ptrs.has(e.pointerId))return;ptrs.delete(e.pointerId);
  if(gesture&&gesture.mouse){gesture=null;return}
  if(gesture){if(ptrs.size<2)gesture=null;return}
  endAct();
}
cv.addEventListener('pointerup',upPtr);cv.addEventListener('pointercancel',upPtr);
function panBy(x0,y0,x1,y1){
  const a=toWorld(x0,y0),b=toWorld(x1,y1);if(!a||!b)return;
  camState.tx=clamp(camState.tx+(a.x-b.x),-L.fw/2,L.fw/2);camState.tz=clamp(camState.tz+(a.z-b.z),-L.fd/2,L.fd/2);
}
function startGesture(){
  const a=[...ptrs.values()];gesture={mx:(a[0].x+a[1].x)/2,my:(a[0].y+a[1].y)/2,d:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)};
}
function moveGesture(){
  const a=[...ptrs.values()];if(a.length<2)return;
  const mx=(a[0].x+a[1].x)/2,my=(a[0].y+a[1].y)/2,d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);
  panBy(gesture.mx,gesture.my,mx,my);
  if(gesture.d>10&&d>10)camState.dist=clamp(camState.dist*gesture.d/d,8,52);
  gesture.mx=mx;gesture.my=my;gesture.d=d;
}

/* ---- tools ---- */
function beginAct(e){
  const p=toWorld(e.clientX,e.clientY);if(!p)return;
  if(tool==='draw')beginDraw(p);
  else if(tool==='stamp'){act={t:'stamp'};stampAt(p)}
  else if(tool==='erase'){act={t:'erase',snap:snap(),did:false};eraseAt(p)}
  else if(tool==='start'){
    let b=null,bd=.9;for(const d of L.d){const dd=Math.hypot(d.x-p.x,d.z-p.z);if(dd<bd){bd=dd;b=d}}
    if(b){L.start=b.id;dirty=true;saveFree();toast('Start set')}
  }
}
function moveAct(e){
  const p=toWorld(e.clientX,e.clientY);if(!p)return;
  if(act.t==='draw')drawTo(p);
  else if(act.t==='stamp')stampAt(p);
  else if(act.t==='erase'){eraseAt(p);cursor.position.set(p.x,.03,p.z)}
}
function endAct(){
  if(!act)return;const a=act;act=null;
  if(a.t==='draw'){
    if(a.last){L.g[a.gid]={exits:[{x:a.last.x,z:a.last.z,r:a.last.r,id:a.last.id}]};if(L.start==null&&!L.daily)L.start=a.firstDom.id;pushUndo(a.snap);saveFree()}
  }else if(a.t==='stamp'){stampPlace()}
  else if(a.t==='erase'){if(a.did){pushUndo(a.snap);saveFree()}cursor.visible=false}
  updHud();
}
function beginDraw(p){
  const a={t:'draw',snap:snap(),gid:'s'+L.uid++,pen:null,hd:null,last:null,firstDom:null,full:false};
  const e=nearestEnd(p,1.1);
  if(e){a.pen={x:e.x,z:e.z};a.hd=e.r}
  else{
    if(userCount()>=L.budget){toast('Out of dominos');act=null;return}
    if(!blockedAt(p.x,p.z,0,'n',0,null)){const d=addDom(p.x,p.z,0,'n',0,a.gid);a.firstDom=d;a.last=d;a.pen={x:p.x,z:p.z};dirty=true}
  }
  act=a;
}
function drawTo(p){
  const a=act;if(!a.pen)return;
  let guard=0;
  while(guard++<60){
    const dx=p.x-a.pen.x,dz=p.z-a.pen.z,dist=Math.hypot(dx,dz);
    if(dist<S.gap)break;
    let h=Math.atan2(dx,dz);
    if(a.hd!=null){const df=wrap(h-a.hd);if(Math.abs(df)>.9)h=a.hd+Math.sign(df)*.9}
    const nx=a.pen.x+Math.sin(h)*S.gap,nz=a.pen.z+Math.cos(h)*S.gap;
    if(userCount()>=L.budget){if(!a.full){toast('Out of dominos');a.full=true}break}
    const ign=a.last?new Set([a.last]):null;
    if(blockedAt(nx,nz,h,'n',0,ign))break;
    if(a.last&&a.hd==null)a.last.r=h;
    const d=addDom(nx,nz,h,'n',0,a.gid);if(!a.firstDom)a.firstDom=d;
    a.pen={x:nx,z:nz};a.hd=h;a.last=d;dirty=true;
  }
}
function eraseAt(p){
  const act0=act;let removed=false;
  const rm=new Set();
  for(const d of L.d)if(!d.lock&&Math.hypot(d.x-p.x,d.z-p.z)<.6)rm.add(d.id);
  if(rm.size){L.d=L.d.filter(d=>!rm.has(d.id));removed=true}
  else{
    for(let i=L.p.length-1;i>=0;i--){const o=L.p[i];if(inRect(p.x,p.z,o,.1)){
      const gone=L.p.splice(i,1)[0];
      L.d=L.d.filter(d=>{if(d.lock)return true;const on=(d.y||0)>0&&inRect(d.x,d.z,gone,.1);if(on)rm.add(d.id);return !on});removed=true;break}}
  }
  if(removed){
    if(!L.d.find(d=>d.id===L.start))L.start=L.daily?null:(L.d[0]?L.d[0].id:null);
    if(act0)act0.did=true;dirty=true;updHud();
  }
}

/* ------------------------------ persistence ------------------------------ */
let saveT=0;
function saveFree(){
  if(L.daily||demo)return;clearTimeout(saveT);
  saveT=setTimeout(()=>LS.set('free',{d:L.d.map(d=>({id:d.id,x:+d.x.toFixed(3),z:+d.z.toFixed(3),r:+d.r.toFixed(4),ty:d.ty,y:d.y,c:d.c,g:d.g})),p:L.p,g:L.g,start:L.start,uid:L.uid,n:L.n}),400);
}
function loadFree(){
  const o=LS.get('free',null);L=newLayout();
  if(o){L.d=o.d||[];L.p=o.p||[];L.g=o.g||{};L.start=o.start;L.uid=o.uid||1;L.n=o.n||0}
}

/* ------------------------------ daily course ------------------------------ */
function makeDaily(key){
  const seed=[...key].reduce((a,c)=>(a*31+c.charCodeAt(0))>>>0,7);const R=rng(seed);
  const o=newLayout();o.fw=26;o.fd=40;o.daily={key};o.budget=170;
  o.kit={snake:3,fork:3,fan:2,stairs:2,jump:2,spiral:1,block:1};
  const sx=(R()-.5)*8;
  const d=addDomTo(o,sx,13,Math.PI,'n',0,'start',true);o.start=d.id;
  const fixedRects=[],free=(x,z,pad)=>fixedRects.every(r=>Math.abs(x-r.x)>r.w/2+pad||Math.abs(z-r.z)>r.d/2+pad);
  fixedRects.push({x:sx,z:13,w:3,d:3});
  // pools (no-go water)
  for(let i=0;i<2;i++){for(let t=0;t<30;t++){const w=4+R()*4,dd=2.5+R()*2,x=(R()-.5)*(o.fw-w-4),z=-10+R()*18;
    if(free(x,z,Math.max(w,dd)/2+.8)){fixedRects.push({x,z,w,d:dd});o.deco.push({k:'pool',x,z,w,d:dd,nogo:true,r:0});break}}}
  // obstacles
  const nO=5+Math.floor(R()*3);
  for(let i=0;i<nO;i++){for(let t=0;t<40;t++){const w=1.4+R()*1.6,dd=1.4+R()*1.6,x=(R()-.5)*(o.fw-4),z=-14+R()*24;
    if(free(x,z,Math.max(w,dd)/2+1.3)){fixedRects.push({x,z,w,d:dd});o.f.push({x,z,r:(R()-.5)*.6,w,d:dd,h:1.4});break}}}
  // targets
  const tz=[8,2,-4,-10];
  tz.forEach((z0,i)=>{for(let t=0;t<60;t++){const x=(R()-.5)*(o.fw-6),z=z0+(R()-.5)*3;
    if(free(x,z,2.2)){fixedRects.push({x,z,w:1.6,d:1.6});o.targets.push({x,z,r:1.0,pts:250});break}}});
  for(let t=0;t<80;t++){const x=(R()-.5)*(o.fw-8),z=-16-R()*1.5;if(free(x,z,2.4)){o.targets.push({x,z,r:1.5,pts:1000,big:true});break}}
  return o;
}
function addDomTo(o,x,z,r,ty,y,gid,lock){const d={id:o.uid++,x,z,r,ty,y:y||0,c:o.n++,g:gid};if(lock)d.lock=1;o.d.push(d);return d}

/* ------------------------------ flow: menu / build ------------------------------ */
function startKind(k){
  kind=k;demo=false;stopPhysics();
  if(k==='daily'){L=makeDaily(dayKey())}else loadFree();
  undoStack=[];setFloor(L.fw,L.fd);fitBuild();
  document.querySelector('[data-tool=start]').classList.toggle('hide',!!L.daily);
  tool='draw';stamp.id='straight';stamp.rot=Math.PI;stamp.mirror=false;
  L.targets.forEach(t=>{t.hit=false;if(t._m){fxGroup.remove(t._m);t._m=null}});
  clearFx();
  dirty=true;refresh();setMode('build');camMode='chase';
  updHud();
  if(!S.seenHelp){S.seenHelp=true;saveS();showHelp()}
}
function clearFx(){while(fxGroup.children.length)fxGroup.remove(fxGroup.children[0])}
function goMenu(){
  closeModal();stopPhysics();undoStack=[];startDemo();setMode('menu');menuInfo();
}
function menuInfo(){
  const nxt=[...MODS,...SKINS,...FLOORS].filter(i=>i.at>S.pts).sort((a,b)=>a.at-b.at)[0];
  const prev=nxt?Math.max(0,...[...MODS,...SKINS,...FLOORS].filter(i=>i.at<=S.pts).map(i=>i.at)):0;
  $('pts').innerHTML=`${fmt(S.pts)} lifetime points`+(nxt?` · next unlock <b style="color:#ffb347">${nxt.name}</b> at ${fmt(nxt.at)}`:' · everything unlocked!')+(S.bestChain?`<br>Best chain ${S.bestChain} · Best freestyle ${fmt(S.bestFree)}`:'');
  $('ptsBar').style.width=nxt?clamp((S.pts-prev)/(nxt.at-prev)*100,2,100)+'%':'100%';
  const dk=dayKey(),dd=S.daily[dk];
  $('dailySub').textContent=dd?`Today's best ${fmt(dd.best)}`+(S.streak>1?` · ${S.streak}-day streak`:''):'New course every day'+(S.streak>0?` · ${S.streak}-day streak`:'');
}

/* ------------------------------ physics / play ------------------------------ */
let world=null,bodies=[],P=null,acc=0,demoTimer=0,rapierReady=false;
function buildWorld(){
  const R=RAPIER;if(world){try{world.free()}catch(e){}}
  world=new R.World({x:0,y:-GRAV,z:0});world.timestep=HSTEP;
  world.integrationParameters.numSolverIterations=qn('it',8);
  const fdesc=(o,y)=>{const b=world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(o.x,y,o.z).setRotation({x:0,y:Math.sin((o.r||0)/2),z:0,w:Math.cos((o.r||0)/2)}));return b};
  const fl=fdesc({x:0,z:0,r:0},-.5);world.createCollider(R.ColliderDesc.cuboid(200,.5,200).setFriction(qn('ff',.6)),fl);
  const addBox=o=>{const b=fdesc(o,o.h/2);world.createCollider(R.ColliderDesc.cuboid(o.w/2,o.h/2,o.d/2).setFriction(.5),b)};
  L.p.forEach(addBox);L.f.forEach(addBox);
  bodies=L.d.map(d=>{
    const t=TY[d.ty],h=Math.sin(d.r/2),w=Math.cos(d.r/2);
    const b=world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(d.x,(d.y||0)+t.h/2+.003,d.z).setRotation({x:0,y:h,z:0,w}).setLinearDamping(.01).setAngularDamping(.01).setCanSleep(true));
    world.createCollider(R.ColliderDesc.cuboid(t.w/2,t.h/2,t.t/2).setMass(t.m).setFriction(qn('fr',.3)).setRestitution(qn('re',0)),b);
    b.sleep();d._top=false;d._tt=-9;return b;
  });
}
function stopPhysics(){if(world){try{world.free()}catch(e){}}world=null;bodies=[];P=null}
function pushStart(){
  let i=L.d.findIndex(d=>d.id===L.start);if(i<0)i=0;const d=L.d[i],b=bodies[i];if(!b)return;
  const f={x:Math.sin(d.r),z:Math.cos(d.r)},k=qn('push',2.6);
  b.wakeUp();b.setAngvel({x:f.z*k,y:0,z:-f.x*k},true);b.setLinvel({x:f.x*k*.5,y:0,z:f.z*k*.5},true);
}
function startPlay(isDemo){
  if(!L.d.length){toast('Place some dominos first');return}
  demo=!!isDemo;refresh();buildWorld();acc=0;
  P={t:0,score:0,streak:0,best:0,last:-9,top:0,bonus:0,tHit:0,idle:0,started:false,over:false,after:0,mult:1,moveT:0};
  L.targets.forEach(t=>{t.hit=false});
  chase.init=false;arrow.visible=false;cursor.visible=false;ghostClear();
  timeScale=1;$('bSlow').textContent='1×';camMode='chase';$('bCam').textContent='Chase';
  $('score').textContent='0';$('chain').textContent='';$('res').classList.add('hide');$('pBot').classList.remove('hide');
  if(!demo){setMode('play');if(kind==='free'||L.daily)S.runs++}
  pushStart();
  if(!demo)$('hudPlay').classList.remove('hide');
}
function upY(q){return 1-2*(q.x*q.x+q.z*q.z)}
function stepSim(dt){
  if(!world)return;
  acc+=dt*timeScale;let n=0;
  while(acc>=HSTEP&&n<10){world.step();acc-=HSTEP;P.t+=HSTEP;n++}
  if(acc>HSTEP*3)acc=0;
  let moving=false;
  for(let i=0;i<bodies.length;i++){
    const b=bodies[i],d=L.d[i];
    if(b.isSleeping())continue;
    const lv=b.linvel(),av=b.angvel();
    if(lv.x*lv.x+lv.y*lv.y+lv.z*lv.z>.04||av.x*av.x+av.y*av.y+av.z*av.z>.5)moving=true;
    if(!d._top&&upY(b.rotation())<.72){d._top=true;d._tt=P.t;onTopple(d,i)}
  }
  if(moving)P.moveT=P.t;
  if(!P.over&&P.t>.5&&(P.t-P.moveT>1.6||P.t>150))finishRun();
}
function onTopple(d,i){
  P.top++;
  if(P.t-P.last<=.65)P.streak++;else P.streak=1;
  P.last=P.t;if(P.streak>P.best)P.best=P.streak;
  const mult=Math.min(8,1+Math.floor(P.streak/10));
  if(mult>P.mult){if(!demo)popup('×'+mult+'!',{x:d.x,z:d.z},'big')}P.mult=mult;
  const pts=TY[d.ty].pts*mult;P.score+=pts;
  click(P.streak,d.ty!=='n');
  for(const t of L.targets){if(!t.hit&&Math.hypot(t.x-d.x,t.z-d.z)<t.r+.15){t.hit=true;const b=t.pts*mult;P.score+=b;P.bonus+=b;P.tHit++;if(!demo){popup('+'+b,{x:t.x,z:t.z},'big');chime()}}}
  if(!demo){$('score').textContent=fmt(P.score);const c=$('chain');c.textContent=P.streak>=3?P.streak+' chain'+(mult>1?'  ×'+mult:''):'';c.classList.add('bump');setTimeout(()=>c.classList.remove('bump'),90)}
}
function finishRun(){
  P.over=true;
  if(demo){demoTimer=2.5;return}
  const total=L.d.length,strag=L.d.filter(d=>!d._top).length;
  const pen=strag*15;let flaw=0;
  if(strag===0&&total>=8)flaw=Math.round(P.score*.25)+100;
  const final=Math.max(0,P.score-pen+flaw);
  const oldPts=S.pts;S.pts+=final;
  if(P.best>S.bestChain)S.bestChain=P.best;
  let record=false;
  if(L.daily){const k=L.daily.key,o=S.daily[k]||{best:0,runs:0};o.runs++;if(final>o.best){o.best=final;record=true}S.daily[k]=o;
    if(S.lastDay!==k){const y=new Date();y.setUTCDate(y.getUTCDate()-1);const yk=y.getUTCFullYear()+'-'+String(y.getUTCMonth()+1).padStart(2,'0')+'-'+String(y.getUTCDate()).padStart(2,'0');S.streak=(S.lastDay===yk)?S.streak+1:1;S.lastDay=k}}
  else if(final>S.bestFree){S.bestFree=final;record=true}
  saveS();
  const unl=[...MODS,...SKINS,...FLOORS].filter(i=>i.at>oldPts&&i.at<=S.pts);
  P.result={final,strag,pen,flaw,record,unl,total};
  camMode='over';setMode('result');$('hudPlay').classList.remove('hide');$('pBot').classList.add('hide');
  if(unl.length)setTimeout(chime,300);
  showResults();
}
function showResults(){
  const r=P.result,res=$('res');
  const tg=L.targets.length?`<span>Targets</span><span>${P.tHit} / ${L.targets.length}</span>`:'';
  res.innerHTML=`<h2>${r.strag===0&&r.total>=8?'<span class="ok">✨ FLAWLESS ✨</span>':r.strag<=2?'So close!':'Run complete'}</h2>
  <div class="big">${fmt(r.final)}</div>${r.record?'<div class="ok">New best!</div>':''}
  <div class="rows"><span>Toppled</span><span>${P.top} / ${r.total}</span><span>Longest chain</span><span>${P.best}</span>${tg}
  <span>Chain score</span><span>${fmt(P.score)}</span>
  <span>Stragglers</span><span class="${r.strag?'bad':'ok'}">${r.strag?'−'+fmt(r.pen)+'  ('+r.strag+')':'0'}</span>
  ${r.flaw?`<span>Flawless bonus</span><span class="ok">+${fmt(r.flaw)}</span>`:''}</div>
  ${r.unl.length?`<p id="unlockNote">🔓 Unlocked: ${r.unl.map(u=>u.name).join(', ')}</p>`:''}
  <div class="acts"><button class="btn" id="rBuild">Edit</button><button class="btn" id="rAgain">Replay</button>${L.daily?'<button class="btn" id="rShare">Share</button>':''}<button class="btn acc" id="rMenu">Menu</button></div>`;
  res.classList.remove('hide');
  $('rBuild').onclick=backToBuild;$('rAgain').onclick=()=>{startPlay(false)};$('rMenu').onclick=()=>{backToBuild();goMenu()};
  if($('rShare'))$('rShare').onclick=shareDaily;
}
function shareDaily(){
  const r=P.result,txt=`TOPPLE Daily ${L.daily.key}\n${fmt(r.final)} pts · ${P.top}/${r.total} toppled · chain ${P.best}${r.strag===0?' · flawless ✨':''}\n${location.origin+location.pathname}`;
  if(navigator.share)navigator.share({text:txt}).catch(()=>{});
  else if(navigator.clipboard)navigator.clipboard.writeText(txt).then(()=>toast('Copied to clipboard'),()=>toast('Could not copy'));
}
function backToBuild(){
  stopPhysics();demo=false;setMode('build');$('res').classList.add('hide');
  L.d.forEach(d=>{delete d._top;delete d._tt});dirty=true;camMode='chase';
  L.targets.forEach(t=>{t.hit=false});updHud();
}

/* ------------------------------ demo (menu background) ------------------------------ */
function demoLayout(){
  L=newLayout();L.fw=40;L.fd=60;setFloor(L.fw,L.fd);
  let ax=0,az=8,a=Math.PI;
  for(const id of ['straight','curve','spiral','straight','fork','fan','block']){
    const w=xform(modDef(id,false),ax,az,a);
    stampCommit(id,w);
    const e=w.exits[0];if(!e)break;
    ax=e.x+Math.sin(e.r)*SP;az=e.z+Math.cos(e.r)*SP;a=e.r;
  }
  L.start=L.d[0].id;L.d.forEach((d,i)=>d.c=i);
}
function startDemo(){
  demoLayout();dirty=true;refresh();demo=true;startPlay(true);demoTimer=0;
}

/* ------------------------------ camera update ------------------------------ */
const tmp=new V3(),des={pos:new V3(),look:new V3()};
function updateCamera(dt){
  let rate=18;
  if(mode==='build'){const b=buildPose();des.pos.copy(b.pos);des.look.copy(b.look);rate=camSnap?100:(C.fromPlay?3.5:16)}
  else if((mode==='play'||mode==='menu')&&P){
    // wave front
    let n=0,cx=0,cz=0,sp=0;
    for(const d of L.d){if(d._top&&P.t-d._tt<.55){cx+=d.x;cz+=d.z;n++}}
    if(n){cx/=n;cz/=n;for(const d of L.d){if(d._top&&P.t-d._tt<.55)sp=Math.max(sp,Math.hypot(d.x-cx,d.z-cz))}}
    else if(!chase.init){const d=L.d.find(d=>d.id===L.start)||L.d[0];cx=d.x;cz=d.z;n=1;chase.dir.set(Math.sin(d.r),0,Math.cos(d.r))}
    if(n){
      if(!chase.init){chase.front.set(cx,0,cz);chase.init=true}
      tmp.set(cx-chase.front.x,0,cz-chase.front.z);
      if(tmp.length()>.04){tmp.normalize();chase.dir.lerp(tmp,1-Math.exp(-dt*3)).normalize()}
      chase.front.lerp(new V3(cx,0,cz),1-Math.exp(-dt*7));chase.spread+=(Math.min(sp,9)-chase.spread)*(1-Math.exp(-dt*2));
    }
    if(camMode==='over')overPose();
    else{
      const back=4.4+chase.spread*1.1,up=3.1+chase.spread*.7;
      des.pos.set(chase.front.x-chase.dir.x*back,up,chase.front.z-chase.dir.z*back);
      des.look.set(chase.front.x+chase.dir.x*.9,.25,chase.front.z+chase.dir.z*.9);
    }
    rate=camMode==='over'?2.2:3.2;
  }
  else if(mode==='result'){overPose();rate=1.8}
  const k=1-Math.exp(-rate*dt);
  C.pos.lerp(des.pos,k);C.look.lerp(des.look,k);
  camera.position.copy(C.pos);camera.lookAt(C.look);
}
let camSnap=true;
function overPose(){
  let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;
  for(const d of L.d){x0=Math.min(x0,d.x);x1=Math.max(x1,d.x);z0=Math.min(z0,d.z);z1=Math.max(z1,d.z)}
  const cx=(x0+x1)/2,cz=(z0+z1)/2,R=Math.max(x1-x0,z1-z0)/2+3;
  const asp=innerWidth/innerHeight,dist=Math.max(11,R*(asp<1?2.0:1.5));
  des.pos.set(cx,dist*.88,cz+dist*.55);des.look.set(cx,0,cz);
}

/* ------------------------------ main loop ------------------------------ */
let last=performance.now(),tAbs=0;
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min(.05,(now-last)/1000);last=now;tAbs+=dt;
  if(world&&P){
    stepSim(dt);
    for(let i=0;i<bodies.length;i++){
      const b=bodies[i],d=L.d[i],k=d.ty;
      if(b.isSleeping()&&!P.over)continue;
      const tr=b.translation(),ro=b.rotation();
      pos.set(tr.x,tr.y,tr.z);quat.set(ro.x,ro.y,ro.z,ro.w);
      mat4.compose(pos,quat,one);inst[k].setMatrixAt(d._i,mat4);
    }
    for(const k in TY)inst[k].instanceMatrix.needsUpdate=true;
    if(mode==='result'){ // straggler glow
      const pulse=.5+.5*Math.sin(tAbs*7);
      for(let i=0;i<L.d.length;i++){const d=L.d[i];if(!d._top){_c.setRGB(1,.05+.75*pulse,.05+.75*pulse);inst[d.ty].setColorAt(d._i,_c)}}
      for(const k in TY)if(inst[k].instanceColor)inst[k].instanceColor.needsUpdate=true;
    }
    if(demo&&P.over){demoTimer-=dt;if(demoTimer<=0){L.d.forEach((d,i)=>{});dirty=true;refresh();startPlay(true)}}
  }else if(dirty)refresh();
  if(mode==='build'){
    if(dirty)refresh();
    camSnap=false;
    const sd=L.d.find(d=>d.id===L.start);
    if(sd&&tool!=='erase'){arrow.visible=true;arrow.position.set(sd.x,(sd.y||0)+TY[sd.ty].h+.3+Math.sin(tAbs*4)*.06,sd.z);arrow.rotation.y=sd.r}else arrow.visible=false;
    if(L.targets.length)for(const t of L.targets){if(t._ring){const s=1+Math.sin(tAbs*3)*.04;t._m.scale.set(s,1,s)}}
  }else if(mode==='play'||mode==='result'){
    for(const t of L.targets){if(t._ring){t._ring.material.color.setHex(t.hit?0x6bf2b0:0xffd34d);t._disc.material.color.setHex(t.hit?0x6bf2b0:0xffd34d);t._disc.material.opacity=t.hit?.5:.22}}
  }
  if(mode==='menu'&&L.targets.length)L.targets.length=0;
  updateCamera(dt);
  renderer.render(scene,camera);
}

/* ------------------------------ modal screens ------------------------------ */
function openModal(html){$('modalCard').innerHTML=html;$('modal').classList.remove('hide')}
function closeModal(){$('modal').classList.add('hide')}
$('modal').addEventListener('pointerdown',e=>{if(e.target===$('modal'))closeModal()});
function showHelp(){
  openModal(`<h3>How to play</h3><ul>
  <li><b>Draw</b>: drag a finger to lay a line of dominos. Start near a line's end to keep going.</li>
  <li><b>Stamp</b>: drag a ready-made piece onto the table. It snaps to open ends. ⟳ turns it, ⇋ flips it.</li>
  <li><b>Pinch</b> or two-finger drag to zoom and pan.</li>
  <li>Tap <b>PLAY</b>. The camera dives in and follows the wave.</li>
  <li><b>Chain score</b>: every domino in a row scores more. Keep the chain unbroken for ×2, ×3 and up.</li>
  <li><b>Stragglers</b>: any domino left standing costs you points. Topple every last one for a flawless bonus.</li>
  <li><b>Daily Build</b>: same course for everyone, a fixed kit, bonus rings to hit. One new course every day.</li>
  <li>Points you earn unlock new pieces, domino skins and tables.</li></ul>
  <div class="row"><button class="btn acc" id="mClose">Got it</button></div>`);
  $('mClose').onclick=closeModal;
}
function showUnlocks(){
  const sec=(title,arr,cur,fn)=>`<h4>${title}</h4><div class="grid">${arr.map(i=>{const ok=S.pts>=i.at;return`<div class="item ${ok?'':'lock'} ${cur===i.id?'sel':''}" data-k="${title}" data-id="${i.id}">${fn(i)}<span>${i.name}</span><small>${ok?(cur===i.id?'In use':''):'🔒 '+fmt(i.at)}</small></div>`}).join('')}</div>`;
  const sw=(i)=>{const old=S.skin;S.skin=i.id;const cs=[0,3,6,9,12].map(c=>'#'+skinColor(c).getHexString());S.skin=old;return`<div class="sw" style="background:linear-gradient(90deg,${cs.join(',')})"></div>`};
  const fl=i=>{const c={wood:'#b98a5a',felt:'#1f6b4a',blue:'#17407a',night:'#16102a'}[i.id];return`<div class="sw" style="background:${c}"></div>`};
  const md=i=>modIcon(i.id).replace('<svg','<svg style="width:40px;height:30px"');
  openModal(`<h3>Unlocks</h3><div class="muted">${fmt(S.pts)} lifetime points. Every run adds to it.</div>
  ${sec('Skins',SKINS,S.skin,sw)}${sec('Tables',FLOORS,S.floor,fl)}${sec('Pieces',MODS,null,md)}
  <div class="row"><button class="btn acc" id="mClose">Done</button></div>`);
  $('mClose').onclick=()=>{closeModal();menuInfo()};
  document.querySelectorAll('#modalCard .item').forEach(el=>el.onclick=()=>{
    const id=el.dataset.id,k=el.dataset.k;if(el.classList.contains('lock'))return;
    if(k==='Skins'){S.skin=id;saveS();dirty=true;showUnlocks()}
    if(k==='Tables'){S.floor=id;saveS();setFloor(L.fw,L.fd);showUnlocks()}
  });
}

/* ------------------------------ wiring ------------------------------ */
$('bFree').onclick=()=>{audioInit();startKind('free')};
$('bDaily').onclick=()=>{audioInit();startKind('daily')};
$('bHelp').onclick=showHelp;$('bUnlock').onclick=showUnlocks;
$('bHome').onclick=()=>{goMenu()};
$('bUndo').onclick=undo;
let clrT=0;
$('bClear').onclick=()=>{
  if(!userCount())return;
  if(!clrT){$('bClear').textContent='Sure?';clrT=setTimeout(()=>{clrT=0;$('bClear').textContent='🗑'},2000);return}
  clearTimeout(clrT);clrT=0;$('bClear').textContent='🗑';
  pushUndo();L.d=L.d.filter(d=>d.lock);L.p=[];L.g={};L.deco=L.deco.filter(d=>d.nogo);if(L.kit){L.kit=makeDaily(L.daily.key).kit}if(!L.daily)L.start=null;dirty=true;saveFree();updHud();
};
$('bSnd').onclick=()=>{S.snd=!S.snd;saveS();updHud()};
document.querySelectorAll('#tools [data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
$('bPlay').onclick=()=>{audioInit();startPlay(false)};
$('bStop').onclick=()=>{backToBuild()};
$('bCam').onclick=()=>{camMode=camMode==='chase'?'over':'chase';$('bCam').textContent=camMode==='chase'?'Chase':'Overview'};
$('bSlow').onclick=()=>{timeScale=timeScale===1?.35:1;$('bSlow').textContent=timeScale===1?'1×':'Slow'};

/* ------------------------------ test hooks ------------------------------ */
window.TOPPLE={
  get L(){return L},get P(){return P},
  chain(list,x,z,a){const out=[];let ax=x,az=z;for(const id of list){const w=xform(modDef(id,false),ax,az,a);stampCommit(id,w);const e=w.exits[0];if(!e)break;ax=e.x+Math.sin(e.r)*SP;az=e.z+Math.cos(e.r)*SP;a=e.r}L.start=L.d[0]&&L.d[0].id;dirty=true},
  play(){startPlay(false)},step(sec){let n=0;while(n<sec*60){stepSim(1/60);n++}},
  reset(){L=newLayout();undoStack=[]},stats(){return{top:L.d.filter(d=>d._top).length,total:L.d.length,P:P&&{t:P.t,score:P.score,best:P.best,over:P.over}}},
  start:startKind,scene,inst,renderer,bodies:()=>bodies,world:()=>world,mode:()=>mode,modDef,xform,stampCheck
};

/* ------------------------------ boot ------------------------------ */
resize();
if(!FT[S.floor])S.floor='wood';
RAPIER.init().then(()=>{rapierReady=true;goMenu();requestAnimationFrame(frame);window.TOPPLE_READY=true});
})();
