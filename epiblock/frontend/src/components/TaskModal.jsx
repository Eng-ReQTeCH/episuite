import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';

const EMOJIS = ['💻','📝','📞','📧','☕','🍕','🏋️','🧘','🚗','✈️','🎯','📚','🎨','🛒','🧹','💊','🏃','🎵','📸','🔧','💡','🗣️','🤝','🧠'];

const COLOR_OPTIONS = [
  { id: 'slate', label: 'Slate', hex: '#64748b' },
  { id: 'red', label: 'Red', hex: '#ef4444' },
  { id: 'orange', label: 'Orange', hex: '#f97316' },
  { id: 'amber', label: 'Amber', hex: '#f59e0b' },
  { id: 'lime', label: 'Lime', hex: '#84cc16' },
  { id: 'green', label: 'Green', hex: '#22c55e' },
  { id: 'teal', label: 'Teal', hex: '#14b8a6' },
  { id: 'cyan', label: 'Cyan', hex: '#06b6d4' },
  { id: 'blue', label: 'Blue', hex: '#3b82f6' },
  { id: 'indigo', label: 'Indigo', hex: '#6366f1' },
  { id: 'violet', label: 'Violet', hex: '#8b5cf6' },
  { id: 'purple', label: 'Purple', hex: '#a855f7' },
  { id: 'pink', label: 'Pink', hex: '#ec4899' },
  { id: 'rose', label: 'Rose', hex: '#f43f5e' },
];

export default function TaskModal() {
  const taskModal = useStore(s => s.taskModal);
  const editingTask = useStore(s => s.editingTask);
  const closeTaskModal = useStore(s => s.closeTaskModal);
  const createTask = useStore(s => s.createTask);
  const updateTask = useStore(s => s.updateTask);
  const deleteTask = useStore(s => s.deleteTask);
  const unassignTask = useStore(s => s.unassignTask);

  const task = editingTask;
  const isEditing = !!task;
  const blockIndex = task?.block_index ?? taskModal ?? 0;

  const [title, setTitle] = useState(task?.title || '');
  const [blockIdx, setBlockIdx] = useState(blockIndex);
  const [isAbsolute, setIsAbsolute] = useState(task?.is_absolute || false);
  const [targetTime, setTargetTime] = useState(task?.target_time ? new Date(task.target_time).toTimeString().slice(0, 5) : '');
  const [duration, setDuration] = useState(task?.duration_minutes || 15);
  const [status, setStatus] = useState(task?.status || 'pending');
  const [color, setColor] = useState(task?.color || 'slate');
  const [icon, setIcon] = useState(task?.icon || '');
  const [span, setSpan] = useState(1);

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') closeTaskModal(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    const payload = {
      title: title.trim(),
      block_index: blockIdx,
      is_absolute: isAbsolute,
      duration_minutes: duration,
      status,
      color,
      icon,
    };
    if (isAbsolute && targetTime) {
      const d = new Date();
      payload.target_time = `${d.toISOString().split('T')[0]}T${targetTime}:00`;
    }
    if (isEditing) updateTask(task.id, payload);
    else createTask({ ...payload, span });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={closeTaskModal}>
      <div className="bg-[#0f0f24] rounded-t-2xl sm:rounded-2xl w-full max-w-md border border-white/[0.06] shadow-2xl p-5 sm:mb-0 animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white/70">{isEditing ? 'Edit Task' : 'New Task'}</h2>
          <button onClick={closeTaskModal} className="text-white/20 hover:text-white/50">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-shrink-0">
              <input
                value={icon}
                onChange={e => setIcon(e.target.value)}
                className="w-12 h-12 bg-white/[0.04] border border-white/[0.06] rounded-xl text-center text-xl focus:outline-none focus:border-indigo-500/40"
                placeholder="☕"
              />
            </div>
            <input autoFocus value={title} onChange={e => setTitle(e.target.value)} className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-3 text-white/80 text-sm focus:outline-none focus:border-indigo-500/40 placeholder-white/20" placeholder="What are you working on?" />
          </div>

          <div>
            <label className="block text-[10px] text-white/30 mb-1">Quick emoji picker &mdash; or type any emoji above</label>
            <div className="flex gap-1 flex-wrap max-h-20 overflow-y-auto">
              {EMOJIS.map(e => (
                <button key={e} type="button" onClick={() => setIcon(icon === e ? '' : e)} className={`text-lg w-7 h-7 flex items-center justify-center rounded transition ${icon === e ? 'bg-indigo-500/20 ring-1 ring-indigo-400/40' : 'hover:bg-white/[0.06]'}`}>{e}</button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] text-white/30 mb-1">Block</label>
              <input type="number" min={0} max={95} value={blockIdx} onChange={e => setBlockIdx(parseInt(e.target.value) || 0)} className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-white/60 text-sm focus:outline-none focus:border-indigo-500/40" />
            </div>
            <div>
              <label className="block text-[10px] text-white/30 mb-1">Duration</label>
              <input type="number" min={1} max={120} value={duration} onChange={e => setDuration(parseInt(e.target.value) || 15)} className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-white/60 text-sm focus:outline-none focus:border-indigo-500/40" />
            </div>
            {!isEditing && (
              <div>
                <label className="block text-[10px] text-white/30 mb-1">Span</label>
                <input type="number" min={1} max={48} value={span} onChange={e => setSpan(Math.max(1, parseInt(e.target.value) || 1))} className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-white/60 text-sm focus:outline-none focus:border-indigo-500/40" />
              </div>
            )}
          </div>

          <div>
            <label className="block text-[10px] text-white/30 mb-1.5">Color</label>
            <div className="flex gap-1 flex-wrap">
              {COLOR_OPTIONS.map(c => (
                <button key={c.id} type="button" onClick={() => setColor(c.id)} className={`w-6 h-6 rounded-full transition-all ${color === c.id ? 'ring-2 ring-white/60 scale-110' : 'ring-1 ring-white/10 hover:scale-105'}`} style={{ background: c.hex }} />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isAbsolute} onChange={e => setIsAbsolute(e.target.checked)} className="rounded bg-white/[0.04] border-white/20 text-indigo-500 focus:ring-indigo-500 w-4 h-4" />
              <span className="text-xs text-white/40">Pin time</span>
            </label>
            {isAbsolute && (
              <input type="time" value={targetTime} onChange={e => setTargetTime(e.target.value)} className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1 text-white/60 text-xs focus:outline-none focus:border-indigo-500/40" />
            )}
          </div>

          {isEditing && (
            <select value={status} onChange={e => setStatus(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-white/60 text-sm focus:outline-none focus:border-indigo-500/40">
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          )}

          <div className="flex gap-2 pt-2">
            {isEditing && (
              <>
                <button type="button" onClick={() => { unassignTask(task); closeTaskModal(); }} className="px-4 py-2.5 rounded-xl text-xs text-amber-400/70 hover:text-amber-300 hover:bg-white/[0.04] transition">Inbox</button>
                <button type="button" onClick={() => deleteTask(task.id)} className="px-4 py-2.5 rounded-xl text-xs text-red-400/70 hover:text-red-300 hover:bg-white/[0.04] transition">Delete</button>
              </>
            )}
            <button type="button" onClick={closeTaskModal} className="flex-1 bg-white/[0.04] hover:bg-white/[0.08] text-white/50 py-2.5 rounded-xl text-xs transition">Cancel</button>
            <button type="submit" disabled={!title.trim()} className="flex-1 bg-indigo-500/20 hover:bg-indigo-500/30 disabled:bg-white/[0.04] disabled:text-white/20 text-indigo-300/70 py-2.5 rounded-xl text-xs transition font-medium">
              {isEditing ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
