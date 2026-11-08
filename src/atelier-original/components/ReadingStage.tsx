import { AtelierAmbience } from './atelier/AtelierAmbience';
import React, { useEffect, useRef, useState } from 'react';
import type { PresentationState, PresentationView } from '../services/presentation';
import { AtelierScene, type ConversationPhase } from './atelier/AtelierScene';
import './ReadingStage.css';

interface ReadingStageProps {
  accountUid: string;
  extraControls?:React.ReactNode;
  chartTools?:React.ReactNode;
  presentation: PresentationState;
  phase: ConversationPhase;
  paused: boolean;
  onPause: (paused: boolean) => void;
  onView: (view: PresentationView) => void;
  chart: React.ReactNode;
  conversation: React.ReactNode;
}

export function ReadingStage({ chartTools, extraControls, accountUid, presentation, phase, paused, onPause, onView, chart, conversation }: ReadingStageProps) {
  const visual = useRef<HTMLDivElement>(null);
  const [inset,setInset]=useState({x:1,y:1});
  const [dragging,setDragging]=useState(false);
  const insetRef=useRef(inset);
  const drag=useRef<{pointer:number;clientX:number;clientY:number;x:number;y:number;rangeX:number;rangeY:number}|null>(null);
  const insetStorageKey=`${import.meta.env.VITE_APP_NAMESPACE ?? 'natally'}.inset-position.${accountUid}`;
  const clamp=(value:number)=>Math.max(0,Math.min(1,value));
  const place=(position:{x:number;y:number},save=true)=>{
    const next={x:clamp(position.x),y:clamp(position.y)};insetRef.current=next;setInset(next);
    if(save)try{localStorage.setItem(insetStorageKey,JSON.stringify(next));}catch{/* Position still works for this appointment. */}
  };
  useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem(insetStorageKey)||'null');place(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y)?saved:{x:1,y:1},false);}catch{place({x:1,y:1},false);}},[accountUid,insetStorageKey]);
  useEffect(()=>{const move=(event:Event)=>{
    const detail=(event as CustomEvent<{x:number;y:number;bounds?:{left:number;top:number;right:number;bottom:number}}>).detail;if(!Number.isFinite(detail?.x)||!Number.isFinite(detail?.y)||!visual.current||drag.current)return;
    const position=insetRef.current,rect=visual.current.getBoundingClientRect();
    const left=(12+position.x*(rect.width*.66-24))/rect.width,top=(8+position.y*(rect.height*.66-44))/rect.height;
    const bounds=detail.bounds||{left:detail.x-100,right:detail.x+100,top:detail.y-80,bottom:detail.y+80};
    if(bounds.right/2048>=left-.02&&bounds.left/2048<=left+.36&&bounds.bottom/1280>=top-.02&&bounds.top/1280<=top+.36)place({x:detail.x>1024?0:1,y:detail.bounds?(detail.y>640?0:1):position.y});
  };window.addEventListener('natally-atelier-shelf-focus',move);return()=>window.removeEventListener('natally-atelier-shelf-focus',move);},[accountUid]);
  const endDrag=(event:React.PointerEvent<HTMLButtonElement>)=>{
    if(!drag.current)return;drag.current=null;setDragging(false);
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    const snap=(value:number)=>value<.09?0:value>.91?1:value;
    place({x:snap(insetRef.current.x),y:snap(insetRef.current.y)});
  };
  const insetStyle={'--inset-left':`calc(${inset.x*66}% + ${12-inset.x*24}px)`,'--inset-top':`calc(${inset.y*66}% + ${8-inset.y*44}px)`} as React.CSSProperties;
  const chartPane = useRef<HTMLDivElement>(null);
  const roomPane = useRef<HTMLDivElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    chartPane.current?.removeAttribute('inert');
    roomPane.current?.toggleAttribute('inert', presentation.view !== 'atelier');
  }, [presentation.view]);
  const inRoom = presentation.view === 'atelier';
  return <section className="reading-stage" style={insetStyle} data-dragging={dragging} data-view={presentation.view} data-reduced-motion={reducedMotion} aria-label="A moment with Natally">
    <AtelierAmbience key={accountUid} view={presentation.view} phase={phase} />
    <div className="reading-stage__layout">
      <div className="reading-stage__visual" ref={visual}>
        <div className="reading-stage__pane reading-stage__room" data-active={inRoom}>
          <div ref={roomPane} className="reading-stage__content" aria-hidden={!inRoom}>
            <AtelierScene accountUid={accountUid} phase={phase} motionEnabled={!paused && !reducedMotion} sceneVisible />
          </div>
          {!inRoom && <button className="reading-stage__inset-focus" onClick={() => onView('atelier')} aria-label="Bring Natally's reading room into focus"><span>Natally <b>↗ Bring into focus</b></span></button>}
        </div>
        <div className="reading-stage__pane reading-stage__chart" data-active={!inRoom} data-chart-callout-boundary data-chart-inset={inRoom}>
          <div ref={chartPane} className="reading-stage__content">{chart}</div>
        </div>
        <button type="button" className="reading-stage__inset-handle" aria-label="Move inset card" title="Drag anywhere in the scene; release near an edge to dock. Arrow keys move; Home docks top left, End bottom right."
          onPointerDown={event=>{if(event.button!==0||!visual.current)return;const rect=visual.current.getBoundingClientRect();event.preventDefault();event.currentTarget.focus();event.currentTarget.setPointerCapture(event.pointerId);drag.current={pointer:event.pointerId,clientX:event.clientX,clientY:event.clientY,...insetRef.current,rangeX:Math.max(1,rect.width*.66-24),rangeY:Math.max(1,rect.height*.66-44)};setDragging(true);}}
          onPointerMove={event=>{const start=drag.current;if(!start||start.pointer!==event.pointerId)return;place({x:start.x+(event.clientX-start.clientX)/start.rangeX,y:start.y+(event.clientY-start.clientY)/start.rangeY},false);}}
          onPointerUp={endDrag} onPointerCancel={endDrag}
          onKeyDown={event=>{const step=event.shiftKey?.1:.025;const directions:Record<string,[number,number]>={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]};if(directions[event.key]){event.preventDefault();const [x,y]=directions[event.key];place({x:inset.x+x,y:inset.y+y});}else if(event.key==='Home'||event.key==='End'){event.preventDefault();place(event.key==='Home'?{x:0,y:0}:{x:1,y:1});}}}>⠿ <span>Move {inRoom?'chart':'Natally'}</span></button>
        <div className="reading-stage__view-note">Chart highlights follow Natally’s reading</div>
      </div>
      <div className="reading-stage__controls" role="group" aria-label="Reading view and motion">
        {extraControls}
        <button type="button" onClick={() => onView(inRoom ? 'chart' : 'atelier')}>{inRoom ? 'Your chart' : 'Reading room'}</button>
        <button type="button" aria-pressed={paused} onClick={() => onPause(!paused)}>{paused ? 'Resume motion' : 'Pause motion'}</button>
      </div>
      <div className="reading-stage__conversation">{conversation}</div>
    </div>
    {!inRoom && chartTools}
  </section>;
}
