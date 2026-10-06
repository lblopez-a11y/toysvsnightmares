import {GAME} from './config.js';
import {applySettingsToEngine,graphicsSettings,initFPSCounter,saveGraphicsSettings} from './graphicsSettings.js';
export const MIN_SENSITIVITY=.0004,MAX_SENSITIVITY=.008;
export function setCameraSensitivity(value){
 const n=Number(value);globalThis.cameraSensitivity=Number.isFinite(n)?Math.max(MIN_SENSITIVITY,Math.min(MAX_SENSITIVITY,n)):GAME.sensitivity;
 try{localStorage.setItem('tvn-camera-sensitivity',String(globalThis.cameraSensitivity));}catch{}
 return globalThis.cameraSensitivity;
}
let saved;try{saved=localStorage.getItem('tvn-camera-sensitivity');}catch{}
setCameraSensitivity(saved===null||saved===undefined?GAME.sensitivity:saved);
export class Settings {
 constructor(engine){
  this.engine=engine;initFPSCounter();
  this.dialog=document.createElement('dialog');this.dialog.className='settings-dialog panel';
  this.dialog.setAttribute('aria-labelledby','settings-title');
  this.dialog.innerHTML='<p class="eyebrow">A TU MANERA</p><h2 id="settings-title">Ajustes</h2><label for="camera-sensitivity">Sensibilidad de cámara <output id="sensitivity-value"></output></label><input id="camera-sensitivity" type="range" min="0.0004" max="0.008" step="0.0001"><div class="slider-labels"><span>Precisa</span><span>Rápida</span></div><p>El ratón gira la cámara libremente mientras el cursor está bloqueado. ESC libera el cursor y pausa la partida.</p><fieldset class="graphics-options"><legend>Rendimiento local</legend><label class="graphics-select" for="set-fps-cap"><span>Límite de cuadros</span><select id="set-fps-cap"><option value="30">30 FPS · Menos consumo</option><option value="60">60 FPS · Más fluido</option></select></label><label class="graphics-select" for="set-render-scale"><span>Resolución de renderizado</span><select id="set-render-scale"><option value="1">100% · Nativa</option><option value="0.8">80% · Equilibrada</option><option value="0.65">65% · Rendimiento</option></select></label><label class="graphics-select" for="set-projectiles"><span>Estilo de disparos</span><select id="set-projectiles"><option value="fast">Optimizado · Plano</option><option value="full">Completo · Iluminado</option></select></label><label class="graphics-select" for="set-shadows"><span>Sombras</span><select id="set-shadows"><option value="static">Estáticas · Bajo coste</option><option value="dynamic">Dinámicas</option><option value="none">Desactivadas</option></select></label><label class="graphics-select" for="set-particles"><span>Densidad de partículas</span><select id="set-particles"><option value="off">Desactivadas</option><option value="low">Reducidas</option><option value="full">Completas</option></select></label><label class="graphics-toggle" for="set-smoothing"><span>Suavizado de imagen</span><input type="checkbox" id="set-smoothing"></label><label class="graphics-toggle" for="set-fps-counter"><span>Contador de FPS</span><input type="checkbox" id="set-fps-counter"></label><p class="settings-note">El suavizado de imagen requiere recargar para reconstruir el contexto WebGL.</p></fieldset><button class="button secondary" id="save-graphics">Aplicar y guardar</button><button class="button secondary" id="reset-settings">Restablecer sensibilidad</button><button class="button primary" id="close-settings">← Volver</button>';
    this.dialog.querySelector('#set-smoothing')?.closest('label').remove();
    this.dialog.querySelector('.settings-note')?.remove();
    this.dialog.querySelector('.graphics-options').insertAdjacentHTML('beforeend','<label class="graphics-toggle" for="chk-simple-skins"><span>Diseños simplificados</span><input type="checkbox" id="chk-simple-skins"></label><label class="graphics-toggle" for="chk-compact-map"><span>Reducir límite de renderizado</span><input type="checkbox" id="chk-compact-map"></label><p class="settings-note">Los cambios son locales y solo afectan a tu pantalla.</p>');
  document.body.append(this.dialog);this.slider=this.dialog.querySelector('input');
  this.slider.oninput=()=>{setCameraSensitivity(this.slider.value);this.refresh();};
    this.dialog.querySelector('#save-graphics').onclick=()=>{saveGraphicsSettings({fpsCap:Number(this.dialog.querySelector('#set-fps-cap').value),renderScale:Number(this.dialog.querySelector('#set-render-scale').value),projectileStyle:this.dialog.querySelector('#set-projectiles').value,shadows:this.dialog.querySelector('#set-shadows').value,particleDensity:this.dialog.querySelector('#set-particles').value,simpleSkins:this.dialog.querySelector('#chk-simple-skins').checked,compactMapArea:this.dialog.querySelector('#chk-compact-map').checked,fpsCounter:this.dialog.querySelector('#set-fps-counter').checked},this.engine);};
  this.dialog.querySelector('#reset-settings').onclick=()=>{setCameraSensitivity(GAME.sensitivity);this.refresh();};
  this.dialog.querySelector('#close-settings').onclick=()=>this.dialog.close();
  applySettingsToEngine(this.engine);this.loadGraphicsSettings();
 }
 loadGraphicsSettings(){this.dialog.querySelector('#set-fps-cap').value=graphicsSettings.fpsCap;this.dialog.querySelector('#set-render-scale').value=graphicsSettings.renderScale;this.dialog.querySelector('#set-projectiles').value=graphicsSettings.projectileStyle;this.dialog.querySelector('#set-shadows').value=graphicsSettings.shadows;this.dialog.querySelector('#set-particles').value=graphicsSettings.particleDensity;this.dialog.querySelector('#chk-simple-skins').checked=graphicsSettings.simpleSkins;this.dialog.querySelector('#chk-compact-map').checked=graphicsSettings.compactMapArea;this.dialog.querySelector('#set-fps-counter').checked=graphicsSettings.fpsCounter;}
 refresh(){this.slider.value=globalThis.cameraSensitivity;this.dialog.querySelector('output').textContent=`${(globalThis.cameraSensitivity/GAME.sensitivity).toFixed(2)}×`;this.loadGraphicsSettings();}
 open(){this.refresh();this.dialog.showModal();this.slider.focus();}
}
