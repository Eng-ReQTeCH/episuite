import { create } from 'zustand';
import { api } from '../api/client';
import { todayISO, tomorrowISO } from '../utils/time';

const MACRO = { SLEEP: 'SLEEP', WOKEN_UP: 'WOKEN_UP', PREP: 'PREP' };
const BLOCKS_PER_PAGE = 12;
const TOTAL_PAGES = 8;

let colorPool = ['red','orange','amber','lime','green','teal','cyan','blue','indigo','violet','purple','pink','rose'];
let colorIdx = 0;
const nextColor = () => { const c = colorPool[colorIdx % colorPool.length]; colorIdx++; return c; };

export const useStore = create((set, get) => ({
  macro: MACRO.SLEEP,
  MACRO,
  BLOCKS_PER_PAGE,
  TOTAL_PAGES,

  day: null,
  blocks: [],
  tasks: [],
  tomorrowBlocks: [],
  tomorrowTasks: [],
  sidebarTasks: [],
  velocity: null,
  loading: false,
  now: Date.now(),

  apiStatus: 'checking',
  ollamaStatus: 'checking',

  prepDate: tomorrowISO(),
  currentPage: 0,

  taskModal: null,
  editingTask: null,
  openBlockMenu: null,

  dragTask: null,
  showSidebar: true,

  selectedBlocks: [],
  showMassEdit: false,

  initialize: async () => {
    set({ loading: true });
    try {
      const [blocksRes, tasksRes, velRes, sidebarRes] = await Promise.all([
        api.getBlocks().catch(() => null),
        api.getTasks().catch(() => null),
        api.getVelocity().catch(() => null),
        api.getSidebarTasks().catch(() => null),
      ]);
      const day = blocksRes?.day || null;
      let macro = MACRO.SLEEP;
      if (day) macro = day.is_active ? MACRO.WOKEN_UP : MACRO.SLEEP;
      set({
        blocks: blocksRes?.blocks || [], day, tasks: tasksRes?.tasks || [],
        sidebarTasks: sidebarRes?.tasks || [],
        velocity: velRes?.score != null ? velRes : null, loading: false, macro,
      });
    } catch { set({ loading: false }); }
  },

  wakeup: async () => {
    const today = todayISO();
    try { await api.finalizeDay(today); } catch {}
    try { const res = await api.wakeup(new Date().toISOString()); set({ day: res.day, macro: MACRO.WOKEN_UP }); } catch { set({ macro: MACRO.WOKEN_UP }); }
    try {
      const [b, t] = await Promise.all([api.getBlocks().catch(() => null), api.getTasks().catch(() => null)]);
      set({ blocks: b?.blocks || [], day: b?.day || get().day, tasks: t?.tasks || [] });
    } catch {}
  },

  loadBlocks: async () => {
    try {
      const [b, v] = await Promise.all([api.getBlocks().catch(() => null), api.getVelocity().catch(() => null)]);
      set({ blocks: b?.blocks || [], day: b?.day || get().day, velocity: v?.score != null ? v : null });
    } catch {}
  },

  loadTasks: async () => {
    try { const r = await api.getTasks().catch(() => null); set({ tasks: r?.tasks || [] }); } catch {}
  },

  loadTomorrow: async () => {
    const date = get().prepDate || tomorrowISO();
    try {
      const [b, t, s] = await Promise.all([
        api.getBlocks(date).catch(() => null),
        api.getTasks(date).catch(() => null),
        api.getSidebarTasks(date).catch(() => null),
      ]);
      set({ tomorrowBlocks: b?.blocks || [], tomorrowTasks: t?.tasks || [], sidebarTasks: s?.tasks || [] });
    } catch {}
  },

  checkStatus: async () => {
    try { await api.health(); set({ apiStatus: 'online' }); } catch { set({ apiStatus: 'offline' }); }
  },

  tick: () => set({ now: Date.now() }),
  setPage: (page) => set({ currentPage: page }),

  setOpenBlockMenu: (blockIndex) => set(s => ({ openBlockMenu: s.openBlockMenu === blockIndex ? null : blockIndex })),

  sidebarReload: async (date) => {
    try {
      const res = await api.getSidebarTasks(date).catch(() => null);
      if (res) set({ sidebarTasks: res.tasks || [] });
    } catch {}
  },

  addToSidebar: async (title, options = {}, date) => {
    if (!title) return;
    try {
      const body = { title, color: options.color || nextColor(), icon: options.icon || '' };
      if (date) body.date = date;
      const task = await api.createSidebarTask(body);
      if (task) set(s => ({ sidebarTasks: [...s.sidebarTasks, task] }));
    } catch {}
  },
  removeFromSidebar: (id) => {
    set(s => ({ sidebarTasks: s.sidebarTasks.filter(t => t.id !== id) }));
    api.deleteTask(id).catch(() => {});
  },
  startDrag: (task) => set({ dragTask: task }),
  endDrag: () => set({ dragTask: null }),

  dropOnBlock: async (blockIndex, task) => {
    if (!task) return;
    set(s => ({ sidebarTasks: s.sidebarTasks.filter(t => t.id !== task.id) }));
    await api.assignTaskToBlock(task.id, blockIndex).catch(() => {});
    get().loadTasks();
  },

  unassignTask: async (task, date) => {
    if (!task) return;
    set(s => ({ sidebarTasks: [...s.sidebarTasks, { ...task, block_id: null }] }));
    try {
      await api.updateTask(task.id, { block_id: null });
      await get().sidebarReload(date);
    } catch {}
    get().loadTasks();
  },

  clearBlock: async (blockIndex) => {
    const ids = [...get().tasks, ...get().tomorrowTasks].filter(t => t.block_index === blockIndex).map(t => t.id);
    if (ids.length === 0) return;
    set(s => ({
      tasks: s.tasks.filter(t => t.block_index !== blockIndex),
      tomorrowTasks: s.tomorrowTasks.filter(t => t.block_index !== blockIndex),
    }));
    for (const id of ids) {
      try { await api.deleteTask(id); } catch {}
    }
    get().loadTasks();
  },

  toggleRandomize: async (taskId) => {
    const task = get().tasks.find(t => t.id === taskId);
    if (!task) return;
    try { await api.updateTask(taskId, { random_order: task.random_order ? 0 : 1 }); } catch {}
    await get().loadTasks();
  },

  toggleShowSidebar: () => set(s => ({ showSidebar: !s.showSidebar })),

  toggleBlockSelection: (blockIndex) => set(s => {
    const sel = s.selectedBlocks;
    const idx = sel.indexOf(blockIndex);
    const next = idx >= 0 ? sel.filter(i => i !== blockIndex) : [...sel, blockIndex];
    return { selectedBlocks: next, showMassEdit: next.length > 0 };
  }),
  clearSelection: () => set({ selectedBlocks: [], showMassEdit: false }),
  massCreateTask: async (title) => {
    const sel = get().selectedBlocks;
    const date = get().prepDate;
    for (const idx of sel) {
      try { await api.createTask({ title, block_index: idx, duration_minutes: 15, date }); } catch {}
    }
    set({ selectedBlocks: [], showMassEdit: false });
    get().loadTomorrow();
  },

  enterPrep: () => { set({ macro: MACRO.PREP, prepDate: tomorrowISO() }); get().loadTomorrow(); },
  exitPrep: () => { set({ macro: MACRO.WOKEN_UP, selectedBlocks: [] }); get().loadBlocks(); },
  setPrepDate: (date) => { set({ prepDate: date }); get().loadTomorrow(); },

  finalizePrep: async (date) => {
    try { await api.finalizeDay(date); if (date === todayISO()) { set({ macro: MACRO.SLEEP }); get().initialize(); } else get().loadTomorrow(); } catch {}
  },

  cloneTodayToTomorrow: async () => {
    const txs = get().tasks;
    if (!txs.length) return;
    const date = get().prepDate || tomorrowISO();
    await api.finalizeDay(date);
    for (const task of txs) {
      try { await api.createTask({ title: task.title, block_index: task.block_index, color: task.color, duration_minutes: task.duration_minutes }); } catch {}
    }
    get().loadTomorrow();
  },

  applyTemplate: async (templateBlocks) => {
    const date = get().prepDate || tomorrowISO();
    await api.finalizeDay(date);
    for (const tb of templateBlocks) {
      for (const t of (tb.tasks || [])) {
        try { await api.createTask({ title: t.title, block_index: tb.index, duration_minutes: t.duration || 15 }); } catch {}
      }
    }
    get().loadTomorrow();
  },

  shiftSchedule: async (minutes) => {
    try { await api.shiftLater(minutes); const r = await api.getBlocks(); set({ blocks: r.blocks || [] }); } catch {}
  },
  catchUp: async () => { await get().shiftSchedule(15); },

  clearRemaining: async () => {
    for (const task of get().tasks) {
      if (task.status !== 'completed') { try { await api.deleteTask(task.id); } catch {} }
    }
    await get().loadBlocks();
  },

  createTask: async (data) => {
    const { span = 1, ...rest } = data;
    const base = { color: 'slate', icon: '', ...rest };
    if (span > 1) {
      for (let i = 0; i < span; i++) {
        try { await api.createTask({ ...base, block_index: base.block_index + i }); } catch {}
      }
    } else {
      try { await api.createTask(base); } catch {}
    }
    set({ taskModal: null }); get().loadTasks();
  },

  updateTask: async (id, data) => {
    try { await api.updateTask(id, data); } catch {}
    set({ editingTask: null, openBlockMenu: null }); get().loadTasks();
  },

  deleteTask: async (id) => {
    try { await api.deleteTask(id); } catch {}
    get().loadTasks();
  },

  openTaskModal: (blockIndex) => set({ taskModal: blockIndex }),
  closeTaskModal: () => set({ taskModal: null, editingTask: null }),
  openEditTask: (task) => set({ editingTask: task, taskModal: null }),
}));
