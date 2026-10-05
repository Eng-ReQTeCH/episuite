import React from 'react';
import { useStore } from '../store/useStore';

export default function SleepScreen() {
  const wakeup = useStore(s => s.wakeup);
  const enterPrep = useStore(s => s.enterPrep);

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden" style={{ background: '#0f172a' }}>
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/20 via-transparent to-indigo-950/10" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-3xl animate-pulse-soft" />

      <div className="relative z-10 text-center px-6 animate-scale-in">
        <div className="mb-8">
          <div className="text-6xl font-light tracking-[0.15em] text-indigo-200/50 mb-2 font-mono">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="text-xs text-indigo-300/30 tracking-wider uppercase">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </div>

        <button onClick={wakeup} className="group relative inline-flex items-center justify-center">
          <div className="absolute inset-0 w-28 h-28 rounded-full bg-gradient-to-br from-indigo-500/10 to-indigo-600/5 blur-xl group-hover:from-indigo-400/20 group-hover:to-indigo-500/10 transition-all duration-700" />
          <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-indigo-500/8 to-indigo-600/3 border border-indigo-500/20 flex items-center justify-center group-hover:border-indigo-400/40 group-hover:shadow-lg group-hover:shadow-indigo-500/10 transition-all duration-500">
            <div className="text-center">
              <div className="text-xl font-light tracking-[0.2em] text-indigo-300/70 group-hover:text-indigo-200/90 transition-colors duration-500">
                WAKE
              </div>
              <div className="text-[9px] text-indigo-400/30 mt-1 tracking-widest">TAP</div>
            </div>
          </div>
        </button>

        <div className="mt-8 flex flex-col items-center gap-2">
          <div className="w-12 h-px bg-indigo-500/10" />
          <button onClick={enterPrep} className="text-[10px] text-indigo-400/30 hover:text-indigo-300/60 transition-colors tracking-wider uppercase">
            Prep Tomorrow
          </button>
        </div>
      </div>
    </div>
  );
}
