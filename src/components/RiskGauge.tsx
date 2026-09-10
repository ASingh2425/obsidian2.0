'use client';

import { motion } from 'framer-motion';
import { Shield, ShieldAlert, ShieldCheck } from 'lucide-react';

interface RiskGaugeProps {
  score: number; // 0 to 100
  title?: string;
  subtitle?: string;
}

export function RiskGauge({ score, title = "ORGANIZATIONAL RISK LEVEL", subtitle = "AUTONOMOUS THREAT SCORING" }: RiskGaugeProps) {
  // Determine color scheme based on score
  let statusText = "NOMINAL // LOW RISK";
  let statusColor = "#3EE7C6"; // Cyan
  let glowClass = "glow-cyan";
  let statusBadge = "bg-[#3EE7C6]/10 text-[#3EE7C6] border-[#3EE7C6]/30";
  let Icon = ShieldCheck;

  if (score >= 70) {
    statusText = "CRITICAL // ACTIVE BREACH";
    statusColor = "#FF3B5C"; // Red
    glowClass = "glow-red";
    statusBadge = "bg-[#FF3B5C]/15 text-[#FF3B5C] border-[#FF3B5C]/40 animate-pulse";
    Icon = ShieldAlert;
  } else if (score >= 40) {
    statusText = "ELEVATED // DRIFT DETECTED";
    statusColor = "#FFB84D"; // Amber
    glowClass = "glow-amber";
    statusBadge = "bg-[#FFB84D]/15 text-[#FFB84D] border-[#FFB84D]/40";
    Icon = Shield;
  }

  // Arc calculation (semi-circle from 180 to 0 degrees)
  const radius = 75;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="bg-[#0C131A] border border-[#1E2A35] rounded-xl p-5 relative overflow-hidden flex flex-col items-center justify-center">
      {/* Subtle background glow */}
      <div 
        className="absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-24 rounded-full blur-3xl opacity-20 pointer-events-none transition-colors duration-500"
        style={{ backgroundColor: statusColor }}
      />

      {/* Header labels */}
      <div className="w-full flex items-center justify-between border-b border-[#1E2A35]/60 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColor }} />
          <span className="text-xs font-mono text-[#7C8DA0] uppercase tracking-wider">{title}</span>
        </div>
        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${statusBadge} flex items-center gap-1 font-semibold`}>
          <Icon className="w-3 h-3" />
          {statusText}
        </span>
      </div>

      {/* SVG Arc Gauge */}
      <div className="relative w-56 h-32 flex items-center justify-center mt-1">
        <svg className="w-56 h-36 overflow-visible" viewBox="0 0 200 120">
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3EE7C6" />
              <stop offset="45%" stopColor="#3EE7C6" />
              <stop offset="65%" stopColor="#FFB84D" />
              <stop offset="90%" stopColor="#FF3B5C" />
            </linearGradient>
            <filter id="gaugeGlow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Background Track */}
          <path
            d="M 20 110 A 80 80 0 0 1 180 110"
            fill="none"
            stroke="#1E2A35"
            strokeWidth="12"
            strokeLinecap="round"
          />

          {/* Segment marks */}
          <circle cx="20" cy="110" r="2.5" fill="#3EE7C6" opacity="0.6" />
          <circle cx="100" cy="30" r="2.5" fill="#FFB84D" opacity="0.6" />
          <circle cx="180" cy="110" r="2.5" fill="#FF3B5C" opacity="0.6" />

          {/* Value Path */}
          <motion.path
            d="M 20 110 A 80 80 0 0 1 180 110"
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference * 1.07}
            initial={{ strokeDashoffset: circumference * 1.07 }}
            animate={{ strokeDashoffset: (circumference * 1.07) - (score / 100) * (circumference * 1.07) }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            filter="url(#gaugeGlow)"
          />
        </svg>

        {/* Center Display Number */}
        <div className="absolute top-12 left-1/2 -translate-x-1/2 flex flex-col items-center justify-center">
          <motion.span 
            key={score}
            initial={{ scale: 0.9, opacity: 0.5 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-4xl font-extrabold font-mono tracking-tight"
            style={{ color: statusColor }}
          >
            {score}
          </motion.span>
          <span className="text-[10px] font-mono text-[#4A5A6A] -mt-1">/ 100 AGGREGATE</span>
        </div>
      </div>

      {/* Threshold Indicators */}
      <div className="w-full flex justify-between px-4 text-[10px] font-mono text-[#4A5A6A] pt-1">
        <span className="text-[#3EE7C6]/80 font-medium">0 NOMINAL</span>
        <span className="text-[#FFB84D]/80 font-medium">40 ELEVATED</span>
        <span className="text-[#FF3B5C]/80 font-medium">70+ BREACH</span>
      </div>
    </div>
  );
}
