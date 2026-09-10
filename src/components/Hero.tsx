'use client';

import { motion } from 'framer-motion';
import { Shield, ArrowRight, Zap, Play, Lock, Terminal, Activity, CheckCircle2 } from 'lucide-react';
import { Spotlight } from './ui/spotlight';
import { SplineScene } from './ui/splite';
import { Auralis } from './ui/auralis';

interface HeroProps {
  onLaunchDashboard: () => void;
  onRunSimulation: () => void;
}

export function Hero({ onLaunchDashboard, onRunSimulation }: HeroProps) {
  return (
    <section className="relative w-full min-h-[640px] md:min-h-[720px] bg-[#060A0E] border-b border-[#1E2A35] overflow-hidden flex items-center">
      
      {/* Background Cyan/Teal Auralis Ambient Layer ("System Under Control" mood) */}
      <div className="absolute inset-0 pointer-events-none opacity-45">
        <Auralis 
          height="100%" 
          colors={["#3EE7C6", "#1F8A76", "#062822"]} 
          grain={0.35} 
          speed={0.22} 
        />
      </div>

      {/* Cyber Grid Texture Overlay */}
      <div className="absolute inset-0 cyber-grid opacity-25 pointer-events-none" />

      {/* Spotlight Hover Glow (Cyan palette) */}
      <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" size={340} />

      {/* Hero Content Container */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Column (Headline + Pitch + CTAs) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Top Red Texture Header Accent Badge (Honoring user's red Auralis aesthetic) */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#FF3B5C]/20 via-[#111A23] to-[#3EE7C6]/20 border border-[#FF3B5C]/40 text-xs font-mono text-[#EAF2F5] shadow-lg backdrop-blur-md"
            >
              <span className="w-2 h-2 rounded-full bg-[#FF3B5C] animate-pulse" />
              <span className="text-[#FF3B5C] font-semibold">ZERO-TRUST AUTONOMY</span>
              <span className="text-[#7C8DA0]">&bull;</span>
              <span className="text-[#3EE7C6]">SUB-200ms CONTAINMENT</span>
            </motion.div>

            {/* Main Title with Red Textured Banner Glow & Cyber Typography */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.45 }}
              className="space-y-3"
            >
              {/* OBSIDIAN Brand Header with Red Velvet Auralis Backdrop Strip */}
              <div className="relative inline-block rounded-xl overflow-hidden p-1">
                <div className="absolute inset-0 bg-gradient-to-r from-[#FF3B5C]/30 via-[#7A1E30]/40 to-[#060A0E] border border-[#FF3B5C]/40 rounded-xl" />
                <div className="relative z-10 px-4 py-1.5 flex items-center gap-2.5">
                  <Shield className="w-5 h-5 text-[#FF3B5C]" />
                  <span className="font-mono text-xs md:text-sm font-bold tracking-widest text-[#EAF2F5] uppercase">
                    OBSIDIAN // AUTONOMOUS CYBER-DEFENSE SOC
                  </span>
                </div>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight font-display text-white leading-[1.08]">
                Where Intruders Are{' '}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#3EE7C6] via-[#EAF2F5] to-[#3EE7C6] text-glow-cyan">
                  Trapped & Neutralized
                </span>{' '}
                Before You Even Read the Alert.
              </h1>
            </motion.div>

            {/* Subhead Pitch */}
            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="text-base sm:text-lg text-[#7C8DA0] max-w-2xl font-normal leading-relaxed"
            >
              Replace slow manual incident triage with autonomous behavioral digital twins,
              on-demand honey-mesh deception, and cryptographic SHA-256 evidence ledgers.
              Detect identity drift and sinkhole attacks in <span className="text-[#3EE7C6] font-mono font-semibold">142 milliseconds</span>.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="flex flex-wrap items-center gap-4 pt-2"
            >
              <button
                onClick={onLaunchDashboard}
                className="px-6 py-3.5 rounded-xl bg-[#3EE7C6] hover:bg-[#32c9ab] text-[#060A0E] font-bold font-mono text-sm flex items-center gap-2.5 transition-all glow-cyan hover:scale-[1.02] cursor-pointer"
              >
                <Terminal className="w-4 h-4 text-[#060A0E]" />
                <span>LAUNCH SOC CONSOLE</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={onRunSimulation}
                className="px-6 py-3.5 rounded-xl bg-[#0C131A] hover:bg-[#111A23] text-[#EAF2F5] hover:text-[#3EE7C6] font-mono text-sm font-semibold flex items-center gap-2.5 border border-[#1E2A35] hover:border-[#3EE7C6]/50 transition-all cursor-pointer shadow-lg"
              >
                <Play className="w-4 h-4 text-[#FF3B5C] fill-[#FF3B5C]" />
                <span>RUN ATTACK SIMULATION</span>
              </button>
            </motion.div>

            {/* Micro Live Metrics */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="grid grid-cols-3 gap-4 pt-4 border-t border-[#1E2A35]/60 text-xs font-mono text-[#7C8DA0]"
            >
              <div>
                <div className="text-[#3EE7C6] font-bold text-base sm:text-lg font-mono">142ms</div>
                <div className="text-[11px] text-[#4A5A6A]">Autonomous SLA</div>
              </div>
              <div>
                <div className="text-[#EAF2F5] font-bold text-base sm:text-lg font-mono">0.00%</div>
                <div className="text-[11px] text-[#4A5A6A]">False Positives</div>
              </div>
              <div>
                <div className="text-[#FF3B5C] font-bold text-base sm:text-lg font-mono">100%</div>
                <div className="text-[11px] text-[#4A5A6A]">Merkle Proven</div>
              </div>
            </motion.div>

          </div>

          {/* Right Column (3D Spline Interactive Scene / Sentinel Core) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.25, duration: 0.5 }}
            className="lg:col-span-5 relative h-[380px] sm:h-[450px] md:h-[500px] flex items-center justify-center"
          >
            {/* Outer HUD Decorative Frame */}
            <div className="absolute inset-0 bg-[#0C131A]/70 border border-[#1E2A35] rounded-2xl overflow-hidden backdrop-blur-sm flex items-center justify-center shadow-2xl">
              
              {/* Corner HUD Markers */}
              <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-[#3EE7C6]" />
              <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-[#3EE7C6]" />
              <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-[#3EE7C6]" />
              <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-[#3EE7C6]" />

              {/* Status Header */}
              <div className="absolute top-3 left-4 right-4 z-20 flex items-center justify-between text-[10px] font-mono text-[#7C8DA0] border-b border-[#1E2A35] pb-2">
                <span className="flex items-center gap-1.5">
                  <Activity className="w-3 h-3 text-[#3EE7C6]" />
                  SENTINEL_AI_CORE // MODEL: CLAW-v4
                </span>
                <span className="text-[#3EE7C6] bg-[#3EE7C6]/10 px-2 py-0.5 rounded border border-[#3EE7C6]/30">
                  REAL-TIME GUARD
                </span>
              </div>

              {/* Spline 3D Scene */}
              <div className="w-full h-full pt-8 pb-4">
                <SplineScene
                  scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
                  className="w-full h-full"
                />
              </div>

              {/* Bottom HUD readout */}
              <div className="absolute bottom-3 left-4 right-4 z-20 flex items-center justify-between text-[10px] font-mono text-[#4A5A6A] border-t border-[#1E2A35] pt-2">
                <span>RADAR_SWEEP: NOMINAL</span>
                <span>DECEPTION_NODES: 48 ARMED</span>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
