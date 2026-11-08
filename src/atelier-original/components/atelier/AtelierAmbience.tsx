import React, { useEffect, useRef, useState } from 'react';
import type { PresentationView } from '../../services/presentation';
import type { ConversationPhase } from './AtelierScene';

export function AtelierAmbience({view,phase}:{view:PresentationView;phase:ConversationPhase}) {
  const enabled = true;
  const [playbackState,setPlaybackState]=useState<'waiting'|'preparing'|'playing'|'off'|'failed'>(enabled?'waiting':'off');
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const volume = 0.3;
  const engine=useRef<{context:AudioContext;master:GainNode;gains:GainNode[];sources:AudioBufferSourceNode[]}|null>(null);
  const generation=useRef(0);
  const settings=useRef({view,phase,volume,enabled});settings.current={view,phase,volume,enabled};
  const adjust=()=>{
    const audio=engine.current;if(!audio)return;
    const current=settings.current,now=audio.context.currentTime;
    audio.master.gain.cancelAndHoldAtTime(now);
    audio.master.gain.setTargetAtTime(current.enabled?current.volume*(current.phase==='speaking'?.16:1):0,now,.22);
    audio.gains.forEach((gain,index)=>{gain.gain.cancelAndHoldAtTime(now);gain.gain.setTargetAtTime((index===0)===(current.view==='atelier')?1:0,now,.65);});
  };
  const stop=()=>{generation.current++;const audio=engine.current;engine.current=null;if(audio){audio.context.onstatechange=null;audio.sources.forEach(source=>{try{source.stop();}catch{}});void audio.context.close().catch(()=>{});}setPlaybackState('off');setLoading(false);};
  useEffect(()=>{adjust();},[view,phase,volume,enabled]);
  useEffect(()=>{
    const activate=()=>{if(settings.current.enabled)void start();};
    const visibility=()=>{const audio=engine.current;if(document.hidden){if(audio)void audio.context.suspend().catch(()=>{});}else activate();};
    document.addEventListener('pointerdown',activate,true);
    document.addEventListener('keydown',activate,true);
    document.addEventListener('visibilitychange',visibility);
    activate();
    return()=>{document.removeEventListener('pointerdown',activate,true);document.removeEventListener('keydown',activate,true);document.removeEventListener('visibilitychange',visibility);stop();};
  },[]);
  const start=async()=>{
    if(!settings.current.enabled||document.hidden)return;
    if(engine.current){try{await engine.current.context.resume();}catch{setError('Tap to resume the soundscape.');}return;}
    const ticket=++generation.current;setError('');setLoading(true);setPlaybackState('waiting');
    try{
      const context=new AudioContext(),master=context.createGain();master.gain.value=0;master.connect(context.destination);
      const audio={context,master,gains:[] as GainNode[],sources:[] as AudioBufferSourceNode[]};engine.current=audio;
      context.onstatechange=()=>{if(ticket===generation.current)setPlaybackState(context.state==='running'?(audio.sources.length?'playing':'preparing'):'waiting');};
      await context.resume();
      if(ticket!==generation.current)return;
      setPlaybackState('preparing');
      const buffers=await Promise.all(['workshop-ambience','chart-ambience'].map(async name=>{const response=await fetch('/atelier/audio/'+name+'.mp3');if(!response.ok)throw new Error('The soundscape could not load.');return context.decodeAudioData(await response.arrayBuffer());}));
      if(ticket!==generation.current)return;
      buffers.forEach((buffer,index)=>{const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;source.loop=true;gain.gain.value=(index===0)===(settings.current.view==='atelier')?1:0;source.connect(gain);gain.connect(master);source.start();audio.sources.push(source);audio.gains.push(gain);});
      adjust();setPlaybackState(context.state==='running'?'playing':'waiting');setLoading(false);
      if(document.hidden)await context.suspend();
    }catch{if(ticket!==generation.current)return;stop();setPlaybackState('failed');setError('Ambience could not start. Tap to retry.');}
  };
  return error ? <div className="atelier-ambience" role="status">{error} <button type="button" onClick={()=>void start()}>Resume room sound</button></div> : null;
}
