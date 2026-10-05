import React, { useState } from 'react';
import { useStore } from '../store/useStore';

const COLOR_CHIPS = {
  red: '#ef4444', orange: '#f97316', amber: '#f59e0b',
  lime: '#84cc16', green: '#22c55e', teal: '#14b8a6',
  cyan: '#06b6d4', blue: '#3b82f6', indigo: '#6366f1',
  violet: '#8b5cf6', purple: '#a855f7', pink: '#ec4899',
  rose: '#f43f5e', slate: '#64748b',
};

const QUICK_COLORS = ['blue', 'green', 'indigo', 'violet', 'pink', 'rose', 'amber', 'teal'];

export default function TaskSidebar({ date }) {
  const sidebarTasks = useStore(s => s.sidebarTasks);
  const addToSidebar = useStore(s => s.addToSidebar);
  const startDrag = useStore(s => s.startDrag);
  const removeFromSidebar = useStore(s => s.removeFromSidebar);
  const [input, setInput] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [pickColor, setPickColor] = useState('blue');
  const [pickIcon, setPickIcon] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  const handleAdd = () => {
    if (input.trim()) { addToSidebar(input.trim(), { color: pickColor, icon: pickIcon }, date); setInput(''); setPickIcon(''); setShowOptions(false); }
  };

  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setIsDragOver(true); };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const st = useStore.getState();
    if (st.dragTask) { st.unassignTask(st.dragTask, date); st.endDrag(); }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`w-80 flex-shrink-0 border-r border-slate-700/30 flex flex-col transition-all duration-200 ${isDragOver ? 'ring-2 ring-indigo-500/40 ring-inset bg-indigo-500/5' : ''}`}
      style={{ background: '#0f172a' }}
    >
      <div className="px-4 py-3 border-b border-slate-700/30">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-slate-300 tracking-wider uppercase">Tasks Inbox</span>
          <span className="text-xs text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded-full">{sidebarTasks.length}</span>
        </div>
        <div className="flex gap-1.5">
          <div className="relative flex-1 flex gap-1.5">
            {showOptions && (
              <input
                value={pickIcon}
                onChange={e => setPickIcon(e.target.value)}
                placeholder="☕"
                className="w-9 h-9 bg-slate-800/50 border border-slate-700/50 rounded-lg text-center text-base focus:outline-none focus:border-indigo-500/40"
              />
            )}
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
              onFocus={() => setShowOptions(true)}
              placeholder="Add task..."
              className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/40"
            />
          </div>
          <button onClick={handleAdd} className="px-3 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 rounded-lg text-sm text-indigo-300/70 transition font-medium">+</button>
        </div>
        {showOptions && (
          <div className="flex items-center gap-1 mt-2 flex-wrap">
            {QUICK_COLORS.map(c => (
              <button key={c} onClick={() => setPickColor(c)} className={`w-4 h-4 rounded-full transition-all ${pickColor === c ? 'ring-2 ring-white/60 scale-110' : 'ring-1 ring-white/10'}`} style={{ background: COLOR_CHIPS[c] }} />
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isDragOver && (
          <div className="text-xs text-indigo-400/60 text-center py-6 border-2 border-dashed border-indigo-500/30 rounded-lg">
            Drop to unassign
          </div>
        )}
        {!isDragOver && sidebarTasks.length === 0 && (
          <div className="text-xs text-slate-600 text-center py-8 italic">
            No tasks in inbox.<br />Add one above.
          </div>
        )}
        {sidebarTasks.map((task) => {
          const chipColor = COLOR_CHIPS[task.color] || COLOR_CHIPS.slate;
          return (
            <div
              key={task.id}
              draggable
              onDragStart={(e) => { e.dataTransfer.setData('text/plain', task.id); startDrag(task); }}
              onDragEnd={() => useStore.getState().endDrag()}
              className="group flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-slate-700/30 transition sidebar-card animate-slide-up cursor-grab active:cursor-grabbing"
            >
              <svg
                className="w-4 h-4 text-slate-600 flex-shrink-0 group-hover:text-slate-400 transition"
                viewBox="0 0 24 24" fill="currentColor"
              >
                <circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" />
                <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                <circle cx="9" cy="19" r="1.5" /><circle cx="15" cy="19" r="1.5" />
              </svg>
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: chipColor, boxShadow: `0 0 6px ${chipColor}60` }} />
              {task.icon && <span className="text-base flex-shrink-0">{task.icon}</span>}
              <span className="text-sm text-slate-200 truncate flex-1 font-medium">{task.title}</span>
              <button onClick={(e) => { e.stopPropagation(); removeFromSidebar(task.id); }} className="text-xs text-slate-600 opacity-0 group-hover:opacity-100 transition hover:text-red-400">✕</button>
            </div>
          );
        })}
      </div>

      <div className="p-3 border-t border-slate-700/30">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
          <span>Drag tasks onto grid</span>
        </div>
      </div>
    </div>
  );
}
