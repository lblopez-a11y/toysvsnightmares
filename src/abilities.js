/** Habilidades orientadas a datos. Todas usan los mismos contratos de daño,
 * estados, zonas y movimiento que las armas; Q/E/C ejecutan los slots 1/2/3. */
export function useAbility(battle,actor,index){
 const ability=actor.spec.abilities[index];if(!ability||ability.passive||actor.cooldowns[index]>0||!actor.active||actor.status.stun||actor.status.sleep)return false;
 if(actor.status.cloak)return false;
 const s=actor.status,effect=ability.effect,team=actor.team;
 const enemy=battle.aimTarget(actor,false,30),ally=battle.aimTarget(actor,true,22)||actor;
 const nearby=(radius,opponents,fn)=>{for(const other of battle.actors)if(other.active&&(other.team!==team)===opponents&&other.position.distanceTo(actor.position)<radius)fn(other);};
 let accepted=true;
 switch(effect){
  case 'paint':battle.launchGrenade(actor,40);break;
  case 'spring':if(s.root){accepted=false;break;}if(actor===battle.player)battle.engine.verticalSpeed=22;else actor.status.jump=1;break;
  case 'healZone':battle.zone('heal',actor.position,team,5,8,actor);break;
  case 'defenseLink':ally.status.defense=6;actor.link={target:ally,type:'defense',time:6};break;
  case 'blindArea':nearby(10,true,o=>o.status.blind=2);battle.effects.burst(actor.position,'#fbbad7',24);break;
  case 'barricade':battle.placeBarrier(actor);break;
  case 'turret':s.turret=6;break;
  case 'charge':if(s.root){accepted=false;break;}s.charge=.6;s.chargeHit=new Set();break;
  case 'flight':if(s.root){accepted=false;break;}s.flight=4;break;
  case 'mine':battle.zone('mine',actor.position,team,2.8,25,actor);break;
  case 'scan':s.scan=5;nearby(150,true,o=>o.status.reveal=5);break;
  case 'roar':nearby(12,false,o=>o.status.power=5);break;
  case 'tail':nearby(7,true,o=>{battle.damage(o,20,actor);battle.push(o,actor.position,5);});break;
  case 'guard':s.guard=3;break;
  case 'interrupt':nearby(10,true,o=>{o.status.stun=1;o.status.turret=0;o.status.drain=0;o.link=null;});break;
  case 'decoy':battle.zone('decoy',battle.ahead(actor,8),team,6,5,actor);break;
  case 'haste':nearby(12,false,o=>o.status.haste=5);break;
  case 'cloak':s.cloak=3.5;break;
  case 'blink':if(s.root){accepted=false;break;}battle.teleportForward(actor,8);break;
  case 'poison':s.poisonReady=8;break;
  case 'slimeShield':actor.shield=150;s.slimeShield=12;s.shieldTime=12;break;
  case 'rootZone':battle.zone('root',battle.ahead(actor,6),team,4,6,actor);break;
  case 'absorb':s.absorb=2;break;
  case 'hover':if(s.root){accepted=false;break;}s.hover=6;break;
  case 'blindCone':nearby(16,true,o=>{if(battle.inCone(actor,o,.55))o.status.blind=2;});break;
  case 'eyes':battle.zone('eyes',actor.position,team,24,8,actor);break;
  case 'voodoo':if(!enemy){accepted=false;break;}actor.link={target:enemy,type:'voodoo',time:6};break;
  case 'threads':battle.zone('threads',battle.ahead(actor,5),team,4,15,actor);break;
  case 'drain':if(!enemy){accepted=false;break;}actor.link={target:enemy,type:'drain',time:4};s.drain=4;break;
  case 'quake':nearby(9,true,o=>{o.status.stun=1;battle.damage(o,15,actor);});break;
  case 'hook':if(!enemy){accepted=false;break;}battle.pull(enemy,actor.position,Math.max(0,enemy.position.distanceTo(actor.position)-2));enemy.status.stun=.3;break;
  case 'sleep':nearby(10,true,o=>o.status.sleep=2.5);break;
  case 'allyShield':ally.shield=Math.max(ally.shield,60);ally.status.shieldTime=8;break;
  case 'portal':battle.placePortal(actor);break;
  default:accepted=false;
 }
 if(!accepted){if(actor===battle.player)battle.ui.toast('Necesitas un objetivo válido o salir del efecto de control.');return false;}
 actor.status.aura=1.5;actor.cooldowns[index]=ability.cooldown;battle.effects.burst(actor.position,actor.spec.color,12);
 if(actor===battle.player)battle.ui.toast(ability.name);return true;
}

export function statusTick(battle,actor,dt){
 const s=actor.status,poisonTime=s.poison||0;
 for(const key of Object.keys(s))if(typeof s[key]==='number'){s[key]=Math.max(0,s[key]-dt);if(!s[key])delete s[key];}
 for(let i=0;i<3;i++)actor.cooldowns[i]=Math.max(0,actor.cooldowns[i]-dt);
 actor.shotTimer=Math.max(0,actor.shotTimer-dt);actor.portalCooldown=Math.max(0,(actor.portalCooldown||0)-dt);
 if(actor.reload>0){actor.reload-=dt;if(actor.reload<=0)actor.ammo=actor.spec.weapon.magazine;}
 if(poisonTime)battle.damage(actor,5*Math.min(dt,poisonTime),actor.poisonSource,true);
 if(actor.shield&&!s.shieldTime){actor.shield=0;delete s.slimeShield;}
 if(actor.link){actor.link.time-=dt;const {target,type}=actor.link;if(!target.active||actor.link.time<=0)actor.link=null;else if(type==='drain'&&actor.position.distanceTo(target.position)<25&&battle.sight(actor,target)){battle.damage(target,10*dt,actor);battle.heal(actor,10*dt,actor);battle.effects.tracer(actor.body.center,target.body.center,'#bd8de3');}}
 if(s.charge){battle.teleportForward(actor,dt*24);for(const other of battle.actors)if(other.active&&other.team!==actor.team&&other.position.distanceTo(actor.position)<3&&!s.chargeHit.has(other)){s.chargeHit.add(other);battle.damage(other,30,actor);other.status.stun=.7;battle.push(other,actor.position,3);}}
 actor.model.visible=actor.active&&(!s.cloak||actor===battle.player&&Math.sin(battle.time*16)>-.2);
}
