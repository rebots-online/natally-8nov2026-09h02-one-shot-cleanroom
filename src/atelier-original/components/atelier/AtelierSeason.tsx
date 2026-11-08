import React, { useEffect, useId, useRef, useState } from 'react';
import { playAtelierCrunch, unlockAtelierSound } from '../../services/atelierSound';
import type { AtelierTheme } from '../../services/atelierTheme';
const FRESH_COOKIES=[{x:1340,y:1110,bites:0},{x:1620,y:1125,bites:0},{x:1900,y:1100,bites:0}];
/** Seasonal set dressing occupies its own layer; it never resets the room's belongings. */
export function AtelierSeason({theme,accountUid}:{theme:AtelierTheme;accountUid:string|null}) {
  const id=useId().replace(/:/g,'');
  const [cookies,setCookies]=useState(()=>FRESH_COOKIES.map(cookie=>({...cookie})));
  const [held,setHeld]=useState<number|null>(null);
  const [announcement,setAnnouncement]=useState('');
  const inspection=useRef<HTMLDivElement|null>(null);
  const cookieControls=useRef<HTMLDivElement|null>(null);
  const [inspectionStyle,setInspectionStyle]=useState<React.CSSProperties|undefined>(undefined);
  const drag=useRef<{index:number;x:number;y:number;startX:number;startY:number;scaleX:number;scaleY:number;moved:boolean}|null>(null);
  useEffect(()=>{setCookies(FRESH_COOKIES.map(cookie=>({...cookie})));setHeld(null);},[accountUid]);
  useEffect(()=>{
    // Let the parent restore its saved inset and install its shelf-focus listener first.
    const requestSpace=()=>{
      const controls=cookieControls.current,composition=controls?.closest('.atelier-scene__composition');
      if(!controls||!composition)return;
      const room=composition.getBoundingClientRect(),boxes=Array.from(controls.querySelectorAll('.atelier-cookie-sign,.atelier-cookie-hit')).map(element=>element.getBoundingClientRect());
      if(!room.width||!room.height||!boxes.length)return;
      const left=(Math.min(...boxes.map(box=>box.left))-room.left)/room.width*2048,right=(Math.max(...boxes.map(box=>box.right))-room.left)/room.width*2048;
      const top=(Math.min(...boxes.map(box=>box.top))-room.top)/room.height*1280,bottom=(Math.max(...boxes.map(box=>box.bottom))-room.top)/room.height*1280;
      window.dispatchEvent(new CustomEvent('natally-atelier-shelf-focus',{detail:{x:(left+right)/2,y:(top+bottom)/2,bounds:{left,right,top,bottom}}}));
    };
    const frame=requestAnimationFrame(requestSpace),controls=cookieControls.current,composition=controls?.closest('.atelier-scene__composition');
    const resize=new ResizeObserver(requestSpace);if(composition)resize.observe(composition);
    const parentFrame=composition?.closest('.marketing-frame,.reading-stage'),stage=parentFrame?.querySelector('.marketing-frame__stage')||parentFrame;
    parentFrame?.addEventListener('transitionend',requestSpace);
    const changes=new MutationObserver(requestSpace);
    if(stage)changes.observe(stage,{childList:true,attributes:true,attributeFilter:['data-view']});
    if(controls)changes.observe(controls,{subtree:true,childList:true,attributes:true,attributeFilter:['style']});
    return()=>{cancelAnimationFrame(frame);resize.disconnect();changes.disconnect();parentFrame?.removeEventListener('transitionend',requestSpace);};
  },[theme,accountUid]);
  useEffect(()=>{
    if(held===null){setInspectionStyle(undefined);return;}
    const popup=inspection.current,composition=popup?.closest('.atelier-scene__composition');
    if(!popup||!composition)return;
    let fitFrame=0;
    const fitPopup=()=>{
      fitFrame=0;
      const frame=composition.closest('.marketing-frame,.reading-stage');
      const roomPane=composition.closest('.marketing-frame__pane,.reading-stage__pane');
      if(!frame||frame.matches('[data-dragging="true"]')||frame.querySelector('[data-dragging="true"]')||roomPane?.getAttribute('data-active')!=='true')return;
      const handle=frame.querySelector<HTMLElement>('.marketing-frame__inset-handle,.reading-stage__inset-handle');
      const pane=frame.querySelector<HTMLElement>('.marketing-frame__pane[data-active="false"]:not([hidden]),.reading-stage__pane[data-active="false"]');
      if(!handle||!pane)return;
      const room=composition.getBoundingClientRect(),card=pane.getBoundingClientRect(),bar=handle.getBoundingClientRect(),bounds=popup.getBoundingClientRect();
      const inset={left:Math.min(card.left,bar.left),right:Math.max(card.right,bar.right),top:Math.min(card.top,bar.top),bottom:Math.max(card.bottom,bar.bottom)};
      if(!room.width||!room.height)return;
      const overlaps=!(bounds.right+8<=inset.left||bounds.left-8>=inset.right||bounds.bottom+8<=inset.top||bounds.top-8>=inset.bottom);
      const outside=bounds.left<room.left+8||bounds.right>room.right-8||bounds.top<room.top+8||bounds.bottom>room.bottom-8;
      if(!overlaps&&!outside)return;
      const leftSpace=Math.max(0,inset.left-room.left-16),rightSpace=Math.max(0,room.right-inset.right-16),onRight=rightSpace>=leftSpace;
      const scaleX=room.width/(composition as HTMLElement).offsetWidth,scaleY=room.height/(composition as HTMLElement).offsetHeight;
      if(!scaleX||!scaleY)return;
      const available=onRight?rightSpace:leftSpace;
      if(!available)return;
      const next:React.CSSProperties={left:(onRight?(inset.right-room.left+8):8)/room.width*100+'%',bottom:8/scaleY+'px',transform:'none',maxWidth:available/scaleX+'px',maxHeight:Math.max(44,(room.height-16)/scaleY)+'px',overflowY:'auto',boxSizing:'border-box'};
      setInspectionStyle(previous=>JSON.stringify(previous)===JSON.stringify(next)?previous:next);
    };
    const requestSpace=()=>{
      const bounds=popup.getBoundingClientRect(),room=composition.getBoundingClientRect();
      if(!room.width||!room.height)return;
      const left=(bounds.left-room.left)/room.width*2048,right=(bounds.right-room.left)/room.width*2048;
      const top=(bounds.top-room.top)/room.height*1280,bottom=(bounds.bottom-room.top)/room.height*1280;
      window.dispatchEvent(new CustomEvent('natally-atelier-shelf-focus',{detail:{x:(left+right)/2,y:(top+bottom)/2,bounds:{left,right,top,bottom}}}));
      cancelAnimationFrame(fitFrame);fitFrame=requestAnimationFrame(fitPopup);
    };
    const frame=requestAnimationFrame(requestSpace),observer=new ResizeObserver(requestSpace);observer.observe(popup);observer.observe(composition);
    const parentFrame=composition.closest('.marketing-frame,.reading-stage');parentFrame?.addEventListener('transitionend',requestSpace);
    const placement=new MutationObserver(requestSpace),stage=parentFrame?.querySelector('.marketing-frame__stage')||parentFrame;
    if(stage)placement.observe(stage,{attributes:true,attributeFilter:['style','data-dragging','data-view']});
    return()=>{cancelAnimationFrame(frame);cancelAnimationFrame(fitFrame);observer.disconnect();placement.disconnect();parentFrame?.removeEventListener('transitionend',requestSpace);};
  },[held,theme,accountUid]);
  const halloween=theme==='horrorween', christmas=theme==='christmas';
  const cookieName=halloween?'Pumpkin cookie':christmas?'Xmas cookie':'Chocolate chip cookie';
  const sign=halloween?'FREE HALLOWEEN COOKIES':christmas?'FREE XMAS COOKIES':'FREE COOKIES';
  const bite=()=>{if(held===null)return;playAtelierCrunch();const bites=cookies[held].bites+1;setCookies(previous=>previous.map((cookie,index)=>index===held?{...cookie,bites}:cookie));setAnnouncement(bites===4?'The last bite. Just a few crumbs.':`Crunch. ${4-bites} bites left.`);if(bites===4)setHeld(null);};
  return <>
    <svg className="atelier-season" viewBox="0 0 2048 1280" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={id+'-pumpkin'}><stop stopColor="#f7b23c"/><stop offset=".55" stopColor="#b85416"/><stop offset="1" stopColor="#44200e"/></radialGradient>
        <radialGradient id={id+'-lantern'}><stop stopColor="#ffb63a" stopOpacity=".6"/><stop offset="1" stopColor="#ff9420" stopOpacity="0"/></radialGradient>
        {cookies.map((cookie,index)=><mask key={index} id={id+'-cookie-'+index}><circle r="43" fill="white"/>{Array.from({length:cookie.bites},(_,biteIndex)=><g key={biteIndex} transform={'rotate('+biteIndex*85+')'} fill="black"><circle cx="35" cy="-24" r="25"/><circle cx="13" cy="-39" r="13"/><circle cx="44" cy="-4" r="14"/></g>)}</mask>)}
      </defs>
      {halloween&&[false,true].map(right=><g key={String(right)} transform={right?'translate(2048 0) scale(-1 1)':undefined} fill="none" stroke="#dfd4d5" strokeWidth="1.8" opacity=".64"><path d="M38 45L460 44M38 45L410 190M38 45L302 323M38 45L155 385M38 45L37 423"/>{[.25,.5,.75,1].map(scale=><path key={scale} transform={'translate(38 45) scale('+scale+')'} d="M422 0Q342 40 372 145Q278 132 264 278Q153 212 117 340Q43 276-1 378"/>)}<path d="M240 120V262"/><ellipse cx="240" cy="270" rx="9" ry="12" fill="#342431" stroke="#ad9da9"/><path d="M234 264L221 253M246 264L259 253M231 272L217 274M249 272L263 274M234 278L222 291M246 278L259 291"/></g>)}
      {halloween&&[[220,1020,1],[1840,915,.8]].map(([x,y,scale])=><g key={x} transform={'translate('+x+' '+y+') scale('+scale+')'}>
        <ellipse className="atelier-pumpkin-light" rx="180" ry="150" fill={'url(#'+id+'-lantern)'}/>
        <ellipse cy="73" rx="93" ry="15" fill="#140906" opacity=".8"/>
        <path d="M-5-57Q-16-86 7-91L20-83Q3-77 12-58" fill="#786138" stroke="#302d14" strokeWidth="4"/>
        <ellipse rx="89" ry="70" fill={'url(#'+id+'-pumpkin)'} stroke="#632811" strokeWidth="3"/>
        <g fill="none" stroke="#6f2a0b" strokeWidth="3" opacity=".5"><ellipse rx="58" ry="70"/><ellipse rx="28" ry="70"/></g>
        <g className="atelier-pumpkin-face" fill="#ffdc76" stroke="#4e220c" strokeWidth="5"><path d="M-61-10L-22-24L-31 8ZM61-10L22-24L31 8ZM-11 16L0-2L11 16Z"/><path d="M-56 29L-23 39L-18 29L0 44L20 29L26 39L56 29Q29 78 0 61Q-29 78-56 29Z"/></g>
      </g>)}
      <ellipse cx="1620" cy="1149" rx="354" ry="40" fill="#573a38" stroke="#d3a16e" strokeWidth="5"/>
      {cookies.map((cookie,index)=><g key={index} transform={'translate('+cookie.x+' '+cookie.y+')'} className="atelier-cookie" data-held={held===index}>
        {cookie.bites<4?<g mask={'url(#'+id+'-cookie-'+index+')'}><circle r="43" fill="#a95022" stroke="#e0a356" strokeWidth="6"/><circle r="35" fill="#e9b579" stroke="#d58441" strokeWidth="4"/>{halloween?<path d="M-25-8L-13-23L-5-7ZM25-8L13-23L5-7ZM-23 12Q0 33 23 12L12 14L8 7L-2 18L-12 7L-14 14Z" fill="#583226"/>:christmas?<g stroke="#fff4dc" strokeWidth="6" strokeLinecap="round"><path d="M0-27V27M-24-14L24 14M-24 14L24-14"/><circle r="5" fill="#bb3933" stroke="none"/></g>:<g fill="#5b3024"><circle cx="-14" cy="-13" r="6"/><circle cx="15" cy="-8" r="5"/><circle cx="-6" cy="14" r="6"/><circle cx="20" cy="19" r="4"/></g>}<circle cx="-26" cy="22" r="3" fill="#9f652b"/></g>:<g fill="#e7ae67"><circle cx="-9" cy="22" r="4"/><circle cx="12" cy="18" r="3"/><circle cx="1" cy="27" r="2"/></g>}
      </g>)}
    </svg>
    <div ref={cookieControls} className="atelier-cookie-controls">
      <div className="atelier-cookie-sign"><strong>{sign}</strong><span>Tap a cookie · take a bite</span></div>
      {cookies.map((cookie,index)=>cookie.bites<4&&<button key={index} type="button" className="atelier-cookie-hit"
        style={{left:cookie.x/2048*100+'%',top:cookie.y/1280*100+'%'}}
        aria-label={cookieName+' '+(index+1)+', '+(4-cookie.bites)+' bites left. Pick up'}
        onClick={()=>setHeld(index)}
        onPointerDown={event=>{
          if(event.button!==0)return;
          unlockAtelierSound();
          const rect=event.currentTarget.parentElement!.getBoundingClientRect();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current={index,x:event.clientX,y:event.clientY,startX:cookie.x,startY:cookie.y,scaleX:2048/rect.width,scaleY:1280/rect.height,moved:false};
        }}
        onPointerMove={event=>{
          const d=drag.current;if(!d||d.index!==index)return;
          // A resting finger must not move the target before its tap completes.
          if(!d.moved&&Math.hypot(event.clientX-d.x,event.clientY-d.y)<6)return;
          d.moved=true;setHeld(index);
          const x=Math.max(65,Math.min(1983,d.startX+(event.clientX-d.x)*d.scaleX)),y=Math.max(120,Math.min(1170,d.startY+(event.clientY-d.y)*d.scaleY));
          setCookies(previous=>previous.map((item,i)=>i===index?{...item,x,y}:item));
        }}
        onPointerUp={event=>{
          if(drag.current?.index===index)setHeld(index);
          drag.current=null;
          if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={()=>{drag.current=null;}}
        onKeyDown={event=>{
          if(event.key==='Escape'){setHeld(null);return;}
          const direction:Record<string,[number,number]>={ArrowLeft:[-30,0],ArrowRight:[30,0],ArrowUp:[0,-30],ArrowDown:[0,30]};
          const offset=direction[event.key];if(!offset)return;
          event.preventDefault();setHeld(index);
          setCookies(previous=>previous.map((item,i)=>i===index?{...item,x:Math.max(65,Math.min(1983,item.x+offset[0])),y:Math.max(120,Math.min(1170,item.y+offset[1]))}:item));
        }}><span aria-hidden="true">✧</span></button>)}
    </div>
    {held!==null&&<div ref={inspection} style={inspectionStyle} className="atelier-cookie-inspection" role="group" aria-label={cookieName}><span>{4-cookies[held].bites} bites left</span><button type="button" onClick={bite}>Take a bite</button><button type="button" onClick={()=>{const index=held;setCookies(previous=>previous.map((cookie,i)=>i===index?{...cookie,x:FRESH_COOKIES[i].x,y:FRESH_COOKIES[i].y}:cookie));setHeld(null);}}>Put on plate</button></div>}
    <span className="atelier-visually-hidden" role="status">{announcement}</span>
  </>;
}
