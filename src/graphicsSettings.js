import {GAME} from './config.js';

export const DEFAULT_SETTINGS=Object.freeze({
 fpsCap:60,renderScale:1,projectileStyle:'full',shadows:'dynamic',particleDensity:'full',simpleSkins:false,compactMapArea:false,fpsCounter:true,
});

function normalizeSettings(saved={}){
 const oldShadows=typeof saved.shadows==='boolean'?(saved.shadows?'dynamic':'none'):saved.shadows;
 const oldParticles=typeof saved.particles==='boolean'?(saved.particles?'full':'off'):saved.particleDensity;
 const oldScale={low:.65,medium:.82,high:1}[saved.chunks];
 return {
  fpsCap:[30,60].includes(Number(saved.fpsCap))?Number(saved.fpsCap):DEFAULT_SETTINGS.fpsCap,
  renderScale:[.65,.8,1].includes(Number(saved.renderScale))?Number(saved.renderScale):oldScale||DEFAULT_SETTINGS.renderScale,
  projectileStyle:['full','fast'].includes(saved.projectileStyle)?saved.projectileStyle:DEFAULT_SETTINGS.projectileStyle,
  shadows:['none','static','dynamic'].includes(oldShadows)?oldShadows:DEFAULT_SETTINGS.shadows,
  particleDensity:['off','low','full'].includes(oldParticles)?oldParticles:DEFAULT_SETTINGS.particleDensity,
   simpleSkins:typeof saved.simpleSkins==='boolean'?saved.simpleSkins:DEFAULT_SETTINGS.simpleSkins,
   compactMapArea:typeof saved.compactMapArea==='boolean'?saved.compactMapArea:DEFAULT_SETTINGS.compactMapArea,
  fpsCounter:typeof saved.fpsCounter==='boolean'?saved.fpsCounter:DEFAULT_SETTINGS.fpsCounter,
 };
}

function readSettings(){
 try{return normalizeSettings(JSON.parse(localStorage.getItem('graphics_settings')||'{}'));}
 catch{return {...DEFAULT_SETTINGS};}
}

export const graphicsSettings=readSettings();

export function saveGraphicsSettings(newSettings,engine){
 Object.assign(graphicsSettings,normalizeSettings({...graphicsSettings,...newSettings}));
 try{localStorage.setItem('graphics_settings',JSON.stringify(graphicsSettings));}catch{}
 applySettingsToEngine(engine);
}

function characterModels(engine){
 const models=new Set(engine.playerModels?.values()||[]);
 for(const model of engine.lobby?.models?.values()||[])models.add(model);
 for(const actor of engine.battle?.actors||[]){
  if(actor.model)models.add(actor.model);
  if(actor.homeModel)models.add(actor.homeModel);
  if(actor.bossModel)models.add(actor.bossModel);
  for(const model of actor.minionModels?.values()||[])models.add(model);
 }
 return models;
}

export function applyCharacterGraphics(model,engine){
 const dynamic=graphicsSettings.shadows==='dynamic';
 const THREE=engine.THREE;
 model.traverse(object=>{
  if(object.isMesh&&!object.userData.graphicsShadow){object.castShadow=dynamic;object.receiveShadow=dynamic;}
   if(object.userData.simpleSkinDetail)object.visible=!graphicsSettings.simpleSkins;
 });
 model.userData.simpleSkins=graphicsSettings.simpleSkins;
 let shadow=model.userData.graphicsShadow;
 if(!shadow){
  shadow=new THREE.Mesh(new THREE.CircleGeometry(1,16),new THREE.MeshBasicMaterial({color:'#07151a',transparent:true,opacity:.28,depthWrite:false}));
  shadow.name='static-character-shadow';shadow.rotation.x=-Math.PI/2;shadow.position.y=.025;shadow.renderOrder=1;
  const scale=model.scale.x||1;shadow.scale.set(1.1/scale,.62/scale,1);shadow.userData.graphicsShadow=true;model.userData.graphicsShadow=shadow;model.add(shadow);
 }
 shadow.visible=graphicsSettings.shadows==='static';
}

export function applySettingsToEngine(engine){
 if(typeof document!=='undefined'){
  const fps=document.getElementById('fps-counter');if(fps)fps.hidden=!graphicsSettings.fpsCounter;
  document.body.classList.toggle('no-glow',graphicsSettings.projectileStyle==='fast');
  document.body.classList.toggle('flat-shadows',graphicsSettings.shadows==='static');
  document.body.classList.toggle('no-shadows',graphicsSettings.shadows==='none');
  document.body.classList.toggle('low-particles',graphicsSettings.particleDensity==='low');
  document.body.classList.toggle('no-particles',graphicsSettings.particleDensity==='off');
   document.body.classList.toggle('simple-skins',graphicsSettings.simpleSkins);
 }
 if(!engine)return;
 engine.graphicsSettings=graphicsSettings;
 const scale=Math.min(globalThis.devicePixelRatio||1,GAME.maxPixelRatio)*graphicsSettings.renderScale;
 engine.renderer?.setPixelRatio(scale);
 engine.composer?.setPixelRatio(scale);
 if(engine.renderer){
  const dynamic=graphicsSettings.shadows==='dynamic';
  engine.renderer.shadowMap.enabled=dynamic;
  engine.sun&&(engine.sun.castShadow=dynamic);
 }
 if(engine.battle?.effects)engine.battle.effects.particleDensity=graphicsSettings.particleDensity;
 for(const projectile of engine.battle?.projectiles?.items||[]){
  projectile.mesh.material=graphicsSettings.projectileStyle==='fast'?projectile.fastMaterial:projectile.fullMaterial;
 }
 const dynamic=graphicsSettings.shadows==='dynamic';
 for(const model of characterModels(engine)){
    applyCharacterGraphics(model,engine);
 }
 if(engine.camera){engine.camera.far=graphicsSettings.compactMapArea?120:330;engine.camera.updateProjectionMatrix();}
 const fog=engine.world?.scene?.fog;
 if(fog){fog.far=graphicsSettings.compactMapArea?108:290;fog.near=fog.far*.36;}
 if(engine.lobby?.spot)engine.lobby.spot.castShadow=dynamic;
}

export const applySettingsToGame=applySettingsToEngine;
export const saveSettings=saveGraphicsSettings;

export function initFPSCounter(){
 if(typeof document==='undefined'||document.getElementById('fps-counter'))return;
 const counter=document.createElement('output');counter.id='fps-counter';counter.setAttribute('aria-live','off');counter.textContent='FPS: --';document.body.append(counter);
}

let fpsFrames=0,fpsStart=0;
export function updateFPSCounter(now){
 if(!graphicsSettings.fpsCounter)return;
 fpsFrames++;
 if(!fpsStart)fpsStart=now;
 const elapsed=now-fpsStart;
 if(elapsed<500)return;
 const fps=Math.round(fpsFrames*1000/elapsed),counter=document.getElementById('fps-counter');
 if(counter){counter.textContent=`FPS: ${fps}`;counter.dataset.level=fps<30?'low':fps<50?'medium':'high';}
 fpsFrames=0;fpsStart=now;
}