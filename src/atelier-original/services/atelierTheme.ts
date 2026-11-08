import { useEffect, useState } from 'react';

/** Decoration slots are independent of the character, narration and durable belongings. */
export const ATELIER_THEMES = [
  { id: 'candlelit', label: 'Candlelit atelier', seasonal: false },
  { id: 'horrorween', label: 'Horrorween', seasonal: true },
  { id: 'christmas', label: 'Christmas', seasonal: true },
] as const;
export type AtelierTheme = typeof ATELIER_THEMES[number]['id'];
/** Availability is explicit build configuration; saved preferences remain intact. */
export function isAtelierThemeEnabled(theme:AtelierTheme):boolean {
  if(theme==='candlelit')return true;
  if(theme==='horrorween')return import.meta.env.VITE_ATELIER_HALLOWEEN_ENABLED==='true';
  if(theme==='christmas')return import.meta.env.VITE_ATELIER_CHRISTMAS_ENABLED==='true';
  return false;
}
export function getAvailableAtelierThemes() {
  return ATELIER_THEMES.filter(theme=>isAtelierThemeEnabled(theme.id));
}
export function getEffectiveAtelierTheme(theme:AtelierTheme):AtelierTheme {
  return isAtelierThemeEnabled(theme)?theme:'candlelit';
}
const key = (uid:string|null) => 'natally.atelier.theme.v1:' + encodeURIComponent(uid || '__guest__');
// Cache the preference rather than its fallback so re-enabling restores it.
const selected = new Map<string,AtelierTheme>();
export function getAtelierTheme(uid:string|null):AtelierTheme {
  const identity=key(uid);if(selected.has(identity))return getEffectiveAtelierTheme(selected.get(identity)!);
  let theme:AtelierTheme='candlelit';
  try{const saved=localStorage.getItem(identity);if(ATELIER_THEMES.some(item=>item.id===saved))theme=saved as AtelierTheme;}catch{/* Session preference remains usable. */}
  selected.set(identity,theme);return getEffectiveAtelierTheme(theme);
}
export function setAtelierTheme(uid:string|null,theme:AtelierTheme):void {
  selected.set(key(uid),theme);
  try{localStorage.setItem(key(uid),theme);}catch{/* A room theme does not gate the conversation. */}
  window.dispatchEvent(new CustomEvent('natally-atelier-theme',{detail:{uid,theme:getEffectiveAtelierTheme(theme)}}));
}
export function useAtelierTheme(uid:string|null):AtelierTheme {
  const [theme,setTheme]=useState(()=>getAtelierTheme(uid));
  useEffect(()=>{setTheme(getAtelierTheme(uid));const update=(event:Event)=>{if((event as CustomEvent).detail.uid===uid)setTheme(getAtelierTheme(uid));};window.addEventListener('natally-atelier-theme',update);return()=>window.removeEventListener('natally-atelier-theme',update);},[uid]);
  return getEffectiveAtelierTheme(theme);
}
