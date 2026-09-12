import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { ObservatoryHeader } from './ObservatoryHeader';
import { ObservatoryLeftRail } from './ObservatoryLeftRail';
import { ObservatoryCanvas } from './ObservatoryCanvas';
import { ObservatoryInspector } from './ObservatoryInspector';
import { ObservatoryTimeline } from './ObservatoryTimeline';
import type {
  BehavioralSignalId,
  BaselineComparisonLens,
  ObservatoryFilters,
  ActorEntity,
} from './types';
import {
  PRIMARY_ACTOR,
  CONTEXT_WINDOW,
  DEFAULT_SCANNER_INDEX,
  getSignalsForLens,
  TIMESTAMPS,
} from './observatoryData';

interface BehavioralObservatoryProps {
  readonly onSwitchToSpatial: () => void;
  readonly reducedMotion?: boolean;
}

export function BehavioralObservatory({
  onSwitchToSpatial,
  reducedMotion = false,
}: BehavioralObservatoryProps) {
  // 1. Entity state
  const [selectedActor, setSelectedActor] = useState<ActorEntity>(PRIMARY_ACTOR);

  // 2. Temporal Scanner state (default 10:30 UTC = index 12)
  const [scannerIndex, setScannerIndex] = useState<number>(DEFAULT_SCANNER_INDEX);

  // 3. Analytical Filters & Overlays
  const [filters, setFilters] = useState<ObservatoryFilters>({
    activeSignals: {
      AUTH: true,
      RESOURCE: true,
      PRIVILEGE: true,
      DEVICE: false,
    },
    selectedSignalId: null,
    activeLens: 'PERSONAL',
    overlays: {
      baseline: true,
      context: true,
      evidence: true,
      grid: true,
      labels: true,
    },
  });

  // 4. Derived signals for active baseline comparison lens
  const signals = useMemo(() => {
    return getSignalsForLens(filters.activeLens);
  }, [filters.activeLens]);

  // Handlers
  const handleToggleSignal = useCallback((id: BehavioralSignalId) => {
    setFilters((prev) => ({
      ...prev,
      activeSignals: {
        ...prev.activeSignals,
        [id]: !prev.activeSignals[id],
      },
    }));
  }, []);

  const handleSelectSignal = useCallback((id: BehavioralSignalId | null) => {
    setFilters((prev) => ({
      ...prev,
      selectedSignalId: id,
    }));
  }, []);

  const handleSelectLens = useCallback((lens: BaselineComparisonLens) => {
    setFilters((prev) => ({
      ...prev,
      activeLens: lens,
    }));
  }, []);

  const handleToggleOverlay = useCallback((key: keyof ObservatoryFilters['overlays']) => {
    setFilters((prev) => ({
      ...prev,
      overlays: {
        ...prev.overlays,
        [key]: !prev.overlays[key],
      },
    }));
  }, []);

  const handleResetScanner = useCallback(() => {
    setScannerIndex(DEFAULT_SCANNER_INDEX);
  }, []);

  // Keyboard navigation for precision analysis
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setScannerIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight') {
        setScannerIndex((prev) => Math.min(TIMESTAMPS.length - 1, prev + 1));
      } else if (e.key === 'Escape') {
        setFilters((prev) => ({ ...prev, selectedSignalId: null }));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="relative w-screen h-screen flex flex-col bg-[#030508] text-slate-100 font-sans overflow-hidden select-none">
      {/* 1. TOP SCIENTIFIC HEADER */}
      <ObservatoryHeader
        scannerIndex={scannerIndex}
        onSwitchToSpatial={onSwitchToSpatial}
        onResetScanner={handleResetScanner}
      />

      {/* 2. MAIN COHESIVE OBSERVATORY ENVIRONMENT */}
      <div className="flex-1 w-full flex flex-row relative overflow-hidden">
        {/* Floating Left Analytical Instrumentation Rail */}
        <ObservatoryLeftRail
          selectedActor={selectedActor}
          onSelectActor={setSelectedActor}
          filters={filters}
          onToggleSignal={handleToggleSignal}
          onSelectLens={handleSelectLens}
          onToggleOverlay={handleToggleOverlay}
        />

        {/* Central Hero: Behavioral Observatory Canvas (Dominates 75% of viewport) */}
        <main className="flex-1 h-full relative overflow-hidden flex flex-col bg-[#04070c]">
          <ObservatoryCanvas
            signals={signals}
            contextWindow={CONTEXT_WINDOW}
            filters={filters}
            scannerIndex={scannerIndex}
            onScannerChange={setScannerIndex}
            onSelectSignal={handleSelectSignal}
            reducedMotion={reducedMotion}
          />
        </main>

        {/* Right Forensic Telemetry Inspector */}
        <ObservatoryInspector
          signals={signals}
          contextWindow={CONTEXT_WINDOW}
          filters={filters}
          scannerIndex={scannerIndex}
          onSelectSignal={handleSelectSignal}
        />
      </div>

      {/* 3. BOTTOM TEMPORAL NAVIGATOR */}
      <ObservatoryTimeline
        scannerIndex={scannerIndex}
        onScannerChange={setScannerIndex}
        reducedMotion={reducedMotion}
      />
    </div>
  );
}
