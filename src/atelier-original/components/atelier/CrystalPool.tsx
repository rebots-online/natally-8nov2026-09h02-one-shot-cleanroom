import React, { useEffect, useId, useRef, useState } from 'react';
import { beginInteractionEpisode } from '../../services/interactionAnalytics';

/** Pointer wakes live in the ball's existing glass/hand mask. No new audio or inference. */
export function CrystalPool({ motionEnabled, analyticsEnabled = true }: { motionEnabled:boolean; analyticsEnabled?:boolean }) {
  const id=useId().replace(/:/g,'');
  const [wakes,setWakes]=useState<{id:number;x:number;y:number;angle:number}[]>([]);
  const [point,setPoint]=useState<{x:number;y:number}|null>(null);
  const last=useRef({at:0,x:1030,y:884});
  const serial=useRef(0);
  const episode = useRef<{ source:'pointer'|'touch'|'keyboard'; pointerId?:number; end:(outcome?:'completed'|'cancelled')=>void }|null>(null);
  const endEpisode = (outcome:'completed'|'cancelled'='completed') => {
    const current=episode.current;episode.current=null;current?.end(outcome);
  };
  const startEpisode = (source:'pointer'|'touch'|'keyboard', pointerId?:number) => {
    if(!analyticsEnabled||document.visibilityState==='hidden')return;
    if(episode.current?.source===source&&episode.current.pointerId===pointerId)return;
    endEpisode();
    episode.current={source,pointerId,end:beginInteractionEpisode('crystal_ball_interaction',{
      activity_kind:'room_play',response_mode:'no_response',entry_point:'scene_prop',object_kind:'crystal_ball',
      action:source==='keyboard'?'pulse':'caress',input_method:source,
    })};
  };
  useEffect(()=>{
    if(!analyticsEnabled)endEpisode('cancelled');
    const hidden=()=>{if(document.visibilityState==='hidden')endEpisode('cancelled');};
    const blur=()=>endEpisode('cancelled');
    document.addEventListener('visibilitychange',hidden);window.addEventListener('blur',blur);
    return()=>{endEpisode('cancelled');document.removeEventListener('visibilitychange',hidden);window.removeEventListener('blur',blur);};
  },[analyticsEnabled]);
  useEffect(()=>{if(!motionEnabled)setWakes([]);},[motionEnabled]);
  const stir=(event:React.PointerEvent<SVGCircleElement>)=>{
    const rect=event.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const x=(event.clientX-rect.left)/rect.width*2048,y=(event.clientY-rect.top)/rect.height*1280;
    if(Math.hypot(x-1030,y-884)>147){endEpisode();return;}
    if(event.isTrusted)startEpisode(event.pointerType==='touch'?'touch':'pointer',event.pointerId);
    const now=performance.now();if(now-last.current.at<65)return;
    const angle=Math.atan2(y-last.current.y,x-last.current.x)*180/Math.PI;
    last.current={at:now,x,y};setPoint({x,y});
    if(motionEnabled)setWakes(old=>[...old.slice(-11),{id:++serial.current,x,y,angle}]);
  };
  const pulse=()=>{setPoint({x:1030,y:884});if(motionEnabled)setWakes(old=>[...old.slice(-11),{id:++serial.current,x:1030,y:884,angle:0}]);};
  return <g className="crystal-pool" data-motion={motionEnabled?'running':'paused'}>
    <defs>
      <radialGradient id={id+'-touch'}><stop stopColor="#fff0df" stopOpacity=".48"/><stop offset=".3" stopColor="#7beaf5" stopOpacity=".23"/><stop offset="1" stopColor="#d49fff" stopOpacity="0"/></radialGradient>
      <filter id={id+'-refraction'} x="-70%" y="-70%" width="240%" height="240%"><feTurbulence type="fractalNoise" baseFrequency=".018" numOctaves="2" seed="12" result="texture"/><feDisplacementMap in="SourceGraphic" in2="texture" scale="8"/><feGaussianBlur stdDeviation=".6"/></filter>
    </defs>
    {point&&<circle cx={point.x} cy={point.y} r="94" fill={'url(#'+id+'-touch)'} className="crystal-pool__touch"/>}
    {wakes.map(wake=><g key={wake.id} transform={`translate(${wake.x} ${wake.y}) rotate(${wake.angle})`} pointerEvents="none">
      <g className="crystal-pool__wake" filter={'url(#'+id+'-refraction)'} onAnimationEnd={()=>setWakes(old=>old.filter(item=>item.id!==wake.id))}>
        <ellipse rx="17" ry="13" fill="none" stroke="#e4fdff" strokeWidth="1.5"/>
        <ellipse rx="12" ry="9" fill="none" stroke="#aa8cfc" strokeWidth="2.5"/>
        <path d="M-34 0C-10-29 25-23 25 0C25 19-5 23-6 7C-7-2 9-8 14 1" fill="none" stroke="#ffe3b4" strokeWidth="1.3"/>
      </g>
    </g>)}
    <circle cx="1030" cy="884" r="147" fill="transparent" className="crystal-pool__surface" role="button" tabIndex={0} aria-label="Stir the crystal ball" onPointerMove={stir} onPointerEnter={stir} onPointerLeave={()=>{endEpisode();setPoint(null);}} onPointerDown={stir} onPointerUp={()=>endEpisode()} onPointerCancel={()=>endEpisode('cancelled')} onFocus={()=>setPoint({x:1030,y:884})} onBlur={()=>{endEpisode('cancelled');setPoint(null);}} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();if(event.isTrusted)startEpisode('keyboard');pulse();}}} onKeyUp={event=>{if((event.key==='Enter'||event.key===' ')&&episode.current?.source==='keyboard')endEpisode();}}><title>Stir the cloudy glass</title></circle>
  </g>;
}
