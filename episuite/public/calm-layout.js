// Presentation-only grouping: existing forms and delegated actions stay intact.
const disclosures = new Map(), listPages = new Map();
let settingsSection = 'appearance', captureQuery = '';
const text = (tag, value, cls) => { const node=document.createElement(tag);node.textContent=value;if(cls)node.className=cls;return node; };
function fold(parent, nodes, title, key, prepend = false) {
  nodes=nodes.filter(Boolean);if(!nodes.length)return;
  const details=document.createElement('details');details.className='calm-disclosure';details.dataset.disclosure=key;details.open=Boolean(disclosures.get(key));
  details.append(text('summary',title));const content=document.createElement('div');content.className='calm-disclosure-content';nodes.forEach(n=>content.append(n));details.append(content);
  if(prepend)parent.prepend(details);else parent.append(details);
  details.addEventListener('toggle',()=>disclosures.set(key,details.open));return details;
}
function bounded(container, selector, key, size=6, query='') {
  const items=[...container.querySelectorAll(selector)];if(!items.length)return;
  const matching=items.filter(n=>!query||n.textContent.toLowerCase().includes(query.toLowerCase()));
  const pages=Math.max(1,Math.ceil(matching.length/size)),current=Math.min(listPages.get(key)||0,pages-1);listPages.set(key,current);
  items.forEach(n=>n.hidden=true);matching.slice(current*size,current*size+size).forEach(n=>n.hidden=false);
  container.querySelector(`[data-pagination="${key}"]`)?.remove();
  if(matching.length>size){const nav=document.createElement('nav');nav.className='calm-pagination';nav.dataset.pagination=key;nav.setAttribute('aria-label',key+' pages');
    for(const [label,step] of [['← Previous',-1],['Next →',1]]){const button=text('button',label,'btn text compact');button.type='button';button.dataset.action='layout-page';button.dataset.id=key;button.dataset.step=step;button.disabled=step<0?current===0:current===pages-1;button.addEventListener('click',()=>{listPages.set(key,current+step);bounded(container,selector,key,size,query);});if(step===1)nav.append(text('span',`${current+1} / ${pages}`));nav.append(button);}container.append(nav);
  }
  let empty=container.querySelector('.calm-search-empty');if(empty)empty.remove();if(!matching.length)container.append(text('p','No matching notes. Try another search.','calm-search-empty muted small'));
}
function taskMenus(main){
  for(const row of main.querySelectorAll('.task-row')){
    const tools=row.querySelector('.task-tools');if(!tools)continue;
    const secondary=[...tools.children].filter(n=>!['focus-task','today-task','undo-habit'].includes(n.dataset.action));
    if(!secondary.length)continue;const menu=document.createElement('details');menu.className='task-more';const summary=text('summary','⋯');summary.setAttribute('aria-label','More actions for '+row.querySelector('.task-title').textContent);menu.append(summary);const body=document.createElement('div');body.className='task-more-menu';secondary.forEach(n=>body.append(n));menu.append(body);tools.append(menu);
    menu.addEventListener('toggle',()=>{if(menu.open)main.querySelectorAll('.task-more[open]').forEach(other=>{if(other!==menu)other.open=false;});});
  }
}
function settings(main){
  const groups=[['appearance','Appearance & accessibility'],['rhythm','Focus & breaks'],['feedback','Encouragement & rewards'],['phone','Phone notifications'],['data','Backups & categories'],['calendar','Calendar sync'],['tools','Background & local AI'],['help','Setup & help']];
  const sections=[...main.querySelectorAll('.settings-panel,.guide-settings')];
  const map={'Your space':'appearance','Your rhythm':'rhythm','Make progress feel good':'feedback','Random task payouts':'feedback','Phone notifications':'phone','Keep your data safe':'data','Calendar connection':'calendar','A little help getting started':'tools','Connect your watch':'help'};
  sections.forEach(section=>section.dataset.settingsGroup=map[section.querySelector('h2')?.textContent]||'help');
  const label=text('label','Choose a settings section','settings-section-label'),select=document.createElement('select');select.id='settings-section';select.setAttribute('aria-label','Settings section');groups.forEach(([value,name])=>{const option=text('option',name);option.value=value;select.append(option);});select.value=settingsSection;label.append(select);main.querySelector('.page-heading').after(label);
  const prefs=main.querySelector('[data-form="settings"]');
  const show=()=>{sections.forEach(section=>section.hidden=section.dataset.settingsGroup!==settingsSection);if(prefs)prefs.hidden=!['appearance','rhythm'].includes(settingsSection);};
  select.addEventListener('change',()=>{settingsSection=select.value;show();});show();
  main.querySelectorAll('.settings-grid').forEach(grid=>grid.classList.add('calm-settings-grid'));
  const phone=main.querySelector('[data-form="phone"]');
  if(phone){const provider=phone.querySelector('[name="provider"]'),toggleProvider=()=>{const ntfy=provider.value==='ntfy';for(const name of ['ntfyUrl','topic','ntfyToken','clearNtfyToken']){const control=phone.querySelector(`[name="${name}"]`);if(control)control.closest('.field,.switch-row').hidden=!ntfy;}for(const name of ['botToken','clearBotToken','chatId']){const control=phone.querySelector(`[name="${name}"]`);if(control)control.closest('.field,.switch-row').hidden=ntfy;}};provider.addEventListener('change',toggleProvider);toggleProvider();}
  const intro=main.querySelector('.page-heading p');if(intro)intro.textContent='One thing to adjust at a time.';
}
function sectionRun(main, title){const heading=[...main.querySelectorAll(':scope > .section-title')].find(n=>n.querySelector('h2')?.textContent===title);if(!heading)return [];const nodes=[heading];for(let n=heading.nextElementSibling;n&&!n.matches('.section-title,.calm-disclosure');n=n.nextElementSibling)nodes.push(n);return nodes;}
export function applyCalmLayout(page, main, state){
  main.dataset.page=page;taskMenus(main);
  if(page==='tasks'){const list=main.querySelector('.task-list');if(list)bounded(list,':scope > .task-row','tasks',6);}
  if(page==='now'){
    const supporting=[...main.querySelectorAll(':scope > .return-cue,:scope > .momentum-panel,:scope > .daily-strip,:scope > .daily-spark,:scope > .support-grid,:scope > .social-now')];
    fold(main,supporting,'More for today · progress, capture & people','today-support');
    if(!state.timer){const timer=main.querySelector('.timer-panel');if(timer){const parent=timer.parentElement;fold(parent,[timer],'Choose a timer instead','today-timer');}}
  }
  if(page==='focus')fold(main,[...main.querySelectorAll('.session-receipt,.focus-options')],'Sound & saved session','focus-extras');
  if(page==='settings')settings(main);
  if(page==='capture'){
    const rows=[...main.querySelectorAll(':scope > .note-row')];if(rows.length){const list=document.createElement('section');list.className='calm-notes';list.setAttribute('aria-label','Parked thoughts');rows[0].before(list);rows.forEach(n=>list.append(n));
      const label=text('label','Find a parked thought','calm-search-label'),input=document.createElement('input');input.type='search';input.id='capture-search';input.placeholder='Search your notes…';input.value=captureQuery;label.append(input);list.before(label);input.addEventListener('input',()=>{captureQuery=input.value;listPages.set('notes',0);bounded(list,':scope > .note-row','notes',4,captureQuery);});bounded(list,':scope > .note-row','notes',4,captureQuery);}
  }
  if(page==='social'){
    const list=main.querySelector('.social-people');if(list)bounded(list,':scope > .person-card','people',4);
    for(const card of main.querySelectorAll('.person-card')){const header=card.querySelector(':scope > .row'),actions=card.querySelector(':scope > .row:last-child');if(actions){const primary=actions.querySelector('[data-action="social-checkin"]'),due=header?.querySelector('.pill');if(primary)header.append(primary);const secondary=[...actions.children].filter(n=>n.dataset.action!=='social-checkin'),notes=[...card.querySelectorAll('.person-note')],circles=card.querySelector('.social-person-circles'),paragraphs=[...card.querySelectorAll(':scope > p')],nextPlan=card.querySelector('.person-next-plan');if(due&&paragraphs[0])paragraphs[0].append(text('span',' · check-in due','social-due-note'));fold(card,[circles,due,...paragraphs.slice(1),nextPlan,...notes,...secondary],'Notes & more','person-'+card.querySelector('[data-action="social-person"]').dataset.id);if(!actions.children.length)actions.remove();}}
    const circles=main.querySelector('.social-circles');if(circles){const wrapper=circles.parentElement,heading=circles.previousElementSibling;fold(wrapper,[heading,circles],'Filter & manage circles','social-circles',true);}
    const aside=main.querySelector('.social-aside');if(aside){const wrapper=aside.parentElement;fold(wrapper,[aside],'Upcoming plans','social-plans');}
  }
  if(page==='progress'){
    const collection=[...main.querySelectorAll(':scope > .growth-panel,:scope > .keepsake-section')];
    const history=sectionRun(main,'Recent focus'),reflections=sectionRun(main,'Your reflections'),support=[...main.querySelectorAll(':scope > .support-grid,:scope > .social-now')];
    fold(main,collection,'Growth & keepsakes','progress-collection');fold(main,history,'Focus history','progress-history');fold(main,[...reflections,...support],'Reflections & support','progress-reflection');
    const heading=main.querySelector('.page-heading');const action=text('button','Reflect & close today','btn secondary compact');action.dataset.action='end-day';heading.append(action);
  }
  if(page==='rewards'){
    const random=main.querySelector(':scope > .settings-panel:not(details)');if(random)fold(main,[random],'Task payouts & recent wins','reward-payouts');
    const goals=sectionRun(main,'Gentle goals'),collection=sectionRun(main,'A growing collection'),timers=sectionRun(main,'Ready to enjoy');
    fold(main,goals,'Gentle goals','reward-goals');fold(main,collection,'Collection & milestones','reward-collection');
    if(!state.redemption)fold(main,timers,'Saved timers & phone setup','reward-timers');
    const shopHeading=[...main.querySelectorAll('.section-title')].find(n=>n.querySelector('h2')?.textContent==='Your rewards');const shop=shopHeading?.nextElementSibling;if(shop?.matches('.reward-grid')){shop.classList.add('calm-shop');for(const card of shop.querySelectorAll('.reward')){const controls=[...card.querySelectorAll('[data-action="edit-reward"],[data-action="reward-delete"]')];if(controls.length){const menu=document.createElement('details');menu.className='task-more reward-more';const summary=text('summary','⋯');summary.setAttribute('aria-label','Manage '+card.querySelector('h3').textContent+' reward');menu.append(summary);const list=document.createElement('div');list.className='task-more-menu';controls.forEach(n=>list.append(n));menu.append(list);card.append(menu);}}bounded(shop,':scope > .reward','shop',4);}
  }
  if(page==='plan'){
    const toolbar=main.querySelector('.calendar-toolbar'),heading=main.querySelector('.page-heading');if(toolbar&&heading&&toolbar.compareDocumentPosition(heading)&Node.DOCUMENT_POSITION_FOLLOWING)toolbar.before(heading);if(toolbar){const tools=[...toolbar.children].filter(n=>n.matches('a')||n.dataset.action==='calendar-sync-range');if(tools.length)fold(main,tools,'Calendar export & sync','calendar-sync');}
    const commitments=main.querySelector('.commitments-panel');if(commitments)fold(main,[commitments],'Recurring commitments & reminders','calendar-commitments');
    const agenda=main.querySelector('.calendar-agenda');if(agenda){const empty=[...agenda.querySelectorAll('.calendar-cell')].filter(n=>!n.querySelector('.calendar-event'));empty.forEach(n=>n.remove());if(!agenda.querySelector('.calendar-cell'))agenda.append(text('p','No plans in this range. Pick a date or add a commitment.','empty'));bounded(agenda,':scope > .calendar-cell','agenda',7);}
    const aside=main.querySelector('.plan-aside');if(aside){const parent=aside.parentElement;fold(parent,[aside],'Day setup & routines','day-tools');}
    const month=main.querySelector('.calendar-month');if(month&&matchMedia('(max-width:700px)').matches){month.classList.add('calm-month');for(const cell of month.querySelectorAll('.calendar-cell')){const events=[...cell.querySelectorAll('.calendar-event')],date=cell.querySelector('.calendar-date');events.forEach(event=>event.hidden=true);const fullDate=date.textContent;date.textContent=Number(date.dataset.id.slice(-2));date.setAttribute('aria-label',fullDate+', '+events.length+' plans');date.title=fullDate;if(events.length)cell.append(text('span',events.length+' plans','calendar-day-count'));}}
    const week=main.querySelector('.calendar-week');if(week){const scroll=week.closest('.calendar-scroll'),today=week.querySelector('.is-today')||week.querySelector(`[data-action="calendar-day"][data-id="${main.querySelector('#plan-date')?.value}"]`)?.closest('.calendar-cell');if(today)scroll.scrollLeft=Math.max(0,today.offsetLeft-week.offsetLeft-16);const hint=text('p','Swipe across the week · showing today first. Select a date for its day view.','small muted calendar-scroll-hint');scroll.before(hint);}
  }
}
