import {addDays, validDate, InputError} from './domain.js';
export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function shortcutInput(data){
 const name=String(data.name||'').trim();let url;
 try{url=new URL(data.url);}catch{throw new InputError('Enter a full website URL, including https://.');}
 if(!name||name.length>80)throw new InputError('Use a shortcut name between 1 and 80 characters.');
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.href.length>2000)throw new InputError('Use an HTTP or HTTPS website link without credentials.');
 return {name,url:url.href};
}
export function activity(state){
 const all=Object.create(null),byTask=Object.create(null),byCategory=Object.create(null),focus=Object.create(null),visits=state.life?.visits||{};
 for(const t of state.tasks){const counts={};for(const [day,entries] of Object.entries(t.history||{})){if(!validDate(day)||!Array.isArray(entries))continue;counts[day]=entries.length;all[day]=(all[day]||0)+entries.length;(byCategory[t.category]||={})[day]=(byCategory[t.category]?.[day]||0)+entries.length;}byTask[t.id]=counts;}
 for(const s of state.sessions)if(s.mode==='focus'&&s.minutes>0)focus[s.date]=(focus[s.date]||0)+s.minutes;
 return {all,byTask,byCategory,focus,visits,workDays:new Set([...Object.keys(all).filter(d=>all[d]>0),...Object.keys(focus)])};
}
export function heatmap(counts,end,label,unit='check-offs',startDate){
 const start=startDate||addDays(end,-364),offset=new Date(start+'T12:00:00Z').getUTCDay(),cells=[];
 const months=[];for(let i=0;i<=Math.round((Date.parse(end)-Date.parse(start))/86400000);i++){const day=addDays(start,i);if(i===0||day.endsWith('-01'))months.push(`<span style="grid-column:${Math.floor((i+offset)/7)+1}">${new Date(day+'T12:00:00Z').toLocaleString('en',{month:'short',timeZone:'UTC'})}</span>`);}
 for(let i=0;i<offset;i++)cells.push('<span class="heat-blank"></span>');
 for(let i=0,days=Math.round((Date.parse(end)-Date.parse(start))/86400000)+1;i<days;i++){const day=addDays(start,i),n=Number(counts[day])||0;cells.push(`<span class="heat-cell heat-${Math.min(4,n)}" tabindex="${addDays(start,i)===end?0:-1}" aria-label="${day}: ${n} ${escapeHTML(unit)}" data-detail="${day}: ${n} ${escapeHTML(unit)}" title="${day}: ${n} ${escapeHTML(unit)}"></span>`);}
 const total=Object.entries(counts).filter(([d])=>d>=start&&d<=end).reduce((a,[,n])=>a+Number(n||0),0);
 return `<section class="contribution"><div class="row between"><h3>${escapeHTML(label)}</h3><span>${total} ${escapeHTML(unit)}</span></div><p class="small muted">${start} → ${end} · Each square is a day, Sunday first. Use arrow keys to explore days.</p><div class="heat-scroll" role="group" aria-label="${escapeHTML(label)} daily activity"><div class="heat-months">${months.join('')}</div><div class="heat-grid">${cells.join('')}</div></div><div class="heat-legend small muted">Less ${[0,1,2,3,4].map(n=>`<i class="heat-cell heat-${n}"></i>`).join('')} More · 0, 1, 2, 3, 4+</div></section>`;
}
