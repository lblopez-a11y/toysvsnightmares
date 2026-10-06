import * as THREE from 'three';
import {createStudioEnvironment} from './lighting.js';
import {ROSTER,CHARACTERS,MODES} from '../functions/shared/catalog.js';
import {createRosterModel} from './characters.js';
import {initSocialSystem} from './social.js';

const $=id=>document.getElementById(id);
export class Lobby {
 constructor(engine){this.engine=engine;this.store=engine.progress;this.mode='conquest';this.size=6;this.panel='home';this.preview='captain';this.models=new Map();this.buildScene();this.buildUI();this.refresh();}
 buildScene(){
  this.scene=new THREE.Scene();this.scene.environment=this.engine.environment.texture;this.scene.environmentIntensity=.6;this.scene.background=new THREE.Color('#102c36');this.scene.fog=new THREE.Fog('#102c36',15,40);
  this.camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.1,50);this.camera.position.set(6,3.8,9);this.camera.lookAt(0,1.3,0);
  this.scene.add(new THREE.HemisphereLight('#d7ece0','#18323c',1.35));
  const spot=new THREE.SpotLight('#fff4cb',65,30,.5,.65,1);spot.position.set(0,9,3);spot.target.position.set(0,1,0);this.scene.add(spot,spot.target);this.spot=spot;
  const rim=new THREE.DirectionalLight('#b096e5',2);rim.position.set(-5,3,-3);this.scene.add(rim);
  spot.castShadow=true;spot.shadow.mapSize.set(1024,1024);
  this.stage=new THREE.Group();this.scene.add(this.stage);
  const base=new THREE.Mesh(new THREE.CylinderGeometry(2.3,2.5,.3,64),new THREE.MeshStandardMaterial({color:'#36545a',metalness:.3,roughness:.5}));base.receiveShadow=true;base.position.y=-.15;this.stage.add(base);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(2.32,.04,8,64),new THREE.MeshStandardMaterial({roughness:.45,metalness:.08,color:'#d5f69a',emissive:'#b8ef76',emissiveIntensity:2}));ring.rotation.x=Math.PI/2;ring.position.y=.04;this.stage.add(ring);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:'#193740'}));floor.receiveShadow=true;floor.rotation.x=-Math.PI/2;floor.position.y=-.32;this.scene.add(floor);
  for(const c of ROSTER){const model=createRosterModel(this.engine.world,c.id);model.visible=false;this.stage.add(model);this.models.set(c.id,model);}
 }
 buildUI(){
  document.querySelector('.build-label').outerHTML='<nav id="lobby-nav" aria-label="Menú principal"><button data-panel="home">INICIO</button><button data-panel="characters">PERSONAJES</button><button data-panel="modes">MODOS</button><button id="lobby-settings">AJUSTES</button><button class="nav-link" data-panel="social">SOCIAL</button></nav><div class="wallet"><span title="Monedas de Juguete">◈ <b id="coin-balance">0</b></span><span title="Esencias de Pesadilla">✧ <b id="essence-balance">0</b></span><span id="level">NIVEL 1</span></div>';
  $('menu-screen').innerHTML=`<div id="lobby-home"><div class="lobby-intro"><p class="eyebrow">LA GUARDIA NOCTURNA</p><h2>Tu imaginación.<br>Tu escuadrón.</h2><p>Elige un bando.<br>Haz que esta noche sea tuya.</p><button id="open-roster" class="button secondary">Cambiar personaje <span>↗</span></button></div><div class="hero-name"><span id="hero-faction" class="eyebrow"></span><h3 id="hero-name"></h3><p id="hero-role"></p></div><div class="squad"><span class="eyebrow">TU ESCUADRÓN</span><div>${[1,2,3].map(i=>`<button class="invite" aria-label="Invitar amigo ${i}"><b>+</b><span>INVITAR AMIGO</span><small>PRÓXIMAMENTE</small></button>`).join('')}</div></div><div class="play-card"><span class="eyebrow">MODO SELECCIONADO</span><h3 id="selected-mode"></h3><p id="selected-mode-info"></p><p id="selected-mode-help"></p><button id="change-mode" class="text-button">CAMBIAR MODO ↗</button><button id="play" class="button primary">¡JUGAR! <span>→</span></button><small>Partida local · Los demás puestos los cubren bots</small></div></div>
  <div id="characters-panel" hidden><button class="back-link panel-back" data-back-home>← Volver</button><div class="roster-heading"><p class="eyebrow">ELIGE A TU PROTAGONISTA</p><h2>Personajes <span>12</span></h2><div class="faction-tabs"><button data-filter="all">TODOS</button><button data-filter="toys">JUGUETES</button><button data-filter="nightmares">PESADILLAS</button></div></div><div id="character-grid"></div><aside id="character-detail"></aside></div>
  <div id="modes-panel" hidden><button class="back-link" data-back-home>← Volver al Menú</button><p class="eyebrow">ENCUENTRA TU BATALLA</p><h2>Tres formas de hacer historia.</h2><div class="mode-grid">${Object.entries(MODES).map(([id,m],i)=>`<button class="mode-card" data-mode="${id}"><span class="mode-number">0${i+1}</span><div class="mode-art ${id}">${['◎','ϟ','▣'][i]}</div><h3>${m.name}</h3><strong>${m.subtitle}</strong><p>${m.description}</p><span class="mode-select">SELECCIONAR →</span></button>`).join('')}</div><div id="team-options"></div></div>
  <div id="social-panel" hidden class="social-panel-shell">
    <div class="social-header">
      <h2>SOCIAL <span>✦</span></h2>
      <div class="my-id-card">
        <small>TU ID DE JUGADOR</small>
        <strong id="my-player-id">CARGANDO#0000</strong>
        <button id="copy-id-btn" class="text-button">Copiar 📋</button>
      </div>
    </div>
    <div class="social-grid">
      <div class="social-card">
        <h3>AÑADIR AMIGO</h3>
        <p>Ingresa el ID único de tu amigo para enviarle una solicitud.</p>
        <div class="search-box">
          <input type="text" id="friend-search-input" placeholder="Ej: GUARDIA#8492" autocomplete="off" />
          <button id="send-request-btn" class="button primary">Añadir <span>+</span></button>
        </div>
        <small id="search-status-msg" class="status-msg"></small>
      </div>
      <div class="social-card">
        <h3>SOLICITUDES <span id="requests-count" class="badge">0</span></h3>
        <div id="requests-list" class="social-list">
          <p class="empty-msg">No tienes solicitudes pendientes.</p>
        </div>
      </div>
      <div class="social-card friends-wide">
        <h3>MIS AMIGOS (<span id="friends-count">0</span>)</h3>
        <div id="friends-list" class="social-list">
          <p class="empty-msg">Aún no has agregado amigos.</p>
        </div>
      </div>
    </div>
  </div>
  <div class="save-info"><span id="save-status">Guardado local</span><span id="xp">0 / 1000 XP</span></div>`;
  const modal=document.createElement('section');modal.id='invite-modal';modal.className='modal-screen';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','Invitar amigo');modal.hidden=true;modal.innerHTML='<div class="panel"><p class="eyebrow">TU PRÓXIMO ESCUADRÓN</p><h2>Invitar amigo</h2><p>Próximamente en la versión Multijugador LAN/Online.</p><p>Por ahora puedes jugar ambos bandos con compañeros y rivales controlados por IA.</p><button id="close-invite" class="button primary">Entendido</button></div>';document.body.append(modal);
  document.querySelectorAll('[data-panel]').forEach(button=>button.onclick=()=>this.show(button.dataset.panel));
  document.querySelectorAll('[data-back-home]').forEach(b=>b.onclick=()=>this.show('home'));
  $('open-roster').onclick=()=>this.show('characters');$('change-mode').onclick=()=>this.show('modes');
  document.querySelectorAll('.invite').forEach(button=>button.onclick=()=>{modal.hidden=false;$('close-invite').focus();});$('close-invite').onclick=()=>{modal.hidden=true;};
  document.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>{this.mode=button.dataset.mode;this.size=MODES[this.mode].teamSize;this.refresh();this.renderSizes();this.engine.ui.toast(`${MODES[this.mode].name} seleccionado`);});
  document.querySelectorAll('[data-filter]').forEach(button=>button.onclick=()=>this.renderRoster(button.dataset.filter));
  this.renderRoster();this.show('home');this.social=initSocialSystem(this.engine.account);
 }
 renderRoster(filter='all'){
  this.filter=filter;document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter===filter));const grid=$('character-grid');grid.replaceChildren();
  for(const c of ROSTER){if(filter!=='all'&&c.team!==filter)continue;const unlocked=this.store.profile.unlockedCharacters.includes(c.id);const card=document.createElement('article');card.className=`character-card ${unlocked?'':'locked'} ${c.team}`;card.dataset.character=c.id;
   const preview=document.createElement('button');preview.className='card-preview';preview.setAttribute('aria-label',`Ver ${c.name}`);preview.innerHTML=`<img alt="${c.name}" src="${this.portraits?.get(c.id)||''}"><span class="card-team">${c.team==='toys'?'JUGUETE':'PESADILLA'}</span>${unlocked?'':'<span class="lock-badge">▣</span>'}<strong>${c.name}</strong><small>${c.role}</small>`;preview.onclick=()=>this.selectPreview(c.id);
   const requirement=document.createElement('span');requirement.className='requirement';requirement.textContent=unlocked?'DESBLOQUEADO':this.requirement(c);
   const action=document.createElement('button');action.className='card-action';action.textContent=unlocked?(this.store.profile.selectedCharacter===c.id?'EQUIPADO':'EQUIPAR'):'DESBLOQUEAR';action.onclick=()=>this.action(c.id);
   card.append(preview,requirement,action);grid.append(card);
  }
 }
 requirement(c){const u=c.unlock;if(u.type==='level')return `Nivel ${u.level} · Actual ${this.store.profile.level}`;if(u.type==='currency')return `${u.cost.toLocaleString('es')} ${u.currency==='coins'?'Monedas':'Esencias'}`;if(u.type==='wins')return `Gana ${u.wins} partidas · ${this.store.profile.stats.wins[u.team]}/${u.wins}`;return 'Gratis';}
 async action(id){const c=CHARACTERS[id];try{if(this.store.profile.unlockedCharacters.includes(id)){await this.store.select(id);this.selectPreview(id);this.engine.ui.toast(`${c.name} equipado`);}else{await this.store.buy(id);this.engine.ui.toast(`${c.name} desbloqueado`);}this.refresh();}catch(error){this.engine.ui.toast(error.message);this.selectPreview(id);}}
 selectPreview(id){this.preview=id;for(const [key,model] of this.models)model.visible=key===id;this.renderDetail();}
 renderDetail(){const c=CHARACTERS[this.preview];$('character-detail').innerHTML=`<span class="eyebrow">${c.team==='toys'?'LOS JUGUETES':'LAS PESADILLAS'}</span><h3>${c.name}</h3><p>${c.role}</p><label>VIDA <b>${c.hp} HP</b></label><meter min="0" max="250" value="${c.hp}"></meter><label>VELOCIDAD <b>${c.speed.toFixed(2)}×</b></label><meter min="0" max="1.3" value="${c.speed}"></meter><p class="detail-size">${c.height} m · Hitbox ${c.hitbox.toLowerCase()}</p><h4>${c.weapon.name}</h4><p>${c.weapon.damage}${c.weapon.maxDamage?`–${c.weapon.maxDamage}`:''} de daño${c.weapon.heal?` / cura ${c.weapon.heal}`:''} · ${{hitscan:'Dardo instantáneo',projectile:'Proyectil',charge:'Disparo cargado',beam:'Rayo',cone:'Área frontal'}[c.weapon.type]}</p>${c.abilities.map((a,i)=>`<div class="ability-detail"><b>${a.passive?'PASIVA':['Q','E','C'][i]} · ${a.name}</b><p>${a.description}</p></div>`).join('')}<small>${this.requirement(c)}</small>`;}
 renderSizes(){const options=this.mode==='confirmed'?[4,6]:this.mode==='horde'?[1,2,3,4]:[6];$('team-options').replaceChildren();for(const n of options){const b=document.createElement('button');b.textContent=this.mode==='horde'?`${n} ${n===1?'juguete':'juguetes'}`:`${n} contra ${n}`;b.className=n===this.size?'active':'';b.onclick=()=>{this.size=n;this.renderSizes();this.refresh();};$('team-options').append(b);}}
 show(panel){this.panel=panel;document.querySelectorAll('[data-panel]').forEach(b=>b.classList.toggle('active',b.dataset.panel===panel));$('lobby-home').hidden=panel!=='home';$('characters-panel').hidden=panel!=='characters';$('modes-panel').hidden=panel!=='modes';const socialPanel=$('social-panel');if(socialPanel){socialPanel.hidden=panel!=='social';}document.body.dataset.lobby=panel;if(panel==='home')this.selectPreview(this.store.profile.selectedCharacter);if(panel==='modes')this.renderSizes();}
 refresh(){const p=this.store.profile,c=CHARACTERS[p.selectedCharacter];document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===this.mode));$('coin-balance').textContent=p.coins.toLocaleString('es');$('essence-balance').textContent=p.essence.toLocaleString('es');$('level').textContent=`LVL ${p.level}`;$('xp').textContent=`${p.experience%1000} / 1000 XP`;$('save-status').textContent=this.store.status;$('hero-name').textContent=c.name;$('hero-role').textContent=`${c.role} · ${c.hp} HP`;$('hero-faction').textContent=c.team==='toys'?'LOS JUGUETES':'LAS PESADILLAS';$('selected-mode').textContent=MODES[this.mode].name;$('selected-mode-help').textContent=this.mode==='horde'?'Defiende el cofre. Entre oleadas compra mejoras con 1 / 2 / 3.':this.mode==='confirmed'?'Elimina y recoge el objeto enemigo. Recoge los de tu equipo para denegar.':c.team==='toys'?'Defiende el círculo hasta agotar el tiempo. Si cae, retrocede al siguiente sector.':'Permanece dentro del círculo sin defensores. Captura los 3 sectores en orden.';$('selected-mode-info').textContent=this.mode==='horde'?`${this.size} juguetes · 10 oleadas · 3 jefes`:`${this.size} vs ${this.size} · ${this.mode==='conquest'?'3 sectores':'35 confirmaciones'}`;this.renderRoster(this.filter);this.renderDetail();}
 buildPortraits(){
  // Miniaturas son renders de los mismos modelos jugables, no ilustraciones ajenas.
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setSize(200,180);renderer.setPixelRatio(1);renderer.setClearColor('#17333b',0);
  const portraitEnvironment=createStudioEnvironment(renderer);const scene=new THREE.Scene();scene.environment=portraitEnvironment.texture;scene.add(new THREE.HemisphereLight('#fff4de','#2a4454',3));const light=new THREE.DirectionalLight('#ffffff',3);light.position.set(4,5,6);scene.add(light);const camera=new THREE.PerspectiveCamera(35,200/180,.1,20);camera.position.set(2.8,2.4,4.6);camera.lookAt(0,1,0);this.portraits=new Map();
  for(const c of ROSTER){camera.position.set(c.height*1.05,c.height*.85,c.height*1.6);camera.lookAt(0,c.height*.5,0);const model=this.models.get(c.id);this.stage.remove(model);scene.add(model);model.visible=true;model.rotation.y=.2;renderer.render(scene,camera);this.portraits.set(c.id,renderer.domElement.toDataURL('image/png'));scene.remove(model);this.stage.add(model);model.visible=false;}
  portraitEnvironment.dispose();renderer.dispose();renderer.forceContextLoss();this.selectPreview(this.preview);this.renderRoster(this.filter);
 }
 update(time){this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();const c=CHARACTERS[this.preview],model=this.models.get(this.preview);this.stage.position.x=this.panel==='characters'?1.6:0;const rig=model.userData.rig;model.rotation.y=.3+Math.sin(time*.28)*.22;rig.body.position.y=Math.sin(time*1.8)*.045;if(rig.aura){rig.aura.visible=rig.special;rig.aura.rotation.y=time*.4;rig.aura.scale.setScalar(1+Math.sin(time*2)*.05);}rig.arms.forEach((arm,i)=>arm.rotation.x=-.3+Math.sin(time*1.5+i)*.09);model.scale.setScalar(c.height/2.6*1.55);}
 dispose(){this.social?.dispose();this.scene.traverse(n=>{if(n.isMesh&&!this.modelsHas(n)){n.geometry?.dispose();n.material?.dispose();}});}
 modelsHas(node){for(let p=node;p;p=p.parent)if([...this.models.values()].includes(p))return true;return false;}
}
