import * as THREE from 'three';
export {resetStuck,sampleStuck} from './stuck.js';
/** Three front rays; shared scratch buffers, collision volumes include props.
 * BFS handles long detours. Steering only resolves immediate walls and barriers.
 */
export class BotSteering {
 constructor(world){
  this.rays=[0,-Math.PI/6,Math.PI/6].map(angle=>({angle,ray:new THREE.Raycaster(),direction:new THREE.Vector3(),distance:2.5}));
  this.origin=new THREE.Vector3();this.hits=[];
  this.geometry=new THREE.BoxGeometry(1,1,1);this.material=new THREE.MeshStandardMaterial();
  this.colliders=world.obstacles.map(o=>{const m=new THREE.Mesh(this.geometry,this.material);m.position.set(o.x,o.h/2,o.z);m.scale.set(o.w,o.h,o.d);m.updateMatrixWorld();return m;});
 }
 steer(actor,dx,dz,barriers){
  this.origin.copy(actor.position);this.origin.y+=.65;
  for(const sensor of this.rays){const c=Math.cos(sensor.angle),s=Math.sin(sensor.angle);sensor.direction.set(dx*c-dz*s,0,dx*s+dz*c);sensor.ray.set(this.origin,sensor.direction);sensor.ray.far=2.5;this.hits.length=0;sensor.ray.intersectObjects(this.colliders,false,this.hits);for(const b of barriers){b.mesh.updateMatrixWorld();sensor.ray.intersectObject(b.mesh,false,this.hits);}sensor.distance=this.hits.length?Math.min(...this.hits.map(h=>h.distance)):2.5;}
  if(this.rays[0].distance<2.5){const left=this.rays[1].distance,right=this.rays[2].distance;actor.avoidSide=Math.abs(left-right)>.12?(left>right?-1:1):(actor.avoidSide||((actor.slot||0)%2?1:-1));const turn=actor.avoidSide*Math.PI/2,c=Math.cos(turn),s=Math.sin(turn);return {x:dx*c-dz*s,z:dx*s+dz*c};}
  return {x:dx,z:dz};
 }
 dispose(){this.geometry.dispose();this.material.dispose();}
}
