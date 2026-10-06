import {normalizeProfile,profileDefaults,applyResult,purchase} from '../functions/shared/progression.js';
/** Perfiles aislados por identidad; los saldos locales nunca se importan a Firebase. */
export class ProgressStore {
 constructor(account,notify=()=>{}){this.account=account;this.notify=notify;this.key='tvn-v3-guest';this.cloud=false;this.profile=profileDefaults();this.pending=[];this.status='Guardado local';this.chain=Promise.resolve();}
 openGuest(){this.cloud=false;this.key='tvn-v3-guest';this.restore();return this.profile;}
 openCloud(user,profile){this.cloud=true;this.key=`tvn-v3-${user.uid}`;this.restore();this.profile=normalizeProfile(profile);this.persist();void this.flush();return this.profile;}
 restore(){try{const saved=JSON.parse(localStorage.getItem(this.key)||'{}');this.profile=normalizeProfile(saved.profile);this.pending=Array.isArray(saved.pending)?saved.pending:[];}catch{this.profile=profileDefaults();this.pending=[];}this.status=this.cloud?'Firebase':'Guardado local';}
 persist(){try{localStorage.setItem(this.key,JSON.stringify({profile:this.profile,pending:this.pending}));}catch{this.status='No se pudo guardar en este navegador';}this.notify();}
 async select(id){if(!this.profile.unlockedCharacters.includes(id))throw new Error('Primero desbloquea este personaje.');if(this.cloud){const key=this.key,profile=await this.account.profileAction('equip',{id});if(key!==this.key)return;this.profile=normalizeProfile(profile);}else this.profile.selectedCharacter=id;this.persist();}
 async buy(id){if(this.cloud){const key=this.key,profile=await this.account.profileAction('purchase',{id});if(key!==this.key)return;this.profile=normalizeProfile(profile);}else this.profile=purchase(this.profile,id);this.persist();}
 record(result){if(!this.cloud){this.profile=applyResult(this.profile,result);this.persist();return Promise.resolve();}if(!this.pending.some(r=>r.id===result.id))this.pending.push(result);this.status='Guardado pendiente';this.persist();return this.flush();}
 flush(){this.chain=this.chain.then(async()=>{if(!this.cloud)return;const key=this.key;while(this.pending.length&&this.cloud&&this.key===key){try{const profile=await this.account.profileAction('result',{result:this.pending[0]});if(this.key!==key||!this.cloud)return;this.profile=normalizeProfile(profile);this.pending.shift();this.status='Firebase · sincronizado';this.persist();}catch{if(this.key!==key||!this.cloud)return;this.status='Firebase pendiente · se reintentará';this.persist();break;}}});return this.chain;}
}
