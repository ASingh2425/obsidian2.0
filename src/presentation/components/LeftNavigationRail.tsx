import React from 'react';
import type {
  AnalyticalProjectionMode,
  BaselineComparisonLens,
} from '../types/presentationTypes';
import type { OverlaysState } from '../spatial/ShiftGraphCanvas';
import { Layers, GitFork, Activity, Server, Laptop, ShieldCheck } from 'lucide-react';

interface LeftNavigationRailProps {
  readonly projection: AnalyticalProjectionMode;
  readonly lens: BaselineComparisonLens;
  readonly overlays: OverlaysState;
  readonly onProjectionChange: (mode: AnalyticalProjectionMode) => void;
  readonly onLensChange: (lens: BaselineComparisonLens) => void;
  readonly onToggleOverlay: (key: keyof OverlaysState) => void;
}

export function LeftNavigationRail({
  projection,
  lens,
  overlays,
  onProjectionChange,
  onLensChange,
  onToggleOverlay,
}: LeftNavigationRailProps) {
  return (
    <nav className="w-56 p-4 rounded-2xl bg-[#111827]/75 border border-white/10 backdrop-blur-xl shadow-2xl flex flex-col gap-6 text-slate-200 select-none">
      {/* SECTION: VIEW */}
      <div>
        <div className="text-[10px] font-sans font-semibold tracking-wider text-slate-400 uppercase mb-2 px-1">
          VIEW
        </div>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => onProjectionChange('BEHAVIOR')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-sans font-medium transition-all ${
              projection === 'BEHAVIOR'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                projection === 'BEHAVIOR' ? 'bg-sky-400 shadow-[0_0_8px_#38bdf8]' : 'bg-transparent'
              }`}
            />
            <Activity className="w-3.5 h-3.5" />
            <span>Behavior</span>
          </button>

          <button
            type="button"
            onClick={() => onProjectionChange('RESOURCE')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-sans font-medium transition-all ${
              projection === 'RESOURCE'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                projection === 'RESOURCE' ? 'bg-amber-400 shadow-[0_0_8px_#fbbf24]' : 'bg-transparent'
              }`}
            />
            <Server className="w-3.5 h-3.5" />
            <span>Resources</span>
          </button>

          <button
            type="button"
            onClick={() => onToggleOverlay('devices')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-sans font-medium transition-all ${
              overlays.devices && projection !== 'BEHAVIOR'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-transparent" />
            <Laptop className="w-3.5 h-3.5" />
            <span>Devices</span>
          </button>

          <button
            type="button"
            onClick={() => onToggleOverlay('context')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-sans font-medium transition-all ${
              overlays.context
                ? 'text-cyan-300 hover:bg-white/5 border border-transparent'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-transparent" />
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Context</span>
          </button>
        </div>
      </div>

      {/* SECTION: COMPARE */}
      <div>
        <div className="text-[10px] font-sans font-semibold tracking-wider text-slate-400 uppercase mb-2 px-1">
          COMPARE
        </div>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => onLensChange('PERSONAL')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-sans font-medium transition-all ${
              lens === 'PERSONAL'
                ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                lens === 'PERSONAL' ? 'bg-indigo-400 shadow-[0_0_8px_#818cf8]' : 'bg-transparent'
              }`}
            />
            <span>Personal</span>
          </button>

          <button
            type="button"
            onClick={() => onLensChange('PEER')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-sans font-medium transition-all ${
              lens === 'PEER'
                ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                lens === 'PEER' ? 'bg-indigo-400 shadow-[0_0_8px_#818cf8]' : 'bg-transparent'
              }`}
            />
            <span>Peer Cohort</span>
          </button>

          <button
            type="button"
            onClick={() => onLensChange('RESOURCE')}
            className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-sans font-medium transition-all ${
              lens === 'RESOURCE'
                ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  lens === 'RESOURCE' ? 'bg-indigo-400' : 'bg-transparent'
                }`}
              />
              <span>Resource</span>
            </div>
            <span className="text-[9px] font-mono px-1 rounded bg-slate-800 text-slate-400 border border-white/5">
              N/A
            </span>
          </button>
        </div>
      </div>

      {/* SECTION: OVERLAYS */}
      <div>
        <div className="text-[10px] font-sans font-semibold tracking-wider text-slate-400 uppercase mb-2 px-1">
          OVERLAYS
        </div>
        <div className="flex flex-col gap-2 px-1">
          {[
            { key: 'baseline' as const, label: 'Baseline', color: 'text-indigo-400' },
            { key: 'context' as const, label: 'Context', color: 'text-cyan-400' },
            { key: 'resources' as const, label: 'Resources', color: 'text-amber-400' },
            { key: 'devices' as const, label: 'Devices', color: 'text-purple-400' },
            { key: 'labels' as const, label: 'Labels', color: 'text-sky-400' },
          ].map((item) => (
            <label
              key={item.key}
              className="flex items-center gap-2.5 text-xs font-sans text-slate-300 hover:text-white cursor-pointer select-none"
            >
              <input
                type="checkbox"
                checked={overlays[item.key]}
                onChange={() => onToggleOverlay(item.key)}
                className="w-3.5 h-3.5 rounded border-white/20 bg-slate-900/80 text-sky-500 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-sky-400"
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </div>
    </nav>
  );
}
