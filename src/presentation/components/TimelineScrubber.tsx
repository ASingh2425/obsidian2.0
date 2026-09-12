import React, { useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import type { TrajectoryPointViewModel } from '../types/presentationTypes';

interface TimelineScrubberProps {
  readonly allPoints: readonly TrajectoryPointViewModel[];
  readonly currentCursorIndex: number;
  readonly isPlaying: boolean;
  readonly playbackSpeed: number;
  readonly onCursorIndexChange: (index: number) => void;
  readonly onTogglePlay: () => void;
  readonly onToggleSpeed: () => void;
}

export function TimelineScrubber({
  allPoints,
  currentCursorIndex,
  isPlaying,
  playbackSpeed,
  onCursorIndexChange,
  onTogglePlay,
  onToggleSpeed,
}: TimelineScrubberProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const totalCount = allPoints.length;
  const currentPoint = allPoints[currentCursorIndex] ?? allPoints[totalCount - 1];

  // Auto-play interval
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        onCursorIndexChange(
          currentCursorIndex < totalCount - 1 ? currentCursorIndex + 1 : 0,
        );
      }, 1200 / playbackSpeed);
    }
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, currentCursorIndex, totalCount, onCursorIndexChange]);

  // Click on track to scrub
  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current || totalCount === 0) return;
    const rect = trackRef.current.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const ratio = clickX / rect.width;
    const targetIndex = Math.round(ratio * (totalCount - 1));
    onCursorIndexChange(Math.max(0, Math.min(targetIndex, totalCount - 1)));
  };

  const cursorPercent = totalCount > 1 ? (currentCursorIndex / (totalCount - 1)) * 100 : 0;

  return (
    <div className="w-full max-w-5xl mx-auto px-6 py-2.5 rounded-full bg-[#111827]/80 border border-white/10 backdrop-blur-xl shadow-2xl flex items-center gap-6 text-slate-200 select-none">
      {/* Play/Pause & Speed */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onTogglePlay}
          title={isPlaying ? 'Pause Temporal Replay' : 'Replay Temporal Trajectory'}
          className="w-7 h-7 rounded-full flex items-center justify-center bg-white/5 hover:bg-sky-500/20 text-slate-300 hover:text-sky-300 border border-white/10 hover:border-sky-500/30 transition-all"
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
        </button>

        <button
          type="button"
          onClick={onToggleSpeed}
          title="Toggle Replay Speed"
          className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
        >
          {playbackSpeed}x
        </button>
      </div>

      {/* Start Timestamp Label */}
      <div className="text-[10px] font-mono text-slate-400 shrink-0 hidden sm:block">
        <span className="text-slate-500 font-sans mr-1">Oct 14, 2025</span> 09:00 UTC
      </div>

      {/* Interactive Multi-Track Timeline Canvas */}
      <div
        ref={trackRef}
        onClick={handleTrackClick}
        className="flex-1 relative h-7 flex items-center cursor-pointer group"
      >
        {/* Subtle Horizontal Background Guide Lines */}
        <div className="absolute inset-x-0 h-0.5 bg-slate-800/80 rounded-full" />
        <div className="absolute inset-x-0 top-1 h-px bg-white/5" />
        <div className="absolute inset-x-0 bottom-1 h-px bg-white/5" />

        {/* Context Grant Span Bar */}
        <div
          style={{ left: '20%', width: '45%' }}
          className="absolute h-1 top-1 bg-cyan-500/30 rounded-full border border-cyan-400/40"
          title="Context Grant Active: Engineering Project"
        />

        {/* Discrete Observation Anchors */}
        {allPoints.map((pt, idx) => {
          const ptPercent = totalCount > 1 ? (idx / (totalCount - 1)) * 100 : 0;
          const isPassed = idx <= currentCursorIndex;
          const isCurrent = idx === currentCursorIndex;

          return (
            <div
              key={pt.observationId}
              style={{ left: `${ptPercent}%` }}
              className="absolute -translate-x-1/2 flex flex-col items-center pointer-events-none"
            >
              {/* Device dot on upper track */}
              {idx % 3 === 0 && (
                <div
                  className={`w-1 h-1 rounded-full mb-1 ${
                    isPassed ? 'bg-purple-400' : 'bg-purple-900/50'
                  }`}
                />
              )}

              {/* Observation Anchor on main track */}
              <div
                className={`transition-all rounded-full ${
                  isCurrent
                    ? 'w-3 h-3 bg-white ring-4 ring-sky-400/40 shadow-[0_0_12px_#38bdf8]'
                    : isPassed
                    ? 'w-1.5 h-1.5 bg-sky-400'
                    : 'w-1.5 h-1.5 bg-slate-700'
                }`}
              />

              {/* Resource access dot on lower track */}
              {idx % 2 === 0 && (
                <div
                  className={`w-1 h-1 rounded-full mt-1 ${
                    isPassed ? 'bg-amber-400' : 'bg-amber-900/50'
                  }`}
                />
              )}
            </div>
          );
        })}

        {/* Current Active Cursor Marker with Tooltip Callout */}
        <div
          style={{ left: `${cursorPercent}%` }}
          className="absolute -translate-x-1/2 flex flex-col items-center pointer-events-none"
        >
          {/* Vertical cursor line */}
          <div className="w-0.5 h-6 bg-sky-400 shadow-[0_0_8px_#38bdf8]" />

          {/* Current Cursor Floating Badge */}
          <div className="absolute -top-7 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#080f14] border border-sky-400/50 text-white shadow-lg whitespace-nowrap">
            {currentPoint ? currentPoint.timestamp.slice(11, 16) : '--:--'} UTC
          </div>
        </div>
      </div>

      {/* End Timestamp Label */}
      <div className="text-[10px] font-mono text-slate-400 shrink-0 hidden sm:block">
        12:00 UTC
      </div>
    </div>
  );
}
