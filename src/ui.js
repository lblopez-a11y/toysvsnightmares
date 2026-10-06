import {MODES,SECTORS} from '../functions/shared/catalog.js';
const $ = selector => document.querySelector(selector);

/** Única capa que toca el DOM; el motor publica datos, no elementos HTML. */
export class UI {
  constructor() {
    this.minimap = $('#minimap').getContext('2d');this.crosshair=$('#crosshair').getContext('2d');
    this.abort = new AbortController(); this.toastTimer = null;
  }
  on(id, callback) { $(id).addEventListener('click', callback, { signal: this.abort.signal }); }
  state(state) {
    document.body.dataset.state = state;
    $('#loading').hidden = state !== 'loading';
    $('#login-screen').hidden = state !== 'login';$('#lock-screen').hidden=state!=='ready';
    $('#menu-screen').hidden = state !== 'menu';
    $('#hud').hidden = !['playing','paused','dead'].includes(state);
    $('#pause-screen').hidden = state !== 'paused';
    $('#death-screen').hidden = state !== 'dead';
    $('#error-screen').hidden = state !== 'error';
    $('#result-screen').hidden = state !== 'result';
    $('#actor-labels').hidden = state !== 'playing';
    $('#topbar').hidden = $('#footer').hidden = !['menu','login'].includes(state);
    if($('#lobby-nav'))$('#lobby-nav').hidden=state!=='menu';
    if($('.wallet'))$('.wallet').hidden=state!=='menu';
    if($('#upgrade-shop'))$('#upgrade-shop').hidden=true;
    const focus = { login: '#guest-login', menu: '#play', ready:'#enter-game', paused: '#resume', dead: '#respawn', result:'#result-menu', error: '#retry' }[state];
    if (focus) $(focus).focus({ preventScroll: true });
  }
  profile(profile, guest) {
    $('#profile-name').textContent = guest ? 'INVITADO' : profile.displayName;
    $('#level').textContent = `NIVEL ${profile.level}`;
    $('#xp').textContent = `${profile.experience} XP`;
    $('#sign-out').hidden = false;
    $('#sign-out').textContent = guest ? 'Volver' : 'Salir';
  }
  toast(message) {
    $('#toast').textContent = message; $('#toast').hidden = false;
    clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 5000);
  }
  error(error) { $('#error-message').textContent = error.message || String(error); }
  busy(busy) { $('#google-login').disabled = $('#guest-login').disabled = busy; }
  authHint(message) { $('#auth-hint').textContent = message; }
  health(health, shield,max=125) {
    const h = Math.max(0, Math.min(max, health)), s = Math.max(0,shield);
    $('#health-number').textContent = Math.ceil(h); $('#shield-number').textContent = `${Math.ceil(s)} ESCUDO`;
    $('#health-fill').style.width = `${h/max*100}%`; $('#shield-fill').style.width = `${Math.min(100,s/150*100)}%`;
    $('.health').setAttribute('aria-valuemax',max);$('.shield').setAttribute('aria-valuemax',150);$('#health-max').textContent=`/ ${max}`;
    $('.health').setAttribute('aria-valuenow', h); $('.shield').setAttribute('aria-valuenow', s);
  }
  // Indicadores actualizados desde la simulación; ninguna regla vive en el DOM.
  recoil(amount,aim=0) { const c=this.crosshair,gap=8-5*aim+Math.max(0,amount)*12,length=7-2*aim;c.clearRect(0,0,96,96);c.save();c.translate(48,48);c.strokeStyle=aim>.5?'#b7fff2':'#fffbdc';c.lineWidth=2-aim;c.shadowColor='#10232e';c.shadowBlur=3;for(let i=0;i<4;i++){c.beginPath();c.moveTo(gap,0);c.lineTo(gap+length,0);c.stroke();c.rotate(Math.PI/2);}c.fillStyle='#fff';c.fillRect(-1,-1,2,2);c.restore(); }
  cooldown(key, remaining, duration) {
    const ready = duration > 0 ? 1 - Math.min(1, Math.max(0, remaining / duration)) : 1;
    $(`#ability-${key}`).style.setProperty('--ready', `${ready * 100}%`);
  }
  death(killer, score) { $('#killer-name').textContent = killer; $('#death-score').textContent = score; }
  battle(battle) {
    const m=battle.match;
    const player=battle.player,spec=player.spec;
    $('#mission-title').textContent=MODES[m.mode].name;
    let value,max,label;
    if(m.mode==='horde'){$('#wave-number').textContent=`OLEADA ${Math.max(1,m.wave)} / 10`;$('#enemy-number').textContent=m.phase==='intermission'?`Preparación: ${Math.ceil(Math.max(0,m.timer))} s`:`${m.remaining} pesadillas · Defiende el cofre`;value=m.baseHealth;max=1000;label='COFRE';}
    else if(m.mode==='conquest'){$('#wave-number').textContent=`SECTOR ${Math.min(3,m.sector+1)} / 3 · ${SECTORS[Math.min(2,m.sector)].name}`;$('#enemy-number').textContent=`${Math.floor(Math.ceil(m.timer)/60)}:${String(Math.ceil(m.timer)%60).padStart(2,'0')} · ${m.contested?'ZONA DISPUTADA':player.team==='toys'?'Defiende el círculo':'Captura el círculo'}`;value=m.capture;max=100;label='CAPTURA';}
    else{$('#wave-number').textContent=`${m.size} vs ${m.size} · PRIMERO A 35`;$('#enemy-number').textContent=`Juguetes ${m.points.toys} · Pesadillas ${m.points.nightmares}`;value=m.points[player.team];max=35;label='CONFIRMADAS';}
    $('#base-label').textContent=label;$('#base-number').textContent=`${Math.ceil(value)} / ${max}`;$('#base-fill').style.width=`${value/max*100}%`;$('#base-meter').setAttribute('aria-valuemax',max);$('#base-meter').setAttribute('aria-valuenow',value);$('#base-meter').setAttribute('aria-label',label);
    $('#score-number').textContent=`${battle.result.kills} BAJAS · ${battle.result.objectives} OBJETIVOS`;
    $('#hud-character').textContent=spec.name.toUpperCase();$('#hud-weapon').textContent=spec.weapon.name.toUpperCase();$('#ammo-number').textContent=spec.weapon.magazine?player.ammo:'∞';$('#ammo-max').textContent=spec.weapon.magazine?`/ ${spec.weapon.magazine}`:'';
    $('#ammo-state').textContent=player.reload>0?`RECARGANDO ${player.reload.toFixed(1)} s`:spec.weapon.type==='charge'?`MANTÉN Y SUELTA · CARGA ${Math.round(battle.charge/1.5*100)}%`:'CLIC / F · DISPARAR';
    spec.abilities.forEach((a,i)=>{const key=['q','e','c'][i];$(`#ability-name-${key}`).textContent=a.name;$(`#ability-${key} span`).textContent=a.passive?'P':key.toUpperCase();$(`#ability-${key}`).title=a.description;});
    $('#combat-status').textContent=player.status.cloak?'MALLA DE OSCURIDAD · NO PUEDES ATACAR':player.status.stun?'ATURDIDO':player.status.sleep?'DORMIDO':player.status.root?'MOVILIDAD BLOQUEADA':player.status.spawn?'PROTECCIÓN DE REAPARICIÓN':player.status.flight?'VUELO · ESPACIO SUBIR / CTRL BAJAR':player.sinceDamage>=5&&player.health<player.maxHealth?'REGENERANDO · +10 HP/s':'';
    $('#upgrade-shop').hidden=!(m.mode==='horde'&&m.phase==='intermission'&&m.wave>0&&battle.engine.state.value==='playing');$('#upgrade-points').textContent=`${m.wavePoints} puntos · ${Math.ceil(Math.max(0,m.timer))} s`;
  }
  banner(title,subtitle){
    $('#wave-banner strong').textContent=title;$('#wave-banner span').textContent=subtitle;
    $('#wave-banner').classList.remove('show');void $('#wave-banner').offsetWidth;$('#wave-banner').classList.add('show');
  }
  kill(name,count){$('#kill-feed').textContent=`+100 · ${name} eliminado · ${count} bajas`;$('#kill-feed').classList.remove('show');void $('#kill-feed').offsetWidth;$('#kill-feed').classList.add('show');}
  hurt(){$('#damage-vignette').classList.remove('flash');void $('#damage-vignette').offsetWidth;$('#damage-vignette').classList.add('flash');}
  result(won,match){$('#result-title').textContent=won?'¡Victoria!':'Esta noche no fue nuestra.';$('#result-message').textContent=`${MODES[match.mode].name} · Ganan ${match.winner==='toys'?'los Juguetes':'las Pesadillas'}.`;$('#result-score').textContent=match.mode==='horde'?`Oleada ${match.wave} / 10`:match.mode==='confirmed'?`Juguetes ${match.points.toys} · Pesadillas ${match.points.nightmares}`:`Sectores capturados: ${match.sector} / 3`;}
  drawMinimap(player, yaw, obstacles,battle) {
    const ctx = this.minimap, scale = 1.3;
    ctx.clearRect(0, 0, 240, 240); ctx.save();
    ctx.beginPath(); ctx.arc(120, 120, 116, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#163640'; ctx.fillRect(0, 0, 240, 240);
    ctx.strokeStyle = '#aacbbe18'; ctx.lineWidth = 1;
    for (let i = -120; i <= 120; i += 10) {
      const x = 120 + (i - player.x) * scale, y = 120 + (i - player.z) * scale;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 240); ctx.moveTo(0, y); ctx.lineTo(240, y); ctx.stroke();
    }
    ctx.fillStyle = '#779c91';
    for (const o of obstacles) ctx.fillRect(120 + (o.x - o.w / 2 - player.x) * scale, 120 + (o.z - o.d / 2 - player.z) * scale, o.w * scale, o.d * scale);
    ctx.fillStyle = '#edb78e'; ctx.beginPath(); ctx.arc(120 - player.x * scale, 120 - player.z * scale, 5, 0, Math.PI * 2); ctx.fill();
    if(battle){
      ctx.strokeStyle='#f4d890';ctx.beginPath();ctx.arc(120+(battle.objective.x-player.x)*scale,120+(battle.objective.z-player.z)*scale,9,0,Math.PI*2);ctx.stroke();
      for(const drop of battle.drops.active){ctx.fillStyle=drop.team==='toys'?'#fbd776':'#ad7ee9';ctx.fillRect(118+(drop.position.x-player.x)*scale,118+(drop.position.z-player.z)*scale,4,4);}
      for(const actor of [...battle.enemies.active,...battle.allies])if(actor.active){
        ctx.fillStyle=actor.team==='toys'?'#9dffba':'#ff7eac';ctx.beginPath();ctx.arc(120+(actor.position.x-player.x)*scale,120+(actor.position.z-player.z)*scale,3.5,0,Math.PI*2);ctx.fill();
      }
    }
    ctx.translate(120, 120); ctx.rotate(-yaw);
    ctx.fillStyle = '#d3f494'; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(7, 8); ctx.lineTo(0, 5); ctx.lineTo(-7, 8); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  dispose() { this.abort.abort(); clearTimeout(this.toastTimer); }
}
