import React, { useState } from 'react';
import {
  Copy,
  Check,
  X,
  Eye,
  Crosshair,
  Share2,
  FolderPlus,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import type {
  BaselineComparisonLens,
  ShiftGraphPresentationModel,
  TrajectoryPointViewModel,
} from '../types/presentationTypes';

interface EvidenceInspectorProps {
  readonly model: ShiftGraphPresentationModel;
  readonly selectedPoint: TrajectoryPointViewModel | null;
  readonly activeLens: BaselineComparisonLens;
  readonly onClose?: () => void;
  readonly onSelectObservation: (id: string) => void;
  readonly onSelectEntity?: (id: string) => void;
  readonly onIsolateInScene?: () => void;
}

export function EvidenceInspector({
  model,
  selectedPoint,
  activeLens,
  onClose,
  onSelectObservation,
  onSelectEntity,
  onIsolateInScene,
}: EvidenceInspectorProps) {
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 1800);
  };

  const triggerActionNotification = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 2000);
  };

  const baseline = model.baselines[activeLens];

  if (!selectedPoint) {
    return (
      <div className="w-84 p-5 bg-[#111827]/75 border border-white/10 rounded-2xl backdrop-blur-xl shadow-2xl flex flex-col items-center justify-center text-center text-slate-400 select-none">
        <AlertCircle className="w-7 h-7 text-slate-500 mb-2 stroke-[1.5]" />
        <div className="text-xs font-sans font-semibold text-slate-300 mb-1">
          No Observation Selected
        </div>
        <p className="text-[11px] text-slate-500 max-w-[200px] leading-relaxed">
          Select any node along the behavioral trajectory to inspect evidence relationships.
        </p>
      </div>
    );
  }

  // Determine context relationship
  const grant = model.contextGrants[0];
  const isWithinGrant =
    grant &&
    selectedPoint.timestamp >= grant.validFrom &&
    selectedPoint.timestamp <= grant.validTo;

  return (
    <aside className="w-84 max-h-[85vh] flex flex-col bg-[#111827]/85 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl shadow-2xl text-slate-200 select-none">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-sans font-bold tracking-wider text-slate-400 uppercase">
              OBSERVATION
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              {selectedPoint.timestamp.slice(11, 19)} UTC
            </span>
          </div>

          <div className="text-sm font-mono font-bold text-white flex items-center gap-2 mt-1">
            <span>{selectedPoint.observationId}</span>
            <button
              type="button"
              onClick={() => copyToClipboard(selectedPoint.observationId)}
              title="Copy ID"
              className="text-slate-400 hover:text-white transition-colors"
            >
              {copiedText === selectedPoint.observationId ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            title="Close Inspector"
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Content Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-sans">
        {/* Target Feature */}
        <div>
          <div className="text-[10px] font-sans font-semibold text-slate-400 uppercase tracking-wider mb-1">
            FEATURE
          </div>
          <div className="text-xs font-mono text-sky-300 font-semibold break-all">
            {selectedPoint.featureName}
          </div>
          <div className="flex items-baseline justify-between pt-1">
            <span className="text-slate-400">Value:</span>
            <span className="text-base font-mono font-bold text-white">
              {selectedPoint.featureValue}
            </span>
          </div>
        </div>

        {/* Baseline Lens Details */}
        <div className="pt-2 border-t border-white/5">
          <div className="text-[10px] font-sans font-semibold text-slate-400 uppercase tracking-wider mb-2">
            BASELINE ({activeLens})
          </div>
          {baseline && baseline.quality !== 'INSUFFICIENT' ? (
            <div className="space-y-1.5 font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Median</span>
                <span className="text-white">{baseline.median}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">MAD</span>
                <span className="text-white">{baseline.mad}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-sans">Deviation</span>
                <span
                  className={`font-bold ${
                    selectedPoint.presentationDeviation > 2.5
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  +{selectedPoint.featureValue - (baseline.median ?? 0)} (
                  {selectedPoint.presentationDeviation.toFixed(1)}σ)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Samples</span>
                <span className="text-white">{baseline.sampleCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-sans">Quality</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20">
                  {baseline.quality}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px]">
              Insufficient historical baseline samples for robust MAD projection.
            </div>
          )}
        </div>

        {/* Context Grants */}
        <div className="pt-2 border-t border-white/5">
          <div className="text-[10px] font-sans font-semibold text-slate-400 uppercase tracking-wider mb-1">
            CONTEXT
          </div>
          {grant && isWithinGrant ? (
            <div className="space-y-1">
              <div className="text-xs font-semibold text-cyan-300">
                {grant.rationale}
              </div>
              <div className="text-[11px] font-mono text-slate-400">
                Oct 10 – Oct 14
              </div>
              <div className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-semibold text-cyan-200 bg-cyan-500/20 border border-cyan-500/30">
                Within context window
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-slate-400">
              No overlapping authorization window found.
            </div>
          )}
        </div>

        {/* Related Resources */}
        <div className="pt-2 border-t border-white/5">
          <div className="text-[10px] font-sans font-semibold text-slate-400 uppercase tracking-wider mb-2">
            RELATED RESOURCES ({model.relatedResources.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {model.relatedResources.map((res) => (
              <button
                key={res.id}
                type="button"
                onClick={() => onSelectEntity?.(res.id)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#080f14]/80 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-mono transition-all"
              >
                <span>●</span>
                <span>{res.displayName}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Related Device */}
        <div className="pt-2 border-t border-white/5">
          <div className="text-[10px] font-sans font-semibold text-slate-400 uppercase tracking-wider mb-2">
            RELATED DEVICE
          </div>
          {model.relatedDevices.length > 0 ? (
            <button
              type="button"
              onClick={() => onSelectEntity?.(model.relatedDevices[0].id)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#080f14]/80 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[11px] font-mono transition-all"
            >
              <span>●</span>
              <span>{model.relatedDevices[0].displayName}</span>
            </button>
          ) : (
            <span className="text-[11px] text-slate-500">None detected</span>
          )}
        </div>

        {/* Contributing Events */}
        <div className="pt-2 border-t border-white/5">
          <div className="text-[10px] font-sans font-semibold text-slate-400 uppercase tracking-wider mb-2">
            CONTRIBUTING EVENTS ({model.securityEvents.length})
          </div>
          <div className="space-y-1.5">
            {model.securityEvents.map((evt) => (
              <div
                key={evt.id}
                className="flex items-center justify-between p-2 rounded-lg bg-[#080f14]/60 border border-white/5 font-mono text-[11px]"
              >
                <span className="text-slate-300">{evt.id}</span>
                <span className="text-sky-400 text-[10px] font-semibold font-sans uppercase">
                  {evt.action}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Focus Mode Action Triggers (Matching target sheet card 3) */}
        <div className="pt-3 border-t border-white/10 space-y-1.5">
          <button
            type="button"
            onClick={onIsolateInScene}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 font-sans font-medium text-xs transition-all"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>Isolate in scene</span>
          </button>

          <button
            type="button"
            onClick={() => triggerActionNotification('Resource context lanes opened')}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 font-sans font-medium text-xs transition-all"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Show resource context</span>
          </button>

          <button
            type="button"
            onClick={() => triggerActionNotification('Evidence pinned to active dossier')}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 font-sans font-medium text-xs transition-all"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>Add to investigation</span>
          </button>

          {actionSuccess && (
            <div className="text-center text-[11px] font-sans text-emerald-400 animate-fadeIn pt-1">
              ✓ {actionSuccess}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
