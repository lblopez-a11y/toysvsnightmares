import * as THREE from 'three';
import {World} from '../src/world.js';
import {Battle} from '../src/battle.js';
import {createRosterModel} from '../src/characters.js';
const scene=new THREE.Scene();scene.background=new THREE.Color('#6e9ca7');scene.fog=new THREE.Fog('#6e9ca7',180,400);
scene.add(new THREE.HemisphereLight('#e5e6cf','#62524b',2.8));const sun=new THREE.DirectionalLight('#ffe4b9',3);sun.position.set(25,70,45);scene.add(sun);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(1.5,devicePixelRatio));renderer.setSize(innerWidth,innerHeight);document.body.append(renderer.domElement);renderer.toneMapping=THREE.ACESFilmicToneMapping;
const world=new World(scene),camera=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,.1,500),position=new THREE.Vector3(0,0,30),playerVisual=createRosterModel(world,'captain');world.root.add(playerVisual);
const noop=()=>{},engine={world,scene,camera,position,playerVisual,input:{yaw:0,pitch:0,consumeAction:()=>false,down:()=>false},move:{x:0,z:0},state:{value:'playing'},ui:{toast:noop,banner:noop,health:noop,battle:noop,cooldown:noop,hurt:noop,kill:noop,recoil:noop},handleDeath:noop,finishMatch:noop};
const battle=new Battle(engine);let target,playingBomb=false,elapsed=0;const status=document.querySelector('#status');
function reset(){battle.start('conquest',6);for(const bank of Object.values(battle.banks))bank.releaseAll();battle.player.status={};battle.player.shotTimer=0;playingBomb=false;}
function overview(){reset();playerVisual.visible=false;camera.position.set(110,145,180);camera.lookAt(0,0,0);status.textContent='Bases opuestas, cuarto de 240 × 240, cartón, bloques y libros-rampa';}
document.querySelector('#overview').onclick=overview;
document.querySelector('#props').onclick=()=>{reset();playerVisual.visible=false;camera.position.set(18,15,65);camera.lookAt(-10,2,29);status.textContent='Libros-rampa con superficie inclinada transitable y edificios de cartón';};
document.querySelector('#bomb').onclick=()=>{
 reset();engine.input.yaw=0;position.set(0,0,30);playerVisual.position.copy(position);playerVisual.rotation.y=Math.PI;battle.player.syncHitboxes();target=battle.banks.nightmares.acquire();battle.spawnActor(target,true);target.size=2.5/2.6;target.model.scale.setScalar(target.size);target.position.set(0,0,3);target.health=1000;target.status={};target.syncHitboxes();
 camera.position.set(9,7,34);camera.lookAt(0,1.5,16);scene.updateMatrixWorld(true);battle.launchGrenade(battle.player,40);elapsed=0;playingBomb=true;status.textContent='Bomba lanzada: esfera oscura, banda roja y mecha';
};
overview();let last=performance.now();
function frame(now){const dt=Math.min(.033,(now-last)/1000);last=now;battle.time+=dt;if(playingBomb){elapsed+=dt;battle.updateProjectiles(dt);battle.effects.update(dt);battle.damageNumbers.update(dt,camera);if(elapsed>1.5)status.textContent=`Explosión: daño radial + empuje · HP objetivo: ${Math.round(target.health)} · Bot ${target.position.z.toFixed(1)} m`;if(elapsed>1.72){playingBomb=false;status.textContent+=' · Fotograma pausado para revisión';}}world.animateEnvironment(now/1000);scene.updateMatrixWorld(true);renderer.render(scene,camera);requestAnimationFrame(frame);}requestAnimationFrame(frame);
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
