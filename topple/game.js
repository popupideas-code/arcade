(function(){
'use strict';
/* ============================== TOPPLE ============================== */
const VERSION='0.3.0';
const Q=new URLSearchParams(location.search),qn=(k,d)=>Q.has(k)?+Q.get(k):d;
const SP=qn('sp',.62), GRAV=qn('g',40), HSTEP=1/qn('hz',120);
const TY={
  n:{w:.5,h:1,t:.15,m:1,cap:1400,pts:10},
  T:{w:.8,h:2,t:.25,m:2.2,cap:120,pts:40},
  W:{w:2.4,h:1,t:.15,m:1.8,cap:160,pts:25},
  B:{r:.3,m:1.6,cap:40,ball:1},
  b:{r:.2,m:.35,cap:40,ball:1},
  WB:{r:.5,m:7,cap:12,ball:1},
  C:{w:.7,h:1,t:.02,m:.08,cap:300},
  P:{r:.14,h:.75,m:.15,cap:120,pin:1},
  K:{w:.7,h:.12,t:3.2,m:1.2,cap:24}
};
const MAXD=900;
const V3=THREE.Vector3;
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const wrap=a=>{while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a};
const LS={get(k,d){try{const v=localStorage.getItem('topple.'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem('topple.'+k,JSON.stringify(v))}catch(e){}}};
function rng(seed){let a=seed>>>0;return function(){a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
const hashStr=s=>[...s].reduce((a,c)=>(Math.imul(a,31)+c.charCodeAt(0))>>>0,7);
const isScored=d=>(d.ty==='n'||d.ty==='T'||d.ty==='W')&&!d.f&&!d.ex;

/* ------------------------------ progress ------------------------------ */
const S=Object.assign({pts:0,bestFree:0,bestChain:0,skin:'rainbow',floor:'wood',snd:true,daily:{},streak:0,lastDay:'',runs:0,gap:.62,seenHelp:false,lv:{},snap:true,emoji:'😀',word:'TOPPLE'},LS.get('save',{}));
if(!S.lv)S.lv={};
function saveS(){LS.set('save',S)}
const MODS=[
  {id:'straight',name:'Straight',at:0,cat:'paths'},{id:'curve',name:'Curve',at:0,cat:'paths'},
  {id:'snake',name:'Snake',at:300,cat:'paths'},{id:'fork',name:'Fork',at:800,cat:'paths'},
  {id:'zipper',name:'Zipper',at:1400,cat:'paths'},{id:'fan',name:'Fan',at:2000,cat:'paths'},
  {id:'ladder',name:'Ladder',at:2600,cat:'paths'},{id:'steps',name:'Steps',at:3400,cat:'paths'},
  {id:'hill',name:'Hill',at:4200,cat:'paths'},{id:'jump',name:'Jump',at:5000,cat:'paths'},
  {id:'spiral',name:'Spiral',at:7000,cat:'paths'},{id:'block',name:'Block',at:9000,cat:'paths'},
  {id:'ball',name:'Ball Run',at:1800,cat:'gadgets'},{id:'slow',name:'Slow-mo',at:2400,cat:'gadgets'},
  {id:'relay',name:'Relay',at:3000,cat:'gadgets'},{id:'falls',name:'Waterfall',at:3800,cat:'gadgets'},
  {id:'bridge',name:'Overpass',at:4600,cat:'gadgets'},{id:'marble',name:'Marble Ramp',at:5500,cat:'gadgets'},
  {id:'tramp',name:'Trampoline',at:6500,cat:'gadgets'},{id:'seesaw',name:'Catapult',at:7500,cat:'gadgets'},
  {id:'wrecker',name:'Wrecking Ball',at:8500,cat:'gadgets'},
  {id:'rocket',name:'Rocket',at:1200,cat:'finales'},{id:'bell',name:'Bell',at:1600,cat:'finales'},
  {id:'trophy',name:'Trophy',at:2200,cat:'finales'},{id:'fireworks',name:'Fireworks',at:2900,cat:'finales'},
  {id:'bowling',name:'Bowling',at:3200,cat:'finales'},{id:'pinata',name:'Piñata',at:3600,cat:'finales'},
  {id:'discodrop',name:'Disco Drop',at:4400,cat:'finales'},{id:'coffin',name:'Coffin',at:5200,cat:'finales'},
  {id:'ufo',name:'UFO',at:6000,cat:'finales'},{id:'volcano',name:'Volcano',at:7000,cat:'finales'},
  {id:'cards',name:'Card House',at:8000,cat:'finales'},{id:'tower',name:'Tower',at:8800,cat:'finales'},
  {id:'pyramid',name:'Pyramid',at:9600,cat:'finales'},
  {id:'heart',name:'Heart',at:2500,cat:'shapes'},{id:'star',name:'Star',at:3500,cat:'shapes'},
  {id:'mosaic',name:'Mosaic',at:4000,cat:'shapes'},{id:'name',name:'Name',at:5000,cat:'shapes'},
  {id:'dspiral',name:'Double Spiral',at:6500,cat:'shapes'}
];
const CATS=[['paths','Paths'],['gadgets','Gadgets'],['finales','Finales'],['shapes','Shapes']];
const BASIC={straight:1,curve:1};
const SKINS=[
  {id:'rainbow',name:'Rainbow',at:0},{id:'ivory',name:'Ivory',at:0},
  {id:'sunset',name:'Sunset',at:800},{id:'ocean',name:'Ocean',at:2000},
  {id:'candy',name:'Candy',at:5000},{id:'gold',name:'Gold & Ink',at:8000}
];
const WORLDS=[
  {id:'table',name:'Tabletop',icon:'🎲',theme:'wood',desc:'Learn the ropes.',grad:'linear-gradient(135deg,#a8743f,#5a3a22)',feat:{},fin:'rocket'},
  {id:'sand',name:'Sand Trap',icon:'🌵',theme:'sand',desc:'Dunes, cacti and bunkers you can\'t build in.',grad:'linear-gradient(135deg,#e2b66d,#9a6a32)',feat:{steps:1,falls:1,bridge:1},fin:'trophy'},
  {id:'candy',name:'Candy Shop',icon:'🍭',theme:'candy',desc:'Chocolate rivers. Find the bridges.',grad:'linear-gradient(135deg,#ff8fc4,#a65cff)',feat:{snake:1,zipper:1,tramp:1},fin:'pinata'},
  {id:'disco',name:'Disco Fever',icon:'🪩',theme:'disco',desc:'Light up the dance floor for points.',grad:'linear-gradient(135deg,#ff3fd8,#3a1aa8)',feat:{fan:1,block:1,zipper:1},fin:'discodrop'},
  {id:'haunted',name:'Haunted House',icon:'👻',theme:'haunted',desc:'Spooky halls and open graves.',grad:'linear-gradient(135deg,#3b2f5c,#0e0a18)',feat:{ladder:1,wrecker:1},fin:'coffin'},
  {id:'cosmic',name:'Cosmic',icon:'🪐',theme:'cosmic',desc:'Low gravity. Black holes. Big drama.',grad:'linear-gradient(135deg,#2a3a9a,#05030f)',feat:{spiral:1,slow:1,marble:1},fin:'ufo'},
  {id:'lava',name:'Floor is Lava',icon:'🌋',theme:'lava',desc:'Dominos that fall in burn. Jump or bridge the rivers.',grad:'linear-gradient(135deg,#ff6a1a,#4a0a05)',feat:{jump:2,bridge:1,seesaw:1},fin:'volcano'}
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
const cardTex=canvasTex(70,100,g=>{g.fillStyle='#fff';g.fillRect(0,0,70,100);g.fillStyle='#c8203c';g.fillRect(5,5,60,90);g.strokeStyle='rgba(255,255,255,.55)';g.lineWidth=2;for(let i=-100;i<100;i+=8){g.beginPath();g.moveTo(i,0);g.lineTo(i+100,100);g.moveTo(i+100,0);g.lineTo(i,100);g.stroke()}});
const cardM=new THREE.MeshStandardMaterial({color:0xffffff,map:cardTex,roughness:.6});
const pinTex=canvasTex(8,64,g=>{g.fillStyle='#fff';g.fillRect(0,0,8,64);g.fillStyle='#d01830';g.fillRect(0,14,8,4);g.fillRect(0,21,8,4)});
const pinM=new THREE.MeshStandardMaterial({color:0xffffff,map:pinTex,roughness:.35});
const geo={},inst={},ghost={},ghostCap={n:400,T:20,W:60,B:8,b:8,WB:4,C:40,P:20,K:4};
const ghostMat=new THREE.MeshBasicMaterial({color:0x7cffb2,transparent:true,opacity:.55,depthWrite:false});
const ghostBad=new THREE.MeshBasicMaterial({color:0xff5a6e,transparent:true,opacity:.55,depthWrite:false});
for(const k in TY){
  const d=TY[k];
  if(d.ball)geo[k]=new THREE.SphereGeometry(d.r,20,14);
  else if(d.pin){geo[k]=new THREE.LatheGeometry([[0,0],[.1,.01],[.14,.18],[.12,.36],[.06,.5],[.075,.62],[.06,.72],[0,.75]].map(p=>new THREE.Vector2(p[0],p[1])),16);geo[k].translate(0,-d.h/2,0)}
  else geo[k]=new THREE.BoxGeometry(d.w,d.h,d.t);
  const mats=d.ball?ballM:d.pin?pinM:k==='C'?[sideM,sideM,sideM,sideM,cardM,cardM]:k==='W'||k==='K'?plainM:[sideM,sideM,sideM,sideM,faceM,faceM];
  inst[k]=new THREE.InstancedMesh(geo[k],mats,d.cap);
  inst[k].instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  inst[k].setColorAt(0,new THREE.Color(1,1,1));
  inst[k].castShadow=inst[k].receiveShadow=true;inst[k].frustumCulled=false;inst[k].count=0;
  scene.add(inst[k]);
  ghost[k]=new THREE.InstancedMesh(geo[k],ghostMat,ghostCap[k]);ghost[k].frustumCulled=false;ghost[k].count=0;ghost[k].renderOrder=5;scene.add(ghost[k]);
}
const unitBox=new THREE.BoxGeometry(1,1,1),unitCyl=new THREE.CylinderGeometry(1,1,1,24),unitCircle=new THREE.CircleGeometry(1,40);
const propGroup=new THREE.Group(),decoGroup=new THREE.Group(),ghostProps=new THREE.Group(),markGroup=new THREE.Group(),envGroup=new THREE.Group(),obstGroup=new THREE.Group();
scene.add(propGroup,decoGroup,ghostProps,markGroup,envGroup,obstGroup);
const stepMat=new THREE.MeshStandardMaterial({color:0x9a8fb4,roughness:.8});
for(let i=0;i<60;i++){const m=new THREE.Mesh(unitBox,ghostMat);m.visible=false;ghostProps.add(m)}
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
const mat4=new THREE.Matrix4(),quat=new THREE.Quaternion(),pos=new V3(),one=new V3(1,1,1),yAxis=new V3(0,1,0),xAxis=new V3(1,0,0);
let dirty=true,undoStack=[];
const clean=a=>a.map(o=>{const r={};for(const k in o)if(k[0]!=='_')r[k]=o[k];return r});
function snap(){return JSON.stringify({d:clean(L.d),p:L.p,g:L.g,start:L.start,uid:L.uid,n:L.n,kit:L.kit,deco:L.deco,fx:clean(L.fx)})}
function pushUndo(s){undoStack.push(s||snap());if(undoStack.length>40)undoStack.shift();updHud()}
function restore(s){const o=JSON.parse(s);Object.assign(L,{d:o.d,p:o.p,g:o.g,start:o.start,uid:o.uid,n:o.n,kit:o.kit,deco:o.deco,fx:o.fx});dirty=true;updHud()}
function undo(){if(pend)pendCancel();if(!undoStack.length)return;restore(undoStack.pop());saveFree()}
function userCount(){let n=0;for(const d of L.d)if(!d.lock&&isScored(d))n++;return n}
function addDom(x,z,r,ty,y,gid,lock,f){const d={id:L.uid++,x,z,r,ty,y:y||0,c:L.n++,g:gid};if(lock)d.lock=1;if(f)d.f=1;L.d.push(d);return d}
function pointsOf(x,z,r,ty,f){
  const cr=Math.cos(r),sr=Math.sin(r);let s;
  if(ty==='B'||ty==='b')s=[[0,0,TY[ty].r]];else if(ty==='WB')s=[[0,0,.5]];else if(ty==='P'||ty==='C')s=[[0,0,.16]];
  else if(ty==='K')s=[[0,-1.2,.3],[0,0,.3],[0,1.2,.3]];
  else if(f)s=[[0,-.3,.24],[0,.3,.24]];else if(ty==='W')s=[[-.9,0,.21],[0,0,.21],[.9,0,.21]];else if(ty==='T')s=[[0,0,.38]];else s=[[0,0,.21]];
  return s.map(p=>[x+p[0]*cr+p[1]*sr,z-p[0]*sr+p[1]*cr,p[2]]);
}
function inShape(px,pz,o,pad){
  if(o.rad)return Math.hypot(px-o.x,pz-o.z)<o.rad+pad;
  const dx=px-o.x,dz=pz-o.z,c=Math.cos(o.r||0),s=Math.sin(o.r||0);
  const lx=dx*c-dz*s,lz=dx*s+dz*c;
  return Math.abs(lx)<o.w/2+pad&&Math.abs(lz)<o.d/2+pad;
}
// does an item standing at height y (1 unit tall) overlap the solid part of prop o vertically?
const vOver=(y,o)=>{const b=o.cy!=null?0:(o.y0||0),t=o.cy!=null?o.cy+.3:(o.y0||0)+o.h;return y<t-.02&&y+1>b+.02};
const isFin=k=>!!FIN[k];const isPad=k=>isFin(k)||k==='cat';
function blockedAt(x,z,r,ty,y,ign,f){
  const pts=pointsOf(x,z,r,ty,f);
  for(const q of pts){
    if(Math.abs(q[0])>L.fw/2-.4||Math.abs(q[1])>L.fd/2-.4)return true;
    for(const o of L.f)if(y<o.h-.02&&inShape(q[0],q[1],o,q[2]))return true;
    if(y<.3)for(const o of L.deco)if(o.nogo&&inShape(q[0],q[1],o,q[2]))return true;
    for(const o of L.p)if(vOver(y,o)&&inShape(q[0],q[1],o,q[2]))return true;
    for(const o of L.fx)if(isPad(o.k)&&Math.hypot(q[0]-o.x,q[1]-o.z)<(o.k==='cat'?.45:.75)+q[2])return true;
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
// re-orient a freeform path so it starts at the origin heading +z
function normalize(it){const f=it[0],a=-f.r,c=Math.cos(a),s=Math.sin(a);return it.map(o=>{const dx=o.x-f.x,dz=o.z-f.z;return Object.assign({},o,{x:dx*c+dz*s,z:-dx*s+dz*c,r:o.r+a})})}
function trimClose(it,n){const head=it.slice(0,n);let k=it.length;while(k>n+4&&head.some(h=>Math.hypot(h.x-it[k-1].x,h.z-it[k-1].z)<1.05))k--;return it.slice(0,k)}
// static ramp from (z0,y0) down/up to (z1,y1) with optional side walls; returns props
function ramp(z0,y0,z1,y1,w,walls){
  const len=Math.hypot(z1-z0,y1-y0),tx=Math.atan2(y0-y1,z1-z0),th=.12;
  const mz=(z0+z1)/2,my=(y0+y1)/2;
  const out=[{x:0,z:mz-Math.sin(tx)*th/2,cy:my-Math.cos(tx)*th/2,r:0,tx,w,d:len,h:th,kind:'ramp'}];
  if(walls)[-1,1].forEach(s=>out.push({x:s*(w/2+.05),z:mz+Math.sin(tx)*.18,cy:my+Math.cos(tx)*.18,r:0,tx,w:.08,d:len,h:.36,kind:'rail'}));
  return out;
}
function climbRamp(h,len,w){
  const t=leadIn(2),it=t.it.slice(),pr=[];let z=t.z,y=0;
  while(y<h-.01){y=Math.min(h,y+.15);z+=SP;it.push({x:0,z,r:0,ty:'n',y});pr.push({x:0,z,r:0,w:1.1,d:SP,h:y,kind:'stone'})}
  const zs=z+SP*.5,ze=zs+len,tx=Math.atan2(h,len),br=TY.B.r,al=.95;pr.push(...ramp(zs,h,ze,0,w,true));
  it.push({x:0,z:zs+al*Math.cos(tx)+br*Math.sin(tx),r:0,ty:'B',cy:h-al*Math.sin(tx)+br*Math.cos(tx)+.004});
  return{it,pr,end:ze};
}
function climb(h,ball){
  const t=leadIn(2),it=t.it.slice(),pr=[];let z=t.z,y=0;
  while(y<h-.01){y=Math.min(h,y+.15);z+=SP;it.push({x:0,z,r:0,ty:'n',y});pr.push({x:0,z,r:0,w:1.1,d:SP,h:y,kind:'stone'})}
  const pz=z+SP*.5+.25;pr.push({x:0,z:pz,r:0,w:1.1,d:.5,h,kind:'stone'});
  it.push(Object.assign({x:0,z:pz+.1,r:0,ty:'b',y:h},ball||{}));
  return{it,pr,edge:pz+.25};
}
function rails(z0,len,half,h){return[-1,1].map(s=>({x:s*half,z:z0+len/2,r:0,w:.1,d:len,h:h||.16,rail:1,kind:'rail'}))}
function leadIn(n){const t=new Tt();t.dom().straight(n-1);return t}
function finale(k){const t=leadIn(3);return{it:t.it,fx:[{k,x:0,z:t.z+1.75}],exits:[]}}
// plate cascade that fans one line out to cover a field of half-width hw; returns final z
function cascade(it,z,hw){let k=0;while(1.25*k+1.2<hw+.3){for(let i=0;i<=k;i++)it.push({x:(i-k/2)*2.5,z,r:0,ty:'W',y:0});z+=SP;k++}for(let i=0;i<=k;i++)it.push({x:(i-k/2)*2.5,z,r:0,ty:'W',y:0});return z+SP}
function fieldDef(cols,rows,colorAt){
  const t=leadIn(2),it=t.it.slice();let z=t.z+SP;const hw=(cols-1)/2*.6+.25;
  z=cascade(it,z,hw);
  for(let r=0;r<rows;r++){for(let c=0;c<cols;c++)it.push({x:((cols-1)/2-c)*.6,z,r:0,ty:'n',y:0,col:colorAt(c,r)});z+=SP}
  return{it,exits:[]};
}
const IVORY=0xf3ecd8;
function sampleImage(draw,cols,rows,cell,bg){
  const c=document.createElement('canvas');c.width=cols*cell;c.height=rows*cell;const g=c.getContext('2d');draw(g,c.width,c.height);
  const px=g.getImageData(0,0,c.width,c.height).data,out=[];
  for(let r=0;r<rows;r++){out.push([]);for(let cc=0;cc<cols;cc++){let R=0,G=0,B=0,A=0;
    for(let y=0;y<cell;y++)for(let x=0;x<cell;x++){const i=((r*cell+y)*c.width+cc*cell+x)*4,a=px[i+3]/255;R+=px[i]*a;G+=px[i+1]*a;B+=px[i+2]*a;A+=a}
    const n=cell*cell,a=A/n;if(a<.25){out[r].push(bg);continue}
    const br=(bg>>16)&255,bgc=(bg>>8)&255,bb=bg&255,k=Math.min(1,a*1.3);
    const mix=(v,b)=>Math.round(b*(1-k)+(A?v/A:0)*k);out[r].push((mix(R,br)<<16)|(mix(G,bgc)<<8)|mix(B,bb))}}
  return out;
}
function emojiGrid(e){const cols=14,rows=12;return sampleImage((g,w,h)=>{g.textAlign='center';g.textBaseline='middle';g.font=Math.floor(h*.92)+'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';g.fillText(e,w/2,h*.54)},cols,rows,6,IVORY)}
function wordGrid(w){
  w=(w||'HI').toUpperCase().slice(0,8);const rows=9,cell=6;
  const m=document.createElement('canvas').getContext('2d');m.font='900 '+(rows*cell*.92)+'px system-ui,sans-serif';
  const cols=clamp(Math.ceil(m.measureText(w).width/cell)+2,10,44);
  const grid=sampleImage((g,W,H)=>{g.fillStyle='#000';g.font='900 '+(H*.92)+'px system-ui,sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(w,W/2,H*.56)},cols,rows,cell,-1);
  return grid.map(row=>row.map((v,c)=>v===-1?0x2a2438:new THREE.Color().setHSL(c/cols*.85,.8,.6).getHex()));
}
const BUILD={
  straight(){const t=new Tt();t.dom().straight(7);return{it:t.it,exits:[t.last()]}},
  curve(){const t=new Tt();t.dom().turn(90,7);return{it:t.it,exits:[t.last()]}},
  snake(){const t=new Tt();t.dom().turn(40,4).turn(-80,8).turn(40,4);return{it:t.it,exits:[t.last()]}},
  fork(){
    const t=new Tt();t.dom().straight(2);const pz=plate(t);const it=t.it.slice(),exits=[];
    [-1,1].forEach(s=>{const b=new Tt();b.x=s*.75;b.z=pz+SP;b.dom().turn(s*45,6).straight(4);it.push(...b.it);exits.push(b.last())});
    return{it,exits};
  },
  zipper(){
    const t=new Tt();t.dom().straight(2);const pz=plate(t);const it=t.it.slice();
    for(let k=0;k<12;k++)it.push({x:-.29,z:pz+SP+k*SP,r:0,ty:'n',y:0},{x:.29,z:pz+SP*1.5+k*SP,r:0,ty:'n',y:0});
    const ez=pz+SP*13.5;it.push({x:0,z:ez,r:0,ty:'W',y:0});const b=new Tt();b.z=ez+SP;b.dom().straight(2);it.push(...b.it);
    return{it,exits:[b.last()]};
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
  falls(){
    const ys=[0,0,.15,.3,.45,.6,.75,.9,1.05,1.2,1.2,1.2,1.2,1.2,.9,.9,.6,.6,.3,.3,0,0,0];
    const it=[],pr=[];
    ys.forEach((y,i)=>{it.push({x:0,z:i*SP,r:0,ty:'n',y});if(y>0)pr.push({x:0,z:i*SP,r:0,w:1.4,d:SP,h:y,kind:'stone'})});
    return{it,pr,exits:[{x:0,z:(ys.length-1)*SP,r:0}]};
  },
  bridge(){
    const up=[.15,.3,.45,.6,.75,.9,1.05,1.2,1.35],it=[],pr=[];let i=0;
    it.push({x:0,z:0,r:0,ty:'n',y:0});i=1;
    up.forEach(y=>{it.push({x:0,z:i*SP,r:0,ty:'n',y});pr.push({x:0,z:i*SP,r:0,w:1.3,d:SP,h:y,kind:'stone'});i++});
    const d0=i;for(let k=0;k<7;k++){it.push({x:0,z:i*SP,r:0,ty:'n',y:1.35});i++}
    pr.push({x:0,z:(d0+3)*SP,r:0,w:1.3,d:7*SP,h:.15,y0:1.2,kind:'deck'});
    [-1,1].forEach(s=>pr.push({x:s*.6,z:(d0+3)*SP,r:0,w:.08,d:7*SP,h:.35,y0:1.35,kind:'rail'}));
    up.slice().reverse().forEach(y=>{it.push({x:0,z:i*SP,r:0,ty:'n',y});pr.push({x:0,z:i*SP,r:0,w:1.3,d:SP,h:y,kind:'stone'});i++});
    it.push({x:0,z:i*SP,r:0,ty:'n',y:0},{x:0,z:(i+1)*SP,r:0,ty:'n',y:0});
    return{it,pr,exits:[{x:0,z:(i+1)*SP,r:0}]};
  },
  jump(){
    const t=new Tt();t.dom().straight(2);const zT=t.z+.62;
    const it=t.it.slice();it.push({x:0,z:zT,r:0,ty:'T',y:0});
    const zR=zT+1.75;const b=new Tt();b.z=zR;b.dom().straight(4);it.push(...b.it);
    return{it,deco:[{k:'gap',x:0,z:(zT+zR)/2,w:2.2,d:zR-zT-.7}],exits:[b.last()]};
  },
  ball(){return ballRun(4.2)},
  relay(){return ballRun(9)},
  marble(){
    const c=climbRamp(1.2,4.6,.9),z1=c.end;c.pr.push(...rails(z1,3,.42,.25));
    const b=new Tt();b.z=z1+3.2;b.dom().straight(4);c.it.push(...b.it);
    return{it:c.it,pr:c.pr,exits:[b.last()]};
  },
  tramp(){
    const c=climb(1.2,{rest:.85}),zt=c.edge+.55;
    c.pr.push({x:0,z:zt,cy:.1,r:0,tx:.38,w:1.2,d:1.1,h:.1,bounce:1,kind:'tramp'},...rails(zt+1.2,5.5,.5,.45));
    const b=new Tt();b.z=zt+6.9;b.dom().straight(4);c.it.push(...b.it);
    return{it:c.it,pr:c.pr,exits:[b.last()]};
  },
  seesaw(){
    const t=leadIn(3),it=t.it.slice(),zc=t.z+1.1;
    it.push({x:0,z:zc+.95,r:0,ty:'B',cy:.72,rest:.3});
    const pr=rails(zc+3.2,6.6,.55,.6);
    const b=new Tt();b.z=zc+10.2;b.dom().straight(4);it.push(...b.it);
    return{it,pr,fx:[{k:'cat',x:0,z:zc}],exits:[b.last()]};
  },
  wrecker(){
    const t=leadIn(3),it=t.it.slice(),L1=3.4,ang=55*Math.PI/180;
    const zA=t.z+.62+.4+L1*Math.sin(ang),yA=L1+.55;
    const bz=zA-L1*Math.sin(ang),by=yA-L1*Math.cos(ang);
    it.push({x:0,z:t.z+.62,r:0,ty:'T',y:0,ex:1});
    it.push({x:0,z:bz,r:0,ty:'WB',cy:by,ax:0,ay:yA,az:zA});
    const pr=[{x:-1.7,z:zA,r:0,w:.2,d:.2,h:yA+.3,kind:'post'},{x:1.7,z:zA,r:0,w:.2,d:.2,h:yA+.3,kind:'post'},{x:0,z:zA,r:0,w:3.6,d:.2,h:.2,y0:yA+.05,kind:'post'}];
    it.push({x:0,z:zA+.45,r:0,ty:'W',y:0});for(let r=0;r<6;r++)[-.9,-.3,.3,.9].forEach(x=>it.push({x,z:zA+.45+(r+1)*SP,r:0,ty:'n',y:0}));
    return{it,pr,exits:[]};
  },
  slow(){const t=new Tt();t.dom().straight(9);return{it:t.it,fx:[{k:'slow',x:0,z:SP*4.5,rad:1.1}],exits:[t.last()]}},
  rocket(){return finale('rocket')},bell(){return finale('bell')},trophy(){return finale('trophy')},fireworks(){return finale('fireworks')},
  pinata(){return finale('pinata')},discodrop(){return finale('discodrop')},coffin(){return finale('coffin')},ufo(){return finale('ufo')},volcano(){return finale('volcano')},
  bowling(){
    const c=climbRamp(1.05,3.4,.8),z1=c.end;c.pr.push(...rails(z1,1.6,.42,.16));
    const pz=z1+2.6;for(let r=0;r<4;r++)for(let i=0;i<=r;i++)c.it.push({x:(i-r/2)*.48,z:pz+r*.44,r:0,ty:'P',y:0,bn:'pin'});
    return{it:c.it,pr:c.pr,deco:[{k:'lane',x:0,z:z1+2,w:2.2,d:4.4}],exits:[]};
  },
  cards(){
    const t=leadIn(3),it=t.it.slice(),zT=t.z+.62;it.push({x:0,z:zT,r:0,ty:'T',y:0});
    const zc=zT+1.15,lean=.3,hy=.5*Math.cos(lean),dz=.5*Math.sin(lean)+.012;
    const frame=(x,y0)=>{it.push({x,z:zc-dz,r:0,ty:'C',cy:y0+hy+.003,tx:lean,bn:'col'},{x,z:zc+dz,r:0,ty:'C',cy:y0+hy+.003,tx:-lean,bn:'col'})};
    const top=2*hy+.02,flat=(x,y)=>it.push({x,z:zc,r:Math.PI/2,ty:'C',cy:y+.012,tx:Math.PI/2,bn:'col'});
    [-.8,0,.8].forEach(x=>frame(x,0));[-.4,.4].forEach(x=>flat(x,top));
    [-.4,.4].forEach(x=>frame(x,top+.024));flat(0,2*top+.024);frame(0,2*top+.05);
    return{it,exits:[]};
  },
  tower(){
    const t=new Tt();t.dom().straight(1);const zT=t.z+.62,it=t.it.slice();it.push({x:0,z:zT,r:0,ty:'T',y:0});
    const zc=zT+1.75;
    for(let l=0;l<7;l++){const y=l*.15;if(l%2===0)[-.26,.26].forEach(o=>it.push({x:0,z:zc+o,r:Math.PI/2,ty:'n',y,f:1,bn:'col'}));else[-.26,.26].forEach(o=>it.push({x:o,z:zc,r:0,ty:'n',y,f:1,bn:'col'}))}
    return{it,exits:[]};
  },
  pyramid(){
    const t=leadIn(3),it=t.it.slice();let z=t.z+SP;it.push({x:0,z,r:0,ty:'W',y:0});z+=SP;[-1.25,1.25].forEach(x=>it.push({x,z,r:0,ty:'W',y:0}));z+=SP*1.1;
    let y=0;for(let tier=5;tier>=1;tier--){
      for(let i=0;i<tier;i++)it.push({x:(i-(tier-1)/2),z,r:0,ty:'n',y,ex:1,bn:'col'});
      y+=1;if(tier>1){for(let i=0;i<tier-1;i++)it.push({x:(i-(tier-2)/2),z,r:Math.PI/2,ty:'n',y,f:1,bn:'col'});y+=.15}
    }
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
  dspiral(){
    // a left spiral winding out, then an S into a right spiral winding in
    const t=new Tt();t.dom();let R=1.45;const grow=1.05/(2*Math.PI);
    for(let i=0;i<200&&R<3.1;i++){const dh=SP/R;t.h+=dh/2;t.mv(SP);t.h+=dh/2;t.dom();R+=grow*dh}
    t.straight(3);
    for(let i=0;i<200&&R>1.45;i++){const dh=SP/R;t.h-=dh/2;t.mv(SP);t.h-=dh/2;t.dom();R-=grow*dh}
    return{it:t.it,exits:[]};
  },
  heart(){const t=new Tt();t.h=-40*Math.PI/180;t.dom().straight(6).turn(180,9).turn(-100,3).turn(180,9).straight(6);const it=trimClose(normalize(t.it),3);const l=it[it.length-1];return{it,exits:[{x:l.x,z:l.z,r:l.r}]}},
  star(){const t=new Tt();t.dom();for(let i=0;i<5;i++){t.straight(3).turn(144,6).straight(3).turn(-72,3)}const it=trimClose(t.it,3);const l=it[it.length-1];return{it,exits:[{x:l.x,z:l.z,r:l.r}]}},
  block(){
    const t=new Tt();t.dom().straight(1);const pz=plate(t);const it=t.it.slice();
    for(let r=0;r<8;r++)[-.9,-.3,.3,.9].forEach(x=>it.push({x,z:pz+SP*(r+1),r:0,ty:'n',y:0}));
    return{it,exits:[]};
  },
  mosaic(p){const g=emojiGrid(p||S.emoji);return fieldDef(14,12,(c,r)=>g[11-r][c])},
  name(p){const g=wordGrid(p||S.word);const rows=g.length,cols=g[0].length;return fieldDef(cols,rows,(c,r)=>g[rows-1-r][c])}
};
function ballRun(len){
  const t=new Tt();t.dom().straight(2);const zb=t.z+.62,it=t.it.slice();
  it.push({x:0,z:zb,r:0,ty:'B',y:0});
  const pr=rails(zb-.2,len,.45,.16);
  const b=new Tt();b.z=zb+len+.2;b.dom().straight(4);it.push(...b.it);
  return{it,pr,exits:[b.last()]};
}
const modCache={};
const modPrm=id=>id==='mosaic'?S.emoji:id==='name'?S.word:'';
function modDef(id,mirror,prm){
  if(prm==null)prm=modPrm(id);
  const key=id+(mirror?'m':'')+'|'+prm;if(modCache[key])return modCache[key];
  const b=BUILD[id](prm||undefined);
  return modCache[key]=mirrorDef({it:b.it,pr:b.pr||[],deco:b.deco||[],fx:b.fx||[],exits:b.exits},mirror);
}
function mirrorDef(def,mirror){
  if(!mirror)return def;
  const f=o=>{const r=Object.assign({},o,{x:-o.x,r:-(o.r||0)});if(o.ax!=null)r.ax=-o.ax;return r};
  return{it:def.it.map(f),pr:def.pr.map(f),deco:def.deco.map(f),fx:def.fx.map(f),exits:def.exits.map(f)};
}
function xform(def,ax,az,a){
  const c=Math.cos(a),s=Math.sin(a),T=(x,z)=>[ax+x*c+z*s,az-x*s+z*c];
  const m=o=>{const p=T(o.x,o.z),r=Object.assign({},o,{x:p[0],z:p[1],r:(o.r||0)+a});if(o.ax!=null){const q=T(o.ax,o.az);r.ax=q[0];r.az=q[1]}return r};
  return{it:def.it.map(m),pr:def.pr.map(m),deco:def.deco.map(m),fx:def.fx.map(m),exits:def.exits.map(m)};
}
// the inverse of xform: world items -> local def around anchor (ax,az) facing a
function localize(items,ax,az,a){
  const c=Math.cos(a),s=Math.sin(a),T=(x,z)=>{const dx=x-ax,dz=z-az;return[dx*c-dz*s,dx*s+dz*c]};
  return items.map(o=>{const p=T(o.x,o.z),r=Object.assign({},o,{x:p[0],z:p[1],r:(o.r||0)-a});for(const k in r)if(k[0]==='_'||k==='id'||k==='g'||k==='c')delete r[k];if(o.ax!=null){const q=T(o.ax,o.az);r.ax=q[0];r.az=q[1]}return r});
}
function stampCheck(w){
  const n=w.it.filter(isScored).length;
  if(n>L.budget-userCount())return'budget';
  for(const o of w.it)if(blockedAt(o.x,o.z,o.r,o.ty,o.cy!=null?Math.max(0,o.cy-.6):o.y||0,null,o.f))return'blocked';
  for(const o of w.fx){if(Math.abs(o.x)>L.fw/2-1||Math.abs(o.z)>L.fd/2-1)return'blocked';for(const e of L.d)if(Math.hypot(e.x-o.x,e.z-o.z)<(isFin(o.k)?1:.1))return'blocked';
    for(const q of L.deco)if(q.nogo&&inShape(o.x,o.z,q,.6))return'blocked'}
  for(const pr of w.pr){
    if(Math.abs(pr.x)>L.fw/2-.3||Math.abs(pr.z)>L.fd/2-.3)return'blocked';
    if(!(pr.y0>.3)&&pr.cy==null)for(const q of L.deco)if(q.nogo&&inShape(pr.x,pr.z,q,Math.min(pr.w,pr.d)/2))return'blocked';
    for(const e of L.d){if(vOver(e.y||0,pr)){for(const q of pointsOf(e.x,e.z,e.r,e.ty,e.f))if(inShape(q[0],q[1],pr,q[2]))return'blocked'}}
  }
  return'';
}
function stampCommit(id,w,meta){
  const gid='g'+L.uid++;const first=L.d.length;
  for(const o of w.it){const d=addDom(o.x,o.z,o.r,o.ty,o.y,gid,false,o.f);for(const k of ['cy','tx','col','ex','bn','rest','pivot','ax','ay','az'])if(o[k]!=null)d[k]=o[k]}
  for(const pr of w.pr)L.p.push(Object.assign({id:L.uid++,g:gid},pr));
  for(const d of w.deco)L.deco.push(Object.assign({g:gid},d));
  for(const f of w.fx)L.fx.push(Object.assign({id:L.uid++,g:gid},f));
  L.g[gid]=Object.assign({exits:[]},meta||{mod:id});
  for(const e of w.exits){let best=null,bd=1e9;for(let i=first;i<L.d.length;i++){const d=L.d[i];if(!isScored(d))continue;const dd=(d.x-e.x)**2+(d.z-e.z)**2;if(dd<bd){bd=dd;best=d}}if(best)L.g[gid].exits.push({x:e.x,z:e.z,r:e.r,id:best.id})}
  if(L.start==null&&!L.daily&&!L.level){const f=L.d.slice(first).find(isScored);if(f)L.start=f.id}
  dirty=true;return gid;
}
function endsList(){
  const out=[],alive=new Set(L.d.map(d=>d.id));
  for(const g in L.g)for(const e of L.g[g].exits)if(alive.has(e.id))out.push(e);
  const s=L.d.find(d=>d.lock);if(s)out.push({x:s.x,z:s.z,r:s.r,id:s.id});
  return out;
}
function nearestEnd(p,rad){let b=null,bd=rad*rad;for(const e of endsList()){const d=(e.x-p.x)**2+(e.z-p.z)**2;if(d<bd){bd=d;b=e}}return b}

/* ------------------------------ finales ------------------------------ */
const M=(c,o)=>new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.5},o||{}));
const gold=()=>M(0xffc83a,{metalness:.85,roughness:.25,emissive:0x3a2400});
function lathe(pts,mat,seg){return new THREE.Mesh(new THREE.LatheGeometry(pts.map(p=>new THREE.Vector2(p[0],p[1])),seg||24),mat)}
function batTex(){return canvasTex(64,32,g=>{g.fillStyle='#120a18';g.beginPath();g.moveTo(32,12);g.quadraticCurveTo(20,0,2,6);g.quadraticCurveTo(10,10,8,18);g.quadraticCurveTo(16,14,20,22);g.quadraticCurveTo(26,16,32,24);g.quadraticCurveTo(38,16,44,22);g.quadraticCurveTo(48,14,56,18);g.quadraticCurveTo(54,10,62,6);g.quadraticCurveTo(44,0,32,12);g.fill();g.fillStyle='#ff3030';g.fillRect(28,12,3,2);g.fillRect(33,12,3,2)})}
let _batT=null;
function finBase(goal){
  const g=new THREE.Group(),pad=new THREE.Mesh(new THREE.CylinderGeometry(.9,1,.14,32),M(0x3a3a48,{metalness:.5,roughness:.4}));pad.position.y=.07;pad.receiveShadow=true;
  const glow=new THREE.Mesh(new THREE.RingGeometry(1.05,1.3,40),new THREE.MeshBasicMaterial({color:goal?0x6bf2b0:0xffb347,transparent:true,opacity:.85,side:THREE.DoubleSide}));glow.rotation.x=-Math.PI/2;glow.position.y=.03;
  g.add(pad,glow);g.userData={glow};return g;
}
const FIN={
  rocket:{name:'Rocket',dur:3.2,mesh(g,u){
      const r=new THREE.Group(),wm=M(0xf2f2f8,{metalness:.3,roughness:.35}),rm=M(0xff3a5a,{roughness:.4});
      const body=new THREE.Mesh(new THREE.CylinderGeometry(.24,.28,1.2,20),wm);body.position.y=.6;const nose=new THREE.Mesh(new THREE.ConeGeometry(.24,.5,20),rm);nose.position.y=1.45;
      const win=new THREE.Mesh(new THREE.CircleGeometry(.1,16),M(0x58b8ff,{emissive:0x2266aa}));win.position.set(0,.85,.245);
      r.add(body,nose,win);for(let i=0;i<3;i++){const f=new THREE.Mesh(unitBox,rm);f.scale.set(.04,.4,.3);const a=i*Math.PI*2/3;f.position.set(Math.sin(a)*.3,.22,Math.cos(a)*.3);f.rotation.y=a;r.add(f)}
      r.position.y=.14;g.add(r);u.rocket=r},
    fire(s){noise(1.4,300,3000,.12,'bandpass');burst(fxN,s.x,.2,s.z,30,'#dddddd',3,1.4,.5,-.5,1);s.vy=0},
    tick(s,dt){const r=s.u.rocket;if(s.t<1.25){s.vy+=18*dt;r.position.y+=s.vy*dt;r.rotation.y+=dt*4;const y=r.position.y;s.fy=y;
        for(let i=0;i<4;i++){fxG.spawn(s.x+(Math.random()-.5)*.15,y,s.z+(Math.random()-.5)*.15,(Math.random()-.5)*1.2,-4-Math.random()*3,(Math.random()-.5)*1.2,.5,1,.55+Math.random()*.4,.15,1,.22,0);fxN.spawn(s.x,y-.2,s.z,(Math.random()-.5)*1.5,-1,(Math.random()-.5)*1.5,1.6,.75,.75,.78,.5,.45,-.4)}}
      else if(!s.boom){s.boom=1;r.visible=false;fireworkBurst(s.x,r.position.y,s.z,3)}}},
  fireworks:{name:'Fireworks',dur:4.2,mesh(g,u){u.tubes=[];for(let i=0;i<5;i++){const a=(i-2)*.45,t=new THREE.Mesh(new THREE.CylinderGeometry(.12,.14,.6,12),M([0xff3a5a,0xffb347,0x58b8ff,0x6bf2b0,0xc58bff][i]));t.position.set(Math.sin(a)*.55,.42,Math.cos(a)*.55-.2);t.rotation.x=-a*.15;t.rotation.z=-a*.5;g.add(t);u.tubes.push(t)}},
    fire(s){s.shells=[];s.next=0},
    tick(s,dt){while(s.next<5&&s.t>s.next*.38){const tb=s.u.tubes[s.next];s.shells.push({x:s.x+tb.position.x,y:.7,z:s.z+tb.position.z,vx:tb.position.x*2,vy:13+Math.random()*3,vz:(Math.random()-.5),c:FIRE[s.next%6]});noise(.3,800,3000,.08);s.next++}
      for(const sh of s.shells){if(sh.done)continue;sh.vy-=9*dt;sh.x+=sh.vx*dt;sh.y+=sh.vy*dt;sh.z+=sh.vz*dt;_col.set(sh.c);fxG.spawn(sh.x,sh.y,sh.z,0,-1,0,.4,_col.r,_col.g,_col.b,1,.18,0);s.fy=Math.max(s.fy||0,sh.y*.8);
        if(sh.vy<2){sh.done=1;fireworkBurst(sh.x,sh.y,sh.z,1,sh.c)}}}},
  bell:{name:'Bell',dur:3,mesh(g,u){const wd=M(0x6a4a2a,{roughness:.8});[-1,1].forEach(s=>{const p=new THREE.Mesh(unitBox,wd);p.scale.set(.16,2.8,.16);p.position.set(s*.85,1.4,0);g.add(p)});
      const bm=new THREE.Mesh(unitBox,wd);bm.scale.set(1.9,.18,.2);bm.position.y=2.8;g.add(bm);
      const piv=new THREE.Group();piv.position.y=2.7;const bell=lathe([[0,0],[.12,-.02],[.2,-.2],[.25,-.5],[.38,-.8],[.5,-.9],[.5,-.95],[0,-.95]],gold(),32);piv.add(bell);
      const cl=new THREE.Mesh(new THREE.SphereGeometry(.09,12,8),M(0x333333));cl.position.y=-.85;piv.add(cl);g.add(piv);u.piv=piv},
    fire(s){bellSound();s.ring=0},
    tick(s,dt){s.u.piv.rotation.x=Math.sin(s.t*9)*.5*Math.exp(-s.t*1.1);s.fy=1.8;
      if(s.t>s.ring*.45&&s.ring<4){s.ring++;for(let i=0;i<36;i++){const a=i/36*Math.PI*2;fxG.spawn(s.x,2.1,s.z,Math.cos(a)*5,0,Math.sin(a)*5,.7,1,.85,.4,1,.2,0)}}}},
  trophy:{name:'Trophy',dur:3,mesh(g,u){const ped=new THREE.Mesh(new THREE.CylinderGeometry(.45,.55,.5,24),M(0x2a2440,{metalness:.4}));ped.position.y=.25;g.add(ped);
      const cup=new THREE.Group();const gm=gold();cup.add(lathe([[0,0],[.32,0],[.32,.06],[.1,.12],[.07,.4],[.1,.45],[.38,.62],[.42,1.05],[.36,1.05],[.33,.66],[0,.5]],gm,32));
      [-1,1].forEach(s2=>{const h=new THREE.Mesh(new THREE.TorusGeometry(.18,.04,8,20,Math.PI),gm);h.position.set(s2*.4,.8,0);h.rotation.z=s2>0?-Math.PI/2:Math.PI/2;cup.add(h)});
      cup.position.y=.5;g.add(cup);u.cup=cup;
      const beam=new THREE.Mesh(new THREE.CylinderGeometry(.3,1.4,7,24,1,true),new THREE.MeshBasicMaterial({color:0xfff2b0,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));beam.position.y=3.5;g.add(beam);u.beam=beam},
    fire(s){fanfare()},
    tick(s,dt){const k=Math.min(1,s.t/1.1),e=1-Math.pow(1-k,3);s.u.cup.position.y=.5+e*1.6;s.u.cup.rotation.y+=dt*3;s.u.beam.material.opacity=Math.min(.18,s.t*.3);s.fy=1.6;
      if(!s.c1&&s.t>.9){s.c1=1;burst(fxN,s.x,2.6,s.z,90,FIRE,5,2.6,.16,5,1);burst(fxG,s.x,2.4,s.z,40,'#ffe08a',4,1,.2,1)}}},
  pinata:{name:'Piñata',dur:3,mesh(g,u){const wd=M(0x6a4a2a);const post=new THREE.Mesh(unitBox,wd);post.scale.set(.15,3.4,.15);post.position.set(1.3,1.7,0);g.add(post);const arm=new THREE.Mesh(unitBox,wd);arm.scale.set(1.45,.12,.12);arm.position.set(.6,3.35,0);g.add(arm);
      const piv=new THREE.Group();piv.position.y=3.3;const rope=new THREE.Mesh(unitCyl,M(0xd8c8a0));rope.scale.set(.02,1,.02);rope.position.y=-.5;piv.add(rope);
      const st=new THREE.Group();st.position.y=-1.4;const cs=[0xff3fa0,0xffd23f,0x3fd6ff,0x7cf2a0,0xb07cff,0xff7a1a];st.add(new THREE.Mesh(new THREE.SphereGeometry(.42,20,14),M(0xff4f9a,{roughness:.8})));
      for(let i=0;i<6;i++){const c=new THREE.Mesh(new THREE.ConeGeometry(.16,.55,12),M(cs[i],{roughness:.8}));const v=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]][i];c.position.set(v[0]*.55,v[1]*.55,v[2]*.55);c.lookAt(v[0]*2,v[1]*2,v[2]*2);c.rotateX(Math.PI/2);st.add(c)}
      piv.add(st);g.add(piv);u.piv=piv;u.star=st},
    fire(s){noise(.25,600,200,.1)},
    tick(s,dt){s.fy=1.8;if(s.t<.7){s.u.piv.rotation.z=Math.sin(s.t*22)*.5;s.u.piv.rotation.x=Math.cos(s.t*17)*.3}
      else if(!s.pop){s.pop=1;s.u.star.visible=false;burst(fxN,s.x,1.9,s.z,120,FIRE,6,2.4,.16,9,1);burst(fxG,s.x,1.9,s.z,40,'#ffffff',5,.8,.2,2);noise(.5,3000,400,.25,'highpass');setTimeout(chime,100);shake=Math.max(shake,.3)}}},
  discodrop:{name:'Disco Drop',dur:3.6,mesh(g,u){const ped=new THREE.Mesh(new THREE.CylinderGeometry(.45,.6,.6,24),M(0x1a1030,{emissive:0x5a1a9a,emissiveIntensity:.6}));ped.position.y=.3;g.add(ped);
      const ball=new THREE.Mesh(new THREE.IcosahedronGeometry(.55,2),M(0xffffff,{metalness:1,roughness:.12,flatShading:true,emissive:0x332244}));ball.position.y=5.5;g.add(ball);
      const str=new THREE.Mesh(unitCyl,M(0x444444));str.scale.set(.015,4,.015);str.position.y=8;g.add(str);u.ball=ball;u.str=str;
      u.lasers=[];for(let i=0;i<10;i++){const l=new THREE.Mesh(unitBox,new THREE.MeshBasicMaterial({color:new THREE.Color().setHSL(i/10,1,.55),transparent:true,opacity:.7,blending:THREE.AdditiveBlending,depthWrite:false}));l.scale.set(.04,.04,9);l.visible=false;g.add(l);u.lasers.push(l)}},
    fire(s){discoSound()},
    tick(s,dt){const u=s.u,k=Math.min(1,s.t/.8);const b=k<1?1-Math.abs(Math.cos(k*Math.PI*1.5))*(1-k):1;u.ball.position.y=5.5-(5.5-1.15)*Math.min(1,b);u.str.visible=false;u.ball.rotation.y+=dt*3;s.fy=1.4;
      if(s.t>.8){if(!s.fl){s.fl=1;flash(.35,'#ff4fd8');shake=Math.max(shake,.3)}u.lasers.forEach((l,i)=>{l.visible=s.t<3.3;const a=s.t*1.6+i/10*Math.PI*2;l.rotation.set(0,a,0);l.rotateX(-.12-Math.sin(s.t*2+i)*.15);l.position.set(0,1.15,0);l.translateZ(4.6)})
        if(Math.random()<.6){_col.setHSL(Math.random(),1,.6);fxG.spawn(s.x+(Math.random()-.5)*6,Math.random()*3,s.z+(Math.random()-.5)*6,0,.3,0,.8,_col.r,_col.g,_col.b,1,.15,0)}}}},
  coffin:{name:'Coffin',dur:3.4,mesh(g,u){const wd=M(0x3a2214,{roughness:.7});const box=new THREE.Mesh(unitBox,wd);box.scale.set(1.8,.45,.75);box.position.y=.36;g.add(box);
      const piv=new THREE.Group();piv.position.set(0,.6,-.38);const lid=new THREE.Mesh(unitBox,M(0x4a2a18,{roughness:.6}));lid.scale.set(1.86,.1,.8);lid.position.set(0,0,.4);piv.add(lid);
      const cr=new THREE.Group();[[0,.06,.4,.12,.02,.5],[0,.06,.3,.4,.02,.1]].forEach(a=>{const m=new THREE.Mesh(unitBox,M(0xd8c8a0));m.position.set(a[0],a[1],a[2]);m.scale.set(a[3],a[4],a[5]);cr.add(m)});piv.add(cr);g.add(piv);u.piv=piv},
    fire(s){creak();s.bats=[]},
    tick(s,dt){s.u.piv.rotation.x=-Math.min(1,s.t/.8)*1.9;s.fy=1.2;
      if(s.t>.45&&s.bats.length<18){if(!_batT)_batT=batTex();for(let i=0;i<3;i++){const b=new THREE.Sprite(new THREE.SpriteMaterial({map:_batT,transparent:true,depthWrite:false}));b.scale.set(.5,.25,1);b.position.set(s.x,.6,s.z);markGroup.add(b);s.bats.push({b,a:Math.random()*7,v:2+Math.random()*2,r:.3})}if(s.bats.length%6===0)tone(2400,3200,.08,.04,'square')}
      for(const o of s.bats){o.a+=dt*3;o.r+=dt*1.2;o.b.position.set(s.x+Math.cos(o.a)*o.r,o.b.position.y+o.v*dt,s.z+Math.sin(o.a)*o.r);o.b.scale.set(.5*(.6+.4*Math.abs(Math.sin(s.t*20+o.a))),.25,1);if(s.t>3.2)o.b.visible=false}
      if(Math.random()<.3)fxG.spawn(s.x+(Math.random()-.5),.6,s.z+(Math.random()-.5)*.5,0,.6,0,1.4,.3,.9,.4,.5,.5,0)}},
  ufo:{name:'UFO',dur:3.2,mesh(g,u){const sh=new THREE.Group();sh.position.y=4.2;const disc=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.35,.28,32),M(0xb8c0d0,{metalness:.8,roughness:.25}));
      const dome=new THREE.Mesh(new THREE.SphereGeometry(.55,24,12,0,Math.PI*2,0,Math.PI/2),M(0x7fe8ff,{transparent:true,opacity:.7,emissive:0x1a6a8a}));dome.position.y=.12;sh.add(disc,dome);
      for(let i=0;i<10;i++){const l=new THREE.Mesh(new THREE.SphereGeometry(.07,8,6),new THREE.MeshBasicMaterial({color:new THREE.Color().setHSL(i/10,1,.6)}));const a=i/10*Math.PI*2;l.position.set(Math.cos(a)*1.2,-.05,Math.sin(a)*1.2);sh.add(l)}
      g.add(sh);u.ship=sh;const beam=new THREE.Mesh(new THREE.CylinderGeometry(.6,1.1,4,24,1,true),new THREE.MeshBasicMaterial({color:0x9fffb0,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));beam.position.y=2.1;g.add(beam);u.beam=beam;
      const cow=new THREE.Mesh(unitBox,M(0xffd23f,{metalness:.5,emissive:0x3a2a00}));cow.scale.set(.5,1,.15);cow.position.y=.64;g.add(cow);u.cargo=cow;
      u.idle=(t)=>{sh.position.y=4.2+Math.sin(t*2)*.12;sh.rotation.y=t*.8}},
    fire(s){theremin()},
    tick(s,dt){const u=s.u;u.beam.material.opacity=s.t<1.9?Math.min(.35,s.t*.8):Math.max(0,.35-(s.t-1.9)*1.5);s.fy=2.4;
      if(s.t>.4&&s.t<1.9){u.cargo.position.y=.64+(s.t-.4)/1.5*3.3;u.cargo.rotation.y+=dt*6;u.cargo.rotation.x+=dt*2}else if(s.t>=1.9)u.cargo.visible=false;
      if(s.t>2.1){u.ship.position.y+=dt*(8+(s.t-2.1)*30);u.ship.position.x+=dt*4}else{u.ship.position.y=4.2+Math.sin(s.t*2)*.12;u.ship.rotation.y+=dt*4}
      if(Math.random()<.5)fxG.spawn(s.x+(Math.random()-.5)*1.2,Math.random()*4,s.z+(Math.random()-.5)*1.2,0,1.5,0,.8,.6,1,.7,.8,.12,0)}},
  volcano:{name:'Volcano',dur:3.6,mesh(g,u){const c=new THREE.Mesh(new THREE.CylinderGeometry(.35,1,1.5,14,1,true),M(0x4a2a1e,{roughness:.95,flatShading:true,side:THREE.DoubleSide}));c.position.y=.75;g.add(c);
      const lava=new THREE.Mesh(new THREE.CircleGeometry(.34,16),new THREE.MeshBasicMaterial({color:0xff6a1a}));lava.rotation.x=-Math.PI/2;lava.position.y=1.45;g.add(lava);
      u.idle=(t,x,z)=>{if(Math.random()<.08)fxN.spawn(x+(Math.random()-.5)*.3,1.5,z+(Math.random()-.5)*.3,0,.6,0,2.5,.35,.33,.33,.5,.35,-.05)}},
    fire(s){noise(2.5,180,40,.35,'lowpass');shake=Math.max(shake,.6)},
    tick(s,dt){s.fy=2.6;if(s.t<2.8){for(let i=0;i<8;i++){const a=Math.random()*7,v=1+Math.random()*1.8;fxG.spawn(s.x,1.5,s.z,Math.cos(a)*v,7+Math.random()*5,Math.sin(a)*v,1.6,1,.3+Math.random()*.5,.05,1,.22,9)}
        fxN.spawn(s.x,1.8,s.z,(Math.random()-.5),2.5,(Math.random()-.5),3,.25,.22,.22,.6,.8,-.1);shake=Math.max(shake,.12)}}}
};
function fireworkBurst(x,y,z,n,c0){for(let j=0;j<n;j++){const c=c0||FIRE[Math.floor(Math.random()*6)],c2=FIRE[Math.floor(Math.random()*6)];burst(fxG,x+(n>1?(Math.random()-.5)*3:0),y+(n>1?(Math.random()-.5)*2:0),z+(n>1?(Math.random()-.5)*3:0),70,i=>i%2?c:c2,9,1.6,.3,6)}
  burst(fxN,x,y,z,40,FIRE,7,3,.18,5);noise(.9,900,80,.25,'lowpass');setTimeout(chime,120);shake=Math.max(shake,.4);if(!demo)flash(.2)}

/* ------------------------------ render sync ------------------------------ */
const _c=new THREE.Color(),_q2=new THREE.Quaternion();
function poseOf(d){
  const t=TY[d.ty];
  if(t.ball){pos.set(d.x,d.cy!=null?d.cy:(d.y||0)+t.r+.002,d.z);quat.identity();return}
  quat.setFromAxisAngle(yAxis,d.r);
  if(d.tx){_q2.setFromAxisAngle(xAxis,d.tx);quat.multiply(_q2)}
  if(d.cy!=null){pos.set(d.x,d.cy,d.z);return}
  if(t.pin){pos.set(d.x,(d.y||0)+t.h/2,d.z);return}
  if(d.f){quat.multiply(qFlat);pos.set(d.x,(d.y||0)+t.t/2,d.z)}else pos.set(d.x,(d.y||0)+t.h/2,d.z);
}
function baseColor(d,out){
  if(d.col!=null)return out.setHex(d.col);
  if(d.ty==='B'||d.ty==='b')return out.setRGB(.85,.88,.95);if(d.ty==='WB')return out.setRGB(.25,.25,.3);
  if(d.ty==='P')return out.setRGB(1,1,1);if(d.ty==='C')return out.setHSL((d.c*.07)%1,.15,.95);if(d.ty==='K')return out.setRGB(.62,.42,.25);
  skinColor(d.c,out);if(d.f)out.multiplyScalar(.82);return out;
}
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
const PROPM={stone:M(0x9a8fb4,{roughness:.85}),rail:M(0xc0c4d0,{metalness:.6,roughness:.3}),ramp:M(0xd0a060,{roughness:.6}),deck:M(0x8a6a4a,{roughness:.7}),post:M(0x5a4a3a,{roughness:.8}),tramp:M(0x2a8aff,{roughness:.4,emissive:0x0a2a6a})};
let fxMeshes=[],targetMeshes=[],ropes=[],obstFor=null;const fxCache=new Map();
function slowMesh(o){
  const t=canvasTex(256,256,g=>{g.fillStyle='rgba(60,140,255,.35)';g.beginPath();g.arc(128,128,124,0,7);g.fill();g.strokeStyle='#9fd0ff';g.lineWidth=6;g.stroke();
    for(let i=0;i<12;i++){const a=i*Math.PI/6;g.beginPath();g.moveTo(128+Math.cos(a)*100,128+Math.sin(a)*100);g.lineTo(128+Math.cos(a)*118,128+Math.sin(a)*118);g.stroke()}
    g.fillStyle='#e8f4ff';g.font='bold 40px system-ui';g.textAlign='center';g.fillText('SLOW',128,142)});
  const m=new THREE.Mesh(unitCircle,new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false}));m.scale.set(o.rad||1.1,o.rad||1.1,1);m.rotation.x=-Math.PI/2;m.position.y=.02;m.userData.slow=1;return m;
}
function catMesh(){
  const g=new THREE.Group(),wd=M(0x6a4a2a,{roughness:.8}),mt=M(0x555560,{metalness:.6,roughness:.4});
  const base=new THREE.Mesh(unitBox,wd);base.scale.set(.9,.2,.9);base.position.y=.1;g.add(base);
  [-1,1].forEach(s2=>{const p=new THREE.Mesh(unitBox,wd);p.scale.set(.1,.5,.25);p.position.set(s2*.3,.45,0);g.add(p)});
  const piv=new THREE.Group();piv.position.y=.5;const arm=new THREE.Mesh(unitBox,wd);arm.scale.set(.14,.1,1.05);arm.position.z=.5;piv.add(arm);
  const cup=lathe([[0,0],[.16,.02],[.22,.12],[.24,.16]],mt,16);cup.position.set(0,.03,.95);piv.add(cup);
  piv.rotation.x=.12;g.add(piv);g.userData={piv};return g;
}
function fxMesh(o){
  if(o.k==='slow')return slowMesh(o);
  if(o.k==='cat')return catMesh();
  const g=finBase(o.goal);FIN[o.k].mesh(g,g.userData);g.traverse(c=>{if(c.isMesh)c.castShadow=true});return g;
}
function resetFxCache(){fxCache.forEach(m=>{markGroup.remove(m);m.traverse(c=>{if(c.geometry&&c.geometry!==unitBox&&c.geometry!==unitCyl&&c.geometry!==unitCircle)c.geometry.dispose()})});fxCache.clear()}
function refresh(){
  const cnt={};for(const k in TY)cnt[k]=0;
  for(const d of L.d){
    const k=d.ty,i=cnt[k]++;d._i=i;poseOf(d);mat4.compose(pos,quat,one);inst[k].setMatrixAt(i,mat4);
    d._col=baseColor(d,d._col||new THREE.Color());inst[k].setColorAt(i,d._col);
  }
  for(const k in TY){inst[k].count=cnt[k];inst[k].instanceMatrix.needsUpdate=true;if(inst[k].instanceColor)inst[k].instanceColor.needsUpdate=true}
  clearGroup(propGroup);
  L.p.forEach(o=>{const e=new THREE.Mesh(unitBox,o.rail?PROPM.rail:PROPM[o.kind]||stepMat);propPose(o,e);e.scale.set(o.w,o.h,o.d);e.castShadow=e.receiveShadow=true;propGroup.add(e)});
  ropes=L.d.filter(d=>d.ay!=null).map(d=>{const m=new THREE.Mesh(unitCyl,PROPM.rail);m.castShadow=true;propGroup.add(m);return{d,m}});ropes.forEach(r=>updRope(r,null));
  if(obstFor!==L.f){obstFor=L.f;clearGroup(obstGroup);
    L.f.forEach(o=>{const m=(OBST[o.kind]||OBST.block)(o);m.position.x=o.x;m.position.z=o.z;m.rotation.y=o.r||0;m.traverse(c=>{if(c.isMesh){c.castShadow=c.receiveShadow=true}});obstGroup.add(m)})}
  clearGroup(decoGroup);
  L.deco.forEach(o=>{
    const mt=o.k==='lane'?PROPM.deck:o.k==='gap'?(theme.haz==='lava'?hazMat:hazMatGap):hazMat;
    let e;if(o.rad){e=new THREE.Mesh(unitCircle,mt);e.scale.set(o.rad,o.rad,1);e.rotation.x=-Math.PI/2;e.position.set(o.x,.016,o.z);
      if(theme.haz==='hole'&&o.k!=='gap'){const ring=new THREE.Mesh(new THREE.RingGeometry(o.rad,o.rad*1.45,48),new THREE.MeshBasicMaterial({color:0xa050ff,transparent:true,opacity:.55,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.set(o.x,.02,o.z);ring.userData.spin=1;decoGroup.add(ring)}}
    else{e=new THREE.Mesh(unitBox,mt);e.position.set(o.x,o.k==='lane'?.008:.015,o.z);e.rotation.y=o.r||0;e.scale.set(o.w,o.k==='lane'?.016:.03,o.d)}
    e.receiveShadow=true;decoGroup.add(e)});
  markGroup.children.slice().forEach(c=>{if(!c.userData.fxid)markGroup.remove(c)});targetMeshes=[];
  L.targets.forEach(t=>{const g=new THREE.Group(),col=theme.ring;
    const ring=new THREE.Mesh(new THREE.RingGeometry(t.r-.22,t.r,40),new THREE.MeshBasicMaterial({color:col,side:THREE.DoubleSide,transparent:true,opacity:.95}));
    const disc=new THREE.Mesh(new THREE.CircleGeometry(t.r-.22,40),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.3,side:THREE.DoubleSide}));
    ring.rotation.x=disc.rotation.x=-Math.PI/2;ring.position.y=.04;disc.position.y=.035;g.add(ring,disc);g.position.set(t.x,0,t.z);g.userData={ring,disc};markGroup.add(g);targetMeshes.push(g)});
  const live=new Set();fxMeshes=L.fx.map(o=>{const key=o.id+':'+o.k+':'+(o.goal?1:0);live.add(key);let m=fxCache.get(key);
    if(!m){m=fxMesh(o);m.userData.fxid=key;fxCache.set(key,m);markGroup.add(m)}m.position.x=o.x;m.position.z=o.z;m.rotation.y=(o.r||0);return m});
  fxCache.forEach((m,k)=>{if(!live.has(k)){markGroup.remove(m);fxCache.delete(k)}});
  dirty=false;
}
const _pq=new THREE.Quaternion();
function propPose(o,e){e.position.set(o.x,o.cy!=null?o.cy:(o.y0||0)+o.h/2,o.z);e.quaternion.setFromAxisAngle(yAxis,o.r||0);if(o.tx){_pq.setFromAxisAngle(xAxis,o.tx);e.quaternion.multiply(_pq)}}
function updRope(r,tr){const d=r.d,bx=tr?tr.x:d.x,by=tr?tr.y:d.cy,bz=tr?tr.z:d.z;const a=new V3(d.ax,d.ay,d.az),b=new V3(bx,by,bz),dir=b.clone().sub(a);const len=dir.length();
  r.m.scale.set(.035,len,.035);r.m.position.copy(a).addScaledVector(dir,.5);r.m.quaternion.setFromUnitVectors(yAxis,dir.normalize())}

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
function partial(f,t0,dur,vol,type){const t=AC.currentTime+t0,o=AC.createOscillator(),g=AC.createGain();o.type=type||'sine';o.frequency.value=f;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(AC.destination);o.start(t);o.stop(t+dur+.05)}
function bellSound(){if(!ok())return;[[1,.2,3],[2.4,.09,2],[3,.07,1.6],[4.5,.05,1.2],[5.2,.04,.9],[.5,.1,3.5]].forEach(p=>partial(220*p[0],0,p[2],p[1]))}
function fanfare(){if(!ok())return;[[0,0],[4,.14],[7,.28],[12,.42],[7,.6],[12,.72]].forEach(n=>partial(392*Math.pow(2,n[0]/12),n[1],.35,.1,'triangle'))}
function discoSound(){if(!ok())return;for(let i=0;i<8;i++)partial(196*Math.pow(2,[0,7,12,16,19,16,12,7][i]/12),i*.12,.2,.08,'square');noise(.4,8000,3000,.06,'highpass')}
function creak(){if(!ok())return;tone(90,60,1,.12,'sawtooth');tone(140,90,.8,.05,'square');setTimeout(()=>tone(520,180,1.4,.06,'sine'),500)}
function theremin(){if(!ok())return;const t=AC.currentTime,o=AC.createOscillator(),l=AC.createOscillator(),lg=AC.createGain(),g=AC.createGain();o.frequency.setValueAtTime(500,t);o.frequency.linearRampToValueAtTime(900,t+2.5);l.frequency.value=7;lg.gain.value=25;l.connect(lg);lg.connect(o.frequency);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.07,t+.2);g.gain.exponentialRampToValueAtTime(.0001,t+3);o.connect(g);g.connect(AC.destination);o.start(t);l.start(t);o.stop(t+3.1);l.stop(t+3.1)}
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
function flash(a,c){const f=$('flash');f.style.background=c||'#fff';f.style.transition='none';f.style.opacity=a;requestAnimationFrame(()=>{f.style.transition='opacity .6s';f.style.opacity=0})}
function dayKey(off){const d=new Date();if(off)d.setUTCDate(d.getUTCDate()+off);return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0')}
function modIcon(id){
  const b=modDef(id,false);let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;
  const all=b.it.concat(b.fx.map(o=>({x:o.x,z:o.z,r:0,ty:'fx',k:o.k})));
  all.forEach(o=>{x0=Math.min(x0,o.x);x1=Math.max(x1,o.x);z0=Math.min(z0,o.z);z1=Math.max(z1,o.z)});
  const w=x1-x0+1.4,h=z1-z0+1.4,sc2=Math.min(34/w,28/h);let s='';
  all.forEach(o=>{const px=17+(o.x-(x0+x1)/2)*sc2,py=14-(o.z-(z0+z1)/2)*sc2;
    if(o.ty==='fx'&&o.k!=='rocket'&&o.k!=='slow'){s+=`<text x="${px}" y="${py+4}" font-size="12" text-anchor="middle">${FIN_ICON[o.k]||'🎯'}</text>`;return}
    if(o.ty==='fx'){s+=o.k==='rocket'?`<path d="M${px} ${py-6}l3 5v6h-6v-6z" fill="#ff5e8a"/>`:`<circle cx="${px}" cy="${py}" r="${1.1*sc2}" fill="none" stroke="#7fc0ff" stroke-width="1.2"/>`;return}
    if(TY[o.ty].ball){s+=`<circle cx="${px}" cy="${py}" r="${Math.max(1.4,TY[o.ty].r*sc2)}" fill="#cfd6ff"/>`;return}
    if(o.ty==='P'){s+=`<circle cx="${px}" cy="${py}" r="${Math.max(1,.14*sc2)}" fill="#fff"/>`;return}
    const ty=TY[o.ty],tw=(o.f?.5:ty.w)*sc2,th=o.f?Math.max(1.4,1*sc2):Math.max(1.4,ty.t*sc2*(o.ty==='K'?1:1.4));
    s+=`<rect x="${-tw/2}" y="${-th/2}" width="${tw}" height="${th}" rx=".6" transform="translate(${px} ${py}) rotate(${o.r*180/Math.PI})" fill="${o.f?'#c9a0ff':'#ffd9a0'}"/>`});
  return`<svg viewBox="0 0 34 28">${s}</svg>`;
}

/* ------------------------------ state ------------------------------ */
let mode='menu',kind='free',demo=false,tool='draw',stamp={id:'straight'},trayCat='paths',pend=null;
function setMode(m){
  mode=m;
  $('menu').classList.toggle('hide',m!=='menu');
  $('levels').classList.toggle('hide',m!=='levels');
  $('hudBuild').classList.toggle('hide',m!=='build');
  $('hudPlay').classList.toggle('hide',!(m==='play'||m==='result'));
  if(m!=='build')tip(null);
}
const FIN_ICON={cat:'🏹',rocket:'🚀',bell:'🔔',trophy:'🏆',fireworks:'🎆',pinata:'🪅',discodrop:'🪩',coffin:'⚰️',ufo:'🛸',volcano:'🌋'};
function objText(live){
  if(!L.level&&!L.daily)return'';
  const hit=live&&P?L.targets.filter(t=>t.hit).length:0,goal=L.fx.find(o=>o.goal);
  const parts=[];if(goal)parts.push(FIN_ICON[goal.k]+' '+(live&&P&&P.goal?'✔':FIN[goal.k].name.toLowerCase()));if(L.targets.length)parts.push('🎯 '+(live?hit+'/':'')+L.targets.length);
  if(discoTiles&&live&&P)parts.push('🪩 '+P.tiles);
  return parts.join(' · ');
}
function updHud(){
  const used=userCount();
  const title=L.level?`${WORLDS[L.level.w].icon} ${WORLDS[L.level.w].name} ${L.level.w+1}-${L.level.l+1}`:L.daily?'Daily · '+L.daily.key:'Freestyle';
  $('cnt').innerHTML=`<small>${title}</small>${used} / ${L.budget===Infinity?'∞':L.budget}${(L.level||L.daily)?`<span id="obj">${objText(false)}${L.level?' · ✨ no stragglers':''}</span>`:''}`;
  $('bUndo').disabled=!undoStack.length&&!pend;
  $('bSnd').style.opacity=S.snd?1:.4;
  renderOpts();
}
function kitHas(id){return BASIC[id]||!L.kit||(L.kit[id]!=null)}
function modAvail(m){return (L.kit?kitHas(m.id):S.pts>=m.at)}
function kitLeft(id){return L.kit&&L.kit[id]!=null?L.kit[id]:Infinity}
function renderOpts(){
  const o=$('opts');
  document.querySelectorAll('#tools [data-tool]').forEach(b=>b.classList.toggle('on',b.dataset.tool===tool));
  o.classList.toggle('col',tool==='stamp');
  if(tool==='draw'){
    o.innerHTML=`<span class="lbl">Tight</span><input id="gapR" type="range" min="45" max="85" value="${Math.round(S.gap*100)}"><span class="lbl">Wide</span>`;
    $('gapR').oninput=e=>{S.gap=e.target.value/100;saveS()};
  }else if(tool==='stamp'&&pend){
    const m=MODS.find(m=>m.id===pend.id);
    o.innerHTML=`<div class="pendhd"><b>${pend.id==='mosaic'?S.emoji+' ':''}${pend.id==='name'?S.word+' · ':''}${m?m.name:'Your line'}</b><span class="muted">${pend.ok?'Drag to move · twist the ring to turn':'<span class="badtxt">'+(pend.err==='budget'?'Not enough dominos':pend.err==='kit'?'None left of this piece':'Blocked here, move it')+'</span>'}</span></div>
    <div class="pendbar"><button class="btn sq" id="pRL" aria-label="Rotate left">⟲</button><button class="btn sq" id="pRR" aria-label="Rotate right">⟳</button><button class="btn sq ${pend.mirror?'on':''}" id="pMir" aria-label="Flip">⇋</button><button class="btn sq ${S.snap?'on':''}" id="pSnap" aria-label="Snap to ends">🧲</button>${pend.edit?'<button class="btn sq" id="pDup" aria-label="Duplicate">⧉</button><button class="btn sq" id="pDel" aria-label="Delete">🗑</button>':''}<span class="sp"></span><button class="btn sq" id="pX" aria-label="Cancel">✕</button><button class="btn acc" id="pOK" ${pend.ok?'':'disabled'}>✓ Place</button></div>`;
    $('pRL').onclick=()=>pendRotate(-Math.PI/12);$('pRR').onclick=()=>pendRotate(Math.PI/12);
    $('pMir').onclick=()=>{pend.mirror=!pend.mirror;pend.def=pend.base?mirrorDef(pend.base,pend.mirror):modDef(pend.id,pend.mirror,pend.prm);pendLocal();pendUpdate();renderOpts()};
    $('pSnap').onclick=()=>{S.snap=!S.snap;saveS();if(!S.snap)pend.snapE=null;pendUpdate();renderOpts()};
    $('pX').onclick=pendCancel;$('pOK').onclick=pendPlace;
    if($('pDel'))$('pDel').onclick=pendDelete;if($('pDup'))$('pDup').onclick=pendDuplicate;
  }else if(tool==='stamp'){
    const cats=CATS.filter(c=>MODS.some(m=>m.cat===c[0]&&(!L.kit||kitHas(m.id))));
    if(!cats.find(c=>c[0]===trayCat))trayCat=cats[0][0];
    const list=MODS.filter(m=>m.cat===trayCat&&(!L.kit||kitHas(m.id)));
    const tiles=list.map(m=>{
      const lock=!modAvail(m),left=L.kit&&L.kit[m.id]!=null?L.kit[m.id]:null;
      const lab=m.id==='mosaic'?S.emoji+' Mosaic':m.id==='name'?(S.word.length>7?S.word.slice(0,6)+'…':S.word):m.name;
      return`<div class="tile ${stamp.id===m.id?'sel':''} ${lock||left===0?'lock':''}" data-mod="${m.id}">${modIcon(m.id)}<span>${lab}</span>${left!=null?`<span class="bd">×${left}</span>`:''}${lock?`<span class="lk">🔒 ${fmt(m.at)}</span>`:''}</div>`}).join('');
    o.innerHTML=`<div class="tabs">${cats.map(c=>`<button class="tab ${c[0]===trayCat?'on':''}" data-cat="${c[0]}">${c[1]}</button>`).join('')}<span class="sp"></span>${trayCat==='shapes'?'<button class="tab" id="pkE">'+S.emoji+' Emoji</button><button class="tab" id="pkN">Aa Name</button>':'<span class="hintsm">Tap a piece · tap a placed set to edit it</span>'}</div><div id="tray">${tiles}</div>`;
    o.querySelectorAll('.tab[data-cat]').forEach(b=>b.onclick=()=>{trayCat=b.dataset.cat;trayScroll=0;renderOpts()});
    if($('pkE'))$('pkE').onclick=()=>showPicker('mosaic');if($('pkN'))$('pkN').onclick=()=>showPicker('name');
    o.querySelectorAll('.tile').forEach(t=>{t.addEventListener('pointerdown',e=>tileDown(e,t.dataset.mod))});
    const tr=$('tray');tr.scrollLeft=trayScroll;tr.addEventListener('scroll',()=>trayScroll=tr.scrollLeft);
  }else if(tool==='erase'){o.innerHTML='<div id="hint">Drag across dominos to erase them. Tap a hill, rail, pad or finale to remove it.</div>';}
  else{o.innerHTML='<div id="hint">Tap the domino you want to <b>start</b> the chain. It tips the way it faces (green arrow).</div>'}
}
let trayScroll=0;
function setTool(t){if((L.daily||L.level)&&t==='start')return;if(pend&&t!=='stamp')pendAutoPlace();tool=t;ghostClear();cursor.visible=false;renderOpts()}

/* ------------------------------ ghost + pending stamp ------------------------------ */
let sDrag=null;
const handle=new THREE.Group();
{const rm=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.55,side:THREE.DoubleSide,depthWrite:false});
 const ring=new THREE.Mesh(new THREE.RingGeometry(.96,1,64),rm);ring.rotation.x=-Math.PI/2;handle.add(ring);
 const knob=new THREE.Mesh(new THREE.CircleGeometry(.42,24),new THREE.MeshBasicMaterial({color:0xffb347,side:THREE.DoubleSide,depthWrite:false}));knob.rotation.x=-Math.PI/2;knob.position.y=.01;
 const kr=new THREE.Mesh(new THREE.RingGeometry(.42,.5,24),new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide,depthWrite:false}));kr.rotation.x=-Math.PI/2;kr.position.y=.012;
 const arr=new THREE.Mesh(new THREE.ConeGeometry(.16,.3,3),new THREE.MeshBasicMaterial({color:0x2a0f1c}));arr.rotation.x=Math.PI/2;arr.position.y=.02;
 const kg=new THREE.Group();kg.add(knob,kr,arr);handle.add(kg);handle.userData={ring,kg};handle.visible=false;handle.renderOrder=9;handle.position.y=.06;scene.add(handle)}
function ghostClear(){for(const k in ghost)ghost[k].count=0;ghostProps.children.forEach(m=>m.visible=false);ghostMarks.forEach(m=>m.visible=false);handle.visible=false}
function showGhost(w,ok){
  for(const k in ghost)ghost[k].count=0;ghostProps.children.forEach(m=>m.visible=false);ghostMarks.forEach(m=>m.visible=false);
  const cnt={};for(const k in TY)cnt[k]=0;
  for(const o of w.it){const k=o.ty;if(cnt[k]>=ghostCap[k])continue;poseOf(o);mat4.compose(pos,quat,one);ghost[k].setMatrixAt(cnt[k]++,mat4);ghost[k].material=ok?ghostMat:ghostBad}
  for(const k in ghost){ghost[k].count=cnt[k];ghost[k].instanceMatrix.needsUpdate=true}
  w.pr.forEach((o,i)=>{const m=ghostProps.children[i];if(!m)return;m.visible=true;m.material=ok?ghostMat:ghostBad;propPose(o,m);m.scale.set(o.w,o.h,o.d)});
  w.fx.forEach((o,i)=>{const m=ghostMarks[i];if(!m)return;m.visible=true;m.material=ok?ghostMat:ghostBad;const r=isFin(o.k)?1:(o.rad||1.1);m.scale.set(r,r,1);m.position.set(o.x,.05,o.z)});
}
// local centre + radius of a def, used for rotating around the middle of a piece
function pendLocal(){let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;const all=pend.def.it.concat(pend.def.fx,pend.def.pr);
  all.forEach(o=>{x0=Math.min(x0,o.x);x1=Math.max(x1,o.x);z0=Math.min(z0,o.z);z1=Math.max(z1,o.z)});
  pend.lc={x:(x0+x1)/2,z:(z0+z1)/2};pend.rad=clamp(Math.max(...all.map(o=>Math.hypot(o.x-pend.lc.x,o.z-pend.lc.z)))+1.1,1.8,14)}
const rot=(x,z,a)=>[x*Math.cos(a)+z*Math.sin(a),-x*Math.sin(a)+z*Math.cos(a)];
function pendUpdate(){
  const p=pend;if(!p)return;
  let ax,az;
  if(p.snapE){const e=p.snapE;p.a=e.r+p.rel;ax=e.x+Math.sin(e.r)*SP;az=e.z+Math.cos(e.r)*SP;const c=rot(p.lc.x,p.lc.z,p.a);p.cx=ax+c[0];p.cz=az+c[1]}
  else{const c=rot(p.lc.x,p.lc.z,p.a);ax=p.cx-c[0];az=p.cz-c[1]}
  p.ax=ax;p.az=az;p.w=xform(p.def,ax,az,p.a);
  const err=stampCheck(p.w);p.err=err||(!p.edit&&kitLeft(p.id)<=0&&p.id?'kit':'');p.ok=!p.err;
  showGhost(p.w,p.ok);
  handle.visible=true;handle.position.set(p.cx,.06,p.cz);const R=p.rad;handle.userData.ring.scale.set(R,R,1);const ks=clamp(camState.dist/15,1,3);handle.userData.kg.scale.set(ks,1,ks);
  handle.userData.kg.position.set(Math.sin(p.a)*R,0,Math.cos(p.a)*R);handle.userData.kg.rotation.y=p.a;
}
function trySnap(){
  const p=pend;if(!S.snap||!p.id&&!p.edit){p.snapE=null;return}
  const c=rot(p.lc.x,p.lc.z,p.a),ax=p.fx-c[0],az=p.fz-c[1];
  let best=null,bd=1.5*1.5;for(const e of endsList()){if(p.own&&p.own.has(e.id))continue;const px=e.x+Math.sin(e.r)*SP,pz=e.z+Math.cos(e.r)*SP,d=(px-ax)**2+(pz-az)**2;if(d<bd){bd=d;best=e}}
  if(best){if(!p.snapE||p.snapE.id!==best.id)p.rel=0;p.snapE=best}
  else{p.snapE=null;p.cx=p.fx;p.cz=p.fz}
}
function lastEnd(){
  const alive=new Set(L.d.map(d=>d.id)),keys=Object.keys(L.g);
  for(let i=keys.length-1;i>=0;i--){const e=(L.g[keys[i]].exits||[]).find(e=>alive.has(e.id)&&!L.d.some(d=>d.id!==e.id&&Math.hypot(d.x-(e.x+Math.sin(e.r)*SP),d.z-(e.z+Math.cos(e.r)*SP))<.4));if(e)return e}
  const s0=L.d.find(d=>d.lock);if(s0&&L.d.length===1)return{x:s0.x,z:s0.z,r:s0.r,id:s0.id};
  return null;
}
function pendNew(id,pt,auto){
  const m=MODS.find(m=>m.id===id);if(!m||!modAvail(m))return;
  if(pend)pendAutoPlace();
  const prm=modPrm(id);
  pend={id,prm,mirror:false,def:modDef(id,false,prm),a:Math.PI,rel:0,snapE:null,edit:null};pendLocal();
  pend.cx=pend.fx=pt.x;pend.cz=pend.fz=pt.z;
  const le=auto&&S.snap?lastEnd():null;
  if(le){pend.snapE=le;pend.rel=0;pendUpdate();pend.fx=pend.cx;pend.fz=pend.cz;
    // keep the camera on it
    const v=new V3(pend.cx,0,pend.cz).project(camera);if(Math.abs(v.x)>.8||Math.abs(v.y)>.7){camState.tx=clamp(pend.cx,-L.fw/2,L.fw/2);camState.tz=clamp(pend.cz+3,-L.fd/2,L.fd/2)}}
  else trySnap();
  pendUpdate();renderOpts();updHud();
}
function pendMoveTo(x,z){const p=pend;p.fx=x;p.fz=z;if(!p.snapE){p.cx=x;p.cz=z}trySnap();pendUpdate()}
function pendRotate(da){const p=pend;if(p.snapE)p.rel=wrap(p.rel+da);else p.a=wrap(p.a+da);pendUpdate();renderOpts()}
function pendSetAngle(a){const p=pend,s=Math.PI/12;a=Math.round(a/s)*s;if(p.snapE)p.rel=wrap(a-p.snapE.r);else p.a=a;pendUpdate()}
function pendPlace(){
  const p=pend;if(!p)return;if(!p.ok){toast(p.err==='budget'?'Out of dominos':p.err==='kit'?'None left of that piece':'No room there');return}
  pushUndo(p.edit?p.edit.snap:null);
  if(!p.edit&&p.id&&L.kit&&L.kit[p.id]!=null)L.kit[p.id]--;
  const gid=stampCommit(p.id,p.w,{mod:p.id,mirror:p.mirror,a:p.a,ax:p.ax,az:p.az,prm:p.prm,base:p.base?true:undefined});
  if(p.base)L.g[gid].stroke=1;
  if(p.edit&&p.edit.hadStart){const f=L.d.find(d=>d.g===gid&&isScored(d));if(f)L.start=f.id}
  burst(fxG,p.cx,.3,p.cz,16,'#7cffb2',2,.6,.14,0,1);
  pend=null;ghostClear();saveFree();updHud();return gid;
}
function pendAutoPlace(){if(!pend)return;if(pend.ok)pendPlace();else pendCancel()}
function pendCancel(){const p=pend;if(!p)return;pend=null;ghostClear();if(p.edit)restore(p.edit.snap);updHud()}
function pendDelete(){const p=pend;if(!p||!p.edit)return;pushUndo(p.edit.snap);if(p.id&&L.kit&&L.kit[p.id]!=null)L.kit[p.id]++;pend=null;ghostClear();dirty=true;saveFree();updHud();toast('Deleted')}
function pendDuplicate(){
  const p=pend;if(!p)return;if(!p.ok){toast('Move it somewhere free first');return}
  if(p.id&&kitLeft(p.id)<(p.edit?1:2)){toast('None left of that piece');return}
  const keep={id:p.id,prm:p.prm,mirror:p.mirror,def:p.def,base:p.base,a:p.a,lc:p.lc,rad:p.rad},off=rot(Math.min(p.rad*1.2,4),0,p.a);
  const cx=p.cx+off[0],cz=p.cz+off[1];pendPlace();
  pend=Object.assign(keep,{rel:0,snapE:null,edit:null,cx,cz,fx:cx,fz:cz});pendUpdate();renderOpts();updHud();
}
// turn a placed set back into a pending stamp so it can be moved, turned, copied or deleted
function pendEdit(gid){
  const g=L.g[gid];if(!g)return false;
  const its=L.d.filter(d=>d.g===gid);if(its.some(d=>d.lock))return false;
  const snap0=snap(),hadStart=its.some(d=>d.id===L.start);
  let def,a,ax,az,base=null;
  if(g.mod&&BUILD[g.mod]&&!g.stroke&&g.ax!=null){def=modDef(g.mod,g.mirror,g.prm);a=g.a;ax=g.ax;az=g.az}
  else{const f=its.find(isScored)||its[0];a=f.r;ax=f.x;az=f.z;
    base={it:localize(its,ax,az,a),pr:localize(L.p.filter(o=>o.g===gid),ax,az,a),deco:localize(L.deco.filter(o=>o.g===gid),ax,az,a),fx:localize(L.fx.filter(o=>o.g===gid),ax,az,a),exits:[]};
    const ex=(g.exits||[])[0];if(ex){const q=localize([{x:ex.x,z:ex.z,r:ex.r}],ax,az,a)[0];base.exits=[q]}
    def=base}
  L.d=L.d.filter(d=>d.g!==gid);L.p=L.p.filter(o=>o.g!==gid);L.deco=L.deco.filter(o=>o.g!==gid);L.fx=L.fx.filter(o=>o.g!==gid);delete L.g[gid];
  if(hadStart)L.start=null;
  pend={id:g.mod&&!g.stroke?g.mod:null,prm:g.prm,mirror:g.mirror&&!base?g.mirror:false,def,base,a,rel:0,snapE:null,edit:{snap:snap0,hadStart}};
  pendLocal();const c=rot(pend.lc.x,pend.lc.z,a);pend.cx=pend.fx=ax+c[0];pend.cz=pend.fz=az+c[1];
  dirty=true;pendUpdate();renderOpts();updHud();return true;
}
function viewCenter(){const t=$('top').getBoundingClientRect().bottom||60,b=$('opts').getBoundingClientRect().top||innerHeight-200;return toWorld(innerWidth/2,(t+b)/2)||{x:0,z:0}}
function tileDown(e,id){
  const m=MODS.find(m=>m.id===id);
  if(!modAvail(m)){toast('Unlocks at '+fmt(m.at)+' points');return}
  if(kitLeft(id)<=0){toast('None left of that piece');return}
  stamp.id=id;audioInit();
  document.querySelectorAll('.tile').forEach(t=>t.classList.toggle('sel',t.dataset.mod===id));
  sDrag={id:e.pointerId,moved:false,sx:e.clientX,sy:e.clientY,mod:id};
}
addEventListener('pointermove',e=>{
  if(!sDrag||e.pointerId!==sDrag.id)return;
  const dx=e.clientX-sDrag.sx,dy=e.clientY-sDrag.sy;
  if(!sDrag.moved&&Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)*1.3){const tr=$('tray');if(tr){tr.scrollLeft-=dx;sDrag.sx=e.clientX;sDrag.scroll=true}return}
  if(!sDrag.moved&&dy<-14){sDrag.moved=true}
  if(!sDrag.moved)return;
  const o=$('opts').getBoundingClientRect();if(e.clientY>o.top-4)return;
  const p=toWorld(e.clientX,e.clientY);if(!p)return;
  if(!pend||pend.id!==sDrag.mod||pend.edit)pendNew(sDrag.mod,p);else pendMoveTo(p.x,p.z);
});
function endTileDrag(e,cancel){
  if(!sDrag||e.pointerId!==sDrag.id)return;
  const was=sDrag;sDrag=null;
  if(cancel||was.scroll)return;
  if(!was.moved){
    if((was.mod==='mosaic'||was.mod==='name')&&!picked[was.mod]){picked[was.mod]=1;showPicker(was.mod,()=>pendNew(was.mod,viewCenter(),true));return}
    pendNew(was.mod,viewCenter(),true);
  }
}
const picked={};
addEventListener('pointerup',e=>endTileDrag(e,false));
addEventListener('pointercancel',e=>endTileDrag(e,true));

/* ------------------------------ canvas input ------------------------------ */
const ptrs=new Map();let gesture=null,act=null,spaceDown=false;
addEventListener('keydown',e=>{if(e.code==='Space')spaceDown=true;if(mode==='build'){if(e.key==='z'&&(e.ctrlKey||e.metaKey))undo();if(pend){if(e.key==='r')pendRotate(Math.PI/12);if(e.key==='Enter')pendPlace();if(e.key==='Escape')pendCancel()}}});
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
  if(!pr){if(e.pointerType==='mouse'&&(tool==='erase'||tool==='start')){const p=toWorld(e.clientX,e.clientY);if(p){cursor.position.set(p.x,.03,p.z);cursor.visible=true}}return}
  const old={x:pr.x,y:pr.y};pr.x=e.clientX;pr.y=e.clientY;
  if(gesture&&gesture.mouse){panBy(old.x,old.y,e.clientX,e.clientY);return}
  if(ptrs.size>=2&&gesture){moveGesture();return}
  if(act)moveAct(e,old);
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
function startGesture(){const a=[...ptrs.values()];gesture={mx:(a[0].x+a[1].x)/2,my:(a[0].y+a[1].y)/2,d:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),ang:Math.atan2(a[1].y-a[0].y,a[1].x-a[0].x)}}
function moveGesture(){
  const a=[...ptrs.values()];if(a.length<2)return;
  const mx=(a[0].x+a[1].x)/2,my=(a[0].y+a[1].y)/2,d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),ang=Math.atan2(a[1].y-a[0].y,a[1].x-a[0].x);
  if(pend&&tool==='stamp'){
    // twist to turn the pending piece (screen clockwise = turn right)
    const da=wrap(ang-gesture.ang);gesture.acc=(gesture.acc||0)+da;const st=Math.PI/12;
    while(Math.abs(gesture.acc)>=st){const s=Math.sign(gesture.acc);pendRotate(-s*st);gesture.acc-=s*st}
  }else panBy(gesture.mx,gesture.my,mx,my);
  if(gesture.d>10&&d>10)camState.dist=clamp(camState.dist*gesture.d/d,8,60);
  gesture.mx=mx;gesture.my=my;gesture.d=d;gesture.ang=ang;
}
function hitGroup(p){
  let best=null,bd=.55;
  for(const d of L.d){if(d.lock)continue;const dd=Math.hypot(d.x-p.x,d.z-p.z);if(dd<bd){bd=dd;best=d.g}}
  if(!best)for(const o of L.fx)if(!o.goal&&Math.hypot(o.x-p.x,o.z-p.z)<1)best=o.g;
  if(!best)for(const o of L.p)if(inShape(p.x,p.z,o,.1))best=o.g;
  return best&&L.g[best]?best:null;
}
function onPend(p){if(!pend||!pend.w)return false;for(const o of pend.w.it)if(Math.hypot(o.x-p.x,o.z-p.z)<.9)return true;for(const o of pend.w.fx)if(Math.hypot(o.x-p.x,o.z-p.z)<1.3)return true;for(const o of pend.w.pr)if(inShape(p.x,p.z,o,.3))return true;return Math.hypot(p.x-pend.cx,p.z-pend.cz)<1.2}
function beginAct(e){
  const p=toWorld(e.clientX,e.clientY);if(!p)return;
  if(tool==='draw')beginDraw(p);
  else if(tool==='stamp'){
    if(pend){
      const kx=pend.cx+Math.sin(pend.a)*pend.rad,kz=pend.cz+Math.cos(pend.a)*pend.rad;
      if(Math.hypot(p.x-kx,p.z-kz)<Math.max(.9,camState.dist*.06)){act={t:'rot'};return}
      if(onPend(p)){act={t:'move',lx:p.x,lz:p.z};return}
      const g=hitGroup(p);if(g){pendAutoPlace();pendEdit(g);act={t:'move',lx:p.x,lz:p.z};return}
      act={t:'tapout',x:e.clientX,y:e.clientY,p};return;
    }
    const g=hitGroup(p);if(g&&pendEdit(g)){act={t:'move',lx:p.x,lz:p.z};return}
    pendNew(stamp.id,p);act={t:'move',lx:p.x,lz:p.z};
  }
  else if(tool==='erase'){act={t:'erase',snap:snap(),did:false};eraseAt(p)}
  else if(tool==='start'){
    let b=null,bd=.9;for(const d of L.d){if(!isScored(d))continue;const dd=Math.hypot(d.x-p.x,d.z-p.z);if(dd<bd){bd=dd;b=d}}
    if(b){L.start=b.id;dirty=true;saveFree();toast('Start set')}
  }
}
function moveAct(e){
  const p=toWorld(e.clientX,e.clientY);if(!p)return;
  if(act.t==='draw')drawTo(p);
  else if(act.t==='move'&&pend){pendMoveTo(pend.fx+(p.x-act.lx),pend.fz+(p.z-act.lz));act.lx=p.x;act.lz=p.z}
  else if(act.t==='rot'&&pend){const piv=pend.snapE?{x:pend.ax,z:pend.az}:{x:pend.cx,z:pend.cz};pendSetAngle(Math.atan2(p.x-piv.x,p.z-piv.z))}
  else if(act.t==='tapout'&&Math.hypot(e.clientX-act.x,e.clientY-act.y)>12)act={t:'pan',x:e.clientX,y:e.clientY};
  else if(act.t==='pan'){panBy(act.x,act.y,e.clientX,e.clientY);act.x=e.clientX;act.y=e.clientY}
  else if(act.t==='erase'){eraseAt(p);cursor.position.set(p.x,.03,p.z)}
}
function endAct(cancel){
  if(!act)return;const a=act;act=null;
  if(a.t==='draw'){
    if(a.last){L.g[a.gid]={exits:[{x:a.last.x,z:a.last.z,r:a.last.r,id:a.last.id}],stroke:1};if(L.start==null&&!L.daily&&!L.level)L.start=a.firstDom.id;pushUndo(a.snap);saveFree()}
  }else if(a.t==='tapout'&&!cancel&&pend){pendMoveTo(a.p.x,a.p.z)}
  else if((a.t==='move'||a.t==='rot')&&pend){renderOpts()}
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
    if(!removed)for(let i=L.deco.length-1;i>=0;i--){const o=L.deco[i];if((o.k==='gap'||o.k==='lane')&&inShape(p.x,p.z,o,.1)){L.deco.splice(i,1);removed=true;break}}
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
  C2.fx.push({id:C2.uid++,k:tut?['rocket','rocket','bell','trophy','fireworks'][o.l]:W.fin,x:gx,z:gz,goal:1,lock:1});occ.push({x:gx,z:gz,r:2.6});
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
  const kit={snake:2,fork:2,fan:1,ladder:1,ball:1,relay:1,zipper:1,hill:1,steps:1,jump:rivers?rivers+1:1,tower:1,slow:1,spiral:1,block:1,heart:1};
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
  tool='draw';stamp.id='straight';pend=null;trayScroll=0;trayCat='paths';
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
  const addBox=o=>{const e=new THREE.Object3D();propPose(o,e);const b=world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(e.position.x,e.position.y,e.position.z).setRotation({x:e.quaternion.x,y:e.quaternion.y,z:e.quaternion.z,w:e.quaternion.w}));
    const cd=R.ColliderDesc.cuboid(o.w/2,o.h/2,o.d/2).setFriction(o.rail?.05:o.kind==='ramp'?.3:.5);if(o.bounce)cd.setRestitution(1).setRestitutionCombineRule(R.CoefficientCombineRule.Max);world.createCollider(cd,b)};
  L.p.forEach(addBox);L.f.forEach(o=>addBox(Object.assign({},o,{y0:0})));
  // arena walls so balls and blocks stay on the table
  [[0,-L.fd/2-.25,L.fw/2+.5,.25],[0,L.fd/2+.25,L.fw/2+.5,.25],[-L.fw/2-.25,0,.25,L.fd/2],[L.fw/2+.25,0,.25,L.fd/2]].forEach(r=>world.createCollider(R.ColliderDesc.cuboid(r[2],.5,r[3]),fixed(r[0],.5,r[1],0)));
  bodies=L.d.map(d=>{
    const t=TY[d.ty];poseOf(d);
    const b=world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(pos.x,pos.y+.003,pos.z).setRotation({x:quat.x,y:quat.y,z:quat.z,w:quat.w}).setLinearDamping(d.ty==='WB'?.35:t.pin?.25:.01).setAngularDamping(d.ty==='WB'?.15:t.pin?.9:t.ball?.03:.01).setCanSleep(true));
    let cd;
    if(t.ball)cd=R.ColliderDesc.ball(t.r).setMass(t.m).setFriction(.5).setRestitution(d.rest!=null?d.rest:.1);
    else if(t.pin)cd=R.ColliderDesc.cylinder(t.h/2,t.r*.8).setMass(t.m).setFriction(1.1);
    else cd=R.ColliderDesc.cuboid(t.w/2,t.h/2,t.t/2).setMass(t.m).setFriction(d.ty==='C'?.6:qn('fr',.3)).setRestitution(qn('re',0));
    world.createCollider(cd,b);
    if(d.pivot){const fb=world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(pos.x,pos.y+.003,pos.z).setRotation({x:0,y:Math.sin(d.r/2),z:0,w:Math.cos(d.r/2)}));
      world.createImpulseJoint(R.JointData.revolute({x:0,y:0,z:0},{x:0,y:0,z:0},{x:1,y:0,z:0}),fb,b,true)}
    if(d.ay!=null){const fb=world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(d.ax,d.ay,d.az));
      world.createImpulseJoint(R.JointData.spherical({x:0,y:0,z:0},{x:d.ax-pos.x,y:d.ay-pos.y,z:d.az-pos.z}),fb,b,true)}
    b.sleep();
    d._top=!isScored(d);d._tt=-9;d._burn=0;d._flash=0;d._px=d.x;d._pz=d.z;d._iy=pos.y;d._bn=0;return b;
  });
  P0groups();
}
let bonusG={};
function P0groups(){bonusG={};for(const d of L.d)if(d.bn){const g=bonusG[d.g]||(bonusG[d.g]={n:0,down:0,kind:d.bn,done:0});g.n++}}
function stopPhysics(){if(world){try{world.free()}catch(e){}}world=null;bodies=[];P=null;$('vig').classList.remove('on')}
function pushStart(){
  let i=L.d.findIndex(d=>d.id===L.start);if(i<0)i=L.d.findIndex(isScored);if(i<0)return;const d=L.d[i],b=bodies[i];if(!b)return;
  const f={x:Math.sin(d.r),z:Math.cos(d.r)},k=qn('push',2.6)*Math.sqrt((L.grav||GRAV)/40);
  b.wakeUp();b.setAngvel({x:f.z*k,y:0,z:-f.x*k},true);b.setLinvel({x:f.x*k*.5,y:0,z:f.z*k*.5},true);
}
function startPlay(isDemo){
  if(!isDemo&&pend)pendAutoPlace();
  if(!L.d.some(isScored)){toast('Place some dominos first');return}
  demo=!!isDemo;refresh();buildWorld();acc=0;
  P={t:0,score:0,streak:0,best:0,last:-9,top:0,bonus:0,tHit:0,over:false,mult:1,moveT:0,hold:0,goal:false,tiles:0,burned:0,fins:[],anims:[],slowUntil:0,pins:0};
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
    if(lv.x*lv.x+lv.y*lv.y+lv.z*lv.z>.04||av.x*av.x+av.y*av.y+av.z*av.z>.5){moving=true;if(isScored(d)||(TY[d.ty].ball&&lv.x*lv.x+lv.z*lv.z>.6))P.moveS=P.t}
    d._px=tr.x;d._pz=tr.z;d._spd=lv.x*lv.x+lv.z*lv.z;
    if(!d._top&&upY(b.rotation())<.72){d._top=true;d._tt=P.t;onTopple(d,i,tr)}
    if(d.bn&&!d._bn&&(d.bn==='pin'?(upY(b.rotation())<.6||Math.hypot(tr.x-d.x,tr.z-d.z)>.4):(Math.hypot(tr.x-d.x,tr.z-d.z)>.35||Math.abs(tr.y-d._iy)>.3||upY(b.rotation())<.4))){d._bn=1;onBonus(d,tr)}
    if(tr.y<.6&&inBurn(tr.x,tr.z))burn(i,tr);
    else if(tr.y<-3){world.removeRigidBody(b);bodies[i]=null;d._burn=1}
  }
  if(moving)P.moveT=P.t;
  if(P.fins.some(r=>!r.done))P.moveT=P.t;
  if(!P.over&&P.t>.5&&(P.t-P.moveT>1.6||P.t-(P.moveS||0)>4.5||P.t>150)&&tAbs>P.hold)finishRun();
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
    if(isFin(o.k)&&Math.hypot(o.x-tr.x,o.z-tr.z)<1.5){o._fired=1;fireFin(k,o,mult)}
    if(o.k==='cat'&&Math.hypot(o.x-tr.x,o.z-tr.z)<1.2){o._fired=1;fireCat(k,o)}
    if(o.k==='slow'&&Math.hypot(o.x-tr.x,o.z-tr.z)<(o.rad||1.1)+.3){o._fired=1;P.slowUntil=tAbs+2.6;tone(420,90,.9,.12);if(fxMeshes[k])fxMeshes[k].visible=false}}
  if(discoTiles&&discoTiles.light(tr.x,tr.z)){P.tiles++;P.score+=5*mult}
  if(!demo){$('score').textContent=fmt(P.score);const c=$('chain');c.textContent=P.streak>=3?P.streak+' chain'+(mult>1?'  ×'+mult:''):'';c.classList.add('bump');setTimeout(()=>c.classList.remove('bump'),90);$('objP').textContent=objText(true)}
}
function fireFin(k,o,mult){
  const m=fxMeshes[k];if(!m)return;const F=FIN[o.k];
  const st={k:o.k,m,u:m.userData,o,x:o.x,z:o.z,t:0,fy:1.5,done:false};P.fins.push(st);
  const b=(o.goal?600:300)*mult;P.score+=b;P.bonus+=b;if(o.goal)P.goal=true;
  P.hold=Math.max(P.hold,tAbs+F.dur);
  if(!demo)popup(FIN_ICON[o.k]+(o.goal?' GOAL +':' +')+fmt(b),{x:o.x,z:o.z},'big');
  shake=Math.max(shake,.3);F.fire(st);
}
function fireCat(k,o){
  const m=fxMeshes[k],cx=o.x+Math.sin(o.r||0)*.95,cz=o.z+Math.cos(o.r||0)*.95;
  let bi=-1,bd=1.2;L.d.forEach((d,i)=>{if((d.ty==='b'||d.ty==='B')&&bodies[i]){const dd=Math.hypot(d.x-cx,d.z-cz);if(dd<bd){bd=dd;bi=i}}});
  if(m)P.anims.push({t:0,piv:m.userData.piv});
  noise(.25,1500,300,.12);tone(160,90,.2,.12,'square');
  if(bi<0)return;const b=bodies[bi],k2=Math.sqrt((L.grav||GRAV)/40),r=o.r||0,vz=9*k2,vy=8.5*k2;
  b.wakeUp();b.setLinvel({x:Math.sin(r)*vz,y:vy,z:Math.cos(r)*vz},true);b.setAngvel({x:Math.cos(r)*-20,y:0,z:Math.sin(r)*20},true);
}
function updateAnims(dt){if(!P)return;for(const a of P.anims){a.t+=dt;a.piv.rotation.x=a.t<.15?.12-a.t/.15*1.8:-1.68+Math.min(1,(a.t-.15)/1)*0}}
function updateFins(dt){updateAnims(dt);if(!P)return;for(const s of P.fins){if(s.done)continue;s.t+=dt;FIN[s.k].tick(s,dt);if(s.t>FIN[s.k].dur){s.done=true;if(s.bats)s.bats.forEach(o=>markGroup.remove(o.b))}}}
function onBonus(d,tr){
  const g=bonusG[d.g];if(!g||g.done)return;g.down++;
  if(g.kind==='pin'){P.pins++;const b=40*P.mult;P.score+=b;P.bonus+=b;click(P.pins+5,false);
    if(g.down===g.n){g.done=1;const sb=500*P.mult;P.score+=sb;P.bonus+=sb;if(!demo){popup('STRIKE! +'+fmt(sb),{x:tr.x,z:tr.z},'big');chime();flash(.2)}burst(fxN,tr.x,1,tr.z,80,FIRE,5,2.5,.16,5,1)}}
  else if(g.down>=Math.ceil(g.n*.7)){g.done=1;const sb=400*P.mult;P.score+=sb;P.bonus+=sb;if(!demo){popup('COLLAPSE! +'+fmt(sb),{x:tr.x,z:tr.z},'big');chime()}shake=Math.max(shake,.4);burst(fxN,tr.x,.4,tr.z,30,theme.dust,2.5,1.2,.3,2,1)}
  if(!demo)$('score').textContent=fmt(P.score);
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
    const gk=(L.fx.find(o=>o.goal)||{k:'rocket'}).k;
    crit=[{ok:P.goal,txt:'Trigger the '+FIN[gk].name},{ok:L.targets.length?allT:P.best>=15,txt:L.targets.length?`Hit every ring (${P.tHit}/${L.targets.length})`:`Chain of 15+ (${P.best})`},{ok:strag===0,txt:strag?`No stragglers (${strag} left)`:'No stragglers'}];
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
  const head=lv?(r.stars?`<h2 class="ok">Level complete!</h2>`:`<h2>The ${FIN[(L.fx.find(o=>o.goal)||{k:'rocket'}).k].name.toLowerCase()} didn't go off</h2>`):`<h2>${r.strag===0&&r.total>=8?'<span class="ok">✨ FLAWLESS ✨</span>':r.strag<=2?'So close!':'Run complete'}</h2>`;
  const stars=lv?`<div class="stars">${[0,1,2].map(i=>`<i class="${i<r.stars?'on':''}" style="animation-delay:${.15+i*.25}s">★</i>`).join('')}</div><div class="chk">${r.crit.map(c=>`<span class="${c.ok?'y':'n'}">${c.ok?'✔':'○'}</span><span class="${c.ok?'':'muted'}">${c.txt}</span>`).join('')}</div>`:'';
  const hasNext=lv&&r.stars&&(lv.l<4||lv.w<WORLDS.length-1);
  res.innerHTML=`${head}${stars}
  <div class="big" style="${lv?'font-size:30px':''}">${fmt(r.final)}</div>${r.record&&!lv?'<div class="ok">New best!</div>':''}
  <div class="rows"><span>Toppled</span><span>${P.top} / ${r.total}</span><span>Longest chain</span><span>${P.best}</span>${tg}
  ${P.tiles?`<span>Tiles lit</span><span>${P.tiles}</span>`:''}${P.pins?`<span>Pins down 🎳</span><span>${P.pins}</span>`:''}${P.burned?`<span>Burned up 🔥</span><span>${P.burned}</span>`:''}
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
  stopPhysics();demo=false;resetFxCache();setMode('build');$('res').classList.add('hide');
  L.d.forEach(d=>{d._top=false;d._burn=0;d._flash=0});dirty=true;camMode='chase';
  L.targets.forEach(t=>{t.hit=false});if(discoTiles)discoTiles.reset();updHud();
}

/* ------------------------------ demo (menu background) ------------------------------ */
const DEMO_TH=['wood','disco','cosmic','candy','lava','haunted','sand'];let demoI=0;
function demoLayout(){
  L=newLayout();L.fw=44;L.fd=64;L.theme=DEMO_TH[demoI++%DEMO_TH.length];L.grav=TH[L.theme].grav||GRAV;setTheme(L.theme,L.fw,L.fd);
  let ax=0,az=14,a=Math.PI;
  for(const id of ['straight','ladder','curve','steps','snake','spiral','straight','fork','fireworks']){
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
    for(const r of P.fins)if(!r.done){n++;x0=Math.min(x0,r.x-2);x1=Math.max(x1,r.x+2);z0=Math.min(z0,r.z-2);z1=Math.max(z1,r.z+2)}
    if(!n&&!chase.init){const d=L.d.find(d=>d.id===L.start)||L.d[0];x0=x1=d.x;z0=z1=d.z;n=1;hx=Math.sin(d.r);hz=Math.cos(d.r);ws=1}
    if(n){
      const cx=(x0+x1)/2,cz=(z0+z1)/2,ext=Math.max(x1-x0,z1-z0);
      if(!chase.init){chase.front.set(cx,0,cz);chase.dir.set(hx,0,hz).normalize();chase.init=true}
      const coh=ws>0?Math.hypot(hx,hz)/ws:0;
      if(coh>.55){const t=new V3(hx,0,hz).normalize();chase.dir.lerp(t,1-Math.exp(-dt*2.2)).normalize()}
      chase.front.lerp(new V3(cx,0,cz),1-Math.exp(-dt*5));
      const e=Math.min(ext+(coh<.55?3:0),30);chase.ext+=(e-chase.ext)*(1-Math.exp(-dt*(e>chase.ext?3.5:.7)));
    }
    const fly=P.fins.find(r=>!r.done&&r.t<FIN[r.k].dur-.4);
    if(camMode==='over')overPose();
    else if(fly){const y=Math.min(fly.fy||1.5,14);des.look.set(fly.x,Math.max(.5,y*.75),fly.z);des.pos.set(fly.x-chase.dir.x*(6+y*.3),2.8+y*.35,fly.z-chase.dir.z*(6+y*.3))}
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
    stepSim(dt);updateFins(dt);
    const colDirty={};
    for(let i=0;i<bodies.length;i++){
      const b=bodies[i],d=L.d[i],k=d.ty;
      if(d._flash>0){d._flash=Math.max(0,d._flash-dt*2.5);_c.copy(d._col).lerp(flashCol,d._flash*.85);inst[k].setColorAt(d._i,_c);colDirty[k]=1}
      if(!b||(b.isSleeping()&&!P.over))continue;
      const tr=b.translation(),ro=b.rotation();
      if(d.ay!=null){const rp=ropes.find(r=>r.d===d);if(rp)updRope(rp,tr)}
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
  fxMeshes.forEach((m,i)=>{const u=m.userData;if(u.glow){const s=1+Math.sin(tAbs*4)*.06;u.glow.scale.set(s,s,1)}if(u.slow&&m.visible)m.rotation.z=tAbs*.6;const o=L.fx[i];if(u.idle&&o&&!(P&&o._fired))u.idle(tAbs,o.x,o.z)});
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
  <li><b>Stamp</b>: tap a piece (or drag it up) to drop it on the table. Drag it to move, twist the ring or two fingers to turn, ⇋ to flip, then ✓ <b>Place</b>. 🧲 snaps it to open line ends.</li><li>Tap any placed set to move, turn, copy or delete it.</li>
  <li>Pieces come in four trays: <b>Paths</b>, <b>Gadgets</b> (catapult, wrecking ball, trampoline, marble ramp…), <b>Finales</b> (bell, piñata, UFO, volcano, bowling…) and <b>Shapes</b> (heart, star, emoji mosaic, your name).</li>
  <li><b>Pinch</b> or two-finger drag to zoom and pan.</li>
  <li>Tap <b>PLAY</b>. The camera dives in and follows the wave.</li>
  <li><b>Chain score</b>: every domino in a row scores more. Keep the chain unbroken for ×2, ×3 and up.</li>
  <li><b>Stragglers</b>: any domino left standing costs you points.</li>
  <li><b>Levels</b>: ring the rocket for ★, hit every ring for ★, leave no stragglers for ★. Seven themed worlds.</li></ul>
  <div class="row"><button class="btn acc" id="mClose">Got it</button></div>`);
  $('mClose').onclick=closeModal;
}
const EMOJI=['😀','😎','🥳','😍','🤩','😜','🤖','👻','🎃','💀','👽','🤡','🐶','🐱','🦊','🐼','🐸','🐙','🦄','🐝','🦋','🐢','🐳','🦖','🌈','⭐','🌙','☀️','🔥','❄️','⚡','🍀','🌸','🌻','🍕','🍔','🍩','🍓','🍉','🍒','🎂','🍭','⚽','🏀','🎮','🎸','🚀','🛸','❤️','💜','💎','👑','🎁','🎈','🇺🇸','🏳️‍🌈'];
function showPicker(kind2,cb){
  const isN=kind2==='name';
  openModal(`<h3>${isN?'Name writer':'Mosaic wall'}</h3><div class="muted">${isN?'Type up to 8 letters. The dominos spell it out in a field that topples row by row.':'Pick an emoji. It becomes a wall of colored dominos you can knock down.'}</div>
  ${isN?`<input id="pkIn" class="pkin" maxlength="8" value="${S.word}" autocomplete="off" autocapitalize="characters">`:`<div class="emo">${EMOJI.map(e=>`<button class="${e===S.emoji?'sel':''}" data-e="${e}">${e}</button>`).join('')}</div>
  <div class="row" style="margin-top:10px"><input id="pkIn" class="pkin" placeholder="…or type any emoji" maxlength="8" autocomplete="off"></div>`}
  <div class="row"><button class="btn" id="pkX">Cancel</button><button class="btn acc" id="pkOK">Use it</button></div>`);
  let val=isN?S.word:S.emoji;
  document.querySelectorAll('.emo button').forEach(b=>b.onclick=()=>{val=b.dataset.e;document.querySelectorAll('.emo button').forEach(x=>x.classList.toggle('sel',x===b))});
  $('pkX').onclick=closeModal;
  $('pkOK').onclick=()=>{const t=$('pkIn').value.trim();
    if(isN){const w=t.toUpperCase().replace(/[^A-Z0-9!?&+ ]/g,'').slice(0,8);if(!w){toast('Type a word first');return}S.word=w}
    else{if(t)val=[...t].slice(0,2).join('');S.emoji=val}
    saveS();closeModal();stamp.id=kind2;trayCat='shapes';picked[kind2]=1;
    if(pend&&pend.id===kind2&&!pend.edit){const c={x:pend.cx,z:pend.cz};pend=null;pendNew(kind2,c)}else if(cb)cb();else if(mode==='build'&&tool==='stamp')pendNew(kind2,viewCenter(),true);
    renderOpts()};
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
  play(){startPlay(false)},step(sec){let n=0;while(n<sec*60){tAbs+=1/60;stepSim(1/60);updateFins(1/60);n++}},
  reset(){const t=L.theme,g=L.grav;L=newLayout();L.theme=t;L.grav=g;undoStack=[]},
  stats(){const s=L.d.filter(isScored);return{fins:P?P.fins.length:0,pins:P?P.pins:0,bonus:Object.values(bonusG).map(g=>g.kind+':'+g.down+'/'+g.n+(g.done?'✓':'')).join(' '),top:s.filter(d=>d._top).length,total:s.length,burned:P&&P.burned,P:P&&{t:P.t,score:P.score,best:P.best,over:P.over,goal:P.goal,tHit:P.tHit,tiles:P.tiles},res:P&&P.result&&{stars:P.result.stars,strag:P.result.strag}}},
  screenOf(d){const v=new V3(d.x,.5,d.z).project(camera);return{x:(v.x+1)/2*innerWidth,y:(1-v.y)/2*innerHeight}},
  start:startKind,bodies:()=>bodies,level:startLevel,levels:showLevels,mode:()=>mode,modDef,xform,stampCheck,makeCourse,setTheme:(id)=>{L.theme=id;L.grav=TH[id].grav||GRAV;setTheme(id,L.fw,L.fd);dirty=true}
};

/* ------------------------------ boot ------------------------------ */
resize();
RAPIER.init().then(()=>{goMenu();requestAnimationFrame(frame);window.TOPPLE_READY=true});
})();
