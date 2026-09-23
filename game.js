const {Engine,World,Bodies,Body,Constraint}=Matter;
const canvas=document.getElementById('canvas'),ctx=canvas.getContext('2d');
let W=innerWidth,H=innerHeight,dpr=1,engine=null,world=null,mode='menu';
let peer=null,myId='',room='',host=false,hostConn=null,connections=[];
let players={},weapons=[],mapIndex=0,ended=false,last=0,gold=Number(localStorage.getItem('sa_gold')||0);
let owned=JSON.parse(localStorage.getItem('sa_owned')||'["Street"]'),outfit=localStorage.getItem('sa_outfit')||'Street';
let keys={},touch={x:0,y:0,attack:false,shield:false,dash:false};
let gameType='menu', botDifficulty='normal', hazardClock=0, matchRewarded=false;

const arenas=[
 {name:'SAMURAI TEMPLE',sky:'#102331',ground:'#33221d',platform:'#704a35',accent:'#f1b86a',layout:[[.16,.62,.20],[.38,.46,.16],[.62,.60,.20],[.84,.43,.16]],hazard:'wind',mechanic:'gust'},
 {name:'VOLCANO FORTRESS',sky:'#241014',ground:'#321818',platform:'#673631',accent:'#ff6a35',layout:[[.14,.64,.17],[.34,.47,.14],[.53,.67,.18],[.73,.48,.14],[.89,.63,.16]],hazard:'lava',mechanic:'lava'},
 {name:'NEON CYBER CITY',sky:'#061521',ground:'#132a35',platform:'#285260',accent:'#20e4ff',layout:[[.11,.65,.15],[.29,.43,.14],[.48,.61,.17],[.67,.40,.14],[.87,.62,.17]],hazard:'laser',mechanic:'laser'},
 {name:'FROZEN ABYSS',sky:'#173342',ground:'#b7dbe5',platform:'#6fa8ba',accent:'#e8fbff',layout:[[.14,.58,.18],[.37,.70,.14],[.56,.48,.18],[.77,.62,.15],[.91,.45,.11]],hazard:'ice',mechanic:'ice'},
 {name:'COSMIC RUINS',sky:'#090b22',ground:'#1b2140',platform:'#555d91',accent:'#a897ff',layout:[[.12,.65,.15],[.32,.46,.14],[.52,.67,.15],[.70,.44,.15],[.89,.63,.15]],hazard:'gravity',mechanic:'gravity'},
 {name:'DESERT COLOSSEUM',sky:'#8f5739',ground:'#58351f',platform:'#a86b3b',accent:'#ffd58d',layout:[[.15,.61,.18],[.39,.47,.15],[.61,.62,.19],[.84,.48,.15]],hazard:'sand',mechanic:'sand'},
 {name:'CURSED CASTLE',sky:'#0e0d18',ground:'#252231',platform:'#514761',accent:'#bb83ff',layout:[[.12,.66,.15],[.31,.49,.14],[.50,.64,.17],[.70,.46,.14],[.88,.64,.16]],hazard:'curse',mechanic:'trap'},
 {name:'ORBITAL STATION',sky:'#02060d',ground:'#16222e',platform:'#405767',accent:'#61d7ff',layout:[[.13,.55,.15],[.34,.69,.14],[.55,.45,.16],[.76,.64,.15],[.91,.50,.11]],hazard:'gravity'}
];
const weaponsDef=[
 {name:'ENERGY KATANA',icon:'⚔',damage:22,reach:76,color:'#f2f7ff',speed:1.0},
 {name:'IMPACT HAMMER',icon:'🔨',damage:34,reach:68,color:'#d6a875',speed:.78},
 {name:'THUNDER BLADE',icon:'⚡',damage:27,reach:82,color:'#ffe45a',speed:1.05},
 {name:'INFERNO BLADE',icon:'🔥',damage:25,reach:78,color:'#ff7044',speed:1.0},
 {name:'VOID KUNAI',icon:'✦',damage:19,reach:105,color:'#b6a5ff',speed:1.25},
 {name:'POWER GAUNTLET',icon:'✊',damage:31,reach:64,color:'#ff78b5',speed:1.15},
 {name:'PULSE BOMB',icon:'💣',damage:44,reach:115,color:'#8a9aaa',speed:.7},
 {name:'WARP BLASTER',icon:'◉',damage:23,reach:125,color:'#57e7ff',speed:.9},
 {name:'STORM TRIDENT',icon:'🔱',damage:29,reach:92,color:'#6fc7ff',speed:.92},
 {name:'PHANTOM CHAKRAM',icon:'◈',damage:21,reach:112,color:'#d38bff',speed:1.2}
];
const outfits=[
 ['Street','ST',0,'#f5f5f5'],['Ninja','NX',400,'#202634'],['Samurai','SA',800,'#d5a05a'],['Cyber','CY',1500,'#35e5ff'],['Demon','DM',2500,'#d84d68'],['Dragon','DR',4000,'#68d18b'],['Shadow','SH',5500,'#8d7cff'],['Cosmic','CO',7000,'#b4a2ff'],['Royal','RY',9000,'#f2ca68'],['Flame','FL',12000,'#ff7048']
];

function save(){localStorage.setItem('sa_gold',gold);localStorage.setItem('sa_owned',JSON.stringify(owned));localStorage.setItem('sa_outfit',outfit);$("menuGold").textContent=gold;$("gameGold").textContent=gold}
save();
function resize(){dpr=Math.min(2,devicePixelRatio||1);W=innerWidth;H=innerHeight;canvas.width=W*dpr;canvas.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0)}
addEventListener('resize',resize);resize();
function $(id){return document.getElementById(id)}
function show(id,v=true){$(id.replace('#','')).classList.toggle('hidden',!v)}
function roomCode(){return Math.random().toString(36).slice(2,8).toUpperCase()}
function setGame(v){mode=v?'game':'menu';$('game').classList.toggle('hidden',!v);$('menu').classList.toggle('hidden',v);if(v){$("roomText").textContent='ROOM '+room;$("arenaText").textContent=arenas[mapIndex].name;resize()}}
function createPlayer(id,n){return{id,name:'P'+n,n,head:null,parts:[],cons:[],weapon:-1,hp:100,shield:false,input:{x:0,y:0,a:false,s:false,d:false},cool:0,dashCd:0,alive:true,remote:{x:0,y:0,angle:0}}}
function makeRagdoll(p,x,y){
 const group=Body.nextGroup(true);
 const head=Bodies.circle(x,y-43,14,{label:p.id+':head',collisionFilter:{group},restitution:.1});
 const torso=Bodies.rectangle(x,y-9,18,43,{label:p.id+':torso',collisionFilter:{group},restitution:.1});
 const a1=Bodies.rectangle(x-20,y-8,34,7,{label:p.id+':arm',collisionFilter:{group},restitution:.15});
 const a2=Bodies.rectangle(x+20,y-8,34,7,{label:p.id+':arm',collisionFilter:{group},restitution:.15});
 const l1=Bodies.rectangle(x-10,y+34,9,39,{label:p.id+':leg',collisionFilter:{group},restitution:.1});
 const l2=Bodies.rectangle(x+10,y+34,9,39,{label:p.id+':leg',collisionFilter:{group},restitution:.1});
 const parts=[head,torso,a1,a2,l1,l2];
 const cons=[
  Constraint.create({bodyA:head,bodyB:torso,pointA:{x:0,y:13},pointB:{x:0,y:-19},stiffness:.7,length:2}),
  Constraint.create({bodyA:torso,bodyB:a1,pointA:{x:-7,y:-10},pointB:{x:14,y:0},stiffness:.55,length:2}),
  Constraint.create({bodyA:torso,bodyB:a2,pointA:{x:7,y:-10},pointB:{x:-14,y:0},stiffness:.55,length:2}),
  Constraint.create({bodyA:torso,bodyB:l1,pointA:{x:-6,y:19},pointB:{x:0,y:-17},stiffness:.7,length:2}),
  Constraint.create({bodyA:torso,bodyB:l2,pointA:{x:6,y:19},pointB:{x:0,y:-17},stiffness:.7,length:2})
 ];
 World.add(world,[...parts,...cons]);p.head=head;p.parts=parts;p.cons=cons;
}
function removePlayerBodies(p){if(!world||!p.parts.length)return;World.remove(world,[...p.parts,...p.cons]);p.parts=[];p.cons=[];p.head=null}
function createMapBodies(){
 const a=arenas[mapIndex];
 const staticBodies=[Bodies.rectangle(W/2,H-36,W+100,72,{isStatic:true,label:'floor'}),Bodies.rectangle(-25,H/2,50,H*2,{isStatic:true,label:'wall'}),Bodies.rectangle(W+25,H/2,50,H*2,{isStatic:true,label:'wall'})];
 a.layout.forEach((v,i)=>staticBodies.push(Bodies.rectangle(W*v[0],H*v[1],W*v[2],16,{isStatic:true,label:'platform:'+i})));
 const extras=[[.50,.55,.18],[.50,.36,.13],[.50,.52,.11],[.50,.34,.18],[.50,.50,.12],[.50,.40,.20],[.50,.34,.15],[.50,.54,.16]];
 const e=extras[mapIndex];staticBodies.push(Bodies.rectangle(W*e[0],H*e[1],W*e[2],14,{isStatic:true,label:'special-platform'}));
 World.add(world,staticBodies);
}
function initPhysics(){engine=Engine.create({enableSleeping:false});engine.gravity.y=1.08;world=engine.world;createMapBodies();const arr=Object.values(players);arr.forEach((p,i)=>makeRagdoll(p,W*(i+1)/(arr.length+1),H-150));}
function rebuildHostPhysics(){if(!host)return;weapons=[];initPhysics()}
function ppos(p){return p.head?{x:p.head.position.x,y:p.head.position.y}:{x:p.remote.x||0,y:p.remote.y||0}}
function localInput(){return{x:(keys.d?1:0)-(keys.a?1:0)+touch.x,y:(keys.w?1:0)-(keys.s?1:0)+touch.y,a:!!(keys[' ']||touch.attack),s:!!(keys.s||touch.shield),d:!!(keys.shift||touch.dash)}}
function spawnWeapon(){if(!host||weapons.length>=5)return;const t=Math.floor(Math.random()*weaponsDef.length),x=70+Math.random()*(W-140),y=90+Math.random()*Math.max(80,H-260);const body=Bodies.circle(x,y,15,{isStatic:true,isSensor:true,label:'weapon'});const w={id:Math.random().toString(36).slice(2),t,body,phase:Math.random()*6};weapons.push(w);World.add(world,body)}
function attack(p){if(p.cool>0||!p.alive)return;p.cool=.30;const wd=weaponsDef[Math.max(0,p.weapon)];const a=ppos(p);let hits=0;Object.values(players).forEach(q=>{if(q===p||!q.alive)return;const b=ppos(q),dist=Math.hypot(a.x-b.x,a.y-b.y);if(dist<wd.reach){const dir=b.x>=a.x?1:-1;q.hp-=q.shield?5:wd.damage;q.parts.forEach(body=>Body.applyForce(body,body.position,{x:dir*(q.shield?.009:.028*(wd.damage/22)),y:-.012}));hits++;if(q.hp<=0)kill(q)}});if(hits)spawnHit(a.x,a.y)}
function spawnHit(x,y){particles.push(...Array.from({length:12},()=>({x,y,vx:(Math.random()-.5)*5,vy:(Math.random()-.8)*5,life:.35})));}
let particles=[];
function kill(p){if(!p.alive)return;p.alive=false;removePlayerBodies(p);spawnHit(p.remote.x||W/2,p.remote.y||H/2)}
function nearestEnemy(p){let best=null,bd=1e9;const a=ppos(p);Object.values(players).forEach(q=>{if(q===p||!q.alive)return;const b=ppos(q),d=Math.hypot(a.x-b.x,a.y-b.y);if(d<bd){bd=d;best=q}});return best}
function nearestWeapon(p){let best=null,bd=1e9;const a=ppos(p);weapons.forEach(w=>{if(!w.body)return;const q=w.body.position,d=Math.hypot(a.x-q.x,a.y-q.y);if(d<bd){bd=d;best=w}});return best}
function botThink(p,dt){if(!p.bot||!p.alive)return;p.botTimer=(p.botTimer||0)-dt;if(p.botTimer>0)return;p.botTimer=(botDifficulty==='hard'?.10:botDifficulty==='easy'?.28:.17)*(0.8+Math.random()*.5);const target=nearestEnemy(p),pick=p.weapon<0?nearestWeapon(p):null,a=ppos(p),t=target?ppos(target):null;let x=0,y=0,attack=false,shield=false,dash=false;const goal=pick?.body?.position||t;if(goal){x=Math.sign(goal.x-a.x);if(a.y-goal.y>35)y=-1}if(target&&p.weapon>=0){const d=Math.hypot(t.x-a.x,t.y-a.y);attack=d<weaponsDef[p.weapon].reach*(botDifficulty==='hard'?1.15:1);shield=d<90&&Math.random()<.18;dash=d>180&&Math.random()<.25}if(Math.abs(a.x-W*.5)>W*.45)x=-Math.sign(a.x-W*.5);if(a.y>H-125)y=-1;if(Math.random()<.07)y=-1;p.input={x,y,a:attack,s:shield,d:dash}}
function applyHazards(dt){hazardClock+=dt;const a=arenas[mapIndex];if(a.mechanic==='gust'&&Math.sin(hazardClock*1.8)>0.97)Object.values(players).forEach(p=>p.alive&&p.parts[1]&&Body.applyForce(p.parts[1],p.parts[1].position,{x:.018*Math.sin(hazardClock*3),y:0}));if(a.mechanic==='lava')Object.values(players).forEach(p=>{if(p.alive&&ppos(p).y>H-105)p.hp-=dt*18});if(a.mechanic==='laser'){const lx=(hazardClock*.42%1)*W;Object.values(players).forEach(p=>{const q=ppos(p);if(p.alive&&Math.abs(q.x-lx)<18&&q.y>H*.18&&q.y<H*.72)p.hp-=dt*35})}if(a.mechanic==='ice')Object.values(players).forEach(p=>p.parts.forEach(b=>b.friction=.01));else Object.values(players).forEach(p=>p.parts.forEach(b=>b.friction=.4));if(a.mechanic==='gravity')engine.gravity.y=1.08*(1+Math.sin(hazardClock*1.4)*.65);else engine.gravity.y=1.08;if(a.mechanic==='sand'&&Math.sin(hazardClock*.8)>.75)Object.values(players).forEach(p=>p.alive&&p.parts[1]&&Body.applyForce(p.parts[1],p.parts[1].position,{x:(Math.random()-.5)*.01,y:0}));if(a.mechanic==='trap'&&Math.floor(hazardClock*2)%5===0)Object.values(players).forEach(p=>{const q=ppos(p);if(p.alive&&q.x>W*.44&&q.x<W*.56&&q.y>H*.30&&q.y<H*.48)p.hp-=dt*14})}
function step(dt){
 if(!engine)return;
 Object.values(players).forEach(p=>{if(p.bot)botThink(p,dt);if(!p.alive)return;const inp=p.input||{};p.shield=!!inp.s;p.cool=Math.max(0,p.cool-dt);p.dashCd=Math.max(0,p.dashCd-dt);const torso=p.parts[1];if(!torso)return;
  Body.applyForce(torso,torso.position,{x:(inp.x||0)*.0024,y:0});
  if(inp.y<-.35&&Math.abs(torso.velocity.y)<1.6)Body.applyForce(torso,torso.position,{x:0,y:-.034});
  if(inp.d&&p.dashCd<=0){p.dashCd=.42;Body.applyForce(torso,torso.position,{x:((inp.x||1)>0?1:-1)*.030,y:-.004})}
  if(inp.a)attack(p);
  p.parts.forEach(b=>b.frictionAir=p.shield?.16:.035);
 });
 applyHazards(dt);
 Engine.update(engine,dt*1000);
 if(weapons.length<5&&Math.random()<dt*.8)spawnWeapon();
 weapons.slice().forEach((w,i)=>{const wp=w.body.position;Object.values(players).forEach(p=>{if(p.weapon>=0||!p.alive)return;const a=ppos(p);if(Math.hypot(a.x-wp.x,a.y-wp.y)<31){p.weapon=w.t;World.remove(world,w.body);weapons=weapons.filter(x=>x!==w)}})});
 Object.values(players).forEach(p=>{if(!p.alive)return;const a=ppos(p);if(a.y>H+120||p.hp<=0)kill(p);});
 const ids=Object.keys(players),alive=ids.filter(id=>players[id].alive);$("alive").textContent=alive.length+'/'+ids.length;
 if(ids.length>=2&&alive.length<=1&&!ended){ended=true;const winner=alive[0]?players[alive[0]].name:'DRAW';if(alive[0]===myId&&!matchRewarded){gold+=250;matchRewarded=true;save()}$('winner').textContent=winner+' WINS';show('result',true)}
}
function drawBackground(){
 const a=arenas[mapIndex];ctx.fillStyle=a.sky;ctx.fillRect(0,0,W,H);
 // original scene dressing per arena
 ctx.save();
 if(mapIndex===0){ctx.fillStyle='#173344';for(let x=0;x<W;x+=150){ctx.fillRect(x,H-205,80,125);ctx.fillRect(x+15,H-185,10,18);ctx.fillRect(x+55,H-165,10,18)}ctx.fillStyle='#d68b5c';ctx.fillRect(W*.74,72,3,105);ctx.fillRect(W*.72,90,W*.09,5)}
 if(mapIndex===1){ctx.fillStyle='#ff704022';for(let i=0;i<10;i++){ctx.beginPath();ctx.arc((i*149)%W,H-115-(i%3)*50,55,0,Math.PI*2);ctx.fill()}ctx.fillStyle='#ff5b2d55';ctx.fillRect(0,H-79,W,12)}
 if(mapIndex===2){ctx.fillStyle='#8ff3ff';for(let i=0;i<65;i++){ctx.globalAlpha=.15+(i%5)*.06;ctx.fillRect((i*83)%W,(i*47)%(Math.max(100,H-100)),2,2)}ctx.globalAlpha=1;for(let x=0;x<W;x+=120){ctx.fillStyle='#0e3b4c';ctx.fillRect(x,H-150-(x%3)*28,70,90)} }
 if(mapIndex===3){ctx.fillStyle='#dffaff55';for(let i=0;i<9;i++){ctx.beginPath();ctx.arc((i*127)%W,90+(i%3)*35,35,0,Math.PI*2);ctx.fill()}ctx.fillStyle='#75d9e933';ctx.fillRect(0,H-150,W,75)}
 if(mapIndex===4||mapIndex===7){ctx.fillStyle='#ffffff';for(let i=0;i<100;i++){ctx.globalAlpha=.12+(i%4)*.08;ctx.fillRect((i*101)%W,(i*59)%Math.max(90,H-100),2,2)}ctx.globalAlpha=1;ctx.fillStyle='#4b4f9955';ctx.beginPath();ctx.arc(W*.78,110,90,0,Math.PI*2);ctx.fill()}
 if(mapIndex===5){ctx.fillStyle='#ffd58d33';for(let i=0;i<7;i++){ctx.beginPath();ctx.arc((i*181)%W,85+(i%2)*50,48,0,Math.PI*2);ctx.fill()}ctx.fillStyle='#8c552f';for(let x=0;x<W;x+=160)ctx.fillRect(x,H-160,100,85)}
 if(mapIndex===6){ctx.fillStyle='#00000044';for(let x=0;x<W;x+=125)ctx.fillRect(x,H-190-(x%220),74,120);ctx.fillStyle='#9c72ce55';ctx.beginPath();ctx.arc(W*.5,115,48,0,Math.PI*2);ctx.fill()}
 ctx.restore();
 ctx.fillStyle=a.ground;ctx.fillRect(0,H-72,W,72);ctx.fillStyle=a.accent;ctx.fillRect(0,H-76,W,4);
 a.layout.forEach(v=>{const x=W*v[0],y=H*v[1],w=W*v[2];ctx.fillStyle=a.platform;ctx.fillRect(x-w/2,y,w,14);ctx.fillStyle=a.accent;ctx.globalAlpha=.7;ctx.fillRect(x-w/2,y,w,3);ctx.globalAlpha=1});
 // hazard strips
 if(a.hazard==='lava'){ctx.fillStyle='#ff5722';ctx.fillRect(0,H-77,W,5)}
 if(a.hazard==='laser'){ctx.fillStyle='#ff2e8a99';const lx=(performance.now()/900%1)*W;ctx.fillRect(lx,H*.25,4,H*.45)}
}
function outfitColor(p){const o=outfits.find(x=>x[0]===outfit)||outfits[0];if(p.n!==1)return ['#65d7ff','#ff758f','#b99aff'][p.n-1]||'#fff';return o[3]}
function drawStick(p){if(!p.alive)return;const a=ppos(p);if(p.parts.length){const [head,torso,a1,a2,l1,l2]=p.parts;ctx.save();ctx.strokeStyle=outfitColor(p);ctx.fillStyle=outfitColor(p);ctx.lineWidth=7;ctx.lineCap='round';ctx.shadowColor='#000';ctx.shadowBlur=6;
  ctx.beginPath();ctx.arc(head.position.x,head.position.y,14,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(head.position.x,head.position.y+13);ctx.lineTo(torso.position.x,torso.position.y);ctx.stroke();[[torso,a1],[torso,a2],[torso,l1],[torso,l2]].forEach(([u,v])=>{ctx.beginPath();ctx.moveTo(u.position.x,u.position.y);ctx.lineTo(v.position.x,v.position.y);ctx.stroke()});
  if(p.shield){ctx.strokeStyle='#65bfff';ctx.lineWidth=5;ctx.beginPath();ctx.arc(torso.position.x,torso.position.y,43,-1.2,1.2);ctx.stroke()}
  if(p.weapon>=0){ctx.font='26px Arial';ctx.fillText(weaponsDef[p.weapon].icon,torso.position.x+28,torso.position.y+8)}
  ctx.shadowBlur=0;ctx.textAlign='center';ctx.font='800 12px Arial';ctx.fillStyle='#fff';ctx.fillText(p.name,head.position.x,head.position.y-28);ctx.fillStyle='#1b2230';ctx.fillRect(head.position.x-31,head.position.y-21,62,5);ctx.fillStyle=p.hp>40?'#55e47d':'#ff5b64';ctx.fillRect(head.position.x-31,head.position.y-21,62*Math.max(0,p.hp)/100,5);ctx.restore();
 }else{ // guest / remote visual ragdoll
  ctx.save();ctx.translate(a.x,a.y);ctx.rotate(p.remote.angle||0);ctx.strokeStyle=outfitColor(p);ctx.lineWidth=7;ctx.lineCap='round';ctx.beginPath();ctx.arc(0,-43,14,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(0,-29);ctx.lineTo(0,-8);ctx.moveTo(0,-8);ctx.lineTo(-21,2);ctx.moveTo(0,-8);ctx.lineTo(21,2);ctx.moveTo(0,-8);ctx.lineTo(-11,34);ctx.moveTo(0,-8);ctx.lineTo(11,34);ctx.stroke();if(p.shield){ctx.strokeStyle='#65bfff';ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,-10,43,-1.2,1.2);ctx.stroke()}if(p.weapon>=0){ctx.font='26px Arial';ctx.fillText(weaponsDef[p.weapon].icon,30,0)}ctx.restore();ctx.textAlign='center';ctx.font='800 12px Arial';ctx.fillStyle='#fff';ctx.fillText(p.name,a.x,a.y-72);ctx.fillStyle='#1b2230';ctx.fillRect(a.x-31,a.y-65,62,5);ctx.fillStyle=p.hp>40?'#55e47d':'#ff5b64';ctx.fillRect(a.x-31,a.y-65,62*Math.max(0,p.hp)/100,5)} }
function drawWeapons(){weapons.forEach(w=>{const q=w.body?.position;if(!q)return;const d=weaponsDef[w.t];ctx.save();ctx.translate(q.x,q.y);ctx.rotate(Math.sin(performance.now()/300+w.phase)*.08);ctx.font='34px Arial';ctx.textAlign='center';ctx.shadowColor=d.color;ctx.shadowBlur=14;ctx.fillText(d.icon,0,11);ctx.restore()})}
function drawParticles(dt){particles=particles.filter(p=>p.life>0);particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.15;p.life-=dt;ctx.globalAlpha=Math.max(0,p.life/.35);ctx.fillStyle='#fff';ctx.fillRect(p.x,p.y,4,4)});ctx.globalAlpha=1}
function draw(){drawBackground();drawWeapons();Object.values(players).forEach(drawStick);drawParticles(Math.min(.033,(performance.now()-last)/1000||0));}
function startLocalMatch(withBots){gameType=withBots?'bots':'local';host=true;room='';myId='LOCAL-1';players={};connections=[];ended=false;matchRewarded=false;players[myId]=createPlayer(myId,1);players[myId].name='YOU';for(let i=2;i<=3;i++){const id=(withBots?'BOT-':'LOCAL-')+i,p=createPlayer(id,i);p.name=withBots?'BOT '+(i-1):'P'+i;p.bot=withBots;players[id]=p}setGame(true);$('roomText').textContent=withBots?'VS COMPUTER':'LOCAL 3P';$('arenaText').textContent=arenas[mapIndex].name;initPhysics()}
function startFriendsCreate(){gameType='friends';host=true;room=roomCode();bootNetwork('SA-'+room)}
function broadcast(){if(!host)return;const snap={type:'state',mapIndex,weapons:weapons.map(w=>({id:w.id,t:w.t,x:w.body.position.x,y:w.body.position.y})),players:{}};Object.values(players).forEach(p=>{const a=ppos(p);snap.players[p.id]={id:p.id,name:p.name,n:p.n,x:a.x,y:a.y,angle:p.parts[1]?.angle||0,hp:p.hp,alive:p.alive,shield:p.shield,weapon:p.weapon}});connections.forEach(c=>{if(c.open)c.send(snap)})}
function applySnapshot(s){mapIndex=s.mapIndex;Object.values(s.players).forEach(sp=>{let p=players[sp.id];if(!p){p=createPlayer(sp.id,sp.n);players[sp.id]=p}p.name=sp.name;p.n=sp.n;p.hp=sp.hp;p.alive=sp.alive;p.shield=sp.shield;p.weapon=sp.weapon;p.remote={x:sp.x,y:sp.y,angle:sp.angle||0};if(sp.id===myId){p.remote.x=sp.x;p.remote.y=sp.y}});Object.keys(players).forEach(id=>{if(!s.players[id])delete players[id]});remoteWeapons=s.weapons||[]}
let remoteWeapons=[];
function drawRemoteWeapons(){remoteWeapons.forEach(w=>{ctx.font='34px Arial';ctx.textAlign='center';ctx.fillText(weaponsDef[w.t]?.icon||'?',w.x,w.y+11)})}
function loop(t){const dt=Math.min(.033,(t-last)/1000||0);last=t;if(mode==='game'){if(host){if(players[myId])players[myId].input=localInput();step(dt);broadcast()}else if(hostConn?.open)hostConn.send({type:'input',id:myId,input:localInput()});draw();if(!host){drawRemoteWeapons()}}requestAnimationFrame(loop)}requestAnimationFrame(loop);
function bootNetwork(id){peer=new Peer(id);peer.on('open',()=>{if(host){myId=id;players[id]=createPlayer(id,1);setGame(true);initPhysics();$("roomText").textContent='ROOM '+room;$("roomMsg").innerHTML='ROOM <b>'+room+'</b><br>Bagikan kode ke teman.'}else{myId=id;hostConn=peer.connect('SA-'+room,{reliable:true});wireGuest(hostConn)}});peer.on('connection',c=>{if(host&&Object.keys(players).length<3){connections.push(c);c.on('open',()=>{const n=Object.keys(players).length+1;players[c.peer]=createPlayer(c.peer,n);rebuildHostPhysics();wireHost(c);broadcast()})}});peer.on('error',e=>alert('Koneksi gagal: '+e.type))}
function wireHost(c){c.on('data',d=>{if(d.type==='input'&&players[d.id])players[d.id].input=d.input});c.on('close',()=>{if(players[c.peer]){removePlayerBodies(players[c.peer]);delete players[c.peer]}connections=connections.filter(x=>x!==c);broadcast()})}
function wireGuest(c){c.on('open',()=>{setGame(true)});c.on('data',d=>{if(d.type==='state')applySnapshot(d)});c.on('close',()=>alert('Host keluar dari room.'))}
vsComputer.onclick=()=>startLocalMatch(true);localPlay.onclick=()=>startLocalMatch(false);friends.onclick=()=>$('friendsBox').classList.toggle('hidden');create.onclick=()=>startFriendsCreate();join.onclick=()=>{room=code.value.trim().toUpperCase();if(room.length!==6)return alert('Kode room harus 6 karakter.');gameType='friends';host=false;bootNetwork('SG-'+roomCode())};
quit.onclick=()=>location.reload();back.onclick=()=>location.reload();
rematch.onclick=()=>{show('result',false);ended=false;if(host){Object.values(players).forEach(p=>{p.alive=true;p.hp=100;p.weapon=-1;p.input={x:0,y:0,a:false,s:false,d:false};});weapons=[];rebuildHostPhysics();broadcast()}};
shop.onclick=()=>{$("shopList").innerHTML=outfits.map(o=>`<div class="item"><div class="itemIcon" style="--c:${o[3]}">${o[1]}</div><span class="name"><b>${o[0]}</b><small>${owned.includes(o[0])?(outfit===o[0]?'EQUIPPED':'OWNED'):o[2]+' GOLD'}</small></span><button data-o="${o[0]}">${owned.includes(o[0])?(outfit===o[0]?'OK':'EQUIP'):'BUY'}</button></div>`).join('');$("shopList").querySelectorAll('button').forEach(b=>b.onclick=()=>{const o=outfits.find(x=>x[0]===b.dataset.o);if(owned.includes(o[0])){outfit=o[0];save();shop.click()}else if(gold>=o[2]){gold-=o[2];owned.push(o[0]);outfit=o[0];save();shop.click()}else alert('Gold belum cukup.')});show('shopModal')};
maps.onclick=()=>{$("mapList").innerHTML=arenas.map((a,i)=>`<div class="mapitem"><span><b>${String(i+1).padStart(2,'0')}</b> ${a.name}<small>${a.hazard.toUpperCase()} ARENA</small></span><button data-i="${i}">SELECT</button></div>`).join('');$("mapList").querySelectorAll('button').forEach(b=>b.onclick=()=>{mapIndex=+b.dataset.i;$("arenaText").textContent=arenas[mapIndex].name;show('mapModal',false)});show('mapModal')};
help.onclick=()=>show('helpModal');document.querySelectorAll('.close').forEach(x=>x.onclick=()=>x.closest('.modal').classList.add('hidden'));
addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true;if(e.key===' ')e.preventDefault()});addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
function touchSetup(){const j=$('joy'),dot=$('joyDot');function move(e){e.preventDefault();const t=e.touches[0],r=j.getBoundingClientRect(),x=t.clientX-r.left-r.width/2,y=t.clientY-r.top-r.height/2,d=Math.min(42,Math.hypot(x,y)),a=Math.atan2(y,x);touch.x=Math.cos(a)*d/42;touch.y=Math.sin(a)*d/42;dot.style.transform=`translate(${touch.x*42}px,${touch.y*42}px)`}j.addEventListener('touchstart',move,{passive:false});j.addEventListener('touchmove',move,{passive:false});j.addEventListener('touchend',()=>{touch.x=touch.y=0;dot.style.transform=''});function hold(id,k){const b=$(id);b.addEventListener('touchstart',e=>{e.preventDefault();touch[k]=true},{passive:false});b.addEventListener('touchend',()=>touch[k]=false)}hold('mAttack','attack');hold('mShield','shield');$('mDash').addEventListener('touchstart',e=>{e.preventDefault();touch.dash=true;setTimeout(()=>touch.dash=false,160)},{passive:false})}touchSetup();
