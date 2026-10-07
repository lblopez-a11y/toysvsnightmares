import {test} from 'node:test';
import assert from 'node:assert/strict';
import {audio} from '../src/audio.js';

class FakeParam{
 setValueAtTime(value){this.value=value;}
 exponentialRampToValueAtTime(value){this.value=value;}
 linearRampToValueAtTime(value){this.value=value;}
 setTargetAtTime(value){this.value=value;}
}
class FakeNode{
 constructor(){this.frequency=new FakeParam();this.playbackRate=new FakeParam();this.gain=new FakeParam();this.starts=0;this.stops=0;}
 connect(){return this;}
 disconnect(){}
 start(){this.starts++;}
 stop(){this.stops++;}
}
class FakeAudioContext{
 constructor(){this.state='running';this.currentTime=1;this.sampleRate=8000;this.destination=new FakeNode();this.oscillators=[];}
 createOscillator(){const node=new FakeNode();this.oscillators.push(node);return node;}
 createGain(){return new FakeNode();}
 createBiquadFilter(){const node=new FakeNode();node.frequency=new FakeParam();return node;}
 createBufferSource(){return new FakeNode();}
 createBuffer(_channels,length){return {getChannelData:()=>new Float32Array(length)};}
}

test('Faltan buffers: los SFX usan sintesis local y la musica de lobby se detiene',async()=>{
 const oldWindow=globalThis.window,oldCtx=audio.ctx,oldBuffers=audio.buffers,oldManifest=audio.soundManifest;
 try{
  globalThis.window={AudioContext:FakeAudioContext};
  audio.ctx=null;audio.buffers=new Map();audio.soundManifest={};
  await audio.init();
  const ctx=audio.ctx;
  for(const name of ['shoot','reload','hitmark','kill','ability','upgrade','alarm','footstep','jump','click','hover'])audio.play(name);
  assert.ok(ctx.oscillators.length>=11,'cada efecto debe generar al menos un tono sintetico');
  assert.ok(ctx.oscillators.every(node=>node.starts===1));
  audio.startLobbyMusic();
  assert.ok(audio.music);
  audio.stopLobbyMusic();
  assert.equal(audio.music,null);
  assert.equal(audio.musicTimer,null);
 }finally{
  audio.stopLobbyMusic();audio.ctx=oldCtx;audio.buffers=oldBuffers;audio.soundManifest=oldManifest;
  globalThis.window=oldWindow;
 }
});
