import {GAME} from './config.js';
import './settings.js';
export function pointerLockErrorMessage(error){
 const detail=error?.message||error?.name;
 return 'No se pudo capturar el cursor. Si estás en la vista previa de ChatGPT o Codex, abre el acceso directo en tu navegador de Windows. Si ya estás en una ventana independiente, haz clic de nuevo en Entrar.'+(detail?` Detalle del navegador: ${detail}`:'');
}
/** Pointer Lock estricto: el cuerpo del documento es el objetivo del bloqueo. */
export class Input {
 constructor(canvas,{onLock,onUnlock,onError}){
  this.canvas=canvas;this.keys=new Set();this.actions=new Set();this.yaw=0;this.pitch=.12;this.locked=false;this.firing=false;this.aiming=false;this.jumpQueued=false;this.onLock=onLock;this.onUnlock=onUnlock;this.abort=new AbortController();const options={signal:this.abort.signal};
  document.addEventListener('pointerlockchange',()=>{const locked=document.pointerLockElement===document.body;if(locked===this.locked)return;this.locked=locked;this.clear();locked?onLock():onUnlock();},options);
  document.addEventListener('pointerlockerror',()=>{this.clear();onError(this.lockFailureMessage||pointerLockErrorMessage());},options);
  document.addEventListener('mousemove',event=>{if(!this.locked)return;const sensitivity=globalThis.cameraSensitivity||GAME.sensitivity;this.yaw-=event.movementX*sensitivity;this.pitch=Math.max(-1.25,Math.min(1.25,this.pitch+event.movementY*sensitivity));},options);
  document.addEventListener('keydown',event=>{
   if(!this.locked)return;if(event.code==='Escape'){this.unlock();return;}
   if(['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','ControlLeft','Space','KeyQ','KeyE','KeyC','KeyR','KeyF','Digit1','Digit2','Digit3'].includes(event.code))event.preventDefault();
   this.keys.add(event.code);if(event.code==='Space'&&!event.repeat)this.jumpQueued=true;
   if(event.code==='KeyF'&&!event.repeat)this.actions.add('Fire');
   if(['KeyQ','KeyE','KeyC','KeyR','Digit1','Digit2','Digit3'].includes(event.code)&&!event.repeat)this.actions.add(event.code);
  },options);
  document.addEventListener('keyup',event=>this.keys.delete(event.code),options);
  document.addEventListener('mousedown',event=>{if(!this.locked)return;if(event.button===2)this.aiming=true;if(event.button===0){this.firing=true;this.actions.add('Fire');}},options);
  document.addEventListener('mouseup',event=>{if(event.button===0)this.firing=false;if(event.button===2)this.aiming=false;},options);
  document.addEventListener('contextmenu',event=>{if(this.locked)event.preventDefault();},options);
  window.addEventListener('blur',()=>{this.clear();this.unlock();},options);
 }
 async lock(){this.lockFailureMessage=null;try{if(!document.body.requestPointerLock)throw new Error('Pointer Lock no está disponible en este navegador.');await document.body.requestPointerLock();}catch(error){this.lockFailureMessage=pointerLockErrorMessage(error);throw new Error(this.lockFailureMessage);}}
 unlock(){this.clear();if(document.pointerLockElement===document.body)document.exitPointerLock();}
 clear(){this.keys.clear();this.actions.clear();this.firing=false;this.aiming=false;this.jumpQueued=false;}
 consumeAction(key){const pressed=this.actions.has(key);this.actions.delete(key);return pressed;}
 down(key){return this.keys.has(key);}
 consumeJump(){const queued=this.jumpQueued;this.jumpQueued=false;return queued;}
 dispose(){this.unlock();this.abort.abort();}
}
