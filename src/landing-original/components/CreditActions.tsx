import React,{useEffect,useRef,useState} from 'react';
import {auth} from '../services/firebase';
import {billingRequest,connectBillingResult,openBillingInvoice,type BillingResult,type PurchaseRecord} from '../services/billingApi';
import {getQuotedCreditOffer,purchaseCheckoutOffer,type CreditCheckoutQuote} from '../services/revenueCatCheckout';
import {trackRedemptionCompleted} from '../services/interactionAnalytics';

type Buyer={name:string;address:{line1:string;line2:string;city:string;state:string;postal_code:string;country:string}};
type CheckoutRequest={amount:string;requestId:string;checkoutId?:string;phase:'prepared'|'started'|'pending'|'paid';buyer?:Buyer;quote?:CreditCheckoutQuote};
type Current=()=>boolean;
const emptyBuyer=():Buyer=>({name:'',address:{line1:'',line2:'',city:'',state:'',postal_code:'',country:''}});
const provinces=[['AB','Alberta'],['BC','British Columbia'],['MB','Manitoba'],['NB','New Brunswick'],['NL','Newfoundland and Labrador'],['NS','Nova Scotia'],['NT','Northwest Territories'],['NU','Nunavut'],['ON','Ontario'],['PE','Prince Edward Island'],['QC','Quebec'],['SK','Saskatchewan'],['YT','Yukon']];
const money=(micros:number,currency:string)=>new Intl.NumberFormat(undefined,{style:'currency',currency}).format(micros/1e6);

export function CreditActions({uid,onChanged}:{uid:string;onChanged?:()=>void}){
 const [code,setCode]=useState('');const [amount,setAmount]=useState('5');const [custom,setCustom]=useState(false);
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [history,setHistory]=useState<PurchaseRecord[]|null>(null);
 const [buyer,setBuyer]=useState<Buyer>(emptyBuyer);const [needDetails,setNeedDetails]=useState(false);
 const [quote,setQuote]=useState<CreditCheckoutQuote|null>(null);const [pendingCheckout,setPendingCheckout]=useState(false);
 const alive=useRef(true);const operation=useRef(0);const running=useRef(false);const pending=useRef<{code:string;requestId:string}|null>(null);
 const checkout=useRef<CheckoutRequest|null>(null);const checkoutTarget=useRef<HTMLDivElement|null>(null);
 const current=()=>alive.current&&auth.currentUser?.uid===uid;
 const changed=()=>{window.dispatchEvent(new CustomEvent('natally:purchase-access-changed'));onChanged?.();};
 function saveCheckout(value:CheckoutRequest|null){checkout.current=value;setPendingCheckout(Boolean(value?.checkoutId&&value.phase!=='prepared'));
  if(value)sessionStorage.setItem('natally-checkout-request:'+uid,JSON.stringify(value));else sessionStorage.removeItem('natally-checkout-request:'+uid);}
 useEffect(()=>{
  alive.current=true;operation.current++;running.current=false;setCode('');setHistory(null);setMessage('');setBusy(false);pending.current=null;checkout.current=null;
  setNeedDetails(false);setQuote(null);setPendingCheckout(false);setBuyer({...emptyBuyer(),name:auth.currentUser?.uid===uid?auth.currentUser.displayName||'':''});
  try{const value=JSON.parse(sessionStorage.getItem('natally-redemption-request:'+uid)||'null');if(typeof value?.requestId==='string'&&typeof value?.code==='string')pending.current=value;
   const purchase=JSON.parse(sessionStorage.getItem('natally-checkout-request:'+uid)||'null');
   if(typeof purchase?.requestId==='string'&&typeof purchase?.amount==='string'){
    purchase.phase=['prepared','started','pending','paid'].includes(purchase.phase)?purchase.phase:'prepared';checkout.current=purchase;setPendingCheckout(Boolean(purchase.checkoutId&&purchase.phase!=='prepared'));
    if(purchase.buyer?.name&&purchase.buyer?.address?.country)setBuyer(purchase.buyer);
    const saved=purchase.quote;if(saved?.accountUid===uid&&saved.currency==='USD'&&[saved.baseMicros,saved.taxMicros,saved.totalMicros].every(Number.isSafeInteger))setQuote(saved);
   }
   setMessage(sessionStorage.getItem('natally-checkout-confirmation:'+uid)||'');}catch{}
  const confirmation=(event:Event)=>{const value=(event as CustomEvent).detail;if(value?.uid===uid&&auth.currentUser?.uid===uid)setMessage(value.message);};
  window.addEventListener('natally:purchase-confirmation',confirmation);
  const restoredId=checkout.current?.checkoutId;if(restoredId&&checkout.current?.phase!=='prepared')void run(valid=>confirmPurchase(restoredId,valid));
  return()=>{alive.current=false;operation.current++;window.removeEventListener('natally:purchase-confirmation',confirmation);};
 },[uid]);
 async function run(action:(valid:Current)=>Promise<void>){
  if(running.current||!current())return;const owner=auth.currentUser;const op=++operation.current;
  const valid=()=>alive.current&&operation.current===op&&auth.currentUser===owner&&owner?.uid===uid;
  running.current=true;setBusy(true);setMessage('');
  try{await action(valid);}catch(e){if(valid())setMessage(e instanceof Error?e.message:'Please retry.');}
  finally{if(op===operation.current){running.current=false;if(valid())setBusy(false);}}
 }
 async function redeem(valid:Current){
  const entered=code.trim();if(!entered)throw new Error('Enter your redemption code.');
  if(!pending.current||pending.current.code!==entered)pending.current={code:entered,requestId:crypto.randomUUID()};
  sessionStorage.setItem('natally-redemption-request:'+uid,JSON.stringify(pending.current));
  const result=await billingRequest<BillingResult>(uid,'redeem',pending.current,valid);
  if(!valid())return;await connectBillingResult(uid,result,valid);if(!valid())return;setMessage(result.message);
  if(result.state==='ready'&&result.redemptionReceipt){trackRedemptionCompleted(result.redemptionReceipt);pending.current=null;sessionStorage.removeItem('natally-redemption-request:'+uid);setCode('');changed();}
 }
 async function purchases(valid:Current){const result=await billingRequest<{accountUid:string;items:PurchaseRecord[];providerMessage?:string}>(uid,'history',undefined,valid);
  if(valid()){if(!Array.isArray(result.items))throw new Error('Purchase records could not be verified.');setHistory(result.items);setMessage(result.providerMessage||'');}}
 async function confirmPurchase(checkoutId:string,valid:Current){
  const result=await billingRequest<BillingResult>(uid,'reconcile',{checkoutId},valid);
  if(!valid())return;if(result.state==='ready')await connectBillingResult(uid,result,valid);if(!valid())return;
  const text=result.purchaseConfirmed===true?'Purchase confirmed. Your balance is updated.':result.checkoutState==='cancelled'?'Purchase cancelled.':'Your purchase is not confirmed yet. Check its status again shortly.';
  setMessage(text);sessionStorage.setItem('natally-checkout-confirmation:'+uid,text);
  if(result.purchaseConfirmed===true||result.checkoutState==='cancelled'){saveCheckout(null);setQuote(null);const url=new URL(window.location.href);url.searchParams.delete('billing_return');window.history.replaceState(window.history.state,'',url);changed();}
 }
 async function buy(requestedAmount:string,mode:'preset'|'custom',valid:Current){
  const entered=requestedAmount.trim();if(!/^\d+(?:\.\d{1,2})?$/.test(entered))throw new Error('Enter a USD amount with up to two decimal places.');
  const cents=Math.round(Number(entered)*100);if(!Number.isSafeInteger(cents)||(mode==='custom'?cents<=500:![500,1000,2500].includes(cents)))throw new Error('Enter a custom amount greater than US$5.');
  if(checkout.current?.checkoutId&&checkout.current.phase!=='prepared'){await confirmPurchase(checkout.current.checkoutId,valid);return;}
  const details:Buyer={name:buyer.name.trim(),address:{line1:buyer.address.line1.trim(),line2:buyer.address.line2.trim(),city:buyer.address.city.trim(),state:buyer.address.state.trim().toUpperCase(),postal_code:buyer.address.postal_code.trim(),country:buyer.address.country.trim().toUpperCase()}};
  if(!details.name||!details.address.line1||!details.address.city||!details.address.state||!details.address.postal_code||!/^[A-Z]{2}$/.test(details.address.country)){
   setNeedDetails(true);setMessage('Enter your billing details to see the tax and total.');return;
  }
  const value=(cents/100).toFixed(2);
  const request:CheckoutRequest=checkout.current?.amount===value&&JSON.stringify(checkout.current.buyer)===JSON.stringify(details)?checkout.current:{amount:value,requestId:crypto.randomUUID(),phase:'prepared',buyer:details};
  saveCheckout(request);
  let quoted:CreditCheckoutQuote;
  try{quoted=await billingRequest<CreditCheckoutQuote>(uid,'checkout',{amountUsd:value,requestId:request.requestId,buyer:details},valid);}
  catch{if(valid())throw new Error('Your purchase could not be started. Check your billing details and retry.');return;}
  if(!valid())return;
  if(quoted.requestId!==request.requestId||!quoted.checkoutId||quoted.currency!=='USD'||quoted.baseMicros!==cents*10000||!Number.isSafeInteger(quoted.taxMicros)||quoted.taxMicros<0||!Number.isSafeInteger(quoted.totalMicros)||quoted.totalMicros!==quoted.baseMicros+quoted.taxMicros||quoted.amountMicros!==quoted.totalMicros)throw new Error('Your purchase total could not be verified. Please retry.');
  if(quoted.state==='cancelled'){saveCheckout(null);setQuote(null);setMessage('Purchase cancelled. Choose an amount to start again.');return;}
  const active:CheckoutRequest={...request,checkoutId:quoted.checkoutId,phase:quoted.state,quote:quoted};saveCheckout(active);setQuote(quoted);setNeedDetails(false);
  if(quoted.state!=='prepared'){await confirmPurchase(quoted.checkoutId,valid);return;}
  let offer:Awaited<ReturnType<typeof getQuotedCreditOffer>>;
  try{offer=await getQuotedCreditOffer(quoted,valid);}catch{if(valid())throw new Error('Your purchase could not be started. Please retry.');return;}
  const target=checkoutTarget.current;if(!valid())return;if(!target?.isConnected)throw new Error('Reopen your account to continue this purchase.');
  // Keep this identity after any uncertain response; a retry must confirm it before opening another payment.
  saveCheckout({...active,phase:'started'});
  try{
   const started=await billingRequest<{accountUid:string;state:'started'|'pending'|'paid'|'cancelled'}>(uid,'checkout-start',{checkoutId:quoted.checkoutId},valid);
   if(!valid())return;if(started.state!=='started'){await confirmPurchase(quoted.checkoutId,valid);return;}
   const result=await purchaseCheckoutOffer(offer,target);if(!valid())return;
   if(result.state==='cancelled'){
    const cancelled=await billingRequest<{accountUid:string;state:string}>(uid,'checkout-cancel',{checkoutId:quoted.checkoutId},valid);
    if(valid()&&cancelled.state==='cancelled'){saveCheckout(null);setQuote(null);setMessage('Purchase cancelled.');}return;
   }
   saveCheckout({...active,phase:result.state==='pending'?'pending':'paid'});
   if(result.state==='pending'){setMessage('Your payment is pending. Check purchase status again shortly.');return;}
   await confirmPurchase(quoted.checkoutId,valid);
  }catch{if(valid())setMessage('Your purchase status could not be confirmed. Check purchase status before starting another purchase.');}
 }
 const address=(field:keyof Buyer['address'],value:string)=>setBuyer(previous=>({...previous,address:{...previous.address,[field]:value}}));
 const inputClass='block w-full min-h-11 min-w-0 rounded border border-[#d4af37]/40 bg-[#1c1428] px-3';
 return <div className="space-y-4">
  <section aria-label="Redeem code" className="account-billing__section">
   <h3>Redeem code</h3><form onSubmit={e=>{e.preventDefault();void run(redeem);}} className="flex flex-wrap gap-2">
    <input aria-label="Redemption code" autoComplete="off" autoCapitalize="none" spellCheck={false} value={code} onChange={e=>setCode(e.target.value)} disabled={busy} className="min-h-11 min-w-0 flex-1 rounded border border-[#d4af37]/40 bg-[#1c1428] px-3"/>
    <button type="submit" disabled={busy||!code.trim()} className="min-h-11 rounded border border-[#d4af37]/40 px-3">Redeem</button>
   </form>
  </section>
  <section aria-label="Add credits" className="account-billing__section"><h3>Add credits</h3>
   {/* Never take payment before showing what it buys (Robin 2026-11-02): new purchases start in the
       three-screen offer walkthrough; only a checkout already in progress finishes here. */}
   {!(pendingCheckout||needDetails||quote)&&<><p>See what your credits give you before choosing anything.</p>
    <button type="button" disabled={busy} onClick={()=>window.dispatchEvent(new CustomEvent('natally:show-offers'))} className="min-h-11 rounded border border-[#d4af37]/40 px-3">Add credits</button></>}
   {(pendingCheckout||needDetails||quote)&&<>
   <p>Prices are before applicable tax.</p>
   {needDetails&&<form className="mt-3 space-y-2" onSubmit={e=>{e.preventDefault();void run(valid=>buy(amount,custom?'custom':'preset',valid));}}>
    <label className="block">Full name<input autoComplete="billing name" required value={buyer.name} onChange={e=>setBuyer(previous=>({...previous,name:e.target.value}))} disabled={busy} className={inputClass}/></label>
    <label className="block">Billing address<input autoComplete="billing address-line1" required value={buyer.address.line1} onChange={e=>address('line1',e.target.value)} disabled={busy} className={inputClass}/></label>
    <label className="block">Apartment or unit (optional)<input autoComplete="billing address-line2" value={buyer.address.line2} onChange={e=>address('line2',e.target.value)} disabled={busy} className={inputClass}/></label>
    <label className="block">City<input autoComplete="billing address-level2" required value={buyer.address.city} onChange={e=>address('city',e.target.value)} disabled={busy} className={inputClass}/></label>
    <label className="block">Country (two-letter code)<input autoComplete="billing country" required maxLength={2} pattern="[A-Za-z]{2}" value={buyer.address.country} onChange={e=>address('country',e.target.value.toUpperCase())} disabled={busy} className={inputClass}/></label>
    <label className="block">Province or state{buyer.address.country==='CA'?<select autoComplete="billing address-level1" required value={buyer.address.state} onChange={e=>address('state',e.target.value)} disabled={busy} className={inputClass}><option value="">Select province or territory</option>{provinces.map(([code,name])=><option key={code} value={code}>{name}</option>)}</select>:<input autoComplete="billing address-level1" required value={buyer.address.state} onChange={e=>address('state',e.target.value)} disabled={busy} className={inputClass}/>}</label>
    <label className="block">Postal or ZIP code<input autoComplete="billing postal-code" required value={buyer.address.postal_code} onChange={e=>address('postal_code',e.target.value)} disabled={busy} className={inputClass}/></label>
    <button type="submit" disabled={busy} className="min-h-11 rounded border border-[#d4af37]/40 px-3">Continue to payment</button>
   </form>}
   {quote&&<dl className="mt-3 grid grid-cols-2 gap-2"><dt>Amount</dt><dd>{money(quote.baseMicros,quote.currency)}</dd><dt>{quote.taxLabel||'Tax'}</dt><dd>{money(quote.taxMicros,quote.currency)}</dd><dt>Total</dt><dd>{money(quote.totalMicros,quote.currency)}</dd></dl>}
   <div ref={checkoutTarget}/>
   </>}
  </section>
  <section aria-label="Purchase history" className="account-billing__section">
   {pendingCheckout&&<button type="button" disabled={busy} onClick={()=>void run(valid=>confirmPurchase(checkout.current!.checkoutId!,valid))} className="min-h-11 rounded border border-[#d4af37]/40 px-3">Check purchase status</button>}
   <button type="button" disabled={busy} onClick={()=>void run(purchases)} className="min-h-11 rounded border border-[#d4af37]/40 px-3">Purchase history</button>
   {history&&<ul>{history.length===0&&<li>No purchases on record.</li>}{history.map(item=><li key={item.id} className="py-3 border-b border-white/10">
    <strong>{item.description||item.productId}</strong><div>{item.paidAt?new Date(item.paidAt).toLocaleString():item.createdAt?new Date(item.createdAt).toLocaleString():''}</div>
    <div>{typeof item.total==='number'?money(item.total*1e6,item.currency):typeof item.amountMicros==='number'?money(item.amountMicros,item.currency):''} · {item.status}</div>
    {item.invoiceId&&<button type="button" disabled={busy} onClick={()=>void run(()=>openBillingInvoice(uid,item.invoiceId!))} className="min-h-11 underline">Download invoice</button>}
   </li>)}</ul>}
  </section>
  {(busy||message)&&<p role="status">{busy?'Working…':message}</p>}
 </div>;
}
