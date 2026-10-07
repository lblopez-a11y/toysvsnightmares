import * as THREE from 'three';
import {GAME} from './config.js';
import {audio} from './audio.js';
import {ObjectPool} from './core.js';
import {BotSteering,resetStuck,sampleStuck} from './ai-steering.js';
import {MINIONS,waveEnemyId} from './minions.js';
import {Character,createRosterModel,createMinionModel} from './characters.js';
import {Navigation} from './navigation.js';
import {Effects} from './effects.js';
import {Match} from './match.js';
import {ROSTER,CHARACTERS,SECTORS,MODES} from '../functions/shared/catalog.js';
import {useAbility,statusTick} from './abilities.js';
import {ModeSystems} from './mode-systems.js';
import {BASES,planRoute} from './routes.js';
import {DamageNumbers} from './damage-numbers.js';
import {applyCharacterGraphics} from './graphicsSettings.js';

/** Coordinador de partida: bancos estables de actores, IA y reglas por modo. */
export class Battle extends ModeSystems {
 constructor(engine){
  super();this.engine=engine;this.world=engine.world;this.ui=engine.ui;this.match=new Match();this.effects=new Effects(this.world);this.damageNumbers=new DamageNumbers();this.base=new THREE.Vector3();this.objective=new THREE.Vector3();this.time=0;this.started=false;
  this.nav=new Navigation(GAME.worldSize,2.5,(x,z)=>this.world.blocked(x,z,0,1));this.objectiveField=this.nav.field();this.navTimer=0;this.banks={};this.steering=new BotSteering(this.world);this.cameraRight=new THREE.Vector3();this.cameraUp=new THREE.Vector3();this.coreTarget={isCore:true,body:{center:new THREE.Vector3(0,1.3,0)}};this.coreHitArea=new THREE.Sphere(this.coreTarget.body.center,1.7);
  for(const team of ['toys','nightmares']){const specs=ROSTER.filter(c=>c.team===team);this.banks[team]=new ObjectPool(team==='nightmares'?24:6,i=>{const c=specs[i%6],model=createRosterModel(this.world,c.id);this.world.root.add(model);model.visible=false;const actor=new Character(model,team,c.name,c.hp,10*c.speed).configure(c.id);actor.slot=i;actor.homeId=c.id;actor.homeModel=model;actor.label=this.makeLabel(actor);return actor;},actor=>{actor.active=false;actor.model.visible=false;actor.label.hidden=true;});}
  this.player=new Character(engine.playerVisual,'toys','Capitán Espuma',125,10).configure('captain');this.player.position=engine.position;this.lastPlayerPosition=engine.position.clone();this.playerVelocity={vx:0,vy:0,vz:0};this.actors=[this.player,...this.banks.toys.items,...this.banks.nightmares.items];
  const scanMaterial=new THREE.MeshStandardMaterial({roughness:.45,metalness:.08,color:'#e898e1',wireframe:true,transparent:true,opacity:.5,depthTest:false,depthWrite:false});
  for(const actor of this.actors){const silhouette=new THREE.Mesh(this.world.boxGeometry,scanMaterial);silhouette.visible=false;silhouette.renderOrder=10;this.world.root.add(silhouette);actor.silhouette=silhouette;}
  this.objectiveLabel=document.createElement('div');this.objectiveLabel.className='objective-marker';this.objectiveLabel.hidden=true;document.querySelector('#actor-labels').append(this.objectiveLabel);
    this.projectiles=new ObjectPool(96,()=>{const fullMaterial=new THREE.MeshStandardMaterial({roughness:.35,metalness:.08,color:'#fff5af',emissive:'#fff5af',emissiveIntensity:.55}),fastMaterial=new THREE.MeshBasicMaterial({color:'#fff5af'}),mesh=new THREE.Mesh(this.world.sphereGeometry,fullMaterial);mesh.visible=false;this.world.root.add(mesh);return {mesh,fullMaterial,fastMaterial,position:mesh.position,velocity:new THREE.Vector3(),life:0,owner:null,target:null};},p=>p.mesh.visible=false);
  for(const p of this.projectiles.items){p.bombDetails=new THREE.Group();p.mesh.add(p.bombDetails);const band=new THREE.Mesh(new THREE.TorusGeometry(1,.13,6,20),new THREE.MeshStandardMaterial({roughness:.45,metalness:.08,color:'#e9514c'}));band.rotation.x=Math.PI/2;p.bombDetails.add(band);this.world.mesh(this.world.cylinderGeometry,'#eeb75a',[0,1.2,0],[.13,.5,.13],p.bombDetails);p.spark=this.world.sphere('#ffdf70',[0,1.55,0],[.2,.2,.2],p.bombDetails);p.bombDetails.visible=false;}
  this.zones=new ObjectPool(24,()=>{const mesh=new THREE.Mesh(new THREE.CylinderGeometry(1,1,.12,32),new THREE.MeshStandardMaterial({roughness:.45,metalness:.08,color:'#b5df9e',transparent:true,opacity:.3,depthWrite:false}));mesh.visible=false;this.world.root.add(mesh);return {mesh,position:mesh.position,life:0};},z=>z.mesh.visible=false);
  for(const z of this.zones.items){z.icons=[];for(let i=0;i<2;i++){const eye=new THREE.Group();const orb=this.world.sphere('#d6c4e8',[0,0,0],[.32,.32,.32],eye);this.world.sphere('#553a70',[0,0,.3],[.12,.17,.05],eye);eye.visible=false;z.mesh.add(eye);z.icons.push(eye);}z.totem=this.world.box('#dfacb8',[0,0,0],[.18,1,.18],z.mesh);z.totem.visible=false;}
  this.dropGeometry=new THREE.OctahedronGeometry(.55);this.drops=new ObjectPool(48,()=>{const mesh=new THREE.Mesh(this.dropGeometry,new THREE.MeshStandardMaterial({color:'#edc86d',emissive:'#59451c'}));mesh.visible=false;this.world.root.add(mesh);return {mesh,position:mesh.position,life:0};},d=>d.mesh.visible=false);
  this.barriers=new ObjectPool(6,()=>{const mesh=new THREE.Mesh(this.world.boxGeometry,new THREE.MeshStandardMaterial({color:'#8bead4',transparent:true,opacity:.48}));mesh.scale.set(5,3,.7);mesh.visible=false;this.world.root.add(mesh);return {mesh,position:mesh.position,life:0,hp:300};},b=>b.mesh.visible=false);
  this.portals=new ObjectPool(4,()=>{const mesh=new THREE.Mesh(new THREE.TorusGeometry(1.4,.2,8,24),new THREE.MeshStandardMaterial({roughness:.45,metalness:.08,color:'#a887dd',transparent:true,opacity:.75}));mesh.visible=false;this.world.root.add(mesh);return {mesh,position:mesh.position,exit:new THREE.Vector3(),life:0};},p=>p.mesh.visible=false);
  this.captureRing=new THREE.Mesh(new THREE.RingGeometry(8.7,9.2,64),new THREE.MeshStandardMaterial({roughness:.45,metalness:.08,color:'#dbb880',side:THREE.DoubleSide,transparent:true,opacity:.8}));this.captureRing.rotation.x=-Math.PI/2;this.captureRing.visible=false;this.world.root.add(this.captureRing);
  this.arena=new THREE.Group();this.world.root.add(this.arena);for(const [x,z,w,d] of [[-30,40,1,60],[30,40,1,60],[0,10,60,1],[0,70,60,1]])this.world.box('#87777f',[x,2,z],[w,4,d],this.arena);this.arena.visible=false;
  this.rainData=new Float32Array(450*3);for(let i=0;i<450;i++){this.rainData[i*3]=(Math.random()-.5)*65;this.rainData[i*3+1]=Math.random()*35;this.rainData[i*3+2]=(Math.random()-.5)*65;}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(this.rainData,3));geo.boundingSphere=new THREE.Sphere(new THREE.Vector3(),65);this.rain=new THREE.Points(geo,new THREE.PointsMaterial({color:'#b6c9dc',size:.09,transparent:true,opacity:.55}));this.rain.visible=false;this.world.root.add(this.rain);
  this.ray=new THREE.Raycaster();this.hits=[];this.origin=new THREE.Vector3();this.direction=new THREE.Vector3();this.endpoint=new THREE.Vector3();this.point=new THREE.Vector3();this.muzzle=new THREE.Vector3();this.ndc=new THREE.Vector2();this.screen=new THREE.Vector3();this.temp=new THREE.Vector3();this.weather=0;this.dayColor=new THREE.Color('#729b9c');this.nightColor=new THREE.Color('#1f263f');
 }
 makeLabel(actor){const node=document.createElement('div');node.className=`actor-label ${actor.team}`;node.hidden=true;const name=document.createElement('span');name.textContent=actor.name;const health=document.createElement('i');node.append(name,health);document.querySelector('#actor-labels').append(node);actor.healthBar=health;return node;}
 get enemies(){return this.banks[this.player.team==='toys'?'nightmares':'toys'];}get allies(){return this.banks[this.player.team].items;}
 start(mode=this.engine.lobby?.mode||'horde',size=this.engine.lobby?.size||4,squad=null){
  this.stop();let id=this.engine.progress?.profile.selectedCharacter||'captain';if(mode==='horde'&&CHARACTERS[id].team!=='toys'){id='captain';this.ui.toast('Cofre Central requiere Juguetes. Capitán Espuma equipado para esta partida.');}
  this.engine.selectPlayerModel?.(id);this.player.model=this.engine.playerVisual;this.player.configure(id);this.player.position=this.engine.position;this.match.reset(mode,this.player.team,size);this.playerSpawnIndex=squad?(this.engine.account.user?.uid===squad.memberUid?4:3):1;this.started=true;this.time=0;this.navTimer=0;this.hudTimer=0;this.recoil=0;this.hit=0;this.charge=0;this.objectiveTime=0;
  this.result={id:crypto.randomUUID(),team:this.player.team,mode,character:id,kills:0,deaths:0,healing:0,objectives:0,won:false,duration:0};this.world.ambientToys.forEach(m=>m.visible=false);this.arena.visible=false;this.world.core.visible=mode==='horde';this.world.coreLabel.visible=mode==='horde';for(const p of this.world.portals){p.group.visible=mode==='horde';p.label.visible=mode==='horde';}this.captureRing.visible=mode==='conquest';this.setObjective();
  for(const team of ['toys','nightmares']){const count=mode==='horde'?(team==='toys'?size-(squad?2:1):0):size-(team===this.player.team?1:0);for(let i=0;i<count;i++)this.spawnActor(this.banks[team].acquire());}
  this.resetPlayer();this.ui.banner(this.player.team==='toys'?'BASE DE LOS JUGUETES':'BASE DE LAS PESADILLAS',`${MODES[mode].name} · Avanza hacia el marcador del objetivo`);this.updateHUD();if(squad)this.startSquadSync(squad);
 }
 setObjective(){const sector=SECTORS[Math.min(2,this.match.sector)];if(this.match.mode==='conquest')this.objective.set(sector.x,0,sector.z);else if(this.match.mode==='confirmed')this.objective.set(0,0,40);else this.objective.copy(this.base);this.captureRing.position.copy(this.objective);this.captureRing.position.y=.14;this.nav.fill(this.objectiveField,this.objective.x,this.objective.z);}
 spawnPoint(team,index=0){const base=BASES[team],row=Math.floor((index%24)/3),x=base.x+(index%3-1)*6,z=base.z+(team==='toys'?-1:1)*row*3;return this.nearestWalkable(x,z);}
 spawnActor(actor,boss=false,index=actor.slot||0,forcedId=null){
  const id=forcedId||(this.match.mode==='horde'&&actor.team==='nightmares'?(boss?'titan':waveEnemyId(1,index)):actor.homeId);
  if(boss&&!actor.bossModel){actor.bossModel=createRosterModel(this.world,'titan');this.world.root.add(actor.bossModel);}
  actor.model.visible=false;
  if(MINIONS[id]){actor.minionModels??=new Map();if(!actor.minionModels.has(id)){const model=createMinionModel(this.world,id);this.world.root.add(model);actor.minionModels.set(id,model);}actor.model=actor.minionModels.get(id);}else actor.model=boss?actor.bossModel:actor.homeModel;
  applyCharacterGraphics(actor.model,this.engine);
  actor.position=actor.model.position;actor.configure(id,boss);const p=this.spawnPoint(actor.team,index);actor.spawn(p.x,p.z);actor.status.spawn=2;actor.route=planRoute(actor.team,index,this.objective);actor.routeField=actor.routeField||this.nav.field();actor.routeGoal=new THREE.Vector3();actor.routeRefresh=0;actor.navGoal=null;actor.remoteTarget=null;actor.remoteAim=null;actor.minionTarget=null;actor.minionPendingTarget=null;actor.minionTargetTimer=0;resetStuck(actor);actor.portalCooldown=0;actor.aiTimer=1+Math.random()*3;actor.label.querySelector('span').textContent=boss?'JEFE · TITÁN · 1000 HP':actor.name;
 }

 startSquadSync(squad){
  const account=this.engine.account,uid=account.user?.uid;
  const squadId=squad.id;
  if(typeof squadId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(squadId))throw new Error('Sala de escuadrón inválida.');
  if(!uid||![squad.leaderUid,squad.memberUid].includes(uid))throw new Error('No perteneces a este escuadrón.');
  const leader=uid===squad.leaderUid;
  this.stopSquadSync();this.squadSync={id:squadId,uid,leader,remoteUid:leader?squad.memberUid:squad.leaderUid,remoteState:null,socket:null,gameTimer:0,playerTimer:0,lastPlayerMoveSentAt:null,fireSeq:0,abilitySeq:[0,0,0],reloadSeq:0,upgradeSeq:[0,0,0],remoteFireSeq:0,remoteReloadSeq:0,remoteUpgradeSeq:[0,0,0],remoteCharge:0,remoteWasFiring:false,shots:[],shotSeqs:new Map(),seenShots:new Map(),errorShown:false};
  const sync=this.squadSync;
  sync.connectionPromise=account.connectSquadGame(squadId,{
   onMessage:packet=>{
    if(this.squadSync!==sync)return;
    if(sync.leader&&packet.uid===sync.remoteUid&&['player:move','player:fire'].includes(packet.type))sync.remoteState={...sync.remoteState,...packet.data,receivedAt:performance.now()};
    else if(!sync.leader&&packet.type==='game:state')this.applySquadGame(packet.data);
    else if(!sync.leader&&packet.type==='combat:event'&&packet.data.kind==='shot'){audio.play('shoot');this.playSquadShots([packet.data.shot]);}
   },
   onError:error=>{if(this.squadSync===sync)this.squadError(error);},
  }).then(socket=>{
   if(this.squadSync!==sync){socket.close();throw new Error('La solicitud de conexión de escuadrón ya no está activa.');}
   sync.socket=socket;
   console.log('[WebSocket] Jugador conectado a sala:',sync.id,sync.uid);
   if(sync.leader)this.publishSquadGame(true);else this.publishSquadPlayer(true);
   return socket;
  }).catch(error=>{
   if(this.squadSync===sync){sync.connectionError=error;console.error('[WebSocket] Error de conexión/autenticación:',sync.id,uid,error);}
   throw error;
  });
  void sync.connectionPromise.catch(()=>{});
 }
 async ensureSquadConnection(){
  const sync=this.squadSync;if(!sync)return;
  try{
   const socket=await sync.connectionPromise;
   if(this.squadSync!==sync||!socket?.isOpen())throw new Error('La conexión con la sala se cerró.');
  }catch(error){
   console.error('[WebSocket] No se puede iniciar la partida:',sync.id,sync.uid,error);
   throw new Error('Error de conexión de red con el servidor',{cause:error});
  }
 }
 hasOpenSquadConnection(){return !this.squadSync||!!this.squadSync.socket?.isOpen();}
 stopSquadSync(){
  if(!this.squadSync)return;
  this.squadSync.socket?.close();
  this.squadSync=null;
  for(const actor of this.actors)if(actor.remoteHuman){actor.remoteHuman=false;actor.remoteUid=null;actor.remoteTarget=null;actor.remoteAim=null;actor.remoteState=null;}
 }
 squadError(error){
  console.error('Sincronización del escuadrón:',error);
  if(this.squadSync&&!this.squadSync.errorShown){this.squadSync.errorShown=true;this.ui.toast(error.message||'No se pudo sincronizar la partida del escuadrón.');}
 }
 setSquadPlaying(playing){
  if(!this.squadSync)return;
  this.squadSync.playing=playing;
  this.publishSquadPlayer(true);
 }
 collectSquadActions(dt){
  const input=this.engine.input,sync=this.squadSync;
  const weapon=this.player.spec.weapon,pressed=input.consumeAction('Fire'),held=input.firing||input.down('KeyF'),status=this.player.status;
  if(pressed)sync.fireSeq++;
  sync.localFireTimer=Math.max(0,(sync.localFireTimer||0)-dt);
  const canFire=this.player.active&&this.player.shotTimer<=0&&this.player.reload<=0&&!status.cloak&&!status.stun&&!status.sleep&&(!weapon.magazine||this.player.ammo>0);
  if(weapon.type==='charge'){if(!held&&(sync.localWasFiring||pressed)&&canFire)audio.play('shoot');}
  else if((held||pressed)&&canFire&&sync.localFireTimer<=0){audio.play('shoot');sync.localFireTimer=weapon.interval;}
  sync.localWasFiring=held;
  ['KeyQ','KeyE','KeyC'].forEach((key,index)=>{if(input.consumeAction(key)){audio.play('ability');sync.abilitySeq[index]++;const effect=this.player.spec.abilities[index]?.effect;if(['spring','flight','hover','blink','charge'].includes(effect))useAbility(this,this.player,index);}});
  if(input.consumeAction('KeyR')){sync.reloadSeq++;if(weapon.magazine&&this.player.ammo<weapon.magazine&&this.player.reload<=0)audio.play('reload');}
  ['Digit1','Digit2','Digit3'].forEach((key,index)=>{if(input.consumeAction(key))sync.upgradeSeq[index]++;});
 }
 publishSquadPlayer(force=false){
  const sync=this.squadSync;if(!sync||sync.leader)return;
  const p=this.player.position,input=this.engine.input;
  const data={
   hero:this.player.id,characterId:this.player.id,x:p.x,y:p.y,z:p.z,...this.playerVelocity,yaw:input.yaw,pitch:input.pitch,
   moving:this.player.moving,aiming:input.aiming,
   firing:input.firing||input.down('KeyF'),fireSeq:sync.fireSeq,
   abilitySeq:sync.abilitySeq,reloadSeq:sync.reloadSeq,upgradeSeq:sync.upgradeSeq,
   playing:sync.playing??(this.engine.state.value==='playing'),
  };
  if(sync.socket)try{
   const now=performance.now();
   if(sync.lastPlayerMoveSentAt===null||now-sync.lastPlayerMoveSentAt>=50){
    sync.socket.send('player:move',data);
    sync.lastPlayerMoveSentAt=now;
   }
   if(data.firing||data.fireSeq>(sync.lastSentFireSeq||0)){
    sync.socket.send('player:fire',{fireSeq:data.fireSeq,firing:data.firing,yaw:data.yaw,pitch:data.pitch});
    sync.lastSentFireSeq=data.fireSeq;
   }
  }catch(error){this.squadError(error);}
 }
 updateSquadSync(dt){
  const sync=this.squadSync;if(!sync)return;
  if(!sync.leader){
   this.collectSquadActions(dt);sync.playerTimer-=dt;
   if(sync.playerTimer<=0){this.publishSquadPlayer();sync.playerTimer=.05;}
   return;
  }
  this.applyRemoteSquadPlayer(dt);
  sync.gameTimer-=dt;
  if(sync.gameTimer<=0){this.publishSquadGame();sync.gameTimer=.1;}
 }
 ensureRemoteActor(uid,hero){
  const characterId=CHARACTERS[hero]?.team==='toys'?hero:'captain';
  let actor=this.actors.find(item=>item.remoteHuman&&item.remoteUid===uid);
  if(actor){if(actor.id!==characterId)this.spawnActor(actor,false,actor.slot,characterId);return actor;}
  actor=this.banks.toys.acquire();
  if(!actor)throw new Error('No hay espacio para el jugador del escuadrón.');
  this.spawnActor(actor,false,actor.slot,characterId);
  actor.remoteHuman=true;actor.remoteUid=uid;actor.route=null;
  return actor;
 }
 applyRemoteSquadPlayer(dt){
  const sync=this.squadSync,data=sync?.remoteState;
  if(!sync||!data)return;
  const fresh=Number.isFinite(data.receivedAt)&&performance.now()-data.receivedAt<3500;
  const characterId=data.characterId||data.hero;
  const actor=this.ensureRemoteActor(sync.remoteUid,characterId);
  actor.remoteFresh=fresh&&data.playing;
  if(!actor.remoteFresh){actor.active=false;actor.model.visible=false;actor.remoteTarget=null;return;}
  if(!actor.active)this.spawnActor(actor,false,actor.slot,CHARACTERS[characterId]?.team==='toys'?characterId:'captain');
  else if(actor.id!==characterId&&CHARACTERS[characterId]?.team==='toys')this.spawnActor(actor,false,actor.slot,characterId);
  const target={x:data.x,y:data.y,z:data.z,vx:data.vx||0,vy:data.vy||0,vz:data.vz||0,yaw:data.yaw+Math.PI,aimYaw:data.yaw,aimPitch:data.pitch,receivedAt:performance.now()};
  if(!actor.remoteTarget){
   actor.position.set(target.x,target.y,target.z);
   actor.model.rotation.y=target.yaw;
   actor.remoteAim={yaw:target.aimYaw,pitch:target.aimPitch};
  }
  actor.remoteTarget=target;actor.remoteAim??={yaw:target.aimYaw,pitch:target.aimPitch};actor.remoteState={...data,yaw:actor.remoteAim.yaw,pitch:actor.remoteAim.pitch};actor.active=true;actor.model.visible=true;
  actor.moving=!!data.moving;actor.syncHitboxes();
  actor.remoteFresh=true;
  if(data.reloadSeq>sync.remoteReloadSeq){sync.remoteReloadSeq=data.reloadSeq;this.reloadWeapon(actor);}
  const upgradeKinds=['damage','health','repair'];
  for(let i=0;i<3;i++)if(data.upgradeSeq?.[i]>(sync.remoteUpgradeSeq[i]||0)){this.buyUpgrade(upgradeKinds[i],actor);sync.remoteUpgradeSeq[i]=data.upgradeSeq[i];}
  const weapon=actor.spec.weapon,firing=!!data.firing;
  const newFire=data.fireSeq>sync.remoteFireSeq;
  if(weapon.type==='charge'){
   if(firing)sync.remoteCharge=Math.min(1.5,sync.remoteCharge+dt);
   else if(sync.remoteWasFiring||newFire){const target=this.aimTarget(actor,false,weapon.range);this.attack(actor,target,25+45*Math.min(1,sync.remoteCharge/1.5));sync.remoteCharge=0;}
  }else if(firing||newFire){
   const target=this.aimTarget(actor,false,weapon.range);this.attack(actor,target);
  }
  sync.remoteWasFiring=firing;sync.remoteFireSeq=Math.max(sync.remoteFireSeq,data.fireSeq||0);
  for(let i=0;i<3;i++)if(data.abilitySeq?.[i]>(sync.remoteAbilityApplied?.[i]||0)){useAbility(this,actor,i);sync.remoteAbilityApplied??=[0,0,0];sync.remoteAbilityApplied[i]=data.abilitySeq[i];}
 }
 recordSquadAttack(actor){
  const sync=this.squadSync;if(!sync?.leader||actor!==this.player&&!actor.remoteHuman)return;
  const uid=actor===this.player?sync.uid:actor.remoteUid;if(!uid)return;
  const seq=(sync.shotSeqs.get(uid)||0)+1;sync.shotSeqs.set(uid,seq);
  const aim=actor===this.player?this.engine.input:actor.remoteState||{};
  const shot={uid,seq,hero:actor.id,x:actor.position.x,y:actor.position.y,z:actor.position.z,yaw:aim.yaw||0,pitch:aim.pitch||0,range:actor.spec.weapon.range};
  try{sync.socket?.send('combat:event',{kind:'shot',shot});}catch(error){this.squadError(error);}
 }
 playSquadShots(shots){
  const sync=this.squadSync;if(!sync||sync.leader)return;
  for(const shot of shots||[]){
   if(!shot.uid||shot.seq<=(sync.seenShots.get(shot.uid)||0))continue;
   sync.seenShots.set(shot.uid,shot.seq);
   const actor=shot.uid===sync.uid?this.player:this.ensureRemoteActor(shot.uid,shot.hero);
   actor.model.updateWorldMatrix(true,true);actor.model.userData.rig.gun.getWorldPosition(this.muzzle);
   this.origin.set(shot.x,shot.y+1.2,shot.z);
   this.direction.set(-Math.sin(shot.yaw)*Math.cos(shot.pitch),-Math.sin(shot.pitch),-Math.cos(shot.yaw)*Math.cos(shot.pitch)).normalize();
   this.endpoint.copy(this.origin).addScaledVector(this.direction,Math.min(35,shot.range||35));
   const color=actor.spec.color||'#ffd677';
   this.effects.muzzleFlash(this.muzzle,actor.team==='toys'?'#ffd677':'#c589ff');
   this.effects.tracer(this.muzzle,this.endpoint,color);
  }
 }
 publishSquadGame(force=false){
  const sync=this.squadSync;if(!sync?.leader)return;
  if(sync.gamePending){sync.forceGameWrite||=force;return;}
  const syncStatus=actor=>Object.fromEntries(['cloak','stun','sleep','slow','haste','root','flight','hover','jump','spawn','shieldTime','guard','defense','power','weaken','aura','blind','scan'].filter(key=>typeof actor.status[key]==='boolean'||Number.isFinite(actor.status[key])).map(key=>[key,actor.status[key]]));
  const serialize=actor=>({team:actor.team,slot:actor.slot,id:actor.id,boss:!!actor.boss,active:!!actor.active,state:actor.state,moving:!!actor.moving,x:actor.position.x,y:actor.position.y,z:actor.position.z,yaw:actor.model.rotation.y,health:actor.health,maxHealth:actor.maxHealth,shield:actor.shield||0,status:syncStatus(actor),deathTime:Number(actor.deathTime)||0,ammo:Number(actor.ammo)||0,reload:Number(actor.reload)||0,cooldowns:Array.from(actor.cooldowns)});
  const hostPlayer={hero:this.player.id,characterId:this.player.id,active:this.player.active,x:this.player.position.x,y:this.player.position.y,z:this.player.position.z,...this.playerVelocity,yaw:this.player.model.rotation.y,aimYaw:this.engine.input.yaw,aimPitch:this.engine.input.pitch,health:this.player.health,maxHealth:this.player.maxHealth,shield:this.player.shield||0,status:syncStatus(this.player),deathTime:Number(this.player.deathTime)||0,ammo:Number(this.player.ammo)||0,reload:Number(this.player.reload)||0,cooldowns:Array.from(this.player.cooldowns)};
  const actors=[];for(const team of ['toys','nightmares'])for(const actor of this.banks[team].items)actors.push({...serialize(actor),...(actor.remoteUid?{remoteUid:actor.remoteUid}:{})});
  const match={wave:this.match.wave,remaining:this.match.remaining,phase:this.match.phase,timer:this.match.timer,duration:this.time,baseHealth:this.match.baseHealth,kills:this.match.kills,score:this.match.score,sector:this.match.sector,capture:this.match.capture,contested:this.match.contested,points:this.match.points,winner:this.match.winner,wavePoints:this.match.wavePoints,upgrades:this.match.upgrades};
  if(sync.socket)try{sync.socket.send('game:state',{actors,hostPlayer,match});}catch(error){this.squadError(error);}
 }
 applySquadGame(state){
  const sync=this.squadSync;if(!sync||sync.leader)return;
  const apply=(actor,data,local=false)=>{
   const characterId=data.characterId||data.hero||data.id;
   if(characterId&&actor.id!==characterId&&(CHARACTERS[characterId]||MINIONS[characterId]))this.spawnActor(actor,!!data.boss,data.slot,characterId);
   if(actor.remoteHuman&&!local){
    const target={x:data.x,y:data.y,z:data.z,vx:data.vx||0,vy:data.vy||0,vz:data.vz||0,yaw:data.yaw,aimYaw:data.aimYaw??data.yaw,aimPitch:data.aimPitch||0,receivedAt:performance.now()};
    if(!actor.remoteTarget){actor.position.set(target.x,target.y,target.z);actor.model.rotation.y=target.yaw;actor.remoteAim={yaw:target.aimYaw,pitch:target.aimPitch};}
    actor.remoteTarget=target;actor.remoteAim??={yaw:target.aimYaw,pitch:target.aimPitch};actor.remoteState={...data,yaw:actor.remoteAim.yaw,pitch:actor.remoteAim.pitch};
   }else{
    actor.position.set(data.x,data.y,data.z);actor.model.position.copy(actor.position);actor.model.rotation.y=data.yaw;
   }
   actor.active=!!data.active;actor.deathTime=data.deathTime||0;actor.model.visible=actor.active||actor.deathTime>0;actor.health=data.health;actor.maxHealth=data.maxHealth;
   actor.state=data.state||actor.state;actor.moving=!!data.moving;
   actor.shield=data.shield||0;actor.status=data.status||{};
   actor.ammo=data.ammo;actor.reload=data.reload;
   if(Array.isArray(data.cooldowns))actor.cooldowns.set(data.cooldowns);
   actor.syncHitboxes();
   if(local&&actor.health<=0&&this.engine.state.value==='playing')this.engine.handleDeath({killer:'Una pesadilla'});
  };
  if(state.hostPlayer){
   const characterId=state.hostPlayer.characterId||state.hostPlayer.hero;
   const remote=this.ensureRemoteActor(sync.remoteUid,characterId);
   apply(remote,{...state.hostPlayer,id:characterId,characterId,team:'toys',slot:remote.slot,state:'PATROL',moving:false},false);
  }
  for(const data of state.actors||[]){
   const bank=this.banks[data.team],actor=bank?.items.find(item=>item.slot===data.slot);if(!actor)continue;
   if(data.remoteUid===sync.uid){apply(this.player,data,true);continue;}
   if(actor.remoteHuman&&actor.remoteUid===sync.remoteUid)continue;
   apply(actor,data);
  }
  this.playSquadShots(state.shots);
  const saved=state.match;if(saved){
   if(saved.wave>this.match.wave||saved.baseHealth<this.match.baseHealth)audio.play('alarm');
   for(const key of ['wave','remaining','phase','timer','baseHealth','kills','score','sector','capture','contested','points','winner','wavePoints','upgrades'])if(saved[key]!==undefined)this.match[key]=saved[key];
   if(Number.isFinite(saved.duration)){this.time=saved.duration;this.result.duration=saved.duration;}
   if(this.match.sector!==this.lastSquadSector){this.lastSquadSector=this.match.sector;this.setObjective();}
   this.updateHUD();
  }
  if(['won','lost'].includes(this.match.phase)&&!['result','menu','login'].includes(this.engine.state.value)){this.result.won=this.match.phase==='won';this.engine.finishMatch(this.result.won);}
 }

 resetPlayer(){const p=this.spawnPoint(this.player.team,this.playerSpawnIndex||1);this.engine.position.set(p.x,0,p.z);this.player.spawn(p.x,p.z);this.player.position=this.engine.position;this.lastPlayerPosition.copy(this.player.position);this.playerVelocity={vx:0,vy:0,vz:0};this.player.maxHealth=this.player.spec.hp+(this.match.upgrades.health||0)*20;this.player.health=this.player.maxHealth;this.player.status.spawn=3;this.player.sinceDamage=0;this.player.portalCooldown=0;this.engine.verticalSpeed=0;this.engine.input.yaw=Math.atan2(this.objective.x-p.x,this.objective.z-p.z)-Math.PI;this.engine.input.pitch=.035;this.engine.playerVisual.position.copy(this.engine.position);this.engine.playerVisual.visible=true;this.player.syncHitboxes();this.charge=0;this.updateHUD();}
 stop(){this.stopSquadSync();this.started=false;this.objectiveLabel.hidden=true;for(const actor of this.actors)actor.silhouette.visible=false;for(const bank of Object.values(this.banks))bank.releaseAll();for(const pool of [this.projectiles,this.zones,this.drops,this.barriers,this.portals])pool.releaseAll();this.effects.reset();this.damageNumbers.reset();this.world.ambientToys.forEach(m=>m.visible=true);this.captureRing.visible=false;this.arena.visible=false;this.rain.visible=false;this.world.core.visible=true;this.world.coreLabel.visible=true;for(const p of this.world.portals){p.group.visible=true;p.label.visible=true;}this.weather=0;this.applyWeather(0);const blind=document.querySelector('#blind-overlay');if(blind)blind.style.opacity='0';}
 spawnWave(){const total=this.match.beginWave();audio.play('alarm');for(let i=0;i<total;i++){const actor=this.banks.nightmares.acquire();if(!actor)throw new Error('Pool de horda agotado');const boss=i===0&&this.match.wave%3===0;if(boss)actor.originalId=actor.id;this.spawnActor(actor,boss,i);this.effects.burst(actor.position,'#c192ed',12);}this.ui.banner(`OLEADA ${this.match.wave} / 10`,this.match.wave%3===0?'¡TITÁN DE PORCELANA! · 1000 HP':`${total} pesadillas · Protege el cofre`);}
 nearestWalkable(x,z){const at=this.nav.index(x,z);if(this.nav.walkable[at])return {x,z};let best=Infinity,result={x:0,z:12};for(let i=0;i<this.nav.walkable.length;i++)if(this.nav.walkable[i]){const px=this.nav.coordinate(i%this.nav.n),pz=this.nav.coordinate(Math.floor(i/this.nav.n)),d=(x-px)**2+(z-pz)**2;if(d<best){best=d;result.x=px;result.z=pz;}}return result;}
 fixedUpdate(dt){
  if(!this.started)return;if(dt>0){this.playerVelocity.vx=(this.player.position.x-this.lastPlayerPosition.x)/dt;this.playerVelocity.vy=(this.player.position.y-this.lastPlayerPosition.y)/dt;this.playerVelocity.vz=(this.player.position.z-this.lastPlayerPosition.z)/dt;}this.lastPlayerPosition.copy(this.player.position);this.time+=dt;this.result.duration=this.time;const input=this.engine.input;
  if(this.squadSync&&!this.squadSync.leader){this.updateSquadSync(dt);statusTick(this,this.player,dt);this.player.moving=!!(this.engine.move.x||this.engine.move.z);this.player.syncHitboxes();for(const actor of this.actors)if(actor!==this.player)actor.animate(dt,this.time);this.player.animate(dt,this.time);this.effects.update(dt);this.damageNumbers.update(dt,this.engine.camera,true);this.world.animateEnvironment(this.time);this.hudTimer-=dt;if(this.hudTimer<=0){this.updateHUD();this.hudTimer=.1;}return;}
  this.regenerate(dt);for(const actor of this.actors)if(actor.active)statusTick(this,actor,dt);this.updateSquadSync(dt);
  if(input.consumeAction('KeyR'))this.reloadWeapon(this.player);['KeyQ','KeyE','KeyC'].forEach((key,i)=>{if(input.consumeAction(key)){audio.play('ability');useAbility(this,this.player,i);}});if(input.consumeAction('Digit1'))this.buyUpgrade('damage');if(input.consumeAction('Digit2'))this.buyUpgrade('health');if(input.consumeAction('Digit3'))this.buyUpgrade('repair');
  const tap=input.consumeAction('Fire'),held=input.firing||input.down('KeyF');if(this.player.spec.weapon.type==='charge'){if(held&&!this.player.status.cloak)this.charge=Math.min(1.5,this.charge+dt);else if(this.charge>0||tap){this.attack(this.player,null,25+45*Math.min(1,this.charge/1.5));this.charge=0;}}else if(held||tap)this.attack(this.player);
  this.player.moving=!!(this.engine.move.x||this.engine.move.z);this.player.syncHitboxes();this.navTimer-=dt;if(this.navTimer<=0){this.nav.fill(this.objectiveField,this.objective.x,this.objective.z);this.navTimer=1;}
  if(this.match.mode==='horde'&&this.match.phase==='intermission'){this.match.timer-=dt;if(this.match.timer<=0)this.spawnWave();}
  for(const bank of Object.values(this.banks))for(const actor of bank.active){if(!actor.active){actor.animate(dt,this.time);if(actor.remoteHuman&&!actor.remoteFresh)continue;actor.respawnTimer-=dt;if(this.match.mode==='horde'&&actor.team==='nightmares'&&actor.deathTime<=0){if(actor.originalId){actor.configure(actor.originalId);actor.originalId=null;}bank.release(actor);}else if(actor.respawnTimer<=0)this.spawnActor(actor);continue;}if(!actor.remoteHuman)this.updateBot(actor,dt);actor.animate(dt,this.time);}
  this.updateProjectiles(dt);this.updateZones(dt);this.updateDrops(dt);this.updateBarriers(dt);this.updatePortals(dt);this.updateMode(dt);this.effects.update(dt);this.world.animateEnvironment(this.time);this.player.animate(dt,this.time);
  const rig=this.player.model.userData.rig;rig.gun.rotation.x=this.player.reload>0?-1.1+Math.sin(this.time*8)*.1:-this.engine.input.pitch;rig.gun.position.z=.35-this.recoil*.16;if(this.engine.position.y>.05)rig.legs.forEach((leg,i)=>leg.rotation.x=i?.4:-.6);
  this.hudTimer-=dt;if(this.hudTimer<=0){this.updateHUD();this.hudTimer=.1;}if(['won','lost'].includes(this.match.phase)&&this.engine.state.value==='playing'){this.result.won=this.match.phase==='won';this.publishSquadGame(true);this.engine.finishMatch(this.result.won);}
 }
 moveBot(actor,goal,dt){
  actor.wantsMove=true;if(!this.moveMultiplier(actor))return;
  let dx=goal.x-actor.position.x,dz=goal.z-actor.position.z;
  if(!this.sight(actor,goal)){
   actor.routeRefresh=(actor.routeRefresh||0)-dt;actor.routeField??=this.nav.field();
   if(!actor.navGoal||Math.hypot(actor.navGoal.x-goal.x,actor.navGoal.z-goal.z)>3||actor.routeRefresh<=0){this.nav.fill(actor.routeField,goal.x,goal.z);actor.navGoal={x:goal.x,z:goal.z};actor.routeRefresh=1;}
   this.nav.direction(actor.routeField,actor.position.x,actor.position.z,actor.direction);dx=actor.direction.x;dz=actor.direction.z;
  }
  let length=Math.hypot(dx,dz)||1;dx/=length;dz/=length;
  for(const other of this.actors)if(other!==actor&&other.active){const ox=actor.position.x-other.position.x,oz=actor.position.z-other.position.z,d=ox*ox+oz*oz;if(d>.01&&d<1.8){dx+=ox/d*.5;dz+=oz/d*.5;}}
  length=Math.hypot(dx,dz)||1;dx/=length;dz/=length;
  if(['CHASE','PATROL','CAPTURE','FLEE'].includes(actor.state))sampleStuck(actor,dt,dx,dz);
  if(actor.evadeTime>0){actor.evadeTime=Math.max(0,actor.evadeTime-dt);dx=actor.escapeDirection.x;dz=actor.escapeDirection.z;}
  else{const steered=this.steering.steer(actor,dx,dz,this.barriers.active);dx=steered.x;dz=steered.z;}
  const step=7*this.moveMultiplier(actor)*dt,x=actor.position.x,z=actor.position.z;
  // Evasion hops animate the model; they never bypass horizontal collision.
  const feet=actor.evasionHop>0?0:actor.position.y;
  if(!this.blocked(x+dx*step,z,feet,.5))actor.position.x+=dx*step;
  if(!this.blocked(actor.position.x,z+dz*step,feet,.5))actor.position.z+=dz*step;
  actor.moving=Math.hypot(actor.position.x-x,actor.position.z-z)>.001;
  if(actor.moving)actor.model.rotation.y=Math.atan2(dx,dz);
 }

 updateBot(actor,dt){
  actor.moving=false;actor.wantsMove=false;if(actor.status.stun||actor.status.sleep){resetStuck(actor);return;}if(actor.status.jump)actor.position.y=6*Math.sin(Math.PI*(1-actor.status.jump));else if(actor.status.hover)actor.position.y=Math.min(7,actor.position.y+dt*5);else if(actor.status.flight)actor.position.y=3+Math.sin(this.time)*.3;else actor.position.y=Math.max(0,actor.position.y-dt*5);
  if(actor.evasionHop>0){actor.evasionHop=Math.max(0,actor.evasionHop-dt);actor.position.y=.65*Math.sin(Math.PI*(1-actor.evasionHop/.5));}
  const wounded=actor.spec.weapon.heal?this.actors.find(a=>a!==actor&&a.active&&a.team===actor.team&&a.health<a.maxHealth*.75&&actor.position.distanceTo(a.position)<20&&this.sight(actor,a)):null;if(wounded){actor.model.rotation.y=Math.atan2(wounded.position.x-actor.position.x,wounded.position.z-actor.position.z);this.attack(actor,wounded);}
  let target=this.aimTarget(actor,false,actor.status.blind?5:35);
  if(actor.spec.minion){
   if(!target){actor.minionTarget=null;actor.minionPendingTarget=null;actor.minionTargetTimer=0;}
   else if(target!==actor.minionTarget){
    if(target!==actor.minionPendingTarget){actor.minionPendingTarget=target;actor.minionTargetTimer=.35+Math.random()*.45;}
    else{actor.minionTargetTimer-=dt;if(actor.minionTargetTimer<=0){actor.minionTarget=target;actor.minionPendingTarget=null;}}
   }
   target=target===actor.minionTarget?target:null;
  }
  let pickup=null,pickupDistance=Infinity;if(this.match.mode==='confirmed')for(const drop of this.drops.active){const d=actor.position.distanceTo(drop.position);if(d<pickupDistance){pickupDistance=d;pickup=drop;}}
  let decoy=null;for(const z of this.zones.active)if(z.type==='decoy'&&z.team!==actor.team&&actor.position.distanceTo(z.position)<20){decoy=z;break;}if(decoy){actor.state='CHASE';this.moveBot(actor,decoy.position,dt);return;}
  if(!target&&actor.route&&actor.route.index<actor.route.points.length){this.followRoute(actor,dt);}else if(this.match.mode==='conquest'&&actor.slot%2===0&&actor.position.distanceTo(this.objective)>6){actor.state='CAPTURE';this.moveBot(actor,this.objective,dt);if(target&&actor.position.distanceTo(target.position)<actor.spec.weapon.range&&this.sight(actor,target)){actor.model.rotation.y=Math.atan2(target.position.x-actor.position.x,target.position.z-actor.position.z);this.attack(actor,target);}}else if(pickup&&pickupDistance<18){actor.state='CHASE';this.moveBot(actor,pickup.position,dt);}else if(target){const d=actor.position.distanceTo(target.position),range=actor.spec.weapon.type==='cone'?actor.spec.weapon.range*.9:Math.min(20,actor.spec.weapon.range*.7);if(actor.health<actor.maxHealth*.15&&d<6&&actor.spec.weapon.type!=='cone'){actor.state='FLEE';this.temp.copy(actor.position).sub(target.position).multiplyScalar(2).add(actor.position);this.moveBot(actor,this.temp,dt);}else if(d>range){actor.state='CHASE';this.moveBot(actor,target.position,dt);}else actor.state='ATTACK';actor.model.rotation.y=Math.atan2(target.position.x-actor.position.x,target.position.z-actor.position.z);if(d<actor.spec.weapon.range&&this.sight(actor,target))this.attack(actor,target);
  }else if(this.match.mode==='horde'&&actor.team==='nightmares'&&actor.position.distanceTo(this.base)<(actor.spec.weapon.type==='cone'?actor.spec.weapon.range:17)&&this.sight(actor,this.base)){actor.state='ATTACK';actor.model.rotation.y=Math.atan2(-actor.position.x,-actor.position.z);this.attack(actor,this.coreTarget);}
  else{actor.state='PATROL';if(actor.position.distanceTo(this.objective)>(this.match.mode==='horde'&&actor.team==='nightmares'?Math.min(4,actor.spec.weapon.range*.75):4))this.moveBot(actor,this.objective,dt);}
  
  if(!actor.wantsMove)resetStuck(actor);actor.aiTimer-=dt;if(!actor.spec.minion&&actor.aiTimer<=0&&target){useAbility(this,actor,Math.floor(Math.random()*3));actor.aiTimer=5+Math.random()*5;}
 }
 followRoute(actor,dt){const route=actor.route;let point=route.points[route.index];if(!point)return;if(Math.hypot(actor.position.x-point.x,actor.position.z-point.z)<5){route.index++;point=route.points[route.index];if(!point)return;}const safe=this.nearestWalkable(point.x,point.z);actor.routeGoal.set(safe.x,0,safe.z);if(Math.hypot(actor.position.x-safe.x,actor.position.z-safe.z)<5){route.index++;return;}actor.state='PATROL';this.moveBot(actor,actor.routeGoal,dt);}
 regenerate(dt){if(!this.player.active)return;const before=this.player.sinceDamage||0;this.player.sinceDamage=before+dt;const healingTime=Math.max(0,this.player.sinceDamage-5)-Math.max(0,before-5);if(healingTime>0)this.heal(this.player,10*healingTime,this.player);}
 updateHUD(){this.ui.health(this.player.health,this.player.shield,this.player.maxHealth);this.ui.battle(this);['q','e','c'].forEach((key,i)=>this.ui.cooldown(key,this.player.cooldowns[i],this.player.spec.abilities[i].cooldown));}
 updateRemoteActors(dt){for(const actor of this.actors)if(actor.remoteHuman&&actor.remoteTarget){const target=actor.remoteTarget,lead=Math.min(.08,Math.max(0,(performance.now()-target.receivedAt)/1000));actor.position.x+=(target.x+target.vx*lead-actor.position.x)*.15;actor.position.y+=(target.y+target.vy*lead-actor.position.y)*.15;actor.position.z+=(target.z+target.vz*lead-actor.position.z)*.15;const angle=Math.atan2(Math.sin(target.yaw-actor.model.rotation.y),Math.cos(target.yaw-actor.model.rotation.y));actor.model.rotation.y+=angle*.15;const aimAngle=Math.atan2(Math.sin(target.aimYaw-actor.remoteAim.yaw),Math.cos(target.aimYaw-actor.remoteAim.yaw));actor.remoteAim.yaw+=aimAngle*.15;actor.remoteAim.pitch+=(target.aimPitch-actor.remoteAim.pitch)*.15;if(actor.remoteState){actor.remoteState.yaw=actor.remoteAim.yaw;actor.remoteState.pitch=actor.remoteAim.pitch;}actor.syncHitboxes();}}
 update(dt){this.updateRemoteActors(dt);this.damageNumbers.update(dt,this.engine.camera,this.engine.state.value==='playing');this.recoil=Math.max(0,this.recoil-dt*7);this.hit=Math.max(0,this.hit-dt);this.aimBlend=(this.aimBlend||0)+((this.engine.input.aiming?1:0)-(this.aimBlend||0))*(1-Math.exp(-12*dt));this.ui.recoil(this.recoil,this.aimBlend);document.querySelector('#hit-confirm').style.opacity=this.hit>0?'1':'0';const blind=document.querySelector('#blind-overlay');if(blind)blind.style.opacity=this.player.status.blind?'.94':'0';this.objectiveLabel.hidden=this.engine.state.value!=='playing'||this.match.mode==='confirmed';if(!this.objectiveLabel.hidden){this.screen.copy(this.objective);this.screen.y=5;this.screen.project(this.engine.camera);this.objectiveLabel.hidden=this.screen.z>1||Math.abs(this.screen.x)>1||Math.abs(this.screen.y)>1;this.objectiveLabel.textContent=`${this.match.mode==='horde'?'▣ COFRE':String.fromCharCode(65+Math.min(2,this.match.sector))+' · ZONA'} · ${Math.round(this.player.position.distanceTo(this.objective))} m`;this.objectiveLabel.style.transform=`translate(${(this.screen.x*.5+.5)*innerWidth}px,${(-this.screen.y*.5+.5)*innerHeight}px) translate(-50%,-100%)`;}for(const actor of this.actors){actor.silhouette.visible=actor.active&&actor.team!==this.player.team&&!!(actor.status.reveal||this.player.status.scan)&&this.engine.state.value==='playing';if(actor.silhouette.visible){actor.silhouette.position.copy(actor.body.center);actor.silhouette.scale.set(actor.body.radius*2,actor.spec.height,actor.body.radius*1.3);}if(!actor.label)continue;if(!actor.active||actor.status.cloak||this.engine.state.value!=='playing'){actor.label.hidden=true;continue;}this.screen.copy(actor.head.center);this.screen.y+=.5;this.screen.project(this.engine.camera);actor.label.hidden=!(this.screen.z<1&&this.screen.z>-1&&Math.abs(this.screen.x)<1.1&&Math.abs(this.screen.y)<1.1&&(actor.team===this.player.team||actor.status.reveal||this.player.status.scan||this.sight(this.player,actor)));if(actor.label.hidden)continue;actor.label.style.transform=`translate(${(this.screen.x*.5+.5)*innerWidth}px,${(-this.screen.y*.5+.5)*innerHeight}px) translate(-50%,-100%)`;actor.healthBar.style.width=`${actor.health/actor.maxHealth*100}%`;actor.label.dataset.state=actor.state;}}
 dispose(){this.stop();this.steering.dispose();this.damageNumbers.dispose();this.objectiveLabel.remove();for(const actor of this.actors)actor.label?.remove();}
}
