(function(){
'use strict';
/* ============================== TOPPLE ============================== */
const Q=new URLSearchParams(location.search),qn=(k,d)=>Q.has(k)?+Q.get(k):d;
const SP=qn('sp',.62), GRAV=qn('g',40), HSTEP=1/qn('hz',120);
const TY={
  n:{w:.5,h:1,t:.15,m:1,cap:900,pts:10},
  T:{w:.8,h:2,t:.25,m:2.2,cap:80,pts:40},
  W:{w:2.4,h:1,t:.15,m:1.8,cap:80,pts:25},
  B:{r:.3,m:1.6,cap:40,ball:1}
};
const MAXD=560;
const V3=THREE.Vector3;
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const wrap=a=>{while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a};
const LS={get(k,d){try{const v=localStorage.getItem('topple.'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem('topple.'+k,JSON.stringify(v))}catch(e){}}};
function rng(seed){let a=seed>>>0;return function(){a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
const hashStr=s=>[...s].reduce((a,c)=>(Math.imul(a,31)+c.charCodeAt(0))>>>0,7);
const isScored=d=>d.ty!=='B'&&!d.f;

/* ------------------------------ progress ------------------------------ */
const S=Object.assign({pts:0,bestFree:0,bestChain:0,skin:'rainbow',floor:'wood',snd:true,daily:{},streak:0,lastDay:'',runs:0,gap:.62,seenHelp:false,lv:{}},LS.get('save',{}));
if(!S.lv)S.lv={};
function saveS(){LS.set('save',S)}
const MODS=[
  {id:'straight',name:'Straight',at:0},{id:'curve',name:'Curve',at:0},
  {id:'snake',name:'Snake',at:400},{id:'fork',name:'Fork',at:1000},
  {id:'ladder',name:'Ladder',at:1600},{id:'fan',name:'Fan',at:2200},
  {id:'ball',name:'Ball Run',at:2800},{id:'rocket',name:'Rocket',at:3200},
  {id:'slow',name:'Slow-mo',at:3600},{id:'hill',name:'Hill',at:4200},
  {id:'steps',name:'Steps',at:5000},{id:'jump',name:'Jump',at:6500},
  {id:'tower',name:'Tower',at:7500},{id:'spiral',name:'Spiral',at:9000},
  {id:'block',name:'Block',at:12000}
];
const BASIC={straight:1,curve:1};
const SKINS=[
  {id:'rainbow',name:'Rainbow',at:0},{id:'ivory',name:'Ivory',at:0},
  {id:'sunset',name:'Sunset',at:800},{id:'ocean',name:'Ocean',at:2000},
  {id:'candy',name:'Candy',at:5000},{id:'gold',name:'Gold & Ink',at:8000}
];
const WORLDS=[
  {id:'table',name:'Tabletop',icon:'🎲',theme:'wood',desc:'Learn the ropes.',grad:'linear-gradient(135deg,#a8743f,#5a3a22)',feat:{}},
  {id:'sand',name:'Sand Trap',icon:'🌵',theme:'sand',desc:'Dunes, cacti and bunkers you can\'t build in.',grad:'linear-gradient(135deg,#e2b66d,#9a6a32)',feat:{steps:1,hill:1}},
  {id:'candy',name:'Candy Shop',icon:'🍭',theme:'candy',desc:'Chocolate rivers. Find the bridges.',grad:'linear-gradient(135deg,#ff8fc4,#a65cff)',feat:{snake:1,fork:1}},
  {id:'disco',name:'Disco Fever',icon:'🪩',theme:'disco',desc:'Light up the dance floor for points.',grad:'linear-gradient(135deg,#ff3fd8,#3a1aa8)',feat:{fan:1,block:1}},
  {id:'haunted',name:'Haunted House',icon:'👻',theme:'haunted',desc:'Spooky halls and open graves.',grad:'linear-gradient(135deg,#3b2f5c,#0e0a18)',feat:{ladder:1,tower:1}},
  {id:'cosmic',name:'Cosmic',icon:'🪐',theme:'cosmic',desc:'Low gravity. Black holes. Big drama.',grad:'linear-gradient(135deg,#2a3a9a,#05030f)',feat:{spiral:1,slow:1}},
  {id:'lava',name:'Floor is Lava',icon:'🌋',theme:'lava',desc:'Dominos that fall in burn. Jump the rivers.',grad:'linear-gradient(135deg,#ff6a1a,#4a0a05)',feat:{jump:2,ball:1}}
];
const TABLES=[
  {id:'wood',name:'Oak Table',at:0},{id:'felt',name:'Green Felt',at:1200},
  {id:'blue',name:'Blueprint',at:3000},{id:'night',name:'Neon Night',at:7000},
  ...WORLDS.slice(1).map(w=>({id:w.theme,name:w.name,world:w.id}))
];
const lvKey=(w,l)=>WORLDS[w].id+'-'+l;
const lvStars=(w,l)=>{const o=S.lv[lvKey(w,l)];return o?o.stars:0};
const worldDone=id=>{const w=WORLDS.findIndex(x=>x.id===id);return w>=0&&lvStars(w,4)>0};
const worldOpen=w=>w===0||worldDone(WORLDS[w-1].id);
const levelOpen=(w,l)=>worldOpen(w)&&(l===0||lvStars(w,l-1)>0);
const tableOpen=t=>t.world?worldDone(t.world):S.pts>=t.at;
const totalStars=()=>Object.values(S.lv).reduce((a,o)=>a+(o.stars||0),0);
function skinColor(c,out){
  const k=S.skin,col=out||new THREE.Color();
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
const camera=new THREE.PerspectiveCamera(50,1,.1,400);
const hemi=new THREE.HemisphereLight(0xffffff,0x5a4d7a,.78);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xfff3dd,.95);
sun.position.set(-9,16,7);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.0004;sun.shadow.normalBias=.02;
const sc=sun.shadow.camera;sc.left=-22;sc.right=22;sc.top=22;sc.bottom=-22;sc.near=1;sc.far=60;
scene.add(sun);scene.add(sun.target);
const waveLight=new THREE.PointLight(0xffaa55,0,14,1.6);scene.add(waveLight);

function canvasTex(w,h,draw,srgb){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);if(srgb!==false)t.encoding=THREE.sRGBEncoding;t.anisotropy=4;return t}
const tex=canvasTex(64,128,g=>{
  g.fillStyle='#fff';g.fillRect(0,0,64,128);g.fillStyle='#2a2438';g.fillRect(6,62,52,4);
  const pip=(x,y)=>{g.beginPath();g.arc(x,y,5,0,7);g.fill()};
  [[20,18],[44,18],[32,40],[20,98],[44,98],[32,110],[20,118],[44,118]].forEach(p=>pip(p[0],p[1]));
});
const sideM=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.45});
const faceM=new THREE.MeshStandardMaterial({color:0xffffff,map:tex,roughness:.45});
const plainM=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.45});
const ballM=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.2,metalness:.65});
const geo={},inst={},ghost={};
const ghostMat=new THREE.MeshBasicMaterial({color:0x7cffb2,transparent:true,opacity:.55,depthWrite:false});
const ghostBad=new THREE.MeshBasicMaterial({color:0xff5a6e,transparent:true,opacity:.55,depthWrite:false});
for(const k in TY){
  const d=TY[k];
  geo[k]=d.ball?new THREE.SphereGeometry(d.r,20,14):new THREE.BoxGeometry(d.w,d.h,d.t);
  const mats=d.ball?ballM:k==='W'?plainM:[sideM,sideM,sideM,sideM,faceM,faceM];
  inst[k]=new THREE.InstancedMesh(geo[k],mats,d.cap);
  inst[k].instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  inst[k].setColorAt(0,new THREE.Color(1,1,1));
  inst[k].castShadow=inst[k].receiveShadow=true;inst[k].frustumCulled=false;inst[k].count=0;
  scene.add(inst[k]);
  ghost[k]=new THREE.InstancedMesh(geo[k],ghostMat,120);ghost[k].frustumCulled=false;ghost[k].count=0;ghost[k].renderOrder=5;scene.add(ghost[k]);
}
const unitBox=new THREE.BoxGeometry(1,1,1),unitCyl=new THREE.CylinderGeometry(1,1,1,24),unitCircle=new THREE.CircleGeometry(1,40);
const propGroup=new THREE.Group(),decoGroup=new THREE.Group(),ghostProps=new THREE.Group(),markGroup=new THREE.Group(),envGroup=new THREE.Group(),obstGroup=new THREE.Group();
scene.add(propGroup,decoGroup,ghostProps,markGroup,envGroup,obstGroup);
const stepMat=new THREE.MeshStandardMaterial({color:0x9a8fb4,roughness:.8});
for(let i=0;i<30;i++){const m=new THREE.Mesh(unitBox,ghostMat);m.visible=false;ghostProps.add(m)}
const ghostMarks=[];for(let i=0;i<4;i++){const m=new THREE.Mesh(unitCircle,ghostMat);m.rotation.x=-Math.PI/2;m.position.y=.05;m.visible=false;ghostMarks.push(m);scene.add(m)}
const arrow=new THREE.Group();
{const mm=new THREE.MeshBasicMaterial({color:0x6bf2b0});const cone=new THREE.Mesh(new THREE.ConeGeometry(.2,.5,16),mm);cone.rotation.x=Math.PI/2;cone.position.z=.35;
 const tail=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,.5,10),mm);tail.rotation.x=Math.PI/2;tail.position.z=-.05;arrow.add(cone,tail)}
arrow.visible=false;scene.add(arrow);
const cursor=new THREE.Mesh(new THREE.RingGeometry(.5,.62,32),new THREE.MeshBasicMaterial({color:0xff6b8a,transparent:true,opacity:.8,side:THREE.DoubleSide}));
cursor.rotation.x=-Math.PI/2;cursor.position.y=.03;cursor.visible=false;scene.add(cursor);
const qFlat=new THREE.Quaternion().setFromAxisAngle(new V3(1,0,0),Math.PI/2);

/* ------------------------------ particles ------------------------------ */
function Particles(n,additive){
  this.n=n;this.i=0;
  const g=new THREE.BufferGeometry();
  this.p=new Float32Array(n*3);this.c=new Float32Array(n*4);this.s=new Float32Array(n);
  this.v=new Float32Array(n*3);this.life=new Float32Array(n);this.max=new Float32Array(n);this.gr=new Float32Array(n);this.s0=new Float32Array(n);this.a0=new Float32Array(n);
  g.setAttribute('position',new THREE.BufferAttribute(this.p,3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('col',new THREE.BufferAttribute(this.c,4).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('size',new THREE.BufferAttribute(this.s,1).setUsage(THREE.DynamicDrawUsage));
  this.g=g;
  this.mat=new THREE.ShaderMaterial({uniforms:{uScale:{value:400}},transparent:true,depthWrite:false,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending,
    vertexShader:'attribute float size;attribute vec4 col;varying vec4 vC;uniform float uScale;void main(){vC=col;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=size*uScale/max(.1,-mv.z);gl_Position=projectionMatrix*mv;}',
    fragmentShader:'varying vec4 vC;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(vC.rgb,vC.a*smoothstep(.5,'+(additive?'.0':'.32')+',d));}'});
  this.pts=new THREE.Points(g,this.mat);this.pts.frustumCulled=false;this.pts.renderOrder=8;scene.add(this.pts);
}
Particles.prototype.spawn=function(x,y,z,vx,vy,vz,life,r,g,b,a,size,grav){
  const i=this.i;this.i=(this.i+1)%this.n;
  this.p[i*3]=x;this.p[i*3+1]=y;this.p[i*3+2]=z;this.v[i*3]=vx;this.v[i*3+1]=vy;this.v[i*3+2]=vz;
  this.life[i]=life;this.max[i]=life;this.c[i*4]=r;this.c[i*4+1]=g;this.c[i*4+2]=b;this.a0[i]=a;this.c[i*4+3]=a;this.s0[i]=size;this.s[i]=size;this.gr[i]=grav||0;
};
Particles.prototype.update=function(dt){
  const p=this.p,v=this.v;
  for(let i=0;i<this.n;i++){
    if(this.life[i]<=0){if(this.s[i]){this.s[i]=0;this.c[i*4+3]=0}continue}
    this.life[i]-=dt;const k=Math.max(0,this.life[i]/this.max[i]);
    v[i*3+1]-=this.gr[i]*dt;
    p[i*3]+=v[i*3]*dt;p[i*3+1]+=v[i*3+1]*dt;p[i*3+2]+=v[i*3+2]*dt;
    if(p[i*3+1]<.02&&this.gr[i]>0){p[i*3+1]=.02;v[i*3]*=.8;v[i*3+2]*=.8;v[i*3+1]=0}
    this.c[i*4+3]=this.a0[i]*Math.min(1,k*2.2);
  }
  this.g.attributes.position.needsUpdate=this.g.attributes.col.needsUpdate=this.g.attributes.size.needsUpdate=true;
};
const fxG=new Particles(2600,true),fxN=new Particles(2200,false);
const _col=new THREE.Color();
function burst(sys,x,y,z,n,col,spd,life,size,grav,up){
  for(let i=0;i<n;i++){
    const a=Math.random()*Math.PI*2,e=Math.random()*(up||1),s=spd*(.35+Math.random()*.65);
    const c=typeof col==='function'?col(i):col;_col.set(c);
    sys.spawn(x,y,z,Math.cos(a)*s*(1-e*.5),e*s+(up?spd*.4:0),Math.sin(a)*s*(1-e*.5),life*(.6+Math.random()*.6),_col.r,_col.g,_col.b,1,size*(.6+Math.random()*.7),grav);
  }
}
const FIRE=['#ff5e8a','#ffb347','#6bf2b0','#58b8ff','#c58bff','#fff27a'];

/* ------------------------------ themes ------------------------------ */
function noiseDots(g,n,col,a){for(let i=0;i<n;i++){g.fillStyle=col.replace('A',(Math.random()*a).toFixed(3));g.fillRect(Math.random()*512,Math.random()*512,2+Math.random()*2,2+Math.random()*2)}}
const TH={
  wood:{bg:0x2a2038,grid:'rgba(255,255,255,.07)',haz:'water',obst:['block'],dust:'#d8b48a',glow:[0xffcc88,0],ring:0xffc21f,
    floor(g){g.fillStyle='#b98a5a';g.fillRect(0,0,512,512);for(let i=0;i<4;i++){g.fillStyle=i%2?'#c4966a':'#ae7f50';g.fillRect(0,i*128,512,126);g.fillStyle='rgba(60,30,10,.35)';g.fillRect(0,i*128+126,512,2)}
      for(let i=0;i<260;i++){g.fillStyle='rgba(70,35,10,'+(Math.random()*.1)+')';g.fillRect(Math.random()*512,Math.random()*512,Math.random()*90+10,1)}}},
  felt:{bg:0x14281f,grid:'rgba(255,255,255,.1)',haz:'water',obst:['block'],dust:'#bfe8cf',glow:[0xaaffcc,0],ring:0xffc21f,floor(g){g.fillStyle='#1f6b4a';g.fillRect(0,0,512,512);noiseDots(g,3000,'rgba(255,255,255,A)',.05)}},
  blue:{bg:0x0c1a33,grid:'rgba(255,255,255,.35)',haz:'water',obst:['block'],dust:'#cfe6ff',glow:[0x88ccff,.4],ring:0xffc21f,floor(g){g.fillStyle='#17407a';g.fillRect(0,0,512,512);g.strokeStyle='rgba(255,255,255,.12)';g.lineWidth=1;for(let i=0;i<=16;i++){g.beginPath();g.moveTo(i*32,0);g.lineTo(i*32,512);g.moveTo(0,i*32);g.lineTo(512,i*32);g.stroke()}}},
  night:{bg:0x07040f,grid:'rgba(88,184,255,.5)',haz:'water',obst:['block'],dust:'#7fd0ff',glow:[0x58b8ff,1.2],ring:0x58b8ff,hemi:[0x8899ff,0x221133,.55],sun:[0xaabbff,.6],floor(g){g.fillStyle='#16102a';g.fillRect(0,0,512,512)}},
  sand:{bg:0xf1c98a,fog:[45,120],grid:'rgba(120,70,20,.12)',haz:'sand',obst:['cactus','rock'],dust:'#e8c48a',glow:[0xffd28a,0],ring:0xff7a2f,hemi:[0xfff1d0,0x8a6a3a,.85],sun:[0xffe0b0,1.15],
    floor(g){g.fillStyle='#e6c084';g.fillRect(0,0,512,512);g.lineWidth=3;
      for(let y=0;y<512;y+=16){g.strokeStyle='rgba(150,100,40,.16)';g.beginPath();for(let x=0;x<=512;x+=8){const yy=y+Math.sin(x*Math.PI*2/512*3+y*.07)*5;x?g.lineTo(x,yy):g.moveTo(x,yy)}g.stroke()}
      noiseDots(g,1500,'rgba(120,80,30,A)',.18)}},
  candy:{bg:0xffc2e0,fog:[50,130],grid:'rgba(255,255,255,.25)',haz:'choc',obst:['cane','gumdrop'],dust:'#ffffff',glow:[0xff9ad5,0],ring:0xff3fa0,hemi:[0xfff0ff,0xd080b0,.62],sun:[0xffffff,.72],
    floor(g){g.fillStyle='#f7a6cc';g.fillRect(0,0,512,512);const cs=['#ff4f9a','#ffd23f','#3fd6ff','#7cf2a0','#b07cff','#ffffff'];
      for(let i=0;i<260;i++){g.save();g.translate(Math.random()*512,Math.random()*512);g.rotate(Math.random()*7);g.fillStyle=cs[i%6];g.fillRect(-7,-2,14,4);g.restore()}}},
  disco:{bg:0x0a0418,fog:[40,110],grid:'rgba(160,90,255,.25)',haz:'laser',obst:['speaker','pillar'],dust:'#ff7ef0',glow:[0xff4fd8,1.6],ring:0x3fe8ff,hemi:[0x8866ff,0x220a33,.42],sun:[0xffccff,.38],tiles:1,
    floor(g){g.fillStyle='#120a24';g.fillRect(0,0,512,512)}},
  haunted:{bg:0x07060d,fog:[14,60],grid:'rgba(140,120,200,.08)',haz:'grave',obst:['tomb','pumpkin'],dust:'#9fffb0',glow:[0xffa040,1.7],ring:0xff8a1f,hemi:[0x6677aa,0x110811,.32],sun:[0x99aaff,.38],
    floor(g){g.fillStyle='#2a2230';g.fillRect(0,0,512,512);for(let i=0;i<4;i++){g.fillStyle=i%2?'#2f2636':'#261e2c';g.fillRect(0,i*128,512,124);g.fillStyle='#120d16';g.fillRect(0,i*128+124,512,4);
      for(let x=0;x<512;x+=170){g.fillStyle='#4a3e52';g.fillRect((x+i*60)%512,i*128+10,4,4);g.fillRect((x+i*60)%512,i*128+110,4,4)}}noiseDots(g,800,'rgba(0,0,0,A)',.3)}},
  cosmic:{bg:0x02010a,fog:[80,260],grid:'rgba(80,220,255,.35)',haz:'hole',obst:['asteroid','crystal'],dust:'#9fe8ff',glow:[0x58d8ff,1.5],ring:0x3fe8ff,hemi:[0x8899ff,0x110022,.5],sun:[0xddeeff,.9],grav:15,
    floor(g){g.fillStyle='#161a2e';g.fillRect(0,0,512,512);g.strokeStyle='#283157';g.lineWidth=4;for(let i=0;i<=4;i++){g.beginPath();g.moveTo(i*128,0);g.lineTo(i*128,512);g.moveTo(0,i*128);g.lineTo(512,i*128);g.stroke()}
      g.fillStyle='#4fe0ff';for(let x=0;x<4;x++)for(let y=0;y<4;y++){g.fillRect(x*128+8,y*128+8,5,5);g.fillRect(x*128+115,y*128+115,5,5)}}},
  lava:{bg:0x1a0503,fog:[30,100],grid:'rgba(255,120,40,.08)',haz:'lava',obst:['basalt','rock'],dust:'#ff9a4a',glow:[0xff6a1a,1.4],ring:0xffd34d,hemi:[0xff9966,0x220000,.45],sun:[0xffb080,.7],
    floor(g){g.fillStyle='#2b2020';g.fillRect(0,0,512,512);noiseDots(g,2500,'rgba(0,0,0,A)',.4);noiseDots(g,500,'rgba(255,120,60,A)',.12);
      g.strokeStyle='#ff5a1a';g.lineWidth=2;g.shadowColor='#ff8a2a';g.shadowBlur=8;for(let i=0;i<7;i++){let x=Math.random()*512,y=Math.random()*512;g.beginPath();g.moveTo(x,y);for(let k=0;k<6;k++){x+=(Math.random()-.5)*80;y+=(Math.random()-.5)*80;g.lineTo(x,y)}g.stroke()}g.shadowBlur=0}}
};
const HAZ={
  water:{name:'water',mat:()=>new THREE.MeshStandardMaterial({color:0x1b5fb0,roughness:.25,metalness:.1,transparent:true,opacity:.9})},
  sand:{name:'sand trap',mat:()=>new THREE.MeshStandardMaterial({color:0xc4924c,roughness:1,map:canvasTex(256,256,g=>{g.fillStyle='#d9a860';g.fillRect(0,0,256,256);g.strokeStyle='rgba(120,70,20,.35)';g.lineWidth=3;for(let y=6;y<256;y+=12){g.beginPath();g.moveTo(0,y);g.bezierCurveTo(80,y-6,170,y+6,256,y);g.stroke()}})})},
  choc:{name:'chocolate',mat:()=>new THREE.MeshStandardMaterial({color:0x3e1c0c,roughness:.08,metalness:.25,emissive:0x1a0802})},
  laser:{name:'laser grid',mat:()=>new THREE.MeshBasicMaterial({color:0xff2a5a,transparent:true,opacity:.55,blending:THREE.AdditiveBlending,depthWrite:false,map:canvasTex(128,128,g=>{g.fillStyle='#401020';g.fillRect(0,0,128,128);g.strokeStyle='#ff6080';g.lineWidth=3;for(let i=0;i<=128;i+=32){g.beginPath();g.moveTo(i,0);g.lineTo(i,128);g.moveTo(0,i);g.lineTo(128,i);g.stroke()}})})},
  grave:{name:'open grave',mat:()=>new THREE.MeshStandardMaterial({color:0x140e0a,roughness:1,map:canvasTex(128,128,g=>{g.fillStyle='#2a1c14';g.fillRect(0,0,128,128);for(let i=0;i<300;i++){g.fillStyle='rgba(0,0,0,'+Math.random()*.5+')';g.fillRect(Math.random()*128,Math.random()*128,3,3)}g.strokeStyle='rgba(120,255,140,.5)';g.lineWidth=6;g.strokeRect(3,3,122,122)})})},
  hole:{name:'black hole',mat:()=>new THREE.MeshBasicMaterial({color:0x000000})},
  lava:{name:'lava',burn:1,mat:()=>{const t=canvasTex(256,256,g=>{const gr=g.createLinearGradient(0,0,256,256);gr.addColorStop(0,'#ff3a00');gr.addColorStop(.5,'#ffae2a');gr.addColorStop(1,'#ff3a00');g.fillStyle=gr;g.fillRect(0,0,256,256);
      for(let i=0;i<90;i++){g.fillStyle='rgba('+(Math.random()<.5?'120,10,0':'255,240,150')+','+(Math.random()*.5)+')';g.beginPath();g.arc(Math.random()*256,Math.random()*256,4+Math.random()*16,0,7);g.fill()}});t.wrapS=t.wrapT=THREE.RepeatWrapping;return new THREE.MeshBasicMaterial({map:t})}}
};
let themeId='wood',theme=TH.wood,hazMat=null,hazMatGap=null,envTick=null,discoTiles=null,ambientAcc=0;
let floorMesh=null,groundMesh=null;const rimGroup=new THREE.Group();scene.add(rimGroup);
function floorTexture(th){
  const t=canvasTex(512,512,g=>{th.floor(g);g.strokeStyle=th.grid;g.lineWidth=3;g.strokeRect(0,0,512,512);g.lineWidth=1;g.beginPath();g.moveTo(256,0);g.lineTo(256,512);g.moveTo(0,256);g.lineTo(512,256);g.stroke()});
  t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;return t;
}
let FW=40,FD=40;
function clearGroup(g){while(g.children.length){const c=g.children[0];g.remove(c);c.traverse&&c.traverse(o=>{if(o.geometry&&o.geometry!==unitBox&&o.geometry!==unitCyl&&o.geometry!==unitCircle)o.geometry.dispose()})}}
function setTheme(id,w,d){
  themeId=TH[id]?id:'wood';theme=TH[themeId];FW=w;FD=d;
  const th=theme;
  if(floorMesh){scene.remove(floorMesh);floorMesh.material.map.dispose();floorMesh.material.dispose();floorMesh.geometry.dispose()}
  const t=floorTexture(th);t.repeat.set(w/4,d/4);
  floorMesh=new THREE.Mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshStandardMaterial({map:t,roughness:themeId==='cosmic'?.5:.85,metalness:themeId==='cosmic'?.3:0}));
  floorMesh.rotation.x=-Math.PI/2;floorMesh.receiveShadow=true;scene.add(floorMesh);
  if(!groundMesh){groundMesh=new THREE.Mesh(new THREE.PlaneGeometry(600,600),new THREE.MeshBasicMaterial({color:th.bg}));groundMesh.rotation.x=-Math.PI/2;groundMesh.position.y=-.05;scene.add(groundMesh)}
  groundMesh.material.color.setHex(th.bg);groundMesh.visible=themeId!=='cosmic';
  scene.background=new THREE.Color(th.bg);const fg=th.fog||[60,150];scene.fog=new THREE.Fog(th.bg,fg[0],fg[1]);
  const hm=th.hemi||[0xffffff,0x5a4d7a,.78],sn=th.sun||[0xfff3dd,.95];
  hemi.color.setHex(hm[0]);hemi.groundColor.setHex(hm[1]);hemi.intensity=hm[2];sun.color.setHex(sn[0]);sun.intensity=sn[1];
  waveLight.color.setHex(th.glow[0]);
  clearGroup(rimGroup);
  const rimCol={sand:0xb08048,candy:0xff7eb6,disco:0x2a1650,haunted:0x1a1420,cosmic:0x2a3360,lava:0x1a1010}[themeId]||0x2c2440;
  const rm=new THREE.MeshStandardMaterial({color:rimCol,roughness:.6,emissive:themeId==='disco'?0x5a1a9a:themeId==='cosmic'?0x0a3a5a:0,emissiveIntensity:.6});
  [[0,-d/2-.25,w+1,.5],[0,d/2+.25,w+1,.5],[-w/2-.25,0,.5,d],[w/2+.25,0,.5,d]].forEach(r=>{const m=new THREE.Mesh(unitBox,rm);m.position.set(r[0],.25,r[1]);m.scale.set(r[2],.5,r[3]);m.castShadow=m.receiveShadow=true;rimGroup.add(m)});
  const hs=Math.max(w,d)/2+4;sc.left=-hs;sc.right=hs;sc.top=hs;sc.bottom=-hs;sc.updateProjectionMatrix();
  if(hazMat){hazMat.dispose()}hazMat=HAZ[th.haz].mat();
  if(!hazMatGap)hazMatGap=HAZ.water.mat();
  buildEnv();
  fxG.life.fill(0);fxN.life.fill(0);
}
function ghostTex(){return canvasTex(128,128,g=>{g.fillStyle='rgba(230,240,255,.9)';g.beginPath();g.arc(64,52,36,Math.PI,0);g.lineTo(100,110);for(let i=0;i<4;i++){g.quadraticCurveTo(91-i*18,96,82-i*18,110)}g.lineTo(28,52);g.fill();g.fillStyle='#120a20';g.beginPath();g.ellipse(50,52,6,9,0,0,7);g.ellipse(78,52,6,9,0,0,7);g.fill();g.beginPath();g.ellipse(64,76,7,8,0,0,7);g.fill()})}
function buildEnv(){
  clearGroup(envGroup);envTick=null;discoTiles=null;
  const W=FW,D=FD,id=themeId;
  if(id==='cosmic'){
    const n=2500,p=new Float32Array(n*3);for(let i=0;i<n;i++){const u=Math.random()*2-1,a=Math.random()*Math.PI*2,r=150+Math.random()*40,s=Math.sqrt(1-u*u);p[i*3]=Math.cos(a)*s*r;p[i*3+1]=Math.abs(u)*r*.9+5;p[i*3+2]=Math.sin(a)*s*r}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));
    const stars=new THREE.Points(g,new THREE.PointsMaterial({color:0xffffff,size:1.6,sizeAttenuation:false,fog:false}));envGroup.add(stars);
    const pl=(r,c,x,y,z,ring)=>{const m=new THREE.Mesh(new THREE.SphereGeometry(r,32,20),new THREE.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:.25,roughness:.8,fog:false}));m.position.set(x,y,z);envGroup.add(m);
      if(ring){const rg=new THREE.Mesh(new THREE.RingGeometry(r*1.4,r*2.1,48),new THREE.MeshBasicMaterial({color:0xd8c8a0,side:THREE.DoubleSide,transparent:true,opacity:.55,fog:false}));rg.position.copy(m.position);rg.rotation.x=-1.2;rg.rotation.y=.3;envGroup.add(rg)}return m};
    const p1=pl(14,0xc87a4a,-70,30,-110,true),p2=pl(6,0x5a8aff,80,40,-70,false);
    envTick=(dt,t)=>{p1.rotation.y+=dt*.05;p2.rotation.y-=dt*.1;stars.rotation.y=t*.003};
  }else if(id==='disco'){
    const ball=new THREE.Mesh(new THREE.IcosahedronGeometry(1.3,2),new THREE.MeshStandardMaterial({color:0xffffff,metalness:1,roughness:.12,flatShading:true,emissive:0x332244}));
    ball.position.set(0,13,-D/2-5);envGroup.add(ball);
    const cord=new THREE.Mesh(unitCyl,new THREE.MeshBasicMaterial({color:0x333333}));cord.scale.set(.03,20,.03);cord.position.set(0,23,-D/2-5);envGroup.add(cord);
    const cols=[0xff3fd8,0x3fe8ff,0xfff23f,0x7cff6b],spots=[];
    cols.forEach((c,i)=>{const s=new THREE.SpotLight(c,2.6,90,.3,.5,1);s.position.set(0,13,-D/2-5);envGroup.add(s);envGroup.add(s.target);
      const beam=new THREE.Mesh(new THREE.CylinderGeometry(.05,2.6,1,24,1,true),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:.07,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));envGroup.add(beam);spots.push({s,beam,ph:i*Math.PI/2})});
    // light-up tiles
    const nx=Math.floor(W/2),nz=Math.floor(D/2),tm=new THREE.InstancedMesh(new THREE.PlaneGeometry(1.86,1.86),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.85}),nx*nz);
    tm.rotation.x=-Math.PI/2;tm.position.y=.012;const st=[],m4=new THREE.Matrix4();
    for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){const k=i*nz+j;m4.makeTranslation(-W/2+1+i*2,D/2-1-j*2,0);tm.setMatrixAt(k,m4);const base=new THREE.Color().setHSL(.72+((i+j)%3)*.04,.6,.1+((i*7+j*3)%5)*.012);st.push({base,lit:null,v:0});tm.setColorAt(k,base)}
    tm.frustumCulled=false;envGroup.add(tm);
    discoTiles={nx,nz,light(x,z){const i=Math.floor((x+W/2)/2),j=Math.floor((D/2-z)/2);if(i<0||j<0||i>=nx||j>=nz)return false;const o=st[i*nz+j];o.v=1;if(o.lit)return false;o.lit=new THREE.Color().setHSL(Math.random(),1,.55);return true},
      reset(){st.forEach(o=>{o.lit=null;o.v=0})},count(){return st.filter(o=>o.lit).length}};
    const tc=new THREE.Color();
    envTick=(dt,t)=>{ball.rotation.y+=dt*.6;
      spots.forEach((o,i)=>{const a=t*.5+o.ph,r=5+Math.sin(t*.7+i)*4;o.s.target.position.set(Math.cos(a)*r*W/20,0,Math.sin(a)*r*D/20);
        const dir=new V3().subVectors(o.s.target.position,o.s.position);const len=dir.length();o.beam.scale.set(1,len,1);o.beam.position.copy(o.s.position).addScaledVector(dir,.5);o.beam.quaternion.setFromUnitVectors(new V3(0,-1,0),dir.normalize())});
      const beat=.75+.25*Math.max(0,Math.sin(t*Math.PI*2*2));
      for(let k=0;k<st.length;k++){const o=st[k];if(o.lit){o.v=Math.max(.45,o.v-dt*.8);tc.copy(o.lit).multiplyScalar(o.v*beat)}else tc.copy(o.base).multiplyScalar(.8+.4*Math.sin(t*3+k));tm.setColorAt(k,tc)}
      tm.instanceColor.needsUpdate=true};
  }else if(id==='haunted'){
    const gt=ghostTex(),ghosts=[];
    for(let i=0;i<6;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:gt,transparent:true,opacity:.55,depthWrite:false}));s.scale.set(1.6,1.6,1);envGroup.add(s);ghosts.push({s,a:Math.random()*7,r:4+Math.random()*(W/2),sp:.15+Math.random()*.2,y:2+Math.random()*2})}
    const moon=new THREE.Mesh(new THREE.SphereGeometry(8,24,16),new THREE.MeshBasicMaterial({color:0xdde4ff,fog:false}));moon.position.set(-50,45,-110);envGroup.add(moon);
    envTick=(dt,t)=>{ghosts.forEach(g=>{g.a+=dt*g.sp;g.s.position.set(Math.cos(g.a)*g.r,g.y+Math.sin(t*1.5+g.a*3)*.4,Math.sin(g.a)*g.r*(D/W)*.8);g.s.material.opacity=.3+.25*Math.sin(t*.8+g.a*5)});
      hemi.intensity=.32*(Math.random()<.02?.4:1)};
  }else if(id==='candy'){
    const sw=canvasTex(256,256,g=>{g.fillStyle='#fff';g.fillRect(0,0,256,256);const cs=['#ff3f8a','#ffffff','#3fc8ff','#ffffff','#ffe23f','#ffffff'];for(let i=0;i<24;i++){g.fillStyle=cs[i%6];g.beginPath();g.moveTo(128,128);g.arc(128,128,128,i*Math.PI/12,(i+1)*Math.PI/12);g.fill()}});
    for(let i=0;i<8;i++){const a=i/8*Math.PI*2+.3,r=Math.max(W,D)/2+6+Math.random()*6,h=4+Math.random()*5;const g=new THREE.Group();
      const st=new THREE.Mesh(unitCyl,new THREE.MeshStandardMaterial({color:0xffffff}));st.scale.set(.15,h,.15);st.position.y=h/2;
      const top=new THREE.Mesh(new THREE.CylinderGeometry(1.8,1.8,.4,32),[new THREE.MeshStandardMaterial({color:0xff7eb6}),new THREE.MeshStandardMaterial({map:sw}),new THREE.MeshStandardMaterial({map:sw})]);top.rotation.x=Math.PI/2;top.position.y=h+1.6;
      g.add(st,top);g.position.set(Math.cos(a)*r,0,Math.sin(a)*r);g.lookAt(0,0,0);envGroup.add(g)}
  }else if(id==='sand'){
    for(let i=0;i<10;i++){const a=i/10*Math.PI*2,r=Math.max(W,D)/2+10+Math.random()*14;const m=new THREE.Mesh(new THREE.SphereGeometry(1,24,12,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:0xe2b670,roughness:1}));m.scale.set(8+Math.random()*8,2+Math.random()*3,6+Math.random()*6);m.position.set(Math.cos(a)*r,0,Math.sin(a)*r);envGroup.add(m)}
    const sunD=new THREE.Mesh(new THREE.SphereGeometry(9,24,16),new THREE.MeshBasicMaterial({color:0xfff2c0,fog:false}));sunD.position.set(60,50,-130);envGroup.add(sunD);
  }else if(id==='lava'){
    const pl=new THREE.PointLight(0xff5a1a,1.2,60,1.5);pl.position.set(0,4,0);envGroup.add(pl);
    envTick=(dt,t)=>{if(hazMat.map){hazMat.map.offset.x=t*.03;hazMat.map.offset.y=Math.sin(t*.3)*.05}pl.intensity=1+Math.sin(t*2.3)*.2};
  }
}
function ambient(dt){
  ambientAcc+=dt;if(ambientAcc<.05)return;const a=ambientAcc;ambientAcc=0;
  const cx=C.look.x,cz=C.look.z,R=16;
  const rnd=()=>(Math.random()-.5)*2*R;
  if(themeId==='sand'){for(let i=0;i<a*40;i++)fxN.spawn(cx+rnd(),Math.random()*1.5,cz+rnd(),2+Math.random()*2,0,.5,2.5,.9,.75,.5,.6,.06,0)}
  else if(themeId==='candy'){for(let i=0;i<a*30;i++){_col.set(FIRE[i%6]);fxN.spawn(cx+rnd(),9,cz+rnd(),(Math.random()-.5)*.3,-1.4,(Math.random()-.5)*.3,6,_col.r,_col.g,_col.b,1,.12,0)}}
  else if(themeId==='cosmic'){for(let i=0;i<a*12;i++)fxG.spawn(cx+rnd(),.3+Math.random()*4,cz+rnd(),0,.15,0,3,.5,.8,1,.7,.09,0)}
  else if(themeId==='haunted'){for(let i=0;i<a*10;i++)fxG.spawn(cx+rnd(),.15,cz+rnd(),(Math.random()-.5)*.3,.05,(Math.random()-.5)*.3,4,.2,.6,.3,.18,1.2,0)}
  else if(themeId==='disco'){for(let i=0;i<a*10;i++){_col.setHSL(Math.random(),1,.6);fxG.spawn(cx+rnd(),Math.random()*7,cz+rnd(),0,0,0,1.2,_col.r,_col.g,_col.b,1,.1,0)}}
  else if(themeId==='lava'){const lv=L.deco.filter(o=>o.burn);if(lv.length)for(let i=0;i<a*30;i++){const o=lv[Math.floor(Math.random()*lv.length)];const p=randIn(o);fxG.spawn(p[0],.1,p[1],(Math.random()-.5)*.4,1+Math.random()*1.5,(Math.random()-.5)*.4,2.2,1,.45+Math.random()*.3,.1,1,.13,-.2)}}
}
function randIn(o){if(o.rad){const a=Math.random()*7,r=Math.sqrt(Math.random())*o.rad;return[o.x+Math.cos(a)*r,o.z+Math.sin(a)*r]}
  const lx=(Math.random()-.5)*o.w,lz=(Math.random()-.5)*o.d,c=Math.cos(o.r||0),s=Math.sin(o.r||0);return[o.x+lx*c+lz*s,o.z-lx*s+lz*c]}

/* ------------------------------ layout ------------------------------ */
let L=newLayout();
function newLayout(){return{d:[],p:[],f:[],deco:[],fx:[],targets:[],g:{},start:null,uid:1,n:0,daily:null,level:null,fw:40,fd:40,budget:Infinity,kit:null,theme:'wood',grav:GRAV}}
const mat4=new THREE.Matrix4(),quat=new THREE.Quaternion(),pos=new V3(),one=new V3(1,1,1),zero=new V3(0,0,0),yAxis=new V3(0,1,0);
let dirty=true,undoStack=[];
const clean=a=>a.map(o=>{const r={};for(const k in o)if(k[0]!=='_')r[k]=o[k];return r});
function snap(){return JSON.stringify({d:clean(L.d),p:L.p,g:L.g,start:L.start,uid:L.uid,n:L.n,kit:L.kit,deco:L.deco,fx:L.fx})}
function pushUndo(s){undoStack.push(s||snap());if(undoStack.length>40)undoStack.shift();updHud()}
function restore(s){const o=JSON.parse(s);Object.assign(L,{d:o.d,p:o.p,g:o.g,start:o.start,uid:o.uid,n:o.n,kit:o.kit,deco:o.deco,fx:o.fx});dirty=true;updHud()}
function undo(){if(!undoStack.length)return;restore(undoStack.pop());saveFree()}
function userCount(){let n=0;for(const d of L.d)if(!d.lock&&isScored(d))n++;return n}
function addDom(x,z,r,ty,y,gid,lock,f){const d={id:L.uid++,x,z,r,ty,y:y||0,c:L.n++,g:gid};if(lock)d.lock=1;if(f)d.f=1;L.d.push(d);return d}
function pointsOf(x,z,r,ty,f){
  const cr=Math.cos(r),sr=Math.sin(r);let s;
  if(ty==='B')s=[[0,0,.3]];else if(f)s=[[0,-.3,.24],[0,.3,.24]];else if(ty==='W')s=[[-.9,0,.21],[0,0,.21],[.9,0,.21]];else if(ty==='T')s=[[0,0,.38]];else s=[[0,0,.21]];
  return s.map(p=>[x+p[0]*cr+p[1]*sr,z-p[0]*sr+p[1]*cr,p[2]]);
}
function inShape(px,pz,o,pad){
  if(o.rad)return Math.hypot(px-o.x,pz-o.z)<o.rad+pad;
  const dx=px-o.x,dz=pz-o.z,c=Math.cos(o.r||0),s=Math.sin(o.r||0);
  const lx=dx*c-dz*s,lz=dx*s+dz*c;
  return Math.abs(lx)<o.w/2+pad&&Math.abs(lz)<o.d/2+pad;
}
function blockedAt(x,z,r,ty,y,ign,f){
  const pts=pointsOf(x,z,r,ty,f);
  for(const q of pts){
    if(Math.abs(q[0])>L.fw/2-.4||Math.abs(q[1])>L.fd/2-.4)return true;
    for(const o of L.f)if(y<o.h-.02&&inShape(q[0],q[1],o,q[2]))return true;
    for(const o of L.deco)if(o.nogo&&inShape(q[0],q[1],o,q[2]))return true;
    for(const o of L.p)if(y<o.h-.02&&inShape(q[0],q[1],o,q[2]))return true;
    for(const o of L.fx)if(o.k==='rocket'&&Math.hypot(q[0]-o.x,q[1]-o.z)<.75+q[2])return true;
  }
  for(const e of L.d){
    if(ign&&ign.has(e))continue;
    if(Math.abs(e.x-x)>2.6||Math.abs(e.z-z)>2.6)continue;
    if(Math.abs((e.y||0)-y)>.9)continue;
    const ep=pointsOf(e.x,e.z,e.r,e.ty,e.f);
    for(const a of pts)for(const b of ep){const dx=a[0]-b[0],dz=a[1]-b[1],rr=(a[2]+b[2])*.96;if(dx*dx+dz*dz<rr*rr)return true}
  }
  return false;
}

/* ---- pieces (local frame: first domino at origin, forward = +z) ---- */
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
  ladder(){
    const t=new Tt();t.dom().straight(1);const z0=t.z+SP,it=t.it.slice(),rows=8;
    for(let k=0;k<rows;k++){const z=z0+k*SP;it.push({x:-.3,z,r:0,ty:'n',y:0},{x:.3,z,r:0,ty:'n',y:0},{x:0,z,r:Math.PI/2,ty:'n',y:1,f:1})}
    const b=new Tt();b.z=z0+rows*SP;b.dom().straight(2);it.push(...b.it);
    return{it,exits:[b.last()]};
  },
  steps(){
    const ks=[0,0,1,2,3,4,5,5,5,4,3,2,1,0,0],it=[];
    ks.forEach((k,i)=>{const z=i*SP;for(let j=0;j<k;j++)it.push({x:0,z,r:Math.PI/2,ty:'n',y:j*.15,f:1});it.push({x:0,z,r:0,ty:'n',y:k*.15})});
    return{it,exits:[{x:0,z:(ks.length-1)*SP,r:0}]};
  },
  hill(){
    const ys=[0,0,.14,.28,.42,.56,.7,.7,.7,.7,.56,.42,.28,.14,0,0];
    const it=[],pr=[];
    ys.forEach((y,i)=>{it.push({x:0,z:i*SP,r:0,ty:'n',y});if(y>0)pr.push({x:0,z:i*SP,r:0,w:1.3,d:SP,h:y})});
    return{it,pr,exits:[{x:0,z:(ys.length-1)*SP,r:0}]};
  },
  jump(){
    const t=new Tt();t.dom().straight(2);const zT=t.z+.62;
    const it=t.it.slice();it.push({x:0,z:zT,r:0,ty:'T',y:0});
    const zR=zT+1.75;const b=new Tt();b.z=zR;b.dom().straight(4);it.push(...b.it);
    return{it,deco:[{k:'gap',x:0,z:(zT+zR)/2,w:2.2,d:zR-zT-.7}],exits:[b.last()]};
  },
  ball(){
    const t=new Tt();t.dom().straight(2);const zb=t.z+.62,it=t.it.slice();
    it.push({x:0,z:zb,r:0,ty:'B',y:0});
    const L1=4.2,pr=[-.45,.45].map(x=>({x,z:zb+L1/2-.2,r:0,w:.1,d:L1,h:.16,rail:1}));
    const b=new Tt();b.z=zb+L1+.2;b.dom().straight(4);it.push(...b.it);
    return{it,pr,exits:[b.last()]};
  },
  rocket(){const t=new Tt();t.dom().straight(2);return{it:t.it,fx:[{k:'rocket',x:0,z:t.z+1.15}],exits:[]}},
  slow(){const t=new Tt();t.dom().straight(9);return{it:t.it,fx:[{k:'slow',x:0,z:SP*4.5,rad:1.1}],exits:[t.last()]}},
  tower(){
    const t=new Tt();t.dom().straight(1);const zT=t.z+.62,it=t.it.slice();it.push({x:0,z:zT,r:0,ty:'T',y:0});
    const zc=zT+1.75;
    for(let l=0;l<7;l++){const y=l*.15;if(l%2===0)[-.26,.26].forEach(o=>it.push({x:0,z:zc+o,r:Math.PI/2,ty:'n',y,f:1}));else[-.26,.26].forEach(o=>it.push({x:o,z:zc,r:0,ty:'n',y,f:1}))}
    return{it,exits:[]};
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
const modCache={};
function modDef(id,mirror){
  const key=id+(mirror?'m':'');if(modCache[key])return modCache[key];
  const b=BUILD[id]();
  const f=o=>mirror?Object.assign({},o,{x:-o.x,r:-(o.r||0)}):o;
  return modCache[key]={it:b.it.map(f),pr:(b.pr||[]).map(f),deco:(b.deco||[]).map(f),fx:(b.fx||[]).map(f),exits:b.exits.map(f)};
}
function xform(def,ax,az,a){
  const c=Math.cos(a),s=Math.sin(a),T=(x,z)=>[ax+x*c+z*s,az-x*s+z*c];
  const m=(o,extra)=>{const p=T(o.x,o.z);return Object.assign({},o,{x:p[0],z:p[1],r:(o.r||0)+a},extra)};
  return{it:def.it.map(o=>m(o)),pr:def.pr.map(o=>m(o)),deco:def.deco.map(o=>m(o)),fx:def.fx.map(o=>m(o)),exits:def.exits.map(o=>m(o))};
}
function stampCheck(w){
  const n=w.it.filter(isScored).length;
  if(n>L.budget-userCount())return'budget';
  for(const o of w.it)if(blockedAt(o.x,o.z,o.r,o.ty,o.y,null,o.f))return'blocked';
  for(const o of w.fx){if(Math.abs(o.x)>L.fw/2-1||Math.abs(o.z)>L.fd/2-1)return'blocked';for(const e of L.d)if(Math.hypot(e.x-o.x,e.z-o.z)<(o.k==='rocket'?1:.1))return'blocked'}
  for(const pr of w.pr){
    for(const e of L.d){if((e.y||0)<pr.h-.02){for(const q of pointsOf(e.x,e.z,e.r,e.ty,e.f))if(inShape(q[0],q[1],pr,q[2]))return'blocked'}}
  }
  return'';
}
function stampCommit(id,w){
  const gid='g'+L.uid++;const first=L.d.length;
  for(const o of w.it)addDom(o.x,o.z,o.r,o.ty,o.y,gid,false,o.f);
  for(const pr of w.pr)L.p.push(Object.assign({id:L.uid++,g:gid,y:0},pr));
  for(const d of w.deco)L.deco.push(Object.assign({g:gid},d));
  for(const f of w.fx)L.fx.push(Object.assign({id:L.uid++,g:gid},f));
  L.g[gid]={exits:[]};
  for(const e of w.exits){let best=null,bd=1e9;for(let i=first;i<L.d.length;i++){const d=L.d[i];if(!isScored(d))continue;const dd=(d.x-e.x)**2+(d.z-e.z)**2;if(dd<bd){bd=dd;best=d}}if(best)L.g[gid].exits.push({x:e.x,z:e.z,r:e.r,id:best.id})}
  if(L.start==null&&!L.daily&&!L.level&&L.d.length>first)L.start=L.d[first].id;
  dirty=true;return gid;
}
function endsList(){
  const out=[],alive=new Set(L.d.map(d=>d.id));
  for(const g in L.g)for(const e of L.g[g].exits)if(alive.has(e.id))out.push(e);
  const s=L.d.find(d=>d.lock);if(s)out.push({x:s.x,z:s.z,r:s.r,id:s.id});
  return out;
}
function nearestEnd(p,rad){let b=null,bd=rad*rad;for(const e of endsList()){const d=(e.x-p.x)**2+(e.z-p.z)**2;if(d<bd){bd=d;b=e}}return b}

/* ------------------------------ render sync ------------------------------ */
const _c=new THREE.Color(),_q2=new THREE.Quaternion();
function poseOf(d){
  const t=TY[d.ty];
  if(t.ball){pos.set(d.x,(d.y||0)+t.r+.002,d.z);quat.identity();return}
  quat.setFromAxisAngle(yAxis,d.r);
  if(d.f){quat.multiply(qFlat);pos.set(d.x,(d.y||0)+t.t/2,d.z)}else pos.set(d.x,(d.y||0)+t.h/2,d.z);
}
function baseColor(d,out){if(d.ty==='B')return out.setRGB(.85,.88,.95);skinColor(d.c,out);if(d.f)out.multiplyScalar(.82);return out}
const OBST={
  block(o){const m=new THREE.Mesh(unitBox,new THREE.MeshStandardMaterial({color:0x6b5a9a,roughness:.7}));m.scale.set(o.w,o.h,o.d);m.position.y=o.h/2;return m},
  cactus(o){const g=new THREE.Group(),mt=new THREE.MeshStandardMaterial({color:0x3f8a3a,roughness:.8});const r=Math.min(o.w,o.d)*.28;
    const tr=new THREE.Mesh(unitCyl,mt);tr.scale.set(r,2.2,r);tr.position.y=1.1;g.add(tr);
    [[-1,.9,.6],[1,1.3,.5]].forEach(a=>{const h=new THREE.Mesh(unitCyl,mt);h.scale.set(r*.7,r*2.4,r*.7);h.rotation.z=Math.PI/2;h.position.set(a[0]*r*1.6,a[1],0);const v=new THREE.Mesh(unitCyl,mt);v.scale.set(r*.7,a[2]+.4,r*.7);v.position.set(a[0]*r*2.6,a[1]+a[2]/2,0);g.add(h,v)});
    const cap=new THREE.Mesh(new THREE.SphereGeometry(r,16,8),mt);cap.position.y=2.2;g.add(cap);return g},
  rock(o){const m=new THREE.Mesh(new THREE.DodecahedronGeometry(.7,0),new THREE.MeshStandardMaterial({color:themeId==='lava'?0x2a1a18:0xa08060,roughness:.95,flatShading:true}));m.scale.set(o.w*.75,o.h*.8,o.d*.75);m.position.y=o.h*.38;return m},
  basalt(o){const m=new THREE.Mesh(new THREE.CylinderGeometry(.5,.62,1,6),new THREE.MeshStandardMaterial({color:0x221514,roughness:.9,flatShading:true,emissive:0x501000,emissiveIntensity:.5}));m.scale.set(o.w*.9,o.h*1.3,o.d*.9);m.position.y=o.h*.65;return m},
  asteroid(o){const m=new THREE.Mesh(new THREE.IcosahedronGeometry(.75,1),new THREE.MeshStandardMaterial({color:0x6a6a78,roughness:.95,flatShading:true}));m.scale.set(o.w*.75,o.h*.9,o.d*.75);m.position.y=o.h*.45;m.userData.spin=1;return m},
  crystal(o){const m=new THREE.Mesh(new THREE.OctahedronGeometry(.7,0),new THREE.MeshStandardMaterial({color:0x6ff0ff,emissive:0x1aa0c0,emissiveIntensity:.8,roughness:.1,metalness:.3,transparent:true,opacity:.9}));m.scale.set(o.w*.6,o.h*1.3,o.d*.6);m.position.y=o.h*.9;m.userData.spin=1;return m},
  speaker(o){const g=new THREE.Group();const b=new THREE.Mesh(unitBox,new THREE.MeshStandardMaterial({color:0x151018,roughness:.6}));b.scale.set(o.w,o.h*1.2,o.d);b.position.y=o.h*.6;g.add(b);
    const cm=new THREE.MeshStandardMaterial({color:0x332a3a,emissive:0x9a2aff,emissiveIntensity:.35});[.35,.8].forEach(y=>{const c=new THREE.Mesh(unitCyl,cm);c.scale.set(Math.min(o.w,o.h)*.32,.05,Math.min(o.w,o.h)*.32);c.rotation.x=Math.PI/2;c.position.set(0,o.h*1.2*y,o.d/2+.02);g.add(c)});return g},
  pillar(o){const m=new THREE.Mesh(unitCyl,new THREE.MeshStandardMaterial({color:0xff4fd8,emissive:0xff2ad0,emissiveIntensity:.9}));m.scale.set(Math.min(o.w,o.d)*.4,o.h*1.6,Math.min(o.w,o.d)*.4);m.position.y=o.h*.8;return m},
  cane(o){const g=new THREE.Group(),t=canvasTex(64,256,c=>{c.fillStyle='#fff';c.fillRect(0,0,64,256);c.fillStyle='#ff2a5a';for(let y=-64;y<256;y+=40){c.beginPath();c.moveTo(0,y);c.lineTo(64,y+32);c.lineTo(64,y+52);c.lineTo(0,y+20);c.fill()}});t.wrapS=t.wrapT=THREE.RepeatWrapping;
    const mt=new THREE.MeshStandardMaterial({map:t,roughness:.3});const r=.22;const s=new THREE.Mesh(unitCyl,mt);s.scale.set(r,2.4,r);s.position.y=1.2;g.add(s);
    const hk=new THREE.Mesh(new THREE.TorusGeometry(.45,r,12,24,Math.PI),mt);hk.position.set(.45,2.4,0);g.add(hk);return g},
  gumdrop(o){const cs=[0xff4f9a,0x3fd6ff,0x7cf2a0,0xffd23f,0xb07cff];const m=new THREE.Mesh(new THREE.SphereGeometry(.6,24,12,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:cs[Math.floor(Math.abs(o.x*7+o.z*3))%5],roughness:.35,transparent:true,opacity:.92}));m.scale.set(o.w*.85,o.h*1.1,o.d*.85);return m},
  tomb(o){const g=new THREE.Group(),mt=new THREE.MeshStandardMaterial({color:0x5c5866,roughness:.95});const b=new THREE.Mesh(unitBox,mt);b.scale.set(o.w*.8,o.h*.9,o.d*.35);b.position.y=o.h*.45;
    const t=new THREE.Mesh(unitCyl,mt);t.scale.set(o.w*.4,o.d*.35,o.w*.4);t.rotation.x=Math.PI/2;t.position.y=o.h*.9;g.add(b,t);
    const base=new THREE.Mesh(unitBox,mt);base.scale.set(o.w,.15,o.d*.7);base.position.y=.07;g.add(base);return g},
  pumpkin(o){const g=new THREE.Group();const m=new THREE.Mesh(new THREE.SphereGeometry(.6,20,14),new THREE.MeshStandardMaterial({color:0xff7a1a,roughness:.6,emissive:0x401000,emissiveIntensity:.6}));m.scale.set(o.w*.8,o.h*.6,o.d*.8);m.position.y=o.h*.36;
    const st=new THREE.Mesh(unitCyl,new THREE.MeshStandardMaterial({color:0x3a5a1a}));st.scale.set(.08,.3,.08);st.position.y=o.h*.75;const pl=new THREE.PointLight(0xff8a2a,.6,4);pl.position.y=o.h*.5;g.add(m,st,pl);return g}
};
let fxMeshes=[],targetMeshes=[];
function rocketMesh(goal){
  const g=new THREE.Group(),pad=new THREE.Mesh(new THREE.CylinderGeometry(.9,1,.14,32),new THREE.MeshStandardMaterial({color:0x3a3a48,metalness:.5,roughness:.4}));pad.position.y=.07;
  const glow=new THREE.Mesh(new THREE.RingGeometry(1.05,1.3,40),new THREE.MeshBasicMaterial({color:goal?0x6bf2b0:0xffb347,transparent:true,opacity:.85,side:THREE.DoubleSide}));glow.rotation.x=-Math.PI/2;glow.position.y=.03;
  const r=new THREE.Group(),wm=new THREE.MeshStandardMaterial({color:0xf2f2f8,metalness:.3,roughness:.35}),rm=new THREE.MeshStandardMaterial({color:0xff3a5a,roughness:.4});
  const body=new THREE.Mesh(new THREE.CylinderGeometry(.24,.28,1.2,20),wm);body.position.y=.6;const nose=new THREE.Mesh(new THREE.ConeGeometry(.24,.5,20),rm);nose.position.y=1.45;
  const win=new THREE.Mesh(new THREE.CircleGeometry(.1,16),new THREE.MeshStandardMaterial({color:0x58b8ff,emissive:0x2266aa}));win.position.set(0,.85,.245);
  r.add(body,nose,win);for(let i=0;i<3;i++){const f=new THREE.Mesh(unitBox,rm);f.scale.set(.04,.4,.3);const a=i*Math.PI*2/3;f.position.set(Math.sin(a)*.3,.22,Math.cos(a)*.3);f.rotation.y=a;r.add(f)}
  r.position.y=.14;r.traverse(o=>{if(o.isMesh)o.castShadow=true});g.add(pad,glow,r);g.userData={rocket:r,glow};return g;
}
function slowMesh(o){
  const t=canvasTex(256,256,g=>{g.fillStyle='rgba(60,140,255,.35)';g.beginPath();g.arc(128,128,124,0,7);g.fill();g.strokeStyle='#9fd0ff';g.lineWidth=6;g.stroke();
    for(let i=0;i<12;i++){const a=i*Math.PI/6;g.beginPath();g.moveTo(128+Math.cos(a)*100,128+Math.sin(a)*100);g.lineTo(128+Math.cos(a)*118,128+Math.sin(a)*118);g.stroke()}
    g.fillStyle='#e8f4ff';g.font='bold 40px system-ui';g.textAlign='center';g.fillText('SLOW',128,142)});
  const m=new THREE.Mesh(unitCircle,new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false}));m.scale.set(o.rad||1.1,o.rad||1.1,1);m.rotation.x=-Math.PI/2;m.position.y=.02;return m;
}
function refresh(){
  const cnt={n:0,T:0,W:0,B:0};
  for(const d of L.d){
    const k=d.ty,i=cnt[k]++;d._i=i;poseOf(d);mat4.compose(pos,quat,one);inst[k].setMatrixAt(i,mat4);
    d._col=baseColor(d,d._col||new THREE.Color());inst[k].setColorAt(i,d._col);
  }
  for(const k in TY){inst[k].count=cnt[k];inst[k].instanceMatrix.needsUpdate=true;if(inst[k].instanceColor)inst[k].instanceColor.needsUpdate=true}
  clearGroup(propGroup);
  L.p.forEach(o=>{const e=new THREE.Mesh(unitBox,o.rail?new THREE.MeshStandardMaterial({color:0xc0c4d0,metalness:.6,roughness:.3}):stepMat);e.position.set(o.x,o.h/2,o.z);e.rotation.y=o.r||0;e.scale.set(o.w,o.h,o.d);e.castShadow=e.receiveShadow=true;propGroup.add(e)});
  clearGroup(obstGroup);
  L.f.forEach(o=>{const m=(OBST[o.kind]||OBST.block)(o);m.position.x=o.x;m.position.z=o.z;m.rotation.y=o.r||0;m.traverse(c=>{if(c.isMesh){c.castShadow=c.receiveShadow=true}});obstGroup.add(m)});
  clearGroup(decoGroup);
  L.deco.forEach(o=>{
    const mt=o.k==='gap'?(theme.haz==='lava'?hazMat:hazMatGap):hazMat;
    let e;if(o.rad){e=new THREE.Mesh(unitCircle,mt);e.scale.set(o.rad,o.rad,1);e.rotation.x=-Math.PI/2;e.position.set(o.x,.016,o.z);
      if(theme.haz==='hole'&&o.k!=='gap'){const ring=new THREE.Mesh(new THREE.RingGeometry(o.rad,o.rad*1.45,48),new THREE.MeshBasicMaterial({color:0xa050ff,transparent:true,opacity:.55,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.set(o.x,.02,o.z);ring.userData.spin=1;decoGroup.add(ring)}}
    else{e=new THREE.Mesh(unitBox,mt);e.position.set(o.x,.015,o.z);e.rotation.y=o.r||0;e.scale.set(o.w,.03,o.d)}
    e.receiveShadow=true;decoGroup.add(e)});
  clearGroup(markGroup);targetMeshes=[];fxMeshes=[];
  L.targets.forEach(t=>{const g=new THREE.Group(),col=theme.ring;
    const ring=new THREE.Mesh(new THREE.RingGeometry(t.r-.22,t.r,40),new THREE.MeshBasicMaterial({color:col,side:THREE.DoubleSide,transparent:true,opacity:.95}));
    const disc=new THREE.Mesh(new THREE.CircleGeometry(t.r-.22,40),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.3,side:THREE.DoubleSide}));
    ring.rotation.x=disc.rotation.x=-Math.PI/2;ring.position.y=.04;disc.position.y=.035;g.add(ring,disc);g.position.set(t.x,0,t.z);g.userData={ring,disc};markGroup.add(g);targetMeshes.push(g)});
  L.fx.forEach(o=>{const m=o.k==='rocket'?rocketMesh(o.goal):slowMesh(o);m.position.x=o.x;m.position.z=o.z;markGroup.add(m);fxMeshes.push(m)});
  dirty=false;
}

/* ------------------------------ camera ------------------------------ */
const camState={tx:0,tz:0,dist:24,pitch:1.0};
const C={pos:new V3(0,20,14),look:new V3(0,0,0)};
const chase={front:new V3(),dir:new V3(0,0,-1),ext:0,init:false};
let camMode='chase',timeScale=1,shake=0;
function buildPose(){const p=camState.pitch,d=camState.dist;return{pos:new V3(camState.tx,d*Math.sin(p),camState.tz+d*Math.cos(p)),look:new V3(camState.tx,0,camState.tz)}}
function fitBuild(){
  camState.tx=0;camState.tz=0;
  if(!(L.daily||L.level)){camState.dist=innerWidth<700?24:22;return}
  // fit the whole course between the top bar and the build tools
  const W=innerWidth,H=innerHeight,top=Math.min(H*.3,($('top').getBoundingClientRect().bottom||50)+20),bot=Math.max(H*.55,($('bottom').getBoundingClientRect().top||H-180)-6);
  const cam=camera.clone(),hw=L.fw/2+.3,hz=L.fd/2+.3,pts=[[-hw,-hz],[hw,-hz],[-hw,hz],[hw,hz]],v=new V3();
  for(let d=14;d<90;d+=1){const fit=[];for(let tz=-4;tz<=14;tz+=.25){
    cam.position.set(0,d*Math.sin(camState.pitch),tz+d*Math.cos(camState.pitch));cam.lookAt(0,0,tz);cam.updateMatrixWorld();
    let ok=true;for(const p of pts){v.set(p[0],0,p[1]).project(cam);const x=(v.x+1)/2*W,y=(1-v.y)/2*H;if(x<6||x>W-6||y<top||y>bot){ok=false;break}}
    if(ok)fit.push(tz)}
    if(fit.length){camState.dist=d;camState.tz=fit[Math.floor(fit.length/2)];return}
  }
  camState.dist=60;camState.tz=4;
}
function resize(){
  const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=w/h<.8?58:48;camera.updateProjectionMatrix();
  const s=h*renderer.getPixelRatio()/(2*Math.tan(camera.fov*Math.PI/360));fxG.mat.uniforms.uScale.value=s;fxN.mat.uniforms.uScale.value=s;
}
addEventListener('resize',resize);addEventListener('orientationchange',()=>setTimeout(resize,200));
const ray=new THREE.Raycaster(),ndc=new THREE.Vector2(),gplane=new THREE.Plane(new V3(0,1,0),0),hitv=new V3();
function toWorld(cx,cy){
  const r=cv.getBoundingClientRect();ndc.set((cx-r.left)/r.width*2-1,-((cy-r.top)/r.height*2-1));
  ray.setFromCamera(ndc,camera);return ray.ray.intersectPlane(gplane,hitv)?{x:hitv.x,z:hitv.z}:null;
}

/* ------------------------------ audio ------------------------------ */
let AC=null,lastClick=0,noiseBuf=null;
function audioInit(){if(AC)return;try{AC=new(window.AudioContext||window.webkitAudioContext)();const n=AC.sampleRate;noiseBuf=AC.createBuffer(1,n,n);const d=noiseBuf.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1}catch(e){}if(AC&&AC.state==='suspended')AC.resume()}
const SCALE=[0,2,4,7,9];
function ok(){return S.snd&&AC&&!demo}
function click(streak,big){
  if(!ok())return;const t=AC.currentTime;if(t-lastClick<.03)return;lastClick=t;
  const i=Math.min(streak,34),n=SCALE[i%5]+12*Math.floor(i/5%3);
  const base=themeId==='haunted'?165:themeId==='cosmic'?440:330;
  const f=(big?196:base)*Math.pow(2,n/12);
  const o=AC.createOscillator(),g=AC.createGain();o.type=big?'sine':themeId==='disco'?'square':'triangle';o.frequency.value=f;
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(big?.16:themeId==='disco'?.035:.07,t+.004);g.gain.exponentialRampToValueAtTime(.0001,t+(big?.35:.11));
  o.connect(g);g.connect(AC.destination);o.start(t);o.stop(t+(big?.4:.13));
}
function noise(dur,f0,f1,vol,type){if(!ok())return;const t=AC.currentTime,s=AC.createBufferSource(),fl=AC.createBiquadFilter(),g=AC.createGain();s.buffer=noiseBuf;fl.type=type||'bandpass';fl.frequency.setValueAtTime(f0,t);fl.frequency.exponentialRampToValueAtTime(f1,t+dur);
  g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);s.connect(fl);fl.connect(g);g.connect(AC.destination);s.start(t);s.stop(t+dur)}
function tone(f0,f1,dur,vol,type){if(!ok())return;const t=AC.currentTime,o=AC.createOscillator(),g=AC.createGain();o.type=type||'sine';o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(f1,t+dur);g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(AC.destination);o.start(t);o.stop(t+dur)}
function chime(){if(!ok())return;[0,4,7,12].forEach((n,i)=>{const t=AC.currentTime+i*.09,o=AC.createOscillator(),g=AC.createGain();o.type='sine';o.frequency.value=392*Math.pow(2,n/12);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.14,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+.5);o.connect(g);g.connect(AC.destination);o.start(t);o.stop(t+.55)})}

/* ------------------------------ UI helpers ------------------------------ */
let toastT=0;
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),1800)}
const fmt=n=>Math.round(n).toLocaleString();
function popup(txt,p,cls){
  const v=new V3(p.x,.8,p.z).project(camera);if(v.z>1)return;
  const e=document.createElement('div');e.className='pop '+(cls||'');e.textContent=txt;
  e.style.left=((v.x+1)/2*innerWidth)+'px';e.style.top=((1-v.y)/2*innerHeight)+'px';
  $('app').appendChild(e);e.addEventListener('animationend',()=>e.remove());
}
let tipT=0;
function tip(msg,ms){const t=$('tip');if(!msg){t.classList.add('hide');return}t.innerHTML=msg;t.classList.remove('hide');clearTimeout(tipT);tipT=setTimeout(()=>t.classList.add('hide'),ms||7000)}
$('tip').addEventListener('pointerdown',()=>$('tip').classList.add('hide'));
function flash(a){const f=$('flash');f.style.transition='none';f.style.opacity=a;requestAnimationFrame(()=>{f.style.transition='opacity .6s';f.style.opacity=0})}
function dayKey(off){const d=new Date();if(off)d.setUTCDate(d.getUTCDate()+off);return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0')}
function modIcon(id){
  const b=modDef(id,false);let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;
  const all=b.it.concat(b.fx.map(o=>({x:o.x,z:o.z,r:0,ty:'fx',k:o.k})));
  all.forEach(o=>{x0=Math.min(x0,o.x);x1=Math.max(x1,o.x);z0=Math.min(z0,o.z);z1=Math.max(z1,o.z)});
  const w=x1-x0+1.4,h=z1-z0+1.4,sc2=Math.min(34/w,28/h);let s='';
  all.forEach(o=>{const px=17+(o.x-(x0+x1)/2)*sc2,py=14-(o.z-(z0+z1)/2)*sc2;
    if(o.ty==='fx'){s+=o.k==='rocket'?`<path d="M${px} ${py-6}l3 5v6h-6v-6z" fill="#ff5e8a"/>`:`<circle cx="${px}" cy="${py}" r="${1.1*sc2}" fill="none" stroke="#7fc0ff" stroke-width="1.2"/>`;return}
    if(o.ty==='B'){s+=`<circle cx="${px}" cy="${py}" r="${Math.max(1.6,.3*sc2)}" fill="#cfd6ff"/>`;return}
    const tw=(o.f?.5:TY[o.ty].w)*sc2,th=o.f?Math.max(1.4,1*sc2):Math.max(1.4,TY[o.ty].t*sc2*1.4);
    s+=`<rect x="${-tw/2}" y="${-th/2}" width="${tw}" height="${th}" rx=".6" transform="translate(${px} ${py}) rotate(${o.r*180/Math.PI})" fill="${o.f?'#c9a0ff':'#ffd9a0'}"/>`});
  return`<svg viewBox="0 0 34 28">${s}</svg>`;
}

/* ------------------------------ state ------------------------------ */
let mode='menu',kind='free',demo=false,tool='draw',stamp={id:'straight',rot:Math.PI,mirror:false};
function setMode(m){
  mode=m;
  $('menu').classList.toggle('hide',m!=='menu');
  $('levels').classList.toggle('hide',m!=='levels');
  $('hudBuild').classList.toggle('hide',m!=='build');
  $('hudPlay').classList.toggle('hide',!(m==='play'||m==='result'));
  if(m!=='build')tip(null);
}
function objText(live){
  if(!L.level&&!L.daily)return'';
  const hit=live&&P?L.targets.filter(t=>t.hit).length:0,goal=L.fx.find(o=>o.goal);
  const parts=[];if(goal)parts.push('🚀 '+(live&&P&&P.goal?'✔':'rocket'));if(L.targets.length)parts.push('🎯 '+(live?hit+'/':'')+L.targets.length);
  if(discoTiles&&live&&P)parts.push('🪩 '+P.tiles);
  return parts.join(' · ');
}
function updHud(){
  const used=userCount();
  const title=L.level?`${WORLDS[L.level.w].icon} ${WORLDS[L.level.w].name} ${L.level.w+1}-${L.level.l+1}`:L.daily?'Daily · '+L.daily.key:'Freestyle';
  $('cnt').innerHTML=`<small>${title}</small>${used} / ${L.budget===Infinity?'∞':L.budget}${(L.level||L.daily)?`<span id="obj">${objText(false)}${L.level?' · ✨ no stragglers':''}</span>`:''}`;
  $('bUndo').disabled=!undoStack.length;
  $('bSnd').style.opacity=S.snd?1:.4;
  renderOpts();
}
function kitHas(id){return BASIC[id]||!L.kit||(L.kit[id]!=null)}
function modAvail(m){return (L.kit?kitHas(m.id):S.pts>=m.at)}
function renderOpts(){
  const o=$('opts');
  document.querySelectorAll('#tools [data-tool]').forEach(b=>b.classList.toggle('on',b.dataset.tool===tool));
  if(tool==='draw'){
    o.innerHTML=`<span class="lbl">Tight</span><input id="gapR" type="range" min="45" max="85" value="${Math.round(S.gap*100)}"><span class="lbl">Wide</span>`;
    $('gapR').oninput=e=>{S.gap=e.target.value/100;saveS()};
  }else if(tool==='stamp'){
    const list=L.kit?MODS.filter(m=>kitHas(m.id)):MODS;
    const tiles=list.map(m=>{
      const lock=!modAvail(m),left=L.kit&&L.kit[m.id]!=null?L.kit[m.id]:null;
      return`<div class="tile ${stamp.id===m.id?'sel':''} ${lock||left===0?'lock':''}" data-mod="${m.id}">${modIcon(m.id)}<span>${m.name}</span>${left!=null?`<span class="bd">×${left}</span>`:''}${lock?`<span class="lk">🔒 ${fmt(m.at)}</span>`:''}</div>`}).join('');
    o.innerHTML=`<div id="tray">${tiles}</div><button class="btn sq" id="bRot">⟳</button><button class="btn sq ${stamp.mirror?'on':''}" id="bMir">⇋</button>`;
    o.querySelectorAll('.tile').forEach(t=>{t.addEventListener('pointerdown',e=>tileDown(e,t.dataset.mod))});
    const tr=$('tray');tr.scrollLeft=trayScroll;tr.addEventListener('scroll',()=>trayScroll=tr.scrollLeft);
    $('bRot').onclick=()=>{stamp.rot-=Math.PI/4;stampStep()};$('bMir').onclick=()=>{stamp.mirror=!stamp.mirror;renderOpts();stampStep()};
  }else if(tool==='erase'){o.innerHTML='<div id="hint">Drag across dominos to erase them. Tap a hill, rail or pad to remove it.</div>';}
  else{o.innerHTML='<div id="hint">Tap the domino you want to <b>start</b> the chain. It tips the way it faces (green arrow).</div>'}
}
let trayScroll=0;
function setTool(t){if((L.daily||L.level)&&t==='start')return;tool=t;ghostClear();cursor.visible=false;renderOpts()}

/* ------------------------------ ghost / stamp ------------------------------ */
let ghostOK=false,ghostW=null,sDrag=null;
function ghostClear(){for(const k in ghost)ghost[k].count=0;ghostProps.children.forEach(m=>m.visible=false);ghostMarks.forEach(m=>m.visible=false);ghostW=null}
function showGhost(w,ok){
  ghostClear();ghostW=w;ghostOK=ok;const cnt={n:0,T:0,W:0,B:0};
  for(const o of w.it){const k=o.ty;if(cnt[k]>=120)continue;poseOf(o);mat4.compose(pos,quat,one);ghost[k].setMatrixAt(cnt[k]++,mat4);ghost[k].material=ok?ghostMat:ghostBad}
  for(const k in ghost){ghost[k].count=cnt[k];ghost[k].instanceMatrix.needsUpdate=true}
  w.pr.forEach((o,i)=>{const m=ghostProps.children[i];if(!m)return;m.visible=true;m.material=ok?ghostMat:ghostBad;m.position.set(o.x,o.h/2,o.z);m.rotation.y=o.r;m.scale.set(o.w,o.h,o.d)});
  w.fx.forEach((o,i)=>{const m=ghostMarks[i];if(!m)return;m.visible=true;m.material=ok?ghostMat:ghostBad;const r=o.k==='rocket'?1:(o.rad||1.1);m.scale.set(r,r,1);m.position.set(o.x,.05,o.z)});
}
let lastStampPt=null;
function stampAt(p){
  lastStampPt=p;
  const m=MODS.find(m=>m.id===stamp.id);if(!modAvail(m)){ghostClear();return}
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
  stampCommit(stamp.id,w);ghostClear();saveFree();updHud();
  burst(fxG,w.it[0].x,.3,w.it[0].z,10,'#7cffb2',1.5,.5,.12,0,1);
  return true;
}
function tileDown(e,id){
  const m=MODS.find(m=>m.id===id);
  if(!modAvail(m)){toast('Unlocks at '+fmt(m.at)+' points');return}
  stamp.id=id;audioInit();
  document.querySelectorAll('.tile').forEach(t=>t.classList.toggle('sel',t.dataset.mod===id));
  sDrag={id:e.pointerId,moved:false,sx:e.clientX,sy:e.clientY,vert:false};
}
addEventListener('pointermove',e=>{
  if(!sDrag||e.pointerId!==sDrag.id)return;
  const dx=e.clientX-sDrag.sx,dy=e.clientY-sDrag.sy;
  if(!sDrag.moved&&Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)*1.3){const tr=$('tray');if(tr){tr.scrollLeft-=dx;sDrag.sx=e.clientX;sDrag.scroll=true}return}
  if(Math.abs(dy)>10)sDrag.moved=true;
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
  if(!was.scroll)renderOpts();
}
addEventListener('pointerup',e=>endTileDrag(e,false));
addEventListener('pointercancel',e=>endTileDrag(e,true));

/* ------------------------------ canvas input ------------------------------ */
const ptrs=new Map();let gesture=null,act=null,spaceDown=false;
addEventListener('keydown',e=>{if(e.code==='Space')spaceDown=true;if(mode==='build'){if(e.key==='z'&&(e.ctrlKey||e.metaKey))undo();if(e.key==='r'){stamp.rot-=Math.PI/4;stampStep()}}});
addEventListener('keyup',e=>{if(e.code==='Space')spaceDown=false});
cv.addEventListener('contextmenu',e=>e.preventDefault());
cv.addEventListener('wheel',e=>{if(mode!=='build')return;e.preventDefault();camState.dist=clamp(camState.dist*Math.exp(e.deltaY*.001),8,60)},{passive:false});
cv.addEventListener('pointerdown',e=>{
  if(mode!=='build')return;audioInit();tip(null);
  cv.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(ptrs.size>=2){endAct(true);startGesture();return}
  if(e.pointerType==='mouse'&&(e.button!==0||spaceDown)){gesture={mouse:true};return}
  beginAct(e);
});
cv.addEventListener('pointermove',e=>{
  if(mode!=='build')return;
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
function startGesture(){const a=[...ptrs.values()];gesture={mx:(a[0].x+a[1].x)/2,my:(a[0].y+a[1].y)/2,d:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)}}
function moveGesture(){
  const a=[...ptrs.values()];if(a.length<2)return;
  const mx=(a[0].x+a[1].x)/2,my=(a[0].y+a[1].y)/2,d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);
  panBy(gesture.mx,gesture.my,mx,my);
  if(gesture.d>10&&d>10)camState.dist=clamp(camState.dist*gesture.d/d,8,60);
  gesture.mx=mx;gesture.my=my;gesture.d=d;
}
function beginAct(e){
  const p=toWorld(e.clientX,e.clientY);if(!p)return;
  if(tool==='draw')beginDraw(p);
  else if(tool==='stamp'){act={t:'stamp'};stampAt(p)}
  else if(tool==='erase'){act={t:'erase',snap:snap(),did:false};eraseAt(p)}
  else if(tool==='start'){
    let b=null,bd=.9;for(const d of L.d){if(!isScored(d))continue;const dd=Math.hypot(d.x-p.x,d.z-p.z);if(dd<bd){bd=dd;b=d}}
    if(b){L.start=b.id;dirty=true;saveFree();toast('Start set')}
  }
}
function moveAct(e){
  const p=toWorld(e.clientX,e.clientY);if(!p)return;
  if(act.t==='draw')drawTo(p);else if(act.t==='stamp')stampAt(p);else if(act.t==='erase'){eraseAt(p);cursor.position.set(p.x,.03,p.z)}
}
function endAct(cancel){
  if(!act)return;const a=act;act=null;
  if(a.t==='draw'){
    if(a.last){L.g[a.gid]={exits:[{x:a.last.x,z:a.last.z,r:a.last.r,id:a.last.id}]};if(L.start==null&&!L.daily&&!L.level)L.start=a.firstDom.id;pushUndo(a.snap);saveFree()}
  }else if(a.t==='stamp'){if(cancel)ghostClear();else stampPlace()}
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
  const a=act;if(!a.pen)return;let guard=0;
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
  const act0=act;let removed=false;const rm=new Set();
  for(const d of L.d)if(!d.lock&&Math.hypot(d.x-p.x,d.z-p.z)<.6)rm.add(d.id);
  if(rm.size){L.d=L.d.filter(d=>!rm.has(d.id));removed=true}
  else{
    for(let i=L.p.length-1;i>=0;i--){const o=L.p[i];if(inShape(p.x,p.z,o,.15)){
      const gone=L.p.splice(i,1)[0];
      L.d=L.d.filter(d=>{if(d.lock)return true;const on=(d.y||0)>0&&inShape(d.x,d.z,gone,.1)&&!d.f;return !on});removed=true;break}}
    if(!removed)for(let i=L.fx.length-1;i>=0;i--){const o=L.fx[i];if(!o.goal&&Math.hypot(p.x-o.x,p.z-o.z)<1.1){L.fx.splice(i,1);removed=true;break}}
    if(!removed)for(let i=L.deco.length-1;i>=0;i--){const o=L.deco[i];if(o.k==='gap'&&inShape(p.x,p.z,o,.1)){L.deco.splice(i,1);removed=true;break}}
  }
  if(removed){
    if(!L.d.find(d=>d.id===L.start))L.start=(L.daily||L.level)?(L.d.find(d=>d.lock)||{}).id:(L.d.find(isScored)||{}).id;
    if(act0)act0.did=true;dirty=true;updHud();
  }
}

/* ------------------------------ persistence ------------------------------ */
let saveT=0;
function saveFree(){
  if(L.daily||L.level||demo)return;clearTimeout(saveT);
  saveT=setTimeout(()=>LS.set('free',{d:clean(L.d).map(d=>Object.assign(d,{x:+d.x.toFixed(3),z:+d.z.toFixed(3),r:+d.r.toFixed(4)})),p:L.p,g:L.g,start:L.start,uid:L.uid,n:L.n,deco:L.deco,fx:L.fx}),400);
}
function loadFree(){
  const o=LS.get('free',null);L=newLayout();
  if(o){L.d=(o.d||[]).map(d=>d.ty==='n'||TY[d.ty]?d:Object.assign(d,{ty:'n'}));L.p=o.p||[];L.g=o.g||{};L.start=o.start;L.uid=o.uid||1;L.n=o.n||0;L.deco=(o.deco||[]).map(d=>d.k==='pool'?Object.assign(d,{k:'gap'}):d);L.fx=o.fx||[]}
  const tb=TABLES.find(t=>t.id===S.floor);if(!tb||!tableOpen(tb))S.floor='wood';
  L.theme=S.floor;L.grav=(TH[S.floor]&&TH[S.floor].grav)||GRAV;
}

/* ------------------------------ courses (levels + daily) ------------------------------ */
const OBST_SHAPES={cactus:[1.2,1.2,2.2],rock:[1.6,1.6,1.2],basalt:[1.5,1.5,1.4],asteroid:[1.7,1.7,1.4],crystal:[1.1,1.1,1.4],speaker:[1.6,1.1,1.4],pillar:[1,1,1.4],cane:[1,1,2.4],gumdrop:[1.5,1.5,1],tomb:[1.4,.9,1.3],pumpkin:[1.3,1.3,1],block:[1.8,1.8,1.4]};
function makeCourse(o){
  const W=WORLDS[o.w],th=TH[W.theme],R=rng(o.seed),dd=o.dd;
  const C2=newLayout();C2.theme=W.theme;C2.grav=th.grav||GRAV;
  const tut=o.w===0&&o.l!=null;
  C2.fw=Math.round(20+Math.min(8,dd));C2.fd=Math.round(28+Math.min(14,dd*1.6));
  if(tut&&o.l<2){C2.fw=18;C2.fd=24}
  const hz=C2.fd/2,hw=C2.fw/2;
  const sx=Math.round((R()-.5)*C2.fw*.35*2)/2,sz=hz-3;
  const sd=addDomTo(C2,sx,sz,Math.PI,'n',0,'start',true);C2.start=sd.id;
  const occ=[{x:sx,z:sz,r:2.6}],bands=[];
  const free=(x,z,r)=>occ.every(c=>Math.hypot(x-c.x,z-c.z)>c.r+r)&&bands.every(b=>Math.abs(z-b.z)>b.d/2+r)&&Math.abs(x)<hw-r-.6&&Math.abs(z)<hz-r-.6;
  const gx=tut&&o.l===0?sx:(R()-.5)*C2.fw*.55,gz=-hz+3.2;
  C2.fx.push({id:C2.uid++,k:'rocket',x:gx,z:gz,goal:1,lock:1});occ.push({x:gx,z:gz,r:2.6});
  // rivers
  let rivers=0;
  const style=th.haz==='lava'?'river':th.haz==='choc'&&dd>=2?'river':tut&&o.l===4?'river':'pools';
  if(style==='river'){
    rivers=th.haz==='lava'?1+(dd>=5?1:0):1;
    for(let k=0;k<rivers;k++){
      const zr=lerp(sz-5,gz+5,(k+1)/(rivers+1))+(R()-.5)*2,narrow=tut||(th.haz==='lava'&&(k+o.l)%2===0)||R()<.3;
      const wd=narrow?.9:2.2;
      if(narrow){C2.deco.push({k:'haz',x:0,z:zr,w:C2.fw,d:wd,r:0,nogo:1,burn:th.haz==='lava'?1:0})}
      else{let gxs=[(R()-.5)*(C2.fw-6)];if(C2.fw>22&&R()<.6)gxs.push(gxs[0]>0?gxs[0]-C2.fw*.45:gxs[0]+C2.fw*.45);gxs.sort((a,b)=>a-b);
        let x0=-hw;for(const g2 of gxs.concat([hw+1.3])){const x1=g2-1.3;if(x1-x0>.3)C2.deco.push({k:'haz',x:(x0+x1)/2,z:zr,w:x1-x0,d:wd,r:0,nogo:1,burn:th.haz==='lava'?1:0});x0=g2+1.3}}
      bands.push({z:zr,d:wd+2});
    }
  }
  // targets
  let nT=Math.min(5,1+Math.floor(dd/1.8));if(tut)nT=[0,1,2,2,2][o.l];
  for(let k=0;k<nT;k++){
    for(let tr=0;tr<80;tr++){
      const z=lerp(sz-5,gz+4,(k+.5)/nT)+(R()-.5)*4,x=tut&&o.l===2?(k?1:-1)*hw*.55:(R()-.5)*(C2.fw-5);
      if(free(x,z,1.4)){C2.targets.push({x,z,r:1});occ.push({x,z,r:1.6});break}
    }
  }
  // pools
  if(!(tut&&o.l<3)){
    const nP=Math.min(5,1+Math.floor(dd/2))+(style==='river'?-1:0);
    for(let k=0;k<nP;k++)for(let tr=0;tr<40;tr++){
      const circ=th.haz==='hole'?true:th.haz==='grave'?R()<.5:R()<.35;
      const x=(R()-.5)*(C2.fw-4),z=lerp(sz-4,gz+4,R());
      if(circ){const rad=1.1+R()*1.1;if(free(x,z,rad+.9)){C2.deco.push({k:'haz',x,z,rad,nogo:1,burn:th.haz==='lava'?1:0});occ.push({x,z,r:rad});break}}
      else{const w=2.5+R()*3,d=1.8+R()*1.6;if(free(x,z,Math.max(w,d)/2+.9)){C2.deco.push({k:'haz',x,z,w,d,r:th.haz==='grave'?0:(R()-.5)*.6,nogo:1,burn:th.haz==='lava'?1:0});occ.push({x,z,r:Math.max(w,d)/2});break}}
    }
  }
  // obstacles
  let nO=Math.min(10,2+Math.floor(dd*1.1));if(tut)nO=[0,0,1,4,2][o.l];
  for(let k=0;k<nO;k++)for(let tr=0;tr<40;tr++){
    const kd=th.obst[Math.floor(R()*th.obst.length)],sh=OBST_SHAPES[kd]||OBST_SHAPES.block,s=.85+R()*.35;
    const x=(R()-.5)*(C2.fw-3),z=lerp(sz-3.5,gz+3,R()),w=sh[0]*s,d=sh[1]*s;
    if(free(x,z,Math.max(w,d)/2+1)){C2.f.push({x,z,r:kd==='tomb'||kd==='speaker'?0:(R()-.5)*1.2,w,d,h:sh[2],kind:kd});occ.push({x,z,r:Math.max(w,d)/2+.3});break}
  }
  // budget from a rough path length
  let len=0,px=sx,pz=sz;const pts=C2.targets.slice().sort((a,b)=>b.z-a.z);for(const t of pts){len+=Math.hypot(t.x-px,t.z-pz);px=t.x;pz=t.z}len+=Math.hypot(gx-px,gz-pz);
  C2.budget=Math.ceil(len/SP*1.35)+22+rivers*8;
  const kit={snake:2,fork:2,fan:1,ladder:1,ball:1,hill:1,steps:1,jump:rivers?rivers+1:1,tower:1,slow:1,spiral:1,block:1};
  for(const k in W.feat)kit[k]=(kit[k]||0)+W.feat[k];
  if(tut){const tk=[{},{},{fork:2},{fork:1,snake:2},{jump:2,fork:1}][o.l];C2.kit=tk}else C2.kit=kit;
  return C2;
}
function addDomTo(o,x,z,r,ty,y,gid,lock){const d={id:o.uid++,x,z,r,ty,y:y||0,c:o.n++,g:gid};if(lock)d.lock=1;o.d.push(d);return d}
const TUT=[
  'Drag from the <b>green arrow</b> to the <b>rocket</b> to lay dominos. Then hit <b>Play</b>!',
  'Bend your line through the <b>gold ring</b> on the way to the rocket.',
  'Two rings? Tap <b>Stamp</b> and drag a <b>Fork</b> onto the end of your line.',
  'Route around the blocks. Every domino must fall: <b>no stragglers</b>!',
  'Water! You can\'t build in it. Stamp a <b>Jump</b> to leap the river.'
];
const WTIP={sand:'Sand traps: you can\'t build in them. Try the new <b>Steps</b> piece.',candy:'Chocolate rivers block the way. Look for the <b>bridges</b>.',disco:'Every <b>floor tile</b> you topple onto lights up and scores!',
  haunted:'Spooky. Watch out for <b>open graves</b>. Ladders and Towers are in your kit.',cosmic:'<b>Low gravity!</b> Everything falls in slow motion. Avoid the black holes.',lava:'The floor is <b>lava</b>. Dominos that fall in burn up. <b>Jump</b> the narrow rivers!'};

/* ------------------------------ flow ------------------------------ */
function enterBuild(){
  undoStack=[];setTheme(L.theme,L.fw,L.fd);camSnap=true;
  document.querySelector('[data-tool=start]').classList.toggle('hide',!!(L.daily||L.level));
  tool='draw';stamp.id='straight';stamp.rot=Math.PI;stamp.mirror=false;trayScroll=0;
  dirty=true;refresh();setMode('build');camMode='chase';updHud();fitBuild();
}
function startKind(k){
  kind=k;demo=false;stopPhysics();
  if(k==='daily'){const key=dayKey(),w=1+(hashStr(key)%6);L=makeCourse({seed:hashStr(key),w,dd:5.5});L.daily={key}}else loadFree();
  enterBuild();
  if(k==='daily')tip(`Today's course: <b>${WORLDS[1+(hashStr(dayKey())%6)].name}</b>. Same for everyone. Best score counts.`);
  if(!S.seenHelp){S.seenHelp=true;saveS();showHelp()}
}
function startLevel(w,l){
  kind='level';demo=false;stopPhysics();
  L=makeCourseFor({w,l});L.level={w,l};
  enterBuild();
  tip(w===0?TUT[l]:(l===0?WTIP[WORLDS[w].id]:`Ring the rocket. Hit every target. Leave no stragglers.`),9000);
}
function goMenu(){closeModal();stopPhysics();undoStack=[];startDemo();setMode('menu');menuInfo()}
function menuInfo(){
  const all=[...MODS,...SKINS,...TABLES.filter(t=>!t.world)];
  const nxt=all.filter(i=>i.at>S.pts).sort((a,b)=>a.at-b.at)[0];
  const prev=nxt?Math.max(0,...all.filter(i=>i.at<=S.pts).map(i=>i.at)):0;
  $('pts').innerHTML=`${fmt(S.pts)} lifetime points`+(nxt?` · next unlock <b style="color:#ffb347">${nxt.name}</b> at ${fmt(nxt.at)}`:' · everything unlocked!')+(S.bestChain?`<br>Best chain ${S.bestChain} · Best freestyle ${fmt(S.bestFree)}`:'');
  $('ptsBar').style.width=nxt?clamp((S.pts-prev)/(nxt.at-prev)*100,2,100)+'%':'100%';
  const dk=dayKey(),dd=S.daily[dk],dw=WORLDS[1+(hashStr(dk)%6)];
  $('dailySub').textContent=`${dw.icon} ${dw.name}`+(dd?` · best ${fmt(dd.best)}`:'')+(S.streak>1?` · ${S.streak}-day streak`:'');
  $('lvSub').textContent=`${totalStars()} / ${WORLDS.length*15} ★ · 7 themed worlds`;
}
function showLevels(){
  closeModal();setMode('levels');$('lvStars').textContent=`★ ${totalStars()} / ${WORLDS.length*15}`;
  $('lvList').innerHTML=WORLDS.map((w,wi)=>{const open=worldOpen(wi);
    return`<div class="world ${open?'':'lock'}" style="background:${w.grad}"><h3><span class="ic">${w.icon}</span>${wi+1}. ${w.name}</h3><p>${open?w.desc:'🔒 Finish '+WORLDS[wi-1].name+' to unlock'}</p>
    <div class="lvs">${[0,1,2,3,4].map(l=>{const st=lvStars(wi,l),op=levelOpen(wi,l);return`<button class="lv ${op?'':'lock'}" data-w="${wi}" data-l="${l}">${op?l+1:'🔒'}<small>${op?'<b>'+'★'.repeat(st)+'</b><i>'+'★'.repeat(3-st)+'</i>':''}</small></button>`}).join('')}</div></div>`}).join('');
  $('lvList').querySelectorAll('.lv').forEach(b=>b.onclick=()=>{const w=+b.dataset.w,l=+b.dataset.l;if(!levelOpen(w,l)){toast(worldOpen(w)?'Beat the level before it first':'Finish the previous world first');return}audioInit();startLevel(w,l)});
}

/* ------------------------------ physics / play ------------------------------ */
let world=null,bodies=[],P=null,acc=0,demoTimer=0;
function buildWorld(){
  const R=RAPIER;if(world){try{world.free()}catch(e){}}
  world=new R.World({x:0,y:-(L.grav||GRAV),z:0});world.timestep=HSTEP;
  world.integrationParameters.numSolverIterations=qn('it',8);
  const fixed=(x,y,z,r)=>world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(x,y,z).setRotation({x:0,y:Math.sin((r||0)/2),z:0,w:Math.cos((r||0)/2)}));
  world.createCollider(R.ColliderDesc.cuboid(300,.5,300).setFriction(qn('ff',.6)),fixed(0,-.5,0,0));
  const addBox=o=>world.createCollider(R.ColliderDesc.cuboid(o.w/2,o.h/2,o.d/2).setFriction(o.rail?.05:.5),fixed(o.x,o.h/2,o.z,o.r));
  L.p.forEach(addBox);L.f.forEach(addBox);
  // arena walls so balls and blocks stay on the table
  [[0,-L.fd/2-.25,L.fw/2+.5,.25],[0,L.fd/2+.25,L.fw/2+.5,.25],[-L.fw/2-.25,0,.25,L.fd/2],[L.fw/2+.25,0,.25,L.fd/2]].forEach(r=>world.createCollider(R.ColliderDesc.cuboid(r[2],.5,r[3]),fixed(r[0],.5,r[1],0)));
  bodies=L.d.map(d=>{
    const t=TY[d.ty];poseOf(d);
    const b=world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(pos.x,pos.y+.003,pos.z).setRotation({x:quat.x,y:quat.y,z:quat.z,w:quat.w}).setLinearDamping(.01).setAngularDamping(t.ball?.15:.01).setCanSleep(true));
    const cd=t.ball?R.ColliderDesc.ball(t.r).setMass(t.m).setFriction(.5).setRestitution(.1):R.ColliderDesc.cuboid(t.w/2,t.h/2,t.t/2).setMass(t.m).setFriction(qn('fr',.3)).setRestitution(qn('re',0));
    world.createCollider(cd,b);b.sleep();
    d._top=!isScored(d);d._tt=-9;d._burn=0;d._flash=0;d._px=d.x;d._pz=d.z;return b;
  });
}
function stopPhysics(){if(world){try{world.free()}catch(e){}}world=null;bodies=[];P=null;$('vig').classList.remove('on')}
function pushStart(){
  let i=L.d.findIndex(d=>d.id===L.start);if(i<0)i=L.d.findIndex(isScored);if(i<0)return;const d=L.d[i],b=bodies[i];if(!b)return;
  const f={x:Math.sin(d.r),z:Math.cos(d.r)},k=qn('push',2.6)*Math.sqrt((L.grav||GRAV)/40);
  b.wakeUp();b.setAngvel({x:f.z*k,y:0,z:-f.x*k},true);b.setLinvel({x:f.x*k*.5,y:0,z:f.z*k*.5},true);
}
function startPlay(isDemo){
  if(!L.d.some(isScored)){toast('Place some dominos first');return}
  demo=!!isDemo;refresh();buildWorld();acc=0;
  P={t:0,score:0,streak:0,best:0,last:-9,top:0,bonus:0,tHit:0,over:false,mult:1,moveT:0,hold:0,goal:false,tiles:0,burned:0,rockets:[],slowUntil:0};
  L.targets.forEach(t=>{t.hit=false});L.fx.forEach(o=>{o._fired=0});
  if(discoTiles)discoTiles.reset();
  chase.init=false;chase.ext=0;arrow.visible=false;cursor.visible=false;ghostClear();tip(null);
  timeScale=1;$('bSlow').textContent='1×';camMode='chase';$('bCam').textContent='Chase';
  $('score').textContent='0';$('chain').textContent='';$('objP').textContent=objText(true);$('res').classList.add('hide');$('pBot').classList.remove('hide');
  if(!demo){setMode('play');S.runs++}
  pushStart();
}
function upY(q){return 1-2*(q.x*q.x+q.z*q.z)}
function inBurn(x,z){for(const o of L.deco)if(o.burn&&inShape(x,z,o,0))return true;return false}
function stepSim(dt){
  if(!world)return;
  const ts=P.slowUntil>tAbs?.25:timeScale;
  $('vig').classList.toggle('on',P.slowUntil>tAbs&&!demo);
  acc+=dt*ts;let n=0;
  while(acc>=HSTEP&&n<10){world.step();acc-=HSTEP;P.t+=HSTEP;n++}
  if(acc>HSTEP*3)acc=0;
  let moving=false;
  for(let i=0;i<bodies.length;i++){
    const b=bodies[i];if(!b||b.isSleeping())continue;const d=L.d[i];
    const lv=b.linvel(),av=b.angvel(),tr=b.translation();
    if(lv.x*lv.x+lv.y*lv.y+lv.z*lv.z>.04||av.x*av.x+av.y*av.y+av.z*av.z>.5)moving=true;
    d._px=tr.x;d._pz=tr.z;d._spd=lv.x*lv.x+lv.z*lv.z;
    if(!d._top&&upY(b.rotation())<.72){d._top=true;d._tt=P.t;onTopple(d,i,tr)}
    if(tr.y<.6&&inBurn(tr.x,tr.z))burn(i,tr);
    else if(tr.y<-3){world.removeRigidBody(b);bodies[i]=null;d._burn=1}
  }
  if(moving)P.moveT=P.t;
  if(P.rockets.some(r=>r.state!=='done'))P.moveT=P.t;
  if(!P.over&&P.t>.5&&(P.t-P.moveT>1.6||P.t>150)&&tAbs>P.hold)finishRun();
}
function burn(i,tr){
  const d=L.d[i],b=bodies[i];world.removeRigidBody(b);bodies[i]=null;d._burn=1;P.burned++;
  mat4.makeScale(0,0,0);inst[d.ty].setMatrixAt(d._i,mat4);
  if(!d._top){d._top=true;d._tt=P.t;onTopple(d,i,tr)}
  burst(fxG,tr.x,.2,tr.z,14,()=>Math.random()<.5?'#ff6a1a':'#ffd34d',2.2,.9,.16,2,1);
  burst(fxN,tr.x,.3,tr.z,4,'#3a2a2a',.8,1.2,.4,-.6,1);
  noise(.35,2200,600,.05,'highpass');
}
const _fw=new V3();
function onTopple(d,i,tr){
  if(!isScored(d))return;
  P.top++;
  if(P.t-P.last<=.65)P.streak++;else P.streak=1;
  P.last=P.t;if(P.streak>P.best)P.best=P.streak;
  const mult=Math.min(8,1+Math.floor(P.streak/10));
  if(mult>P.mult&&!demo){popup('×'+mult+'!',{x:tr.x,z:tr.z},'big');flash(.12)}P.mult=mult;
  P.score+=TY[d.ty].pts*mult;
  d._flash=1;
  click(P.streak,d.ty!=='n');
  if(d.ty!=='n')shake=Math.max(shake,.25);
  const fx2=tr.x+Math.sin(d.r)*.5,fz=tr.z+Math.cos(d.r)*.5;
  burst(fxN,fx2,.05,fz,5,theme.dust,.9,.55,.16,1.5,.6);
  burst(fxG,fx2,.3,fz,2,'#'+new THREE.Color(theme.glow[0]).getHexString(),1.2,.5,.1,0,1);
  for(let k=0;k<L.targets.length;k++){const t=L.targets[k];if(!t.hit&&Math.hypot(t.x-tr.x,t.z-tr.z)<t.r+.35){t.hit=true;const b=250*mult;P.score+=b;P.bonus+=b;P.tHit++;
    burst(fxG,t.x,.3,t.z,40,FIRE,3,1,.18,3,1);if(!demo){popup('+'+b,{x:t.x,z:t.z},'big');chime()}}}
  for(let k=0;k<L.fx.length;k++){const o=L.fx[k];if(o._fired)continue;
    if(o.k==='rocket'&&Math.hypot(o.x-tr.x,o.z-tr.z)<1.35){o._fired=1;launch(k,o,mult)}
    if(o.k==='slow'&&Math.hypot(o.x-tr.x,o.z-tr.z)<(o.rad||1.1)+.3){o._fired=1;P.slowUntil=tAbs+2.6;tone(420,90,.9,.12);if(fxMeshes[k])fxMeshes[k].visible=false}}
  if(discoTiles&&discoTiles.light(tr.x,tr.z)){P.tiles++;P.score+=5*mult}
  if(!demo){$('score').textContent=fmt(P.score);const c=$('chain');c.textContent=P.streak>=3?P.streak+' chain'+(mult>1?'  ×'+mult:''):'';c.classList.add('bump');setTimeout(()=>c.classList.remove('bump'),90);$('objP').textContent=objText(true)}
}
function launch(k,o,mult){
  const m=fxMeshes[k];if(!m)return;
  P.rockets.push({m,r:m.userData.rocket,t:0,vy:0,state:'fly',o});
  const b=(o.goal?600:300)*mult;P.score+=b;P.bonus+=b;if(o.goal)P.goal=true;
  P.hold=tAbs+3.2;
  if(!demo){popup((o.goal?'🚀 GOAL +':'🚀 +')+fmt(b),{x:o.x,z:o.z},'big')}
  noise(1.4,300,3000,.12,'bandpass');shake=Math.max(shake,.4);
  burst(fxN,o.x,.2,o.z,30,'#dddddd',3,1.4,.5,-.5,1);
}
function updateRockets(dt){
  if(!P)return;
  for(const r of P.rockets){
    if(r.state==='fly'){r.t+=dt;r.vy+=18*dt;r.r.position.y+=r.vy*dt;r.r.rotation.y+=dt*4;
      const wy=r.r.position.y,x=r.o.x,z=r.o.z;
      for(let i=0;i<4;i++){fxG.spawn(x+(Math.random()-.5)*.15,wy,z+(Math.random()-.5)*.15,(Math.random()-.5)*1.2,-4-Math.random()*3,(Math.random()-.5)*1.2,.5,1,.55+Math.random()*.4,.15,1,.22,0);
        fxN.spawn(x,wy-.2,z,(Math.random()-.5)*1.5,-1,(Math.random()-.5)*1.5,1.6,.75,.75,.78,.5,.45,-.4)}
      if(r.t>1.25){r.state='boom';r.r.visible=false;
        const y=wy;for(let j=0;j<3;j++){const c=FIRE[Math.floor(Math.random()*6)],c2=FIRE[Math.floor(Math.random()*6)];burst(fxG,x+(Math.random()-.5)*3,y+(Math.random()-.5)*2,z+(Math.random()-.5)*3,70,i=>i%2?c:c2,9,1.6,.3,6)}
        burst(fxN,x,y,z,60,FIRE,7,3,.18,5);
        noise(.9,900,80,.25,'lowpass');setTimeout(chime,120);shake=Math.max(shake,.5);if(!demo)flash(.25);r.t=0}
    }else if(r.state==='boom'){r.t+=dt;if(r.t>1.6)r.state='done'}
  }
}
function finishRun(){
  P.over=true;
  if(demo){demoTimer=2.5;return}
  const sc2=L.d.filter(isScored),total=sc2.length,strag=sc2.filter(d=>!d._top).length;
  const pen=strag*15;let flaw=0;
  if(strag===0&&total>=8){flaw=Math.round(P.score*.25)+100;burstConfetti()}
  const final=Math.max(0,P.score-pen+flaw);
  const oldPts=S.pts;S.pts+=final;
  if(P.best>S.bestChain)S.bestChain=P.best;
  let record=false,stars=0,crit=null;
  if(L.level){
    const allT=L.targets.every(t=>t.hit);
    crit=[{ok:P.goal,txt:'Ring the rocket'},{ok:L.targets.length?allT:P.best>=15,txt:L.targets.length?`Hit every ring (${P.tHit}/${L.targets.length})`:`Chain of 15+ (${P.best})`},{ok:strag===0,txt:strag?`No stragglers (${strag} left)`:'No stragglers'}];
    stars=P.goal?crit.filter(c=>c.ok).length:0;
    const k=lvKey(L.level.w,L.level.l),o=S.lv[k]||{stars:0,best:0};
    if(stars>o.stars){o.stars=stars;record=true}if(final>o.best)o.best=final;S.lv[k]=o;
  }else if(L.daily){const k=L.daily.key,o=S.daily[k]||{best:0,runs:0};o.runs++;if(final>o.best){o.best=final;record=true}S.daily[k]=o;
    if(S.lastDay!==k){S.streak=(S.lastDay===dayKey(-1))?S.streak+1:1;S.lastDay=k}}
  else if(final>S.bestFree){S.bestFree=final;record=true}
  saveS();
  const unl=[...MODS,...SKINS,...TABLES.filter(t=>!t.world)].filter(i=>i.at>oldPts&&i.at<=S.pts);
  if(L.level&&stars&&L.level.l===4&&L.level.w>0&&record&&S.lv[lvKey(L.level.w,4)].stars===stars)unl.push({name:WORLDS[L.level.w].name+' table (Freestyle)'});
  if(L.level&&stars&&L.level.l===4&&L.level.w<WORLDS.length-1&&record)unl.push({name:'World '+(L.level.w+2)+': '+WORLDS[L.level.w+1].name});
  P.result={final,strag,pen,flaw,record,unl,total,stars,crit};
  camMode='over';setMode('result');$('pBot').classList.add('hide');
  if(unl.length)setTimeout(chime,300);
  showResults();
}
function burstConfetti(){for(let i=0;i<4;i++)setTimeout(()=>{const p=C.look;burst(fxN,p.x+(Math.random()-.5)*8,6,p.z+(Math.random()-.5)*6,60,FIRE,4,3.5,.2,4)},i*180);if(!demo)flash(.3)}
function showResults(){
  const r=P.result,res=$('res'),lv=L.level;
  const tg=L.targets.length&&!lv?`<span>Targets</span><span>${P.tHit} / ${L.targets.length}</span>`:'';
  const head=lv?(r.stars?`<h2 class="ok">Level complete!</h2>`:`<h2>The rocket didn't fly</h2>`):`<h2>${r.strag===0&&r.total>=8?'<span class="ok">✨ FLAWLESS ✨</span>':r.strag<=2?'So close!':'Run complete'}</h2>`;
  const stars=lv?`<div class="stars">${[0,1,2].map(i=>`<i class="${i<r.stars?'on':''}" style="animation-delay:${.15+i*.25}s">★</i>`).join('')}</div><div class="chk">${r.crit.map(c=>`<span class="${c.ok?'y':'n'}">${c.ok?'✔':'○'}</span><span class="${c.ok?'':'muted'}">${c.txt}</span>`).join('')}</div>`:'';
  const hasNext=lv&&r.stars&&(lv.l<4||lv.w<WORLDS.length-1);
  res.innerHTML=`${head}${stars}
  <div class="big" style="${lv?'font-size:30px':''}">${fmt(r.final)}</div>${r.record&&!lv?'<div class="ok">New best!</div>':''}
  <div class="rows"><span>Toppled</span><span>${P.top} / ${r.total}</span><span>Longest chain</span><span>${P.best}</span>${tg}
  ${P.tiles?`<span>Tiles lit</span><span>${P.tiles}</span>`:''}${P.burned?`<span>Burned up 🔥</span><span>${P.burned}</span>`:''}
  <span>Chain score</span><span>${fmt(P.score)}</span>
  <span>Stragglers</span><span class="${r.strag?'bad':'ok'}">${r.strag?'−'+fmt(r.pen)+'  ('+r.strag+')':'0'}</span>
  ${r.flaw?`<span>Flawless bonus</span><span class="ok">+${fmt(r.flaw)}</span>`:''}</div>
  ${r.unl.length?`<p id="unlockNote">🔓 Unlocked: ${r.unl.map(u=>u.name).join(', ')}</p>`:''}
  <div class="acts"><button class="btn" id="rBuild">Edit</button><button class="btn" id="rAgain">Replay</button>${L.daily?'<button class="btn" id="rShare">Share</button>':''}${hasNext?'<button class="btn acc" id="rNext">Next ▶</button>':`<button class="btn acc" id="rMenu">${lv?'Levels':'Menu'}</button>`}</div>`;
  res.classList.remove('hide');
  $('rBuild').onclick=backToBuild;$('rAgain').onclick=()=>{startPlay(false)};
  if($('rMenu'))$('rMenu').onclick=()=>{backToBuild();if(lv){stopPhysics();startDemo();showLevels()}else goMenu()};
  if($('rNext'))$('rNext').onclick=()=>{const n=lv.l<4?[lv.w,lv.l+1]:[lv.w+1,0];startLevel(n[0],n[1])};
  if($('rShare'))$('rShare').onclick=shareDaily;
}
function shareDaily(){
  const r=P.result,txt=`TOPPLE Daily ${L.daily.key}\n${fmt(r.final)} pts · ${P.top}/${r.total} toppled · chain ${P.best}${r.strag===0?' · flawless ✨':''}\n${location.origin+location.pathname}`;
  if(navigator.share)navigator.share({text:txt}).catch(()=>{});
  else if(navigator.clipboard)navigator.clipboard.writeText(txt).then(()=>toast('Copied to clipboard'),()=>toast('Could not copy'));
}
function backToBuild(){
  stopPhysics();demo=false;setMode('build');$('res').classList.add('hide');
  L.d.forEach(d=>{d._top=false;d._burn=0;d._flash=0});dirty=true;camMode='chase';
  L.targets.forEach(t=>{t.hit=false});if(discoTiles)discoTiles.reset();updHud();
}

/* ------------------------------ demo (menu background) ------------------------------ */
const DEMO_TH=['wood','disco','cosmic','candy','lava','haunted','sand'];let demoI=0;
function demoLayout(){
  L=newLayout();L.fw=44;L.fd=64;L.theme=DEMO_TH[demoI++%DEMO_TH.length];L.grav=TH[L.theme].grav||GRAV;setTheme(L.theme,L.fw,L.fd);
  let ax=0,az=14,a=Math.PI;
  for(const id of ['straight','ladder','curve','steps','snake','spiral','straight','fork']){
    const w=xform(modDef(id,false),ax,az,a);stampCommit(id,w);
    const e=w.exits[0];if(!e)break;ax=e.x+Math.sin(e.r)*SP;az=e.z+Math.cos(e.r)*SP;a=e.r;
  }
  L.start=L.d[0].id;L.d.forEach((d,i)=>d.c=i);
}
function startDemo(){demoLayout();dirty=true;refresh();demo=true;startPlay(true);demoTimer=0}

/* ------------------------------ camera update ------------------------------ */
const des={pos:new V3(),look:new V3()};let camSnap=true;
function updateCamera(dt){
  let rate=18;
  if(mode==='build'){const b=buildPose();des.pos.copy(b.pos);des.look.copy(b.look);rate=camSnap?100:16}
  else if((mode==='play'||mode==='menu')&&P){
    // everything that fell in the last moment, plus fast movers (balls, scattering blocks)
    let n=0,x0=1e9,x1=-1e9,z0=1e9,z1=-1e9,hx=0,hz=0,ws=0;
    for(let i=0;i<L.d.length;i++){const d=L.d[i];
      let w=0;if(isScored(d)&&d._top&&P.t-d._tt<.8)w=1-(P.t-d._tt)/.8;else if(d.ty==='B'&&d._spd>.5)w=.8;
      if(w<=0||d._burn)continue;n++;
      x0=Math.min(x0,d._px);x1=Math.max(x1,d._px);z0=Math.min(z0,d._pz);z1=Math.max(z1,d._pz);
      if(isScored(d)){hx+=Math.sin(d.r)*w;hz+=Math.cos(d.r)*w;ws+=w}else{hx+=0;ws+=.0001}}
    for(const r of P.rockets)if(r.state==='fly'){n++;x0=Math.min(x0,r.o.x-2);x1=Math.max(x1,r.o.x+2);z0=Math.min(z0,r.o.z-2);z1=Math.max(z1,r.o.z+2)}
    if(!n&&!chase.init){const d=L.d.find(d=>d.id===L.start)||L.d[0];x0=x1=d.x;z0=z1=d.z;n=1;hx=Math.sin(d.r);hz=Math.cos(d.r);ws=1}
    if(n){
      const cx=(x0+x1)/2,cz=(z0+z1)/2,ext=Math.max(x1-x0,z1-z0);
      if(!chase.init){chase.front.set(cx,0,cz);chase.dir.set(hx,0,hz).normalize();chase.init=true}
      const coh=ws>0?Math.hypot(hx,hz)/ws:0;
      if(coh>.55){const t=new V3(hx,0,hz).normalize();chase.dir.lerp(t,1-Math.exp(-dt*2.2)).normalize()}
      chase.front.lerp(new V3(cx,0,cz),1-Math.exp(-dt*5));
      const e=Math.min(ext+(coh<.55?3:0),30);chase.ext+=(e-chase.ext)*(1-Math.exp(-dt*(e>chase.ext?3.5:.7)));
    }
    const fly=P.rockets.find(r=>r.state==='fly');
    if(camMode==='over')overPose();
    else if(fly){const y=fly.r.position.y;des.look.set(fly.o.x,Math.max(.5,y*.75),fly.o.z);des.pos.set(fly.o.x-chase.dir.x*(6+y*.3),2.5+y*.35,fly.o.z-chase.dir.z*(6+y*.3))}
    else{
      const back=4.4+chase.ext*.7,up=3.1+chase.ext*.95;
      des.pos.set(chase.front.x-chase.dir.x*back,up,chase.front.z-chase.dir.z*back);
      des.look.set(chase.front.x+chase.dir.x*.9*(1/(1+chase.ext*.3)),.25,chase.front.z+chase.dir.z*.9*(1/(1+chase.ext*.3)));
    }
    rate=camMode==='over'?2.2:3.2;
  }
  else if(mode==='result'){overPose();rate=1.8}
  const k=1-Math.exp(-rate*dt);
  C.pos.lerp(des.pos,k);C.look.lerp(des.look,k);
  camera.position.copy(C.pos);
  if(shake>0){camera.position.x+=(Math.random()-.5)*shake;camera.position.y+=(Math.random()-.5)*shake;shake=Math.max(0,shake-dt*1.6)}
  camera.lookAt(C.look);
}
function overPose(){
  let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;
  for(const d of L.d){x0=Math.min(x0,d.x);x1=Math.max(x1,d.x);z0=Math.min(z0,d.z);z1=Math.max(z1,d.z)}
  for(const o of L.fx){x0=Math.min(x0,o.x);x1=Math.max(x1,o.x);z0=Math.min(z0,o.z);z1=Math.max(z1,o.z)}
  const cx=(x0+x1)/2,cz=(z0+z1)/2,R=Math.max(x1-x0,z1-z0)/2+3;
  const asp=innerWidth/innerHeight,dist=Math.max(11,R*(asp<1?2.0:1.5));
  des.pos.set(cx,dist*.88,cz+dist*.55);des.look.set(cx,0,cz);
}

/* ------------------------------ main loop ------------------------------ */
let last=performance.now(),tAbs=0;
const flashCol=new THREE.Color(1,1,1);
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min(.05,(now-last)/1000);last=now;tAbs+=dt;
  if(world&&P){
    stepSim(dt);updateRockets(dt);
    const colDirty={};
    for(let i=0;i<bodies.length;i++){
      const b=bodies[i],d=L.d[i],k=d.ty;
      if(d._flash>0){d._flash=Math.max(0,d._flash-dt*2.5);_c.copy(d._col).lerp(flashCol,d._flash*.85);inst[k].setColorAt(d._i,_c);colDirty[k]=1}
      if(!b||(b.isSleeping()&&!P.over))continue;
      const tr=b.translation(),ro=b.rotation();
      pos.set(tr.x,tr.y,tr.z);quat.set(ro.x,ro.y,ro.z,ro.w);
      mat4.compose(pos,quat,one);inst[k].setMatrixAt(d._i,mat4);
    }
    for(const k in TY)inst[k].instanceMatrix.needsUpdate=true;
    if(mode==='result'){
      const pulse=.5+.5*Math.sin(tAbs*7);
      for(let i=0;i<L.d.length;i++){const d=L.d[i];if(isScored(d)&&!d._top){_c.setRGB(1,.05+.75*pulse,.05+.75*pulse);inst[d.ty].setColorAt(d._i,_c);colDirty[d.ty]=1}}
    }
    for(const k in colDirty)if(inst[k].instanceColor)inst[k].instanceColor.needsUpdate=true;
    if(demo&&P.over){demoTimer-=dt;if(demoTimer<=0){if(mode==='menu'){stopPhysics();startDemo()}else{refresh();startPlay(true)}}}
    // wave light
    waveLight.intensity+=((camMode==='chase'&&P.top&&!P.over?theme.glow[1]:theme.glow[1]*.3)-waveLight.intensity)*Math.min(1,dt*3);
    waveLight.position.set(chase.front.x,1.6,chase.front.z);
  }else{waveLight.intensity=theme.glow[1]*.25;waveLight.position.set(C.look.x,2,C.look.z);if(dirty)refresh()}
  if(mode==='build'){
    if(dirty)refresh();camSnap=false;
    const sd=L.d.find(d=>d.id===L.start);
    if(sd&&tool!=='erase'){arrow.visible=true;arrow.position.set(sd.x,(sd.y||0)+TY[sd.ty].h+.3+Math.sin(tAbs*4)*.06,sd.z);arrow.rotation.y=sd.r}else arrow.visible=false;
  }
  targetMeshes.forEach((g,i)=>{const t=L.targets[i];if(!t)return;const hit=P&&t.hit;const s=hit?1:1+Math.sin(tAbs*3+i)*.05;g.scale.set(s,1,s);const c=hit?0x6bf2b0:theme.ring;g.userData.ring.material.color.setHex(c);g.userData.disc.material.color.setHex(c);g.userData.disc.material.opacity=hit?.5:.3});
  fxMeshes.forEach(m=>{if(m.userData.glow){const s=1+Math.sin(tAbs*4)*.06;m.userData.glow.scale.set(s,s,1)}else if(m.visible)m.rotation.z=tAbs*.6});
  decoGroup.children.forEach(m=>{if(m.userData.spin)m.rotation.z=tAbs*.8});
  obstGroup.children.forEach(m=>{if(m.userData.spin)m.rotation.y+=dt*.3});
  if(envTick)envTick(dt,tAbs);
  ambient(dt);fxG.update(dt);fxN.update(dt);
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
  <li><b>Stamp</b>: drag a piece up from the tray onto the table. It snaps to open ends. ⟳ turns it, ⇋ flips it.</li>
  <li>Pieces include <b>Ladders</b>, <b>Steps</b>, <b>Ball Runs</b>, <b>Towers</b>, <b>Rockets</b> and <b>Slow-mo</b> pads.</li>
  <li><b>Pinch</b> or two-finger drag to zoom and pan.</li>
  <li>Tap <b>PLAY</b>. The camera dives in and follows the wave.</li>
  <li><b>Chain score</b>: every domino in a row scores more. Keep the chain unbroken for ×2, ×3 and up.</li>
  <li><b>Stragglers</b>: any domino left standing costs you points.</li>
  <li><b>Levels</b>: ring the rocket for ★, hit every ring for ★, leave no stragglers for ★. Seven themed worlds.</li></ul>
  <div class="row"><button class="btn acc" id="mClose">Got it</button></div>`);
  $('mClose').onclick=closeModal;
}
function showUnlocks(){
  const sec=(title,arr,cur,fn,lockTxt)=>`<h4>${title}</h4><div class="grid">${arr.map(i=>{const ok=i.world?tableOpen(i):S.pts>=i.at;return`<div class="item ${ok?'':'lock'} ${cur===i.id?'sel':''}" data-k="${title}" data-id="${i.id}">${fn(i)}<span>${i.name}</span><small>${ok?(cur===i.id?'In use':''):'🔒 '+(i.world?'Beat world':fmt(i.at))}</small></div>`}).join('')}</div>`;
  const sw=i=>{const old=S.skin;S.skin=i.id;const cs=[0,3,6,9,12].map(c=>'#'+skinColor(c).getHexString());S.skin=old;return`<div class="sw" style="background:linear-gradient(90deg,${cs.join(',')})"></div>`};
  const fl=i=>{const w=WORLDS.find(w=>w.theme===i.id);const c={wood:'#b98a5a',felt:'#1f6b4a',blue:'#17407a',night:'#16102a'}[i.id];return`<div class="sw" style="background:${w?w.grad:c}"></div>`};
  const md=i=>modIcon(i.id).replace('<svg','<svg style="width:40px;height:30px"');
  openModal(`<h3>Unlocks</h3><div class="muted">${fmt(S.pts)} lifetime points. Every run adds to it. Beat a world to unlock its table for Freestyle.</div>
  ${sec('Skins',SKINS,S.skin,sw)}${sec('Tables',TABLES,S.floor,fl)}${sec('Pieces',MODS,null,md)}
  <div class="row"><button class="btn acc" id="mClose">Done</button></div>`);
  $('mClose').onclick=()=>{closeModal();menuInfo()};
  document.querySelectorAll('#modalCard .item').forEach(el=>el.onclick=()=>{
    const id=el.dataset.id,k=el.dataset.k;if(el.classList.contains('lock'))return;
    if(k==='Skins'){S.skin=id;saveS();dirty=true;showUnlocks()}
    if(k==='Tables'){S.floor=id;saveS();showUnlocks()}
  });
}

/* ------------------------------ wiring ------------------------------ */
$('bLevels').onclick=()=>{audioInit();showLevels()};
$('lvBack').onclick=()=>{setMode('menu');menuInfo()};
$('bFree').onclick=()=>{audioInit();startKind('free')};
$('bDaily').onclick=()=>{audioInit();startKind('daily')};
$('bHelp').onclick=showHelp;$('bUnlock').onclick=showUnlocks;
$('bHome').onclick=()=>{if(L.level){stopPhysics();startDemo();showLevels()}else goMenu()};
$('bUndo').onclick=undo;
let clrT=0;
$('bClear').onclick=()=>{
  if(!userCount()&&!L.fx.some(o=>!o.goal))return;
  if(!clrT){$('bClear').textContent='Sure?';clrT=setTimeout(()=>{clrT=0;$('bClear').textContent='🗑'},2000);return}
  clearTimeout(clrT);clrT=0;$('bClear').textContent='🗑';
  pushUndo();L.d=L.d.filter(d=>d.lock);L.p=[];L.g={};L.deco=L.deco.filter(d=>d.nogo);L.fx=L.fx.filter(o=>o.goal);
  if(L.level)L.kit=makeCourseFor(L.level).kit;
  else if(L.daily){L.kit=makeCourse({seed:hashStr(L.daily.key),w:1+(hashStr(L.daily.key)%6),dd:5.5}).kit}
  if(!L.daily&&!L.level)L.start=null;dirty=true;saveFree();updHud();
};
function makeCourseFor(lv){return makeCourse({seed:hashStr('lv'+lv.w+'-'+lv.l),w:lv.w,l:lv.l,dd:lv.w===0?lv.l*.6:lv.w*.75+lv.l*.9})}
$('bSnd').onclick=()=>{S.snd=!S.snd;saveS();updHud()};
document.querySelectorAll('#tools [data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
$('bPlay').onclick=()=>{audioInit();startPlay(false)};
$('bStop').onclick=()=>{backToBuild()};
$('bCam').onclick=()=>{camMode=camMode==='chase'?'over':'chase';$('bCam').textContent=camMode==='chase'?'Chase':'Overview'};
$('bSlow').onclick=()=>{timeScale=timeScale===1?.35:1;$('bSlow').textContent=timeScale===1?'1×':'Slow'};

/* ------------------------------ test hooks ------------------------------ */
window.TOPPLE={
  get L(){return L},get P(){return P},
  chain(list,x,z,a){let ax=x,az=z;for(const id of list){const w=xform(modDef(id,false),ax,az,a);stampCommit(id,w);const e=w.exits[0];if(!e)break;ax=e.x+Math.sin(e.r)*SP;az=e.z+Math.cos(e.r)*SP;a=e.r}if(L.start==null)L.start=L.d[0]&&L.d[0].id;dirty=true},
  play(){startPlay(false)},step(sec){let n=0;while(n<sec*60){tAbs+=1/60;stepSim(1/60);updateRockets(1/60);n++}},
  reset(){const t=L.theme,g=L.grav;L=newLayout();L.theme=t;L.grav=g;undoStack=[]},
  stats(){const s=L.d.filter(isScored);return{top:s.filter(d=>d._top).length,total:s.length,burned:P&&P.burned,P:P&&{t:P.t,score:P.score,best:P.best,over:P.over,goal:P.goal,tHit:P.tHit,tiles:P.tiles},res:P&&P.result&&{stars:P.result.stars,strag:P.result.strag}}},
  start:startKind,level:startLevel,levels:showLevels,mode:()=>mode,modDef,xform,stampCheck,makeCourse,setTheme:(id)=>{L.theme=id;L.grav=TH[id].grav||GRAV;setTheme(id,L.fw,L.fd);dirty=true}
};

/* ------------------------------ boot ------------------------------ */
resize();
RAPIER.init().then(()=>{goMenu();requestAnimationFrame(frame);window.TOPPLE_READY=true});
})();
