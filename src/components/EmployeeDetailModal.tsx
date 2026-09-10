'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldAlert, ShieldCheck, Shield, Key, Laptop, Globe, Cpu, AlertTriangle, CheckCircle2, RefreshCw, Lock, Terminal } from 'lucide-react';
import { Employee, ScenarioStage } from '../types';
import { ThreatMap } from './ThreatMap';

interface EmployeeDetailModalProps {
  employee: Employee | null;
  currentStage: ScenarioStage;
  isOpen: boolean;
  onClose: () => void;
  onQuarantine?: () => void;
}

export function EmployeeDetailModal({
  employee,
  currentStage,
  isOpen,
  onClose,
  onQuarantine,
}: EmployeeDetailModalProps) {
  if (!isOpen || !employee) return null;

  const isBreached = employee.status === 'breached' || employee.status === 'elevated';
  const isIsolated = employee.status === 'isolated';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/80 backdrop-blur-md">
        
        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.25 }}
          className="relative w-full max-w-5xl bg-[#0C131A] border border-[#2C3D4C] rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
        >
          {/* Header Banner with Red Texture / Cyan Accent */}
          <div className="flex items-center justify-between px-6 py-4 bg-[#111A23] border-b border-[#1E2A35]">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center font-display font-bold text-sm shrink-0 relative ${
                employee.status === 'breached' 
                  ? 'border-2 border-[#FF3B5C] glow-red' 
                  : employee.status === 'elevated'
                  ? 'border-2 border-[#FFB84D] glow-amber'
                  : 'border-2 border-[#3EE7C6] glow-cyan'
              }`}>
                {employee.imageUrl ? (
                  <img 
                    src={employee.imageUrl} 
                    alt={employee.name} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      // Fallback if image fails to load
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : null}
                <div className={`absolute inset-0 flex items-center justify-center font-bold text-xs -z-10 ${
                  employee.status === 'breached'
                    ? 'bg-[#FF3B5C]/20 text-[#FF3B5C]'
                    : employee.status === 'elevated'
                    ? 'bg-[#FFB84D]/20 text-[#FFB84D]'
                    : 'bg-[#3EE7C6]/20 text-[#3EE7C6]'
                }`}>
                  {employee.avatar}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold font-display text-white">{employee.name}</h2>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#060A0E] border border-[#1E2A35] text-[#7C8DA0]">
                    {employee.id}
                  </span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-semibold ${
                    employee.status === 'breached'
                      ? 'bg-[#FF3B5C]/20 text-[#FF3B5C] border border-[#FF3B5C]/40 animate-pulse'
                      : employee.status === 'elevated'
                      ? 'bg-[#FFB84D]/20 text-[#FFB84D] border border-[#FFB84D]/40'
                      : employee.status === 'isolated'
                      ? 'bg-[#B48CFF]/20 text-[#B48CFF] border border-[#B48CFF]/40'
                      : 'bg-[#3EE7C6]/20 text-[#3EE7C6] border border-[#3EE7C6]/40'
                  }`}>
                    {employee.status === 'breached' ? 'INTERCEPTED & TRAPPED' : employee.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-[#7C8DA0] font-mono">{employee.role} &bull; {employee.department}</p>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-[#060A0E] hover:bg-[#1E2A35] text-[#7C8DA0] hover:text-white flex items-center justify-center border border-[#1E2A35] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body Content (Scrollable) */}
          <div className="p-6 overflow-y-auto space-y-6">
            
            {/* Alert / Telemetry Bar */}
            {isBreached && (
              <div className="p-4 rounded-xl bg-[#FF3B5C]/10 border border-[#FF3B5C]/40 text-xs font-mono flex items-start gap-3 glow-red">
                <AlertTriangle className="w-5 h-5 text-[#FF3B5C] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-[#FF3B5C] uppercase flex items-center gap-2">
                    <span>ACTIVE INTRUSION INCIDENT // THREAT MITIGATION ENGAGED</span>
                  </div>
                  <p className="text-[#EAF2F5]">
                    Adversary attempting Kubernetes Cluster Admin & Cloud STS privilege escalation. 
                    <span className="text-[#3EE7C6] font-semibold"> OBSIDIAN Digital Twin has transparently quarantined real production access and routed adversary to Synthetic Canary Honeynet.</span>
                  </p>
                </div>
              </div>
            )}

            {/* Grid Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-3 rounded-lg bg-[#111A23] border border-[#1E2A35]">
                <div className="text-[#7C8DA0] text-[10px] uppercase">SECURITY CLEARANCE</div>
                <div className="font-bold text-[#EAF2F5] mt-1 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-[#3EE7C6]" />
                  {employee.clearance}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[#111A23] border border-[#1E2A35]">
                <div className="text-[#7C8DA0] text-[10px] uppercase">ACTIVE SESSIONS</div>
                <div className="font-bold text-[#3EE7C6] mt-1 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-[#3EE7C6]" />
                  {employee.activeTokens} Tokens (Canary Synced)
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[#111A23] border border-[#1E2A35]">
                <div className="text-[#7C8DA0] text-[10px] uppercase">AUTH HARDWARE</div>
                <div className="font-bold text-[#EAF2F5] mt-1 flex items-center gap-1.5">
                  <Laptop className="w-3.5 h-3.5 text-[#B48CFF]" />
                  {employee.deviceType}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[#111A23] border border-[#1E2A35]">
                <div className="text-[#7C8DA0] text-[10px] uppercase">INTERNAL IP</div>
                <div className="font-bold text-[#EAF2F5] mt-1 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-[#FFB84D]" />
                  {employee.ipAddress}
                </div>
              </div>
            </div>

            {/* Attack Stage Timeline */}
            <div className="p-4 rounded-xl bg-[#060A0E] border border-[#1E2A35]">
              <div className="flex items-center justify-between mb-3 border-b border-[#1E2A35] pb-2">
                <span className="text-xs font-mono font-bold text-[#7C8DA0] uppercase flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-[#3EE7C6]" />
                  AUTONOMOUS INCIDENT TIMELINE
                </span>
                <span className="text-[10px] font-mono text-[#3EE7C6] bg-[#3EE7C6]/10 px-2 py-0.5 rounded border border-[#3EE7C6]/30">
                  STAGE {currentStage.id + 1} OF 5 ACTIVE
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-[11px] font-mono">
                {[
                  { step: 0, name: "Reconnaissance", desc: "Perimeter Probe" },
                  { step: 1, name: "Credential Intercept", desc: "OAuth Drift" },
                  { step: 2, name: "Escalation", desc: "K8s API Attack" },
                  { step: 3, name: "Honey Trap", desc: "Decoy DB Ingress" },
                  { step: 4, name: "Containment", desc: "Merkle Seal" },
                ].map((item) => {
                  const isCurrent = currentStage.id === item.step;
                  const isPassed = currentStage.id > item.step;
                  return (
                    <div
                      key={item.step}
                      className={`p-2.5 rounded-lg border transition-all ${
                        isCurrent
                          ? 'bg-[#FF3B5C]/15 border-[#FF3B5C] text-white glow-red'
                          : isPassed
                          ? 'bg-[#3EE7C6]/10 border-[#3EE7C6]/40 text-[#3EE7C6]'
                          : 'bg-[#111A23]/40 border-[#1E2A35] text-[#4A5A6A]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold">0{item.step + 1}</span>
                        {isPassed ? (
                          <CheckCircle2 className="w-3 h-3 text-[#3EE7C6]" />
                        ) : isCurrent ? (
                          <span className="w-2 h-2 rounded-full bg-[#FF3B5C] animate-pulse" />
                        ) : null}
                      </div>
                      <div className="font-semibold">{item.name}</div>
                      <div className="text-[9px] text-[#7C8DA0] mt-0.5">{item.desc}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* LIVE GEOGRAPHIC THREAT MAP */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-[#EAF2F5] flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-[#3EE7C6]" />
                  GEO-TRIANGULATION & ACTIVE INGRESS VECTOR
                </span>
                <span className="text-[10px] font-mono text-[#7C8DA0]">
                  Target: {employee.name} &larr; Source: {currentStage.attackerGeo.city} ({currentStage.attackerGeo.ip})
                </span>
              </div>
              <ThreatMap
                attackerGeo={currentStage.attackerGeo}
                hqGeo={currentStage.hqGeo}
                isIncidentActive={isBreached}
                height={320}
              />
            </div>

            {/* Cloud IAM & SSH Role Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-4 rounded-xl bg-[#111A23] border border-[#1E2A35]">
                <div className="text-[#7C8DA0] text-[11px] mb-2 font-bold uppercase flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#3EE7C6]" />
                  ASSIGNED CLOUD ROLES
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {employee.cloudRoles.map((role) => (
                    <span key={role} className="px-2 py-1 rounded bg-[#0C131A] border border-[#1E2A35] text-[#3EE7C6] text-[10px]">
                      {role}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#111A23] border border-[#1E2A35]">
                <div className="text-[#7C8DA0] text-[11px] mb-2 font-bold uppercase flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-[#FFB84D]" />
                  AUTONOMOUS MITIGATION ACTIONS
                </div>
                <div className="text-[11px] text-[#EAF2F5] space-y-1">
                  <div className="flex items-center gap-1.5 text-[#3EE7C6]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Real SSH Keys Rotated & Vaulted</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[#3EE7C6]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Synthetic Honeytoken Injected into Ingress Pipe</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Footer Controls */}
          <div className="p-4 bg-[#111A23] border-t border-[#1E2A35] flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs font-mono text-[#7C8DA0] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#3EE7C6]" />
              <span>FORENSIC INTEGRITY SEALED ON MERKLE ROOT</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-[#0C131A] hover:bg-[#1E2A35] text-[#7C8DA0] hover:text-[#EAF2F5] text-xs font-mono border border-[#1E2A35] transition-colors cursor-pointer"
              >
                CLOSE INSPECTION
              </button>
              {onQuarantine && (
                <button
                  onClick={onQuarantine}
                  className="px-4 py-2 rounded-lg bg-[#FF3B5C]/20 hover:bg-[#FF3B5C]/30 text-[#FF3B5C] text-xs font-mono font-bold border border-[#FF3B5C]/50 flex items-center gap-1.5 transition-all glow-red cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  FORCE ROTATE ALL SESSIONS
                </button>
              )}
            </div>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
