'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, Play, Pause, RotateCcw, Terminal, Users, Globe, 
  Cpu, FileCheck, Layers, AlertTriangle, CheckCircle2, 
  Lock, Key, Laptop, ArrowRight, ShieldAlert, Sparkles, Filter, Search, Download, RefreshCw,
  Volume2, VolumeX, Bell, Zap
} from 'lucide-react';
import { RiskGauge } from './RiskGauge';
import { ThreatMap } from './ThreatMap';
import { EmployeeDetailModal } from './EmployeeDetailModal';
import { 
  INITIAL_EMPLOYEES, SCENARIO_STAGES, TWIN_OPTIONS, 
  DECOY_LOGS, LEDGER_BLOCKS, HQ_GEOLOCATION, ATTACKER_GEOLOCATION 
} from '../data/mockData';
import { Employee, ScenarioStage } from '../types';
import { playBreachAlertTing, playCyberClick, setAudioMuted, getAudioMuted } from '../utils/audio';

interface DashboardProps {
  onReturnToLanding: () => void;
  autoStartSimulation?: boolean;
}

export function Dashboard({ onReturnToLanding, autoStartSimulation = false }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'threat-map' | 'twins' | 'deception' | 'ledger'>('overview');
  
  // Employees state
  const [employees, setEmployees] = useState<Employee[]>(INITIAL_EMPLOYEES);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [isMuted, setIsMuted] = useState(false);

  // Simulation timeline state
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [streamedLogs, setStreamedLogs] = useState<ScenarioStage['logs']>(SCENARIO_STAGES[0].logs);
  
  const currentStage = SCENARIO_STAGES[currentStageIndex];
  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  const toggleSound = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    setAudioMuted(nextMuted);
    if (!nextMuted) {
      playBreachAlertTing();
    }
  };

  // Trigger manual instant breach
  const triggerInstantBreach = (employeeId: string = 'EMP-0841') => {
    playBreachAlertTing();
    setEmployees(prev => prev.map(emp => {
      if (emp.id === employeeId) {
        return {
          ...emp,
          status: 'breached',
          riskScore: 96
        };
      }
      return emp;
    }));
    setStreamedLogs(prev => [
      ...prev,
      {
        timestamp: new Date().toISOString().substring(11, 23),
        level: 'CRIT',
        source: 'INTRUSION_DETECTOR',
        message: `ALERT // PRIVILEGE ANOMALY DETECTED on ${employeeId}. Acoustic alarm dispatched & Deception Honeynet armed.`
      }
    ]);
  };

  // Auto-start simulation if requested
  useEffect(() => {
    if (autoStartSimulation) {
      startSimulation();
    }
  }, [autoStartSimulation]);

  // Scroll terminal to bottom on log stream
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [streamedLogs]);

  // Scripted Timeline Simulation runner
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isSimulating && !isPaused) {
      if (currentStageIndex < SCENARIO_STAGES.length - 1) {
        timer = setTimeout(() => {
          const nextIndex = currentStageIndex + 1;
          setCurrentStageIndex(nextIndex);
          const nextStage = SCENARIO_STAGES[nextIndex];

          // Play ting sound on breach or elevated threat detection!
          if (nextStage.targetStatus === 'breached' || nextStage.targetStatus === 'elevated' || nextStage.orgRiskScore > 40) {
            playBreachAlertTing();
          }

          // Append new logs to live terminal
          setStreamedLogs(prev => [...prev, ...nextStage.logs]);

          // Update target employee status
          setEmployees(prev => prev.map(emp => {
            if (emp.id === nextStage.targetEmployeeId) {
              return {
                ...emp,
                status: nextStage.targetStatus,
                riskScore: nextStage.orgRiskScore > 50 ? 94 : 45
              };
            }
            return emp;
          }));

        }, 3200);
      } else {
        // Simulation finished
        setIsSimulating(false);
      }
    }
    return () => clearTimeout(timer);
  }, [isSimulating, isPaused, currentStageIndex]);

  const startSimulation = () => {
    setCurrentStageIndex(0);
    setStreamedLogs(SCENARIO_STAGES[0].logs);
    setEmployees(INITIAL_EMPLOYEES);
    setIsSimulating(true);
    setIsPaused(false);
    playCyberClick();
  };

  const resetSimulation = () => {
    setIsSimulating(false);
    setIsPaused(false);
    setCurrentStageIndex(0);
    setStreamedLogs(SCENARIO_STAGES[0].logs);
    setEmployees(INITIAL_EMPLOYEES);
    playCyberClick();
  };

  const togglePause = () => {
    setIsPaused(prev => !prev);
    playCyberClick();
  };

  const handleCardClick = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsModalOpen(true);
  };

  // Filtered employees
  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          emp.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          emp.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          emp.department.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = departmentFilter === 'ALL' || emp.department === departmentFilter;
    return matchesSearch && matchesDept;
  });

  return (
    <div className="min-h-screen bg-[#060A0E] text-[#EAF2F5] flex flex-col relative selection:bg-[#3EE7C6]/20 selection:text-[#3EE7C6]">
      
      {/* Scanline CRT overlay from Immersive UI theme */}
      <div className="fixed inset-0 scanline opacity-25 pointer-events-none z-50" />

      {/* Dot-matrix subtle cyber texture */}
      <div className="fixed inset-0 dot-matrix opacity-10 pointer-events-none z-0" />

      {/* Top SOC Console Header with Immersive UI styling */}
      <header className="sticky top-0 z-40 bg-[#0C131A]/90 border-b border-[#2C3D4C] backdrop-blur-md shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          {/* Logo & Platform Info */}
          <div className="flex items-center gap-4 sm:gap-6">
            <button
              onClick={onReturnToLanding}
              className="flex items-center gap-3.5 hover:opacity-90 transition-opacity cursor-pointer text-left group"
            >
              {/* Rotated 45-degree cyber diamond icon from Immersive UI theme */}
              <div className="w-9 h-9 sm:w-10 sm:h-10 border-2 border-[#FF3B5C] flex items-center justify-center transform rotate-45 glow-red bg-[#060A0E] group-hover:scale-105 transition-transform">
                <div className="w-3.5 h-3.5 bg-[#FF3B5C]" />
              </div>
              <div className="pl-1">
                <h1 className="display text-2xl sm:text-3xl font-bold tracking-tighter obsidian-text">
                  OBSIDIAN
                </h1>
                <div className="text-[9px] mono text-[#7C8DA0] -mt-1 tracking-widest uppercase">
                  SOC DEFENSE ENGINE
                </div>
              </div>
            </button>

            {/* Navigation Tab Bar (Desktop) */}
            <div className="hidden xl:flex items-center gap-1 bg-[#060A0E]/80 p-1 rounded-xl border border-[#1E2A35] text-xs mono ml-4">
              {[
                { id: 'overview', label: 'OVERVIEW', icon: Users },
                { id: 'threat-map', label: 'THREAT MAP', icon: Globe },
                { id: 'twins', label: 'DIGITAL TWIN', icon: Cpu },
                { id: 'deception', label: 'HONEYNET MESH', icon: Lock },
                { id: 'ledger', label: 'EVIDENCE LEDGER', icon: FileCheck },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#111A23] text-[#3EE7C6] border border-[#3EE7C6]/40 font-bold glow-cyan'
                        : 'text-[#7C8DA0] hover:text-[#EAF2F5] hover:bg-[#111A23]/50'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Header Status Telemetry & Action Buttons */}
          <div className="flex items-center gap-4 sm:gap-6 mono text-xs">
            
            {/* System Status Readout */}
            <div className="hidden md:flex flex-col items-end">
              <span className="text-[#7C8DA0] text-[10px] uppercase tracking-widest">System Status</span>
              <span className={isSimulating ? "text-[#FF3B5C] font-bold animate-pulse" : "text-[#3EE7C6]"}>
                {isSimulating ? `[ BREACH: ${currentStage.phaseName} ]` : '[ NOMINAL / ENCRYPTED ]'}
              </span>
            </div>

            <div className="hidden md:block h-8 w-[1px] bg-[#1E2A35]" />

            {/* Uptime Readout */}
            <div className="hidden lg:flex flex-col items-end">
              <span className="text-[#7C8DA0] text-[10px] uppercase tracking-widest">Uptime</span>
              <span className="text-[#EAF2F5] font-mono">241:12:09:44</span>
            </div>

            <div className="hidden lg:block h-8 w-[1px] bg-[#1E2A35]" />

            {/* Simulation Controller */}
            <div className="flex items-center gap-2">
              {!isSimulating ? (
                <button
                  onClick={startSimulation}
                  className="bg-[#3EE7C6] text-black font-bold px-4 py-2 text-xs mono tracking-wider glow-cyan hover:bg-[#32c9ab] transition-all cursor-pointer flex items-center gap-1.5 rounded"
                >
                  <Play className="w-3.5 h-3.5 fill-black" />
                  <span>RUN ATTACK SIMULATION</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={togglePause}
                    className="bg-[#111A23] hover:bg-[#1E2A35] text-[#FFB84D] px-3 py-1.5 text-xs mono border border-[#FFB84D]/40 flex items-center gap-1.5 cursor-pointer rounded"
                  >
                    <Pause className="w-3 h-3" />
                    <span>{isPaused ? 'RESUME' : 'PAUSE'}</span>
                  </button>
                  <button
                    onClick={resetSimulation}
                    className="bg-[#111A23] hover:bg-[#1E2A35] text-[#7C8DA0] px-3 py-1.5 text-xs mono border border-[#1E2A35] flex items-center gap-1 cursor-pointer rounded"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>RESET</span>
                  </button>
                </div>
              )}

              {/* Terminate / Return to Landing button */}
              <button
                onClick={onReturnToLanding}
                className="hidden sm:inline-flex bg-[#FF3B5C]/10 border border-[#FF3B5C] px-3 py-2 text-[#FF3B5C] hover:bg-[#FF3B5C] hover:text-white transition-all text-xs mono rounded cursor-pointer"
              >
                TERMINATE SESSION
              </button>
            </div>

          </div>

        </div>
      </header>

      {/* Tab Navigation for smaller screens */}
      <div className="xl:hidden flex items-center justify-around bg-[#0C131A] border-b border-[#1E2A35] p-2 text-xs mono overflow-x-auto relative z-10">
        {[
          { id: 'overview', label: 'OVERVIEW', icon: Users },
          { id: 'threat-map', label: 'THREAT MAP', icon: Globe },
          { id: 'twins', label: 'DIGITAL TWIN', icon: Cpu },
          { id: 'deception', label: 'HONEYNET', icon: Lock },
          { id: 'ledger', label: 'EVIDENCE LEDGER', icon: FileCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === tab.id ? 'bg-[#3EE7C6]/20 text-[#3EE7C6] font-bold border border-[#3EE7C6]/40' : 'text-[#7C8DA0]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main SOC Dashboard Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* ================= TAB 1: OVERVIEW ================= */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            
            {/* Immersive UI Quick Stats Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-[#0C131A] border border-[#1E2A35] rounded-xl p-4 flex flex-col justify-between">
                <span className="mono text-[10px] text-[#7C8DA0] uppercase tracking-wider">THREATS BLOCKED</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="display text-2xl font-bold text-[#3EE7C6] tabular-nums">12,842</span>
                  <span className="text-[10px] mono text-[#3EE7C6]/80">+14% / 24h</span>
                </div>
              </div>
              <div className="bg-[#0C131A] border border-[#1E2A35] rounded-xl p-4 flex flex-col justify-between">
                <span className="mono text-[10px] text-[#7C8DA0] uppercase tracking-wider">LAST INCIDENT</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="display text-2xl font-bold text-[#FF3B5C]">0.42s ago</span>
                  <span className="text-[10px] mono text-[#FF3B5C]/80">BLOCKED</span>
                </div>
              </div>
              <div className="bg-[#0C131A] border border-[#1E2A35] rounded-xl p-4 flex flex-col justify-between">
                <span className="mono text-[10px] text-[#7C8DA0] uppercase tracking-wider">HONEYNET NODES</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="display text-2xl font-bold text-[#FFB84D] tabular-nums">48 ARMED</span>
                  <span className="text-[10px] mono text-[#7C8DA0]">100% Mesh</span>
                </div>
              </div>
              <div className="bg-[#0C131A] border border-[#1E2A35] rounded-xl p-4 flex flex-col justify-between">
                <span className="mono text-[10px] text-[#7C8DA0] uppercase tracking-wider">AUTONOMOUS SLA</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="display text-2xl font-bold text-[#EAF2F5]">142ms</span>
                  <span className="text-[10px] mono text-[#3EE7C6]">Avg TTR</span>
                </div>
              </div>
            </div>

            {/* Top Row: Risk Gauge + Simulation State Card */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Org-Wide Risk Gauge Component */}
              <div className="lg:col-span-4">
                <RiskGauge score={currentStage.orgRiskScore} />
              </div>

              {/* Simulation Status & Autonomous Action Card */}
              <div className="lg:col-span-8 bg-[#0C131A] border border-[#1E2A35] rounded-xl p-5 flex flex-col justify-between relative overflow-hidden">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-[#1E2A35] pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#FF3B5C] animate-pulse" />
                      <span className="text-xs font-mono font-bold text-[#EAF2F5] uppercase">
                        {currentStage.title}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#111A23] border border-[#1E2A35] text-[#3EE7C6]">
                      STAGE {currentStage.id + 1} / 5
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-[#7C8DA0] font-mono leading-relaxed">
                    {currentStage.description}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs font-mono">
                    <div className="p-2.5 rounded-lg bg-[#111A23] border border-[#1E2A35]">
                      <span className="text-[10px] text-[#7C8DA0] uppercase block">AUTONOMOUS COUNTERMEASURE</span>
                      <span className="text-[#3EE7C6] font-semibold">{currentStage.mitigationAction}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#111A23] border border-[#1E2A35]">
                      <span className="text-[10px] text-[#7C8DA0] uppercase block">HONEYNET TRAP STATUS</span>
                      <span className="text-[#FFB84D] font-semibold">{currentStage.honeypotDeployed}</span>
                    </div>
                  </div>
                </div>

                {/* Progress bar across stages */}
                <div className="pt-4 mt-4 border-t border-[#1E2A35] flex items-center justify-between text-[11px] font-mono text-[#7C8DA0]">
                  <span>TIMELINE SYNCHRONIZATION</span>
                  <div className="flex items-center gap-1.5">
                    {[0, 1, 2, 3, 4].map(step => (
                      <div 
                        key={step} 
                        className={`w-5 h-1.5 rounded-full transition-all ${
                          currentStageIndex === step 
                            ? 'bg-[#FF3B5C] glow-red' 
                            : currentStageIndex > step 
                            ? 'bg-[#3EE7C6]' 
                            : 'bg-[#1E2A35]'
                        }`} 
                      />
                    ))}
                  </div>
                </div>
              </div>

            </div>

            {/* Middle Section: 18-Employee Identity Grid */}
            <div className="bg-[#0C131A] border border-[#1E2A35] rounded-xl p-5 space-y-4 shadow-xl">
              
              {/* Identity Grid Header & Subtitle matching uploaded design */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#1E2A35] pb-3.5">
                <div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#3EE7C6]" />
                    <h3 className="text-sm sm:text-base font-bold font-display text-white tracking-wide">
                      ORGANIZATION IDENTITY MATRIX (18 VECTORS)
                    </h3>
                  </div>
                  <p className="text-[11px] font-mono text-[#3EE7C6]/80 mt-0.5 tracking-wider">
                    MONITORING REAL-TIME OAUTH &amp; SESSION ANOMALIES
                  </p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                  <span className="text-[10px] font-mono text-[#3EE7C6] hidden lg:inline-block uppercase tracking-wider">
                    CLICK ANY FLAGGED CARD TO INSPECT DETAIL
                  </span>
                  
                  {/* Sound Controller Pill */}
                  <div className="flex items-center gap-1.5 bg-[#060A0E] px-2.5 py-1 rounded-lg border border-[#1E2A35]">
                    <button
                      onClick={toggleSound}
                      title={isMuted ? "Unmute Breach Sound" : "Mute Breach Sound"}
                      className={`p-1 rounded transition-colors cursor-pointer ${
                        isMuted ? 'text-[#7C8DA0] hover:text-white' : 'text-[#3EE7C6] glow-cyan'
                      }`}
                    >
                      {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    </button>
                    <span className="text-[9px] font-mono text-[#7C8DA0] uppercase">
                      {isMuted ? "MUTED" : "TING ON"}
                    </span>
                    <button
                      onClick={() => {
                        playBreachAlertTing();
                      }}
                      className="text-[9px] font-mono px-2 py-0.5 rounded bg-[#111A23] hover:bg-[#1E2A35] text-[#3EE7C6] border border-[#3EE7C6]/30 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Bell className="w-2.5 h-2.5" />
                      <span>TEST TING</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Filters & Actions Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2 flex-1 max-w-md">
                  {/* Search */}
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7C8DA0]" />
                    <input
                      type="text"
                      placeholder="Search identity vector or role..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-[#060A0E] border border-[#1E2A35] rounded-lg pl-8 pr-3 py-1.5 text-xs font-mono text-[#EAF2F5] focus:outline-none focus:border-[#3EE7C6]"
                    />
                  </div>

                  {/* Dept Filter */}
                  <select
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    className="bg-[#060A0E] border border-[#1E2A35] rounded-lg px-2.5 py-1.5 text-xs font-mono text-[#7C8DA0] focus:outline-none focus:border-[#3EE7C6]"
                  >
                    <option value="ALL">All Depts</option>
                    <option value="DevOps">DevOps</option>
                    <option value="Security">Security</option>
                    <option value="Engineering">Engineering</option>
                    <option value="Finance">Finance</option>
                    <option value="Legal">Legal</option>
                    <option value="HR">HR</option>
                    <option value="Product">Product</option>
                  </select>
                </div>

                {/* Instant Breach Trigger Button */}
                <button
                  onClick={() => triggerInstantBreach('EMP-0841')}
                  className="px-3 py-1.5 rounded-lg bg-[#FF3B5C]/15 hover:bg-[#FF3B5C]/25 text-[#FF3B5C] border border-[#FF3B5C]/40 text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer glow-red"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>EMULATE ADVERSARY BREACH</span>
                </button>
              </div>

              {/* Identity Cards Grid - 18 Vectors */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-3.5 pt-2">
                {filteredEmployees.map((emp) => {
                  const isFlaggedBreach = emp.status === 'breached';
                  const isFlaggedElevated = emp.status === 'elevated';
                  const isFlaggedIsolated = emp.status === 'isolated';

                  return (
                    <motion.div
                      key={emp.id}
                      whileHover={{ scale: 1.02, y: -2 }}
                      transition={{ duration: 0.15 }}
                      onClick={() => {
                        playCyberClick();
                        if (isFlaggedBreach) playBreachAlertTing();
                        handleCardClick(emp);
                      }}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col items-center justify-between relative select-none group text-center ${
                        isFlaggedBreach
                          ? 'bg-[#FF3B5C]/15 border-[#FF3B5C] glow-red animate-pulse'
                          : isFlaggedElevated
                          ? 'bg-[#FFB84D]/15 border-[#FFB84D] glow-amber'
                          : isFlaggedIsolated
                          ? 'bg-[#B48CFF]/15 border-[#B48CFF] glow-violet'
                          : 'bg-[#080E14] border-[#1E2A35] hover:border-[#3EE7C6]/60 hover:bg-[#0C1520]'
                      }`}
                    >
                      {/* Circular Photo Avatar */}
                      <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 relative transition-all mx-auto ${
                        isFlaggedBreach
                          ? 'border-[#FF3B5C] glow-red ring-2 ring-[#FF3B5C]/50'
                          : isFlaggedElevated
                          ? 'border-[#FFB84D] glow-amber'
                          : isFlaggedIsolated
                          ? 'border-[#B48CFF] glow-violet'
                          : 'border-[#3EE7C6]/40 group-hover:border-[#3EE7C6] group-hover:scale-105'
                      }`}>
                        {emp.imageUrl ? (
                          <img 
                            src={emp.imageUrl} 
                            alt={emp.name} 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : null}
                        <div className="absolute inset-0 flex items-center justify-center font-bold text-xs bg-[#060A0E] text-[#3EE7C6] -z-10">
                          {emp.avatar}
                        </div>
                      </div>

                      {/* Name & Role / Department */}
                      <div className="w-full mt-2.5">
                        <h4 className="font-bold text-xs sm:text-sm font-display text-white truncate group-hover:text-[#3EE7C6] transition-colors">
                          {emp.name}
                        </h4>
                        <p className="text-[10px] sm:text-[11px] text-[#7C8DA0] font-mono truncate mt-0.5">
                          {emp.role.length > 18 ? emp.department : emp.role}
                        </p>
                      </div>

                      {/* Status Pill matching screenshot */}
                      <div className="mt-3 w-full flex justify-center">
                        <span className={`text-[9px] sm:text-[10px] font-mono px-3 py-0.5 rounded font-bold uppercase tracking-wider transition-all ${
                          isFlaggedBreach
                            ? 'bg-[#FF3B5C] text-white glow-red animate-pulse'
                            : isFlaggedElevated
                            ? 'bg-[#FFB84D] text-black font-bold'
                            : isFlaggedIsolated
                            ? 'bg-[#B48CFF] text-black font-bold'
                            : 'bg-[#060A0E] text-[#3EE7C6] border border-[#3EE7C6]/40 group-hover:border-[#3EE7C6]'
                        }`}>
                          {isFlaggedBreach ? 'BREACHED' : emp.status.toUpperCase()}
                        </span>
                      </div>

                      {/* Micro Telemetry Footer */}
                      <div className="w-full pt-2 mt-2 border-t border-[#1E2A35]/50 flex items-center justify-between text-[9px] font-mono text-[#7C8DA0]">
                        <span>{emp.activeTokens} tokens</span>
                        <span className={isFlaggedBreach ? 'text-[#FF3B5C] font-bold' : 'text-[#3EE7C6]'}>
                          Risk: {emp.riskScore}
                        </span>
                      </div>

                      {/* Click Overlay on Breach */}
                      {isFlaggedBreach && (
                        <div className="absolute inset-0 bg-[#FF3B5C]/20 rounded-xl flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity backdrop-blur-[1px]">
                          <span className="px-2 py-1 rounded bg-[#060A0E] text-[#FF3B5C] font-mono text-[9px] font-bold border border-[#FF3B5C]">
                            INSPECT INCIDENT
                          </span>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>

            </div>

            {/* Bottom Row: Real-time Streaming Terminal Log */}
            <div className="bg-[#0C131A] border border-[#1E2A35] rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-[#1E2A35] pb-3">
                <div className="flex items-center gap-2 text-xs font-mono text-[#3EE7C6]">
                  <Terminal className="w-4 h-4 text-[#3EE7C6]" />
                  <span className="font-bold tracking-wider uppercase">LIVE AUTONOMOUS SOC STREAM // EVENT BUS</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono text-[#7C8DA0]">
                  <span className="w-2 h-2 rounded-full bg-[#3EE7C6] animate-pulse" />
                  <span>LOGGING LEVEL: TRACE (eBPF KERNEL)</span>
                </div>
              </div>

              {/* Terminal Screen */}
              <div className="bg-[#060A0E] border border-[#1E2A35] rounded-lg p-4 font-mono text-xs max-h-56 overflow-y-auto space-y-2">
                {streamedLogs.map((log, index) => {
                  let badgeStyle = "bg-[#3EE7C6]/10 text-[#3EE7C6] border-[#3EE7C6]/30";
                  if (log.level === 'CRIT') badgeStyle = "bg-[#FF3B5C]/20 text-[#FF3B5C] border-[#FF3B5C]/40 animate-pulse font-bold";
                  if (log.level === 'WARN') badgeStyle = "bg-[#FFB84D]/20 text-[#FFB84D] border-[#FFB84D]/40 font-semibold";
                  if (log.level === 'DECEPTION') badgeStyle = "bg-[#B48CFF]/20 text-[#B48CFF] border-[#B48CFF]/40";
                  if (log.level === 'SUCCESS') badgeStyle = "bg-[#3EE7C6]/20 text-[#3EE7C6] border-[#3EE7C6]/40 font-bold";

                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-start gap-3 text-[11px] leading-relaxed border-b border-[#1E2A35]/30 pb-1"
                    >
                      <span className="text-[#4A5A6A] shrink-0">[{log.timestamp}]</span>
                      <span className={`px-1.5 py-0.2 rounded border text-[9px] shrink-0 ${badgeStyle}`}>
                        {log.level}
                      </span>
                      <span className="text-[#7C8DA0] shrink-0">&lt;{log.source}&gt;</span>
                      <span className="text-[#EAF2F5]">{log.message}</span>
                    </motion.div>
                  );
                })}
                <div ref={terminalEndRef} />
              </div>
            </div>

          </div>
        )}

        {/* ================= TAB 2: THREAT MAP ================= */}
        {activeTab === 'threat-map' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold font-display text-white flex items-center gap-2">
                  <Globe className="w-5 h-5 text-[#3EE7C6]" />
                  Global Threat Radar & Autonomous Ingress Triangulation
                </h2>
                <p className="text-xs text-[#7C8DA0] font-mono">
                  Live telemetry vector linking adversary nodes to synthetic canary honeynets.
                </p>
              </div>

              <button
                onClick={startSimulation}
                className="px-4 py-2 rounded-lg bg-[#FF3B5C]/20 hover:bg-[#FF3B5C]/30 text-[#FF3B5C] text-xs font-mono font-bold border border-[#FF3B5C]/50 flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-[#FF3B5C]" />
                <span>PULSE THREAT VECTOR</span>
              </button>
            </div>

            <ThreatMap 
              attackerGeo={currentStage.attackerGeo}
              hqGeo={currentStage.hqGeo}
              isIncidentActive={true}
              height={500}
            />
          </div>
        )}

        {/* ================= TAB 3: DIGITAL TWINS ================= */}
        {activeTab === 'twins' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-[#1E2A35] pb-4">
              <div>
                <h2 className="text-xl font-bold font-display text-white flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-[#3EE7C6]" />
                  Behavioral Digital Twin Enclaves (Identity Clones)
                </h2>
                <p className="text-xs text-[#7C8DA0] font-mono">
                  High-privilege identity virtualizations running continuous drift benchmarking.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {TWIN_OPTIONS.map((twin) => (
                <div key={twin.id} className="p-6 rounded-2xl bg-[#0C131A] border border-[#1E2A35] space-y-4 shadow-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-base font-display text-white">{twin.name}</h3>
                      <p className="text-xs text-[#7C8DA0] font-mono">{twin.role} &bull; {twin.department}</p>
                    </div>
                    <span className={`text-[10px] font-mono px-2.5 py-1 rounded font-bold ${
                      twin.status === 'TRAP_ACTIVE'
                        ? 'bg-[#FF3B5C]/20 text-[#FF3B5C] border border-[#FF3B5C]/40 animate-pulse'
                        : 'bg-[#3EE7C6]/20 text-[#3EE7C6] border border-[#3EE7C6]/40'
                    }`}>
                      {twin.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-xs font-mono">
                    <div className="p-2.5 rounded-lg bg-[#111A23] border border-[#1E2A35]">
                      <div className="text-[#7C8DA0] text-[10px]">DRIFT DELTA</div>
                      <div className={`font-bold mt-0.5 ${twin.driftScore > 50 ? 'text-[#FF3B5C]' : 'text-[#3EE7C6]'}`}>
                        {twin.driftScore}%
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#111A23] border border-[#1E2A35]">
                      <div className="text-[#7C8DA0] text-[10px]">CANARY KEYS</div>
                      <div className="font-bold text-[#EAF2F5] mt-0.5">{twin.canaryKeyCount} Active</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#111A23] border border-[#1E2A35]">
                      <div className="text-[#7C8DA0] text-[10px]">CANARY RUNS</div>
                      <div className="font-bold text-[#3EE7C6] mt-0.5">{twin.activeCanarySessions} Sessions</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-[#060A0E] border border-[#1E2A35] text-xs font-mono text-[#7C8DA0] space-y-1">
                    <div className="text-[10px] text-[#4A5A6A] uppercase">ACTIVE SYNTHETIC WORKLOAD</div>
                    <div className="text-[#EAF2F5]">{twin.syntheticActivity}</div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-[#4A5A6A] pt-2 border-t border-[#1E2A35]">
                    <span>NEURAL FINGERPRINT: {twin.lastFingerprint}</span>
                    <span className="text-[#3EE7C6]">{twin.model}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= TAB 4: DECEPTION MODE ================= */}
        {activeTab === 'deception' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-[#1E2A35] pb-4">
              <div>
                <h2 className="text-xl font-bold font-display text-white flex items-center gap-2">
                  <Lock className="w-5 h-5 text-[#FFB84D]" />
                  Active Honeynet Mesh & Intruder Deception Telemetry
                </h2>
                <p className="text-xs text-[#7C8DA0] font-mono">
                  Real-time record of attackers interacting with synthetic cloud infrastructure.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[#1E2A35] bg-[#0C131A] shadow-xl">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-[#1E2A35] bg-[#111A23] text-[#7C8DA0]">
                    <th className="p-3.5">TIMESTAMP</th>
                    <th className="p-3.5">DECOY ASSET TYPE</th>
                    <th className="p-3.5">ATTACKER IP / GEO</th>
                    <th className="p-3.5">CAPTURED PAYLOAD SAMPLE</th>
                    <th className="p-3.5">LATENCY</th>
                    <th className="p-3.5">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E2A35]/60">
                  {DECOY_LOGS.map((log) => (
                    <tr key={log.id} className="hover:bg-[#111A23]/50 transition-colors">
                      <td className="p-3.5 text-[#7C8DA0]">{log.timestamp}</td>
                      <td className="p-3.5 font-bold text-[#3EE7C6]">{log.decoyType}</td>
                      <td className="p-3.5 text-[#EAF2F5]">
                        <div>{log.attackerIp}</div>
                        <div className="text-[10px] text-[#7C8DA0]">{log.attackerLocation}</div>
                      </td>
                      <td className="p-3.5 max-w-xs text-[#EAF2F5] font-mono text-[11px] truncate">
                        {log.capturedPayload}
                      </td>
                      <td className="p-3.5 text-[#3EE7C6]">{log.deceptionLatencyMs}ms</td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.status === 'TRAPPED' 
                            ? 'bg-[#FF3B5C]/20 text-[#FF3B5C] border border-[#FF3B5C]/40 animate-pulse'
                            : 'bg-[#3EE7C6]/20 text-[#3EE7C6] border border-[#3EE7C6]/40'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================= TAB 5: EVIDENCE LEDGER ================= */}
        {activeTab === 'ledger' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-[#1E2A35] pb-4">
              <div>
                <h2 className="text-xl font-bold font-display text-white flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-[#3EE7C6]" />
                  Cryptographic Forensic Evidence Chain (SHA-256 Merkle Ledger)
                </h2>
                <p className="text-xs text-[#7C8DA0] font-mono">
                  Immutable, court-admissible audit blocks signed across distributed validator nodes.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {LEDGER_BLOCKS.map((block) => (
                <div key={block.id} className="p-5 rounded-xl bg-[#0C131A] border border-[#1E2A35] space-y-3 shadow-lg">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1E2A35] pb-2.5">
                    <div className="flex items-center gap-3">
                      <span className="px-2.5 py-1 rounded bg-[#3EE7C6]/15 border border-[#3EE7C6]/40 text-[#3EE7C6] font-bold font-mono text-xs">
                        BLOCK #{block.blockNumber}
                      </span>
                      <span className="font-bold text-sm text-white font-mono">{block.eventType}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-mono text-[#7C8DA0]">
                      <CheckCircle2 className="w-4 h-4 text-[#3EE7C6]" />
                      <span>{block.validatorNode}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                    <div className="p-2.5 rounded-lg bg-[#060A0E] border border-[#1E2A35] space-y-1">
                      <span className="text-[10px] text-[#4A5A6A] uppercase block">SOURCE &rarr; TARGET ENTITY</span>
                      <div className="text-[#EAF2F5]">{block.sourceEntity} &rarr; <span className="text-[#3EE7C6]">{block.targetEntity}</span></div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#060A0E] border border-[#1E2A35] space-y-1">
                      <span className="text-[10px] text-[#4A5A6A] uppercase block">MERKLE ROOT HASH</span>
                      <div className="text-[#3EE7C6] truncate font-mono">{block.merkleRoot}</div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#060A0E] border border-[#1E2A35] text-[11px] font-mono text-[#7C8DA0] truncate">
                    <span className="text-[#4A5A6A]">SHA-256 BLOCK PROOF: </span>
                    <span className="text-[#EAF2F5]">{block.sha256Hash}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* Immersive HUD Telemetry Footer */}
      <footer className="border-t border-[#1E2A35] bg-[#060A0E]/95 backdrop-blur-md flex flex-wrap items-center justify-between px-4 sm:px-8 py-3.5 mono text-xs z-30 mt-auto">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-[#3EE7C6] text-black font-bold rounded-full text-[11px] glow-cyan">
            ACTIVE SOC CONSOLE
          </div>
          <span className="text-[#7C8DA0] text-[11px] hidden sm:inline">AUTONOMOUS DEFENSE THREAD: #7741-B</span>
        </div>
        <div className="flex items-center gap-4 sm:gap-6 text-[11px] mono text-[#7C8DA0]">
          <span className="text-[#4A5A6A]">LATENCY: <span className="text-[#3EE7C6]">14MS</span></span>
          <span className="text-[#4A5A6A] hidden md:inline">NODE: <span className="text-[#EAF2F5]">US-EAST-01</span></span>
          <span className="text-[#4A5A6A] hidden lg:inline">CIPHER: <span className="text-[#EAF2F5]">AES-256-GCM / SHA-256</span></span>
          <div className="flex items-center gap-1.5 text-[#3EE7C6]">
            <div className="w-2 h-2 bg-[#3EE7C6] rounded-full animate-pulse" />
            <span className="text-[10px] font-bold">LIVE SYNC</span>
          </div>
        </div>
      </footer>

      {/* Employee Detail & Incident Modal */}
      <EmployeeDetailModal
        employee={selectedEmployee}
        currentStage={currentStage}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onQuarantine={() => {
          if (selectedEmployee) {
            setEmployees(prev => prev.map(emp => emp.id === selectedEmployee.id ? { ...emp, status: 'isolated', riskScore: 5 } : emp));
            setIsModalOpen(false);
          }
        }}
      />

    </div>
  );
}
