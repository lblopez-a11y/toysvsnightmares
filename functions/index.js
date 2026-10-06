// Adaptador opcional; NO desplegado ni utilizado por el modo local.
// Los resultados del prototipo se originan en el cliente: no es un backend
// antitrampas. Una competición online necesita simulación de servidor.
import {initializeApp} from 'firebase-admin/app';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {onCall,HttpsError} from 'firebase-functions/v2/https';
import {profileDefaults,normalizeProfile,purchase,applyResult} from './shared/progression.js';
import {CHARACTERS,MODES} from './shared/catalog.js';
initializeApp();
const db=getFirestore();

function requireTag(value){
 if(typeof value!=='string'||!value.trim()||value.trim().length>64)throw new HttpsError('invalid-argument','Tag inválido.');
 return value.trim();
}

async function findPlayerByTag(tag){
 return db.collection('players').where('tag','==',tag).limit(1).get();
}

async function createPlayerTag(transaction,uid,name){
 const stem=String(name||'GUARDIA').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]/g,'').slice(0,16).toUpperCase()||'GUARDIA';
 for(let suffixLength=4;suffixLength<=uid.length;suffixLength+=2){
  const tag=`${stem}#${uid.slice(-suffixLength).toUpperCase()}`;
  const matches=await transaction.get(db.collection('players').where('tag','==',tag).limit(1));
  if(matches.empty||matches.docs[0].id===uid)return tag;
 }
 throw new HttpsError('resource-exhausted','No se pudo asignar un ID de jugador único.');
}

export const searchPlayers=onCall({maxInstances:3},async request=>{
 if(!request.auth)throw new HttpsError('unauthenticated','Debes iniciar sesión.');
 const tag=requireTag(request.data?.targetTag);
 const snapshot=await findPlayerByTag(tag);
 const player=snapshot.docs.find(doc=>doc.id!==request.auth.uid);
 if(!player)return {players:[]};
 const profile=player.data();
 return {players:[{uid:player.id,tag:profile.tag,displayName:profile.displayName||'Jugador'}]};
});

export const sendFriendRequest=onCall({maxInstances:3},async request=>{
 if(!request.auth)throw new HttpsError('unauthenticated','Debes iniciar sesión.');
 const targetTag=requireTag(request.data?.targetTag),senderUid=request.auth.uid;
 const snapshot=await findPlayerByTag(targetTag);
 if(snapshot.empty)throw new HttpsError('not-found','Jugador no encontrado.');
 const target=snapshot.docs[0],targetUid=target.id;
 if(targetUid===senderUid)throw new HttpsError('invalid-argument','No puedes agregarte a ti mismo.');

 const requestRef=db.doc(`players/${targetUid}/friendRequests/${senderUid}`);
 const targetRef=db.doc(`players/${targetUid}`);
 const senderRef=db.doc(`players/${senderUid}`);
 const friendRef=db.doc(`players/${senderUid}/friends/${targetUid}`);
 await db.runTransaction(async transaction=>{
  const [target,sender,pending,friend]=await Promise.all([transaction.get(targetRef),transaction.get(senderRef),transaction.get(requestRef),transaction.get(friendRef)]);
  if(!target.exists)throw new HttpsError('not-found','Jugador no encontrado.');
  if(!sender.exists||!sender.data().tag)throw new HttpsError('failed-precondition','No se pudo cargar tu perfil de jugador.');
  if(friend.exists)throw new HttpsError('already-exists','Ya sois amigos.');
  if(pending.exists)throw new HttpsError('already-exists','La solicitud ya está pendiente.');
  transaction.create(requestRef,{fromUid:senderUid,fromTag:sender.data().tag,fromName:sender.data().displayName||'Jugador',status:'pending',timestamp:FieldValue.serverTimestamp()});
 });
 return {success:true,message:'Solicitud enviada correctamente.'};
});

export const acceptFriendRequest=onCall({maxInstances:3},async request=>{
 if(!request.auth)throw new HttpsError('unauthenticated','Debes iniciar sesión.');
 const friendUid=request.data?.friendUid,myUid=request.auth.uid;
 if(typeof friendUid!=='string'||!friendUid.trim()||friendUid.trim()!==friendUid||friendUid.length>128)throw new HttpsError('invalid-argument','Identificador de jugador inválido.');
 if(friendUid===myUid)throw new HttpsError('invalid-argument','No puedes aceptarte a ti mismo.');

 const requestRef=db.doc(`players/${myUid}/friendRequests/${friendUid}`);
 const friendProfileRef=db.doc(`players/${friendUid}`);
 const myProfileRef=db.doc(`players/${myUid}`);
 const myFriendRef=db.doc(`players/${myUid}/friends/${friendUid}`);
 const theirFriendRef=db.doc(`players/${friendUid}/friends/${myUid}`);
 await db.runTransaction(async transaction=>{
    const [pending,friendProfile,myProfile,myFriend,theirFriend]=await Promise.all([
     transaction.get(requestRef),transaction.get(friendProfileRef),transaction.get(myProfileRef),transaction.get(myFriendRef),transaction.get(theirFriendRef),
  ]);
  if(!pending.exists||pending.data().status!=='pending'||pending.data().fromUid!==friendUid)throw new HttpsError('not-found','Solicitud de amistad no encontrada.');
  if(!friendProfile.exists)throw new HttpsError('not-found','Jugador no encontrado.');
    if(!myProfile.exists||!myProfile.data().tag)throw new HttpsError('failed-precondition','No se pudo cargar tu perfil de jugador.');
  if(myFriend.exists||theirFriend.exists)throw new HttpsError('already-exists','Ya sois amigos.');
    transaction.set(myFriendRef,{friendTag:friendProfile.data().tag||'Jugador',friendName:friendProfile.data().displayName||'Jugador',friendLevel:friendProfile.data().level||1,addedAt:FieldValue.serverTimestamp()});
    transaction.set(theirFriendRef,{friendTag:myProfile.data().tag,friendName:myProfile.data().displayName||'Jugador',friendLevel:myProfile.data().level||1,addedAt:FieldValue.serverTimestamp()});
  transaction.delete(requestRef);
 });
 return {success:true};
});

export const profileAction=onCall({maxInstances:3},async request=>{
 if(!request.auth)throw new HttpsError('unauthenticated','Inicia sesión.');
 const {action,id,result,name}=request.data||{},db=getFirestore(),ref=db.doc(`players/${request.auth.uid}`);
 return db.runTransaction(async tx=>{
    const snap=await tx.get(ref),saved=snap.data()||{};let p=snap.exists?normalizeProfile(saved):profileDefaults(request.auth.token.name||'Juguete');
    p.tag=saved.tag||await createPlayerTag(tx,request.auth.uid,p.displayName);
  try{
   if(action==='purchase')p=purchase(p,id);
   else if(action==='equip'){if(!p.unlockedCharacters.includes(id))throw new Error('Personaje bloqueado.');p.selectedCharacter=id;}
   else if(action==='name'){if(typeof name!=='string'||!name.trim()||name.length>60)throw new Error('Nombre inválido.');p.displayName=name.trim();}
   else if(action==='result'){
    if(!result||typeof result.id!=='string'||!/^[-a-zA-Z0-9]{1,64}$/.test(result.id)||!MODES[result.mode]||!CHARACTERS[result.character]||CHARACTERS[result.character].team!==result.team||typeof result.won!=='boolean')throw new Error('Resultado inválido.');
    for(const key of ['kills','deaths','healing','objectives','duration'])if(!Number.isFinite(result[key])||result[key]<0)throw new Error('Estadísticas inválidas.');
    const receipt=ref.collection('receipts').doc(result.id),saved=await tx.get(receipt);
    if(!saved.exists){p=applyResult(p,result);tx.create(receipt,{mode:result.mode,at:FieldValue.serverTimestamp()});}
   }else if(action!=='load')throw new Error('Acción inválida.');
  }catch(error){throw new HttpsError('invalid-argument',error.message);}
  tx.set(ref,{
   ...p,
   email:request.auth.token.email||saved.email||null,
   photoURL:request.auth.token.picture||saved.photoURL||null,
   createdAt:saved.createdAt||FieldValue.serverTimestamp(),
   updatedAt:FieldValue.serverTimestamp(),
  });
  return {...p,email:request.auth.token.email||saved.email||null,photoURL:request.auth.token.picture||saved.photoURL||null};
 });
});
