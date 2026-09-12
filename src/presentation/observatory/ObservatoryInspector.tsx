import React from 'react';
import { Activity, Shield, Layers, HelpCircle, CheckCircle2 } from 'lucide-react';
import type {
  SignalSeries,
  OrganizationalContextWindow,
  ObservatoryFilters,
  BehavioralSignalId,
} from './types';
import { TIMESTAMPS, CONTEXT_SPAN } from './observatoryData';

interface ObservatoryInspectorProps {
  readonly signals: readonly SignalSeries[];
  readonly contextWindow: OrganizationalContextWindow;
  readonly filters: ObservatoryFilters;
  readonly scannerIndex: number;
  readonly onSelectSignal: (id: BehavioralSignalId | null) => void;
}

export function ObservatoryInspector({
  signals,
  contextWindow,
  filters,
  scannerIndex,
  onSelectSignal,
}: ObservatoryInspectorProps) {
  const currentTimestamp = TIMESTAMPS[scannerIndex] || TIMESTAMPS[0];

  // Currently focused signal or default to the most divergent signal (RESOURCE)
  const activeSignalId = filters.selectedSignalId || 'RESOURCE';
  const activeSignal = signals.find((s) => s.id === activeSignalId) || signals[0];
  const activePoint = activeSignal.points[scannerIndex] || activeSignal.points[0];

  // Context status at current scanner time
  const isContextActive =
    scannerIndex >= CONTEXT_SPAN.startIndex && scannerIndex <= CONTEXT_SPAN.endIndex;

  return (
    <aside className="w-72 h-full flex flex-col justify-between p-4 border-l border-white/[0.06] bg-[#04070c]/90 backdrop-blur-xl z-20 select-none overflow-y-auto">
      <div className="space-y-5">
        {/* Section 22: Temporal Cursor State */}
        <div>
          <div className="flex items-center justify-between text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-1">
            <span>Observation Frame</span>
            <span className="text-sky-400">INDEX #{scannerIndex + 1}/25</span>
          </div>
          <div className="text-xl font-bold font-mono text-slate-100 flex items-center justify-between">
            <span>{currentTimestamp.label}:00 UTC</span>
            <span className="text-[11px] font-normal text-slate-500">7.5m Window</span>
          </div>
        </div>

        <div className="h-px bg-white/[0.06]" />

        {/* Section 22: Behavioral Multi-Signal Vector at Scanner */}
        <div>
          <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-2">
            Simultaneous Behavioral Vector
          </div>
          <div className="space-y-1.5">
            {signals.map((sig) => {
              const pt = sig.points[scannerIndex];
              const isDeviated = pt && pt.observedValue > pt.upperThreshold;
              const isSelected = filters.selectedSignalId === sig.id;

              return (
                <button
                  key={sig.id}
                  type="button"
                  onClick={() =>
                    onSelectSignal(filters.selectedSignalId === sig.id ? null : sig.id)
                  }
                  className={`w-full flex items-center justify-between p-2 rounded transition-all text-left ${
                    isSelected
                      ? 'bg-sky-500/15 border border-sky-500/30'
                      : 'hover:bg-white/[0.03] border border-transparent'
                  }`}
                >
                  <div>
                    <div className="text-xs font-semibold text-slate-200">{sig.name}</div>
                    <div className="text-[10px] font-mono text-slate-500">
                      exp: {pt?.medianValue} · MAD: {pt?.madValue}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-sm font-mono font-bold ${
                        isDeviated ? 'text-amber-400' : 'text-slate-200'
                      }`}
                    >
                      {pt?.observedValue}
                    </div>
                    <div className="text-[9px] font-mono text-slate-500">
                      {isDeviated ? `+${pt?.deviationSigma}σ` : 'nominal'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-px bg-white/[0.06]" />

        {/* Section 22: Feature Telemetry Breakdown */}
        <div>
          <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-2">
            Selected Feature Telemetry
          </div>
          <div className="font-mono text-xs font-bold text-sky-300 break-all mb-3">
            {activeSignal.featureKey}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="p-2 rounded bg-white/[0.02] border border-white/[0.04]">
              <div className="text-[9px] text-slate-500 uppercase">Observed</div>
              <div className="text-base font-bold text-slate-100">{activePoint.observedValue}</div>
            </div>
            <div className="p-2 rounded bg-white/[0.02] border border-white/[0.04]">
              <div className="text-[9px] text-slate-500 uppercase">Historical Median</div>
              <div className="text-base font-bold text-slate-300">{activePoint.medianValue}</div>
            </div>
            <div className="p-2 rounded bg-white/[0.02] border border-white/[0.04]">
              <div className="text-[9px] text-slate-500 uppercase">MAD Extent</div>
              <div className="text-base font-bold text-slate-300">±{activePoint.madValue}</div>
            </div>
            <div className="p-2 rounded bg-white/[0.02] border border-white/[0.04]">
              <div className="text-[9px] text-slate-500 uppercase">Robust Sigma</div>
              <div
                className={`text-base font-bold ${
                  activePoint.deviationSigma > 2.5 ? 'text-amber-400' : 'text-slate-300'
                }`}
              >
                {activePoint.deviationSigma > 0 ? `+${activePoint.deviationSigma}σ` : '0.0σ'}
              </div>
            </div>
          </div>
        </div>

        <div className="h-px bg-white/[0.06]" />

        {/* Section 17 & 18: Context Intersection Status */}
        <div>
          <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-2">
            Organizational Context Status
          </div>
          <div
            className={`p-2.5 rounded border text-xs ${
              isContextActive
                ? 'bg-teal-950/30 border-teal-500/30 text-teal-200'
                : 'bg-white/[0.02] border-white/[0.04] text-slate-400'
            }`}
          >
            <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold mb-1">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isContextActive ? 'bg-teal-400' : 'bg-slate-600'
                }`}
              />
              <span>{isContextActive ? 'CONTEXT OVERLAP PRESENT' : 'NO ACTIVE CONTEXT WINDOW'}</span>
            </div>
            <div className="text-[11px] font-semibold text-slate-200">{contextWindow.title}</div>
            <div className="text-[10px] text-slate-400 mt-1 font-mono">
              Ref: {contextWindow.approvalRef} · {contextWindow.startLabel} – {contextWindow.endLabel}
            </div>
          </div>
        </div>
      </div>

      {/* Section 37: Evidentiary Posture Footer */}
      <div className="pt-3 border-t border-white/[0.06]">
        <div className="text-[9px] font-mono text-slate-500 leading-relaxed">
          <span className="font-semibold text-slate-400">Evidentiary Protocol:</span> Observed
          telemetry represents behavioral state deviation from empirical baselines without inferring
          intent or subjective culpability.
        </div>
      </div>
    </aside>
  );
}
