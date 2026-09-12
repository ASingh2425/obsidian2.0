import React from 'react';
import { Compass, RotateCcw, Activity, ShieldCheck } from 'lucide-react';
import { TIMESTAMPS } from './observatoryData';

interface ObservatoryHeaderProps {
  readonly scannerIndex: number;
  readonly onSwitchToSpatial: () => void;
  readonly onResetScanner: () => void;
}

export function ObservatoryHeader({
  scannerIndex,
  onSwitchToSpatial,
  onResetScanner,
}: ObservatoryHeaderProps) {
  const currentTime = TIMESTAMPS[scannerIndex]?.label || '10:30';

  return (
    <header className="h-12 w-full px-6 flex items-center justify-between border-b border-white/[0.06] bg-[#04070c]/90 backdrop-blur-md z-30 select-none">
      {/* Top Left: Identity */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
          <span className="font-mono text-xs font-bold tracking-widest text-slate-100">OBSIDIAN 2.0</span>
          <span className="text-slate-600 font-mono text-xs">/</span>
          <span className="font-mono text-xs font-medium text-sky-400 tracking-wider">BEHAVIORAL OBSERVATORY</span>
        </div>
        <div className="hidden md:flex items-center px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/20 text-[10px] font-mono text-sky-300">
          MACRO TEMPORAL ENVIRONMENT
        </div>
      </div>

      {/* Top Center: Scientific Clock */}
      <div className="flex items-center gap-3 font-mono">
        <div className="flex items-center gap-2 px-3 py-1 rounded bg-white/[0.03] border border-white/[0.06] text-xs">
          <Activity className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
          <span className="text-slate-100 font-bold tracking-wide">{currentTime}:00 UTC</span>
          <span className="text-slate-500">·</span>
          <span className="text-slate-400 text-[11px]">Tue, Oct 14, 2025</span>
        </div>
      </div>

      {/* Top Right: Status & Concept Switcher */}
      <div className="flex items-center gap-3 text-xs font-mono">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          <span>REPLAY · SYNTHETIC</span>
        </div>

        <button
          type="button"
          onClick={onResetScanner}
          title="Reset Scanner to 10:30 UTC"
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-all text-[11px]"
        >
          <RotateCcw className="w-3 h-3 text-slate-400" />
          <span>Reset Cursor</span>
        </button>

        {/* Route switcher to compare with Spatial Forensics */}
        <button
          type="button"
          onClick={onSwitchToSpatial}
          className="flex items-center gap-1.5 px-3 py-1 rounded bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 transition-all text-[11px] font-medium"
        >
          <Compass className="w-3.5 h-3.5 text-sky-400" />
          <span>Compare: Spatial Forensics</span>
        </button>
      </div>
    </header>
  );
}
