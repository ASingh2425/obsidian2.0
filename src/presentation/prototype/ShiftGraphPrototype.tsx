import React, { useState, useMemo, useCallback } from 'react';
import { RotateCcw } from 'lucide-react';
import { ShiftGraphCanvas, type OverlaysState } from '../spatial/ShiftGraphCanvas';
import { buildShiftGraphScene } from '../scene/buildShiftGraphScene';
import {
  assembleTrajectoryViewModels,
} from '../adapters/trajectoryAdapter';
import {
  assembleContextViewModels,
  assembleDeviceViewModels,
  assembleResourceViewModels,
} from '../adapters/evidenceAdapter';
import {
  PROTOTYPE_ACTOR,
  PROTOTYPE_BASELINES,
  PROTOTYPE_SECURITY_EVENTS,
  RAW_OBSERVATION_SEEDS,
} from '../data/prototypeData';
import type {
  BaselineComparisonLens,
  AnalyticalProjectionMode,
  ShiftGraphPresentationModel,
} from '../types/presentationTypes';
import type { CameraPreset } from '../spatial/camera/CameraController';

interface ShiftGraphPrototypeProps {
  readonly onSwitchToLegacy?: () => void;
  readonly onSwitchToObservatory?: () => void;
  readonly reducedMotion?: boolean;
}

export function ShiftGraphPrototype({
  onSwitchToLegacy,
  onSwitchToObservatory,
  reducedMotion = false,
}: ShiftGraphPrototypeProps) {
  // Navigation & Projection state
  const [projection, setProjection] = useState<AnalyticalProjectionMode>('BEHAVIOR');
  const [lens, setLens] = useState<BaselineComparisonLens>('PERSONAL');

  // Overlays state
  const [overlays, setOverlays] = useState<OverlaysState>({
    baseline: true,
    context: true,
    resources: true,
    devices: true,
    labels: true,
  });

  // Selection & Focal state
  const [selectedObservationId, setSelectedObservationId] = useState<string | null>('obs-win-11');
  const [focusedEntityId, setFocusedEntityId] = useState<string | null>(null);

  // Camera state
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('OVERVIEW');

  // Temporal cursor index
  const [cursorIndex] = useState<number>(RAW_OBSERVATION_SEEDS.length - 1);
  const currentObs = RAW_OBSERVATION_SEEDS[cursorIndex];
  const cursorTime = currentObs?.timestamp;

  // Build presentation model
  const presentationModel = useMemo<ShiftGraphPresentationModel>(() => {
    const trajectoryPoints = assembleTrajectoryViewModels({
      actorEntityId: PROTOTYPE_ACTOR.id,
      featureName: 'event_count_by_action:READ',
      baseline: PROTOTYPE_BASELINES[lens],
      lens,
      timeCursor: cursorTime,
    });

    return {
      actor: PROTOTYPE_ACTOR,
      featureName: 'event_count_by_action:READ',
      temporalWindow: {
        start: '2024-04-01T08:00:00Z',
        end: '2024-04-01T10:30:00Z',
      },
      trajectoryPoints,
      baselines: PROTOTYPE_BASELINES,
      activeLens: lens,
      contextGrants: assembleContextViewModels(cursorTime),
      relatedResources: assembleResourceViewModels(cursorTime),
      relatedDevices: assembleDeviceViewModels(cursorTime),
      securityEvents: PROTOTYPE_SECURITY_EVENTS,
    };
  }, [lens, cursorTime]);

  // Build 3D spatial scene model
  const scene = useMemo(() => {
    return buildShiftGraphScene({
      model: presentationModel,
      projection,
      lens,
      cursorTime,
    });
  }, [presentationModel, projection, lens, cursorTime]);

  const handleSelectObservation = useCallback((id: string) => {
    setSelectedObservationId(id);
    setFocusedEntityId(null);
  }, []);

  const handleSelectEntity = useCallback((id: string) => {
    setFocusedEntityId(id);
  }, []);

  const handleResetCamera = useCallback(() => {
    setCameraPreset('RESET');
    setTimeout(() => setCameraPreset('OVERVIEW'), 150);
  }, []);

  return (
    <div className="relative w-screen h-screen bg-[#070b12] text-slate-100 font-sans overflow-hidden select-none">
      {/* 1. PRIMARY SPATIAL CANVAS (Full-bleed 100% immersive evidence landscape) */}
      <ShiftGraphCanvas
        scene={scene}
        selectedObservationId={selectedObservationId}
        focusedEntityId={focusedEntityId}
        cameraPreset={cameraPreset}
        overlays={overlays}
        onSelectObservation={handleSelectObservation}
        onSelectEntity={handleSelectEntity}
        reducedMotion={reducedMotion}
      />

      {/* 2. MINIMAL FLOATING CONTROLS FOR SPATIAL EVALUATION (Section 10 mandate) */}
      <div className="absolute top-5 left-6 z-20 flex items-center gap-3">
        {/* Brand & Mode Pill */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#070b12]/80 border border-white/10 backdrop-blur-xl text-xs font-medium text-slate-200 shadow-2xl">
          <span className="font-bold tracking-widest text-sky-400 font-mono">OBSIDIAN 2.0</span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-400 text-[11px]">SPATIAL EVALUATION</span>
        </div>

        {/* Projection Switcher */}
        <div className="flex items-center rounded-full bg-[#070b12]/80 border border-white/10 backdrop-blur-xl p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setProjection('BEHAVIOR')}
            className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all ${
              projection === 'BEHAVIOR'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Behavior
          </button>
          <button
            type="button"
            onClick={() => setProjection('RESOURCE')}
            className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all ${
              projection === 'RESOURCE'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Resource
          </button>
        </div>

        {/* Lens Switcher */}
        <div className="flex items-center rounded-full bg-[#070b12]/80 border border-white/10 backdrop-blur-xl p-0.5 text-xs">
          {(['PERSONAL', 'PEER', 'RESOURCE'] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLens(l)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-mono uppercase transition-all ${
                lens === l
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Quick Observation Selector */}
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#070b12]/80 border border-white/10 backdrop-blur-xl text-xs">
          <span className="text-[10px] uppercase font-mono text-slate-400 mr-1">Focus:</span>
          {RAW_OBSERVATION_SEEDS.slice(-4).map((obs) => (
            <button
              key={obs.id}
              type="button"
              onClick={() => handleSelectObservation(obs.id)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all ${
                selectedObservationId === obs.id
                  ? 'bg-sky-400 text-slate-950 font-bold shadow-[0_0_10px_rgba(56,189,248,0.5)]'
                  : 'text-slate-400 hover:text-white bg-white/5'
              }`}
            >
              {obs.id.replace('obs-win-', '#')}
            </button>
          ))}
        </div>

        {/* Camera Reset */}
        <button
          type="button"
          onClick={handleResetCamera}
          title="Reset Camera View"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#070b12]/80 hover:bg-white/10 border border-white/10 backdrop-blur-xl text-[11px] font-medium text-slate-300 transition-all shadow-lg"
        >
          <RotateCcw className="w-3 h-3 text-slate-400" />
          <span>Reset View</span>
        </button>

        {/* Behavioral Observatory Switcher */}
        {onSwitchToObservatory && (
          <button
            type="button"
            onClick={onSwitchToObservatory}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 backdrop-blur-xl text-[11px] font-medium text-sky-300 transition-all shadow-lg"
          >
            <span>Compare: Behavioral Observatory</span>
          </button>
        )}

        {/* Legacy Fallback */}
        {onSwitchToLegacy && (
          <button
            type="button"
            onClick={onSwitchToLegacy}
            className="text-[11px] text-slate-500 hover:text-slate-400 underline ml-2"
          >
            Phase 0 Legacy
          </button>
        )}
      </div>

      {/* Overlays quick toggle in bottom right */}
      <div className="absolute bottom-5 right-6 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#070b12]/80 border border-white/10 backdrop-blur-xl text-[10px] text-slate-400">
        <span className="mr-1 font-mono uppercase text-slate-400">Layers:</span>
        {(['baseline', 'context', 'resources', 'devices'] as const).map((layer) => (
          <button
            key={layer}
            type="button"
            onClick={() => setOverlays((prev) => ({ ...prev, [layer]: !prev[layer] }))}
            className={`px-2 py-0.5 rounded font-mono capitalize transition-all ${
              overlays[layer]
                ? 'bg-white/15 text-white'
                : 'text-slate-600 line-through'
            }`}
          >
            {layer}
          </button>
        ))}
      </div>
    </div>
  );
}
