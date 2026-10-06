import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Navigation,clearSight} from '../src/navigation.js';
import {Match} from '../src/match.js';

test('Diez oleadas completas terminan en victoria, con 20 segundos entre oleadas',()=>{
  const match=new Match();
  for(let wave=1;wave<=10;wave++){
    const count=match.beginWave();assert.equal(count,Math.min(20,4+wave*2));
    for(let i=0;i<count;i++)match.kill(i%2===0);
    assert.equal(match.remaining,0);assert.equal(match.phase,wave===10?'won':'intermission');
    if(wave<10)assert.equal(match.timer,20);
  }
  assert.equal(match.score,match.kills*100);assert.equal(match.winner,'toys');
});
test('Núcleo destruido termina la partida y reinicio limpia el resultado',()=>{
  const match=new Match();match.beginWave();match.damageBase(1000);
  assert.equal(match.baseHealth,0);assert.equal(match.phase,'lost');
  match.reset();assert.equal(match.baseHealth,1000);assert.equal(match.wave,0);assert.equal(match.score,0);
});
test('Navegación rodea una pared por su abertura en lugar de atravesarla',()=>{
  const nav=new Navigation(40,2,(x,z)=>Math.abs(x)<2&&z<10);
  const field=nav.fill(nav.field(),12,0),out={};let x=-12,z=0;
  for(let i=0;i<160;i++){
    nav.direction(field,x,z,out);x+=out.x*.75;z+=out.z*.75;
    assert.ok(!(Math.abs(x)<2&&z<10),'Atravesó una cobertura');
    if(Math.hypot(x-12,z)<2)break;
  }
  assert.ok(Math.hypot(x-12,z)<2,'No alcanzó el destino');
});
test('Raycast de visión bloquea disparos tras cobertura pero deja pasar por fuera',()=>{
  const wall=[{x:0,z:0,w:4,d:10,h:5}];
  assert.equal(clearSight({x:-10,z:0},{x:10,z:0},wall),false);
  assert.equal(clearSight({x:-10,z:9},{x:10,z:9},wall),true);
  assert.equal(clearSight({x:-10,z:0},{x:10,z:0},wall,7),true);
});
