export const AIM = Object.freeze({normalFov:75, aimedFov:52, spreadMultiplier:.4, recoilMultiplier:.45, movementMultiplier:.75});
export function aimModifiers(aiming){return {fov:aiming?AIM.aimedFov:AIM.normalFov,spread:aiming?AIM.spreadMultiplier:1,recoil:aiming?AIM.recoilMultiplier:1,movement:aiming?AIM.movementMultiplier:1};}
export function smoothFov(current,aiming,dt){return current+(aimModifiers(aiming).fov-current)*(1-Math.exp(-12*Math.max(0,dt)));}
// Uniform disk: ADS changes angular radius, not rate of fire or damage.
export function sampleSpread(aiming,base=.014,random=Math.random){const radius=Math.sqrt(random())*base*aimModifiers(aiming).spread,angle=random()*Math.PI*2;return {x:Math.cos(angle)*radius,y:Math.sin(angle)*radius};}
