import React from 'react';
import { getAvailableAtelierThemes, setAtelierTheme, useAtelierTheme, type AtelierTheme } from '../../services/atelierTheme';
export function AtelierThemeSelector({accountUid=null}:{accountUid?:string|null}) {
  const theme=useAtelierTheme(accountUid);
  return <label className="atelier-theme-selector">Room <select aria-label="Atelier decoration" value={theme} onChange={event=>setAtelierTheme(accountUid,event.target.value as AtelierTheme)}>{getAvailableAtelierThemes().map(option=><option key={option.id} value={option.id}>{option.label}</option>)}</select></label>;
}
