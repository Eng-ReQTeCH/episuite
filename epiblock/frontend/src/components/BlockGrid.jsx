import React, { useCallback, useState, useRef } from 'react';
import { useStore } from '../store/useStore';
import { formatTimeShort } from '../utils/time';

const COLORS = {
  slate: '#64748b', red: '#ef4444', orange: '#f97316', amber: '#f59e0b',
  lime: '#84cc16', green: '#22c55e', teal: '#14b8a6', cyan: '#06b6d4',
  blue: '#3b82f6', indigo: '#6366f1', violet: '#8b5cf6', purple: '#a855f7',
  pink: '#ec4899', rose: '#f43f5e',
};

function shuffleOnce(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function BlockGrid() {
  const blocks = useStore(s => s.blocks);
  const tasks = useStore(s => s.tasks);
  const day = useStore(s => s.day);
  const now = useStore(s => s.now);
  const currentPage = useStore(s => s.currentPage);
  const BLOCKS_PER_PAGE = useStore(s => s.BLOCKS_PER_PAGE);
  const openTaskModal = useStore(s => s.openTaskModal);
  const openEditTask = useStore(s => s.openEditTask);
  const deleteTask = useStore(s => s.deleteTask);
  const updateTask = useStore(s => s.updateTask);
  const startDrag = useStore(s => s.startDrag);
  const unassignTask = useStore(s => s.unassignTask);
  const clearBlock = useStore(s => s.clearBlock);

  const [dragOverBlock, setDragOverBlock] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);
  const shuffledRef = useRef({});

  const wakeMs = day?.wakeup_time ? new Date(day.wakeup_time).getTime() : 0;
  const startIdx = currentPage * BLOCKS_PER_PAGE;
  const pageBlocks = blocks.slice(startIdx, startIdx + BLOCKS_PER_PAGE);

  const allBlockTaskMap = useCallback(() => {
    const map = {};
    for (const t of tasks) {
      if (!map[t.block_index]) map[t.block_index] = [];
      map[t.block_index].push(t);
    }
    return map;
  }, [tasks]);

  const taskMap = allBlockTaskMap();

  const getBlockTasks = useCallback((blockIndex) =>
    tasks.filter(t => t.block_index === blockIndex),
    [tasks]
  );

  const getOrCreateShuffle = (blockIndex, blockTasks) => {
    const s = shuffledRef.current;
    if (!s[blockIndex]) {
      s[blockIndex] = shuffleOnce(blockTasks).map(t => t.id);
    }
    return s[blockIndex];
  };

  const ensureShuffle = (blockIndex) => {
    const bt = getBlockTasks(blockIndex);
    if (bt.some(t => t.random_order)) {
      getOrCreateShuffle(blockIndex, bt);
    } else {
      delete shuffledRef.current[blockIndex];
    }
  };

  const handleDragOver = (e, idx) => { e.preventDefault(); setDragOverBlock(idx); };
  const handleDrop = async (e, idx) => {
    e.preventDefault(); setDragOverBlock(null);
    const st = useStore.getState();
    if (st.dragTask) { await st.dropOnBlock(idx, st.dragTask); st.endDrag(); }
  };

  const toggleComplete = (task) => updateTask(task.id, { status: task.status === 'completed' ? 'pending' : 'completed' });

  const toggleBlockRandomize = async (blockIndex) => {
    const blockTasks = getBlockTasks(blockIndex);
    const hasRandom = blockTasks.some(t => t.random_order);
    const newVal = hasRandom ? 0 : 1;
    for (const t of blockTasks) {
      try { await updateTask(t.id, { random_order: newVal }); } catch {}
    }
    if (!hasRandom) {
      shuffledRef.current[blockIndex] = shuffleOnce(blockTasks).map(t => t.id);
    } else {
      delete shuffledRef.current[blockIndex];
    }
    setOpenMenu(null);
  };

  return (
    <div className="block-grid-fill max-w-4xl mx-auto">
      {pageBlocks.map((block) => {
        const idx = block.block_index;
        const blockStartMs = wakeMs > 0 ? wakeMs + idx * 15 * 60000 : null;
        const blockEndMs = blockStartMs ? blockStartMs + 15 * 60000 : null;
        const isActive = blockStartMs && now >= blockStartMs && now < blockEndMs;
        const isPast = blockEndMs && now >= blockEndMs;
        const isDragOver = dragOverBlock === idx;
        const blockTasks = getBlockTasks(idx);
        const hasRandom = blockTasks.some(t => t.random_order);
        const shuffledIds = hasRandom ? shuffledRef.current[idx] : null;

        if (hasRandom && !shuffledRef.current[idx]) {
          shuffledRef.current[idx] = shuffleOnce(blockTasks).map(t => t.id);
        }

        const displayedTasks = hasRandom && shuffledIds
          ? shuffledIds.map(id => blockTasks.find(t => t.id === id)).filter(Boolean)
          : [...blockTasks].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

        const minutes = idx * 15;
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        const label = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

        return (
          <div
            key={block.id || idx}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDragLeave={() => setDragOverBlock(null)}
            onDrop={(e) => handleDrop(e, idx)}
            onClick={() => {
              if (isPast) return;
              const allContinuation = blockTasks.length > 0 && blockTasks.every(t => {
                const pb = t.block_index - 1;
                return pb >= 0 && taskMap[pb]?.some(pt => pt.title === t.title && pt.color === t.color && pt.icon === t.icon && pt.duration_minutes === t.duration_minutes);
              });
              if (allContinuation) {
                let t0 = blockTasks[0];
                let bi = t0.block_index - 1;
                while (bi >= 0) {
                  const match = taskMap[bi]?.find(pt => pt.title === t0.title && pt.color === t0.color && pt.icon === t0.icon && pt.duration_minutes === t0.duration_minutes);
                  if (match) { t0 = match; bi--; } else break;
                }
                openEditTask(t0);
              } else {
                openTaskModal(idx);
              }
            }}
            className={`
              relative rounded-xl flex flex-col transition-all duration-200 cursor-pointer overflow-hidden
              ${isActive ? 'block-glow-active animate-glow-pulse' : 'block-glow'}
              ${isPast ? 'opacity-25' : ''}
              ${isDragOver ? 'scale-[1.02] border-indigo-500/50 bg-indigo-500/8' : ''}
              ${!isPast && !isActive ? 'bg-slate-800/20 hover:bg-slate-700/20' : ''}
              ${isActive ? 'bg-indigo-500/8' : ''}
            `}
          >
            <div className="p-3 flex flex-col h-full relative">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-mono font-semibold ${isActive ? 'text-indigo-300/90' : 'text-slate-400'}`}>
                    {label}
                  </span>
                  {blockTasks.length > 0 && (
                    <span className={`text-xs font-mono ${isActive ? 'text-indigo-400/50' : 'text-slate-600'}`}>
                      {blockTasks.length}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleBlockRandomize(idx); }}
                    className={`p-1 rounded transition ${hasRandom ? 'text-indigo-400 bg-indigo-500/15 ring-1 ring-indigo-500/30' : 'text-slate-600 hover:text-slate-400 hover:bg-slate-700/30'}`}
                    title={hasRandom ? 'Randomized order' : 'In order'}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                  <div className="relative">
                    <button
                      onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === idx ? null : idx); }}
                      className="text-slate-500 hover:text-slate-300 transition p-1"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                      </svg>
                    </button>
                    {openMenu === idx && (
                      <div className="absolute right-0 top-full mt-1 w-44 bg-slate-900 border border-slate-700/50 rounded-lg shadow-xl z-40 py-1 animate-scale-in" onClick={e => e.stopPropagation()}>
                        <button onClick={() => { openTaskModal(idx); setOpenMenu(null); }} className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700/30">Add Task</button>
                        {blockTasks.length > 0 && blockTasks.some(t => t.block_id) && (
                          <button onClick={() => { blockTasks.forEach(t => unassignTask(t)); setOpenMenu(null); }} className="w-full text-left px-3 py-2 text-sm text-slate-400 hover:bg-slate-700/30">Move to Inbox</button>
                        )}
                        <button onClick={() => { clearBlock(idx); setOpenMenu(null); }} className="w-full text-left px-3 py-2 text-sm text-red-400/70 hover:bg-slate-700/30">Clear Block</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 space-y-1 overflow-hidden">
                {displayedTasks.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <span className="text-sm text-slate-600 italic">empty</span>
                  </div>
                ) : (
                  displayedTasks.slice(0, 5).map((task) => {
                    const color = COLORS[task.color] || COLORS.slate;
                    const nextBlock = task.block_index + 1;
                    const hasContinuation = taskMap[nextBlock]?.some(t => t.title === task.title && t.color === task.color && t.icon === task.icon && t.duration_minutes === task.duration_minutes);
                    const prevBlock = task.block_index - 1;
                    const isContinuation = prevBlock >= 0 && taskMap[prevBlock]?.some(t => t.title === task.title && t.color === task.color && t.icon === task.icon && t.duration_minutes === task.duration_minutes);
                    let spanSize = 1;
                    if (!isContinuation && hasContinuation) {
                      let s = 1;
                      let bi = task.block_index + 1;
                      while (taskMap[bi]?.some(t => t.title === task.title && t.color === task.color && t.icon === task.icon && t.duration_minutes === task.duration_minutes)) {
                        s++; bi++;
                      }
                      spanSize = s;
                    }
                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => { e.dataTransfer.setData('text/plain', task.id); startDrag(task); }}
                        onDragEnd={() => useStore.getState().endDrag()}
                        onClick={(e) => { e.stopPropagation(); openEditTask(task); }}
                        className={`
                          flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm leading-tight
                          transition-all group cursor-grab active:cursor-grabbing
                          ${task.status === 'completed' ? 'line-through opacity-50' : ''}
                          hover:scale-[1.02]
                          ${isContinuation ? 'rounded-tl-none rounded-tr-none border-t-0 pt-0.5' : ''}
                        `}
                        style={{
                          background: `${color}12`,
                          borderLeft: `3px solid ${color}`,
                          boxShadow: `0 0 6px ${color}08`,
                          ...(isContinuation ? { marginTop: '-2px' } : {}),
                        }}
                      >
                        <svg className="w-4 h-4 text-slate-600/50 flex-shrink-0 group-hover:text-slate-400/70 transition" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" />
                          <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                          <circle cx="9" cy="19" r="1.5" /><circle cx="15" cy="19" r="1.5" />
                        </svg>
                        <button onClick={(e) => { e.stopPropagation(); toggleComplete(task); }} className="w-4 h-4 rounded border border-slate-500/30 flex items-center justify-center flex-shrink-0 hover:border-slate-400/50 transition">
                          {task.status === 'completed' && <svg className="w-2.5 h-2.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>}
                        </button>
                        {task.icon && <span className="text-lg flex-shrink-0">{task.icon}</span>}
                        <span className="truncate flex-1 text-slate-200 font-medium">{task.title}</span>
                        {!isContinuation && spanSize > 1 && <span className="text-[10px] text-slate-500 flex-shrink-0 font-mono">{spanSize}×</span>}
                        {isContinuation && <span className="text-[10px] text-slate-500 flex-shrink-0">↴</span>}
                        {hasContinuation && !isContinuation && <span className="text-[10px] text-slate-500 flex-shrink-0">↳</span>}
                        {task.is_absolute && task.target_time && (
                          <span className="text-[10px] text-amber-400/60 flex-shrink-0 font-mono">{formatTimeShort(task.target_time)}</span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {displayedTasks.length > 5 && (
                <div className="text-[10px] text-slate-500 text-center mt-0.5">+{displayedTasks.length - 5}</div>
              )}
            </div>

            {isActive && (
              <>
                <div className="absolute top-0 left-2 right-2 h-px bg-gradient-to-r from-transparent via-indigo-400/50 to-transparent" />
                <div className="absolute left-0 top-2 bottom-2 w-px bg-gradient-to-b from-transparent via-indigo-400/30 to-transparent" />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
