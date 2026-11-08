import {auth} from './firebase';
import {loadInferenceKey,loadInferenceKeySource} from './inferenceAccess';
import {getCheckoutCustomer,restoreCheckoutCustomer} from './revenueCatCheckout';
import {billingRequest,connectBillingResult,type BillingResult} from './billingApi';
import {restoreRedemptionAnalytics} from './interactionAnalytics';
export type BillingAccess = BillingResult & {
 installed:boolean;connected?:boolean;remainingTurns?:number;souvenirOpeningAvailable?:boolean;
 entitlementIds?:string[];entitlementExpirations?:Record<string,number|null>;purchasedProductIds?:string[];
 customerStatus?:'verified'|'unavailable';
};
async function funded(uid:string,key:string,current:()=>boolean):Promise<string>{
 if(auth.currentUser?.uid!==uid||!current())throw new Error('Your account changed.');
 const response=await fetch('https://openrouter.ai/api/v1/key',{headers:{Authorization:'Bearer '+key},cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(15000)});
 const result=await response.json();if(auth.currentUser?.uid!==uid||!current())throw new Error('Your account changed.');
 const d=result?.data;
 if(!response.ok||!d||d.is_management_key||d.is_provisioning_key||d.disabled||
 !(d.limit_remaining>0||(d.limit===null&&d.is_free_tier===false)))throw new Error('Your reading key could not be verified as funded.');
 return key;
}
async function requestAccess(uid:string,reconcile:boolean,install:boolean,current:()=>boolean):Promise<BillingAccess>{
 const result=await billingRequest<BillingResult>(uid,reconcile?'reconcile':'access',reconcile?{}:undefined,current);
 let installed=false;
 if(install&&result.state==='ready')installed=await connectBillingResult(uid,result,current);
 if(result.redemptionReceipt)restoreRedemptionAnalytics(result.redemptionReceipt);
 const key=loadInferenceKey(uid);let connected=false;
 if(key&&current()){try{await funded(uid,key,current);connected=true;}catch{connected=false;}}
 return {...result,installed,connected};
}
export const reconcileBillingAccess=(uid:string,install=true,current:()=>boolean=()=>true)=>requestAccess(uid,true,install,current);
export const readBillingAccess=(uid:string,install=true,current:()=>boolean=()=>true)=>requestAccess(uid,false,install,current);
export async function restoreBillingPurchases(uid:string,current:()=>boolean=()=>true):Promise<BillingAccess>{
 // Restore and server reconciliation are independent; a store SDK outage cannot
 // suppress the durable billing service's recovery of already-paid transactions.
 try{await restoreCheckoutCustomer();}catch{}
 if(!current()||auth.currentUser?.uid!==uid)throw new Error('Your account changed.');
 return reconcileBillingAccess(uid,true,current);
}
export async function ensureReadingAccess(uid:string,current:()=>boolean):Promise<string>{
 await auth.authStateReady();if(auth.currentUser?.uid!==uid||!current())throw new Error('Your account changed.');
 const key=loadInferenceKey(uid);
 if(key&&loadInferenceKeySource(uid)!=='managed')return funded(uid,key,current);
 const result=await reconcileBillingAccess(uid,true,current);
 const installed=loadInferenceKey(uid);
 if(result.state!=='ready'||!installed)throw new Error(result.message||'Your credits are being connected. Retry in a moment.');
 return funded(uid,installed,current);
}
export async function readPaidConversationAccess(uid:string):Promise<{canInfer:boolean;canOpenSouvenir:boolean}>{
 await auth.authStateReady();const owner=auth.currentUser;if(owner?.uid!==uid)return {canInfer:false,canOpenSouvenir:false};
 let canOpenSouvenir=false,canInfer=false;
 const id=String(import.meta.env.VITE_REVENUECAT_READING_ENTITLEMENT_ID||'').trim();
 if(id)try{const c=await getCheckoutCustomer(),expiry=c.entitlementExpirations?.[id];
 canOpenSouvenir=c.ownerUid===uid&&c.activeEntitlementIds.includes(id)&&(expiry===null||typeof expiry==='number'&&expiry>Date.now());}catch{}
 try{await ensureReadingAccess(uid,()=>auth.currentUser===owner);canInfer=true;}catch{}
 return auth.currentUser===owner?{canInfer,canOpenSouvenir}:{canInfer:false,canOpenSouvenir:false};
}
