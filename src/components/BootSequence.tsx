'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Terminal, ArrowRight, Lock } from 'lucide-react';
import { Auralis } from './ui/auralis';
import { SplineScene } from './ui/splite';

interface BootSequenceProps {
  onComplete: () => void;
}

const BOOT_STEPS = [
  "INITIALIZING SECURE ENVIRONMENT...",
  "CALIBRATING NEURAL IDENTITY BASELINES...",
  "DEPLOYING HONEYNET DECEPTION MESH...",
  "SYNAPSE SOC ONLINE: READY."
];

export function BootSequence({ onComplete }: BootSequenceProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [typedText, setTypedText] = useState("");
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const targetText = BOOT_STEPS[currentStepIndex];

    if (typedText.length < targetText.length) {
      timeout = setTimeout(() => {
        setTypedText(targetText.slice(0, typedText.length + 1));
      }, 16);
    } else {
      // Step completed, pause before next step
      if (currentStepIndex < BOOT_STEPS.length - 1) {
        timeout = setTimeout(() => {
          setCurrentStepIndex(prev => prev + 1);
          setTypedText("");
        }, 320);
      } else {
        // All steps completed, auto-transition
        timeout = setTimeout(() => {
          setIsExiting(true);
          setTimeout(() => {
            onComplete();
          }, 450);
        }, 550);
      }
    }

    return () => clearTimeout(timeout);
  }, [currentStepIndex, typedText, onComplete]);

  return (
    <AnimatePresence>
      {!isExiting && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-50 bg-[#060A0E] flex flex-col items-center justify-center overflow-hidden"
        >
          {/* Background Auralis WebGL Shader (Threat-Red / Ember Mode) */}
          <div className="absolute inset-0 pointer-events-none opacity-85">
            <Auralis 
              height="100vh" 
              colors={["#ef4444", "#dc2626", "#881337"]} 
              grain={0.5} 
              speed={0.4} 
            />
          </div>

          {/* Cyber scanline overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_50%,rgba(0,0,0,0.5)_51%)] bg-[length:100%_4px] pointer-events-none opacity-40" />

          {/* Content Container */}
          <div className="relative z-10 flex flex-col items-center max-w-xl mx-auto px-6 text-center">
            
            {/* Top Sentinel Badge & 3D Robot Sentinel Preview */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="relative mb-6"
            >
              {/* Spline 3D Scene / Sentinel HUD Core */}
              <div className="w-36 h-36 md:w-44 md:h-44 relative mx-auto flex items-center justify-center">
                <SplineScene
                  scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
                  className="w-full h-full"
                />
              </div>

              {/* Glowing Pulse Accent */}
              <div className="absolute -inset-2 rounded-full bg-[#FF3B5C]/15 blur-xl pointer-events-none animate-pulse" />
            </motion.div>

            {/* OBSIDIAN Wordmark with Red Noise Aesthetic Plate */}
            <motion.div
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              className="mb-4"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#111A23]/80 border border-[#FF3B5C]/40 text-[#FF3B5C] text-xs font-mono mb-3 tracking-widest uppercase">
                <Lock className="w-3 h-3 text-[#FF3B5C] animate-pulse" />
                <span>Zero-Trust Protocol Active</span>
              </div>

              <h1 className="text-4xl md:text-5xl font-extrabold tracking-wider font-display text-white flex items-center justify-center gap-3">
                <Shield className="w-9 h-9 text-[#FF3B5C] fill-[#FF3B5C]/20" />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-[#EAF2F5] to-[#FF3B5C]">
                  OBSIDIAN
                </span>
              </h1>
              <p className="text-[#7C8DA0] text-xs md:text-sm font-mono tracking-widest mt-1 uppercase">
                Autonomous Cyber-Defense SOC
              </p>
            </motion.div>

            {/* Monospace Status Line Terminal */}
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="w-full max-w-md bg-[#0C131A]/90 backdrop-blur border border-[#1E2A35] rounded-lg p-3.5 my-4 text-left shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[#1E2A35] pb-2 mb-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#FF3B5C] animate-pulse" />
                  <span className="text-[11px] font-mono text-[#7C8DA0] uppercase tracking-wider flex items-center gap-1">
                    <Terminal className="w-3 h-3 text-[#FF3B5C]" />
                    KERNEL_BOOT_LOG
                  </span>
                </div>
                <span className="text-[10px] font-mono text-[#4A5A6A]">STAGE {currentStepIndex + 1}/4</span>
              </div>

              <div className="font-mono text-xs text-[#3EE7C6] min-h-[22px] flex items-center">
                <span>&gt; {typedText}</span>
                <span className="inline-block w-2 h-3.5 bg-[#3EE7C6] ml-1 animate-pulse" />
              </div>

              {/* Progress bar */}
              <div className="w-full bg-[#111A23] h-1.5 rounded-full mt-3 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-[#FF3B5C] to-[#3EE7C6] transition-all duration-300 rounded-full"
                  style={{ width: `${((currentStepIndex + 1) / BOOT_STEPS.length) * 100}%` }}
                />
              </div>
            </motion.div>

            {/* Quick Skip button for immediate demo */}
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.8 }}
              whileHover={{ opacity: 1, scale: 1.05 }}
              onClick={onComplete}
              className="mt-4 px-4 py-1.5 rounded-md bg-[#111A23]/60 hover:bg-[#1E2A35] text-[#7C8DA0] hover:text-[#EAF2F5] text-xs font-mono flex items-center gap-1.5 border border-[#1E2A35] transition-all cursor-pointer"
            >
              <span>SKIP INITIALIZATION</span>
              <ArrowRight className="w-3 h-3" />
            </motion.button>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
