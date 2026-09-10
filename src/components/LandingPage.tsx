'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Shield, Terminal, ArrowRight, Zap, Play, CheckCircle2, 
  Lock, Globe, Database, FileCheck, ShieldAlert, UserCheck, 
  Activity, Layers, ArrowUpRight, Cpu, HelpCircle 
} from 'lucide-react';
import { Hero } from './Hero';
import { ThreatMap } from './ThreatMap';
import { CAPABILITIES, WORKFLOW_STAGES, COMPETITOR_DATA } from '../data/mockData';

interface LandingPageProps {
  onLaunchDashboard: () => void;
  onRunSimulation: () => void;
}

export function LandingPage({ onLaunchDashboard, onRunSimulation }: LandingPageProps) {
  const [activeWorkflowStep, setActiveWorkflowStep] = useState(0);

  const getCapabilityIcon = (iconName: string) => {
    switch (iconName) {
      case 'ShieldAlert': return ShieldAlert;
      case 'UserCheck': return UserCheck;
      case 'Zap': return Zap;
      case 'FileCheck': return FileCheck;
      case 'Globe': return Globe;
      case 'Database': return Database;
      default: return Shield;
    }
  };

  return (
    <div className="min-h-screen bg-[#060A0E] text-[#EAF2F5] selection:bg-[#3EE7C6]/20 selection:text-[#3EE7C6] relative">
      
      {/* Scanline CRT overlay */}
      <div className="fixed inset-0 scanline opacity-25 pointer-events-none z-50" />

      {/* Dot-matrix cyber texture */}
      <div className="fixed inset-0 dot-matrix opacity-10 pointer-events-none z-0" />

      {/* Top Cyber Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#0C131A]/90 border-b border-[#2C3D4C] backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          {/* Logo & System Status */}
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 sm:w-10 sm:h-10 border-2 border-[#FF3B5C] flex items-center justify-center transform rotate-45 glow-red bg-[#060A0E]">
                <div className="w-3.5 h-3.5 bg-[#FF3B5C]" />
              </div>
              <div className="flex flex-col pl-1">
                <span className="display font-bold text-2xl tracking-tighter obsidian-text">
                  OBSIDIAN
                </span>
                <span className="text-[9px] mono text-[#7C8DA0] -mt-1 tracking-widest uppercase">
                  SOC DEFENSE ENGINE
                </span>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-2 pl-4 border-l border-[#1E2A35] text-xs mono text-[#7C8DA0]">
              <span className="w-2 h-2 rounded-full bg-[#3EE7C6] animate-pulse" />
              <span>[ NOMINAL / ENCRYPTED &bull; 48 HONEYNETS ARMED ]</span>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="hidden lg:flex items-center gap-6 text-xs mono text-[#7C8DA0]">
            <a href="#pipeline" className="hover:text-[#3EE7C6] transition-colors">WORKFLOW</a>
            <a href="#capabilities" className="hover:text-[#3EE7C6] transition-colors">CAPABILITIES</a>
            <a href="#threat-map" className="hover:text-[#3EE7C6] transition-colors">THREAT MAP</a>
            <a href="#competitors" className="hover:text-[#3EE7C6] transition-colors">BENCHMARKS</a>
          </nav>

          {/* CTA Actions */}
          <div className="flex items-center gap-3 mono text-xs">
            <button
              onClick={onRunSimulation}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded bg-[#111A23] hover:bg-[#1E2A35] text-[#FF3B5C] hover:text-[#ff6b84] border border-[#FF3B5C]/30 transition-all cursor-pointer"
            >
              <Play className="w-3 h-3 fill-[#FF3B5C]" />
              <span>SIMULATION</span>
            </button>

            <button
              onClick={onLaunchDashboard}
              className="px-4 py-2 rounded bg-[#3EE7C6] hover:bg-[#32c9ab] text-black font-bold flex items-center gap-1.5 transition-all glow-cyan cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>LAUNCH SOC</span>
            </button>
          </div>

        </div>
      </header>

      {/* Hero Section */}
      <Hero onLaunchDashboard={onLaunchDashboard} onRunSimulation={onRunSimulation} />

      {/* Problem Quote Banner */}
      <section className="py-16 md:py-24 border-b border-[#1E2A35] bg-[#0C131A] relative overflow-hidden">
        <div className="absolute inset-0 cyber-grid opacity-20 pointer-events-none" />
        
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#111A23] border border-[#1E2A35] text-[11px] font-mono text-[#FFB84D]">
            <Activity className="w-3 h-3 text-[#FFB84D]" />
            <span>THE DEFENDER'S DILEMMA IS SOLVED</span>
          </div>

          <blockquote className="text-2xl sm:text-3xl md:text-4xl font-display font-medium text-[#EAF2F5] leading-snug">
            &ldquo;Legacy SIEMs alert humans after a breach. OBSIDIAN deploys <span className="text-[#3EE7C6] font-semibold">autonomous shadow twins</span> that trap intruders inside polymorphic honeynets, extracting the attacker&rsquo;s 0-day toolkit before real assets are touched.&rdquo;
          </blockquote>

          <div className="flex items-center justify-center gap-4 text-xs font-mono text-[#7C8DA0] pt-2">
            <span>OBSIDIAN AUTONOMOUS ARCHITECTURE REPORT</span>
            <span>&bull;</span>
            <span className="text-[#3EE7C6]">142ms ISOLATION SLA</span>
          </div>
        </div>
      </section>

      {/* Workflow Pipeline Section (Surgical reveals & interactive pipeline) */}
      <section id="pipeline" className="py-20 border-b border-[#1E2A35] bg-[#060A0E]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-mono text-[#3EE7C6] mb-2 uppercase">
                <Layers className="w-3.5 h-3.5 text-[#3EE7C6]" />
                <span>SURGICAL CONTAINMENT PIPELINE</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold font-display text-white">
                How Autonomous Cyber Deception Executes
              </h2>
            </div>
            <p className="text-sm text-[#7C8DA0] font-mono max-w-md mt-3 md:mt-0">
              Zero-latency pipeline transitioning from identity drift detection to court-admissible Merkle proof commits.
            </p>
          </div>

          {/* Pipeline Interactive Row */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {WORKFLOW_STAGES.map((stage, idx) => (
              <motion.div
                key={stage.step}
                whileHover={{ y: -4 }}
                onClick={() => setActiveWorkflowStep(idx)}
                className={`p-5 rounded-xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                  activeWorkflowStep === idx
                    ? 'bg-[#111A23] border-[#3EE7C6] shadow-xl glow-cyan'
                    : 'bg-[#0C131A] border-[#1E2A35] hover:border-[#2C3D4C]'
                }`}
              >
                {/* Step indicator */}
                <div className="flex items-center justify-between mb-4">
                  <span className={`text-xl font-bold font-mono ${activeWorkflowStep === idx ? 'text-[#3EE7C6]' : 'text-[#4A5A6A]'}`}>
                    {stage.step}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#060A0E] border border-[#1E2A35] text-[#7C8DA0]">
                    {stage.latency}
                  </span>
                </div>

                <div className="space-y-2">
                  <h3 className="font-bold text-sm font-display text-[#EAF2F5] leading-snug">
                    {stage.title}
                  </h3>
                  <p className="text-xs text-[#7C8DA0] line-clamp-3">
                    {stage.summary}
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-[#1E2A35] flex items-center justify-between text-[10px] font-mono text-[#4A5A6A]">
                  <span>ENGINE:</span>
                  <span className="text-[#3EE7C6]">{stage.engine}</span>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Active Step Deep Dive Detail Box */}
          <div className="mt-8 p-6 rounded-2xl bg-[#0C131A] border border-[#2C3D4C] flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-2xl">
            <div className="space-y-2 max-w-3xl">
              <div className="flex items-center gap-2 text-xs font-mono text-[#3EE7C6]">
                <CheckCircle2 className="w-4 h-4 text-[#3EE7C6]" />
                <span>STAGE {WORKFLOW_STAGES[activeWorkflowStep].step} EXECUTION DEEP-DIVE</span>
              </div>
              <h4 className="text-xl font-bold font-display text-white">
                {WORKFLOW_STAGES[activeWorkflowStep].title}
              </h4>
              <p className="text-sm text-[#7C8DA0] leading-relaxed">
                {WORKFLOW_STAGES[activeWorkflowStep].details}
              </p>
            </div>

            <button
              onClick={onRunSimulation}
              className="px-5 py-3 rounded-xl bg-[#111A23] hover:bg-[#1E2A35] text-[#3EE7C6] hover:text-white font-mono text-xs font-bold border border-[#3EE7C6]/40 flex items-center gap-2 transition-all shrink-0 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-[#3EE7C6]" />
              <span>TEST IN SIMULATION</span>
            </button>
          </div>

        </div>
      </section>

      {/* Capabilities Grid Section */}
      <section id="capabilities" className="py-20 border-b border-[#1E2A35] bg-[#0C131A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-14 space-y-3">
            <div className="inline-flex items-center gap-1.5 text-xs font-mono text-[#FF3B5C] uppercase">
              <ShieldAlert className="w-3.5 h-3.5 text-[#FF3B5C]" />
              <span>AUTONOMOUS SOC CAPABILITIES</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold font-display text-white">
              Autonomous Cyber Defense Architecture
            </h2>
            <p className="text-sm text-[#7C8DA0] font-mono">
              Designed from first principles to eliminate human delay from cyber triage.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {CAPABILITIES.map((cap) => {
              const Icon = getCapabilityIcon(cap.iconName);
              return (
                <div
                  key={cap.id}
                  className="p-6 rounded-2xl bg-[#060A0E] border border-[#1E2A35] hover:border-[#2C3D4C] transition-all flex flex-col justify-between group shadow-xl"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-[#111A23] border border-[#1E2A35] flex items-center justify-center text-[#3EE7C6] group-hover:border-[#3EE7C6]/50 group-hover:glow-cyan transition-all">
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#111A23] border border-[#1E2A35] text-[#3EE7C6] font-semibold">
                        {cap.category}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold font-display text-white group-hover:text-[#3EE7C6] transition-colors">
                        {cap.title}
                      </h3>
                      <p className="text-xs text-[#7C8DA0] mt-2 leading-relaxed">
                        {cap.description}
                      </p>
                    </div>
                  </div>

                  <div className="pt-6 mt-6 border-t border-[#1E2A35] flex items-center justify-between">
                    <div>
                      <div className="text-lg font-bold font-mono text-[#EAF2F5]">{cap.metric}</div>
                      <div className="text-[10px] font-mono text-[#4A5A6A]">{cap.metricLabel}</div>
                    </div>
                    <span className="text-[10px] font-mono text-[#3EE7C6] flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#3EE7C6] animate-pulse" />
                      {cap.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* Global Threat Map Showcase */}
      <section id="threat-map" className="py-20 border-b border-[#1E2A35] bg-[#060A0E]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-mono text-[#3EE7C6] mb-2 uppercase">
                <Globe className="w-3.5 h-3.5 text-[#3EE7C6]" />
                <span>REAL-TIME GLOBAL TRIANGULATION</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold font-display text-white">
                Live Threat Intelligence Theater
              </h2>
            </div>
            <button
              onClick={onLaunchDashboard}
              className="mt-4 md:mt-0 px-4 py-2 rounded-lg bg-[#111A23] hover:bg-[#1E2A35] text-[#3EE7C6] text-xs font-mono border border-[#1E2A35] flex items-center gap-1.5 cursor-pointer"
            >
              <span>OPEN FULL SOC THEATER</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <ThreatMap height={440} isIncidentActive={true} />

        </div>
      </section>

      {/* Competitor Positioning Table */}
      <section id="competitors" className="py-20 border-b border-[#1E2A35] bg-[#0C131A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-14 space-y-3">
            <div className="inline-flex items-center gap-1.5 text-xs font-mono text-[#3EE7C6] uppercase">
              <Zap className="w-3.5 h-3.5 text-[#3EE7C6]" />
              <span>MARKET POSITIONING BENCHMARK</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold font-display text-white">
              Why Autonomous Deception Replaces Legacy SOCs
            </h2>
            <p className="text-sm text-[#7C8DA0] font-mono">
              Compare OBSIDIAN's active deception architecture against traditional SIEM and SOAR tools.
            </p>
          </div>

          {/* Responsive Table */}
          <div className="overflow-x-auto rounded-2xl border border-[#1E2A35] bg-[#060A0E] shadow-2xl">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-[#1E2A35] bg-[#111A23]">
                  <th className="p-4 text-[#7C8DA0] font-semibold uppercase">DEFENSE CAPABILITY</th>
                  <th className="p-4 text-[#3EE7C6] font-bold bg-[#3EE7C6]/10 border-x border-[#3EE7C6]/30 uppercase flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-[#3EE7C6]" />
                    OBSIDIAN SOC
                  </th>
                  <th className="p-4 text-[#7C8DA0] font-semibold uppercase">LEGACY SIEM</th>
                  <th className="p-4 text-[#7C8DA0] font-semibold uppercase">TRADITIONAL SOAR</th>
                  <th className="p-4 text-[#7C8DA0] font-semibold uppercase">AGENTLESS XDR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2A35]/60">
                {COMPETITOR_DATA.map((row, idx) => (
                  <tr key={idx} className="hover:bg-[#111A23]/50 transition-colors">
                    <td className="p-4 font-semibold text-[#EAF2F5] max-w-xs">{row.category}</td>
                    <td className="p-4 font-bold text-[#3EE7C6] bg-[#3EE7C6]/5 border-x border-[#3EE7C6]/20">
                      {row.obsidian}
                    </td>
                    <td className="p-4 text-[#7C8DA0]">{row.legacySiem}</td>
                    <td className="p-4 text-[#7C8DA0]">{row.traditionalSoar}</td>
                    <td className="p-4 text-[#7C8DA0]">{row.agentlessXdr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </section>

      {/* CTA Bottom Banner */}
      <section className="py-20 bg-[#060A0E] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0C131A] to-[#060A0E] pointer-events-none" />
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-[#3EE7C6]/20 border border-[#3EE7C6] mx-auto flex items-center justify-center glow-cyan">
            <Shield className="w-8 h-8 text-[#3EE7C6]" />
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold font-display text-white">
            Experience Autonomous Incident Response in Real Time
          </h2>
          <p className="text-[#7C8DA0] text-sm sm:text-base font-mono max-w-xl mx-auto">
            Launch the interactive SOC console to monitor 18 enterprise identities, trigger simulated APT attacks, and inspect cryptographic Merkle ledgers.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <button
              onClick={onLaunchDashboard}
              className="px-8 py-4 rounded-xl bg-[#3EE7C6] hover:bg-[#32c9ab] text-[#060A0E] font-bold font-mono text-sm flex items-center gap-2.5 transition-all glow-cyan hover:scale-105 cursor-pointer"
            >
              <Terminal className="w-4 h-4" />
              <span>LAUNCH LIVE SOC CONSOLE</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onRunSimulation}
              className="px-6 py-4 rounded-xl bg-[#111A23] hover:bg-[#1E2A35] text-[#EAF2F5] hover:text-[#3EE7C6] font-mono text-sm border border-[#1E2A35] flex items-center gap-2 transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 text-[#FF3B5C] fill-[#FF3B5C]" />
              <span>EXECUTE ATTACK SCRIPT</span>
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1E2A35] bg-[#060A0E] py-8 text-xs font-mono text-[#7C8DA0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#3EE7C6]" />
            <span className="font-bold text-white">OBSIDIAN DEFENSE ENGINE</span>
            <span>&bull; Hackathon Edition</span>
          </div>
          <div>
            Built with React, TypeScript, Tailwind CSS, WebGL Auralis Shaders, and d3-geo.
          </div>
        </div>
      </footer>

    </div>
  );
}
