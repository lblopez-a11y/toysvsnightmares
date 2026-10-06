import {renderPlayerTag} from './player-tag.js';

const $=id=>document.getElementById(id);

export class SocialSystem {
 constructor(account,notify=()=>{}){
  this.account=account;this.notify=notify;this.user=null;this.revision=0;this.unsubscribers=[];this.presenceUnsubs=new Map();this.presence=new Map();this.friends=[];this.sentInvites=new Set();this.inviteModal=null;this.abort=new AbortController();
  this.myPlayerId=$('my-player-id');this.copyBtn=$('copy-id-btn');this.searchInput=$('friend-search-input');this.sendBtn=$('send-request-btn');this.statusMsg=$('search-status-msg');
  this.requestsList=$('requests-list');this.requestsCount=$('requests-count');this.friendsList=$('friends-list');this.friendsCount=$('friends-count');
  if(!this.myPlayerId||!this.searchInput||!this.sendBtn)return;
  const options={signal:this.abort.signal};
  this.copyBtn?.addEventListener('click',()=>void this.copyTag(),options);
  this.sendBtn.addEventListener('click',()=>void this.sendRequest(),options);
  this.searchInput.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();void this.sendRequest();}},options);
  this.searchInput.addEventListener('input',()=>{this.sendBtn.disabled=!this.user||!this.searchInput.value.trim();},options);
  this.sendBtn.disabled=true;
 }

 setSession(user,guest=false,profile=null){
  this.disconnect();this.account.stopPresence?.();this.user=user;this.friends=[];this.sentInvites.clear();this.presence.clear();const revision=++this.revision;
  if(!user){
   this.myPlayerId.textContent=guest?'INVITADO':'INICIA SESIÓN';this.sendBtn.disabled=true;
   this.setStatus(guest?'Inicia sesión para usar las solicitudes de amistad.':'');
   this.renderList(this.requestsList,[],'No tienes solicitudes pendientes.');this.requestsCount.textContent='0';
   this.renderList(this.friendsList,[],'Aún no has agregado amigos.');this.friendsCount.textContent='0';return;
  }
  this.account.startPresence?.(user,error=>this.notify(error.message||'No se pudo actualizar tu presencia.'));
  this.myPlayerId.textContent=profile?.tag||'CARGANDO...';this.sendBtn.disabled=!this.searchInput.value.trim();
  this.setStatus('');
  if(profile?.tag)this.myPlayerId.textContent=profile.tag;
  else void this.loadTag(revision);
  this.unsubscribers.push(this.account.watchPlayerCollection(user.uid,'friendRequests',items=>this.renderRequests(items),error=>this.setStatus(error.message||'No se pudieron cargar las solicitudes.')));
  this.unsubscribers.push(this.account.watchPlayerCollection(user.uid,'friends',items=>this.renderFriends(items),error=>this.setStatus(error.message||'No se pudo cargar la lista de amigos.')));
  if(this.account.watchIncomingSquadInvites)this.unsubscribers.push(this.account.watchIncomingSquadInvites(user.uid,items=>this.renderIncomingInvites(items),error=>this.notify(error.message||'No se pudieron cargar las invitaciones.')));
 }

 async loadTag(revision){
    try{const profile=await this.account.loadProfile(this.user);if(revision===this.revision&&this.user)this.myPlayerId.textContent=profile.tag||'ID no disponible';}
  catch(error){if(revision===this.revision)this.setStatus(error.message||'No se pudo cargar tu ID.');}
 }

 async copyTag(){
  const tag=this.myPlayerId.textContent;
  if(!tag||tag==='CARGANDO...'||tag==='INVITADO'||tag==='INICIA SESIÓN')return;
  try{await navigator.clipboard.writeText(tag);this.copyBtn.textContent='Copiado';setTimeout(()=>{if(!this.abort.signal.aborted)this.copyBtn.textContent='Copiar 📋';},1600);}
  catch{this.setStatus('No se pudo copiar el ID.');}
 }

 async sendRequest(){
  const targetTag=this.searchInput.value.trim();
  if(!this.user||!targetTag)return;
  this.sendBtn.disabled=true;this.setStatus('Buscando jugador...');
  try{
   const result=await this.account.socialAction('searchPlayers',{targetTag});
   if(!result.players?.length){this.setStatus('Jugador no encontrado.');return;}
   this.setStatus('Enviando solicitud...');
   const response=await this.account.socialAction('sendFriendRequest',{targetTag});
   this.setStatus(response.message||'Solicitud enviada correctamente.');this.searchInput.value='';
  }catch(error){this.setStatus(error.message||'Error al enviar la solicitud.');}
  finally{this.sendBtn.disabled=!this.user||!this.searchInput.value.trim();}
 }

 renderRequests(items){
  this.requestsCount.textContent=String(items.length);
  if(!items.length){this.renderList(this.requestsList,[],'No tienes solicitudes pendientes.');return;}
  const rows=items.map(item=>{
   const row=document.createElement('div');row.className='request-item';
   const identity=document.createElement('strong');identity.textContent=item.fromTag||item.fromName||item.id;
   const actions=document.createElement('div');actions.className='request-actions';
   const accept=document.createElement('button');accept.className='btn-accept';accept.type='button';accept.textContent='Aceptar';accept.setAttribute('aria-label',`Aceptar solicitud de ${identity.textContent}`);
   accept.addEventListener('click',async()=>{
    accept.disabled=true;
    try{await this.account.socialAction('acceptFriendRequest',{friendUid:item.id});this.setStatus('Solicitud aceptada.');}
    catch(error){accept.disabled=false;this.setStatus(error.message||'No se pudo aceptar la solicitud.');}
   },{signal:this.abort.signal});
   actions.append(accept);row.append(identity,actions);return row;
  });
  this.requestsList.replaceChildren(...rows);
 }

 renderFriends(items){
  this.friends=items;
  const currentIds=new Set(items.map(item=>item.id));
  for(const [uid,unsubscribe] of this.presenceUnsubs)if(!currentIds.has(uid)){unsubscribe?.();this.presenceUnsubs.delete(uid);this.presence.delete(uid);}
  for(const item of items)if(!this.presenceUnsubs.has(item.id)){
   const revision=this.revision;
   try{
    const unsubscribe=this.account.watchPresence(item.id,value=>{
     if(revision!==this.revision)return;
     this.presence.set(item.id,value);this.renderFriends(this.friends);this.renderInviteFriends();
    },error=>{if(revision===this.revision)this.notify(error.message||'No se pudo consultar el estado de un amigo.');});
    this.presenceUnsubs.set(item.id,unsubscribe);
   }catch(error){this.notify(error.message||'No se pudo consultar el estado de un amigo.');}
  }
  this.friendsCount.textContent=String(items.length);
  if(!items.length){this.renderList(this.friendsList,[],'Aún no has agregado amigos.');return;}
  const rows=items.map(item=>{
   const row=document.createElement('div');row.className='friend-item';
   const info=document.createElement('div');info.className='friend-info';
   const online=this.isOnline(this.presence.get(item.id));
   const dot=document.createElement('span');dot.className=`status-dot-mini ${online?'online':'offline'}`;
   const details=document.createElement('div'),name=document.createElement('div'),status=document.createElement('div'),identity=document.createElement('span');
   name.className='friend-name';identity.textContent=item.friendName||item.friendTag||item.id;name.append(identity);
   name.insertAdjacentHTML('beforeend',renderPlayerTag({tag:item.friendTag}));
   status.className='friend-level';status.textContent=`${online?'En línea':'Desconectado'} · Nivel ${item.friendLevel||1}`;
   details.append(name,status);info.append(dot,details);row.append(info);return row;
  });
  this.friendsList.replaceChildren(...rows);
 }

 isOnline(presence){
  const lastSeen=presence?.lastSeen?.toMillis?.()??(typeof presence?.lastSeen==='number'?presence.lastSeen:NaN);
  return presence?.online===true&&Number.isFinite(lastSeen)&&Date.now()-lastSeen<65000;
 }

 setInviteModal(modal){
  this.inviteModal=modal;
  const options={signal:this.abort.signal};
  modal.querySelector('[data-close-invite]').addEventListener('click',()=>{modal.hidden=true;},options);
  modal.addEventListener('click',event=>{
   const button=event.target.closest('[data-invite-uid]');
   if(button&&!button.disabled)void this.sendSquadInvite(button);
  },options);
  modal.addEventListener('keydown',event=>{if(event.key==='Escape')modal.hidden=true;},options);
 }

 openInviteModal(){
  if(!this.inviteModal)return;
  this.inviteModal.hidden=false;
  this.renderInviteFriends();
  this.inviteModal.querySelector('[data-close-invite]').focus();
 }

 renderInviteFriends(){
  const container=this.inviteModal?.querySelector('#invite-friends');
  if(!container)return;
  if(!this.user){this.renderList(container,[],'Inicia sesión para invitar amigos.');return;}
  if(!this.friends.length){this.renderList(container,[],'Agrega amigos desde SOCIAL para poder invitarlos.');return;}
  const rows=this.friends.map(friend=>{
   const online=this.isOnline(this.presence.get(friend.id));
   const row=document.createElement('div');row.className='invite-friend';
   const identity=document.createElement('div');identity.className='invite-friend-identity';
   const name=document.createElement('div');name.className='invite-friend-name';
   const displayName=document.createElement('span');displayName.textContent=friend.friendName||friend.friendTag||friend.id;name.append(displayName);
   name.insertAdjacentHTML('beforeend',renderPlayerTag({tag:friend.friendTag}));
   const tag=document.createElement('small');tag.className='invite-friend-tag';tag.textContent=friend.friendTag||'';
   identity.append(name,tag);
   const invited=this.sentInvites.has(friend.id);
   const button=document.createElement('button');button.type='button';button.className='button primary';button.dataset.inviteUid=friend.id;button.disabled=!online||invited;button.textContent=invited?'Enviada':online?'Invitar':'Desconectado';
   row.append(identity,button);return row;
  });
  container.replaceChildren(...rows);
 }

 async sendSquadInvite(button){
  const status=this.inviteModal.querySelector('#invite-status'),uid=button.dataset.inviteUid;
  button.disabled=true;button.textContent='Enviando...';status.textContent='';
  try{
   await this.account.sendSquadInvite(uid);
   this.sentInvites.add(uid);button.textContent='Enviada';status.textContent='Invitación enviada. Aceptarla confirma disponibilidad; las salas online aún no están implementadas.';
  }catch(error){
   button.disabled=false;button.textContent='Invitar';status.textContent=error.message||'No se pudo enviar la invitación.';
  }
 }

 renderIncomingInvites(items){
  const pending=items.find(item=>item.status==='pending');
  document.getElementById('invite-toast')?.remove();
  if(!pending)return;
  const toast=document.createElement('section');toast.id='invite-toast';toast.className='invite-toast';toast.setAttribute('role','status');toast.setAttribute('aria-label','Invitación de escuadrón');
  const message=document.createElement('p'),sender=document.createElement('strong');
  sender.textContent=pending.fromName||pending.fromTag||'Un amigo';message.append(sender,document.createTextNode(' te ha invitado a su escuadrón.'));
  const note=document.createElement('small');note.textContent='Aceptar confirma disponibilidad; todavía no hay salas multijugador.';
  const actions=document.createElement('div');actions.className='invite-toast-actions';
  const accept=document.createElement('button');accept.type='button';accept.className='btn-accept';accept.textContent='Aceptar';
  const reject=document.createElement('button');reject.type='button';reject.className='btn-reject';reject.textContent='Rechazar';
  const respond=async status=>{
   accept.disabled=reject.disabled=true;
   try{
    await this.account.respondToSquadInvite(pending.id,status);
    toast.remove();this.notify(status==='accepted'?'Invitación aceptada.':'Invitación rechazada.');
   }catch(error){accept.disabled=reject.disabled=false;this.notify(error.message||'No se pudo responder a la invitación.');}
  };
  accept.addEventListener('click',()=>void respond('accepted'),{signal:this.abort.signal});
  reject.addEventListener('click',()=>void respond('rejected'),{signal:this.abort.signal});
  actions.append(accept,reject);toast.append(message,note,actions);document.body.append(toast);
 }

 renderList(container,items,message){
  if(!container)return;
  if(items.length){container.replaceChildren(...items);return;}
  const empty=document.createElement('p');empty.className='empty-msg';empty.textContent=message;container.replaceChildren(empty);
 }

 setStatus(message){if(this.statusMsg)this.statusMsg.textContent=message;}
 disconnect(){for(const unsubscribe of this.unsubscribers)unsubscribe?.();this.unsubscribers=[];for(const unsubscribe of this.presenceUnsubs.values())unsubscribe?.();this.presenceUnsubs.clear();this.presence.clear();document.getElementById('invite-toast')?.remove();}
 dispose(){this.disconnect();this.account.stopPresence?.();this.abort.abort();this.user=null;}
}

export function initSocialSystem(account,notify){return new SocialSystem(account,notify);}