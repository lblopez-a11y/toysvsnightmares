import * as THREE from 'three';
import { ObjectPool } from './core.js';

/** Bancos fijos de trazadoras y partículas; se reciclan, nunca se crean al disparar. */
export class Effects {
  constructor(world) {
    this.root=new THREE.Group();world.root.add(this.root);this.axis=new THREE.Vector3(0,1,0);this.delta=new THREE.Vector3();
    this.particleDensity='full';
    this.tracers=new ObjectPool(64,()=>{
      const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,1,4),new THREE.MeshStandardMaterial({roughness:.45,metalness:.08,color:'#fff09b',emissive:'#fff09b',emissiveIntensity:2}));
      mesh.visible=false;this.root.add(mesh);return {mesh,life:0};
    },item=>{item.mesh.visible=false;});
    this.positions=new Float32Array(384*3);this.colors=new Float32Array(384*3);
    this.positions.fill(0);this.geometry=new THREE.BufferGeometry();
    this.geometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3));
    this.geometry.setAttribute('color',new THREE.BufferAttribute(this.colors,3));
    this.geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(),240);
    this.material=new THREE.PointsMaterial({size:.24,vertexColors:true,transparent:true,opacity:.9,depthWrite:false});
    this.points=new THREE.Points(this.geometry,this.material);this.root.add(this.points);
    this.particles=new ObjectPool(384,i=>({i,life:0,x:0,y:-50,z:0,vx:0,vy:0,vz:0}),p=>{
      this.positions[p.i*3+1]=-50;
    });
    for(let i=0;i<384;i++)this.positions[i*3+1]=-50;
    this.color=new THREE.Color();
    this.flashLights=new ObjectPool(6,()=>{const light=new THREE.PointLight('#ffd077',0,9,2);light.visible=true;this.root.add(light);return {light,life:0};},f=>{f.light.visible=true;f.light.intensity=0;});
    this.explosions=new ObjectPool(8,()=>{
      const group=new THREE.Group();group.visible=false;this.root.add(group);
      const fire=new THREE.Mesh(world.sphereGeometry,new THREE.MeshStandardMaterial({roughness:.45,metalness:.08,color:'#ff9c38',emissive:'#ff670b',emissiveIntensity:3,transparent:true,opacity:.6,depthWrite:false}));group.add(fire);
      const smoke=[];for(let i=0;i<8;i++){const mesh=new THREE.Mesh(world.sphereGeometry,new THREE.MeshStandardMaterial({roughness:.45,metalness:.08,color:i%2?'#463b45':'#776570',transparent:true,opacity:.5,depthWrite:false}));group.add(mesh);smoke.push(mesh);}
      return {group,fire,smoke,life:0};
    },e=>e.group.visible=false);
  }
  muzzleFlash(position,color){if(this.particleDensity!=='full')return;let f=this.flashLights.acquire();if(!f){f=this.flashLights.active.values().next().value;this.flashLights.release(f);f=this.flashLights.acquire();}f.light.position.copy(position);f.light.color.set(color);f.light.visible=true;f.life=.075;f.light.intensity=14;}
  tracer(from,to,color='#fff49c') {
    const item=this.tracers.acquire();if(!item)return;
    this.delta.subVectors(to,from);const distance=this.delta.length();
    item.mesh.position.copy(from).addScaledVector(this.delta,.5);
    item.mesh.scale.y=Math.max(.01,distance);item.mesh.quaternion.setFromUnitVectors(this.axis,this.delta.normalize());
    item.mesh.material.color.set(color);item.mesh.visible=true;item.life=.075;
  }
  burst(point,color='#ffce86',count=12,spherical=false) {
    if(this.particleDensity==='off')return;
    if(this.particleDensity==='low')count=Math.ceil(count*.35);
    this.color.set(color);
    for(let i=0;i<count;i++){
      const p=this.particles.acquire();if(!p)break;
      p.x=point.x;p.y=point.y;p.z=point.z;p.vx=(Math.random()-.5)*7;p.vy=Math.random()*5+1;p.vz=(Math.random()-.5)*7;p.life=.35+Math.random()*.4;
      if(spherical){const a=Math.random()*Math.PI*2,y=Math.random()*2-1,r=Math.sqrt(1-y*y),speed=5+Math.random()*9;p.vx=Math.cos(a)*r*speed;p.vy=y*speed;p.vz=Math.sin(a)*r*speed;}
      this.colors[p.i*3]=this.color.r;this.colors[p.i*3+1]=this.color.g;this.colors[p.i*3+2]=this.color.b;
    }
    this.geometry.attributes.color.needsUpdate=true;
  }
  update(dt) {
    for(const f of this.flashLights.active){f.life-=dt;f.light.intensity=14*Math.max(0,f.life/.075);if(f.life<=0)this.flashLights.release(f);}
    for(const e of this.explosions.active){e.life-=dt;if(e.life<=0){this.explosions.release(e);continue;}const age=1.1-e.life;e.fire.scale.setScalar(Math.max(.01,Math.min(4,age*17)));e.fire.material.opacity=Math.max(0,.7-age*2);e.smoke.forEach((m,i)=>{const angle=i*Math.PI/4;m.position.set(Math.cos(angle)*age*3,age*3+(i%3)*.5,Math.sin(angle)*age*3);m.scale.setScalar(.4+age);m.material.opacity=e.life*.38;});}
    for(const t of this.tracers.active){t.life-=dt;if(t.life<=0)this.tracers.release(t);}
    for(const p of this.particles.active){
      p.life-=dt;if(p.life<=0){this.particles.release(p);continue;}
      p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vy-=12*dt;
      this.positions[p.i*3]=p.x;this.positions[p.i*3+1]=p.y;this.positions[p.i*3+2]=p.z;
    }
    this.geometry.attributes.position.needsUpdate=true;
  }
  explosion(point){if(this.particleDensity==='off')return;const e=this.explosions.acquire();if(e){e.group.position.copy(point);e.life=1.1;e.group.visible=true;e.fire.scale.setScalar(.01);e.fire.material.opacity=.7;e.smoke.forEach((mesh,index)=>mesh.visible=this.particleDensity==='full'||index<3);}this.burst(point,'#ffca55',36,true);this.burst(point,'#f3673a',24,true);}
  reset(){this.flashLights.releaseAll();this.tracers.releaseAll();this.particles.releaseAll();this.explosions.releaseAll();this.geometry.attributes.position.needsUpdate=true;}
}
