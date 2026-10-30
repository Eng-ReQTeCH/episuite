import {boardInput,boardDefaults,graphSources} from './public/life-board.js';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {done,toggleCompletion,countToday,validDate} from './public/domain.js';
import {syncContactCompletion} from './public/social-domain.js';
export function normalizeLife(state){
 state.life||={};state.life.visits||={};state.life.shortcuts||=[];
 if(typeof state.life!=='object'||Array.isArray(state.life)||!Array.isArray(state.life.shortcuts)||state.life.shortcuts.length>100||typeof state.life.visits!=='object'||Array.isArray(state.life.visits)||Object.entries(state.life.visits).some(([d,n])=>!validDate(d)||n!==1))throw Object.assign(Error('Backup contains invalid Life OS data.'),{status:400});
 const board=state.life.board||boardDefaults();
 if(!Array.isArray(board.graphs))throw Object.assign(Error('Backup contains invalid graph choices.'),{status:400});
 const available=new Set(graphSources(state).map(s=>s.id));
 state.life.board=boardInput({...board,graphs:board.graphs.filter(id=>available.has(id))},state);
 state.life.boardVersion=Number.isSafeInteger(state.life.boardVersion)?state.life.boardVersion:0;
 state.automation||={token:'',receipts:{}};state.automation.receipts||={};
}
export function authorizeAutomation(state,header){
 const expected=state.automation?.token,actual=String(header||'').replace(/^Bearer /,'');
 if(!expected||Buffer.byteLength(actual)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(actual),Buffer.from(expected)))throw Object.assign(Error('A valid automation bearer token is required.'),{status:401});
}
export function rotateAutomation(state){state.automation={token:randomBytes(32).toString('hex'),receipts:{}};return state.automation.token;}
export function completeAutomation(state,data,date,award){
 if(!validDate(date))throw Error('Choose a valid date.');
 const task=state.tasks.find(t=>t.id===data.taskId&&!t.deleted);if(!task)throw Object.assign(Error('Task not found.'),{status:404});
 const key=String(data.eventId||'').trim();if(!key||key.length>160)throw Object.assign(Error('Send a unique eventId of at most 160 characters; reuse it for retries.'),{status:400});
 const prior=Object.hasOwn(state.automation.receipts,key)?state.automation.receipts[key]:null;
 if(prior){if(prior.taskId!==task.id||prior.date!==date)throw Object.assign(Error('This eventId was already used for a different task or date.'),{status:409});return {...prior,duplicate:true};}
 if(Object.keys(state.automation.receipts).length>=100000)throw Object.assign(Error('Automation receipt storage is full. Rotate the token before sending new events.'),{status:409});
 let delta=0;
 if(!done(task,date)){delta=toggleCompletion(state,task.id,date,award);syncContactCompletion(state,task);}
 const receipt={taskId:task.id,date,eventId:key,done:done(task,date),count:countToday(task,date),delta};Object.defineProperty(state.automation.receipts,key,{value:receipt,enumerable:true,writable:true,configurable:true});return receipt;
}
