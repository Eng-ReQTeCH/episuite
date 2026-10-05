import React, { useEffect } from 'react';
import { useStore } from './store/useStore';
import { useWebSocket } from './hooks/useWebSocket';
import SleepScreen from './components/SleepScreen';
import WokenUpScreen from './components/WokenUpScreen';
import PrepScreen from './components/PrepScreen';
import TaskModal from './components/TaskModal';

export default function App() {
  const macro = useStore(s => s.macro);
  const loading = useStore(s => s.loading);
  const taskModal = useStore(s => s.taskModal);
  const editingTask = useStore(s => s.editingTask);
  const initialize = useStore(s => s.initialize);
  const tick = useStore(s => s.tick);
  const loadBlocks = useStore(s => s.loadBlocks);
  const checkStatus = useStore(s => s.checkStatus);

  useEffect(() => { initialize(); }, []);
  useWebSocket(() => { loadBlocks(); });

  useEffect(() => {
    checkStatus();
    const si = setInterval(() => checkStatus(), 10000);
    const ti = setInterval(() => tick(), 1000);
    return () => { clearInterval(si); clearInterval(ti); };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f172a' }}>
        <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#0f172a' }}>
      {macro === 'SLEEP' && <SleepScreen />}
      {macro === 'WOKEN_UP' && <WokenUpScreen />}
      {macro === 'PREP' && <PrepScreen />}
      {(taskModal !== null || editingTask) && <TaskModal />}
    </div>
  );
}
