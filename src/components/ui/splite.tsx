'use client'

import { Suspense, lazy, useState, useEffect } from 'react'
import { Shield, Cpu, Activity, Lock, Radar } from 'lucide-react'

const Spline = lazy(() => import('@splinetool/react-spline'))

interface SplineSceneProps {
  scene: string
  className?: string
}

function SentinelFallback() {
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setRotation(prev => (prev + 1) % 360);
    }, 40);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative select-none p-6">
      {/* Outer Hexagon / HUD rings */}
      <div className="relative w-64 h-64 md:w-80 md:h-80 flex items-center justify-center">
        {/* Animated Cyber Rings */}
        <div 
          className="absolute inset-0 rounded-full border border-[#3EE7C6]/20 border-dashed"
          style={{ transform: `rotate(${rotation}deg)` }}
        />
        <div 
          className="absolute inset-4 rounded-full border border-[#1E2A35]"
        />
        <div 
          className="absolute inset-8 rounded-full border border-[#3EE7C6]/30 border-t-[#3EE7C6] border-b-transparent animate-spin"
          style={{ animationDuration: '6s' }}
        />
        <div 
          className="absolute inset-16 rounded-full border border-[#FF3B5C]/20 border-r-[#FF3B5C] border-l-transparent animate-spin"
          style={{ animationDuration: '4s', animationDirection: 'reverse' }}
        />
        
        {/* Center Cyber Core */}
        <div className="relative z-10 w-28 h-28 rounded-2xl bg-[#0C131A] border border-[#3EE7C6]/40 flex flex-col items-center justify-center glow-cyan">
          <div className="relative">
            <Shield className="w-12 h-12 text-[#3EE7C6] animate-pulse" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#FF3B5C] animate-ping" />
          </div>
          <span className="mt-1 text-[10px] font-mono text-[#3EE7C6] tracking-wider font-semibold">
            NEURAL_CORE
          </span>
        </div>

        {/* Orbiting Nodes */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded bg-[#0C131A]/90 border border-[#1E2A35] text-[10px] font-mono text-[#7C8DA0] flex items-center gap-1.5 shadow-lg">
          <Activity className="w-3 h-3 text-[#3EE7C6]" />
          <span>AUTONOMOUS_INTERCEPT: ACTIVE</span>
        </div>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded bg-[#0C131A]/90 border border-[#1E2A35] text-[10px] font-mono text-[#7C8DA0] flex items-center gap-1.5 shadow-lg">
          <Lock className="w-3 h-3 text-[#B48CFF]" />
          <span>HONEYNET_MESH: ENGAGED</span>
        </div>
        <div className="absolute left-0 top-1/2 -translate-y-1/2 px-2 py-1 rounded bg-[#0C131A]/90 border border-[#1E2A35] text-[9px] font-mono text-[#4A5A6A] flex items-center gap-1">
          <Cpu className="w-3 h-3 text-[#FFB84D]" />
          <span>TENSOR: 48.2 TOPS</span>
        </div>
        <div className="absolute right-0 top-1/2 -translate-y-1/2 px-2 py-1 rounded bg-[#0C131A]/90 border border-[#1E2A35] text-[9px] font-mono text-[#4A5A6A] flex items-center gap-1">
          <Radar className="w-3 h-3 text-[#3EE7C6]" />
          <span>LATENCY: 0.8ms</span>
        </div>
      </div>
      
      {/* Monospace Telemetry footer */}
      <div className="mt-4 flex items-center gap-4 text-[11px] font-mono text-[#7C8DA0]">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#3EE7C6] animate-pulse" />
          SYNAPSE SOC ONLINE
        </span>
        <span className="text-[#4A5A6A]">|</span>
        <span className="text-[#4A5A6A]">CONTAINMENT SLA &lt; 200ms</span>
      </div>
    </div>
  );
}

export function SplineScene({ scene, className }: SplineSceneProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return <SentinelFallback />;
  }

  return (
    <Suspense fallback={<SentinelFallback />}>
      <div className={className}>
        <Spline 
          scene={scene} 
          className="w-full h-full"
          onError={() => setHasError(true)}
        />
      </div>
    </Suspense>
  )
}
export default SplineScene;
