import React from 'react';
import {
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Search,
  HelpCircle,
  Settings,
  LayoutDashboard,
  Radio,
} from 'lucide-react';

interface TopForensicHeaderProps {
  readonly currentTimestamp: string;
  readonly canStepBack: boolean;
  readonly canStepForward: boolean;
  readonly onStepBack: () => void;
  readonly onStepForward: () => void;
  readonly onJumpStart: () => void;
  readonly onJumpEnd: () => void;
  readonly onSwitchToLegacy?: () => void;
}

export function TopForensicHeader({
  currentTimestamp,
  canStepBack,
  canStepForward,
  onStepBack,
  onStepForward,
  onJumpStart,
  onJumpEnd,
  onSwitchToLegacy,
}: TopForensicHeaderProps) {
  // Format formatted date & UTC time
  const timeStr = currentTimestamp.slice(11, 19) + ' UTC';

  return (
    <header className="h-14 px-6 flex items-center justify-between text-slate-200 select-none pointer-events-none z-20">
      {/* Left: Product Title */}
      <div className="flex items-center gap-4 pointer-events-auto">
        <div className="flex items-center gap-2">
          <span className="text-sm font-sans font-extrabold tracking-[0.2em] text-white">
            OBSIDIAN
          </span>
          <span className="text-[10px] font-mono text-sky-400 font-semibold px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/20">
            2.0
          </span>
        </div>
      </div>

      {/* Center: Integrated Temporal Exploration HUD */}
      <div className="pointer-events-auto flex items-center gap-3 px-3 py-1 rounded-full bg-[#111827]/75 border border-white/10 backdrop-blur-xl shadow-xl">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onJumpStart}
            title="Jump to Start"
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <SkipBack className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={onStepBack}
            disabled={!canStepBack}
            title="Previous Observation"
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30 transition-all"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2 px-2 text-center">
          <span className="text-xs font-mono font-bold text-white tracking-wide">
            {timeStr}
          </span>
          <span className="text-[10px] font-sans text-slate-400">
            Tue, Oct 14, 2025
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onStepForward}
            disabled={!canStepForward}
            title="Next Observation"
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30 transition-all"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onJumpEnd}
            title="Jump to End (Current Horizon)"
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <SkipForward className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Right: Analytical Utilities & Scenario Status */}
      <div className="flex items-center gap-4 pointer-events-auto">
        <div className="hidden sm:flex items-center gap-2 text-xs font-sans">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
            LIVE
          </span>
          <span className="text-slate-500 font-sans ml-1 text-[11px]">
            Scenario: Enterprise (Synthetic)
          </span>
        </div>

        <div className="flex items-center gap-1 text-slate-400">
          <button
            type="button"
            title="Search Evidence"
            className="p-1.5 rounded-lg hover:text-white hover:bg-white/5 transition-all"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="System Help"
            className="p-1.5 rounded-lg hover:text-white hover:bg-white/5 transition-all"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Settings"
            className="p-1.5 rounded-lg hover:text-white hover:bg-white/5 transition-all"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          {onSwitchToLegacy && (
            <button
              type="button"
              onClick={onSwitchToLegacy}
              title="Legacy Shell"
              className="ml-2 px-2 py-1 text-[10px] font-mono rounded bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition-all flex items-center gap-1"
            >
              <LayoutDashboard className="w-3 h-3" />
              <span className="hidden md:inline">OBSIDIAN 1.0</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
