import * as THREE from 'three';
import {MINIONS} from './minions.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CHARACTERS} from '../functions/shared/catalog.js';

export class Character {
  constructor(model, team, name, maxHealth, speed) {
    this.model = model; this.team = team; this.name = name; this.maxHealth = maxHealth; this.speed = speed;
    this.position = model.position; this.active = false; this.state = 'IDLE';
    this.health = maxHealth; this.shotTimer = 0; this.hitTime = 0; this.deathTime = 0;
    this.phase = Math.random() * 6.28; this.moving = false;
    this.head = new THREE.Sphere(new THREE.Vector3(), .48);
    this.body = new THREE.Sphere(new THREE.Vector3(), .85);
    this.direction = { x: 0, z: 0 };
    this.cooldowns=new Float32Array(3);this.status={};this.shield=0;
  }
  configure(id,boss=false){this.spec=CHARACTERS[id]||MINIONS[id];this.id=id;this.kind=this.spec.model;this.name=this.spec.name;this.team=this.spec.team;this.maxHealth=boss?1000:this.spec.hp;this.health=this.maxHealth;this.speed=10*this.spec.speed;this.fireRate=this.spec.weapon.interval;this.boss=boss;this.size=this.spec.height/2.6*(boss?2.3:1);this.model.scale.setScalar(this.size);return this;}
  spawn(x, z) {
    this.position.set(x, 0, z); this.health = this.maxHealth; this.active = true;
    this.state = 'CHASE'; this.shotTimer = .6; this.hitTime = this.deathTime = 0;
    this.model.visible = true; this.model.rotation.set(0, 0, 0); this.model.scale.setScalar(this.size||1);
    this.status={};this.link=null;this.poisonSource=null;this.moving=false;this.cooldowns.fill(0);this.shield=0;this.ammo=this.spec?.weapon.magazine||0;this.reload=0;this.respawnTimer=0;
    this.flashTime=0;this.syncHitboxes();
  }
  damage(amount) {
    if (!this.active || this.health <= 0) return false;
    this.health = Math.max(0, this.health - amount); this.hitTime = .16;
    if (!this.health) { this.active = false; this.deathTime = .65; this.state = 'DEAD'; return true; }
    return false;
  }
  syncHitboxes() {
    const r = this.model.userData.rig;
    const scale=this.size||1;
    this.head.center.copy(this.position); this.head.center.y += ((r.headHeight || 2.05) + (r.body.position.y || 0))*scale;
    this.body.center.copy(this.position); this.body.center.y += (1.15 + (r.body.position.y || 0))*scale;
    this.head.radius = (r.headRadius || .48)*scale; this.body.radius = (r.bodyRadius || .85)*scale;
  }
  animate(dt, time) {
    const rig = this.model.userData.rig;
    this.hitTime = Math.max(0, this.hitTime - dt);
    if (this.deathTime > 0) {
      this.deathTime -= dt; this.model.rotation.z += dt * 2.5;
      this.model.scale.setScalar(Math.max(.01, this.deathTime / .65)*(this.size||1));
      if (this.deathTime <= 0) this.model.visible = false;
      return;
    }
    if (!this.active) return;
    const stride = this.moving ? Math.sin(time * this.speed * 2.4 + this.phase) * .65 : 0;
    rig.legs[0].rotation.x = stride; rig.legs[1].rotation.x = -stride;
    rig.arms[0].rotation.x = -.35 - stride * .35;
    rig.arms[1].rotation.x = this.shotTimer > .8 ? -1.0 : -.5 + stride * .25;
    rig.body.position.y = this.kind === 'specter' ? 1.25 + Math.sin(time * 2.6 + this.phase) * .3
      : Math.sin(time * 2 + this.phase) * .045 + Math.abs(stride) * .13;
    rig.body.rotation.z = this.hitTime > 0 ? Math.sin(this.hitTime * 90) * .13 : stride * .03;
    if (rig.wings) rig.wings.forEach((wing, i) => { wing.rotation.z = (i ? -1 : 1) * (.4 + Math.sin(time * 8) * .28); });
    this.flashTime=Math.max(0,(this.flashTime||0)-dt);if(rig.flash)rig.flash.visible=this.flashTime>0;
    if(rig.aura){rig.aura.visible=!this.model.userData.simpleSkins&&(rig.special||!!this.status.aura);rig.aura.rotation.y=time*.65;rig.aura.scale.setScalar((this.status.aura?1.25:1)*(1+Math.sin(time*3+this.phase)*.06));}
    this.syncHitboxes();
  }
}
export class Toy extends Character {
  constructor(model, kind = 'commando') {
    super(model, 'toys', {commando:'Comando aliado',medic:'Osito Médico',mech:'Meca-Bloque'}[kind], kind === 'mech' ? 240 : 140, 5);
    this.kind = kind; this.fireRate = kind === 'mech' ? 1.2 : .8;
  }
}
export class Nightmare extends Character {
  constructor(model, kind = 'claw') {
    super(model, 'nightmares', {claw:'Sombra Garras',ogre:'Ogro de Baba',specter:'Espectro Volador'}[kind], {claw:85,ogre:175,specter:105}[kind], {claw:5.4,ogre:3.3,specter:4.1}[kind]);
    this.kind = kind; this.fireRate = {claw:1.2,ogre:2.2,specter:2.8}[kind];
  }
}

/** Rig articulado de primitivas. Las articulaciones se animan, no el collider.
 * Todos los modelos comparten las geometrías y materiales del mundo.
 */
export function createCharacterModel(world, kind = 'commando', spec=null) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const enemy = spec?spec.team==='nightmares':['claw','ogre','specter'].includes(kind);
  const color = spec?.color||{commando:'#60b9a0',medic:'#d9a775',mech:'#efbe60',claw:'#65528b',ogre:'#76924e',specter:'#787cca'}[kind];
  const dark = enemy ? '#30273f' : '#254f52';
  const legs = [], arms = [];
  const rig = {body,legs,arms,headHeight:2.15,headRadius:.5,bodyRadius:.8}; root.userData.rig = rig;
  const torso=kind==='ogre'||kind==='medic'?world.sphere(color,[0,1.23,0],[kind==='ogre'?.95:.57,.68,.52],body):world.roundBox(color,[0,1.27,0],[.95,1.05,.7],body);
  if (kind === 'mech') torso.scale.set(1.4,1.1,.95);
  const headColor = enemy ? color : kind==='medic'?color:'#f4dcb0';
  world.sphere(headColor,[0,2.08,0],[.49,.48,.44],body);
  if (kind === 'commando') {
    world.sphere(color,[0,2.36,-.03],[.54,.3,.49],body);
    world.roundBox(color,[0,2.2,.25],[1.1,.12,.6],body);
    world.roundBox('#f3d878',[0,1.5,.37],[.22,.22,.04],body);
  }
  if (kind==='medic') for (const x of [-.4,.4]) world.sphere(color,[x,2.5,0],[.22,.24,.17],body);
  if (kind==='medic') { world.roundBox('#fff2ce',[0,1.4,.39],[.15,.48,.04],body); world.roundBox('#fff2ce',[0,1.4,.4],[.45,.15,.04],body); }
  if (enemy) {
    for (const x of [-.4,.4]) { const horn=world.mesh(world.cylinderGeometry,dark,[x,2.53,0],[.12,.55,.12],body); horn.rotation.z=x; }
    world.roundBox('#e7d4a7',[0,1.91,.41],[.32,.07,.12],body);
  }
  for (const x of [-.19,.19]) world.sphere(enemy?'#ff837a':'#142c32',[x,2.13,.41],[.1,.09,.055],body);
  for (const sign of [-1,1]) {
    const leg = new THREE.Group(); leg.position.set(sign*.3,.9,0); body.add(leg); legs.push(leg);
    world.roundBox(color,[0,-.35,0],[.38,.7,.4],leg); world.roundBox(dark,[0,-.76,.14],[.48,.27,.7],leg);
    const arm = new THREE.Group(); arm.position.set(sign*(kind==='ogre'?.98:.65),1.65,0); body.add(arm); arms.push(arm);
    world.roundBox(color,[0,-.36,0],[.32,.7,.36],arm); world.sphere(headColor,[0,-.78,.06],[.19,.2,.2],arm);
    if (kind==='claw') for (let j=0;j<3;j++) world.roundBox('#b8a9e2',[(j-1)*.11,-.88,.23],[.05,.32,.08],arm);
  }
  const gun = new THREE.Group(); gun.position.set(-.72,1.42,.35); body.add(gun); rig.gun=gun;
  if (kind!=='claw') {
    world.roundBox(enemy?'#403b60':'#e6b64a',[0,0,.38],[.38,.36,1.45],gun);
    world.roundBox(enemy?'#b0ff79':'#ff8861',[0,0,1.03],[.39,.39,.18],gun);
    world.roundBox(dark,[0,-.22,.2],[.2,.45,.25],gun);
  }
  const flash=world.sphere(enemy?'#b9f774':'#fff9ad',[0,0,1.18],[.27,.27,.44],gun);
  flash.material = world.material(enemy?'#c3ff7c':'#fff4b0'); flash.visible=false; rig.flash=flash;
  if (kind==='specter') {
    rig.wings=[];
    for (const sign of [-1,1]) { const wing=world.roundBox('#4b426f',[sign*.95,1.6,-.2],[1.6,.12,.85],body); rig.wings.push(wing); }
  }
  if(!spec)finishHero(world,root,{id:kind,model:kind,team:enemy?'nightmares':'toys',color});
  return root;
}

export function createRosterModel(world,id){
 const c=CHARACTERS[id],base={glider:'commando',dino:'ogre',monkey:'medic',rag:'medic',porcelain:'mech',musicghost:'specter'}[c.model]||c.model;
 const root=createCharacterModel(world,base,c),rig=root.userData.rig,body=rig.body;
 if(['glider','specter'].includes(c.model)&&!rig.wings){rig.wings=[];for(const s of [-1,1])rig.wings.push(world.roundBox(c.color,[s*.95,1.7,-.2],[1.5,.13,.85],body));}
 if(c.model==='dino'){world.sphere(c.color,[0,2.08,.5],[.48,.3,.65],body);const tail=world.roundBox(c.color,[0,.95,-.95],[.3,.3,1.5],body);tail.rotation.x=-.25;for(let i=0;i<4;i++)world.roundBox('#d3de89',[0,1.3-i*.08,-.4-i*.25],[.12,.25,.18],body);}
 if(c.model==='monkey'){for(const s of [-1,1]){const cymbal=world.mesh(world.cylinderGeometry,'#eace73',[s*.85,1.05,.5],[.4,.08,.4],body);cymbal.rotation.z=Math.PI/2;}world.roundBox('#c0c7ad',[0,1.4,-.7],[.8,.15,.18],body);}
 if(c.model==='specter'){world.sphere('#e0d7ef',[0,2.1,.25],[.51,.51,.5],body);world.sphere('#3a253f',[0,2.1,.69],[.2,.26,.1],body);}
 if(c.model==='rag'){for(let i=0;i<5;i++)world.roundBox('#453a44',[(i-2)*.17,1.3,.38],[.08,.2,.03],body);for(const x of [-.19,.19])world.sphere('#d66978',[x,2.13,.46],[.12,.12,.05],body);}
 if(c.model==='porcelain'){for(const x of [-.32,.24]){const crack=world.roundBox('#be89d9',[x,1.4,.49],[.045,.9,.03],body);crack.rotation.z=x;}rig.bodyRadius=1.05;}
 if(c.model==='musicghost'){world.roundBox('#66518b',[0,.55,0],[1.2,.55,1],body);for(let i=0;i<5;i++)world.roundBox('#eee1bd',[(i-2)*.2,.8,.55],[.14,.09,.2],body);}
 // Siluetas de armas propias de cada personaje, con fogonazo en el mismo rig.
 const gun=rig.gun;
 for(const child of [...gun.children])if(child!==rig.flash)gun.remove(child);
 if(['captain','sora','costura'].includes(id)){
   const color=id==='captain'?'#409dcc':id==='sora'?'#bddde7':'#665266';
   world.roundBox(color,[0,0,.38],[.4,.34,1.1],gun);
   world.roundBox('#263c48',[0,-.25,.12],[.22,.48,.25],gun);
   world.roundBox('#223844',[0,.23,.15],[.2,.17,.5],gun);
   const barrel=world.mesh(world.cylinderGeometry,id==='captain'?'#f3c650':'#8febf3',[0,0,1],[.12,.55,.12],gun);barrel.rotation.x=Math.PI/2;
   for(const x of [-.22,.22])world.roundBox('#f1d787',[x,0,.45],[.04,.12,.7],gun);
 }else if(['felpa','gargajo','meca'].includes(id)){
   const barrel=world.mesh(world.cylinderGeometry,id==='felpa'?'#dba5ba':id==='gargajo'?'#665077':'#e6bd61',[0,0,.45],[.35,1.25,.35],gun);barrel.rotation.x=Math.PI/2;
   world.sphere(id==='felpa'?'#fff2ef':id==='gargajo'?'#ad75bf':'#ed854f',[0,0,1.05],[.29,.29,.16],gun);
   if(id==='meca')for(const x of [-.2,.2])world.roundBox('#e97351',[x,.35,.3],[.22,.25,.25],gun);
 }else if(id==='sombrio'){
   for(const arm of rig.arms){const blade=world.roundBox('#c7b1e5',[0,-.91,.45],[.1,.18,.75],arm);blade.rotation.x=.2;}
 }else if(id==='titan'){
   for(const arm of rig.arms){world.roundBox('#ddd5ca',[0,-.83,.2],[.65,.6,.65],arm);for(let i=0;i<4;i++){const chain=world.mesh(world.cylinderGeometry,'#635967',[.25,-.3-i*.13,.3],[.08,.12,.08],arm);chain.rotation.x=i%2?Math.PI/2:0;}}
 }else if(id==='dino'){
   gun.position.set(0,2,.5);
   for(const x of [-.32,-.16,0,.16,.32])world.roundBox('#f4e6bd',[x,1.93,.95],[.08,.15,.15],body);
 }
 if(c.hitbox==='Grande')rig.bodyRadius=1.05;else if(c.hitbox==='Pequeña')rig.bodyRadius=.65;
 finishHero(world,root,c);root.scale.setScalar(c.height/2.6);return root;
}

/** Rounded modular silhouettes, shared PBR finishes and mechanical details. */
function finishHero(world,root,c){
 const rig=root.userData.rig,body=rig.body,gun=rig.gun,enemy=c.team==='nightmares';
 const finish=c.model==='rag'||c.model==='claw'?'cloth':c.model==='ogre'?'slime':c.model==='porcelain'?'porcelain':'plastic';
 root.traverse(m=>{if(m.isMesh)m.material=world.surface('#'+m.material.color.getHexString(),finish);});
 const part=(color,p,s,parent=body,type='plastic')=>{const m=world.roundBox(color,p,s,parent);m.material=world.surface(color,type);return m;};
 const glow=(p,s,parent=body)=>{const mesh=part(enemy?'#d977ff':'#68f8ec',p,s,parent,'glow');mesh.userData.simpleSkinDetail=true;return mesh;};
 // Collar, layered vest, belt, kneepads, separate elbow and shoulder joints.
 if(!['ogre','specter','dino','musicghost'].includes(c.model)){
  part(enemy?'#30203e':'#173f59',[0,1.35,.39],[.79,.64,.19],body,finish);
  part('#263541',[0,.85,.04],[1.01,.16,.78],body,'metal');
  for(const s of [-1,1]){part(c.color,[s*.32,1.18,.51],[.2,.28,.16]);part('#d3ad61',[s*.22,.85,.45],[.18,.13,.08],body,'metal');}
  glow([0,1.54,.5],[.25,.055,.05]);
 }
 for(const [i,arm] of rig.arms.entries()){
  part(c.color,[0,-.1,0],[.5,.34,.48],arm,finish);
  const joint=world.sphere('#364451',[0,-.49,0],[.18,.18,.2],arm);joint.material=world.surface('#364451','metal');
  part(c.color,[0,-.66,.04],[.39,.28,.41],arm,finish);
  part('#94a9b8',[0,-.64,.26],[.22,.1,.07],arm,'metal');
 }
 for(const leg of rig.legs){part(c.color,[0,-.37,.22],[.4,.3,.16],leg,finish);part('#344854',[0,-.73,.36],[.43,.19,.3],leg,'metal');}
 if(c.id==='captain'||c.id==='sora'){
  part('#173c55',[0,2.17,.4],[.88,.25,.16],body,'metal');glow([0,2.2,.49],[.64,.05,.035]);
  for(const s of [-1,1])part(c.color,[s*.5,2.16,0],[.17,.37,.37]);
  part('#f4be52',[0,2.51,-.02],[.14,.08,.57]);part('#193b54',[0,1.42,-.45],[.68,.75,.3],body,'metal');
 }
 if(c.id==='felpa'){part('#f3ded5',[0,2.44,.1],[.75,.15,.56]);part('#f26493',[0,2.48,.4],[.1,.2,.045]);part('#f26493',[0,2.48,.4],[.26,.07,.05]);part('#fff4df',[0,1.32,-.5],[.8,.65,.35]);}
 if(c.id==='meca'||c.id==='titan'){for(const s of [-1,1]){part(c.color,[s*.7,1.65,0],[.58,.48,.97]);glow([s*.36,1.35,.58],[.065,.6,.04]);}part('#25394a',[0,2.1,.43],[.85,.3,.15],body,'metal');glow([0,2.12,.53],[.53,.08,.03]);}
 if(c.id==='sombrio'||c.id==='costura'){
  // A scalloped cloth mantle and cowl create a distinct silhouette.
  for(const s of [-1,1]){const hood=part(c.color,[s*.48,2.1,-.03],[.21,.74,.66],body,'cloth');hood.rotation.z=-s*.2;}
  part(c.color,[0,2.52,-.08],[.92,.2,.7],body,'cloth');
  for(let i=0;i<5;i++){const cape=part('#302044',[(i-2)*.21,1.05,-.51],[.25,1.38,.16],body,'cloth');cape.rotation.x=-.17;cape.rotation.z=(i-2)*.045;}
 }
 if(c.id==='gargajo'){for(let i=0;i<7;i++){const bubble=world.sphere('#c584ed',[Math.cos(i*2.4)*.7,1+Math.sin(i*2.4)*.35,.49],[.16,.2,.15],body);bubble.material=world.surface('#c584ed','slime');}}
 if(c.id==='ocular'||c.id==='susurro'){const crown=new THREE.Mesh(new THREE.TorusGeometry(.67,.035,6,24),world.surface('#c796ff','glow'));crown.rotation.x=Math.PI/2;crown.position.y=2.65;crown.userData.simpleSkinDetail=true;body.add(crown);}
 if(!['dino','titan','chispita','sombrio','susurro'].includes(c.id)){
  // Machined barrel jacket, muzzle collar, top rail and emissive power cells.
  for(const z of [.63,.86,1.08]){const collar=world.mesh(world.cylinderGeometry,'#a2b5c8',[0,0,z],[.19,.1,.19],gun);collar.rotation.x=Math.PI/2;collar.material=world.surface('#a2b5c8','metal');}
  part('#253849',[0,.2,.32],[.23,.12,.85],gun,'metal');
  for(const x of [-.22,.22])glow([x,.03,.37],[.035,.075,.61],gun);
  part(c.color,[0,-.28,.43],[.28,.4,.36],gun);part('#d5dfed',[0,0,1.14],[.2,.2,.05],gun,'metal');
 }
 rig.flash.material=world.surface(enemy?'#d996ff':'#ffcf5f','glow');
 rig.special=enemy||c.id==='felpa'||c.id==='sora';rig.aura=new THREE.Group();rig.aura.userData.simpleSkinDetail=true;root.add(rig.aura);
 const auraMaterial=world.surface(enemy?'#9863ef':'#5ee4d2','glow');const ring=new THREE.Mesh(new THREE.TorusGeometry(.77,.018,4,32),auraMaterial);ring.rotation.x=Math.PI/2;ring.position.y=.08;rig.aura.add(ring);
 const motes=new THREE.InstancedMesh(world.sphereGeometry,auraMaterial,6),matrix=new THREE.Matrix4();for(let i=0;i<6;i++){const a=i*Math.PI/3;matrix.makeScale(.045,.045,.045);matrix.setPosition(Math.cos(a)*.78,.13+i*.065,Math.sin(a)*.78);motes.setMatrixAt(i,matrix);}rig.aura.add(motes);rig.aura.visible=rig.special;
 batchRig(root,rig.flash);
}
function batchRig(root,flash){
 const groups=[];root.traverse(n=>{if(n.isGroup)groups.push(n);});
 for(const group of groups){const materials=new Map();for(const m of [...group.children])if(m.isMesh&&!m.isInstancedMesh&&m!==flash&&!root.userData.rig.wings?.includes(m)&&!m.material.transparent){m.updateMatrix();const list=materials.get(m.material)||[];list.push(m);materials.set(m.material,list);}
  for(const [material,meshes] of materials){if(meshes.length<2)continue;const copies=meshes.map(m=>(m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone()).applyMatrix4(m.matrix)),geometry=mergeGeometries(copies,false);copies.forEach(g=>g.dispose());if(!geometry)continue;const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);meshes.forEach(m=>group.remove(m));}
 }
}
export function createMinionModel(world,id){
 const spec=MINIONS[id],root=new THREE.Group(),body=new THREE.Group();root.add(body);const legs=[],arms=[],slime=id==='slimelet';
 const rig={body,legs,arms,headHeight:slime?1.7:1.9,headRadius:.55,bodyRadius:slime?1:.7};root.userData.rig=rig;
 const blob=world.sphere(spec.color,[0,slime?1.1:1.25,0],slime?[1.05,.94,.91]:[.68,.74,.64],body);blob.material=world.surface(spec.color,slime?'slime':'cloth');
 const head=world.sphere(spec.color,[0,1.85,.12],[slime?.78:.66,.65,.58],body);head.material=blob.material;
 for(const s of [-1,1]){const eye=world.sphere(slime?'#baff64':'#ff719d',[s*.23,1.98,.65],[.16,.12,.06],body);eye.material=world.surface(slime?'#baff64':'#ff719d','glow');
  const leg=new THREE.Group();leg.position.set(s*.44,.62,0);body.add(leg);legs.push(leg);const foot=world.sphere(spec.color,[0,-.3,.2],[.29,.34,.42],leg);foot.material=blob.material;
  const arm=new THREE.Group();arm.position.set(s*.65,1.15,0);body.add(arm);arms.push(arm);const claw=world.roundBox('#ded5eb',[0,-.3,.16],[.14,.5,.2],arm);claw.rotation.x=-.5;
  if(!slime){const ear=new THREE.Mesh(new THREE.ConeGeometry(.27,.7,8),blob.material);ear.position.set(s*.48,2.41,0);ear.rotation.z=-s*.3;body.add(ear);}
 }
 const mouth=world.sphere('#1f122e',[0,1.63,.65],[.31,.2,.09],body);mouth.material=world.surface('#1f122e','cloth');
 for(const x of [-.19,0,.19])world.roundBox('#f6edd6',[x,1.71,.74],[.08,.16,.04],body);
 const gun=new THREE.Group();gun.position.set(0,1.65,.65);body.add(gun);rig.gun=gun;
 const flash=world.sphere('#bff677',[0,0,.15],[.16,.16,.16],gun);flash.material=world.surface('#bff677','glow');flash.visible=false;rig.flash=flash;
 if(slime)for(let i=0;i<5;i++){const b=world.sphere('#d794ee',[Math.sin(i*2)*.75,1.1+Math.cos(i*2)*.5,-.6],[.16,.16,.16],body);b.material=world.surface('#d794ee','slime');}
 batchRig(root,flash);return root;
}
