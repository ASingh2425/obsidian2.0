import React, { useState, useEffect } from 'react';
import { Play, Pause, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import { TIMESTAMPS, SHIFT_REGION, CONTEXT_SPAN } from './observatoryData';

interface ObservatoryTimelineProps {
  readonly scannerIndex: number;
  readonly onScannerChange: (index: number) => void;
  readonly reducedMotion?: boolean;
}

export function ObservatoryTimeline({
  scannerIndex,
  onScannerChange,
  reducedMotion = false,
}: ObservatoryTimelineProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<'OVERVIEW' | 'WINDOW' | 'DETAIL'>('OVERVIEW');

  // Automatic playback timer
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      onScannerChange(scannerIndex >= TIMESTAMPS.length - 1 ? 0 : scannerIndex + 1);
    }, 750);
    return () => clearInterval(interval);
  }, [isPlaying, scannerIndex, onScannerChange]);

  const totalSteps = TIMESTAMPS.length - 1;
  const progressPercent = (scannerIndex / totalSteps) * 100;

  const shiftStartPercent = (SHIFT_REGION.startIndex / totalSteps) * 100;
  const shiftWidthPercent = ((SHIFT_REGION.endIndex - SHIFT_REGION.startIndex) / totalSteps) * 100;

  const ctxStartPercent = (CONTEXT_SPAN.startIndex / totalSteps) * 100;
  const ctxWidthPercent = ((CONTEXT_SPAN.endIndex - CONTEXT_SPAN.startIndex) / totalSteps) * 100;

  return (
    <div className="h-16 w-full px-6 flex items-center justify-between border-t border-white/[0.06] bg-[#04070c]/90 backdrop-blur-xl z-20 select-none">
      {/* Playback Controls */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsPlaying((prev) => !prev)}
          className="w-8 h-8 rounded-full bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 flex items-center justify-center text-sky-400 transition-all shadow-md"
          title={isPlaying ? 'Pause Scanner' : 'Play Timeline'}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
        </button>

        <button
          type="button"
          onClick={() => onScannerChange(Math.max(0, scannerIndex - 1))}
          className="w-7 h-7 rounded bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] flex items-center justify-center text-slate-400 hover:text-white transition-all"
          title="Step Backward"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => onScannerChange(Math.min(TIMESTAMPS.length - 1, scannerIndex + 1))}
          className="w-7 h-7 rounded bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] flex items-center justify-center text-slate-400 hover:text-white transition-all"
          title="Step Forward"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Primary Timeline Scrubber Bar with Context & Shift Markers */}
      <div className="flex-1 max-w-4xl mx-8 relative flex flex-col justify-center">
        {/* Layer 1: Context & Shift Horizontal Indicators */}
        <div className="relative h-2 w-full rounded bg-slate-900/60 overflow-hidden border border-white/[0.04]">
          {/* Shift Atmospheric Region */}
          <div
            className="absolute top-0 bottom-0 bg-amber-500/25 border-x border-amber-500/50"
            style={{
              left: `${shiftStartPercent}%`,
              width: `${shiftWidthPercent}%`,
            }}
            title="Behavioral Shift Horizon (10:00 - 10:38 UTC)"
          />

          {/* Context Span */}
          <div
            className="absolute top-0 bottom-0 bg-teal-500/30 border-x border-teal-500/60"
            style={{
              left: `${ctxStartPercent}%`,
              width: `${ctxWidthPercent}%`,
            }}
            title="Context Window: Project Titan Maintenance"
          />

          {/* Progress fill */}
          <div
            className="absolute top-0 bottom-0 left-0 bg-sky-500/30"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Layer 2: Interactive Range Scrubber */}
        <input
          type="range"
          min={0}
          max={TIMESTAMPS.length - 1}
          value={scannerIndex}
          onChange={(e) => onScannerChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
        />

        {/* Layer 3: Visual Slider Thumb Cursor */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none z-20 flex flex-col items-center"
          style={{ left: `${progressPercent}%` }}
        >
          <div className="w-3 h-3 rounded-full bg-white border-2 border-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.9)]" />
        </div>

        {/* Temporal Scale Labels */}
        <div className="flex justify-between text-[9px] font-mono text-slate-500 mt-1 px-1">
          <span>09:00 UTC</span>
          <span className="text-amber-400/80">◈ SHIFT 10:00 - 10:38</span>
          <span className="text-teal-400/80">CONTEXT 10:00 - 11:15</span>
          <span>12:00 UTC</span>
        </div>
      </div>

      {/* Semantic Zoom Presets */}
      <div className="flex items-center gap-1 bg-white/[0.03] p-0.5 rounded border border-white/[0.06] text-[10px] font-mono">
        <span className="px-1.5 text-slate-500 uppercase flex items-center gap-1">
          <ZoomIn className="w-3 h-3" />
          Zoom:
        </span>
        {(['OVERVIEW', 'WINDOW', 'DETAIL'] as const).map((z) => (
          <button
            key={z}
            type="button"
            onClick={() => setZoomLevel(z)}
            className={`px-2 py-0.5 rounded transition-all ${
              zoomLevel === z
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {z}
          </button>
        ))}
      </div>
    </div>
  );
}
