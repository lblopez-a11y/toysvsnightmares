const $=id=>document.getElementById(id);

export class SocialSystem {
 constructor(account){
  this.account=account;this.user=null;this.revision=0;this.unsubscribers=[];this.abort=new AbortController();
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
  this.disconnect();this.user=user;const revision=++this.revision;
  if(!user){
   this.myPlayerId.textContent=guest?'INVITADO':'INICIA SESIÓN';this.sendBtn.disabled=true;
   this.setStatus(guest?'Inicia sesión para usar las solicitudes de amistad.':'');
   this.renderList(this.requestsList,[],'No tienes solicitudes pendientes.');this.requestsCount.textContent='0';
   this.renderList(this.friendsList,[],'Aún no has agregado amigos.');this.friendsCount.textContent='0';return;
  }
  this.myPlayerId.textContent=profile?.tag||'CARGANDO...';this.sendBtn.disabled=!this.searchInput.value.trim();
  this.setStatus('');
  if(profile?.tag)this.myPlayerId.textContent=profile.tag;
  else void this.loadTag(revision);
  this.unsubscribers.push(this.account.watchPlayerCollection(user.uid,'friendRequests',items=>this.renderRequests(items),error=>this.setStatus(error.message||'No se pudieron cargar las solicitudes.')));
  this.unsubscribers.push(this.account.watchPlayerCollection(user.uid,'friends',items=>this.renderFriends(items),error=>this.setStatus(error.message||'No se pudo cargar la lista de amigos.')));
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
  this.friendsCount.textContent=String(items.length);
  if(!items.length){this.renderList(this.friendsList,[],'Aún no has agregado amigos.');return;}
  const rows=items.map(item=>{
   const row=document.createElement('div');row.className='friend-item';
   const info=document.createElement('div');info.className='friend-info';
    const dot=document.createElement('span');dot.className='status-dot-mini offline';
   const details=document.createElement('div'),name=document.createElement('div'),status=document.createElement('div');
   name.className='friend-name';name.textContent=item.friendTag||item.friendName||item.id;
    status.className='friend-level';status.textContent=`Nivel ${item.friendLevel||1}`;
   details.append(name,status);info.append(dot,details);row.append(info);return row;
  });
  this.friendsList.replaceChildren(...rows);
 }

 renderList(container,items,message){
  if(!container)return;
  if(items.length){container.replaceChildren(...items);return;}
  const empty=document.createElement('p');empty.className='empty-msg';empty.textContent=message;container.replaceChildren(empty);
 }

 setStatus(message){if(this.statusMsg)this.statusMsg.textContent=message;}
 disconnect(){for(const unsubscribe of this.unsubscribers)unsubscribe?.();this.unsubscribers=[];}
 dispose(){this.disconnect();this.abort.abort();this.user=null;}
}

export function initSocialSystem(account){return new SocialSystem(account);}