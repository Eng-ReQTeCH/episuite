import { done, InputError, isDue, uid, dateKey } from './domain.js';
import { escapeHTML as e } from './life.js';

export function projectInput(data, existing = {}) {
  const title = String(data.title ?? existing.title ?? '').trim().slice(0, 160);
  const status = data.status ?? existing.status ?? 'active';
  if (!title || !['active', 'waiting', 'done'].includes(status)) throw new InputError('Give the project a name and valid status.');
  return {
    id: existing.id || uid(), title, outcome: String(data.outcome ?? existing.outcome ?? '').slice(0, 1000),
    status, waitingFor: String(data.waitingFor ?? existing.waitingFor ?? '').slice(0, 300),
    nextTaskId: String(data.nextTaskId ?? existing.nextTaskId ?? '').slice(0, 100),
    editVersion: existing.editVersion || 0
  };
}

export function normalizeProjects(state) {
  state.operationReceipts ??= {};
  if (typeof state.operationReceipts !== 'object' || Array.isArray(state.operationReceipts)) throw new InputError('Invalid pending-change receipts.');
  state.projects ??= [];
  if (!Array.isArray(state.projects)) throw new InputError('Backup projects must be a list.');
  const ids = new Set();
  state.projects = state.projects.map(project => {
    if (!project || typeof project.id !== 'string' || !/^[a-z0-9-]{1,100}$/i.test(project.id) || ids.has(project.id)) throw new InputError('Invalid project record.');
    if (!Number.isSafeInteger(project.editVersion) || project.editVersion < 0) throw new InputError('Invalid project version.');
    ids.add(project.id);
    return projectInput(project, project);
  });
  for (const task of state.tasks) {
    task.projectId ||= '';
    task.workStatus ||= 'ready';
    task.waitingFor ||= '';
    if (task.projectId && !ids.has(task.projectId)) task.projectId = '';
  }
  for (const project of state.projects) {
    if (!state.tasks.some(task => !task.deleted && task.projectId === project.id && task.id === project.nextTaskId)) project.nextTaskId = '';
  }
}

export function validateTaskProject(state, task) {
  if (task.projectId && !state.projects.some(project => project.id === task.projectId)) throw new InputError('Choose an existing project.');
}
export function reconcileProjectLinks(state) {
  for (const project of state.projects) {
    if (project.nextTaskId && !state.tasks.some(task => task.id === project.nextTaskId && task.projectId === project.id && !task.deleted)) {
      project.nextTaskId = '';
      project.editVersion++;
    }
  }
}

export function projectMutation(state, path, method, data) {
  if (path === '/api/projects' && method === 'POST') {
    const project = projectInput(data);
    project.editVersion = 1;
    state.projects.push(project);
    return project;
  }
  const match = path.match(/^\/api\/projects\/([^/]+)$/);
  if (!match) return null;
  const project = state.projects.find(item => item.id === match[1]);
  if (!project) throw Object.assign(new InputError('Project not found.'), { status: 404 });
  if (Number(data.expectedVersion) !== project.editVersion) throw Object.assign(new InputError('The project changed. Reopen its editor.'), { status: 409 });
  if (method === 'DELETE') {
    state.projects = state.projects.filter(item => item.id !== project.id);
    for (const task of state.tasks) if (task.projectId === project.id) { task.projectId = ''; task.editVersion = (task.editVersion || 0) + 1; }
    return { ok: true };
  }
  const update = projectInput(data, project);
  if (update.nextTaskId && !state.tasks.some(task => task.id === update.nextTaskId && task.projectId === project.id && !task.deleted)) throw new InputError('Choose a task belonging to this project.');
  Object.assign(project, update, { editVersion: project.editVersion + 1 });
  return project;
}

const button = (label, action, id = '', style = 'secondary') => `<button class="btn ${style} compact" type="button" data-action="${action}" data-id="${e(id)}">${label}</button>`;

function card(state, project, today, compact = false, expanded = false) {
  const tasks = state.tasks.filter(task => task.projectId === project.id && !task.deleted);
  const completed = tasks.filter(task => done(task, today)).length;
  const next = tasks.find(task => task.id === project.nextTaskId && isDue(task, today)) || tasks.find(task => isDue(task, today));
  return `<article class="settings-panel project-card">
    <div class="row spread wrap"><h2>${e(project.title)}</h2>${button('Edit', 'project-edit', project.id, 'text')}</div>
    <p>${e(project.outcome)}</p><p class="small">${e(project.status)} · ${completed}/${tasks.length} tasks complete</p>
    ${project.waitingFor ? `<p class="small">Waiting for · ${e(project.waitingFor)}</p>` : ''}
    ${button('Add task', 'project-task', project.id)}
    ${next && project.status === 'active' ? `<p>Next · ${e(next.nextAction || next.title)}</p>${button('Start next task', 'burst', next.id, 'primary')}` : ''}
    ${expanded?`<section class="project-tasks"><h3>Tasks</h3>${tasks.map(task => `<p><button class="task-title" data-action="edit-task" data-id="${e(task.id)}">${e(task.title)}</button>${task.workStatus === 'waiting' ? ` · waiting for ${e(task.waitingFor || 'a next step')}` : ''}${!done(task,today)?button('Make next','project-next',task.id,'text'):''}</p>`).join('') || '<p class="small">Add the first task for this outcome.</p>'}</section>`:!compact&&tasks.length?button('Tasks ('+tasks.length+')','project-tasks',project.id,'text'):''}
  </article>`;
}

export function projectsPanel(state, today, compact = false, status = 'active') {
  const projects = state.projects || [];
  const visible = compact ? projects.filter(project => project.status === 'active').slice(0, 2) : projects.filter(project=>project.status===status);
  return `<section class="projects-panel"><div class="${compact?'board-section-heading':'page-heading'}"><${compact?'h2':'h1'}>Projects</${compact?'h2':'h1'}><div class="row wrap">${button('New project', 'project-new')}${compact && projects.length ? button('All projects', 'nav', 'projects', 'text') : ''}</div></div>
    ${!compact?`<div class="tabs" aria-label="Project status">${[['active','Active'],['waiting','Waiting'],['done','Done']].map(([id,label])=>`<button data-action="project-status" data-id="${id}" aria-pressed="${status===id}" class="${status===id?'active':''}">${label} ${projects.filter(p=>p.status===id).length}</button>`).join('')}</div>`:''}
    ${visible.length ? `<div class="book-grid">${visible.map(project => card(state, project, today, compact)).join('')}</div>` : '<p class="small">No '+status+' projects.</p>'}</section>`;
}

export function projectTools({ getState, request, render, showDialog, closeDialog, field, select, toast }) {
  let status='active';
  return {
    status:()=>status,
    async handle(name, id) {
      if(name==='project-status'){status=id;render();return true;}
      if(name==='project-tasks'){const state=getState(),project=state.projects.find(p=>p.id===id);if(!project)throw Error('Project not found.');showDialog(project.title,card(state,project,dateKey(Date.now(),state.settings.timezone),false,true));return true;}
      if (name === 'project-next') {
        const task = getState().tasks.find(item => item.id === id && !item.deleted);
        if (!task) throw Error('Task no longer exists.');
        const project = getState().projects.find(item => item.id === task.projectId);
        if (!project) throw Error('Project no longer exists.');
        await request('/api/projects/' + project.id, { nextTaskId: task.id, expectedVersion: project.editVersion }, 'PATCH');
        closeDialog();render(); toast('Next task selected.'); return true;
      }
      if (!['project-new', 'project-edit', 'project-remove', 'project-confirm-remove'].includes(name)) return false;
      const state = getState(), project = state.projects.find(item => item.id === id);
      if (name === 'project-confirm-remove') {
        await request('/api/projects/' + id, { expectedVersion: Number(document.querySelector('#project-remove-version').value) }, 'DELETE');
        closeDialog(); render(); toast('Project removed. Its tasks are in All tasks.'); return true;
      }
      if (name === 'project-remove') {
        showDialog('Remove project?', `<p>${e(project.title)}</p><input id="project-remove-version" type="hidden" value="${project.editVersion}">${button('Remove project', 'project-confirm-remove', id, 'danger')}`);
        return true;
      }
      const current = project || { title: '', outcome: '', status: 'active', nextTaskId: '', waitingFor: '' };
      const tasks = state.tasks.filter(task => task.projectId === id && !task.deleted);
      showDialog(project ? 'Edit project' : 'New project', `<input type="hidden" name="id" value="${e(project?.id || '')}"><input type="hidden" name="expectedVersion" value="${project?.editVersion || 0}">
        ${field('Project name', 'title', current.title, 'text', 'required maxlength="160"')}
        ${field('What will be different when this is done?', 'outcome', current.outcome, 'text', 'maxlength="1000"')}
        ${select('Status', 'status', [['active', 'Active'], ['waiting', 'Waiting'], ['done', 'Done']], current.status)}
        ${field('Waiting for (optional)', 'waitingFor', current.waitingFor, 'text', 'maxlength="300"')}
        ${project ? select('Next task', 'nextTaskId', [['', 'First available task'], ...tasks.map(task => [task.id, task.title])], current.nextTaskId) + button('Remove project', 'project-remove', project.id, 'text danger') : ''}`,
        'project', 'Save project');
      return true;
    },
    async submit(type, data) {
      if (type !== 'project') return false;
      await request(data.id ? '/api/projects/' + data.id : '/api/projects', data, data.id ? 'PATCH' : 'POST');
      closeDialog(); render(); toast('Project saved.'); return true;
    }
  };
}
