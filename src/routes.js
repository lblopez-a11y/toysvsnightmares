export const BASES={toys:{x:-18,z:103},nightmares:{x:0,z:-103}};
/** Tres corredores; el offset evita que compañeros de una ruta se superpongan. */
export function planRoute(team,slot,objective,random=Math.random){
 const lane=slot%3-1,offset=(random()-.5)*9,base=BASES[team],side=team==='toys'?1:-1;
 return {lane,offset,index:0,points:[
  {x:base.x+lane*17+offset,z:base.z-side*24},
  {x:Math.max(-97,Math.min(97,lane*58+offset)),z:side*34},
  {x:objective.x+lane*13+offset*.4,z:objective.z+side*15},
  {x:objective.x+offset*.4,z:objective.z+lane*2},
 ]};
}
