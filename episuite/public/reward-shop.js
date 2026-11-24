export function rewardForm(reward,{field,select,esc}) {
  const r=reward||{name:'',cost:20,minutes:10,kind:'personal'};
  return `<input type="hidden" name="id" value="${esc(r.id||'')}">${field('Reward name','name',r.name,'text','required maxlength="100"')}${select('Reward type','kind',[['personal','Personal reward / break'],['screentime','Phone screentime key']],r.kind||'personal')}<div class="form-grid">${field('Coin cost','cost',r.cost,'number','min="1" max="100000" step="1" required')}${field('Minutes (0 for an untimed personal reward)','minutes',r.minutes,'number',`min="${r.kind==='screentime'?1:0}" max="${r.kind==='screentime'?1440:120}" step="1" required`)}</div><p class="small">Phone screentime rewards generate a one-use unlock key for your phone automation. Personal rewards can use the webapp’s break timer.</p>`;
}
export function screenKeyContent(purchase,{esc,btn}) {
  return `<p>${esc(purchase.reward)} · <strong>${purchase.minutes} minutes</strong></p><p class="small">Enter this key in your phone’s screentime automation. It works once and remains available here until redeemed.</p><label class="small" for="screen-key-${esc(purchase.id)}">Your screentime key</label><input id="screen-key-${esc(purchase.id)}" data-screentime-key value="${esc(purchase.key)}" readonly autocomplete="off" spellcheck="false">${btn('Copy key','copy-screen-key',purchase.id,'secondary compact')}`;
}

export function rewardGoals(state,date,{metrics,btn}){
 const m=metrics(state,date),goals=[['start','Focus for 2 minutes',m.focus>=2],['finish','Complete a task',m.completed>=1],['return','Finish '+state.settings.dailyGoal+' focus sessions',m.sessions>=state.settings.dailyGoal]];
 return '<div class="task-list">'+goals.map(([id,title,achieved])=>`<div class="task-row"><span class="task-content">${title}</span>${state.events.some(e=>e.key===date+':'+id)?'<span class="pill">Claimed</span>':btn('+5 coins','quest',id,achieved?'soft compact':'secondary compact',achieved?'':'disabled')}</div>`).join('')+'</div>';
}
export function rewardsPanel(state,date,{heading,esc,btn,metrics,timeText}){
 if(!state.settings.gamification)return heading('Rewards','')+'<p>Rewards are disabled in Settings.</p>';
 const keys=state.purchases.filter(p=>p.kind==='screentime'&&!p.used&&p.key),saved=state.purchases.filter(p=>p.kind!=='screentime'&&!p.used&&p.minutes);
 const recent=state.tasks.flatMap(t=>Object.values(t.history||{}).flat().filter(e=>e.rewardTier&&e.rewardTier!=='fixed').map(e=>({...e,title:t.title}))).sort((a,b)=>b.at-a.at).slice(0,5);
 return heading('Rewards','',`<span class="coin-total">◇ ${state.coins}</span>`)+
 (state.redemption?`<section class="notice row spread"><span>Reward break · <strong data-redeem-timer>${timeText(Math.max(0,(state.redemption.deadline-Date.now())/1000))}</strong></span>${btn('Stop & save unused minutes','redeem-stop','','secondary compact')}</section>`:'')+
 (keys.length?`<section class="outstanding-keys"><h2>Phone keys</h2><div class="reward-grid">${keys.map(p=>`<article class="reward">${screenKeyContent(p,{esc,btn})}</article>`).join('')}</div></section>`:'')+
 `<div class="row spread section-title"><h2>Your rewards</h2>${btn('+ Create a reward','new-reward','','secondary compact')}</div><div class="reward-grid">${state.rewards.map(r=>`<article class="reward"><h3>${esc(r.name)}</h3><p>${r.kind==='screentime'?r.minutes+' min phone time':r.minutes?r.minutes+' min':'Untimed'}</p><div class="row spread wrap"><span class="pill">${r.cost} coins</span>${btn(r.kind==='screentime'?'Buy key':'Enjoy','buy',r.id,'primary compact',state.coins<r.cost?'disabled':'')}${btn('Edit','edit-reward',r.id,'text compact')}${btn('×','reward-delete',r.id,'text compact','aria-label="Remove reward"')}</div></article>`).join('')}</div>
 ${saved.length?`<section class="saved-rewards"><h2>Saved rewards</h2><div class="task-list">${saved.map(p=>`<div class="task-row"><span class="task-content">${esc(p.reward)} · ${p.minutes} min</span>${btn('Start break','redeem',p.id,'soft compact')}</div>`).join('')}</div></section>`:''}
 ${recent.length?`<section class="recent-payouts"><h2>Recent payouts</h2>${recent.map(e=>`<div class="row spread"><span>${esc(e.title)}</span><span>+${e.coins} coins</span></div>`).join('')}</section>`:''}
 <div class="row wrap reward-tools">${btn('Goals','reward-goals','','text compact')}${btn('Collection','collection','','text compact')}${btn('Phone setup','screentime-setup','','text compact')}</div>`;
}
