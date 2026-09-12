import React, { useState } from 'react';
import { ChevronDown, User, Layers, Sliders, Eye, Radio } from 'lucide-react';
import type {
  BehavioralSignalId,
  BaselineComparisonLens,
  ObservatoryFilters,
  ActorEntity,
} from './types';
import { PROTOTYPE_ACTORS } from './observatoryData';

interface ObservatoryLeftRailProps {
  readonly selectedActor: ActorEntity;
  readonly onSelectActor: (actor: ActorEntity) => void;
  readonly filters: ObservatoryFilters;
  readonly onToggleSignal: (id: BehavioralSignalId) => void;
  readonly onSelectLens: (lens: BaselineComparisonLens) => void;
  readonly onToggleOverlay: (key: keyof ObservatoryFilters['overlays']) => void;
}

export function ObservatoryLeftRail({
  selectedActor,
  onSelectActor,
  filters,
  onToggleSignal,
  onSelectLens,
  onToggleOverlay,
}: ObservatoryLeftRailProps) {
  const [actorDropdownOpen, setActorDropdownOpen] = useState(false);

  return (
    <aside className="w-56 h-full flex flex-col justify-between py-4 px-3 border-r border-white/[0.06] bg-[#04070c]/85 backdrop-blur-xl z-20 select-none overflow-y-auto">
      <div className="space-y-5">
        {/* Section 20: Entity Selector */}
        <div className="relative">
          <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-1 px-1">
            Subject Entity
          </div>
          <button
            type="button"
            onClick={() => setActorDropdownOpen((prev) => !prev)}
            className="w-full flex items-center justify-between p-2 rounded bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] transition-all text-left"
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                <User className="w-3.5 h-3.5" />
              </div>
              <div className="overflow-hidden">
                <div className="font-mono text-xs font-bold text-slate-100 truncate">
                  {selectedActor.pseudonym}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {selectedActor.role}
                </div>
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
          </button>

          {/* Actor Dropdown */}
          {actorDropdownOpen && (
            <div className="absolute top-full mt-1 left-0 right-0 rounded bg-[#070b12] border border-white/10 shadow-2xl p-1 z-50 space-y-0.5">
              {PROTOTYPE_ACTORS.map((actor) => (
                <button
                  key={actor.id}
                  type="button"
                  onClick={() => {
                    onSelectActor(actor);
                    setActorDropdownOpen(false);
                  }}
                  className={`w-full text-left p-1.5 rounded text-xs font-mono transition-colors ${
                    selectedActor.id === actor.id
                      ? 'bg-sky-500/20 text-sky-300'
                      : 'hover:bg-white/5 text-slate-300'
                  }`}
                >
                  <div className="font-semibold">{actor.pseudonym}</div>
                  <div className="text-[9px] text-slate-500">{actor.role}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Section 19: Signals */}
        <div>
          <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-2 px-1 flex items-center justify-between">
            <span>Signals</span>
            <span className="text-slate-600 font-normal">Active Lanes</span>
          </div>
          <div className="space-y-1">
            {(
              [
                { id: 'AUTH', label: 'Authentication', code: 'AUTH' },
                { id: 'RESOURCE', label: 'Resource Access', code: 'RESC' },
                { id: 'PRIVILEGE', label: 'Privilege Activity', code: 'PRIV' },
                { id: 'DEVICE', label: 'Device & Egress', code: 'DEST' },
              ] as const
            ).map(({ id, label, code }) => {
              const active = filters.activeSignals[id];
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onToggleSignal(id)}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-all ${
                    active
                      ? 'bg-white/[0.04] text-slate-200 border border-white/[0.06]'
                      : 'text-slate-600 hover:text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        active ? 'bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.6)]' : 'bg-slate-700'
                      }`}
                    />
                    <span className="font-medium text-[11px]">{label}</span>
                  </div>
                  <span className="text-[9px] font-mono text-slate-500">{code}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 19 & 29: Compare Lens */}
        <div>
          <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-2 px-1">
            Baseline Reference Lens
          </div>
          <div className="grid grid-cols-1 gap-1">
            {(
              [
                { id: 'PERSONAL', label: 'Personal Historical', desc: '30-day self-baseline' },
                { id: 'PEER', label: 'Peer Cohort', desc: 'Infra Systems Engineers' },
                { id: 'RESOURCE', label: 'Resource Horizon', desc: 'Prod DB target profile' },
              ] as const
            ).map(({ id, label, desc }) => {
              const selected = filters.activeLens === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectLens(id)}
                  className={`w-full text-left px-2.5 py-1.5 rounded transition-all ${
                    selected
                      ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/30'
                      : 'hover:bg-white/[0.02] text-slate-400 border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium">{label}</span>
                    {selected && <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
                  </div>
                  <div className="text-[9px] font-mono text-slate-500">{desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 19: Overlays */}
        <div>
          <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-2 px-1">
            Overlays & Grids
          </div>
          <div className="space-y-1">
            {(
              [
                { key: 'baseline', label: 'Baseline Corridor (MAD)' },
                { key: 'context', label: 'Organizational Context' },
                { key: 'grid', label: 'Temporal Measurement Grid' },
              ] as const
            ).map(({ key, label }) => {
              const active = filters.overlays[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onToggleOverlay(key)}
                  className="w-full flex items-center justify-between px-2 py-1 rounded text-[11px] text-slate-400 hover:text-slate-200"
                >
                  <span>{label}</span>
                  <div
                    className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] font-mono ${
                      active
                        ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                        : 'border border-slate-700 text-transparent'
                    }`}
                  >
                    ✓
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* View Scale Indicator (Checkpoint 1 scope status) */}
      <div className="pt-3 border-t border-white/[0.06]">
        <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-2 px-1">
          Investigation Scale
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between px-2 py-1.5 rounded bg-sky-500/10 border border-sky-500/30 text-sky-300 text-xs font-mono font-medium">
            <span>● Macro: Observatory</span>
            <span className="text-[9px] text-sky-400 uppercase">Live</span>
          </div>
          <div className="flex items-center justify-between px-2 py-1 rounded text-slate-600 text-xs font-mono">
            <span>○ Meso: Behavioral Scan</span>
            <span className="text-[8px] bg-white/[0.03] px-1 py-0.5 rounded text-slate-600">CP2</span>
          </div>
          <div className="flex items-center justify-between px-2 py-1 rounded text-slate-600 text-xs font-mono">
            <span>○ Micro: Constellation</span>
            <span className="text-[8px] bg-white/[0.03] px-1 py-0.5 rounded text-slate-600">CP3</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
