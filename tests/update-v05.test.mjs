import {test} from 'node:test';
import assert from 'node:assert/strict';
import {aimModifiers,smoothFov,sampleSpread} from '../src/aim.js';
import {MINIONS,waveEnemyId} from '../src/minions.js';
import {resetStuck,sampleStuck} from '../src/stuck.js';
test('ADS: zoom suave 75→52, dispersión -60%, retroceso reducido y movimiento 0.75',()=>{
 const random=()=>.5,hip=sampleSpread(false,.014,random),ads=sampleSpread(true,.014,random);
 assert.ok(Math.abs(ads.x/hip.x-.4)<1e-12);assert.equal(aimModifiers(true).movement,.75);assert.equal(aimModifiers(true).recoil,.45);
 let fov=75;fov=smoothFov(fov,true,1/60);assert.ok(fov<75&&fov>52);for(let i=0;i<120;i++)fov=smoothFov(fov,true,1/60);assert.ok(Math.abs(fov-52)<.001);for(let i=0;i<120;i++)fov=smoothFov(fov,false,1/60);assert.ok(Math.abs(fov-75)<.001);
});
test('Desatasco: muestreo 0.6 s, evasión perpendicular 1 s y recálculo; caminar reinicia contador',()=>{
 const actor={position:{x:0,z:0}};resetStuck(actor);
 assert.equal(sampleStuck(actor,.6,0,1),false);assert.equal(sampleStuck(actor,.6,0,1),false);assert.equal(sampleStuck(actor,.6,0,1,()=>0),true);
 assert.equal(actor.evadeTime,1);assert.equal(actor.escapeDirection.x,-1);assert.equal(actor.escapeDirection.z,0);assert.equal(actor.navGoal,null);assert.equal(actor.routeRefresh,0);assert.ok(actor.evasionHop>0);
 resetStuck(actor);sampleStuck(actor,.6,0,1);actor.position.z=.3;sampleStuck(actor,.6,0,1);assert.equal(actor.stuckTimer,0);
});
test('Diez oleadas: solo esbirros comunes y un Titán cada tres; catálogo separado',()=>{
 for(let wave=1;wave<=10;wave++)for(let i=0;i<20;i++){const id=waveEnemyId(wave,i);if(wave%3===0&&i===0)assert.equal(id,'titan');else assert.ok(MINIONS[id]);}
 assert.equal(MINIONS.shadowling.hp,40);assert.equal(MINIONS.shadowling.weapon.damage,10);assert.equal(MINIONS.slimelet.hp,60);assert.equal(MINIONS.slimelet.weapon.damage,12);assert.ok(MINIONS.shadowling.speed>MINIONS.slimelet.speed);
});
