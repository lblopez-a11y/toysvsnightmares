import * as THREE from 'three';
import {ObjectPool} from './core.js';
export class DamageNumbers {
 constructor(){
  this.root=document.createElement('div');this.root.id='damage-numbers';this.root.setAttribute('aria-hidden','true');document.body.append(this.root);this.projected=new THREE.Vector3();
  this.pool=new ObjectPool(64,()=>{const node=document.createElement('span');node.className='damage-number';node.hidden=true;this.root.append(node);return {node,position:new THREE.Vector3(),life:0};},n=>n.node.hidden=true);
 }
 spawn(position,amount,critical=false){if(amount<=0)return;const n=this.pool.acquire();if(!n)return;n.position.copy(position);n.position.x+=(Math.random()-.5)*.5;n.life=1;n.node.textContent=`-${Math.max(1,Math.round(amount))}`;n.node.className=`damage-number${critical?' critical':''}`;n.node.hidden=false;}
 update(dt,camera,visible=true){for(const n of this.pool.active){n.life-=dt;if(n.life<=0){this.pool.release(n);continue;}n.position.y+=dt*1.4;this.projected.copy(n.position).project(camera);n.node.hidden=!visible||this.projected.z>1||this.projected.z< -1;n.node.style.transform=`translate(${(this.projected.x*.5+.5)*innerWidth}px,${(-this.projected.y*.5+.5)*innerHeight}px) translate(-50%,-100%)`;n.node.style.opacity=Math.min(1,n.life*2);}}
 reset(){this.pool.releaseAll();}
 dispose(){this.root.remove();}
}
