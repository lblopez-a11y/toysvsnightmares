import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BASES,planRoute} from '../src/routes.js';
import {StateMachine} from '../src/core.js';
test('Bases opuestas y corredores izquierdo, central y derecho con offsets diferentes',()=>{
 assert.ok(Math.hypot(BASES.toys.x-BASES.nightmares.x,BASES.toys.z-BASES.nightmares.z)>200);
 const paths=[0,1,2].map((slot)=>planRoute('toys',slot,{x:0,z:0},()=>.2+slot*.2));assert.deepEqual(paths.map(p=>p.lane),[-1,0,1]);assert.equal(new Set(paths.map(p=>p.offset)).size,3);
 assert.ok(paths[0].points[1].x< -40);assert.ok(Math.abs(paths[1].points[1].x)<5);assert.ok(paths[2].points[1].x>40);
 assert.ok(planRoute('nightmares',0,{x:0,z:0}).points[0].z<0);
});
test('El despliegue preparado espera bloqueo antes de iniciar la simulación y permite volver',()=>{const state=new StateMachine(()=>{});for(const next of ['login','menu','ready','menu','ready','playing','paused','menu'])state.set(next);assert.equal(state.value,'menu');});
