import {ROSTER,CHARACTERS,MODES} from '../functions/shared/catalog.js';
export class Deployment {
 constructor(engine){
  this.engine=engine;this.dialog=document.createElement('dialog');this.dialog.className='deployment-dialog';this.dialog.setAttribute('aria-labelledby','deployment-title');
  this.dialog.innerHTML='<button class="back-link" id="cancel-deployment">← Volver al Menú Principal</button><p class="eyebrow" id="deployment-mode"></p><h2 id="deployment-title">Elige tu bando</h2><p class="deployment-intro">1. Elige facción · 2. Selecciona héroe · 3. Entra a tu base</p><div class="faction-choice"><button data-faction="toys"><span>01 / DEFENSORES</span><strong>Los Juguetes</strong><small>Coraje de plástico. Imaginación sin límites.</small></button><button data-faction="nightmares"><span>02 / ATACANTES</span><strong>Las Pesadillas</strong><small>Desde las sombras, el cuarto será nuestro.</small></button></div><p id="faction-hint"></p><div id="deployment-heroes"></div><div class="deployment-footer"><p id="deployment-summary">Selecciona una facción para ver sus héroes.</p><button id="confirm-deployment" class="button primary" disabled>Preparar despliegue →</button></div>';
  document.body.append(this.dialog);this.dialog.addEventListener('close',()=>engine.lobby.selectPreview(engine.progress.profile.selectedCharacter));this.dialog.querySelector('#cancel-deployment').onclick=()=>this.dialog.close();
  this.dialog.querySelectorAll('[data-faction]').forEach(b=>b.onclick=()=>this.chooseFaction(b.dataset.faction));
  this.dialog.querySelector('#confirm-deployment').onclick=async()=>{
   const b=this.dialog.querySelector('#confirm-deployment');if(!this.hero)return;b.disabled=true;
   try{await engine.progress.select(this.hero);engine.lobby.refresh();this.dialog.close();engine.prepareMatch();}catch(error){engine.ui.toast(error.message);}finally{b.disabled=!this.hero;}
  };
 }
 open(){this.hero=null;this.team=null;this.dialog.querySelector('#deployment-mode').textContent=MODES[this.engine.lobby.mode].name;this.dialog.querySelector('[data-faction="nightmares"]').disabled=this.engine.lobby.mode==='horde';this.dialog.querySelector('#faction-hint').textContent=this.engine.lobby.mode==='horde'?'Cofre Central: elige un Juguete. Las Pesadillas forman las oleadas enemigas.':'Ambos equipos aparecen en bases opuestas y avanzan por tres rutas.';this.render();this.dialog.showModal();}
 chooseFaction(team){this.team=team;const selected=this.engine.progress.profile.selectedCharacter;this.hero=CHARACTERS[selected].team===team?selected:ROSTER.find(c=>c.team===team&&this.engine.progress.profile.unlockedCharacters.includes(c.id)).id;this.engine.lobby.selectPreview(this.hero);this.render();}
 render(){
  this.dialog.querySelectorAll('[data-faction]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.faction===this.team));
  const grid=this.dialog.querySelector('#deployment-heroes');grid.replaceChildren();
  for(const c of ROSTER.filter(c=>c.team===this.team)){const button=document.createElement('button'),unlocked=this.engine.progress.profile.unlockedCharacters.includes(c.id);button.disabled=!unlocked;button.dataset.hero=c.id;button.setAttribute('aria-pressed',c.id===this.hero);button.innerHTML=`<img src="${this.engine.lobby.portraits?.get(c.id)||''}" alt=""><strong>${c.name}</strong><small>${unlocked?`${c.hp} HP · ${c.role}`:this.engine.lobby.requirement(c)}</small>`;button.onclick=()=>{this.hero=c.id;this.engine.lobby.selectPreview(c.id);this.render();};grid.append(button);}
  this.dialog.querySelector('#confirm-deployment').disabled=!this.hero;
  this.dialog.querySelector('#deployment-summary').textContent=this.hero?`${CHARACTERS[this.hero].name} · ${CHARACTERS[this.hero].weapon.name}`:'Selecciona una facción para ver sus héroes.';
 }
}
