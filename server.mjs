// Servidor local de desarrollo y relay autenticado de gameplay de escuadrones.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {initializeApp,applicationDefault,cert,getApps} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {WebSocketServer,WebSocket} from 'ws';

const root=path.dirname(fileURLToPath(import.meta.url));
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json'};
const port=Number(process.env.PORT||10000),host='0.0.0.0',roomMembers=new Map();
const server=http.createServer(async(req,res)=>{
 try{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,`.${pathname==='/'?'/index.html':pathname}`);
  const relative=path.relative(root,file);
  if(relative.startsWith('..')||path.isAbsolute(relative)||!types[path.extname(file)]||relative.split(path.sep).some(part=>part.startsWith('.'))){res.writeHead(403);res.end('Forbidden');return;}
  const body=await readFile(file);
  res.writeHead(200,{'Content-Type':`${types[path.extname(file)]}; charset=utf-8`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.end(req.method==='HEAD'?undefined:body);
 }catch{res.writeHead(404);res.end('Not found');}
});

let adminAuth,firestore;
function getAdminServices(){
 if(!getApps().length){
  const serviceAccountValue=process.env.FIREBASE_SERVICE_ACCOUNT;
  let credential=applicationDefault();
  if(serviceAccountValue){
   let serviceAccount;
   try{serviceAccount=typeof serviceAccountValue==='string'?JSON.parse(serviceAccountValue):serviceAccountValue;}
   catch(error){throw new Error('FIREBASE_SERVICE_ACCOUNT no contiene JSON válido.',{cause:error});}
   if(!serviceAccount||typeof serviceAccount!=='object'||Array.isArray(serviceAccount)||typeof serviceAccount.project_id!=='string'||typeof serviceAccount.client_email!=='string'||typeof serviceAccount.private_key!=='string'){
    throw new Error('FIREBASE_SERVICE_ACCOUNT debe contener project_id, client_email y private_key.');
   }
   serviceAccount.private_key=serviceAccount.private_key.replace(/\\n/g,'\n');
   credential=cert(serviceAccount);
  }
  initializeApp({credential});
 }
 adminAuth??=getAuth();firestore??=getFirestore();
 return {adminAuth,firestore};
}
function send(socket,message){
 if(socket.readyState===WebSocket.OPEN)socket.send(JSON.stringify(message));
}
function leave(socket){
 const room=socket.room;
 if(!room)return;
 room.delete(socket.uid);socket.room=null;socket.uid=null;socket.squadId=null;
 if(room.size===0)for(const [id,value] of roomMembers)if(value===room){roomMembers.delete(id);break;}
}
const sockets=new WebSocketServer({noServer:true,maxPayload:64*1024,perMessageDeflate:false});
server.on('upgrade',async(req,socket,head)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname!=='/game'){socket.write('HTTP/1.1 404 Not Found\r\n\r\n');socket.destroy();return;}
  const squadId=url.searchParams.get('squadId');
  if(!squadId||!/^[A-Za-z0-9_-]{1,128}$/.test(squadId)){socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');socket.destroy();return;}
  sockets.handleUpgrade(req,socket,head,client=>{
   let authenticating=true;
   const authTimeout=setTimeout(()=>client.close(1008,'authentication timeout'),5000);
   client.on('message',(raw,isBinary)=>{
    if(isBinary)return;
    let message;
    try{message=JSON.parse(raw.toString());}catch{send(client,{type:'error',message:'Mensaje JSON inválido.'});return;}
    if(authenticating){
     if(message?.type!=='auth'||typeof message.token!=='string'){client.close(1008,'authentication required');return;}
     authenticating=false;
     void (async()=>{
      const {adminAuth:auth,firestore:db}=getAdminServices();
      const identity=await auth.verifyIdToken(message.token);
      const activeRoom=roomMembers.get(squadId);
      const squadSnapshot=await db.collection('squadLobbies').doc(squadId).get();
      if(client.readyState!==WebSocket.OPEN)return;
      if(!squadSnapshot.exists){send(client,{type:'error',message:'No perteneces a esta sala.'});client.close(1008,'not a squad member');return;}
      const squad=squadSnapshot.data();
      if(typeof squad.leaderUid!=='string'||typeof squad.memberUid!=='string'||squad.leaderUid===squad.memberUid||![squad.leaderUid,squad.memberUid].includes(identity.uid)){
       send(client,{type:'error',message:'No perteneces a esta sala.'});client.close(1008,'not a squad member');return;
      }
      if(activeRoom?.squad&&(activeRoom.squad.leaderUid!==squad.leaderUid||activeRoom.squad.memberUid!==squad.memberUid)){
       send(client,{type:'error',message:'Los integrantes de la sala cambiaron. Vuelve a crear el escuadrón.'});client.close(1008,'squad membership changed');return;
      }
      clearTimeout(authTimeout);
      const room=activeRoom||new Map();room.squad={leaderUid:squad.leaderUid,memberUid:squad.memberUid};roomMembers.set(squadId,room);
      if(room.has(identity.uid)){send(client,{type:'error',message:'Este usuario ya está conectado a la sala.'});client.close(1008,'duplicate session');return;}
      client.uid=identity.uid;client.squadId=squadId;client.room=room;client.isLeader=identity.uid===squad.leaderUid;client.messageWindow=Date.now();client.messageCount=0;room.set(identity.uid,client);
      console.log('[WebSocket] Jugador conectado a sala:',squadId,identity.uid);
      send(client,{type:'ready',squadId,uid:identity.uid,members:[...room.keys()]});
      for(const member of room.values())if(member!==client)send(member,{type:'member:joined',uid:identity.uid});
     })().catch(error=>{console.error('[WebSocket] Falló la verificación del token o de Firestore:',error);send(client,{type:'error',message:'No se pudo autenticar la sala.'});client.close(1011,'authentication failed');});
     return;
    }
    if(!client.room){client.close(1008,'authentication required');return;}
    if(!message||typeof message.type!=='string'||!['player:move','player:fire','combat:event','game:state'].includes(message.type)||!message.data||typeof message.data!=='object'||Array.isArray(message.data)){
     send(client,{type:'error',message:'Evento de gameplay inválido.'});return;
    }
    const now=Date.now();
    if(now-client.messageWindow>=1000){client.messageWindow=now;client.messageCount=0;}
    if(++client.messageCount>90){client.close(1008,'message rate exceeded');return;}
    if((message.type==='game:state'&&!client.isLeader)||(message.type==='combat:event'&&!client.isLeader)||(['player:move','player:fire'].includes(message.type)&&client.isLeader)){
     send(client,{type:'error',message:'No tienes permiso para publicar este evento.'});return;
    }
    if(message.type==='player:move'){
     const data=message.data;
     if(!['x','y','z','yaw','pitch'].every(key=>Number.isFinite(data[key]))||Math.abs(data.x)>100||data.y<0||data.y>30||Math.abs(data.z)>100||!['vx','vy','vz'].every(key=>Number.isFinite(data[key]))||Math.max(Math.abs(data.vx),Math.abs(data.vy),Math.abs(data.vz))>100){
      send(client,{type:'error',message:'Vector de movimiento inválido.'});return;
     }
    }
    const packet=JSON.stringify({type:message.type,uid:client.uid,data:message.data});
    for(const member of client.room.values())if(member!==client&&member.readyState===WebSocket.OPEN)member.send(packet);
   });
   client.on('close',()=>{clearTimeout(authTimeout);const uid=client.uid,room=client.room;leave(client);if(uid)for(const member of room?.values()||[])send(member,{type:'member:left',uid});});
   client.on('error',error=>console.error('WebSocket de escuadrón:',error));
  });
 }catch(error){
  console.error('No se pudo autenticar el WebSocket de escuadrón:',error);
  if(!socket.destroyed){socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');socket.destroy();}
 }
});
server.listen(port,host,()=>console.log(`Servidor corriendo en http://${host}:${port}`));
