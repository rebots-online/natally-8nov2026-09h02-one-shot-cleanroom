import { auth } from './firebase';
import { signOut } from 'firebase/auth';
import { installInferenceKey, loadInferenceKey, loadInferenceKeySource, removeInferenceKey } from './inferenceAccess';
import { restoreRedemptionAnalytics } from './interactionAnalytics';
import { getRocheBalance } from './revenueCatCheckout';
export type RedemptionReceipt = {receiptId:string;requestId:string;allowanceUsdMicros:number;createdAt?:string};
export type BillingResult = {
 accountUid:string;expiresAt:string;state:'ready'|'pending'|'unfunded'|'needs_attention'|'unavailable';
 message:string;provider?:string;source?:'managed'|'development';availableUsdMicros?:number;spentUsdMicros?:number;
 apiKey?:string;hash?:string;keyGeneration?:number;accessExpiresAt?:string;limitUsd?:number;usageUsd?:number;
 redemptionReceipt?:RedemptionReceipt;
 currency?:'ROCHE';creditBalance?:number;balanceSource?:'revenuecat';
 purchaseConfirmed?:boolean;checkoutState?:'prepared'|'started'|'paid'|'cancelled';
};
export type PurchaseRecord = {
 id:string;sourceId?:string;description?:string;productId?:string;paidAt?:string|number;createdAt?:string;
 currency:string;subtotal?:number;tax?:number;total?:number;amountMicros?:number;status:string;invoiceId?:string;invoiceAvailable?:boolean;
};
function endpoint(route:string):string {
 const base=String(import.meta.env.VITE_BILLING_API_URL||'').trim();
 if(!base)throw new Error('The account service is not connected. Your purchases are retained.');
 const url=new URL(base);
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw new Error('The account service address is invalid.');
 return url.href.replace(/\/$/,'')+'/billing/'+route;
}
export async function billingRequest<T>(uid:string,route:string,body?:unknown,current:()=>boolean=()=>true):Promise<T>{
 await auth.authStateReady();const owner=auth.currentUser;
 const valid=()=>auth.currentUser===owner&&owner?.uid===uid&&current();
 if(!valid())throw new Error('Your account changed. Please try again.');
 const token=await owner!.getIdToken();if(!valid())throw new Error('Your account changed.');
 const response=await fetch(endpoint(route),{method:body===undefined?'GET':'POST',
 headers:{Authorization:'Bearer '+token,...(body===undefined?{}:{'Content-Type':'application/json'})},
 ...(body===undefined?{}:{body:JSON.stringify(body)}),cache:'no-store',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(60000)});
 if(!valid())throw new Error('Your account changed.');
 const result=await response.json().catch(()=>null);
 if(!response.ok)throw Object.assign(new Error(typeof result?.message==='string'?result.message:'The account request could not be confirmed. Retry the same request.'),{code:result?.code,checkoutSessionId:result?.checkoutSessionId});
 if(result?.accountUid!==uid)throw new Error('The account response does not belong to you.');
 return result as T;
}
export async function connectBillingResult(uid:string,result:BillingResult,current:()=>boolean=()=>true):Promise<boolean>{
 const owner=auth.currentUser;let generationCurrent=()=>true;
 const valid=()=>owner?.uid===uid&&auth.currentUser===owner&&current()&&generationCurrent();
 if(!valid())throw new Error('Your account changed.');
 const responseExpiry=Date.parse(result.expiresAt);
 if(!Number.isFinite(responseExpiry)||responseExpiry<=Date.now()||responseExpiry>Date.now()+5*60000)throw new Error('The access response expired. Retry your request.');
 if(result.state!=='ready')return false;
 if(result.provider!=='openrouter'||result.source!=='managed'||!result.apiKey||!result.hash||
 !Number.isSafeInteger(result.keyGeneration)||!Number.isFinite(result.limitUsd)||!Number.isFinite(result.usageUsd)||
 !(result.limitUsd!>result.usageUsd!))throw new Error('The funded access response could not be verified.');
 const expiry=Date.parse(result.accessExpiresAt||'');
 if(!(expiry>Date.now())||expiry>Date.now()+61*60000)throw new Error('The reading key has expired.');
 if(loadInferenceKey(uid)&&loadInferenceKeySource(uid)==='personal')return false;
 const storage='natally-managed-generation:'+uid;
 const saved=JSON.parse(localStorage.getItem(storage)||'null');
 if(saved&&(saved.generation>result.keyGeneration!||saved.generation===result.keyGeneration&&saved.hash!==result.hash))throw new Error('A newer reading key is already connected. Refresh access.');
 localStorage.setItem(storage,JSON.stringify({generation:result.keyGeneration,hash:result.hash}));
 generationCurrent=()=>{const latest=JSON.parse(localStorage.getItem(storage)||'null');return latest?.generation===result.keyGeneration&&latest.hash===result.hash;};
 await installInferenceKey(uid,result.apiKey,valid,'managed',expiry);
 return valid();
}
export async function signOutBilling():Promise<void>{
 const user=auth.currentUser;
 if(user){
  try{const saved=JSON.parse(localStorage.getItem('natally-managed-generation:'+user.uid)||'null');
   if(saved?.hash)await billingRequest(user.uid,'logout',{expectedHash:saved.hash});
  }catch{/* Local sign-out must still complete if the provider cannot be reached. */}
  if(loadInferenceKeySource(user.uid)==='managed')removeInferenceKey(user.uid);
 }
 restoreRedemptionAnalytics(null);await signOut(auth);
}
let previousOwner:string|null=null;
auth.onAuthStateChanged(user=>{
 if(previousOwner&&previousOwner!==user?.uid){
  if(loadInferenceKeySource(previousOwner)==='managed')removeInferenceKey(previousOwner);
  restoreRedemptionAnalytics(null);
 }
 previousOwner=user?.uid||null;
 if(!user||typeof window==='undefined')return;
 const location=new URL(window.location.href), session=location.searchParams.get('billing_return');
 if(!session)return;
 const uid=user.uid;
 void billingRequest<BillingResult>(uid,'reconcile',{checkoutSessionId:session},()=>auth.currentUser===user)
 .then(async result=>{
  if(auth.currentUser!==user)return;
  if(result.state==='ready')await connectBillingResult(uid,result,()=>auth.currentUser===user);
  if(auth.currentUser!==user)return;
  sessionStorage.setItem('natally-checkout-confirmation:'+uid,result.message);
  window.dispatchEvent(new CustomEvent('natally:purchase-access-changed'));
  window.dispatchEvent(new CustomEvent('natally:purchase-confirmation',{detail:{uid,message:result.message}}));
  if(result.purchaseConfirmed===true){location.searchParams.delete('billing_return');history.replaceState(history.state,'',location);sessionStorage.removeItem('natally-checkout-request:'+uid);}
 }).catch(error=>{
  if(auth.currentUser===user){const message='Your purchase status could not be checked. Please retry confirmation.';
   sessionStorage.setItem('natally-checkout-confirmation:'+uid,message);
   window.dispatchEvent(new CustomEvent('natally:purchase-confirmation',{detail:{uid,message}}));}
 });
});
export async function readCreditBalance():Promise<{ownerUid:string;balance:number}>{
 const owner=auth.currentUser;if(!owner)throw new Error('Sign in to see your balance.');
 const result=await getRocheBalance();
 if(auth.currentUser!==owner||result.ownerUid!==owner.uid||result.currency!=='ROCHE'||!Number.isSafeInteger(result.balance)||result.balance<0)throw new Error('Your balance could not be verified.');
 const unitsPerUsd=Number(import.meta.env.VITE_REVENUECAT_UNITS_PER_USD);
 if(!Number.isSafeInteger(unitsPerUsd)||unitsPerUsd<=0)throw new Error('Your balance display is not configured.');
 return {ownerUid:owner.uid,balance:result.balance/unitsPerUsd};
}
export function formatReadingAllowance(allowanceUsd:number):string {
 const creditsPerUsd=Number(import.meta.env.VITE_CREDIT_DISPLAY_PER_USD);
 if(!Number.isFinite(allowanceUsd)||allowanceUsd<0||!Number.isFinite(creditsPerUsd)||creditsPerUsd<=0)throw new Error('Your balance could not be verified.');
 return new Intl.NumberFormat(undefined,{maximumFractionDigits:2}).format(allowanceUsd*creditsPerUsd)+' Cr';
}
export async function openBillingInvoice(uid:string,id:string):Promise<void>{
 const owner=auth.currentUser;if(owner?.uid!==uid)throw new Error('Sign in to open your invoice.');
 const token=await owner.getIdToken();
 const response=await fetch(endpoint('invoices/'+encodeURIComponent(id)),{headers:{Authorization:'Bearer '+token},cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(30000)});
 if(auth.currentUser!==owner)throw new Error('Your account changed.');
 if(!response.ok)throw new Error('Your invoice could not be retrieved. Please retry.');
 const type=response.headers.get('content-type')||'';
 if(!type.includes('application/pdf')&&!type.includes('text/html'))throw new Error('The invoice format could not be verified.');
 const blob=await response.blob();const href=URL.createObjectURL(blob);const link=document.createElement('a');
 link.href=href;link.download='Natally-invoice-'+id+(type.includes('pdf')?'.pdf':'.html');link.click();
 window.setTimeout(()=>URL.revokeObjectURL(href),60000);
}

