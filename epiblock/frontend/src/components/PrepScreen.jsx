import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import TaskSidebar from './TaskSidebar';
import { tomorrowISO, formatTimeShort } from '../utils/time';
import { defaultPresets } from '../utils/templates';

export default function PrepScreen() {
  const day = useStore(s => s.day);
  const blocks = useStore(s => s.blocks);
  const tomorrowBlocks = useStore(s => s.tomorrowBlocks);
  const prepDate = useStore(s => s.prepDate);
  const exitPrep = useStore(s => s.exitPrep);
  const setPrepDate = useStore(s => s.setPrepDate);
  const finalizePrep = useStore(s => s.finalizePrep);
  const cloneTodayToTomorrow = useStore(s => s.cloneTodayToTomorrow);
  const applyTemplate = useStore(s => s.applyTemplate);
  const openTaskModal = useStore(s => s.openTaskModal);
  const selectedBlocks = useStore(s => s.selectedBlocks);
  const toggleBlockSelection = useStore(s => s.toggleBlockSelection);
  const clearSelection = useStore(s => s.clearSelection);
  const massCreateTask = useStore(s => s.massCreateTask);
  const showMassEdit = useStore(s => s.showMassEdit);
  const showSidebar = useStore(s => s.showSidebar);
  const toggleShowSidebar = useStore(s => s.toggleShowSidebar);
  const sidebarReload = useStore(s => s.sidebarReload);
  const loadTomorrow = useStore(s => s.loadTomorrow);

  const [activeTab, setActiveTab] = useState(day?.wakeup_time ? 'today' : 'tomorrow');
  const [massTitle, setMassTitle] = useState('');

  const currentBlocks = activeTab === 'today' ? blocks : tomorrowBlocks;
  const isTomorrow = activeTab === 'tomorrow';
  const dateLabel = activeTab === 'today'
    ? new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : new Date(prepDate || tomorrowISO()).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className="h-dvh flex overflow-hidden" style={{ background: '#0a0a1a' }}>
      {showSidebar && <TaskSidebar date={isTomorrow ? prepDate : undefined} />}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="glass-header px-4 pb-2 pt-3 border-b border-white/[0.04]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleShowSidebar}
                className="text-sm text-slate-400 hover:text-slate-300 transition px-3 py-1.5 rounded-lg border border-slate-700/50"
              >
                {showSidebar ? 'Hide' : 'Tasks'}
              </button>
              <div className="h-5 w-px bg-slate-700/50" />
              <h1 className="text-sm font-semibold text-white/70">Day Prep</h1>
            </div>
            <div className="flex gap-2">
              <button onClick={exitPrep} className="text-sm text-white/30 hover:text-white/60 px-3 py-1.5 rounded-lg border border-white/[0.06] hover:border-white/[0.12] transition">
                Back
              </button>
              <button onClick={() => finalizePrep(prepDate || tomorrowISO())} className="text-sm bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300/70 px-4 py-1.5 rounded-lg transition border border-indigo-500/10">
                Finalize
              </button>
            </div>
          </div>

          <div className="flex gap-2 mb-2">
            {day?.wakeup_time && (
              <button onClick={() => { setActiveTab('today'); sidebarReload(); }} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${activeTab === 'today' ? 'bg-white/[0.06] text-white/70' : 'text-white/30 hover:text-white/50'}`}>
                Today
              </button>
            )}
            <button onClick={() => { setActiveTab('tomorrow'); if (tomorrowBlocks.length === 0) loadTomorrow(); }} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${activeTab === 'tomorrow' ? 'bg-amber-500/15 text-amber-300/70' : 'text-white/30 hover:text-white/50'}`}>
              Tomorrow
            </button>
          </div>

          {isTomorrow && (
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <input type="date" value={prepDate || ''} onChange={e => setPrepDate(e.target.value)} className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-1.5 text-sm text-white/60" />
              <button onClick={cloneTodayToTomorrow} className="text-sm bg-white/[0.04] hover:bg-white/[0.08] text-white/50 px-3 py-1.5 rounded-lg transition border border-white/[0.06]">Clone Today</button>
              <div className="flex gap-1 overflow-x-auto">
                {defaultPresets.map(preset => (
                  <button key={preset.id} onClick={() => applyTemplate(preset.blocks)} className="flex-shrink-0 text-sm bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white/50 px-3 py-1.5 rounded-lg transition whitespace-nowrap">{preset.name}</button>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs text-white/20">{dateLabel}</div>
        </header>

        <div className="flex-1 overflow-y-auto p-3 pb-32">
          <div className="block-grid max-w-4xl mx-auto">
            {currentBlocks.length === 0 && (
              <div className="col-span-4 text-center py-12 text-white/20 text-sm">
                No blocks. Clone today or use a template.
              </div>
            )}

            {currentBlocks.map((block) => {
              const idx = block.block_index;
              const blockTasks = (block.tasks || []).filter(t => t.block_index === idx);
              const isSelected = selectedBlocks.includes(idx);
              const minutes = idx * 15;
              const h = Math.floor(minutes / 60);
              const m = minutes % 60;
              const label = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

              return (
                <div
                  key={block.id || idx}
                  onClick={() => { if (isTomorrow) toggleBlockSelection(idx); else openTaskModal(idx); }}
                  className={`
                    relative rounded-xl border transition-all cursor-pointer overflow-hidden min-h-[100px]
                    ${isSelected ? 'border-indigo-500/40 bg-indigo-500/10' : 'border-white/[0.06] hover:border-white/[0.12] bg-white/[0.02]'}
                    ${isTomorrow ? 'hover:bg-amber-500/5' : 'hover:bg-white/[0.04]'}
                    animate-scale-in
                  `}
                >
                  <div className="p-2 flex flex-col h-full">
                    <div className="flex items-center justify-between mb-1">
                      {isTomorrow && (
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition ${isSelected ? 'bg-indigo-500 border-indigo-400' : 'border-white/20'}`}>
                          {isSelected && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>}
                        </div>
                      )}
                      <span className={`text-xs font-mono font-medium ${isTomorrow ? 'text-amber-300/40' : 'text-white/25'}`}>
                        {label}
                      </span>
                    </div>

                    <div className="flex-1 space-y-0.5">
                      {blockTasks.length === 0 ? (
                        <span className="text-xs text-white/10 italic block mt-2 text-center">{isTomorrow ? 'tap' : 'empty'}</span>
                      ) : (
                        blockTasks.slice(0, 3).map(task => (
                          <div key={task.id} className="text-sm text-white/50 truncate px-1" style={{ borderLeft: '2px solid rgba(99,102,241,0.3)' }}>
                            {task.icon && <span className="mr-1">{task.icon}</span>}
                            {task.title}
                            {task.is_absolute && task.target_time && (
                              <span className="text-[10px] text-amber-400/50 ml-1">{formatTimeShort(task.target_time)}</span>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    {blockTasks.length > 3 && (
                      <div className="text-[10px] text-white/15 text-center">+{blockTasks.length - 3}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {showMassEdit && (
            <div className="fixed bottom-0 left-0 right-0 z-30 p-4 bg-gradient-to-t from-[#0a0a1a] via-[#0a0a1a]/95 to-transparent">
              <div className="glass border border-white/[0.06] rounded-xl p-3 shadow-2xl flex items-center gap-2 max-w-lg mx-auto">
                <input
                  autoFocus
                  value={massTitle}
                  onChange={e => setMassTitle(e.target.value)}
                  placeholder="Task name for selected blocks..."
                  className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white/70 placeholder-white/20 focus:outline-none focus:border-indigo-500/40"
                  onKeyDown={e => { if (e.key === 'Enter' && massTitle.trim()) { massCreateTask(massTitle.trim()); setMassTitle(''); } }}
                />
                <button onClick={() => { massCreateTask(massTitle.trim()); setMassTitle(''); }} disabled={!massTitle.trim()} className="bg-indigo-500/20 hover:bg-indigo-500/30 disabled:bg-white/[0.04] text-indigo-300/70 px-4 py-2 rounded-lg text-sm transition font-medium">
                  Group
                </button>
                <button onClick={clearSelection} className="text-white/20 hover:text-white/50 text-sm px-2">✕</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
