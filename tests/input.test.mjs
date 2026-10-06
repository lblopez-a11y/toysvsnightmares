import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Input} from '../src/input.js';
import {setCameraSensitivity} from '../src/settings.js';
const event=(type,props)=>Object.assign(new Event(type),props);
test('Pointer Lock del body, cámara libre, sensibilidad global y ESC limpia controles',async()=>{
 const oldDoc=globalThis.document,oldWin=globalThis.window;const doc=new EventTarget(),win=new EventTarget(),canvas=new EventTarget();globalThis.document=doc;globalThis.window=win;
 let requests=0,starts=0,pauses=0;doc.body={requestPointerLock:async()=>{requests++;}};doc.exitPointerLock=()=>{doc.pointerLockElement=null;doc.dispatchEvent(new Event('pointerlockchange'));};
 const input=new Input(canvas,{onLock:()=>starts++,onUnlock:()=>pauses++,onError:()=>{}});
 try{
  doc.dispatchEvent(event('mousemove',{movementX:100,movementY:0}));assert.equal(input.yaw,0);await input.lock();assert.equal(requests,1);assert.equal(starts,0);
  doc.pointerLockElement=doc.body;doc.dispatchEvent(new Event('pointerlockchange'));assert.equal(starts,1);assert.equal(input.locked,true);
  setCameraSensitivity(.002);doc.dispatchEvent(event('mousemove',{movementX:100,movementY:20}));assert.equal(input.yaw,-.2);const before=input.yaw;
  setCameraSensitivity(.004);doc.dispatchEvent(event('mousemove',{movementX:100,movementY:0}));assert.ok(Math.abs(input.yaw-before+.4)<1e-9);
  doc.dispatchEvent(event('keydown',{code:'KeyW',repeat:false}));assert.equal(input.down('KeyW'),true);doc.dispatchEvent(event('keydown',{code:'KeyF',repeat:false}));assert.equal(input.consumeAction('Fire'),true);
  const menu=new Event('contextmenu',{cancelable:true});doc.dispatchEvent(menu);assert.equal(menu.defaultPrevented,true);doc.dispatchEvent(event('mousedown',{button:2}));assert.equal(input.aiming,true);doc.dispatchEvent(event('mouseup',{button:2}));assert.equal(input.aiming,false);doc.dispatchEvent(event('mousedown',{button:2}));
  doc.dispatchEvent(event('keydown',{code:'Escape',repeat:false}));assert.equal(input.aiming,false);assert.equal(pauses,1);assert.equal(input.locked,false);assert.equal(input.down('KeyW'),false);
 }finally{input.dispose();globalThis.document=oldDoc;globalThis.window=oldWin;setCameraSensitivity(.0022);}
});
test('Rechazo de Pointer Lock no inicia partida ni habilita cámara con clic derecho',async()=>{
 const oldDoc=globalThis.document,oldWin=globalThis.window;const doc=new EventTarget(),win=new EventTarget(),canvas=new EventTarget();globalThis.document=doc;globalThis.window=win;let started=0,errors=0,message='';
 doc.body={requestPointerLock:async()=>{throw new Error('NotAllowedError');}};const input=new Input(canvas,{onLock:()=>started++,onUnlock:()=>{},onError:text=>{errors++;message=text;}});
 try{await assert.rejects(input.lock(),/Detalle del navegador: NotAllowedError/);doc.dispatchEvent(new Event('pointerlockerror'));assert.match(message,/NotAllowedError/);canvas.dispatchEvent(event('mousedown',{button:2}));doc.dispatchEvent(event('mousemove',{movementX:100,movementY:100}));assert.equal(input.yaw,0);assert.equal(started,0);assert.equal(errors,1);assert.equal(input.locked,false);}finally{input.dispose();globalThis.document=oldDoc;globalThis.window=oldWin;}
});
test('Sensibilidad acotada y guardada con el valor normalizado',()=>{const old=globalThis.localStorage;let saved;globalThis.localStorage={setItem:(k,v)=>saved=v};try{assert.equal(setCameraSensitivity(3),.008);assert.equal(saved,'0.008');assert.equal(setCameraSensitivity(-1),.0004);assert.equal(setCameraSensitivity('incorrecto'),.0022);}finally{globalThis.localStorage=old;}});
