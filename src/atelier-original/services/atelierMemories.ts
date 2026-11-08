import { isNatallyHistoryErasing } from './historyLifecycle';
export const ATELIER_ITEMS = ['hourglass', 'armillary', 'crystal', 'vial', 'emerald', 'rose'] as const;
export type TrinketId = typeof ATELIER_ITEMS[number];
export type AtelierPosition = { x:number; y:number };
export type AtelierMemory = { placements:Partial<Record<TrinketId,AtelierPosition>>; broken: TrinketId[]; taped: TrinketId[]; persistenceAvailable: boolean };
const sessions = new Map<string, AtelierMemory>();
const rehearsals = new Set<string>();
const realIdentity = (uid:string|null) => uid || '__guest__';
const identity = (uid:string|null) => (import.meta.env.DEV&&rehearsals.has(realIdentity(uid))?'__rehearsal__:':'')+realIdentity(uid);
export const isAtelierRehearsal = (uid:string|null) => import.meta.env.DEV&&rehearsals.has(realIdentity(uid));
export function setAtelierRehearsal(uid:string|null,enabled:boolean) {
  if(!import.meta.env.DEV)return;
  if(enabled){rehearsals.add(realIdentity(uid));resetAtelierRehearsal(uid);}
  else {sessions.delete(identity(uid));rehearsals.delete(realIdentity(uid));publish(uid);}
}
export function resetAtelierRehearsal(uid:string|null) {
  if(!isAtelierRehearsal(uid))return;
  sessions.set(identity(uid),{broken:[],taped:[],placements:{},persistenceAvailable:true});publish(uid);
}
export function nextRehearsalAppointment(uid:string|null) {
  if(!isAtelierRehearsal(uid))return;
  const current=getAtelierMemory(uid),placements={...current.placements};
  current.broken.forEach(item=>delete placements[item]);
  sessions.set(identity(uid),{...current,placements,broken:[],taped:Array.from(new Set([...current.taped,...current.broken]))});publish(uid);
}
const storageKey = (uid: string) => 'natally.atelier.damage.v1:' + encodeURIComponent(uid);
const valid = (value: unknown): value is TrinketId => typeof value === 'string' && (ATELIER_ITEMS as readonly string[]).includes(value);
export function getAtelierMemory(uid: string | null): AtelierMemory {
  const session = identity(uid);
  if (!sessions.has(session)) {
    let taped: TrinketId[] = []; let placements:AtelierMemory['placements']={}; let persistenceAvailable = true;
    try {
      const saved:unknown = JSON.parse(localStorage.getItem(storageKey(session)) || '[]');
      if(Array.isArray(saved)) taped=Array.from(new Set(saved.filter(valid)));
      else if(saved && typeof saved==='object') {
        const record=saved as {damaged?:unknown;placements?:unknown;pendingRestoration?:unknown};
        if(Array.isArray(record.damaged))taped=Array.from(new Set(record.damaged.filter(valid)));
        placements=validatedPositions(record.placements);
        // A page reload starts the next appointment. Only newly broken belongings
        // return to their original shelf; previously placed intact/taped items stay put.
        const restoring=Array.isArray(record.pendingRestoration)?record.pendingRestoration.filter(valid):taped;
        restoring.forEach(item=>delete placements[item]);
      }
    } catch {persistenceAvailable=false;}
    const state={broken:[],taped,placements,persistenceAvailable};
    sessions.set(session,state);
    if(persistenceAvailable)try{save(session,state);}catch{state.persistenceAvailable=false;}
  }
  return sessions.get(session)!;
}
function validatedPositions(value:unknown):AtelierMemory['placements'] {
  const result:AtelierMemory['placements']={};if(!value||typeof value!=='object')return result;
  for(const [id,point] of Object.entries(value))if(valid(id)&&point&&typeof point==='object'){const p=point as AtelierPosition;if(Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=2048&&p.y>=0&&p.y<=1280)result[id]={x:p.x,y:p.y};}return result;
}
function save(uid:string,state:AtelierMemory) {if(uid.startsWith('__rehearsal__:'))return;localStorage.setItem(storageKey(uid),JSON.stringify({damaged:Array.from(new Set([...state.taped,...state.broken])),placements:state.placements,pendingRestoration:state.broken}));}
export function placeAtelierObjects(uid:string|null,placements:AtelierMemory['placements']):AtelierMemory {
  if(isNatallyHistoryErasing(uid))return getAtelierMemory(uid);
  const next={...getAtelierMemory(uid),placements:validatedPositions(placements)};try{save(identity(uid),next);next.persistenceAvailable=true;}catch{next.persistenceAvailable=false;}sessions.set(identity(uid),next);publish(uid);return next;
}
function publish(uid:string|null) { window.dispatchEvent(new CustomEvent('natally-atelier-history-changed',{detail:{uid}})); }
export function breakAtelierObject(uid:string|null,item:TrinketId): AtelierMemory {
  if(isNatallyHistoryErasing(uid))return getAtelierMemory(uid);
  const current=getAtelierMemory(uid);
  const next={...current,broken:Array.from(new Set([...current.broken,item]))};
  try{save(identity(uid),next);next.persistenceAvailable=true;}catch{next.persistenceAvailable=false;}
  sessions.set(identity(uid),next);publish(uid);return next;
}
export function eraseAtelierHistory(uid:string|null): AtelierMemory {
  if(isAtelierRehearsal(uid)){sessions.delete(identity(uid));rehearsals.delete(realIdentity(uid));}
  const next:AtelierMemory={broken:[],taped:[],placements:{},persistenceAvailable:true};
  // Whole-history deletion must remain retryable if durable removal fails.
  localStorage.removeItem(storageKey(identity(uid)));
  sessions.set(identity(uid),next);publish(uid);return next;
}
export function buildAtelierMemoryPrompt(uid:string):string {
  const state=getAtelierMemory(uid);
  const taped=state.taped.filter(item=>!state.broken.includes(item));
  return '\nACTUAL ATELIER OBJECT MEMORY (cosmetic state, not user biography): '+JSON.stringify({brokenNow:state.broken,tapedFromPreviousSession:taped,objectPositions:state.placements})+'\nYou may answer questions about these objects and occasionally offer a gentle authored reminiscence during conversational quiet. Never reprimand, blame the visitor, express distress, guilt or disappointment, solicit repairs, sell replacements, or interrupt a reading about damage. The room remains welcoming and fully usable. Do not invent damage or claim a repaired/replaced object unless this state says so. Current room condition is operational context, never permanent user biography.';
}
