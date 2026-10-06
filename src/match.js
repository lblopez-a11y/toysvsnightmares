import {SECTORS} from '../functions/shared/catalog.js';
export class Match {
 constructor(){this.reset();}
 reset(mode='horde',team='toys',size=4){this.mode=mode;this.team=team;this.size=size;this.wave=0;this.totalWaves=10;this.remaining=0;this.baseHealth=1000;this.kills=0;this.score=0;this.phase=mode==='horde'?'intermission':'battle';this.timer=mode==='horde'?3:240;this.sector=0;this.capture=0;this.contested=false;this.points={toys:0,nightmares:0};this.winner=null;this.wavePoints=0;this.upgrades={damage:0,health:0,repair:0};}
 beginWave(){this.wave++;this.remaining=Math.min(20,4+this.wave*2);this.phase='battle';return this.remaining;}
 kill(credit=true){if(credit){this.kills++;this.score+=100;this.wavePoints+=50;}if(this.mode!=='horde'||this.phase!=='battle')return;this.remaining=Math.max(0,this.remaining-1);if(!this.remaining){if(this.wave===10)this.end('toys');else{this.phase='intermission';this.timer=20;}}}
 end(winner){this.winner=winner;this.phase=winner===this.team?'won':'lost';}
 damageBase(amount){if(this.mode!=='horde')return;this.baseHealth=Math.max(0,this.baseHealth-amount);if(!this.baseHealth)this.end('nightmares');}
 captureTick(dt,attackers,defenders){if(this.mode!=='conquest'||this.phase!=='battle')return false;this.timer=Math.max(0,this.timer-dt);this.contested=attackers>0&&defenders>0;if(attackers>0&&!defenders)this.capture=Math.min(100,this.capture+dt*5*Math.min(2,attackers));if(this.capture>=100){this.sector++;this.capture=0;this.timer=240;if(this.sector===SECTORS.length)this.end('nightmares');return true;}if(this.timer===0)this.end('toys');return false;}
 confirm(team){if(this.mode!=='confirmed'||this.phase!=='battle')return;this.points[team]++;if(this.points[team]>=35)this.end(team);}
 buyUpgrade(kind){const costs={damage:150,health:150,repair:100};if(this.mode!=='horde'||this.phase!=='intermission'||!this.wave)throw new Error('Las mejoras se compran entre oleadas.');if(!(kind in costs))throw new Error('Mejora inválida');if(this.wavePoints<costs[kind])throw new Error('Faltan puntos de oleada.');if(this.upgrades[kind]>=5)throw new Error('Mejora al máximo.');this.wavePoints-=costs[kind];this.upgrades[kind]++;if(kind==='repair')this.baseHealth=Math.min(1000,this.baseHealth+200);return true;}
}
