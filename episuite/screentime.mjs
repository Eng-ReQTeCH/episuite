import {randomBytes, createHash} from 'node:crypto';
const error = (message,status=400) => Object.assign(new Error(message),{status});
const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const screenTimeDefaults = [
  {id:'screen-15',name:'15 minutes of phone time',kind:'screentime',cost:100,minutes:15},
  {id:'screen-60',name:'An hour of phone time',kind:'screentime',cost:300,minutes:60}
];
export function normalizeScreenTime(state) {
  if (!state.screentime) {state.screentime={keys:{}};state.rewards.push(...screenTimeDefaults.filter(r=>!state.rewards.some(old=>old.id===r.id)).map(r=>({...r})));}
  if (!state.screentime.keys || typeof state.screentime.keys !== 'object' || Array.isArray(state.screentime.keys)) throw error('Screentime storage is invalid.',500);
}
export function rewardInput(input, existing={}) {
  const name=String(input.name ?? existing.name ?? '').trim().slice(0,100),kind=input.kind ?? existing.kind ?? 'personal';
  const cost=Number(input.cost ?? existing.cost ?? 20),minutes=Number(input.minutes ?? existing.minutes ?? (kind==='screentime'?15:10));
  if(!name)throw error('Name your reward.');
  if(!['personal','screentime'].includes(kind))throw error('Choose a personal or phone screentime reward.');
  if(!Number.isInteger(cost)||cost<1||cost>100000)throw error('Reward cost must be a whole number between 1 and 100000.');
  if(!Number.isInteger(minutes)||minutes<(kind==='screentime'?1:0)||minutes>(kind==='screentime'?1440:120))throw error(kind==='screentime'?'Screentime must be 1 to 1440 whole minutes.':'Reward timer must be 0 to 120 whole minutes.');
  return {...existing,name,kind,cost,minutes};
}
function normalizeKey(value) {
  if(typeof value!=='string'||value.length>100)throw error('Enter a valid screentime key.');
  const key=value.toUpperCase().replace(/[\s-]/g,'');
  if(!/^[0-9A-HJKMNP-TV-Z]{24}$/.test(key))throw error('Enter the complete 24-character screentime key.');
  return key;
}
const hashKey = key => createHash('sha256').update(key).digest('hex');
export function issueScreenTime(state,purchase) {
  // 24 base32 characters = 120 bits of cryptographic randomness.
  let raw,hash;
  do{raw=Array.from(randomBytes(24),byte=>alphabet[byte&31]).join('');hash=hashKey(raw);}while(state.screentime.keys[hash]);
  const key=raw.match(/.{4}/g).join('-');
  state.screentime.keys[hash]={purchaseId:purchase.id,minutes:purchase.minutes};
  purchase.key=key;
  return key;
}
export function redeemScreenTime(state,input,now=Date.now()) {
  const hash=hashKey(normalizeKey(input)),record=state.screentime.keys[hash];
  if(!record)throw error('This key is invalid or has already been redeemed.',410);
  const purchase=state.purchases.find(p=>p.id===record.purchaseId&&p.kind==='screentime'&&!p.used);
  if(!purchase||!Number.isInteger(record.minutes)||record.minutes<1||record.minutes>1440)throw error('This key cannot be redeemed.',410);
  delete state.screentime.keys[hash];delete purchase.key;
  purchase.used=true;purchase.redeemedAt=now;
  return {ok:true,minutes:record.minutes,seconds:record.minutes*60,purchaseId:purchase.id};
}
export function preserveScreenTime(imported,current) {
  imported.screentime=current.screentime;
  // Exports cannot mint, restore or reactivate external unlock credentials.
  imported.purchases=[...imported.purchases.filter(p=>p.kind!=='screentime'),...current.purchases.filter(p=>p.kind==='screentime')];
}
