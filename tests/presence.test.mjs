import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AccountService,extractUid} from '../src/services/firebase.js';
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

test('las invitaciones usan y escuchan el UID limpio del destinatario',async()=>{
 const writes=[],lookups=[],queryCapture={};
 const service=new AccountService();
 service.user={uid:'hostUid'};
 service.db={};
 service.firestoreSDK={
  collection:(_db,name)=>({path:name}),
  doc:(...args)=>args.length===1?{path:`${args[0].path}/generated`}:{path:args.slice(1).join('/')},
  getDoc:async ref=>{lookups.push(ref.path);return {exists:()=>true,data:()=>({displayName:'Host',tag:'HOST#hostUid'})};},
  setDoc:async(_ref,data)=>writes.push(data),
  serverTimestamp:()=>123,
  query:(collection,...constraints)=>({collection,constraints}),
  where:(field,operator,value)=>({field,operator,value}),
  onSnapshot:(query)=>{queryCapture.value=query;return ()=>{};},
 };

 await service.sendSquadInvite('SANTIAGOIVANNAVA#friendUid');
 assert.deepEqual(lookups,['players/hostUid','players/hostUid/friends/friendUid']);
 assert.equal(writes[0].fromUid,'hostUid');
 assert.equal(writes[0].toUid,'friendUid');
 assert.equal(writes[0].status,'pending');

 service.watchIncomingSquadInvites('SANTIAGOIVANNAVA#friendUid',()=>{});
 assert.deepEqual(queryCapture.value.constraints,[
  {field:'toUid',operator:'==',value:'friendUid'},
  {field:'status',operator:'==',value:'pending'},
 ]);
});
