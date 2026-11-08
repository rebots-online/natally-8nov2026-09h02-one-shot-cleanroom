import React, { useEffect, useState } from 'react';
import { canAnimateAtelier } from '../../services/atelierMotion';
import { AtelierTrinkets } from './AtelierTrinkets';
import { AtelierCharacter } from './AtelierCharacter';
import './AtelierScene.css';
import { AtelierSeason } from './AtelierSeason';
import { useAtelierTheme } from '../../services/atelierTheme';
import { unlockAtelierSound } from '../../services/atelierSound';

export type ConversationPhase = 'idle' | 'listening' | 'thinking' | 'speaking';
const PHASE_LABELS: Record<ConversationPhase, string> = { idle: 'Here with you', listening: 'Listening', thinking: 'Considering your question', speaking: 'Speaking' };
type IdlePose = {blink:boolean;gesture:'rest'|'tilt'|'massage'};

export function AtelierScene({ phase, motionEnabled, sceneVisible = true, accountUid = null }: { phase: ConversationPhase; motionEnabled: boolean; sceneVisible?: boolean; accountUid?: string | null }) {
  const theme=useAtelierTheme(accountUid);
  const [documentVisible, setDocumentVisible] = useState(() => document.visibilityState !== 'hidden');
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [imageFailed, setImageFailed] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const [assetAttempt, setAssetAttempt] = useState(0);
  const [characterReady, setCharacterReady] = useState(false);
  const [idlePose,setIdlePose]=useState<IdlePose>({blink:false,gesture:'rest'});
  const retryArtwork = () => { setImageFailed(false); setPosterFailed(false); setAssetAttempt(attempt => attempt + 1); };
  useEffect(() => {
    const visibility = () => setDocumentVisible(document.visibilityState !== 'hidden');
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const motion = () => setReducedMotion(preference.matches);
    const online = () => { setImageFailed(false); setPosterFailed(false); setAssetAttempt(attempt => attempt + 1); };
    document.addEventListener('pointerdown', unlockAtelierSound, true);
    document.addEventListener('keydown', unlockAtelierSound, true);
    unlockAtelierSound();
    window.addEventListener('online', online);
    document.addEventListener('visibilitychange', visibility);
    preference.addEventListener('change', motion);
    return () => { document.removeEventListener('pointerdown', unlockAtelierSound, true); document.removeEventListener('keydown', unlockAtelierSound, true); window.removeEventListener('online', online); document.removeEventListener('visibilitychange', visibility); preference.removeEventListener('change', motion); };
  }, []);
  const animate = canAnimateAtelier({ paused: !motionEnabled, reducedMotion, documentVisible, sceneVisible });
  useEffect(()=>{
    setIdlePose({blink:false,gesture:'rest'});
    if(!animate||phase!=='idle'||!characterReady)return;
    const idleTimers=new Set<ReturnType<typeof setTimeout>>();let disposed=false,busyUntil=0;
    const schedule=(callback:()=>void,delay:number)=>{const timer=setTimeout(()=>{idleTimers.delete(timer);if(!disposed)callback();},delay);idleTimers.add(timer);};
    const blink=()=>{
      if(performance.now()>=busyUntil){setIdlePose(next=>({...next,blink:true}));schedule(()=>setIdlePose(next=>({...next,blink:false})),260);}
      schedule(blink,4000+Math.random()*5000);
    };
    const gesture=()=>{
      if(performance.now()<busyUntil){schedule(gesture,2000);return;}
      busyUntil=performance.now()+4000;setIdlePose({blink:false,gesture:'massage'});
      schedule(()=>setIdlePose({blink:false,gesture:'rest'}),4000);
      schedule(gesture,16000+Math.random()*8000);
    };
    const next=()=>{
      if(performance.now()>=busyUntil){busyUntil=performance.now()+1800;setIdlePose({blink:false,gesture:'tilt'});schedule(()=>setIdlePose({blink:false,gesture:'rest'}),1800);}
      schedule(next,8000+Math.random()*4000);
    };
    const mishap=(event:Event)=>{
      const detail=(event as CustomEvent<{durationMs?:number}>).detail;
      idleTimers.forEach(clearTimeout);idleTimers.clear();setIdlePose({blink:false,gesture:'rest'});
      busyUntil=performance.now()+(detail?.durationMs??3200);
      schedule(blink,(detail?.durationMs??3200)+4000);schedule(next,(detail?.durationMs??3200)+8000);schedule(gesture,(detail?.durationMs??3200)+12000);
    };
    schedule(blink,4000);schedule(next,8000);schedule(gesture,14000);
    window.addEventListener('natally-atelier-mishap',mishap);
    return()=>{disposed=true;idleTimers.forEach(clearTimeout);window.removeEventListener('natally-atelier-mishap',mishap);};
  },[animate,phase,characterReady,accountUid]);
  return <figure className="atelier-scene" data-theme={theme} onPointerDownCapture={unlockAtelierSound} onKeyDownCapture={unlockAtelierSound} data-phase={phase} data-motion={animate ? 'running' : 'paused'} data-idle-gesture={animate&&phase==='idle'?idlePose.gesture:'rest'} data-idle-blink={animate&&phase==='idle'&&idlePose.blink} aria-label="Natally in her candlelit atelier, with a decorative starry sky">
    <div className="atelier-scene__composition">
      {!posterFailed && <img key={'poster-' + assetAttempt} className="atelier-scene__poster" src={'/atelier/poster.webp' + (assetAttempt ? '?retry=' + assetAttempt : '')} alt="" aria-hidden="true" onError={() => setPosterFailed(true)} />}
      {!imageFailed && <img key={'room-' + assetAttempt} className="atelier-scene__room" src={'/atelier/room.webp' + (assetAttempt ? '?retry=' + assetAttempt : '')} alt="Natally, a silver robot with amber eyes, a violet turban and cloak, holds a glowing crystal ball among candlelit wooden shelves." onError={() => setImageFailed(true)} fetchPriority="high" />}
      {!imageFailed && <AtelierCharacter phase={phase} motionEnabled={animate} assetAttempt={assetAttempt} onReady={setCharacterReady} />}
      {!(imageFailed && posterFailed) && <AtelierTrinkets phase={phase} motionEnabled={animate} characterReady={characterReady} accountUid={accountUid} />}
      {!(imageFailed && posterFailed) && <AtelierSeason theme={theme} accountUid={accountUid} />}
      {imageFailed && posterFailed && <div className="atelier-scene__fallback" role="img" aria-label="A still violet and gold reading room while Natally’s artwork is unavailable"><span aria-hidden="true">✦</span><p>The room is still here.<br />Your conversation can continue.</p></div>}
    </div>
    {imageFailed && <div className="atelier-scene__recovery"><span>{posterFailed ? 'Room artwork is unavailable.' : 'Showing the still room.'}</span><button type="button" onClick={retryArtwork}>Retry artwork</button></div>}
    <figcaption className="atelier-scene__caption"><span className="atelier-scene__phase-dot" />{PHASE_LABELS[phase]}<span className="atelier-scene__sky-note">An imagined sky</span></figcaption>
  </figure>;
}
