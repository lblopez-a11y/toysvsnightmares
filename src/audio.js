class AudioManager {
 constructor(){
  this.ctx=null;this.buffers=new Map();this.volume=.8;this.muted=false;this.music=null;this.musicTimer=null;
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
    this.buffers.set(key,await this.ctx.decodeAudioData(await response.arrayBuffer()));
   }catch(error){console.warn(`No se pudo cargar el audio [${key}]; se usará síntesis local:`,error);}
  }));
 }
 tone(startFrequency,endFrequency,duration,level,type='sine',delay=0){
  const ctx=this.ctx,now=ctx.currentTime+delay,oscillator=ctx.createOscillator(),gain=ctx.createGain();
  oscillator.type=type;oscillator.frequency.setValueAtTime(startFrequency,now);oscillator.frequency.exponentialRampToValueAtTime(Math.max(1,endFrequency),now+duration);
  gain.gain.setValueAtTime(.0001,now);gain.gain.linearRampToValueAtTime(level*this.volume,now+.008);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
  oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start(now);oscillator.stop(now+duration+.015);
 }
 noise(duration,level,filterType,frequency){
  const ctx=this.ctx,length=Math.max(1,Math.floor(ctx.sampleRate*duration)),buffer=ctx.createBuffer(1,length,ctx.sampleRate),samples=buffer.getChannelData(0);
  for(let i=0;i<length;i++)samples[i]=Math.random()*2-1;
  const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain(),now=ctx.currentTime;
  filter.type=filterType;filter.frequency.setValueAtTime(frequency,now);
  gain.gain.setValueAtTime(level*this.volume,now);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
  source.buffer=buffer;source.connect(filter);filter.connect(gain);gain.connect(ctx.destination);source.start(now);source.stop(now+duration);
 }
 synthesize(key,pitchVar){
  const pitch=1+(Math.random()*2-1)*pitchVar;
  switch(key){
   case 'shoot':this.noise(.11,.22,'lowpass',1700);this.tone(155*pitch,48,.12,.2,'sawtooth');break;
   case 'reload':this.noise(.075,.16,'bandpass',1150);this.tone(480*pitch,180,.09,.12,'triangle',.05);this.tone(310*pitch,100,.12,.16,'square',.14);break;
   case 'hitmark':this.tone(1250*pitch,780,.09,.16,'sine');break;
   case 'kill':this.tone(240*pitch,65,.32,.19,'triangle');this.tone(110*pitch,42,.24,.12,'sine',.06);break;
   case 'ability':this.tone(170*pitch,780,.42,.15,'sine');this.tone(340*pitch,1120,.3,.08,'triangle',.05);break;
   case 'upgrade':this.tone(540*pitch,840,.12,.12,'sine');this.tone(810*pitch,1180,.2,.14,'sine',.11);break;
   case 'alarm':this.tone(620*pitch,620,.2,.13,'triangle');this.tone(760*pitch,760,.2,.13,'triangle',.24);break;
   case 'footstep':this.noise(.065,.12,'lowpass',520);this.tone(105*pitch,55,.075,.14,'sine');break;
   case 'jump':this.tone(180*pitch,620,.24,.16,'triangle');break;
   case 'click':this.tone(880*pitch,680,.045,.08,'sine');break;
   case 'hover':this.tone(1150*pitch,920,.035,.035,'sine');break;
   default:return false;
  }
  return true;
 }
 play(key,pitchVar=.05){
  if(this.muted||!this.ctx)return;
  const buffer=this.buffers.get(key);
  if(!buffer){this.synthesize(key,pitchVar);return;}
  try{
   const source=this.ctx.createBufferSource(),gainNode=this.ctx.createGain();
   source.buffer=buffer;
   if(pitchVar>0)source.playbackRate.value=1+(Math.random()*2-1)*pitchVar;
   gainNode.gain.value=this.volume;
   source.connect(gainNode);gainNode.connect(this.ctx.destination);source.start(0);
  }catch(error){console.error('Error al reproducir SFX:',error);this.synthesize(key,pitchVar);}
 }
 startLobbyMusic(){
  if(this.muted||!this.ctx||this.music)return;
  const ctx=this.ctx,master=ctx.createGain(),filter=ctx.createBiquadFilter(),root=ctx.createOscillator(),fifth=ctx.createOscillator(),rootGain=ctx.createGain(),fifthGain=ctx.createGain();
  const chord=[110,130.81,98,146.83],setChord=index=>{const base=chord[index%chord.length];root.frequency.setTargetAtTime(base,ctx.currentTime,.8);fifth.frequency.setTargetAtTime(base*1.5,ctx.currentTime,.8);};
  master.gain.value=this.volume*.12;filter.type='lowpass';filter.frequency.value=700;
  root.type='sine';fifth.type='triangle';rootGain.gain.value=.68;fifthGain.gain.value=.18;
  root.connect(rootGain);fifth.connect(fifthGain);rootGain.connect(filter);fifthGain.connect(filter);filter.connect(master);master.connect(ctx.destination);
  setChord(0);root.start();fifth.start();this.music={root,fifth,master};this.musicStep=1;
  this.musicTimer=setInterval(()=>setChord(this.musicStep++),2200);
 }
 stopLobbyMusic(){
  if(this.musicTimer!==null){clearInterval(this.musicTimer);this.musicTimer=null;}
  if(!this.music)return;
  for(const node of [this.music.root,this.music.fifth]){try{node.stop();}catch(error){console.warn('No se pudo detener la música del lobby:',error);}node.disconnect();}
  this.music.master.disconnect();this.music=null;
 }
}

export const audio=new AudioManager();
