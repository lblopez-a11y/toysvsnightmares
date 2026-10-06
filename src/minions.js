// Separate from the playable roster: no unlocks, hero abilities or shop cards.
export const MINIONS=Object.freeze({
 shadowling:{id:'shadowling',name:'Esbirro Sombrío',team:'nightmares',minion:true,model:'shadowling',hp:40,speed:1.35,height:1.05,color:'#5e448e',hitbox:'Pequeña',weapon:{name:'Mordisco',type:'cone',damage:10,interval:.8,magazine:0,range:2.6},abilities:[]},
 slimelet:{id:'slimelet',name:'Glóbulo de Baba',team:'nightmares',minion:true,model:'slimelet',hp:60,speed:.65,height:1.35,color:'#ac62df',hitbox:'Mediana',weapon:{name:'Gota de lodo',type:'projectile',damage:12,interval:1.3,magazine:0,range:28,speed:20},abilities:[]}
});
export function waveEnemyId(wave,index){return wave%3===0&&index===0?'titan':index%3===2?'slimelet':'shadowling';}
