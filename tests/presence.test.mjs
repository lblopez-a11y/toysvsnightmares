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

test('aceptar invitación crea la sala y marca la invitación como aceptada en una transacción',async()=>{
 const writes=[],service=new AccountService();
 service.user={uid:'memberUid',displayName:'Santiago'};service.db={};
 service.firestoreSDK={
  doc:(_db,collection,id)=>({path:`${collection}/${id}`}),
  runTransaction:async(_db,callback)=>callback({
   get:async ref=>({exists:()=>true,data:()=>ref.path==='squadInvites/invite-1'?{fromUid:'leaderUid',toUid:'memberUid',fromName:'Líder',status:'pending'}:null}),
   update:(ref,data)=>writes.push({type:'update',path:ref.path,data}),
   set:(ref,data)=>writes.push({type:'set',path:ref.path,data}),
  }),
  serverTimestamp:()=>123,
 };

 await service.respondToSquadInvite('invite-1','accepted');
 assert.deepEqual(writes.map(write=>[write.type,write.path]),[
  ['update','squadInvites/invite-1'],['set','squadLobbies/invite-1'],
 ]);
 assert.equal(writes[0].data.status,'accepted');
 assert.deepEqual(writes[1].data,{
  leaderUid:'leaderUid',memberUid:'memberUid',leaderName:'Líder',memberName:'Santiago',
  status:'in_lobby',leaderReady:false,memberReady:false,createdAt:123,updatedAt:123,
 });
});

test('la transición de inicio requiere que el usuario sea líder y ambos estén listos',async()=>{
 const writes=[],service=new AccountService();
 service.user={uid:'leaderUid'};service.db={};
 service.firestoreSDK={
  doc:(_db,collection,id)=>({path:`${collection}/${id}`}),
  getDoc:async()=>({exists:()=>true,data:()=>({leaderUid:'leaderUid',memberUid:'memberUid',status:'in_lobby',leaderReady:true,memberReady:true})}),
  updateDoc:async(ref,data)=>writes.push({ref,data}),
  serverTimestamp:()=>456,
 };

 await service.updateSquadState('squad-1',{status:'starting'});
 assert.equal(writes.length,1);
 assert.deepEqual(writes[0].data,{status:'starting',updatedAt:456});
 await assert.rejects(service.updateSquadState('squad-1',{status:'in_game'}),/Estado de partida inválido/);
 assert.equal(writes.length,1);
});

test('el transporte de partida publica el estado propio y escucha el estado compartido del líder',async()=>{
 const writes=[],subscriptions=[],service=new AccountService(),db={};
 service.user={uid:'memberUid'};service.db=db;
 service.firestoreSDK={
  doc:(parent,...segments)=>({path:[parent===db?'':parent.path,...segments].filter(Boolean).join('/')}),
  collection:(parent,...segments)=>({path:[parent.path,...segments].join('/')}),
  setDoc:async(ref,data)=>writes.push({path:ref.path,data}),
  serverTimestamp:()=>456,
  onSnapshot:(ref,onValue)=>{subscriptions.push(ref.path);if(ref.path.endsWith('/game/current'))onValue({exists:()=>true,data:()=>({match:{wave:2}})});return ()=>{};},
 };

 await service.publishSquadPlayer('squad-2',{hero:'captain',characterId:'captain',x:1,y:0,z:2,vx:3,vy:0,vz:-2,yaw:0,pitch:0,moving:true,firing:false,fireSeq:0,abilitySeq:[0,0,0],reloadSeq:0,upgradeSeq:[0,0,0],playing:true});
 await service.publishSquadGame('squad-2',{actors:[],hostPlayer:{hero:'captain'},match:{wave:2},shots:[]});
 assert.equal(writes[0].path,'squadLobbies/squad-2/players/memberUid');
 assert.equal(writes[0].data.uid,'memberUid');
 assert.equal(typeof writes[0].data.sentAt,'number');
 assert.equal(writes[0].data.characterId,'captain');
 assert.deepEqual([writes[0].data.vx,writes[0].data.vy,writes[0].data.vz],[3,0,-2]);
 assert.equal(writes[1].path,'squadLobbies/squad-2/game/current');
 assert.equal(writes[1].data.updatedAt,456);

 const observed=[];
 service.watchSquadPlayers('squad-2',players=>observed.push(players));
 service.watchSquadGame('squad-2',state=>observed.push(state));
 assert.deepEqual(subscriptions,[
  'squadLobbies/squad-2/players',
  'squadLobbies/squad-2/game/current',
 ]);
 assert.deepEqual(observed,[{match:{wave:2}}]);
});

test('WebSocket de partida autentica con Firebase y solo envía eventos de gameplay permitidos',async()=>{
 const oldWindow=globalThis.window,oldLocation=globalThis.location,oldWebSocket=globalThis.WebSocket;
 class MockWebSocket extends EventTarget{
  static OPEN=1;
  static readyPacket={type:'ready',uid:'player-1',squadId:'squad-1'};
  constructor(url){super();this.url=url;this.readyState=0;this.sent=[];MockWebSocket.instance=this;queueMicrotask(()=>{this.readyState=1;this.dispatchEvent(new Event('open'));});}
  send(value){const packet=JSON.parse(value);this.sent.push(packet);if(packet.type==='auth')queueMicrotask(()=>this.receive(MockWebSocket.readyPacket));}
  close(){this.readyState=3;this.dispatchEvent(Object.assign(new Event('close'),{code:1000}));}
  receive(packet){const event=new Event('message');event.data=JSON.stringify(packet);this.dispatchEvent(event);}
 }
 globalThis.window={};globalThis.location={href:'https://game.example/app'};
 globalThis.WebSocket=MockWebSocket;
 const service=new AccountService(),received=[];
 service.user={uid:'player-1',getIdToken:async()=> 'firebase-id-token'};
 try{
  const connection=await service.connectSquadGame('squad-1',{onMessage:packet=>received.push(packet)});
  const socket=MockWebSocket.instance;
  assert.equal(socket.url.toString(),'wss://game.example/game?squadId=squad-1');
  assert.deepEqual(socket.sent,[{type:'auth',token:'firebase-id-token'}]);
  assert.equal(received[0].uid,'player-1');
  assert.equal(connection.ready.squadId,'squad-1');
  connection.send('player:move',{x:1});
  assert.deepEqual(socket.sent[1],{type:'player:move',data:{x:1}});
  assert.throws(()=>connection.send('untrusted:event',{}),/Evento de partida inválido/);
  connection.close();
  assert.equal(service.gameSockets.size,0);
  MockWebSocket.readyPacket={type:'ready',uid:'player-1',squadId:'another-squad'};
  await assert.rejects(service.connectSquadGame('squad-1'),/sala o jugador diferente/);
 }finally{
  for(const socket of service.gameSockets)socket.close();
  globalThis.window=oldWindow;globalThis.location=oldLocation;globalThis.WebSocket=oldWebSocket;
 }
});
