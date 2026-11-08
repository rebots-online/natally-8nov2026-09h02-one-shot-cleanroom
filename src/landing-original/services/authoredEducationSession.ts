import type { AuthoredExplanation } from './authoredChartExplanations';

export type EducationInviteSettings = { minAnswers:number; maxAnswers:number };
type Phrase = { id:string; text:string };
type PhraseCycle = { used:Set<string>; last:string|null };

const FRAMING: readonly Phrase[] = [
  {id:'education-framing-symbol',text:'Let us look at what this symbol means in astrology, starting with the calculated facts.'},
  {id:'education-framing-tradition',text:'Here is the traditional meaning of this chart feature and how astrologers arrived at it.'},
  {id:'education-framing-language',text:'We can explore the chart’s symbolic language without turning it into a personal prediction.'},
  {id:'education-framing-piece',text:'I will explain this piece of the chart on its own, keeping the calculated facts separate from the tradition.'},
];
const INVITATIONS: readonly Phrase[] = [
  {id:'education-invite-connect',text:'If you would like me to connect these pieces into a personal reading, purchase credits through Top Up. We can then explore the connections in the context of the question you choose to bring.'},
  {id:'education-invite-thinking',text:'I can explain each symbol here for free. To have me think through the connections in your own chart with you, purchase credits through Top Up for a personal reading.'},
  {id:'education-invite-together',text:'When you want a personal reading that puts these pieces together, purchase credits through Top Up. That is where we can consider how the parts connect around your own question.'},
  {id:'education-invite-explore',text:'There is more free education to explore whenever you like. If you want me to connect what we have covered into a personal reading, purchase credits through Top Up.'},
];

export function readEducationInviteSettings(environment: Readonly<Record<string, unknown>>): EducationInviteSettings {
  const read = (name:string) => {
    const raw=environment[name];
    if (typeof raw!=='string' || !/^[2-4]$/.test(raw.trim())) throw new Error(`${name} must be an integer from 2 through 4.`);
    return Number(raw.trim());
  };
  const minAnswers=read('VITE_EDUCATION_INVITE_MIN_ANSWERS');
  const maxAnswers=read('VITE_EDUCATION_INVITE_MAX_ANSWERS');
  if (minAnswers>maxAnswers) throw new Error('VITE_EDUCATION_INVITE_MAX_ANSWERS must not be less than VITE_EDUCATION_INVITE_MIN_ANSWERS.');
  return {minAnswers,maxAnswers};
}

export type PreparedEducationAnswer = Readonly<{
  requestId:string;
  answer:AuthoredExplanation;
  session:object;
  revision:number;
  framingId:string;
  invitationId:string|null;
  closeText:string|null;
}>;
export interface AuthoredEducationSession {
  readonly ownerUid:string;
  prepare(requestId:string, lesson:(framing:string)=>AuthoredExplanation):PreparedEducationAnswer|null;
  commit(prepared:PreparedEducationAnswer, current:()=>boolean, deliver:(answer:AuthoredExplanation)=>void):boolean;
}

const choose = <T,>(values:readonly T[]):T => values[Math.floor(Math.random()*values.length)];
function pickPhrase(phrases:readonly Phrase[], cycle:PhraseCycle):Phrase {
  const unused=phrases.filter(phrase=>!cycle.used.has(phrase.id));
  return choose(unused.length ? unused : phrases.filter(phrase=>phrase.id!==cycle.last));
}
function rememberPhrase(phrases:readonly Phrase[], cycle:PhraseCycle, id:string) {
  if (cycle.used.size===phrases.length) cycle.used.clear();
  cycle.used.add(id);cycle.last=id;
}
/** Compose the next upsell close after a lesson, skipping a verbatim repeat of the last delivered
 *  close (the composer's in-file rotation supplies a different line on the second call). */
function nextUpsellClose(compose:()=>string, last:string|null):string {
  const candidate=compose();
  if (last===null || candidate!==last) return candidate;
  const alternate=compose();
  return alternate!==last ? alternate : candidate;
}

/** A caller-owned account session. Preparation consumes no count/history; successful text delivery advances it.
 *  When `upsellClose` is supplied, its frozen close is composed after each lesson (and any invitation),
 *  rotated so the same close text is never delivered verbatim back-to-back. */
export function createAuthoredEducationSession(ownerUid:string, settings:EducationInviteSettings, upsellClose?:()=>string):AuthoredEducationSession {
  if (!Number.isInteger(settings.minAnswers) || settings.minAnswers<2 || settings.minAnswers>4) throw new Error('VITE_EDUCATION_INVITE_MIN_ANSWERS must be an integer from 2 through 4.');
  if (!Number.isInteger(settings.maxAnswers) || settings.maxAnswers<settings.minAnswers || settings.maxAnswers>4) throw new Error('VITE_EDUCATION_INVITE_MAX_ANSWERS must be an integer from the configured minimum through 4.');
  const thresholds=Array.from({length:settings.maxAnswers-settings.minAnswers+1},(_,index)=>settings.minAnswers+index);
  const nextThreshold = (previous?:number) => choose(thresholds.length>1 ? thresholds.filter(value=>value!==previous) : thresholds);
  const identity={};
  const committed=new Set<string>();
  const framing:PhraseCycle={used:new Set(),last:null}, invitations:PhraseCycle={used:new Set(),last:null};
  let sinceInvitation=0, threshold=nextThreshold(), revision=0, lastCloseText:string|null=null;
  return {
    ownerUid,
    prepare(requestId,lesson) {
      if (!requestId || committed.has(requestId)) return null;
      const phrase=pickPhrase(FRAMING,framing);
      const invitation=sinceInvitation+1>=threshold ? pickPhrase(INVITATIONS,invitations) : null;
      const close=upsellClose ? nextUpsellClose(upsellClose,lastCloseText) : null;
      const explanation=lesson(phrase.text);
      return {requestId,session:identity,revision,framingId:phrase.id,invitationId:invitation?.id??null,closeText:close,
        answer:{...explanation,targets:[...explanation.targets],text:explanation.text+(invitation ? '\n\n'+invitation.text : '')+(close ? '\n\n'+close : '')}};
    },
    commit(prepared,current,deliver) {
      if (prepared.session!==identity || prepared.revision!==revision || committed.has(prepared.requestId) || !current()) return false;
      // Delivery is synchronous: a thrown preparation/commit does not consume a count or phrase.
      deliver(prepared.answer);
      committed.add(prepared.requestId);revision++;sinceInvitation++;
      rememberPhrase(FRAMING,framing,prepared.framingId);
      if (prepared.closeText!==null) lastCloseText=prepared.closeText;
      if (prepared.invitationId) {
        rememberPhrase(INVITATIONS,invitations,prepared.invitationId);
        sinceInvitation=0;threshold=nextThreshold(threshold);
      }
      return true;
    },
  };
}
