import { CrystalPool } from './CrystalPool';
import React, { useEffect, useId, useRef, useState } from 'react';
import type { ConversationPhase } from './AtelierScene';
import { playAtelierBreak, playAtelierWobble, unlockAtelierSound, getAtelierAudioStatus, subscribeAtelierAudioStatus } from '../../services/atelierSound';
import { LEFT_HAND_PATH, RIGHT_HAND_PATH } from './AtelierCharacter';
import { isAtelierRehearsal, getAtelierMemory, breakAtelierObject, placeAtelierObjects, type TrinketId } from '../../services/atelierMemories';
import { beginInteractionEpisode, trackInteraction } from '../../services/interactionAnalytics';

type PlayInput = { method:'pointer'|'touch'|'keyboard'|'unknown'; trusted:boolean };

/** Coordinates follow the bundled room artwork, in a shared 2048 × 1280 frame. */
const ITEMS: {id:TrinketId;label:string;x:number;y:number;base:number;radius:number}[] = [{id:'hourglass',label:'Hourglass',x:410,y:712,base:81,radius:44},{id:'armillary',label:'Brass armillary',x:1610,y:705,base:87,radius:62},{id:'crystal',label:'Violet crystal',x:510,y:735,base:55,radius:32},{id:'emerald',label:'Green crystal',x:260,y:1000,base:55,radius:32},{id:'rose',label:'Rose crystal',x:390,y:1000,base:55,radius:32},{id:'vial',label:'Little potion vial',x:1510,y:740,base:50,radius:34}];

const SHELVES = [
  {id:'bookcase-top-left',label:'Top of left bookcase',left:80,right:650,y:345},
  {id:'bookcase-top-right',label:'Top of right bookcase',left:1390,right:1965,y:345},
  {id:'upper-left',label:'Upper left shelf',left:80,right:650,y:583},
  {id:'middle-left',label:'Middle left shelf',left:80,right:650,y:793},
  {id:'lower-left',label:'Lower left shelf',left:90,right:620,y:985},
  {id:'upper-right',label:'Upper right shelf',left:1390,right:1965,y:583},
  {id:'middle-right',label:'Middle right shelf',left:1390,right:1965,y:793},
  {id:'lower-right',label:'Lower right shelf',left:1390,right:1965,y:985},
];
type Shelf = typeof SHELVES[number];
const nearestShelf=(item:typeof ITEMS[number],point:{x:number;y:number}):Shelf=>SHELVES.reduce((nearest,shelf)=>{
  const distance=(s:Shelf)=>Math.hypot(point.x-Math.max(s.left+item.radius,Math.min(s.right-item.radius,point.x)),point.y+item.base-s.y);
  return distance(shelf)<distance(nearest)?shelf:nearest;
});

function ShelfObject({ item, broken, taped, active, resonance, offset, picked, children }: { item: typeof ITEMS[number]; broken:boolean;taped:boolean;active:boolean;resonance:number;offset:{x:number;y:number};picked:boolean;children:React.ReactNode }) {
  return <g transform={'translate(' + (item.x+offset.x) + ' ' + (item.y+offset.y) + ')'} data-item={item.id} data-broken={broken} data-taped={taped} data-active={active} data-picked={picked} className="atelier-shelf-object" style={{'--resonance': Math.min(9,2+resonance*1.5) + 'deg'} as React.CSSProperties}>
    {picked && <ellipse className="atelier-lift-shadow" cy={item.base+14} rx={item.radius*1.25} ry="15" fill="#0b0611" opacity=".45"/>}
    <g className="atelier-object-intact">{children}{taped && <g className="atelier-clumsy-tape" fill="#e9d6a7" stroke="#806b49" strokeWidth="1.4">
      {[-27,-8,12,31].map((y,index)=><g key={y} transform={'translate(0 '+y+') rotate('+(index%2?6:-5)+')'}><path d="M-33-8Q0-1 33-8L35 7Q0 18-35 7Z"/><path d="M-33-8Q-41-3-35 7L-28 10L-29-5ZM33-8Q41-2 35 7L28 10L29-5Z" fill="#b6a078"/><path d="M-27-4Q0 2 27-4M-27 5Q0 12 27 5" fill="none" stroke="#fff1cb" strokeWidth="2"/><path d="M-15-3L-11 7M8-2L12 8" fill="none" stroke="#bca77b" strokeWidth="1"/></g>)}
      <path d="M18 28L34 25L42 48L32 44L26 52Z" fill="#f4e5bd"/><path d="M19 28L33 32L34 25Z" fill="#ad976e"/>
    </g>}</g>
    {broken && <g className="atelier-object-shards" transform={item.id==='vial'||['crystal','emerald','rose'].includes(item.id)?'translate(0 -25)':undefined} fill={['crystal','emerald','rose'].includes(item.id)?'#c09ae4':item.id==='vial'?'#94cdbd':'#c99c5c'} stroke="#f3dec6" strokeWidth="1"><path d="M-39 73L-20 58L-11 78Z"/><path d="M-8 78L4 56L19 78Z"/><path d="M26 80L29 65L47 77Z"/><path d="M-20 83L-3 75L10 84Z"/><path d="M12 85L22 75L32 85Z"/></g>}
  </g>;
}

export function AtelierTrinkets({ motionEnabled, phase, characterReady = false, accountUid = null }: { motionEnabled: boolean; phase: ConversationPhase; characterReady?: boolean; accountUid?: string | null }) {
  const [memory, setMemory] = useState(()=>getAtelierMemory(accountUid));
  const {broken,taped,persistenceAvailable}=memory;
  const [active, setActive] = useState<TrinketId|null>(null);
  const [picked, setPicked] = useState<TrinketId|null>(null);
  const [offsets,setOffsets] = useState<Partial<Record<TrinketId,{x:number;y:number}>>>({});
  const [resonance, setResonance] = useState(0);
  const impulses = useRef<Partial<Record<TrinketId,{count:number;at:number;x:number;y:number}>>>({});
  const offsetsRef=useRef(offsets);offsetsRef.current=offsets;
  const [landing,setLanding]=useState<string|null>(null);
  const [soundMuted,setSoundMuted]=useState(()=>{try{return localStorage.getItem('natally.atelier.sound-muted')==='true';}catch{return false;}});
  const [soundStatus,setSoundStatus]=useState(getAtelierAudioStatus);
  useEffect(()=>subscribeAtelierAudioStatus(setSoundStatus),[]);
  const drag = useRef<{moved:boolean;item:TrinketId;x:number;y:number;startX:number;startY:number;scaleX:number;scaleY:number;input:PlayInput}|null>(null);
  const playEpisodes=useRef<Partial<Record<'nudge'|'drag',{item:TrinketId;end:(outcome?:'completed'|'cancelled')=>void}>>>({});
  const controlInputMethod=useRef<PlayInput['method']>('unknown');
  const pointerInput=(event:React.PointerEvent):PlayInput=>({method:event.pointerType==='touch'?'touch':'pointer',trusted:event.isTrusted});
  const keyInput=(event:React.KeyboardEvent):PlayInput=>({method:'keyboard',trusted:event.isTrusted});
  const controlInput=(event:React.SyntheticEvent):PlayInput=>{
    const pointerType=(event.nativeEvent as PointerEvent).pointerType;
    return{method:pointerType==='touch'?'touch':pointerType==='mouse'||pointerType==='pen'?'pointer':controlInputMethod.current,trusted:event.isTrusted};
  };
  const canObserve=(input:PlayInput)=>input.trusted&&!isAtelierRehearsal(accountUid)&&document.visibilityState!=='hidden';
  const playFields=(item:TrinketId,input:PlayInput)=>({activity_kind:'room_play',response_mode:'no_response',entry_point:'scene_prop',object_kind:item,input_method:input.method});
  const endPlayEpisode=(kind:'nudge'|'drag',outcome:'completed'|'cancelled'='completed')=>{
    const episode=playEpisodes.current[kind];delete playEpisodes.current[kind];episode?.end(outcome);
  };
  const endPlayEpisodes=(outcome:'completed'|'cancelled'='cancelled')=>{endPlayEpisode('nudge',outcome);endPlayEpisode('drag',outcome);};
  const beginPlayEpisode=(kind:'nudge'|'drag',item:TrinketId,input:PlayInput)=>{
    if(!canObserve(input))return;
    if(playEpisodes.current[kind]?.item===item)return;
    endPlayEpisode(kind);
    playEpisodes.current[kind]={item,end:beginInteractionEpisode('trinket_interaction',{...playFields(item,input),action:kind})};
  };
  const trackPlay=(action:'pointer_entry'|'pickup'|'drop'|'break',item:TrinketId,input:PlayInput)=>{
    if(canObserve(input))trackInteraction(action==='break'?'trinket_break':'trinket_interaction',{...playFields(item,input),action});
  };
  useEffect(()=>{
    const hidden=()=>{if(document.visibilityState==='hidden')endPlayEpisodes();};
    const blur=()=>endPlayEpisodes();
    document.addEventListener('visibilitychange',hidden);window.addEventListener('blur',blur);
    return()=>{endPlayEpisodes();document.removeEventListener('visibilitychange',hidden);window.removeEventListener('blur',blur);};
  },[accountUid]);
  useEffect(() => {
    setMemory(getAtelierMemory(accountUid));setActive(null);setPicked(null);setOffsets(Object.fromEntries(ITEMS.map(item=>{const position=getAtelierMemory(accountUid).placements[item.id];return[item.id,position?{x:position.x-item.x,y:position.y-item.y}:{x:0,y:0}];})));setLanding(null);impulses.current={};
    const update=(event:Event)=>{if((event as CustomEvent<{uid:string|null}>).detail.uid!==accountUid)return;if(isAtelierRehearsal(accountUid))endPlayEpisodes();const state=getAtelierMemory(accountUid);setMemory({...state});const next=Object.fromEntries(ITEMS.map(item=>{const position=state.placements[item.id];return[item.id,position?{x:position.x-item.x,y:position.y-item.y}:{x:0,y:0}];}));offsetsRef.current=next;setOffsets(next);};
    window.addEventListener('natally-atelier-history-changed',update);
    return()=>{window.removeEventListener('natally-atelier-history-changed',update);};
  }, [accountUid]);
  const positionOf=(item:typeof ITEMS[number],values=offsetsRef.current)=>({x:item.x+(values[item.id]?.x||0),y:item.y+(values[item.id]?.y||0)});
  const shatter=(ids:TrinketId[],input:PlayInput)=>{
    const fresh=ids.filter(item=>!getAtelierMemory(accountUid).broken.includes(item));if(!fresh.length)return;
    const changed:TrinketId[]=[];for(const item of fresh){const state=breakAtelierObject(accountUid,item);setMemory({...state});if(state.broken.includes(item))changed.push(item);}
    if(!changed.length)return;endPlayEpisodes('completed');for(const item of changed)trackPlay('break',item,input);const point=positionOf(ITEMS.find(item=>item.id===changed[0])!);playAtelierBreak(changed[0]);setPicked(null);drag.current=null;window.dispatchEvent(new CustomEvent('natally-atelier-mishap',{detail:{durationMs:3200,itemId:changed[0],x:point.x,y:point.y,brokenCount:getAtelierMemory(accountUid).broken.length}}));
  };
  const dropOnShelf=(itemId:TrinketId,specifiedShelf:Shelf|undefined,input:PlayInput)=>{
    endPlayEpisode('drag');
    const item=ITEMS.find(candidate=>candidate.id===itemId)!;const point=positionOf(item);const shelf=specifiedShelf||nearestShelf(item,point);
    const next={...offsetsRef.current};const x=Math.max(shelf.left+item.radius,Math.min(shelf.right-item.radius,point.x));next[itemId]={x:x-item.x,y:shelf.y-item.base-item.y};
    const fallen:TrinketId[]=[];const bumped:TrinketId[]=[];const queue:TrinketId[]=[itemId];const visited=new Set<TrinketId>();
    // Resolve a short chain of real neighbouring movable objects, preserving the placed object.
    while(queue.length){const sourceId=queue.shift()!;if(visited.has(sourceId))continue;visited.add(sourceId);const source=ITEMS.find(candidate=>candidate.id===sourceId)!;const sourcePoint=positionOf(source,next);
      for(const neighbour of ITEMS){if(neighbour.id===sourceId||neighbour.id===itemId||broken.includes(neighbour.id)||fallen.includes(neighbour.id))continue;const other=positionOf(neighbour,next);if(Math.abs(other.y+neighbour.base-shelf.y)>24)continue;const spacing=source.radius+neighbour.radius+9;const overlap=spacing-Math.abs(other.x-sourcePoint.x);if(overlap<=0)continue;
        const direction=other.x>=sourcePoint.x?1:-1;const pushed=other.x+direction*(overlap+3);next[neighbour.id]={x:pushed-neighbour.x,y:shelf.y-neighbour.base-neighbour.y};bumped.push(neighbour.id);
        if(pushed-neighbour.radius<shelf.left||pushed+neighbour.radius>shelf.right)fallen.push(neighbour.id);else queue.push(neighbour.id);
      }
    }
    window.dispatchEvent(new CustomEvent('natally-atelier-shelf-focus',{detail:{x,y:shelf.y}}));
    offsetsRef.current=next;setOffsets(next);setPicked(null);setLanding(null);drag.current=null;
    const placements=Object.fromEntries(ITEMS.map(object=>[object.id,positionOf(object,next)]));setMemory({...placeAtelierObjects(accountUid,placements)});
    trackPlay('drop',itemId,input);
    if(bumped.length){setActive(bumped[0]);setResonance(5);}else setActive(itemId);
    if(fallen.length)shatter(fallen,input);else playAtelierWobble(itemId,bumped.length?4:1.5);
  };
  const putBack=(input:PlayInput)=>{if(picked)dropOnShelf(picked,undefined,input);};
  const nudge = (item:TrinketId,event:React.PointerEvent<HTMLButtonElement>,entering=false) => {
    setActive(item);if(broken.includes(item)||picked||!motionEnabled||event.pointerType==='touch')return;
    const now=performance.now(),previous=impulses.current[item];
    const distance=previous?Math.hypot(event.clientX-previous.x,event.clientY-previous.y):0;
    // Real pointer travel adds energy; elapsed time dissipates it. Resting the
    // pointer never creates impulses or causes an unattended object to break.
    if(!entering&&distance<1)return;
    beginPlayEpisode('nudge',item,pointerInput(event));
    const count=Math.max(0,(previous?.count||0)-(now-(previous?.at||now))/1800)+(entering?.45:Math.min(distance,18)/24);
    impulses.current[item]={count,at:now,x:event.clientX,y:event.clientY};setResonance(count*1.5);
    if(count>=4)shatter([item],pointerInput(event));else playAtelierWobble(item,count);
  };
  const beginDrag=(event:React.PointerEvent<HTMLButtonElement>,item:TrinketId)=>{
    unlockAtelierSound();if(broken.includes(item))return;
    endPlayEpisode('nudge');
    const input=pointerInput(event);trackPlay('pickup',item,input);
    const rect=event.currentTarget.parentElement!.getBoundingClientRect(),offset=offsetsRef.current[item]||{x:0,y:0};
    event.currentTarget.setPointerCapture(event.pointerId);setPicked(item);setActive(item);setLanding(nearestShelf(ITEMS.find(candidate=>candidate.id===item)!,positionOf(ITEMS.find(candidate=>candidate.id===item)!)).id);
    drag.current={moved:false,item,x:event.clientX,y:event.clientY,startX:offset.x,startY:offset.y,scaleX:2048/rect.width,scaleY:1280/rect.height,input};
  };
  const moveDrag=(event:React.PointerEvent<HTMLButtonElement>)=>{const d=drag.current;if(!d)return;const item=ITEMS.find(item=>item.id===d.item)!;d.moved ||= Math.hypot(event.clientX-d.x,event.clientY-d.y)>4;if(d.moved)beginPlayEpisode('drag',d.item,d.input);const offset={x:Math.max(65-item.x,Math.min(1983-item.x,d.startX+(event.clientX-d.x)*d.scaleX)),y:Math.max(100-item.y,Math.min(1130-item.y,d.startY+(event.clientY-d.y)*d.scaleY))};const next={...offsetsRef.current,[d.item]:offset};offsetsRef.current=next;setOffsets(next);setLanding(nearestShelf(item,positionOf(item,next)).id);};
  const endDrag=(event:React.PointerEvent<HTMLButtonElement>)=>{const d=drag.current;drag.current=null;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);endPlayEpisode('drag');if(d?.moved)dropOnShelf(d.item,undefined,d.input);};
  const moveByKey=(event:React.KeyboardEvent<HTMLButtonElement>,item:TrinketId)=>{
    if(event.key==='Escape'){event.preventDefault();putBack(keyInput(event));return;}if(picked!==item)return;
    if(event.key==='Enter'||event.key===' '){event.preventDefault();dropOnShelf(item,undefined,keyInput(event));return;}
    const directions:Record<string,[number,number]>={ArrowLeft:[-24,0],ArrowRight:[24,0],ArrowUp:[0,-24],ArrowDown:[0,24]};const direction=directions[event.key];if(!direction)return;event.preventDefault();const previous=offsetsRef.current;const object=ITEMS.find(candidate=>candidate.id===item)!;const offset={x:Math.max(65-object.x,Math.min(1983-object.x,(previous[item]?.x||0)+direction[0])),y:Math.max(100-object.y,Math.min(1130-object.y,(previous[item]?.y||0)+direction[1]))};if(offset.x!==(previous[item]?.x||0)||offset.y!==(previous[item]?.y||0))beginPlayEpisode('drag',item,keyInput(event));const next={...previous,[item]:offset};offsetsRef.current=next;setOffsets(next);setLanding(nearestShelf(object,positionOf(object,next)).id);
  };
  const itemProps = (id:TrinketId) => ({item:ITEMS.find(item=>item.id===id)!,broken:broken.includes(id),taped:taped.includes(id),active:active===id,resonance,offset:offsets[id]||{x:0,y:0},picked:picked===id});
  const id = useId().replace(/:/g, '');
  const ref = (name: string) => 'url(#' + id + '-' + name + ')';
  const candles = [[128,399,1],[620,395,0.9],[1427,397,1.04],[1909,397,0.92],[1575,962,0.9]];
  return <><svg className="atelier-trinkets" viewBox="0 0 2048 1280" data-motion={motionEnabled ? 'running' : 'paused'} data-phase={phase}>
    <defs>
      <filter id={id + '-scrying-wisps'} x="-30%" y="-30%" width="160%" height="160%"><feTurbulence type="fractalNoise" baseFrequency=".018 .035" numOctaves="2" seed="7" result="cloud-grain"/><feDisplacementMap in="SourceGraphic" in2="cloud-grain" scale="28" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation="2.2"/></filter>
      <filter id={id + '-scrying-depth'} x="-30%" y="-30%" width="160%" height="160%"><feTurbulence type="fractalNoise" baseFrequency=".012 .022" numOctaves="2" seed="19" result="cloud-grain"/><feDisplacementMap in="SourceGraphic" in2="cloud-grain" scale="40" xChannelSelector="G" yChannelSelector="R"/><feGaussianBlur stdDeviation="4"/></filter>
      <filter id={id + '-soft-shadow'} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9" /></filter>
      <clipPath id={id + '-shelf-light'}><path d="M0 300H690V1040H0ZM1370 300H2048V1100H1370ZM0 1110H2048V1280H0Z"/></clipPath>
      <linearGradient id={id + '-brass'} x1="0" x2="1"><stop stopColor="#44240c"/><stop offset=".2" stopColor="#d4a956"/><stop offset=".46" stopColor="#ffdda0"/><stop offset=".62" stopColor="#946124"/><stop offset=".85" stopColor="#c89544"/><stop offset="1" stopColor="#3d200c"/></linearGradient>
      <linearGradient id={id + '-sand'} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ffdf9f"/><stop offset="1" stopColor="#b98037"/></linearGradient>
      <radialGradient id={id + '-glow'}><stop stopColor="#ffd57a" stopOpacity=".6"/><stop offset=".4" stopColor="#ff9e39" stopOpacity=".19"/><stop offset="1" stopColor="#ffad50" stopOpacity="0"/></radialGradient>
      <radialGradient id={id + '-cloud'}><stop stopColor="#fff1e0" stopOpacity=".52"/><stop offset=".35" stopColor="#f5b7f9" stopOpacity=".33"/><stop offset=".75" stopColor="#875cd8" stopOpacity=".16"/><stop offset="1" stopColor="#a96aee" stopOpacity="0"/></radialGradient>
      <radialGradient id={id + '-phase'}><stop stopColor="#f7bfef" stopOpacity="0"/><stop offset=".6" stopColor="#d498ef" stopOpacity=".06"/><stop offset="1" stopColor="#d498ef" stopOpacity=".35"/></radialGradient>
      <linearGradient id={id + '-flame'} x1="0" y1="1" x2=".2" y2="0"><stop stopColor="#ff891c"/><stop offset=".3" stopColor="#fff6cf"/><stop offset=".75" stopColor="#fff3ba"/><stop offset="1" stopColor="#ffb34d" stopOpacity="0"/></linearGradient>
      <clipPath id={id + '-hourglass'}><path d="M-24-58 Q-28-29-5-3 Q-2 0-5 3 Q-28 29-24 58 L24 58 Q28 29 5 3 Q2 0 5-3 Q28-29 24-58Z"/></clipPath>
      <mask id={id + '-ball'}><circle cx="1030" cy="884" r="148" fill="white"/>{characterReady ? <><g className="atelier-ball-hand-mask--left"><path d={LEFT_HAND_PATH} fill="black"/></g><g className="atelier-ball-hand-mask--right"><path d={RIGHT_HAND_PATH} fill="black"/></g></> : <><path d="M859 735 Q928 689 1013 724 L1016 760 Q960 758 937 789 L885 813Z" fill="black"/><path d="M1164 960 Q1090 995 1080 1090 L1196 1100Z" fill="black"/></>}</mask>
    </defs>
    <g className="atelier-constellations" stroke="#ffe3a5" strokeWidth="1.2" fill="#fff5db" opacity=".64">
      <g className="atelier-constellations__left"><path d="M320 137L389 101L466 161L546 119L624 162" fill="none" strokeOpacity=".45"/>{[[320,137],[389,101],[466,161],[546,119],[624,162]].map(([x,y])=><circle key={x} cx={x} cy={y} r="2.5"/>)}</g>
      <g className="atelier-constellations__right"><path d="M1430 117L1510 162L1572 104L1680 139L1646 226L1510 162" fill="none" strokeOpacity=".4"/>{[[1430,117],[1510,162],[1572,104],[1680,139],[1646,226]].map(([x,y])=><circle key={x} cx={x} cy={y} r="2.5"/>)}</g>
    </g>
    {picked && <g className="atelier-shelf-guides">{SHELVES.map(shelf=><line key={shelf.id} x1={shelf.left} x2={shelf.right} y1={shelf.y} y2={shelf.y} data-landing={landing===shelf.id} />)}</g>}
    <ShelfObject {...itemProps('hourglass')}>
      <ellipse cy="81" rx="58" ry="8" fill="#140903" opacity=".65"/>
      <g clipPath={ref('hourglass')}><path d="M-30-60H30V60H-30Z" fill="#d6ddfa" opacity=".07"/>
        <path className="atelier-sand__upper" d="M-29-60H29V-18L0-2L-29-18Z" fill={ref('sand')}/>
        <path className="atelier-sand__lower" d="M-29 58L0 13L29 58Z" fill={ref('sand')}/>
        <path className="atelier-sand__stream" d="M0-4V58" stroke="#ffe4ad" strokeWidth="3" strokeDasharray="3 4"/>
      </g>
      <path d="M-24-58 Q-28-29-5-3 Q-2 0-5 3 Q-28 29-24 58 M24-58 Q28-29 5-3 Q2 0 5 3 Q28 29 24 58" stroke="#f3dba6" strokeOpacity=".55" strokeWidth="2" fill="none"/>
      <path d="M-16-49 Q-16-23-6-12 M-17 48Q-20 30-9 18" stroke="white" strokeOpacity=".3" strokeWidth="2" fill="none"/>
      <g fill={ref('brass')}><rect x="-37" y="-70" width="74" height="12" rx="4"/><rect x="-37" y="58" width="74" height="12" rx="4"/><rect x="-35" y="-59" width="6" height="118"/><rect x="29" y="-59" width="6" height="118"/><rect x="-42" y="69" width="84" height="6" rx="3"/></g>
    </ShelfObject>
    <ShelfObject {...itemProps('armillary')}>
      <ellipse cy="87" rx="69" ry="9" fill="#140903" opacity=".65"/>
      <path d="M-5 37H5L12 77H-12Z" fill={ref('brass')}/><ellipse cy="78" rx="34" ry="7" fill={ref('brass')}/>
      <g className="atelier-armillary" stroke={ref('brass')} strokeWidth="4" fill="none"><circle r="55"/><ellipse rx="26" ry="55" transform="rotate(32)"/><ellipse rx="55" ry="18" transform="rotate(-28)"/><path d="M-64 0H64M0-64V64" strokeWidth="2"/><circle r="9" fill={ref('brass')}/></g>
    </ShelfObject>
    <ShelfObject {...itemProps('crystal')}><ellipse cy="55" rx="37" ry="8" fill="#10090f" opacity=".6"/><path d="M0-55L29-10L19 53H-19L-29-10Z" fill="#9768bd" stroke="#ebc9ff" strokeWidth="2"/><path d="M0-55L8-10L0 53L-10-10Z" fill="#e2b9f3" opacity=".85"/><path d="M-29-10L8-10L19 53" fill="none" stroke="#e5caf6" strokeWidth="2"/></ShelfObject>
    {(['emerald','rose'] as const).map(gem=><ShelfObject key={gem} {...itemProps(gem)}><ellipse cy="55" rx="37" ry="8" fill="#10090f" opacity=".6"/><path d="M0-55L29-10L19 53H-19L-29-10Z" fill={gem==='emerald'?'#45b29a':'#d68eae'} stroke="#ffe7f1" strokeWidth="2"/><path d="M0-55L8-10L0 53L-10-10Z" fill="#fff3e1" opacity=".55"/></ShelfObject>)}
    <ShelfObject {...itemProps('vial')}><ellipse cy="50" rx="34" ry="7" fill="#10090a" opacity=".6"/><path d="M-10-42H10V-12Q39 7 27 40Q0 54-27 40Q-39 7-10-12Z" fill="#517f76" fillOpacity=".5" stroke="#d3c89f" strokeWidth="3"/><path d="M-27 15Q0 8 27 15V37Q0 48-27 37Z" fill="#80b7aa" opacity=".64"/><rect x="-14" y="-51" width="28" height="12" rx="3" fill={ref('brass')}/><path d="M-14-2Q-25 12-20 29" fill="none" stroke="#faf3cf" strokeWidth="3" opacity=".5"/></ShelfObject>
    <g clipPath={ref('shelf-light')}>
      {candles.map(([x,y,scale], index)=><g key={x} transform={'translate(' + x + ' ' + y + ') scale(' + scale + ')'} className={'atelier-candle-light atelier-candle-' + index}>
        <ellipse className="atelier-light-spill" cy="65" rx="210" ry="190" fill={ref('glow')} />
        <g className="atelier-object-shadow" filter={ref('soft-shadow')} fill="#140804" opacity=".34">
          <path d="M67 184L113-11L166-30L126 184Z"/><path d="M-36 185L-97 82L-119 88L-69 185Z"/>
          <ellipse cx="70" cy="195" rx="135" ry="12"/>
        </g>
      </g>)}
    </g>
    {candles.map(([x,y,scale], index)=><g key={x} transform={'translate(' + x + ' ' + y + ') scale(' + scale + ')'} className={'atelier-candle-' + index}>
      <ellipse className="atelier-flame-glow" cy="-6" rx="67" ry="84" fill={ref('glow')}/>
      <path className="atelier-flame" d="M0 17C-13 10-7-7 1-31C0-14 14 3 0 17Z" fill={ref('flame')}/>
      <ellipse className="atelier-flame-core" cy="7" rx="2.5" ry="8" fill="#fffde9" opacity=".9"/>
    </g>)}

    <g mask={ref('ball')}>
      <circle cx="1030" cy="884" r="148" fill="#321f69" opacity=".16"/>
      <g className="atelier-scrying-depth" filter={ref('scrying-depth')} fill="none" strokeLinecap="round">
        <path d="M855 891C913 802 1000 825 1048 884S1137 969 1210 855" stroke="#362369" strokeWidth="58" opacity=".64"/>
        <path d="M907 1049C872 950 1044 973 1112 905S1158 806 1073 757" stroke="#71358a" strokeWidth="38" opacity=".52"/>
      </g>
      <g className="atelier-scrying-wisps atelier-scrying-wisps--near" filter={ref('scrying-wisps')} fill="none" strokeLinecap="round">
        <path d="M851 930C916 828 974 788 1034 839S1063 943 1134 928S1223 831 1163 781" stroke="#f4d5ff" strokeWidth="20" opacity=".77"/>
        <path d="M850 950C949 898 951 1003 1054 981S1164 881 1220 906" stroke="#d29bfa" strokeWidth="29" opacity=".62"/>
        <path d="M901 792C956 745 1088 781 1087 863S1007 944 961 917" stroke="#fff0dd" strokeWidth="9" opacity=".72"/>
      </g>
      <g className="atelier-scrying-wisps atelier-scrying-wisps--far" filter={ref('scrying-wisps')} fill="none" strokeLinecap="round">
        <path d="M916 1030C838 937 927 861 1017 872S1137 840 1133 756" stroke="#f6c8d8" strokeWidth="17" opacity=".62"/>
        <path d="M878 803C994 833 973 924 1069 930S1195 916 1205 1002" stroke="#a79bea" strokeWidth="24" opacity=".67"/>
        <path d="M875 876C941 838 1014 871 1012 925S1068 994 1142 948" stroke="#fff4d9" strokeWidth="6" opacity=".72"/>
      </g>
      <g className="atelier-clouds atelier-clouds--first"><ellipse cx="990" cy="880" rx="138" ry="65" fill={ref('cloud')}/><ellipse cx="1080" cy="939" rx="140" ry="75" fill={ref('cloud')}/></g>
      <g className="atelier-clouds atelier-clouds--second"><ellipse cx="1080" cy="820" rx="120" ry="68" fill={ref('cloud')}/><ellipse cx="980" cy="955" rx="110" ry="67" fill={ref('cloud')}/></g>
      <CrystalPool motionEnabled={motionEnabled} analyticsEnabled={!isAtelierRehearsal(accountUid)} />
      <circle className="atelier-ball-phase" cx="1030" cy="884" r="148" fill={ref('phase')}/>
    </g>
  </svg>
    <div className="atelier-object-controls" aria-label="Little wonders on Natally’s shelves" onPointerDownCapture={event=>{controlInputMethod.current=pointerInput(event).method;}} onKeyDownCapture={()=>{controlInputMethod.current='keyboard';}}>
      {ITEMS.map(item=><button key={item.id} type="button" className="atelier-object-hit" data-picked={picked===item.id} style={{left:((item.x+(offsets[item.id]?.x||0))/2048*100)+'%',top:((item.y+(offsets[item.id]?.y||0))/1280*100)+'%'}} aria-label={item.label+(broken.includes(item.id)?', broken':taped.includes(item.id)?', taped together. Pick up to inspect':'. Pick up to inspect')} aria-describedby={picked===item.id?'atelier-placement-help':undefined} title={item.label}
        onPointerEnter={event=>{trackPlay('pointer_entry',item.id,pointerInput(event));nudge(item.id,event,true);}}
        onPointerLeave={()=>{endPlayEpisode('nudge');if(!drag.current)setActive(null);}}
        onFocus={()=>{setActive(item.id);setResonance(1);}}
        onBlur={()=>{endPlayEpisodes();controlInputMethod.current='unknown';if(!picked)setActive(null);}}
        onPointerDown={event=>beginDrag(event,item.id)}
        onPointerMove={event=>{if(drag.current)moveDrag(event);else nudge(item.id,event);}}
        onPointerUp={endDrag}
        onPointerCancel={()=>{endPlayEpisode('drag','cancelled');const d=drag.current;if(d)dropOnShelf(d.item,undefined,d.input);}}
        onClick={event=>{if(event.detail===0&&!broken.includes(item.id)&&!picked){endPlayEpisode('nudge');trackPlay('pickup',item.id,controlInput(event));setPicked(item.id);setActive(item.id);setLanding(nearestShelf(item,positionOf(item)).id);}}}
        onKeyDown={event=>{unlockAtelierSound();moveByKey(event,item.id);}}
        onKeyUp={event=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))endPlayEpisode('drag');}}
      ><span className="atelier-object-spark" aria-hidden="true">✧</span></button>)}
    </div>
    {picked && <div className="atelier-inspection" role="group" aria-label="Place a shelf object" onPointerDownCapture={event=>{controlInputMethod.current=pointerInput(event).method;}} onKeyDownCapture={()=>{controlInputMethod.current='keyboard';}} onBlur={()=>{controlInputMethod.current='unknown';}}><span id="atelier-placement-help">Drag to a glowing shelf and release. Or use arrows, then Enter.</span><label>Shelf<select aria-label="Choose a shelf" value={landing||''} onChange={event=>{const shelf=SHELVES.find(shelf=>shelf.id===event.target.value);if(shelf)dropOnShelf(picked,shelf,controlInput(event));}}>{SHELVES.map(shelf=><option key={shelf.id} value={shelf.id}>{shelf.label}</option>)}</select></label><button type="button" onClick={event=>putBack(controlInput(event))}>Set down here</button><button type="button" onClick={event=>{unlockAtelierSound();shatter([picked],controlInput(event));}}>Let it fall</button></div>}
    {!persistenceAvailable && <div className="atelier-history"><span role="status">Shelf memories cannot be saved in this browser.</span></div>}
    <button type="button" className="atelier-sound-toggle" title="Room effects are independent of narration and ambience" aria-pressed={soundMuted} onClick={()=>{const next=!soundMuted;setSoundMuted(next);try{localStorage.setItem('natally.atelier.sound-muted',String(next));}catch{}if(!next)unlockAtelierSound();}}>{soundMuted?'Room sounds off':'Room sounds on'}</button>
    {!soundMuted&&soundStatus==='failed'&&<div className="atelier-history" role="status">Room sounds could not load. <button type="button" onClick={unlockAtelierSound}>Retry room sounds</button></div>}
  </>;
}
