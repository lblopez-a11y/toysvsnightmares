import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {aimModifiers,smoothFov} from './aim.js';
import {createStudioEnvironment} from './lighting.js';
import { GAME } from './config.js';
import { StateMachine, movementVector } from './core.js';
import { World } from './world.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { AccountService } from './services/firebase.js';
import { Battle } from './battle.js';
import {ProgressStore} from './progress-store.js';
import {Lobby} from './lobby.js';
import {Settings} from './settings.js';
import {Deployment} from './deployment.js';
import {createRosterModel} from './characters.js';
import {audio} from './audio.js';
import {rewards} from '../functions/shared/progression.js';
import {graphicsSettings,updateFPSCounter} from './graphicsSettings.js';

/** Motor de la partida local: render, controles y composición de sistemas.
 * Battle controla las reglas, armas, actores, animación y navegación de bots.
 */
export class GameEngine {
  constructor() {
    this.THREE=THREE;
    this.ui = new UI(); this.state = new StateMachine(value => this.ui.state(value));
    this.account = new AccountService(); this.systems = [];
    this.progress=new ProgressStore(this.account,()=>this.lobby?.refresh());
    this.progress.openGuest();this.playerModels=new Map();
    this.abort = new AbortController();
    this.position = new THREE.Vector3(0, 0, 15);
    this.move = { x: 0, z: 0 }; this.verticalSpeed = 0;
    this.footstepTimer=0;
    this.cameraTarget = new THREE.Vector3(); this.cameraDesired = new THREE.Vector3();
    this.cameraDirection = new THREE.Vector3(); this.cameraRay = new THREE.Raycaster(); this.cameraHits = [];
    this.lastTime = 0; this.accumulator = 0; this.elapsed = 0; this.mapTimer = 0;
    this.lastRenderTime=0;
    this.guest = false; this.authRevision = 0; this.destroyed = false;
    this.animate = this.animate.bind(this);
  }
  async init() {
    try {
      this.canvas = document.querySelector('#world');
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, GAME.maxPixelRatio)*graphicsSettings.renderScale);
      this.renderer.shadowMap.enabled = graphicsSettings.shadows==='dynamic';
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.05;
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color('#315a67');
      this.scene.fog = new THREE.Fog('#315a67', 105, 290);
      this.camera = new THREE.PerspectiveCamera(75, 1, .1, 330);
      this.composer=new EffectComposer(this.renderer);
      this.renderPass=new RenderPass(this.scene,this.camera);
      this.bloomPass=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.32,.28,.82);
      this.composer.addPass(this.renderPass);this.composer.addPass(this.bloomPass);
      this.scene.add(new THREE.HemisphereLight('#a3d6ff', '#3c294a', 1.5));
      this.ambientLight = new THREE.AmbientLight('#a8cad6', .5); this.scene.add(this.ambientLight);
      this.sun = new THREE.DirectionalLight('#ffdeb0', 3.3);
      this.sun.position.set(24, 42, 20); this.sun.castShadow = graphicsSettings.shadows==='dynamic';
      this.sun.shadow.mapSize.set(2048, 2048);
      Object.assign(this.sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 110 });
      this.sun.shadow.bias = -.0003; this.sun.shadow.normalBias = .04;
      this.scene.add(this.sun,this.sun.target);
      this.environment=createStudioEnvironment(this.renderer);this.scene.environment=this.environment.texture;this.scene.environmentIntensity=.65;
      this.world = new World(this.scene);
      this.playerVisual = createRosterModel(this.world,'captain'); this.world.root.add(this.playerVisual);this.playerModels.set('captain',this.playerVisual);
      this.playerVisual.visible = false;
      this.input = new Input(this.canvas, {
        onLock: () => this.onLock(), onUnlock: () => this.onUnlock(),
        onError: message => this.showLockError(message),
      });
      this.battle=new Battle(this);this.addSystem(this.battle);
      this.lobby=new Lobby(this);this.settings=new Settings(this);this.deployment=new Deployment(this);
      this.bindUI(); this.bindLifecycle(); this.resize();
      try{this.lobby.buildPortraits();}catch(error){console.warn('Miniaturas:',error);}
      this.updateMenuCamera(0);
      this.renderer.render(this.scene, this.camera);
      this.state.set('login');
      this.raf = requestAnimationFrame(this.animate);
      // La autenticación no bloquea la escena ni el modo invitado.
      this.setupAccount();
    } catch (error) { this.fail(error); }
  }
  async setupAccount() {
    const button = document.querySelector('#google-login');
    button.disabled = true;
    try {
      await this.account.init(user => { void this.onSession(user); });
      this.ui.authHint(this.account.enabled ? 'Tu progreso estará asociado a tu cuenta.' : 'Tu XP, divisas y personajes se guardan automáticamente en este navegador.');
    } catch (error) {
      console.error('Firebase:', error);
      this.ui.authHint('Firebase no está disponible. Puedes explorar como invitado.');
    } finally { if (!this.destroyed){button.disabled=!this.account.enabled;if(!this.account.enabled)button.title='Google estará disponible al conectar Firebase';} }
  }
  async onSession(user) {
    if (this.destroyed || this.guest) return;
    const revision = ++this.authRevision;
    if (!user) {
      this.lobby?.social?.setSession(null);
      if (['playing','paused','dead'].includes(this.state.value)) this.returnToMenu();
      if (this.state.value === 'menu') this.state.set('login');
      return;
    }
    if (this.state.value !== 'login') return;
    this.ui.busy(true);
    try {
      const profile = await this.account.loadProfile(user);
      if (revision !== this.authRevision || this.destroyed || this.guest) return;
      this.lobby?.social?.setSession(user,false,profile);
      this.ui.profile(this.progress.openCloud(user,profile), false);this.lobby.refresh();this.lobby.selectPreview(this.progress.profile.selectedCharacter); this.state.set('menu');
    } catch (error) {
      console.error('Perfil:', error);
      this.ui.toast('Sesión iniciada, pero no pudimos cargar tu perfil. Revisa Firestore y sus reglas, o entra como invitado.');
    } finally { if (revision === this.authRevision) this.ui.busy(false); }
  }
  bindUI() {
    this.ui.on('#google-login', async () => {
      this.ui.busy(true);
      try { await this.account.signIn(); }
      catch (error) {
        const messages = {
          'auth/popup-closed-by-user': 'Se cerró el acceso a Google. Puedes volver a intentarlo.',
          'auth/popup-blocked': 'Permite la ventana emergente para iniciar sesión.',
          'auth/unauthorized-domain': 'Agrega este dominio a los dominios autorizados de Firebase Auth.',
        };
        this.ui.toast(messages[error.code] || error.message);
      } finally { this.ui.busy(false); }
    });
    this.ui.on('#guest-login', () => {
      this.guest = true; ++this.authRevision;
      this.lobby?.social?.setSession(null,true);
      this.ui.profile(this.progress.openGuest(), true);this.lobby.refresh();this.lobby.selectPreview(this.progress.profile.selectedCharacter); this.state.set('menu');
    });
    this.ui.on('#sign-out', async () => {
      try {
        if (!this.guest) await this.account.signOut();
        this.guest = false; ++this.authRevision;
        if (this.state.value === 'menu') this.state.set('login');
      } catch { this.ui.toast('No pudimos cerrar la sesión. Inténtalo de nuevo.'); }
    });
    this.ui.on('#play', () => this.deployment.open());
    this.ui.on('#lobby-settings',()=>this.settings.open());this.ui.on('#pause-settings',()=>this.settings.open());
    this.ui.on('#enter-game',()=>this.requestPlay(false));this.ui.on('#lock-menu',()=>this.returnToMenu());
    this.ui.on('#download-shortcut',()=>{const url=URL.createObjectURL(new Blob([`[InternetShortcut]\r\nURL=${location.origin}/\r\n`],{type:'application/octet-stream'}));const link=document.createElement('a');link.href=url;link.download='Abrir Toys vs Nightmares.url';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);});
    this.ui.on('#copy-game-url',async()=>{try{await navigator.clipboard.writeText(location.origin+'/');this.ui.toast('Dirección copiada. Pégala en una ventana independiente de Chrome, Edge o Firefox.');}catch{this.ui.toast('Copia esta dirección: '+location.origin+'/');}});
    this.canvas.addEventListener('click',()=>{if(['ready','paused'].includes(this.state.value))this.requestPlay(false);});
    this.ui.on('#resume', () => this.requestPlay(false));
    this.ui.on('#pause-button', () => { this.input.unlock(); this.onUnlock(); });
    this.ui.on('#respawn', () => this.requestPlay(true));
    this.ui.on('#back-menu', () => this.returnToMenu());
    this.ui.on('#death-menu', () => this.returnToMenu());
    this.ui.on('#result-menu', () => this.returnToMenu());this.ui.on('#result-replay',()=>{this.returnToMenu();this.deployment.open();});
    this.ui.on('#retry', () => location.reload());
    document.querySelectorAll('[data-upgrade]').forEach(button=>button.addEventListener('click',()=>this.battle.buyUpgrade(button.dataset.upgrade)));
  }
  bindLifecycle() {
    const options = { signal: this.abort.signal };
    const enableAudio=()=>{void audio.init().then(()=>{if(this.state.value==='menu')audio.startLobbyMusic();}).catch(error=>console.error('No se pudo iniciar el audio:',error));};
    window.addEventListener('click',enableAudio,options);
    window.addEventListener('keydown',enableAudio,options);
    document.addEventListener('click',event=>{
      const control=event.target?.closest?.('button,a,[role="button"]');
      if(!control||control.disabled||this.state.value==='playing')return;
      void audio.init().then(()=>audio.play('click')).catch(error=>console.error('No se pudo reproducir el sonido de interfaz:',error));
    },options);
    document.addEventListener('pointerover',event=>{
      const control=event.target?.closest?.('button,a,[role="button"]');
      if(!control||control.disabled||control.contains(event.relatedTarget)||!['menu','login'].includes(this.state.value))return;
      audio.play('hover');
    },options);
    window.addEventListener('resize', () => this.resize(), options);
    document.addEventListener('visibilitychange', () => {
      this.lastTime = 0; this.accumulator = 0;
      if (document.hidden) { this.input.unlock(); this.onUnlock(); }
    }, options);
    this.canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault(); this.fail(new Error('Se perdió el contexto gráfico. Pulsa Reintentar para reconstruir la escena.'));
    }, options);
    window.addEventListener('pagehide', event => { if (!event.persisted) this.dispose(); }, options);
    window.addEventListener('online',()=>void this.progress.flush(),options);
  }
  async prepareMatch(options={}){
    this.battle.start(options.squad?'horde':this.lobby?.mode||'horde',options.squad?4:this.lobby?.size||4,options.squad||null);
    if(options.squad)try{await this.battle.ensureSquadConnection();}catch(error){this.battle.stop();document.querySelector('#lock-message').textContent='Error de conexión de red con el servidor';throw error;}
    this.updateFollowCamera(1,true);document.querySelector('#lock-message').textContent='Haz clic para ocultar el cursor y controlar la cámara. ESC pausa y libera el ratón.';this.state.set('ready');
  }
  showSquadNetworkError(){const message='Error de conexión de red con el servidor';const lockMessage=document.querySelector('#lock-message');if(lockMessage)lockMessage.textContent=message;this.ui.toast(message);}
  showLockError(message){document.querySelector('#lock-message').textContent=message;document.querySelector('.browser-help').open=true;this.ui.toast(message);}
  async requestPlay(reset) {
    if (!['ready','paused','dead'].includes(this.state.value)) return;
    if(this.battle.squadSync)try{await this.battle.ensureSquadConnection();}catch{this.showSquadNetworkError();return;}
    if (reset) {
      if(this.state.value==='dead')this.battle.resetPlayer();
    }
    try { await this.input.lock(); }
    catch(error){this.showLockError(error.message||'No se pudo bloquear el cursor. Abre el juego en una pestaña normal de escritorio.');}
  }
  onLock() {
    if (!['ready','paused','dead'].includes(this.state.value)) { this.input.unlock(); return; }
    if(!this.battle.hasOpenSquadConnection()){this.input.unlock();this.showSquadNetworkError();return;}
    audio.stopLobbyMusic();
    const fromMenu = this.state.value === 'ready' || this.state.value === 'dead';
    this.playerVisual.visible = true;
    this.lastTime = 0; this.accumulator = 0;
    this.state.set('playing');
    this.battle.setSquadPlaying(true);
    document.querySelector('#look-hint').textContent='WASD mover · Ratón libre · ESC libera el cursor';
    this.updateFollowCamera(1, fromMenu);
  }
  onUnlock() {
    this.battle?.setSquadPlaying(false);
    if (this.state.value === 'playing') this.state.set('paused');
    this.accumulator = 0;
  }
  resetPlayer() {
    this.battle.resetPlayer();this.input.clear();this.ui.recoil(0);
  }
  selectPlayerModel(id){this.playerVisual.visible=false;if(!this.playerModels.has(id)){const model=createRosterModel(this.world,id);model.visible=false;this.world.root.add(model);this.playerModels.set(id,model);}this.playerVisual=this.playerModels.get(id);}
  returnToMenu() {
    this.state.set('menu'); this.input.unlock(); this.input.clear();
    this.playerVisual.visible = false; this.accumulator = 0;
    this.battle.stop();
    this.lobby.refresh();this.lobby.show('home');
    void audio.init().then(()=>audio.startLobbyMusic()).catch(error=>console.error('No se pudo iniciar la música del lobby:',error));
  }
  finishMatch(won) {
    this.ui.result(won,this.battle.match);this.state.set('result');this.input.unlock();
    this.battle.update(0);
    const result={...this.battle.result,won,healing:Math.floor(this.battle.result.healing)};const earned=rewards(result);
    document.querySelector('#result-rewards').textContent=`+${earned.xp} XP · +${earned.currency} ${result.team==='toys'?'Monedas de Juguete':'Esencias de Pesadilla'}`;
    void this.progress.record(result).then(()=>{document.querySelector('#result-save').textContent=this.progress.status;}).catch(()=>{document.querySelector('#result-save').textContent='Guardado pendiente';});
  }
  /** El combate conserva la oleada al morir; respawn devuelve al jugador a la base. */
  handleDeath({ killer = 'Una pesadilla', score = 0 } = {}) {
    if (this.state.value !== 'playing') return;
    this.ui.health(0, 0,this.battle.player.maxHealth); this.ui.death(killer, score);
    this.state.set('dead'); this.input.unlock();
    this.battle.update(0);
  }
  addSystem(system) { this.systems.push(system); }
  resize() {
    const width = innerWidth, height = Math.max(1, innerHeight);
    this.renderer.setSize(width, height);
    const pixelRatio=Math.min(devicePixelRatio, GAME.maxPixelRatio)*graphicsSettings.renderScale;
    this.renderer.setPixelRatio(pixelRatio);
    this.composer?.setPixelRatio(pixelRatio);this.composer?.setSize(width,height);
    this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
  }
  fixedUpdate(dt) {
    const previousX=this.position.x,previousZ=this.position.z;
    const x = Number(this.input.down('KeyD')) - Number(this.input.down('KeyA'));
    const z = Number(this.input.down('KeyS')) - Number(this.input.down('KeyW'));
    movementVector(x, z, this.input.yaw, this.move);
    const sprint = this.input.down('ShiftLeft') || this.input.down('ShiftRight');
    const status=this.battle.player.status;
    const distance = GAME.speed*this.battle.moveMultiplier(this.battle.player)*(sprint&&!this.input.aiming?GAME.sprintMultiplier:1)*aimModifiers(this.input.aiming).movement*dt;
    const limit = GAME.worldSize / 2 - 1;
    const nx = THREE.MathUtils.clamp(this.position.x + this.move.x * distance, -limit, limit);
    const nz = THREE.MathUtils.clamp(this.position.z + this.move.z * distance, -limit, limit);
    // Colisión horizontal conservadora: bloques no escalables en esta etapa.
    // Se resuelve cada eje por separado para deslizarse al rozar una cobertura.
    if (!this.battle.blocked(nx, this.position.z, this.position.y, GAME.playerRadius)) this.position.x = nx;
    if (!this.battle.blocked(this.position.x, nz, this.position.y, GAME.playerRadius)) this.position.z = nz;
    const previousY=this.position.y,jump=this.input.consumeJump();
    if(status.flight&&!status.root){this.verticalSpeed=0;this.position.y=Math.max(2,Math.min(18,this.position.y+(this.input.down('Space')?7:this.input.down('ControlLeft')?-7:0)*dt));}
    else if(status.hover&&!status.root){this.verticalSpeed=0;this.position.y=Math.min(8,this.position.y+dt*6);}
    else{if(jump&&!status.root&&!status.stun&&!status.sleep&&(this.position.y<=.001||this.grounded)){this.verticalSpeed=GAME.jumpSpeed;audio.play('jump');}this.verticalSpeed-=GAME.gravity*dt;this.position.y=Math.max(0,this.position.y+this.verticalSpeed*dt);this.grounded=false;
      if(this.verticalSpeed<=0)for(const o of this.world.obstacles)if(!o.ramp&&previousY>=o.h-.02&&this.position.y<=o.h&&Math.abs(this.position.x-o.x)<o.w/2&&Math.abs(this.position.z-o.z)<o.d/2){this.position.y=o.h;this.verticalSpeed=0;this.grounded=true;}
      const ground=this.world.groundHeight(this.position.x,this.position.z);if(this.position.y<=ground){this.position.y=ground;this.verticalSpeed=0;this.grounded=true;}}
    const grounded=!status.flight&&!status.hover&&this.position.y<=this.world.groundHeight(this.position.x,this.position.z)+.03;
    if(grounded&&Math.hypot(this.position.x-previousX,this.position.z-previousZ)>.001){this.footstepTimer-=dt;if(this.footstepTimer<=0){audio.play('footstep',.12);this.footstepTimer=.38;}}
    else this.footstepTimer=0;
    this.playerVisual.position.copy(this.position);
    this.playerVisual.rotation.y = this.input.yaw + Math.PI;
    for (const system of this.systems) system.fixedUpdate?.(dt, this);
  }
  updateFollowCamera(dt, snap = false) {
    const aiming=this.input.aiming&&this.state.value==='playing';this.camera.fov=snap?aimModifiers(aiming).fov:smoothFov(this.camera.fov,aiming,dt);this.camera.updateProjectionMatrix();
    const yaw = this.input.yaw, pitch = this.input.pitch, distance = 6.8;
    this.cameraTarget.copy(this.position); this.cameraTarget.y += (this.battle?.player.spec.height||1.8)+.5;
    // Encuadre sobre el hombro: la mira no queda tapada por la cabeza.
    this.cameraTarget.x += Math.cos(yaw) * .65;
    this.cameraTarget.z -= Math.sin(yaw) * .65;
    this.cameraDesired.set(Math.sin(yaw) * Math.cos(pitch) * distance,
      Math.sin(pitch) * distance, Math.cos(yaw) * Math.cos(pitch) * distance).add(this.cameraTarget);
    this.cameraDirection.subVectors(this.cameraDesired, this.cameraTarget).normalize();
    this.cameraRay.set(this.cameraTarget, this.cameraDirection);
    this.cameraRay.far = distance;
    this.cameraHits.length = 0;
    this.cameraRay.intersectObjects(this.world.solids, false, this.cameraHits);
    if (this.cameraHits.length) this.cameraDesired.copy(this.cameraTarget).addScaledVector(this.cameraDirection, Math.max(.3, this.cameraHits[0].distance - .25));
    // Acercamiento inmediato ante obstáculo; amortiguación al alejarse.
    const obstructed = this.cameraHits.length > 0;
    if (snap || obstructed) this.camera.position.copy(this.cameraDesired);
    else this.camera.position.lerp(this.cameraDesired, 1 - Math.exp(-18 * dt));
    this.camera.lookAt(this.cameraTarget);
    this.sun.position.set(this.position.x+24,42,this.position.z+20);this.sun.target.position.set(this.position.x,0,this.position.z);
  }
  updateMenuCamera(time) {
    const reduced = this.reducedMotion ??= matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = reduced ? 0 : time * .055;
    this.camera.position.set(29 + Math.sin(t) * 4, 18 + Math.sin(t * .7), 38 + Math.cos(t) * 3);
    this.camera.lookAt(-2, 4, -3);
    if (!reduced) this.world.updateMenu(time);
  }
  animate(timestamp) {
    if (this.destroyed || this.state.value === 'error') return;
    try {
      const dt = this.lastTime ? Math.min((timestamp - this.lastTime) / 1000, GAME.maxFrameDelta) : 0;
      this.lastTime = timestamp;
      if (!document.hidden) {
        this.elapsed += dt;
        if (this.state.value === 'playing') {
          this.accumulator += dt;
          // Paso fijo y dt limitado: evita saltos grandes y espiral de catch-up.
          while (this.accumulator >= GAME.fixedStep && this.state.value==='playing') {
            this.fixedUpdate(GAME.fixedStep); this.accumulator -= GAME.fixedStep;
          }
          this.updateFollowCamera(dt);
          for (const system of this.systems) system.update?.(dt, this);
          this.mapTimer += dt;
          if (this.mapTimer >= .1) { this.ui.drawMinimap(this.position, this.input.yaw, this.world.obstacles,this.battle); this.mapTimer = 0; }
        } else if(this.state.value==='menu')this.lobby.update(this.elapsed);else if(this.state.value==='login')this.updateMenuCamera(this.elapsed);
        if(!this.lastRenderTime||timestamp-this.lastRenderTime>=1000/graphicsSettings.fpsCap){
          this.lastRenderTime=timestamp;updateFPSCounter(timestamp);
          const scene=this.state.value==='menu'?this.lobby.scene:this.scene,camera=this.state.value==='menu'?this.lobby.camera:this.camera;
          if(graphicsSettings.projectileStyle==='full'){this.renderPass.scene=scene;this.renderPass.camera=camera;this.composer.render();}
          else this.renderer.render(scene,camera);
        }
      }
      this.raf = requestAnimationFrame(this.animate);
    } catch (error) { this.fail(error); }
  }
  fail(error) {
    console.error('GameEngine:', error);
    cancelAnimationFrame(this.raf); this.input?.unlock();
    this.ui.error(error);
    if (this.state.value !== 'error') this.state.set('error');
  }
  dispose() {
    if (this.destroyed) return;
    this.destroyed = true; ++this.authRevision;
    audio.stopLobbyMusic();
    cancelAnimationFrame(this.raf); this.abort.abort(); this.input?.dispose();
    this.account.dispose(); this.ui.dispose();
    for (const system of this.systems) system.dispose?.();
    this.settings?.dialog.remove();this.deployment?.dialog.remove();this.world?.dispose();this.environment?.dispose(); this.renderer?.dispose();
    this.lobby?.dispose();this.composer?.dispose();
  }
}

export const engine = new GameEngine();
await engine.init();
