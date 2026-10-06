export function resetStuck(actor){actor.stuckSample=0;actor.stuckTimer=0;actor.stuckPosition={x:actor.position.x,z:actor.position.z};actor.evadeTime=0;actor.evasionHop=0;actor.escapeDirection={x:0,z:0};}
export function sampleStuck(actor,dt,dx,dz,random=Math.random){
 if(!actor.stuckPosition)resetStuck(actor);
 actor.stuckSample+=dt;
 if(actor.stuckSample<.6)return false;
 const elapsed=actor.stuckSample;actor.stuckSample=0;
 const distance=Math.hypot(actor.position.x-actor.stuckPosition.x,actor.position.z-actor.stuckPosition.z);
 actor.stuckPosition.x=actor.position.x;actor.stuckPosition.z=actor.position.z;
 actor.stuckTimer=distance<.2?actor.stuckTimer+elapsed:0;
 if(actor.stuckTimer<=1.2)return false;
 const side=random()<.5?-1:1,length=Math.hypot(dx,dz)||1;
 actor.escapeDirection={x:dz/length*side,z:-dx/length*side};actor.evadeTime=1;actor.evasionHop=.5;actor.stuckTimer=0;actor.routeRefresh=0;actor.navGoal=null;actor.evasions=(actor.evasions||0)+1;
 return true;
}
