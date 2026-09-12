import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import type {
  SignalSeries,
  ObservationPoint,
  OrganizationalContextWindow,
  BehavioralSignalId,
  ObservatoryFilters,
} from './types';
import { TIMESTAMPS, SHIFT_REGION, CONTEXT_SPAN } from './observatoryData';

interface ObservatoryCanvasProps {
  readonly signals: readonly SignalSeries[];
  readonly contextWindow: OrganizationalContextWindow;
  readonly filters: ObservatoryFilters;
  readonly scannerIndex: number;
  readonly onScannerChange: (index: number) => void;
  readonly onSelectSignal: (id: BehavioralSignalId | null) => void;
  readonly reducedMotion?: boolean;
}

export function ObservatoryCanvas({
  signals,
  contextWindow,
  filters,
  scannerIndex,
  onScannerChange,
  onSelectSignal,
  reducedMotion = false,
}: ObservatoryCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDraggingRef = useRef(false);
  const [hoveredSignalId, setHoveredSignalId] = useState<BehavioralSignalId | null>(null);
  const [hoveredPointInfo, setHoveredPointInfo] = useState<{
    signalId: BehavioralSignalId;
    point: ObservationPoint;
    x: number;
    y: number;
  } | null>(null);

  // Active signals to display
  const activeSeries = useMemo(() => {
    return signals.filter((s) => filters.activeSignals[s.id]);
  }, [signals, filters.activeSignals]);

  // Layout metrics
  const PADDING = { left: 180, right: 60, top: 40, bottom: 40 };

  const getCanvasX = useCallback(
    (index: number, width: number) => {
      const usableWidth = width - PADDING.left - PADDING.right;
      const step = usableWidth / (TIMESTAMPS.length - 1);
      return PADDING.left + index * step;
    },
    [PADDING.left, PADDING.right],
  );

  const getIndexFromCanvasX = useCallback(
    (x: number, width: number) => {
      const usableWidth = width - PADDING.left - PADDING.right;
      const raw = (x - PADDING.left) / usableWidth;
      const clamped = Math.max(0, Math.min(1, raw));
      const idx = Math.round(clamped * (TIMESTAMPS.length - 1));
      return idx;
    },
    [PADDING.left, PADDING.right],
  );

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let pulsePhase = 0;

    const render = () => {
      if (!reducedMotion) {
        pulsePhase = (pulsePhase + 0.03) % (Math.PI * 2);
      }

      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      // Handle high-DPI displays
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // 1. Deep Scientific Observatory Background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#04070c');
      bgGrad.addColorStop(0.5, '#060a12');
      bgGrad.addColorStop(1, '#030508');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      const usableWidth = width - PADDING.left - PADDING.right;
      const laneCount = activeSeries.length;
      const laneHeight = (height - PADDING.top - PADDING.bottom) / Math.max(1, laneCount);

      // 2. Structural Measurement Grid & Fine Temporal Tick Marks
      if (filters.overlays.grid) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);

        TIMESTAMPS.forEach((ts, idx) => {
          const x = getCanvasX(idx, width);
          ctx.beginPath();
          ctx.moveTo(x, PADDING.top - 10);
          ctx.lineTo(x, height - PADDING.bottom + 10);
          ctx.stroke();

          // Minor coordinate ticks
          if (idx % 2 === 0) {
            ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
            ctx.font = '9px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(ts.label, x, height - PADDING.bottom + 24);
          }
        });

        ctx.setLineDash([]);
      }

      // 3. Behavioral Shift Atmospheric Horizon (Section 10 mandate)
      const shiftStartX = getCanvasX(SHIFT_REGION.startIndex, width);
      const shiftEndX = getCanvasX(SHIFT_REGION.endIndex, width);
      const shiftWidth = shiftEndX - shiftStartX;

      // Soft luminous shift atmospheric gradient
      const shiftGrad = ctx.createLinearGradient(shiftStartX, 0, shiftEndX, 0);
      shiftGrad.addColorStop(0, 'rgba(56, 189, 248, 0.015)');
      shiftGrad.addColorStop(0.3, 'rgba(245, 158, 11, 0.04)');
      shiftGrad.addColorStop(0.7, 'rgba(245, 158, 11, 0.055)');
      shiftGrad.addColorStop(1, 'rgba(56, 189, 248, 0.015)');
      ctx.fillStyle = shiftGrad;
      ctx.fillRect(shiftStartX, PADDING.top - 15, shiftWidth, height - PADDING.top - PADDING.bottom + 30);

      // Subtle shift boundary rules
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(shiftStartX, PADDING.top - 15);
      ctx.lineTo(shiftStartX, height - PADDING.bottom + 20);
      ctx.moveTo(shiftEndX, PADDING.top - 15);
      ctx.lineTo(shiftEndX, height - PADDING.bottom + 20);
      ctx.stroke();
      ctx.setLineDash([]);

      // Shift Region Header Badge
      ctx.fillStyle = 'rgba(245, 158, 11, 0.85)';
      ctx.font = '600 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`◈ ${SHIFT_REGION.label}`, shiftStartX + 8, PADDING.top - 4);

      // 4. Organizational Context Temporal Region (Section 17 mandate)
      if (filters.overlays.context) {
        const ctxStartX = getCanvasX(CONTEXT_SPAN.startIndex, width);
        const ctxEndX = getCanvasX(CONTEXT_SPAN.endIndex, width);
        const ctxWidth = ctxEndX - ctxStartX;

        // Translucent teal sheath with soft border
        const ctxGrad = ctx.createLinearGradient(0, PADDING.top, 0, height - PADDING.bottom);
        ctxGrad.addColorStop(0, 'rgba(13, 148, 136, 0.05)');
        ctxGrad.addColorStop(0.5, 'rgba(20, 184, 166, 0.09)');
        ctxGrad.addColorStop(1, 'rgba(13, 148, 136, 0.04)');
        ctx.fillStyle = ctxGrad;
        ctx.fillRect(ctxStartX, PADDING.top, ctxWidth, height - PADDING.top - PADDING.bottom);

        // Fine teal lattice lines
        ctx.strokeStyle = 'rgba(20, 184, 166, 0.12)';
        ctx.lineWidth = 0.75;
        const latticeSpacing = 16;
        for (let lx = ctxStartX; lx <= ctxEndX; lx += latticeSpacing) {
          ctx.beginPath();
          ctx.moveTo(lx, PADDING.top);
          ctx.lineTo(lx, height - PADDING.bottom);
          ctx.stroke();
        }

        // Context boundary lines
        ctx.strokeStyle = 'rgba(45, 212, 191, 0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        ctx.moveTo(ctxStartX, PADDING.top);
        ctx.lineTo(ctxStartX, height - PADDING.bottom);
        ctx.moveTo(ctxEndX, PADDING.top);
        ctx.lineTo(ctxEndX, height - PADDING.bottom);
        ctx.stroke();
        ctx.setLineDash([]);

        // Context Banner Tag
        ctx.fillStyle = 'rgba(45, 212, 191, 0.9)';
        ctx.font = '600 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`CONTEXT PRESENT · ${contextWindow.title.toUpperCase()}`, ctxEndX - 8, PADDING.top - 4);
      }

      // 5. Render Each Behavioral Signal Lane
      activeSeries.forEach((series, laneIdx) => {
        const laneTop = PADDING.top + laneIdx * laneHeight;
        const laneBottom = laneTop + laneHeight;
        const laneMid = laneTop + laneHeight * 0.65;
        const isSelected = filters.selectedSignalId === series.id;
        const isDimmed = filters.selectedSignalId !== null && !isSelected;

        // Visual depth alpha modifier
        const depthAlpha = isSelected ? 1.0 : isDimmed ? 0.35 : 0.85;

        // Lane separator line
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(PADDING.left - 30, laneBottom);
        ctx.lineTo(width - PADDING.right + 20, laneBottom);
        ctx.stroke();

        // Lane Horizon Baseline (zero reference line)
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(PADDING.left, laneMid);
        ctx.lineTo(width - PADDING.right, laneMid);
        ctx.stroke();

        // Helper to project value to lane Y
        const valToY = (val: number) => {
          const norm = (val - series.rangeMin) / (series.rangeMax - series.rangeMin || 1);
          // High values climb towards laneTop + 15
          return laneMid - norm * (laneHeight * 0.55);
        };

        // 5a. Robust Historical Reference Field (Sheath between Upper and Lower threshold)
        if (filters.overlays.baseline) {
          ctx.beginPath();
          // Top edge: upper threshold (Median + 2.5 MAD)
          series.points.forEach((pt, i) => {
            const x = getCanvasX(i, width);
            const y = valToY(pt.upperThreshold);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });

          // Bottom edge: lower threshold
          for (let i = series.points.length - 1; i >= 0; i--) {
            const pt = series.points[i];
            const x = getCanvasX(i, width);
            const y = valToY(pt.lowerThreshold);
            ctx.lineTo(x, y);
          }
          ctx.closePath();

          // Indigo flowing translucent sheath
          const baseGrad = ctx.createLinearGradient(0, laneTop, 0, laneBottom);
          baseGrad.addColorStop(0, `rgba(30, 41, 79, ${0.4 * depthAlpha})`);
          baseGrad.addColorStop(0.5, `rgba(15, 23, 42, ${0.3 * depthAlpha})`);
          baseGrad.addColorStop(1, `rgba(30, 41, 79, ${0.25 * depthAlpha})`);
          ctx.fillStyle = baseGrad;
          ctx.fill();

          // Outer contour isolines
          ctx.strokeStyle = `rgba(99, 102, 241, ${0.3 * depthAlpha})`;
          ctx.lineWidth = 1;
          ctx.stroke();

          // Median Reference Filament (Centerline)
          ctx.beginPath();
          ctx.setLineDash([3, 4]);
          ctx.strokeStyle = `rgba(129, 140, 248, ${0.55 * depthAlpha})`;
          ctx.lineWidth = 1.2;
          series.points.forEach((pt, i) => {
            const x = getCanvasX(i, width);
            const y = valToY(pt.medianValue);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // 5b. Displacement Tension Filaments (Section 9 mandate)
        // When observed leaves baseline sheath, draw vertical tension filaments
        series.points.forEach((pt, i) => {
          if (pt.observedValue > pt.upperThreshold || pt.observedValue < pt.lowerThreshold) {
            const x = getCanvasX(i, width);
            const yObs = valToY(pt.observedValue);
            const yMed = valToY(pt.medianValue);

            const stemGrad = ctx.createLinearGradient(x, yObs, x, yMed);
            stemGrad.addColorStop(0, `rgba(56, 189, 248, ${0.65 * depthAlpha})`);
            stemGrad.addColorStop(1, `rgba(99, 102, 241, ${0.1 * depthAlpha})`);
            ctx.strokeStyle = stemGrad;
            ctx.lineWidth = isSelected ? 1.5 : 1;
            ctx.beginPath();
            ctx.moveTo(x, yObs);
            ctx.lineTo(x, yMed);
            ctx.stroke();
          }
        });

        // 5c. Observed Behavioral Trajectory Filament
        // Smooth cubic Bézier spline interpolation
        const pts = series.points.map((pt, i) => ({
          x: getCanvasX(i, width),
          y: valToY(pt.observedValue),
          pt,
        }));

        // Halo glow stroke
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 0; i < pts.length - 1; i++) {
          const xc = (pts[i].x + pts[i + 1].x) / 2;
          const yc = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.strokeStyle = `rgba(56, 189, 248, ${0.15 * depthAlpha})`;
        ctx.lineWidth = isSelected ? 8 : 5;
        ctx.stroke();

        // Core luminous filament
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 0; i < pts.length - 1; i++) {
          const xc = (pts[i].x + pts[i + 1].x) / 2;
          const yc = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);

        const filamentGrad = ctx.createLinearGradient(PADDING.left, 0, width - PADDING.right, 0);
        filamentGrad.addColorStop(0, `rgba(56, 189, 248, ${0.8 * depthAlpha})`);
        filamentGrad.addColorStop(0.45, `rgba(56, 189, 248, ${0.95 * depthAlpha})`);
        filamentGrad.addColorStop(0.65, `rgba(248, 250, 252, ${1.0 * depthAlpha})`); // High deviation cool white
        filamentGrad.addColorStop(1, `rgba(56, 189, 248, ${0.85 * depthAlpha})`);
        ctx.strokeStyle = filamentGrad;
        ctx.lineWidth = isSelected ? 2.5 : 1.8;
        ctx.stroke();

        // 5d. Observation Node Anchors
        pts.forEach(({ x, y, pt }) => {
          const isShift = pt.isShiftZone;
          const isDeviated = pt.observedValue > pt.upperThreshold;
          const isScannerPoint = pt.index === scannerIndex;

          if (isScannerPoint) {
            // Scanner highlight point handled in scanner step below
            return;
          }

          // Node core
          ctx.beginPath();
          ctx.arc(x, y, isDeviated ? 3.5 : 2.5, 0, Math.PI * 2);
          ctx.fillStyle = isDeviated
            ? `rgba(248, 250, 252, ${1.0 * depthAlpha})`
            : `rgba(56, 189, 248, ${0.85 * depthAlpha})`;
          ctx.fill();

          if (isDeviated) {
            // Subtle amber/cyan ring for significant points
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.strokeStyle = isShift
              ? `rgba(245, 158, 11, ${0.6 * depthAlpha})`
              : `rgba(56, 189, 248, ${0.4 * depthAlpha})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        });

        // 5e. Left Lane Identity & Telemetry Readout
        const currentPt = series.points[scannerIndex] || series.points[0];
        const isCurrentDeviated = currentPt.observedValue > currentPt.upperThreshold;

        // Interactive Lane Header Box
        ctx.fillStyle = isSelected
          ? 'rgba(56, 189, 248, 0.12)'
          : hoveredSignalId === series.id
          ? 'rgba(255, 255, 255, 0.06)'
          : 'rgba(255, 255, 255, 0.02)';
        ctx.fillRect(18, laneTop + 10, PADDING.left - 40, laneHeight - 20);

        ctx.strokeStyle = isSelected
          ? 'rgba(56, 189, 248, 0.5)'
          : 'rgba(255, 255, 255, 0.06)';
        ctx.lineWidth = 1;
        ctx.strokeRect(18, laneTop + 10, PADDING.left - 40, laneHeight - 20);

        // Domain tag
        ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
        ctx.font = '500 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(series.domainName.toUpperCase(), 28, laneTop + 28);

        // Signal Name
        ctx.fillStyle = isSelected ? '#38bdf8' : '#f8fafc';
        ctx.font = '600 13px system-ui, -apple-system, sans-serif';
        ctx.fillText(series.name, 28, laneTop + 46);

        // Current Telemetry Value at Scanner
        ctx.font = '700 18px "JetBrains Mono", monospace';
        ctx.fillStyle = isCurrentDeviated ? '#f8fafc' : '#94a3b8';
        ctx.fillText(`${currentPt.observedValue}`, 28, laneTop + 72);

        // Unit label
        ctx.font = '400 9px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
        ctx.fillText(series.unit, 62, laneTop + 70);

        // Status badge
        ctx.font = '600 9px "JetBrains Mono", monospace';
        if (isCurrentDeviated) {
          ctx.fillStyle = 'rgba(245, 158, 11, 0.95)';
          ctx.fillText(`▲ +${currentPt.deviationSigma}σ DEVIATION`, 28, laneTop + 90);
        } else {
          ctx.fillStyle = 'rgba(56, 189, 248, 0.7)';
          ctx.fillText('● NOMINAL STATE', 28, laneTop + 90);
        }
      });

      // 6. Vertical Temporal Scanner Plane (Section 11 mandate)
      const scannerX = getCanvasX(scannerIndex, width);
      const scannerTime = TIMESTAMPS[scannerIndex]?.label || '10:30';

      // Laser-sharp vertical beam
      const beamGrad = ctx.createLinearGradient(0, PADDING.top - 20, 0, height - PADDING.bottom + 20);
      beamGrad.addColorStop(0, 'rgba(56, 189, 248, 0.85)');
      beamGrad.addColorStop(0.5, 'rgba(248, 250, 252, 0.95)');
      beamGrad.addColorStop(1, 'rgba(99, 102, 241, 0.85)');

      // Glow behind scanner
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(scannerX, PADDING.top - 20);
      ctx.lineTo(scannerX, height - PADDING.bottom + 25);
      ctx.stroke();

      // Sharp center ray
      ctx.strokeStyle = beamGrad;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(scannerX, PADDING.top - 20);
      ctx.lineTo(scannerX, height - PADDING.bottom + 25);
      ctx.stroke();

      // Top Scanner Reticle Head & Timestamp
      ctx.fillStyle = '#070b12';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(scannerX - 34, PADDING.top - 32, 68, 22, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${scannerTime} UTC`, scannerX, PADDING.top - 17);

      // Intersection Reticles at Each Behavioral Lane
      activeSeries.forEach((series, laneIdx) => {
        const laneTop = PADDING.top + laneIdx * laneHeight;
        const laneMid = laneTop + laneHeight * 0.65;
        const pt = series.points[scannerIndex];
        if (!pt) return;

        const norm = (pt.observedValue - series.rangeMin) / (series.rangeMax - series.rangeMin || 1);
        const y = laneMid - norm * (laneHeight * 0.55);

        // Dynamic pulsing outer halo ring
        const pulseRadius = 9 + Math.sin(pulsePhase) * 2;
        ctx.beginPath();
        ctx.arc(scannerX, y, pulseRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Intermediate ring
        ctx.beginPath();
        ctx.arc(scannerX, y, 5.5, 0, Math.PI * 2);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Radiant white core
        ctx.beginPath();
        ctx.arc(scannerX, y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        // 4-point precision reticle crosshairs
        ctx.strokeStyle = 'rgba(248, 250, 252, 0.8)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(scannerX - 8, y);
        ctx.lineTo(scannerX - 4, y);
        ctx.moveTo(scannerX + 4, y);
        ctx.lineTo(scannerX + 8, y);
        ctx.moveTo(scannerX, y - 8);
        ctx.lineTo(scannerX, y - 4);
        ctx.moveTo(scannerX, y + 4);
        ctx.lineTo(scannerX, y + 8);
        ctx.stroke();
      });

      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [
    activeSeries,
    contextWindow,
    filters,
    scannerIndex,
    hoveredSignalId,
    reducedMotion,
    getCanvasX,
  ]);

  // Pointer interaction for dragging / scrubbing scanner
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if clicked in left lane header
    if (x < PADDING.left - 20) {
      const laneCount = activeSeries.length;
      const laneHeight = (rect.height - PADDING.top - PADDING.bottom) / Math.max(1, laneCount);
      const clickedLaneIdx = Math.floor((y - PADDING.top) / laneHeight);
      if (clickedLaneIdx >= 0 && clickedLaneIdx < activeSeries.length) {
        const target = activeSeries[clickedLaneIdx].id;
        onSelectSignal(filters.selectedSignalId === target ? null : target);
        return;
      }
    }

    // Otherwise scrub scanner
    isDraggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const newIdx = getIndexFromCanvasX(x, rect.width);
    onScannerChange(newIdx);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDraggingRef.current) {
      const newIdx = getIndexFromCanvasX(x, rect.width);
      onScannerChange(newIdx);
      return;
    }

    // Check hover over lane headers
    if (x < PADDING.left - 20) {
      const laneCount = activeSeries.length;
      const laneHeight = (rect.height - PADDING.top - PADDING.bottom) / Math.max(1, laneCount);
      const laneIdx = Math.floor((y - PADDING.top) / laneHeight);
      if (laneIdx >= 0 && laneIdx < activeSeries.length) {
        setHoveredSignalId(activeSeries[laneIdx].id);
      } else {
        setHoveredSignalId(null);
      }
    } else {
      setHoveredSignalId(null);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Safe catch
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex-1 overflow-hidden select-none cursor-crosshair"
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="w-full h-full block"
      />
    </div>
  );
}
