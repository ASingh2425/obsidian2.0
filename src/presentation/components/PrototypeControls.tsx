import React from 'react';
import type {
  AnalyticalProjectionMode,
  BaselineComparisonLens,
} from '../types/presentationTypes';
import type { CameraPreset } from '../spatial/camera/CameraController';

interface PrototypeControlsProps {
  readonly projection: AnalyticalProjectionMode;
  readonly lens: BaselineComparisonLens;
  readonly cameraPreset: CameraPreset;
  readonly reducedMotion: boolean;
  readonly onProjectionChange: (mode: AnalyticalProjectionMode) => void;
  readonly onLensChange: (lens: BaselineComparisonLens) => void;
  readonly onCameraPresetChange: (preset: CameraPreset) => void;
  readonly onToggleReducedMotion: () => void;
}

export function PrototypeControls({
  projection,
  lens,
  cameraPreset,
  reducedMotion,
  onProjectionChange,
  onLensChange,
  onCameraPresetChange,
  onToggleReducedMotion,
}: PrototypeControlsProps) {
  return (
    <div className="flex flex-col gap-4 p-4 bg-[#111620]/90 border border-white/10 rounded-xl backdrop-blur-md shadow-2xl">
      {/* Analytical Projection Mode */}
      <div>
        <div className="text-[11px] font-mono tracking-wider text-slate-400 uppercase mb-2">
          Analytical Projection
        </div>
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#0b0e14] border border-white/5 rounded-lg">
          <button
            type="button"
            onClick={() => onProjectionChange('BEHAVIOR')}
            className={`px-3 py-1.5 text-xs font-mono rounded transition-all ${
              projection === 'BEHAVIOR'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            BEHAVIOR
          </button>
          <button
            type="button"
            onClick={() => onProjectionChange('RESOURCE')}
            className={`px-3 py-1.5 text-xs font-mono rounded transition-all ${
              projection === 'RESOURCE'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            RESOURCE
          </button>
        </div>
        <p className="text-[10px] text-slate-500 mt-1.5 px-0.5">
          {projection === 'BEHAVIOR'
            ? 'Focuses on chronological trajectory along baseline deviation.'
            : 'Separates evidence into dedicated parallel resource lanes.'}
        </p>
      </div>

      {/* Baseline Comparison Lens */}
      <div>
        <div className="text-[11px] font-mono tracking-wider text-slate-400 uppercase mb-2">
          Baseline Comparison Lens
        </div>
        <div className="flex flex-col gap-1.5">
          {[
            { id: 'PERSONAL', label: 'Personal Baseline', desc: 'Actor historical median & MAD' },
            { id: 'PEER', label: 'Peer Cohort', desc: 'Median-of-peer-medians (infra eng)' },
            { id: 'RESOURCE', label: 'Resource Baseline', desc: 'Target resource profile (Insufficient)' },
          ].map((item) => {
            const isSelected = lens === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onLensChange(item.id as BaselineComparisonLens)}
                className={`flex flex-col items-start px-3 py-2 text-left rounded-lg border transition-all ${
                  isSelected
                    ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-200'
                    : 'bg-[#0b0e14]/60 border-white/5 text-slate-400 hover:bg-[#0b0e14] hover:text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-mono font-medium">
                    {item.label}
                  </span>
                  {item.id === 'RESOURCE' && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-white/10">
                      INSUFFICIENT
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5">
                  {item.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Camera Presets */}
      <div>
        <div className="text-[11px] font-mono tracking-wider text-slate-400 uppercase mb-2">
          Spatial Camera View
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { id: 'OVERVIEW', label: 'Overview' },
            { id: 'FOCUS', label: 'Focus Point' },
            { id: 'RESET', label: 'Reset' },
          ].map((cam) => (
            <button
              key={cam.id}
              type="button"
              onClick={() => onCameraPresetChange(cam.id as CameraPreset)}
              className={`px-2 py-1.5 text-xs font-mono rounded border transition-all ${
                cameraPreset === cam.id
                  ? 'bg-white/15 border-white/30 text-white font-semibold'
                  : 'bg-[#0b0e14] border-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              {cam.label}
            </button>
          ))}
        </div>
      </div>

      {/* Reduced Motion Setting */}
      <div className="pt-2 border-t border-white/5 flex items-center justify-between">
        <span className="text-xs text-slate-400 font-mono">Reduced Motion</span>
        <button
          type="button"
          onClick={onToggleReducedMotion}
          className={`px-2.5 py-1 text-xs font-mono rounded border transition-all ${
            reducedMotion
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-semibold'
              : 'bg-[#0b0e14] border-white/10 text-slate-400 hover:text-slate-200'
          }`}
        >
          {reducedMotion ? 'ENABLED' : 'DISABLED'}
        </button>
      </div>
    </div>
  );
}
