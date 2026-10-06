import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ROSTER,CHARACTERS} from '../functions/shared/catalog.js';
import {profileDefaults,normalizeProfile,applyResult,purchase} from '../functions/shared/progression.js';
import {Match} from '../src/match.js';
import {ProgressStore} from '../src/progress-store.js';

test('Catálogo: 12 personajes, 6 por facción, tres habilidades y estadísticas específicas',()=>{
 assert.equal(ROSTER.length,12);assert.equal(new Set(ROSTER.map(c=>c.id)).size,12);
 for(const team of ['toys','nightmares'])assert.equal(ROSTER.filter(c=>c.team===team).length,6);
 for(const c of ROSTER){assert.equal(c.abilities.length,3);assert.ok(c.hp>0&&c.speed>0&&c.height>0);assert.ok(c.weapon.damage>0&&c.weapon.interval>0);}
 assert.equal(CHARACTERS.captain.hp,125);assert.equal(CHARACTERS.titan.hp,250);assert.equal(CHARACTERS.sombrio.speed,1.1);
});
test('XP, monedas y esencias se suman una vez por partida y respetan la facción',()=>{
 const r={id:'one',team:'toys',kills:4,healing:40,objectives:2,won:true};
 let p=applyResult(profileDefaults(),r);assert.equal(p.experience,490);assert.equal(p.coins,244);assert.equal(p.essence,0);
 assert.deepEqual(applyResult(p,r),p);
 p=applyResult(p,{...r,id:'two',team:'nightmares'});assert.equal(p.essence,244);assert.equal(p.coins,244);assert.equal(p.experience,980);
 p=applyResult(p,{id:'three',team:'toys',won:false});assert.equal(p.level,2);
});
test('Desbloqueos automáticos por nivel y por victorias, con divisas independientes',()=>{
 let p=normalizeProfile({experience:2000,stats:{wins:{toys:5,nightmares:10}},coins:500,essence:1500});
 for(const id of ['felpa','gargajo','chispita','susurro'])assert.ok(p.unlockedCharacters.includes(id));
 assert.ok(!p.unlockedCharacters.includes('sora'));p=purchase(p,'meca');assert.equal(p.coins,0);assert.equal(p.essence,1500);
 assert.deepEqual(purchase(p,'meca'),p);assert.throws(()=>purchase(p,'dino'));assert.throws(()=>purchase(p,'costura'));
 p=purchase(p,'titan');assert.equal(p.essence,0);assert.ok(p.unlockedCharacters.includes('titan'));
 p=normalizeProfile({...p,experience:9000});assert.ok(p.unlockedCharacters.includes('costura'));assert.ok(p.unlockedCharacters.includes('sora'));
});
test('Conquista: disputa, captura secuencial, victoria atacante y defensa por tiempo',()=>{
 const m=new Match();m.reset('conquest','nightmares',6);
 m.captureTick(20,3,1);assert.equal(m.capture,0);assert.equal(m.contested,true);
 for(let i=0;i<3;i++){assert.equal(m.captureTick(10,2,0),true);assert.equal(m.sector,i+1);}
 assert.equal(m.phase,'won');assert.equal(m.winner,'nightmares');
 m.reset('conquest','toys',6);m.captureTick(240,0,1);assert.equal(m.phase,'won');assert.equal(m.winner,'toys');
});
test('Baja confirmada: 35 recogidas cierran la partida y no se suman puntos posteriores',()=>{
 const m=new Match();m.reset('confirmed','nightmares',4);for(let i=0;i<34;i++)m.confirm('nightmares');assert.equal(m.phase,'battle');
 m.confirm('nightmares');assert.equal(m.phase,'won');m.confirm('toys');assert.equal(m.points.toys,0);
});
test('Tienda de horda: ventana entre oleadas, coste, reparación y mejoras limitadas',()=>{
 const m=new Match();assert.throws(()=>m.buyUpgrade('damage'));m.beginWave();assert.throws(()=>m.buyUpgrade('damage'));
 const n=m.remaining;for(let i=0;i<n;i++)m.kill();assert.equal(m.wavePoints,300);
 m.buyUpgrade('health');assert.equal(m.upgrades.health,1);assert.equal(m.wavePoints,150);
 m.baseHealth=500;m.buyUpgrade('repair');assert.equal(m.baseHealth,700);assert.equal(m.wavePoints,50);assert.throws(()=>m.buyUpgrade('damage'));
});
test('Progreso local persiste tras recargar, sin llamar a Firebase',async()=>{
 const saved=new Map(),prior=globalThis.localStorage;globalThis.localStorage={getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)};
 try{const store=new ProgressStore({profileAction(){throw new Error('Firebase no debe usarse');}});store.openGuest();await store.select('sombrio');await store.record({id:'local',team:'nightmares',kills:4,won:true});
 const reopened=new ProgressStore({});reopened.openGuest();assert.equal(reopened.profile.selectedCharacter,'sombrio');assert.equal(reopened.profile.essence,198);assert.equal(reopened.profile.experience,400);await reopened.record({id:'local',team:'nightmares',kills:4,won:true});assert.equal(reopened.profile.experience,400);
 }finally{globalThis.localStorage=prior;}
});
