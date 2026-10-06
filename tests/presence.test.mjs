import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractUid} from '../src/services/firebase.js';
import {isFriendOnline} from '../src/social.js';

test('extractUid acepta UID puro, tag compuesto y entradas vacías',()=>{
 assert.equal(extractUid('HLaaaInUOROwe5QiedM1UwBOUApi'),'HLaaaInUOROwe5QiedM1UwBOUApi');
 assert.equal(extractUid('SANTIAGOIVANNAVA#HLaaaInUOROwe5QiedM1UwBOUApi'),'HLaaaInUOROwe5QiedM1UwBOUApi');
 assert.equal(extractUid('  JUGADOR#uid-123  '),'uid-123');
 assert.equal(extractUid('JUGADOR#'),'');
 assert.equal(extractUid(null),'');
});

test('la presencia del amigo se consulta por UID aunque el dato traiga su tag',()=>{
 const uid='HLaaaInUOROwe5QiedM1UwBOUApi',now=Date.now();
 const presence=new Map([[uid,{online:true,lastSeen:now}]]);
 assert.equal(isFriendOnline({friendTag:`SANTIAGOIVANNAVA#${uid}`},presence),true);
 assert.equal(isFriendOnline({friendUid:uid},presence),true);
 assert.equal(isFriendOnline({id:`SANTIAGOIVANNAVA#${uid}`},presence),true);
 assert.equal(isFriendOnline({friendTag:`SANTIAGOIVANNAVA#${uid}`},new Map([[uid,{online:true,lastSeen:now-65001}]])),false);
 assert.equal(isFriendOnline({friendUid:uid},new Map([[uid,{online:false,lastSeen:now}]])),false);
 assert.equal(isFriendOnline({friendTag:'NOMBRE#uid-a'},{'uid-b':{online:true,lastSeen:now}}),false);
});
