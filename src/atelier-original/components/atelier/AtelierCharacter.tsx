import React, { useEffect, useId, useRef, useState } from 'react';
import type { NatallyVoicePerformance } from '../../services/voiceService';
import type { ConversationPhase } from './AtelierScene';

export const LEFT_HAND_PATH = 'M626 1036C636 943 665 862 725 798C758 754 811 724 862 711C896 694 924 691 950 702L996 716L1012 736L993 743L949 733L925 738L966 749L994 768L983 782L951 777L914 765L903 772L932 789L931 806L910 813L878 793L859 809L824 839C789 882 791 958 765 1035Z';
export const RIGHT_HAND_PATH = 'M1267 815C1316 807 1375 855 1375 915C1378 967 1324 1018 1272 1053L1214 1088L1167 1116L1126 1125L1088 1118L1040 1110L1025 1094L1035 1072L1080 1072L1128 1080L1143 1059L1133 1042L1143 1015L1163 991L1181 978L1196 945L1249 923L1258 866Z';

// Native 2048×1280 coordinates follow the source pixels, including the turban's
// scalloped edge. Background sky/shelf pixels must not travel with the puppet.
export const HEAD_PATH = 'M716 489C712 478 708 469 710 452C705 443 706 434 710 427C699 412 700 394 705 380L715 354C714 335 723 317 735 301C751 278 780 262 811 248C815 228 836 215 862 207C900 196 941 201 974 210L1008 217L1040 217C1063 208 1097 201 1127 201C1170 197 1201 207 1219 238C1256 246 1286 265 1306 294C1325 317 1331 343 1331 374L1330 393C1337 410 1334 429 1330 439C1336 451 1330 471 1322 483L1334 491C1340 500 1343 508 1343 518C1357 528 1363 549 1361 576C1360 607 1350 631 1335 641L1302 652C1289 683 1260 705 1223 718C1177 736 1097 738 1023 736L904 730C841 725 788 706 761 653C728 652 708 643 697 622C687 601 685 567 690 541C693 526 699 518 707 515C706 503 709 495 716 489Z';
export const ANTENNA_PATH = 'M1025 97C1052 98 1073 117 1072 144C1072 168 1055 185 1035 189V219Q1041 223 1037 230H1014Q1009 224 1016 219V189C992 185 976 167 976 144C976 118 997 98 1025 97Z';

// The source portrait is clipped into articulated parts over an image-generated clean plate.
// Articulation is deliberately mechanical; mouth cues represent playback, not inferred emotion.
export function AtelierCharacter({ phase, motionEnabled, assetAttempt, onReady }: { phase: ConversationPhase; motionEnabled: boolean; assetAttempt: number; onReady: (ready: boolean) => void }) {
  const id = useId().replace(/:/g, '');
  const [ready, setReady] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [mouthShape, setMouthShape] = useState<'closed'|'small'|'wide'|'round'|'spread'>('closed');
  const [mishapStill, setMishapStill] = useState(false);
  const [gaze,setGaze]=useState({x:0,y:0,twitch:false});
  const mouthTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearMouth = () => { mouthTimers.current.forEach(clearTimeout); mouthTimers.current = []; };
  const motionRef = useRef(motionEnabled);
  motionRef.current = motionEnabled;
  useEffect(() => {
    const plate = new Image();
    setReady(false); onReady(false);
    plate.onload = () => { setReady(true); onReady(true); };
    plate.onerror = () => { setReady(false); onReady(false); };
    plate.src = '/atelier/puppet-cleanplate.webp' + (assetAttempt ? '?retry=' + assetAttempt : '');
    return () => { plate.onload = null; plate.onerror = null; };
  }, [assetAttempt, onReady]);
  useEffect(() => {
    const performanceEvent = (event: Event) => {
      const detail = (event as CustomEvent<NatallyVoicePerformance>).detail;
      if (!detail || !['started', 'word', 'ended'].includes(detail.state)) return;
      clearMouth();
      if (detail.state === 'ended') { setSpeaking(false); setMouthShape('closed'); return; }
      setSpeaking(true);
      if (detail.state !== 'word' || !motionRef.current) return;
      // Orthographic visemes: deliberate cartoon articulation, not phoneme alignment.
      // Different letter groups get different shapes and holds within the real playback window.
      const groups = (detail.text || '').toLowerCase().match(/oo|ou|ow|oa|ee|ea|ai|ay|[a-z]/g) || [];
      const poses = groups.map(group => ({
        shape: /^[bmp]/.test(group) ? 'closed' : /^(oo|ou|ow|oa|o|u)$/.test(group) ? 'round' : /^(ee|ea|e|i|y)$/.test(group) ? 'spread' : /^(ai|ay|a)$/.test(group) ? 'wide' : 'small',
        weight: /^[aeiouy]/.test(group) ? 1.7 : /^[bmp]/.test(group) ? .8 : 1,
      })).filter((pose, index, all) => index === 0 || pose.shape !== all[index - 1].shape);
      if (!poses.length) { setMouthShape('closed'); return; }
      const duration = Math.max(70, detail.durationMs || 240);
      // Keep individual poses readable, even in a long word spoken quickly.
      const count = Math.max(1, Math.floor(duration / 65));
      const sampled = poses.length <= count ? poses : Array.from({length:count}, (_,i) => poses[Math.floor(i * poses.length / count)]);
      const total = sampled.reduce((sum, pose) => sum + pose.weight, 0);
      let elapsed = 0;
      sampled.forEach((pose, index) => {
        const apply = () => { if (motionRef.current) setMouthShape(pose.shape as typeof mouthShape); };
        if (index === 0) apply(); else mouthTimers.current.push(setTimeout(apply, elapsed));
        elapsed += duration * .91 * pose.weight / total;
      });
      mouthTimers.current.push(setTimeout(() => setMouthShape('closed'), duration * .94));
    };
    window.addEventListener('natally-voice-performance', performanceEvent);
    return () => { window.removeEventListener('natally-voice-performance', performanceEvent); clearMouth(); };
  }, []);
  useEffect(() => {
    const timers:ReturnType<typeof setTimeout>[]=[];
    const mishap=(event:Event)=>{
      timers.splice(0).forEach(clearTimeout);setMishapStill(true);clearMouth();setMouthShape('closed');
      const detail=(event as CustomEvent<{x?:number;y?:number;brokenCount?:number;durationMs?:number}>).detail;
      const direction=(detail?.x??1024)<1024?-1:1;
      const glance={x:direction*14,y:Math.max(-8,Math.min(13,((detail?.y??740)-568)/25)),twitch:false};
      setGaze(glance);
      if(motionRef.current&&detail?.brokenCount===2){
        timers.push(setTimeout(()=>setGaze({x:direction*8,y:-23,twitch:false}),230));
        timers.push(setTimeout(()=>setGaze({x:-direction*13,y:-22,twitch:false}),490));
        timers.push(setTimeout(()=>setGaze(glance),850));
      }
      if(motionRef.current){
        // Four times the former 355 ms twitch span, starting with the first mishap.
        const start=detail?.brokenCount===2?1000:290;
        [0,120,245,370,505,635,755,880,1005,1135,1265,1345].forEach((delay,index)=>{timers.push(setTimeout(()=>{if(motionRef.current)setGaze({...glance,x:glance.x+(index%2?3:-3),twitch:true});},start+delay));timers.push(setTimeout(()=>setGaze(glance),start+delay+75));});
      }
      timers.push(setTimeout(()=>{setMishapStill(false);setGaze({x:0,y:0,twitch:false});},detail?.durationMs??3200));
    };
    window.addEventListener('natally-atelier-mishap',mishap);
    return()=>{window.removeEventListener('natally-atelier-mishap',mishap);timers.forEach(clearTimeout);};
  },[]);
  useEffect(() => { if (!motionEnabled) { clearMouth(); setMouthShape('closed'); } }, [motionEnabled]);
  const ref = (name: string) => 'url(#' + id + '-' + name + ')';
  const source = '/atelier/room.webp' + (assetAttempt ? '?retry=' + assetAttempt : '');
  const plate = '/atelier/puppet-cleanplate.webp' + (assetAttempt ? '?retry=' + assetAttempt : '');
  if (!ready) return null;
  const leftHand = LEFT_HAND_PATH;
  const rightHand = RIGHT_HAND_PATH;
  return <svg className="atelier-character" viewBox="0 0 2048 1280" aria-hidden="true" focusable="false" data-phase={phase} data-speaking={speaking} data-mishap={mishapStill} data-mouth={motionEnabled && !mishapStill ? mouthShape : 'closed'} data-motion={motionEnabled ? 'running' : 'paused'}>
    <defs>
      <clipPath id={id + '-head'} clipPathUnits="userSpaceOnUse"><path d={HEAD_PATH}/><path d={ANTENNA_PATH}/></clipPath>
      <clipPath id={id+'-eye-left'}><ellipse cx="903" cy="568" rx="60" ry="61"/></clipPath>
      <clipPath id={id+'-eye-right'}><ellipse cx="1143" cy="568" rx="60" ry="61"/></clipPath>
      <clipPath id={id + '-left-hand'}><path d={leftHand}/></clipPath>
      <clipPath id={id + '-right-hand'}><path d={rightHand}/></clipPath>
      <mask id={id + '-face-unoccluded'}><rect width="2048" height="1280" fill="white"/><path d={leftHand} fill="black"/></mask>
      <radialGradient id={id + '-mouth-metal'}><stop stopColor="#cda677"/><stop offset="1" stopColor="#c4a27e" stopOpacity="0"/></radialGradient>
      <linearGradient id={id + '-mouth-inner'} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#130c12"/><stop offset="1" stopColor="#5b2e29"/></linearGradient>
      <linearGradient id={id+'-eyelid-metal'} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#dcd2bd"/><stop offset=".5" stopColor="#b7a690"/><stop offset="1" stopColor="#756354"/></linearGradient>
    </defs>
    <image href={plate} width="2048" height="1280" preserveAspectRatio="none"/>
    <g className="atelier-character__head">
      <g clipPath={ref('head')}><image href={source} width="2048" height="1280" preserveAspectRatio="none" mask={ref('face-unoccluded')}/></g>
      <g className="atelier-character__eyelids">{[903,1143].map((x,index)=><g key={x} clipPath={ref(index===0?'eye-left':'eye-right')}><ellipse cx={x} cy="568" rx="62" ry="63" fill={ref('eyelid-metal')}/><path d={'M'+(x-59)+' 568Q'+x+' 591 '+(x+59)+' 568'} fill="none" stroke="#4b382b" strokeWidth="5"/></g>)}</g>
      {mishapStill&&[903,1143].map((x,index)=><g key={x} clipPath={ref(index===0?'eye-left':'eye-right')}>
        <ellipse cx={x} cy="568" rx="61" ry="62" fill="#e9d4b8"/>
        <g transform={'translate('+gaze.x+' '+gaze.y+')'}><image href={source} width="2048" height="1280" preserveAspectRatio="none" clipPath={ref(index===0?'eye-left':'eye-right')}/></g>
        {gaze.twitch&&index===1&&<path d={'M'+(x-65)+' 510Q'+x+' 551 '+(x+65)+' 510L'+(x+65)+' 498H'+(x-65)+'Z'} fill="#ad907b" stroke="#3a2824" strokeWidth="3"/>}
      </g>)}
      <g className="atelier-character__mouth">
        <ellipse cx="1024" cy="641" rx="39" ry="17" fill={ref('mouth-metal')}/>
        <path d={mouthShape === 'round' ? 'M1010 634C1029 624 1045 637 1043 655C1042 678 1007 678 1005 656C1004 646 1005 639 1010 634Z' : mouthShape === 'wide' ? 'M991 636Q1024 629 1057 636C1062 692 989 693 991 636Z' : mouthShape === 'spread' ? 'M987 637Q1024 650 1062 636Q1056 664 1024 665Q995 663 987 637Z' : 'M999 640Q1025 648 1050 639Q1046 661 1024 662Q1003 660 999 640Z'} fill={ref('mouth-inner')} stroke="#d9ac82" strokeWidth="2"/>
        {mouthShape === 'spread' && <path d="M995 642Q1025 651 1054 641" fill="none" stroke="#f4e2c9" strokeWidth="4"/>}
        {mouthShape === 'wide' && <path d="M1005 673Q1024 663 1043 674" fill="none" stroke="#c47c73" strokeWidth="5" opacity=".7"/>}
      </g>
    </g>
    <g className="atelier-character__hand atelier-character__hand--left"><image href={source} width="2048" height="1280" preserveAspectRatio="none" clipPath={ref('left-hand')}/></g>
    <g className="atelier-character__hand atelier-character__hand--right"><image href={source} width="2048" height="1280" preserveAspectRatio="none" clipPath={ref('right-hand')}/></g>
  </svg>;
}
