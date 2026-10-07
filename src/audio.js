class AudioManager {
 constructor(){
  this.ctx=null;this.buffers=new Map();this.volume=.8;this.muted=false;
  this.soundManifest={
   shoot:'https://cdn.freesound.org/previews/387/387228_5121236-lq.mp3',
   reload:'https://cdn.freesound.org/previews/131/131969_2398403-lq.mp3',
   hitmark:'https://cdn.freesound.org/previews/448/448080_9159316-lq.mp3',
   kill:'https://cdn.freesound.org/previews/171/171671_321967-lq.mp3',
   ability:'https://cdn.freesound.org/previews/274/274179_5121236-lq.mp3',
   upgrade:'https://cdn.freesound.org/previews/320/320655_5260872-lq.mp3',
   alarm:'https://cdn.freesound.org/previews/316/316838_5121236-lq.mp3',
  };
 }
 init(){
  if(!this.ctx){
   const AudioCtx=window.AudioContext||window.webkitAudioContext;
   if(!AudioCtx){console.warn('Web Audio API no está disponible; los efectos de sonido se desactivaron.');return Promise.resolve();}
   this.ctx=new AudioCtx();
   void this.preloadSounds();
  }
  return this.ctx.state==='suspended'?this.ctx.resume():Promise.resolve();
 }
 async preloadSounds(){
  await Promise.all(Object.entries(this.soundManifest).map(async([key,url])=>{
   try{
    const response=await fetch(url);
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const audioBuffer=await this.ctx.decodeAudioData(await response.arrayBuffer());
    this.buffers.set(key,audioBuffer);
   }catch(error){console.warn(`No se pudo cargar el audio [${key}]:`,error);}
  }));
 }
 play(key,pitchVar=.05){
  if(this.muted||!this.ctx||!this.buffers.has(key))return;
  try{
   const source=this.ctx.createBufferSource(),gainNode=this.ctx.createGain();
   source.buffer=this.buffers.get(key);
   if(pitchVar>0)source.playbackRate.value=1+(Math.random()*2-1)*pitchVar;
   gainNode.gain.value=this.volume;
   source.connect(gainNode);gainNode.connect(this.ctx.destination);source.start(0);
  }catch(error){console.error('Error al reproducir SFX:',error);}
 }
}

export const audio=new AudioManager();
