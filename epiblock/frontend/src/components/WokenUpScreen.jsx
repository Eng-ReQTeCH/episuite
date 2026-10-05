import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import TaskSidebar from './TaskSidebar';
import BlockGrid from './BlockGrid';
import { tomorrowISO, formatTimeShort } from '../utils/time';
import { defaultPresets } from '../utils/templates';

export default function WokenUpScreen() {
  const showSidebar = useStore(s => s.showSidebar);
  const toggleShowSidebar = useStore(s => s.toggleShowSidebar);
  const day = useStore(s => s.day);
  const now = useStore(s => s.now);
  const apiStatus = useStore(s => s.apiStatus);
  const currentPage = useStore(s => s.currentPage);
  const setPage = useStore(s => s.setPage);
  const TOTAL_PAGES = useStore(s => s.TOTAL_PAGES);
  const blocks = useStore(s => s.blocks);
  const tomorrowBlocks = useStore(s => s.tomorrowBlocks);
  const prepDate = useStore(s => s.prepDate);
  const setPrepDate = useStore(s => s.setPrepDate);
  const finalizePrep = useStore(s => s.finalizePrep);
  const cloneTodayToTomorrow = useStore(s => s.cloneTodayToTomorrow);
  const applyTemplate = useStore(s => s.applyTemplate);
  const toggleBlockSelection = useStore(s => s.toggleBlockSelection);
  const clearSelection = useStore(s => s.clearSelection);
  const massCreateTask = useStore(s => s.massCreateTask);
  const showMassEdit = useStore(s => s.showMassEdit);
  const selectedBlocks = useStore(s => s.selectedBlocks);
  const loadTomorrow = useStore(s => s.loadTomorrow);
  const sidebarReload = useStore(s => s.sidebarReload);

  const [activeTab, setActiveTab] = useState('today');
  const [massTitle, setMassTitle] = useState('');

  const isTomorrow = activeTab === 'tomorrow';
  const currentBlocks = isTomorrow ? tomorrowBlocks : blocks;

  const wakeMs = day?.wakeup_time ? new Date(day.wakeup_time).getTime() : 0;
  const elapsed = wakeMs ? Math.floor((now - wakeMs) / 60000) : 0;

  const pageLabels = ['0-3', '3-6', '6-9', '9-12', '12-15', '15-18', '18-21', '21-24'];

  return (
    <div className="h-dvh flex overflow-hidden" style={{ background: '#0f172a' }}>
      {showSidebar && <TaskSidebar date={isTomorrow ? prepDate : undefined} />}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="glass-header px-4 pb-2 pt-3">
          <div className="flex items-center justify-between max-w-4xl mx-auto w-full">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleShowSidebar}
                className="text-sm text-slate-400 hover:text-slate-300 transition px-3 py-1.5 rounded-lg border border-slate-700/50"
              >
                {showSidebar ? 'Hide' : 'Tasks'}
              </button>
              <div className="h-5 w-px bg-slate-700/50" />
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-indigo-300/70 font-medium">T₀</span>
                <span className="text-sm font-mono text-slate-400">
                  {day?.wakeup_time
                    ? new Date(day.wakeup_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '--:--'}
                </span>
                {wakeMs > 0 && (
                  <span className="text-xs font-mono text-slate-500">+{elapsed}m</span>
                )}
                {wakeMs > 0 && (
                  <span className="text-xs font-mono text-slate-500">
                    <span className="text-slate-600">|</span> Block {Math.floor(elapsed / 15)} — {(Math.floor(elapsed / 15) + 1) * 15 - elapsed}m left
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <div className="dot-online" />
                  <span className="text-slate-400">API: {apiStatus === 'online' ? 'Online' : 'Offline'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 mt-2">
            <div className="flex gap-2">
              <button
                onClick={() => { setActiveTab('today'); sidebarReload(); }}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${activeTab === 'today' ? 'bg-indigo-500/15 text-indigo-300/80 border border-indigo-500/20' : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/20 border border-transparent'}`}
              >
                Today
              </button>
              <button
                onClick={() => { setActiveTab('tomorrow'); if (tomorrowBlocks.length === 0) loadTomorrow(); }}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${activeTab === 'tomorrow' ? 'bg-amber-500/15 text-amber-300/80 border border-amber-500/20' : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/20 border border-transparent'}`}
              >
                Tomorrow
              </button>
            </div>

            {!isTomorrow && (
              <div className="flex flex-col items-end gap-1">
                <div className="flex gap-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <button key={i} onClick={() => setPage(i)} className={`w-16 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                      currentPage === i ? 'bg-indigo-500/15 text-indigo-300/80 border border-indigo-500/20' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/20 border border-transparent'
                    }`}>{pageLabels[i]}</button>
                  ))}
                </div>
                <div className="flex gap-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <button key={i + 4} onClick={() => setPage(i + 4)} className={`w-16 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                      currentPage === i + 4 ? 'bg-indigo-500/15 text-indigo-300/80 border border-indigo-500/20' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/20 border border-transparent'
                    }`}>{pageLabels[i + 4]}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {isTomorrow && (
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <input type="date" value={prepDate || ''} onChange={e => setPrepDate(e.target.value)} className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-1.5 text-sm text-white/60" />
              <button onClick={cloneTodayToTomorrow} className="text-sm bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 px-3 py-1.5 rounded-lg transition border border-white/[0.06]">Clone Today</button>
              <div className="flex gap-1 overflow-x-auto">
                {defaultPresets.map(preset => (
                  <button key={preset.id} onClick={() => applyTemplate(preset.blocks)} className="flex-shrink-0 text-sm bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-slate-400 px-3 py-1.5 rounded-lg transition whitespace-nowrap">{preset.name}</button>
                ))}
              </div>
            </div>
          )}
        </header>

        <div className={`flex-1 ${isTomorrow ? 'overflow-y-auto p-3' : 'p-3 overflow-hidden'}`}>
          {isTomorrow ? (
            <div className="block-grid max-w-4xl mx-auto">
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
                    onClick={() => toggleBlockSelection(idx)}
                    className={`relative rounded-xl border transition-all cursor-pointer overflow-hidden min-h-[100px] ${
                      isSelected ? 'border-indigo-500/40 bg-indigo-500/10' : 'border-white/[0.06] hover:border-white/[0.12] bg-white/[0.02]'
                    } animate-scale-in`}
                  >
                    <div className="p-2 flex flex-col h-full">
                      <div className="flex items-center justify-between mb-1">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition ${isSelected ? 'bg-indigo-500 border-indigo-400' : 'border-white/20'}`}>
                          {isSelected && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        <span className="text-xs font-mono font-medium text-amber-300/40">{label}</span>
                      </div>
                      <div className="flex-1 space-y-0.5">
                        {blockTasks.length === 0 ? (
                          <span className="text-xs text-white/10 italic block mt-2 text-center">tap</span>
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
          ) : (
            <BlockGrid />
          )}
        </div>

        {isTomorrow && showMassEdit && (
          <div className="fixed bottom-0 left-0 right-0 z-30 p-4 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/95 to-transparent">
            <div className="glass-card border border-white/[0.06] rounded-xl p-3 shadow-2xl flex items-center gap-2 max-w-lg mx-auto">
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
  );
}
