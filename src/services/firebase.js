import { firebaseConfig } from '../config.js';
import {applyResult,normalizeProfile,profileDefaults,purchase} from '../../functions/shared/progression.js';
import {CHARACTERS,MODES} from '../../functions/shared/catalog.js';

export function extractUid(rawId){
  if(typeof rawId!=='string')return '';
  const value=rawId.trim(),separator=value.lastIndexOf('#');
  return (separator>=0?value.slice(separator+1):value).trim();
}

function generatePlayerTag(displayName,uid){
  const cleanName=String(displayName||'Jugador').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]/g,'').slice(0,16).toUpperCase()||'JUGADOR';
  return `${cleanName}#${uid}`;
}

/** Dependencias cargadas solo si existe configuración. Un fallo de Firebase
 * no impide probar el motor como invitado. Nunca guarda datos de invitado.
 */
export class AccountService {
  constructor() { this.enabled = !!firebaseConfig?.projectId; this.user = null; this.presenceCleanup=null;this.gameSockets=new Set(); }
  async init(onSession) {
    if (!this.enabled) return;
    const [appSDK, authSDK, firestoreSDK] = await Promise.all([
      import('firebase/app'), import('firebase/auth'), import('firebase/firestore'),
    ]);
    this.authSDK = authSDK;
    this.firestoreSDK=firestoreSDK;
    const app = appSDK.initializeApp(firebaseConfig);
    this.auth = authSDK.getAuth(app);
    this.db=firestoreSDK.getFirestore(app);
    this.auth.languageCode = 'es';
    try { await authSDK.setPersistence(this.auth, authSDK.browserLocalPersistence); }
    catch {
      // Algunos navegadores privados rechazan almacenamiento persistente.
      await authSDK.setPersistence(this.auth, authSDK.inMemoryPersistence);
    }
    this.unsubscribe = authSDK.onAuthStateChanged(this.auth, user => {
      this.user = user;
      onSession(user);
    });
  }
  async signIn() {
    if (!this.auth) throw new Error('Configura Firebase en src/config.js para habilitar Google. Puedes explorar como invitado.');
    const provider = new this.authSDK.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return this.authSDK.signInWithPopup(this.auth, provider);
  }
  async loadProfile(user) {
    if(!user||!this.db)throw new Error('Inicia sesión para cargar tu perfil.');
    const {doc,getDoc,writeBatch}=this.firestoreSDK,playerRef=doc(this.db,'players',user.uid),directoryRef=doc(this.db,'playerDirectory',user.uid);
    const playerSnap=await getDoc(playerRef),saved=playerSnap.exists()?playerSnap.data():{};
    const profile=normalizeProfile(playerSnap.exists()?saved:profileDefaults(user.displayName||'Jugador'));
    profile.tag=saved.tag||generatePlayerTag(user.displayName,user.uid);
    const publicProfile={uid:user.uid,tag:profile.tag,displayName:profile.displayName,level:profile.level};
    const privateProfile={...profile,uid:user.uid,email:user.email||saved.email||null,photoURL:user.photoURL||saved.photoURL||null,createdAt:saved.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
    const batch=writeBatch(this.db);batch.set(playerRef,privateProfile);batch.set(directoryRef,publicProfile);await batch.commit();
    return privateProfile;
  }
  async profileAction(action,payload={}) {
    if(!this.user||!this.db)throw new Error('Inicia sesión para guardar tu progreso.');
    const {doc,runTransaction}=this.firestoreSDK,uid=this.user.uid,playerRef=doc(this.db,'players',uid),directoryRef=doc(this.db,'playerDirectory',uid);
    return runTransaction(this.db,async transaction=>{
      const snapshot=await transaction.get(playerRef);
      if(!snapshot.exists())throw new Error('No se encontró el perfil del jugador.');
      const saved=snapshot.data(),profile=normalizeProfile(saved),{id,result,name}=payload;
      if(action==='purchase')Object.assign(profile,purchase(profile,id));
      else if(action==='equip'){if(!profile.unlockedCharacters.includes(id))throw new Error('Personaje bloqueado.');profile.selectedCharacter=id;}
      else if(action==='name'){if(typeof name!=='string'||!name.trim()||name.trim().length>60)throw new Error('Nombre inválido.');profile.displayName=name.trim();}
      else if(action==='result'){
        if(!result||typeof result.id!=='string'||!/^[-a-zA-Z0-9]{1,64}$/.test(result.id)||!MODES[result.mode]||!CHARACTERS[result.character]||CHARACTERS[result.character].team!==result.team||typeof result.won!=='boolean')throw new Error('Resultado inválido.');
        for(const key of ['kills','deaths','healing','objectives','duration'])if(!Number.isFinite(result[key])||result[key]<0)throw new Error('Estadísticas inválidas.');
        Object.assign(profile,applyResult(profile,result));
      }else throw new Error('Acción inválida.');
      profile.tag=saved.tag;const updated={...profile,uid,email:saved.email||null,photoURL:saved.photoURL||null,createdAt:saved.createdAt,updatedAt:new Date().toISOString()};
      transaction.set(playerRef,updated);transaction.set(directoryRef,{uid,tag:profile.tag,displayName:profile.displayName,level:profile.level});
      return updated;
    });
  }
  async socialAction(name,payload={}) {
    if(!this.user||!this.db)throw new Error('Inicia sesión para usar las funciones sociales.');
    const {collection,doc,getDocs,limit,query,runTransaction,serverTimestamp,where}=this.firestoreSDK,uid=this.user.uid;
    if(name==='searchPlayers'){
      const tag=String(payload.targetTag||'').trim();if(!tag)throw new Error('Escribe un ID de jugador.');
      const matches=await getDocs(query(collection(this.db,'playerDirectory'),where('tag','==',tag),limit(2)));
      return {players:matches.docs.filter(item=>item.id!==uid).map(item=>({uid:item.id,...item.data()}))};
    }
    if(name==='sendFriendRequest'){
      const tag=String(payload.targetTag||'').trim();if(!tag)throw new Error('Tag inválido.');
      const matches=await getDocs(query(collection(this.db,'playerDirectory'),where('tag','==',tag),limit(1)));
      if(matches.empty)throw new Error('Jugador no encontrado.');
      const targetUid=matches.docs[0].id;if(targetUid===uid)throw new Error('No puedes agregarte a ti mismo.');
      const senderRef=doc(this.db,'players',uid),friendRef=doc(this.db,'players',uid,'friends',targetUid),requestRef=doc(this.db,'players',targetUid,'friendRequests',uid);
      await runTransaction(this.db,async transaction=>{
        const [sender,friend]=await Promise.all([transaction.get(senderRef),transaction.get(friendRef)]);
        if(!sender.exists()||!sender.data().tag)throw new Error('No se encontró tu perfil de jugador.');
        if(friend.exists())throw new Error('Ya sois amigos.');
        transaction.set(requestRef,{fromUid:uid,fromTag:sender.data().tag,fromName:sender.data().displayName,fromLevel:sender.data().level,status:'pending',timestamp:serverTimestamp()});
      });
      return {success:true,message:'Solicitud enviada correctamente.'};
    }
    if(name==='acceptFriendRequest'){
      const friendUid=payload.friendUid;if(typeof friendUid!=='string'||!friendUid||friendUid===uid)throw new Error('Identificador de jugador inválido.');
      const requestRef=doc(this.db,'players',uid,'friendRequests',friendUid),myProfileRef=doc(this.db,'players',uid),myFriendRef=doc(this.db,'players',uid,'friends',friendUid),theirFriendRef=doc(this.db,'players',friendUid,'friends',uid);
      await runTransaction(this.db,async transaction=>{
        const [pending,myProfile,myFriend]=await Promise.all([transaction.get(requestRef),transaction.get(myProfileRef),transaction.get(myFriendRef)]);
        if(!pending.exists()||pending.data().status!=='pending'||pending.data().fromUid!==friendUid)throw new Error('Solicitud de amistad no encontrada.');
        if(!myProfile.exists()||!myProfile.data().tag)throw new Error('No se encontró tu perfil de jugador.');
        if(myFriend.exists())throw new Error('Ya sois amigos.');
        const requestData=pending.data(),myData=myProfile.data();
        transaction.set(myFriendRef,{friendUid,friendTag:requestData.fromTag,friendName:requestData.fromName,friendLevel:requestData.fromLevel||1,addedAt:serverTimestamp()});
        transaction.set(theirFriendRef,{friendUid:uid,friendTag:myData.tag,friendName:myData.displayName,friendLevel:myData.level,addedAt:serverTimestamp()});
        transaction.delete(requestRef);
      });
      return {success:true};
    }
    throw new Error('Acción social inválida.');
  }
  async sendSquadInvite(targetUid) {
    if(!this.user||!this.db)throw new Error('Inicia sesión para invitar amigos.');
    const toUid=extractUid(targetUid),fromUid=extractUid(this.user.uid);
    if(!toUid||!fromUid||toUid===fromUid)throw new Error('Jugador inválido.');
    const {collection,doc,getDoc,setDoc,serverTimestamp}=this.firestoreSDK;
    const inviteRef=doc(collection(this.db,'squadInvites'));
    const [senderSnap,targetFriendSnap]=await Promise.all([
      getDoc(doc(this.db,'players',fromUid)),
      getDoc(doc(this.db,'players',fromUid,'friends',toUid)),
    ]);
    if(!senderSnap.exists()||!targetFriendSnap.exists())throw new Error('Solo puedes invitar a un amigo.');
    const sender=senderSnap.data();
    await setDoc(inviteRef,{
      fromUid,toUid,fromName:sender.displayName||'Jugador',fromTag:sender.tag||'',
      status:'pending',createdAt:serverTimestamp(),
    });
  }
  async respondToSquadInvite(inviteId,status) {
    if(!this.user||!this.db)throw new Error('Inicia sesión para responder invitaciones.');
    if(typeof inviteId!=='string'||!inviteId||!['accepted','rejected'].includes(status))throw new Error('Invitación inválida.');
    const {doc,runTransaction,serverTimestamp}=this.firestoreSDK,uid=extractUid(this.user.uid);
    const inviteRef=doc(this.db,'squadInvites',inviteId),squadRef=doc(this.db,'squadLobbies',inviteId);
    await runTransaction(this.db,async transaction=>{
      const invite=await transaction.get(inviteRef);
      if(!invite.exists()||invite.data().toUid!==uid||invite.data().status!=='pending')throw new Error('La invitación ya no está disponible.');
      const invitation=invite.data();
      transaction.update(inviteRef,{status});
      if(status==='accepted'){
        transaction.set(squadRef,{
          leaderUid:invitation.fromUid,memberUid:uid,
          leaderName:invitation.fromName||'Líder',memberName:this.user.displayName||'Miembro',
          status:'in_lobby',leaderReady:false,memberReady:false,
          createdAt:serverTimestamp(),updatedAt:serverTimestamp(),
        });
      }
    });
  }
  async updateSquadState(squadId,updateData) {
    if(!this.user||!this.db)throw new Error('Inicia sesión para usar el escuadrón.');
    const {doc,updateDoc,serverTimestamp}=this.firestoreSDK,uid=extractUid(this.user.uid);
    const allowed=['leaderReady','memberReady','status'];
    if(!updateData||Object.keys(updateData).length!==1||!allowed.includes(Object.keys(updateData)[0]))throw new Error('Cambio de estado del escuadrón inválido.');
    const [key,value]=Object.entries(updateData)[0];
    if((key==='leaderReady'||key==='memberReady')&&typeof value!=='boolean')throw new Error('Estado de listo inválido.');
    if(key==='status'&&value!=='starting')throw new Error('Estado de partida inválido.');
    const squadRef=doc(this.db,'squadLobbies',squadId),snapshot=await this.firestoreSDK.getDoc(squadRef);
    if(!snapshot.exists())throw new Error('La sala del escuadrón ya no existe.');
    const squad=snapshot.data();
    if((key==='leaderReady'&&squad.leaderUid!==uid)||(key==='memberReady'&&squad.memberUid!==uid))throw new Error('No puedes cambiar el estado de otro integrante.');
    if(key==='status'&&(squad.leaderUid!==uid||!squad.leaderReady||!squad.memberReady||squad.status!=='in_lobby'))throw new Error('Ambos integrantes deben estar listos antes de iniciar.');
    await updateDoc(squadRef,{...updateData,updatedAt:serverTimestamp()});
  }
  squadRef(squadId){
    if(!this.db||typeof squadId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(squadId))throw new Error('Sala de escuadrón inválida.');
    return this.firestoreSDK.doc(this.db,'squadLobbies',squadId);
  }
  watchSquadPlayers(squadId,onValue,onError){
    const squad=this.squadRef(squadId),players=this.firestoreSDK.collection(squad,'players');
    return this.firestoreSDK.onSnapshot(players,snapshot=>onValue(snapshot.docs.map(item=>({...item.data(),uid:item.id}))),onError);
  }
  watchSquadGame(squadId,onValue,onError){
    const squad=this.squadRef(squadId),state=this.firestoreSDK.doc(squad,'game','current');
    return this.firestoreSDK.onSnapshot(state,snapshot=>onValue(snapshot.exists()?snapshot.data():null),onError);
  }
  async connectSquadGame(squadId,{onMessage,onError}={}){
    if(!this.user)throw new Error('Inicia sesión para conectar la partida.');
    if(typeof squadId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(squadId))throw new Error('Sala de escuadrón inválida.');
    if(typeof WebSocket==='undefined')throw new Error('WebSocket no está disponible en este navegador.');
    const token=await this.user.getIdToken(),endpoint=new URL(globalThis.GAME_SOCKET_URL||globalThis.location.href);
    endpoint.protocol=endpoint.protocol==='https:'?'wss:':'ws:';endpoint.pathname='/game';endpoint.search='';endpoint.searchParams.set('squadId',squadId);
    const socket=new WebSocket(endpoint),opened=await new Promise((resolve,reject)=>{
      let settled=false;
      const timeout=setTimeout(()=>{if(!settled){settled=true;socket.close();reject(new Error('Tiempo de espera al conectar con el servidor de partida.'));}},8000);
      socket.addEventListener('open',()=>socket.send(JSON.stringify({type:'auth',token})),{once:true});
      socket.addEventListener('message',event=>{
        let packet;
        try{packet=JSON.parse(event.data);}catch(error){onError?.(new Error('El servidor envió un paquete de partida inválido.',{cause:error}));return;}
        if(packet.type==='ready'&&!settled){settled=true;clearTimeout(timeout);resolve(packet);}
        else if(packet.type==='error'&&!settled){settled=true;clearTimeout(timeout);socket.close();reject(new Error(packet.message||'Error de conexión con la partida.'));}
        onMessage?.(packet);
      });
      socket.addEventListener('error',()=>{if(!settled){settled=true;clearTimeout(timeout);reject(new Error('No se pudo conectar con el servidor WebSocket de partida.'));}});
      socket.addEventListener('close',event=>{
        this.gameSockets.delete(socket);
        if(!settled){settled=true;clearTimeout(timeout);reject(new Error(`Conexión WebSocket cerrada durante la autenticación (${event.code}).`));}
        else if(event.code!==1000&&event.code!==1001)onError?.(new Error(`Conexión con la partida cerrada (${event.code}).`));
      });
    });
    this.gameSockets.add(socket);
    return{
      ready:opened,
      send:(type,data)=>{
        if(socket.readyState!==WebSocket.OPEN)throw new Error('La conexión de partida no está abierta.');
        if(!['player:move','player:fire','combat:event','game:state'].includes(type))throw new Error('Evento de partida inválido.');
        socket.send(JSON.stringify({type,data}));
      },
      close:()=>{this.gameSockets.delete(socket);socket.close();},
    };
  }
  async publishSquadPlayer(squadId,data){
    if(!this.user||!this.db)throw new Error('Inicia sesión para sincronizar la partida.');
    const characterId=data.characterId||data.hero;
    if(typeof characterId!=='string'||!characterId)throw new Error('Personaje de escuadrón inválido.');
    const ref=this.firestoreSDK.doc(this.squadRef(squadId),'players',extractUid(this.user.uid));
    await this.firestoreSDK.setDoc(ref,{...data,characterId,vx:Number.isFinite(data.vx)?data.vx:0,vy:Number.isFinite(data.vy)?data.vy:0,vz:Number.isFinite(data.vz)?data.vz:0,uid:extractUid(this.user.uid),sentAt:this.firestoreSDK.serverTimestamp()});
  }
  async publishSquadGame(squadId,data){
    if(!this.user||!this.db)throw new Error('Inicia sesión para sincronizar la partida.');
    const ref=this.firestoreSDK.doc(this.squadRef(squadId),'game','current');
    await this.firestoreSDK.setDoc(ref,{...data,updatedAt:this.firestoreSDK.serverTimestamp()});
  }
  watchMySquadLobbies(uid,onValue,onError) {
    const cleanUid=extractUid(uid);
    if(!this.db||!cleanUid)throw new Error('Salas de escuadrón no disponibles.');
    const {collection,query,where,onSnapshot}=this.firestoreSDK;
    const squads=new Map();
    const emit=()=>onValue([...squads.values()]);
    const listen=(field)=>{
      const ref=query(collection(this.db,'squadLobbies'),where(field,'==',cleanUid));
      return onSnapshot(ref,snapshot=>{
        for(const [id,squad] of squads)if(squad[field]===cleanUid)squads.delete(id);
        for(const item of snapshot.docs)squads.set(item.id,{...item.data(),id:item.id});
        emit();
      },onError);
    };
    const stopLeader=listen('leaderUid'),stopMember=listen('memberUid');
    return ()=>{stopLeader();stopMember();};
  }
  watchPresence(uid,onValue,onError) {
    const cleanUid=extractUid(uid);
    if(!this.db||!cleanUid)throw new Error('Presencia no disponible.');
    return this.firestoreSDK.onSnapshot(
      this.firestoreSDK.doc(this.db,'playerPresence',cleanUid),
      snapshot=>onValue(snapshot.exists()?snapshot.data():null),
      onError,
    );
  }
  watchIncomingSquadInvites(uid,onValue,onError) {
    const cleanUid=extractUid(uid);
    if(!this.db||!cleanUid)throw new Error('Invitaciones no disponibles.');
    const {collection,query,where}=this.firestoreSDK;
    return this.firestoreSDK.onSnapshot(
      query(
        collection(this.db,'squadInvites'),
        where('toUid','==',cleanUid),
        where('status','==','pending'),
      ),
      snapshot=>onValue(snapshot.docs.map(item=>({...item.data(),id:item.id}))),
      onError,
    );
  }
  startPresence(user,onError) {
    this.stopPresence();
    const uid=extractUid(user?.uid);
    if(!uid||!this.db)return;
    const {doc,setDoc,serverTimestamp}=this.firestoreSDK,ref=doc(this.db,'playerPresence',uid);
    const write=async online=>{
      try{await setDoc(ref,{online,lastSeen:serverTimestamp()},{merge:true});}
      catch(error){onError?.(error);}
    };
    void write(true);
    const heartbeat=setInterval(()=>void write(true),30000);
    const markOffline=()=>void write(false);
    window.addEventListener('pagehide',markOffline);
    this.presenceCleanup=()=>{
      clearInterval(heartbeat);
      window.removeEventListener('pagehide',markOffline);
      const offlineWrite=write(false);
      this.presenceCleanup=null;
      return offlineWrite;
    };
  }
  stopPresence(){return this.presenceCleanup?.();}
  watchPlayerCollection(uid,name,onValue,onError) {
    if(!this.db||!['friendRequests','friends'].includes(name))throw new Error('Colección social no disponible.');
    const ref=this.firestoreSDK.collection(this.db,'players',uid,name);
    return this.firestoreSDK.onSnapshot(ref,snapshot=>onValue(snapshot.docs.map(item=>({...item.data(),id:item.id}))),onError);
  }
  async updateDisplayName(name) {
    const clean = String(name).trim().slice(0, 60);
    if (!clean) throw new Error('El nombre no puede estar vacío.');
    return this.profileAction('name',{name:clean});
  }
  // XP, desbloqueos y K/D se escribirán desde un backend de confianza.
  // Firestore es persistencia de perfiles; no es transporte de simulación FPS.
  async signOut() { await this.stopPresence();if (this.auth) await this.authSDK.signOut(this.auth); }
  dispose() { this.stopPresence();for(const socket of this.gameSockets)socket.close();this.gameSockets.clear();this.unsubscribe?.(); }
}
