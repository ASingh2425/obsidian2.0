'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ComposableMap, Geographies, Geography, Marker, Line } from 'react-simple-maps';
import { 
  Shield, 
  AlertTriangle, 
  Crosshair, 
  Radio, 
  Globe, 
  Terminal, 
  Activity, 
  Filter, 
  RotateCcw, 
  Search, 
  Layers, 
  Zap, 
  ChevronDown, 
  ChevronUp, 
  Eye, 
  Check, 
  Lock,
  Cpu,
  Sparkles
} from 'lucide-react';
import { ThreatGeo, ThreatVector, ThreatSeverity, ThreatTypeCategory } from '../types';
import { ATTACKER_GEOLOCATION, HQ_GEOLOCATION, GLOBAL_THREAT_VECTORS } from '../data/mockData';

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface ThreatMapProps {
  attackerGeo?: ThreatGeo;
  hqGeo?: ThreatGeo;
  isIncidentActive?: boolean;
  className?: string;
  height?: number;
}

const ALL_SEVERITIES: ThreatSeverity[] = ['CRITICAL', 'HIGH', 'ELEVATED', 'MEDIUM'];

const SEVERITY_COLORS: Record<ThreatSeverity, { bg: string; text: string; border: string; glow: string; hex: string }> = {
  CRITICAL: { bg: 'bg-[#FF3B5C]/15', text: 'text-[#FF3B5C]', border: 'border-[#FF3B5C]', glow: 'glow-red', hex: '#FF3B5C' },
  HIGH: { bg: 'bg-[#FFB84D]/15', text: 'text-[#FFB84D]', border: 'border-[#FFB84D]', glow: 'glow-amber', hex: '#FFB84D' },
  ELEVATED: { bg: 'bg-[#B48CFF]/15', text: 'text-[#B48CFF]', border: 'border-[#B48CFF]', glow: 'glow-violet', hex: '#B48CFF' },
  MEDIUM: { bg: 'bg-[#3EE7C6]/15', text: 'text-[#3EE7C6]', border: 'border-[#3EE7C6]', glow: 'glow-cyan', hex: '#3EE7C6' },
};

// Defensive Hub Nodes to render on map
const DEFENSE_HUBS: { name: string; city: string; countryCode: string; coordinates: [number, number]; isHQ?: boolean }[] = [
  { name: "OBSIDIAN HQ CORE", city: "San Francisco", countryCode: "US", coordinates: [-122.4194, 37.7749], isHQ: true },
  { name: "LON ENCLAVE 01", city: "London", countryCode: "UK", coordinates: [-0.1278, 51.5074] },
  { name: "TYO SEC VAULT", city: "Tokyo", countryCode: "JP", coordinates: [139.6917, 35.6895] },
  { name: "APAC MESH GATEWAY", city: "Singapore", countryCode: "SG", coordinates: [103.8198, 1.3521] },
  { name: "EU DMZ INGRESS", city: "Frankfurt", countryCode: "DE", coordinates: [8.6821, 50.1109] },
];

export function ThreatMap({
  attackerGeo = ATTACKER_GEOLOCATION,
  hqGeo = HQ_GEOLOCATION,
  isIncidentActive = true,
  className = "",
  height = 460,
}: ThreatMapProps) {
  // Filter States
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [selectedCountry, setSelectedCountry] = useState<string>("ALL");
  const [selectedSeverities, setSelectedSeverities] = useState<ThreatSeverity[]>(['CRITICAL', 'HIGH', 'ELEVATED', 'MEDIUM']);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showBeams, setShowBeams] = useState<boolean>(true);
  const [showThreatFeed, setShowThreatFeed] = useState<boolean>(false);
  const [selectedThreatId, setSelectedThreatId] = useState<string | null>(null);

  // Active Tooltip
  const [activeTooltip, setActiveTooltip] = useState<{
    threat: ThreatVector;
    x: number;
    y: number;
  } | null>(null);

  // Live Jitter Ticker for Threats Blocked
  const [tickerOffset, setTickerOffset] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTickerOffset(prev => prev + Math.floor(Math.random() * 3) + 1);
    }, 2400);
    return () => clearInterval(interval);
  }, []);

  // Merge primary attackerGeo dynamically if provided into threat dataset
  const threatDataset = useMemo(() => {
    return GLOBAL_THREAT_VECTORS.map(threat => {
      if (threat.isPrimaryIncident && attackerGeo) {
        return {
          ...threat,
          originCity: attackerGeo.city,
          originCountry: attackerGeo.country,
          countryCode: attackerGeo.countryCode,
          coordinates: [attackerGeo.lng, attackerGeo.lat] as [number, number],
          ip: attackerGeo.ip,
          asn: attackerGeo.asn,
          actor: attackerGeo.threatActor || threat.actor,
          confidence: attackerGeo.confidence || threat.confidence,
        };
      }
      return threat;
    });
  }, [attackerGeo]);

  // Extract unique threat types & origin countries for filter dropdowns
  const availableTypes = useMemo(() => {
    const types = Array.from(new Set(threatDataset.map(t => t.type))).sort();
    return ["ALL", ...types];
  }, [threatDataset]);

  const availableCountries = useMemo(() => {
    const countries = Array.from(new Set(threatDataset.map(t => t.originCountry))).sort();
    return ["ALL", ...countries];
  }, [threatDataset]);

  // Filtered threats based on all active criteria
  const filteredThreats = useMemo(() => {
    return threatDataset.filter(threat => {
      // Threat Type filter
      if (selectedType !== "ALL" && threat.type !== selectedType) {
        return false;
      }
      // Origin Country filter
      if (selectedCountry !== "ALL" && threat.originCountry !== selectedCountry) {
        return false;
      }
      // Severity filter (multi-select)
      if (!selectedSeverities.includes(threat.severity)) {
        return false;
      }
      // Text search filter
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase().trim();
        const matchesActor = threat.actor.toLowerCase().includes(query);
        const matchesIp = threat.ip.toLowerCase().includes(query);
        const matchesCity = threat.originCity.toLowerCase().includes(query);
        const matchesCountry = threat.originCountry.toLowerCase().includes(query);
        const matchesType = threat.type.toLowerCase().includes(query);
        const matchesTarget = threat.targetNode.toLowerCase().includes(query);
        const matchesId = threat.id.toLowerCase().includes(query);
        if (!matchesActor && !matchesIp && !matchesCity && !matchesCountry && !matchesType && !matchesTarget && !matchesId) {
          return false;
        }
      }
      return true;
    });
  }, [threatDataset, selectedType, selectedCountry, selectedSeverities, searchQuery]);

  // Dynamically compute 'THREATS BLOCKED TODAY' based on active filter
  const totalBlockedToday = useMemo(() => {
    const baseline = filteredThreats.reduce((sum, t) => sum + t.blockedCount, 0);
    // Add proportional dynamic ticker offset
    const proportionalOffset = filteredThreats.length > 0 
      ? Math.floor((tickerOffset * filteredThreats.length) / threatDataset.length) 
      : 0;
    return baseline + proportionalOffset;
  }, [filteredThreats, tickerOffset, threatDataset.length]);

  // Check if any filters are active (non-default)
  const isFilterActive = useMemo(() => {
    return (
      selectedType !== "ALL" ||
      selectedCountry !== "ALL" ||
      selectedSeverities.length !== ALL_SEVERITIES.length ||
      searchQuery.trim() !== ""
    );
  }, [selectedType, selectedCountry, selectedSeverities, searchQuery]);

  // Reset all filters to default
  const handleResetFilters = () => {
    setSelectedType("ALL");
    setSelectedCountry("ALL");
    setSelectedSeverities(['CRITICAL', 'HIGH', 'ELEVATED', 'MEDIUM']);
    setSearchQuery("");
    setSelectedThreatId(null);
  };

  // Toggle individual severity in multi-select
  const handleToggleSeverity = (severity: ThreatSeverity) => {
    setSelectedSeverities(prev => {
      if (prev.includes(severity)) {
        // Prevent unselecting all (keep at least 1)
        if (prev.length === 1) return prev;
        return prev.filter(s => s !== severity);
      } else {
        return [...prev, severity];
      }
    });
  };

  // Selected threat item details if focused
  const selectedThreat = useMemo(() => {
    return threatDataset.find(t => t.id === selectedThreatId) || null;
  }, [threatDataset, selectedThreatId]);

  return (
    <div className={`relative bg-[#060A0E] border border-[#1E2A35] rounded-xl overflow-hidden shadow-2xl flex flex-col ${className}`}>
      
      {/* 1. TOP HUD BANNER & TELEMETRY COUNTER */}
      <div className="p-3.5 bg-gradient-to-r from-[#0C131A] via-[#111A23] to-[#0C131A] border-b border-[#1E2A35] flex flex-wrap items-center justify-between gap-3 z-30">
        
        {/* Title & Radar Status */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-[#3EE7C6]/10 border border-[#3EE7C6]/30">
            <Radio className="w-4 h-4 text-[#3EE7C6] animate-pulse" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#3EE7C6] animate-ping" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-[#EAF2F5] tracking-wider uppercase">
                GLOBAL THREAT RADAR
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#111A23] border border-[#1E2A35] text-[#3EE7C6] font-semibold">
                INTERACTIVE FILTERING ON
              </span>
            </div>
            <div className="text-[10px] font-mono text-[#7C8DA0] flex items-center gap-2">
              <span>ACTIVE VECTORS: <strong className="text-[#EAF2F5]">{filteredThreats.length}</strong> / {threatDataset.length}</span>
              <span>&bull;</span>
              <span className="text-[#3EE7C6]">HONEYNET TRAPS ARMED</span>
            </div>
          </div>
        </div>

        {/* Dynamic 'THREATS BLOCKED TODAY' Counter */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-[#060A0E] border border-[#1E2A35] shadow-inner">
            <div className="p-1 rounded bg-[#3EE7C6]/10 text-[#3EE7C6]">
              <Activity className="w-3.5 h-3.5 animate-pulse" />
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-mono text-[#7C8DA0] uppercase tracking-wider">
                THREATS BLOCKED TODAY {isFilterActive && <span className="text-[#FFB84D]">(FILTERED)</span>}
              </span>
              <motion.span 
                key={totalBlockedToday}
                initial={{ opacity: 0.6, y: -2 }}
                animate={{ opacity: 1, y: 0 }}
                className="font-mono text-base font-bold text-[#3EE7C6] tabular-nums tracking-wide glow-cyan"
              >
                {totalBlockedToday.toLocaleString()}
              </motion.span>
            </div>
          </div>

          {/* Quick Filter Reset Button */}
          {isFilterActive && (
            <button
              onClick={handleResetFilters}
              title="Reset all active filters"
              className="px-2.5 py-2 rounded-lg bg-[#FF3B5C]/10 border border-[#FF3B5C]/40 text-[#FF3B5C] hover:bg-[#FF3B5C] hover:text-white transition-all text-xs font-mono flex items-center gap-1.5 cursor-pointer glow-red"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px] font-bold">RESET FILTERS</span>
            </button>
          )}
        </div>

      </div>

      {/* 2. CYBERPUNK INTERACTIVE FILTER CONTROLS TOOLBAR */}
      <div className="p-3 bg-[#0C131A]/95 border-b border-[#1E2A35] z-20 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        
        {/* Left Filter Controls Group */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          
          {/* Filter Indicator Icon */}
          <div className="flex items-center gap-1 text-[#7C8DA0] text-[11px] font-bold pr-1">
            <Filter className="w-3.5 h-3.5 text-[#3EE7C6]" />
            <span className="uppercase">FILTERS:</span>
          </div>

          {/* 1. Threat Type Dropdown */}
          <div className="relative">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="bg-[#060A0E] text-[#EAF2F5] border border-[#2C3D4C] focus:border-[#3EE7C6] rounded-md px-2.5 py-1.5 text-xs font-mono outline-none cursor-pointer hover:border-[#3EE7C6]/60 transition-colors pr-7 appearance-none"
            >
              <option value="ALL">ALL TYPES ({threatDataset.length})</option>
              {availableTypes.filter(t => t !== 'ALL').map(type => {
                const count = threatDataset.filter(t => t.type === type).length;
                return (
                  <option key={type} value={type}>
                    {type.toUpperCase()} ({count})
                  </option>
                );
              })}
            </select>
            <ChevronDown className="w-3 h-3 text-[#7C8DA0] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* 2. Origin Country Dropdown */}
          <div className="relative">
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="bg-[#060A0E] text-[#EAF2F5] border border-[#2C3D4C] focus:border-[#3EE7C6] rounded-md px-2.5 py-1.5 text-xs font-mono outline-none cursor-pointer hover:border-[#3EE7C6]/60 transition-colors pr-7 appearance-none"
            >
              <option value="ALL">ALL ORIGINS ({threatDataset.length})</option>
              {availableCountries.filter(c => c !== 'ALL').map(country => {
                const count = threatDataset.filter(t => t.originCountry === country).length;
                return (
                  <option key={country} value={country}>
                    {country} ({count})
                  </option>
                );
              })}
            </select>
            <Globe className="w-3 h-3 text-[#7C8DA0] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* 3. Severity Checkboxes / Toggle Chips */}
          <div className="flex items-center gap-1 bg-[#060A0E] p-1 rounded-md border border-[#1E2A35]">
            <span className="text-[9px] text-[#7C8DA0] px-1 uppercase hidden md:inline">SEVERITY:</span>
            {ALL_SEVERITIES.map((sev) => {
              const isChecked = selectedSeverities.includes(sev);
              const colorInfo = SEVERITY_COLORS[sev];
              const count = threatDataset.filter(t => t.severity === sev).length;
              return (
                <button
                  key={sev}
                  type="button"
                  onClick={() => handleToggleSeverity(sev)}
                  className={`px-2 py-1 rounded text-[10px] font-mono font-bold flex items-center gap-1 transition-all cursor-pointer border ${
                    isChecked
                      ? `${colorInfo.bg} ${colorInfo.text} ${colorInfo.border} ${colorInfo.glow}`
                      : 'bg-[#111A23]/50 text-[#4A5A6A] border-transparent hover:text-[#7C8DA0]'
                  }`}
                  title={`Toggle ${sev} severity threats (${count} active)`}
                >
                  <div className={`w-2 h-2 rounded-sm border flex items-center justify-center ${
                    isChecked ? `${colorInfo.border} bg-current` : 'border-[#4A5A6A]'
                  }`}>
                    {isChecked && <Check className="w-2 h-2 text-[#060A0E]" />}
                  </div>
                  <span>{sev.slice(0, 4)}</span>
                  <span className="text-[8px] opacity-75">({count})</span>
                </button>
              );
            })}
          </div>

          {/* 4. Real-time Search Input */}
          <div className="relative min-w-[160px] max-w-[220px]">
            <Search className="w-3.5 h-3.5 text-[#7C8DA0] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search IP, Actor, Node..."
              className="w-full bg-[#060A0E] border border-[#2C3D4C] focus:border-[#3EE7C6] text-[#EAF2F5] placeholder-[#4A5A6A] rounded-md pl-8 pr-2.5 py-1.5 text-xs font-mono outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#7C8DA0] hover:text-white"
              >
                &times;
              </button>
            )}
          </div>

        </div>

        {/* Right Toggle Options */}
        <div className="flex items-center gap-2">
          
          {/* Toggle Beams */}
          <button
            onClick={() => setShowBeams(!showBeams)}
            className={`px-2.5 py-1.5 rounded-md border text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer ${
              showBeams 
                ? 'bg-[#111A23] border-[#3EE7C6]/50 text-[#3EE7C6]' 
                : 'bg-[#060A0E] border-[#1E2A35] text-[#7C8DA0]'
            }`}
            title="Toggle attack trajectory arcs"
          >
            <Zap className="w-3 h-3" />
            <span className="hidden sm:inline">BEAMS: {showBeams ? 'ON' : 'OFF'}</span>
          </button>

          {/* Toggle Threat Matrix Feed */}
          <button
            onClick={() => setShowThreatFeed(!showThreatFeed)}
            className={`px-2.5 py-1.5 rounded-md border text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer ${
              showThreatFeed 
                ? 'bg-[#111A23] border-[#3EE7C6] text-[#3EE7C6] glow-cyan font-bold' 
                : 'bg-[#060A0E] border-[#1E2A35] text-[#7C8DA0] hover:text-[#EAF2F5]'
            }`}
          >
            <Terminal className="w-3 h-3" />
            <span>LIVE MATRIX</span>
            {showThreatFeed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

        </div>

      </div>

      {/* Quick Filter Type Pill Bar */}
      <div className="px-3.5 py-1.5 bg-[#060A0E] border-b border-[#1E2A35] flex items-center gap-1.5 overflow-x-auto text-[10px] font-mono scrollbar-thin">
        <span className="text-[#4A5A6A] uppercase pr-1 font-bold whitespace-nowrap">QUICK FILTER:</span>
        {availableTypes.map(type => {
          const isSelected = selectedType === type;
          const count = type === 'ALL' 
            ? threatDataset.length 
            : threatDataset.filter(t => t.type === type).length;
          return (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-2 py-0.5 rounded whitespace-nowrap transition-all cursor-pointer border ${
                isSelected
                  ? 'bg-[#3EE7C6]/20 border-[#3EE7C6] text-[#3EE7C6] font-bold glow-cyan'
                  : 'bg-[#111A23]/60 border-[#1E2A35] text-[#7C8DA0] hover:text-[#EAF2F5] hover:border-[#2C3D4C]'
              }`}
            >
              {type === 'ALL' ? 'ALL VECTORS' : type} ({count})
            </button>
          );
        })}
      </div>

      {/* 3. MAP CANVAS & DYNAMIC VECTORS */}
      <div className="w-full relative select-none overflow-hidden bg-[#060A0E]" style={{ minHeight: height }}>
        
        {/* Background Cyber Grid */}
        <div className="absolute inset-0 cyber-grid opacity-30 pointer-events-none" />

        {/* Empty State when no threats match filter */}
        {filteredThreats.length === 0 && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#060A0E]/85 backdrop-blur-xs p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-[#FF3B5C]/10 border border-[#FF3B5C]/40 flex items-center justify-center text-[#FF3B5C] mb-3 glow-red">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold font-mono text-[#EAF2F5] uppercase tracking-wider">
              NO ACTIVE VECTORS MATCHING FILTER
            </h4>
            <p className="text-xs font-mono text-[#7C8DA0] mt-1 max-w-md">
              Try selecting additional severity levels, resetting the type/origin dropdowns, or clearing search keywords.
            </p>
            <button
              onClick={handleResetFilters}
              className="mt-4 px-4 py-1.5 rounded-lg bg-[#3EE7C6] text-black font-mono font-bold text-xs glow-cyan hover:bg-[#32c9ab] transition-all cursor-pointer"
            >
              RESET ALL FILTERS
            </button>
          </div>
        )}

        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            scale: 118,
            center: [10, 24],
          }}
          width={800}
          height={height}
          style={{ width: "100%", height: "100%", maxHeight: "560px" }}
        >
          {/* Countries World Geography Layer */}
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#0C131A"
                  stroke="#1E2A35"
                  strokeWidth={0.6}
                  style={{
                    default: { outline: "none" },
                    hover: { fill: "#111A23", stroke: "#2C3D4C", outline: "none" },
                    pressed: { outline: "none" },
                  }}
                />
              ))
            }
          </Geographies>

          {/* DYNAMIC ATTACK BEAMS / ARCS FOR FILTERED THREATS */}
          {showBeams && filteredThreats.map((threat) => {
            const isPrimary = threat.isPrimaryIncident;
            const isFocused = selectedThreatId === threat.id;
            const colorHex = SEVERITY_COLORS[threat.severity].hex;
            
            return (
              <Line
                key={`beam-${threat.id}`}
                from={threat.coordinates}
                to={threat.targetCoordinates}
                stroke={colorHex}
                strokeWidth={isFocused ? 3 : isPrimary ? 2.5 : threat.severity === 'CRITICAL' ? 2 : 1.2}
                strokeDasharray={isPrimary ? "6 4" : threat.severity === 'CRITICAL' ? "5 3" : "3 3"}
                strokeLinecap="round"
                className={isPrimary || isFocused ? "animate-pulse" : ""}
                style={{
                  opacity: isFocused ? 1 : isPrimary ? 0.95 : 0.65,
                  filter: `drop-shadow(0 0 5px ${colorHex})`,
                }}
              />
            );
          })}

          {/* DEFENSIVE HUB MARKERS (San Francisco HQ, London, Tokyo, Singapore, Frankfurt) */}
          {DEFENSE_HUBS.map((hub) => (
            <Marker key={hub.name} coordinates={hub.coordinates}>
              <g
                className="cursor-pointer"
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setActiveTooltip({
                    threat: {
                      id: hub.isHQ ? "NODE-SF-HQ" : `NODE-${hub.countryCode}`,
                      actor: hub.isHQ ? "OBSIDIAN PRIMARY DEFENSE CORE" : `OBSIDIAN ${hub.name}`,
                      type: "Zero-Day" as any,
                      severity: "MEDIUM",
                      originCity: hub.city,
                      originCountry: hub.name,
                      countryCode: hub.countryCode,
                      coordinates: hub.coordinates,
                      targetCity: hub.city,
                      targetCountry: hub.countryCode,
                      targetCoordinates: hub.coordinates,
                      ip: hub.isHQ ? hqGeo.ip : "198.51.100.88",
                      asn: "AS13335 (Obsidian Autonomous Mesh)",
                      targetNode: hub.name,
                      blockedCount: totalBlockedToday,
                      timestamp: "ACTIVE",
                      confidence: 100,
                      status: "CONTAINED",
                      payloadSnippet: "Autonomous Honey-Mesh Gateway with Synthetic L7 Twin Emulation (100% Nominal)",
                    },
                    x: rect.left,
                    y: rect.top - 90,
                  });
                }}
                onMouseLeave={() => setActiveTooltip(null)}
              >
                <circle 
                  r={hub.isHQ ? 12 : 8} 
                  fill="#3EE7C6" 
                  opacity={hub.isHQ ? 0.25 : 0.15} 
                  className={hub.isHQ ? "animate-pulse" : ""} 
                />
                <circle r={hub.isHQ ? 6 : 4} fill="#3EE7C6" opacity={0.5} />
                <circle r={hub.isHQ ? 3.5 : 2.5} fill="#3EE7C6" stroke="#FFFFFF" strokeWidth={1} />
                
                {/* Node Label */}
                <text
                  textAnchor="middle"
                  y={hub.isHQ ? -14 : -10}
                  className="text-[9px] font-mono fill-[#3EE7C6] font-bold select-none tracking-wider"
                  style={{ textShadow: "0 0 8px rgba(0,0,0,0.95)" }}
                >
                  {hub.isHQ ? `HQ [${hub.countryCode}]` : hub.countryCode}
                </text>
              </g>
            </Marker>
          ))}

          {/* DYNAMIC THREAT ORIGIN MARKERS (FILTERED) */}
          {filteredThreats.map((threat) => {
            const isPrimary = threat.isPrimaryIncident;
            const isFocused = selectedThreatId === threat.id;
            const colorInfo = SEVERITY_COLORS[threat.severity];
            const isCrit = threat.severity === 'CRITICAL';
            const isHigh = threat.severity === 'HIGH';

            return (
              <Marker key={threat.id} coordinates={threat.coordinates}>
                <g
                  className="cursor-pointer group"
                  onClick={() => setSelectedThreatId(threat.id === selectedThreatId ? null : threat.id)}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setActiveTooltip({
                      threat,
                      x: rect.left,
                      y: rect.top - 90,
                    });
                  }}
                  onMouseLeave={() => setActiveTooltip(null)}
                >
                  {/* Outer pulsing beacon for Critical / Primary / Focused threats */}
                  {(isCrit || isPrimary || isFocused) && (
                    <circle
                      r={isFocused ? 18 : isPrimary ? 16 : 12}
                      fill={colorInfo.hex}
                      opacity={0.25}
                      className="animate-ping"
                    />
                  )}

                  {/* Mid Ring */}
                  <circle
                    r={isFocused ? 10 : isCrit ? 8 : isHigh ? 6 : 4.5}
                    fill={colorInfo.hex}
                    opacity={0.4}
                  />

                  {/* Center Dot */}
                  <circle
                    r={isFocused ? 5 : isCrit ? 4 : isHigh ? 3 : 2.5}
                    fill={colorInfo.hex}
                    stroke="#FFFFFF"
                    strokeWidth={isFocused ? 1.5 : 1}
                  />

                  {/* Marker Country / Severity Tag */}
                  <text
                    textAnchor="middle"
                    y={-12}
                    className="text-[8.5px] font-mono font-bold select-none tracking-wider transition-all"
                    fill={colorInfo.hex}
                    style={{ textShadow: "0 0 8px rgba(0,0,0,0.95)" }}
                  >
                    {threat.countryCode} [{threat.severity.slice(0, 4)}]
                  </text>
                </g>
              </Marker>
            );
          })}

        </ComposableMap>

        {/* FLOATING HUD THREAT INTEL CARD (Primary Incident or Hovered/Selected) */}
        {(activeTooltip || selectedThreat) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-4 left-4 z-30 border border-[#2C3D4C] bg-[#0C131A]/95 p-4 mono text-xs rounded-xl shadow-2xl backdrop-blur-md max-w-sm w-full"
            style={{
              borderColor: SEVERITY_COLORS[(activeTooltip?.threat || selectedThreat!).severity].hex,
              boxShadow: `0 0 25px ${SEVERITY_COLORS[(activeTooltip?.threat || selectedThreat!).severity].hex}33`,
            }}
          >
            {(() => {
              const item = activeTooltip?.threat || selectedThreat!;
              const colorInfo = SEVERITY_COLORS[item.severity];
              return (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between border-b border-[#1E2A35] pb-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${colorInfo.hex === '#FF3B5C' ? 'animate-ping' : ''}`} style={{ backgroundColor: colorInfo.hex }} />
                      <span className={`font-bold tracking-wider ${colorInfo.text}`}>
                        {item.severity} // {item.type.toUpperCase()}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#7C8DA0] bg-[#111A23] px-2 py-0.5 rounded border border-[#1E2A35]">
                      {item.id}
                    </span>
                  </div>

                  <div className="text-sm font-bold text-[#EAF2F5]">{item.actor}</div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-[#060A0E] p-2.5 rounded-lg border border-[#1E2A35]">
                    <div>
                      <span className="text-[#7C8DA0] text-[9px] uppercase block">ORIGIN</span>
                      <span className="text-[#EAF2F5] font-semibold">{item.originCity}, {item.originCountry} ({item.countryCode})</span>
                    </div>
                    <div>
                      <span className="text-[#7C8DA0] text-[9px] uppercase block">SOURCE IP</span>
                      <span className="text-[#3EE7C6] font-mono">{item.ip}</span>
                    </div>
                    <div>
                      <span className="text-[#7C8DA0] text-[9px] uppercase block">TARGET ASSET</span>
                      <span className="text-[#FFB84D] font-mono">{item.targetNode}</span>
                    </div>
                    <div>
                      <span className="text-[#7C8DA0] text-[9px] uppercase block">DECEPTION STATUS</span>
                      <span className="text-[#3EE7C6] font-semibold">{item.status}</span>
                    </div>
                  </div>

                  <div className="text-[10px] text-[#7C8DA0] border-t border-[#1E2A35]/60 pt-2 flex items-center justify-between">
                    <span>BLOCKED VOLUME: <strong className="text-[#3EE7C6]">{item.blockedCount.toLocaleString()}</strong></span>
                    <span>CONFIDENCE: <strong className="text-[#EAF2F5]">{item.confidence}%</strong></span>
                  </div>

                  <div className="text-[9px] text-[#4A5A6A] font-mono truncate bg-[#111A23] p-1.5 rounded border border-[#1E2A35]">
                    PAYLOAD: {item.payloadSnippet}
                  </div>
                </div>
              );
            })()}
          </motion.div>
        )}

      </div>

      {/* 4. EXPANDABLE LIVE THREAT MATRIX FEED */}
      <AnimatePresence>
        {showThreatFeed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-[#1E2A35] bg-[#0C131A] overflow-hidden"
          >
            <div className="p-3 bg-[#111A23]/80 border-b border-[#1E2A35] flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#EAF2F5]">
                <Terminal className="w-3.5 h-3.5 text-[#3EE7C6]" />
                <span>FILTERED REAL-TIME THREAT VECTOR MATRIX ({filteredThreats.length} NODES)</span>
              </div>
              <span className="text-[10px] font-mono text-[#7C8DA0]">
                CLICK ANY ROW TO FOCUS ON MAP
              </span>
            </div>

            <div className="max-h-56 overflow-y-auto font-mono text-xs scrollbar-thin">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#1E2A35] bg-[#060A0E]/60 text-[10px] text-[#7C8DA0] uppercase tracking-wider">
                    <th className="py-2 px-3">ID / TIME</th>
                    <th className="py-2 px-3">TYPE</th>
                    <th className="py-2 px-3">SEVERITY</th>
                    <th className="py-2 px-3">ORIGIN</th>
                    <th className="py-2 px-3">SOURCE IP / ACTOR</th>
                    <th className="py-2 px-3">TARGET</th>
                    <th className="py-2 px-3 text-right">BLOCKED</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E2A35]/50 text-[11px]">
                  {filteredThreats.map((threat) => {
                    const colorInfo = SEVERITY_COLORS[threat.severity];
                    const isSelected = selectedThreatId === threat.id;
                    return (
                      <tr
                        key={threat.id}
                        onClick={() => setSelectedThreatId(isSelected ? null : threat.id)}
                        className={`hover:bg-[#111A23] transition-colors cursor-pointer ${
                          isSelected ? 'bg-[#111A23] border-l-2 border-[#3EE7C6]' : ''
                        }`}
                      >
                        <td className="py-2 px-3 text-[#7C8DA0] font-mono">
                          <span className="text-[#EAF2F5] font-semibold">{threat.id}</span>
                          <div className="text-[9px] text-[#4A5A6A]">{threat.timestamp}</div>
                        </td>
                        <td className="py-2 px-3">
                          <span className="px-1.5 py-0.5 rounded bg-[#111A23] border border-[#1E2A35] text-[#EAF2F5] text-[10px]">
                            {threat.type}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${colorInfo.bg} ${colorInfo.text} border ${colorInfo.border}`}>
                            {threat.severity}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-[#EAF2F5]">
                          {threat.originCity}, {threat.originCountry}
                          <span className="text-[9px] text-[#7C8DA0] ml-1">[{threat.countryCode}]</span>
                        </td>
                        <td className="py-2 px-3">
                          <div className="text-[#3EE7C6] font-mono">{threat.ip}</div>
                          <div className="text-[9px] text-[#7C8DA0] truncate max-w-[140px]">{threat.actor}</div>
                        </td>
                        <td className="py-2 px-3 text-[#FFB84D] font-mono text-[10px]">
                          {threat.targetNode}
                        </td>
                        <td className="py-2 px-3 text-right text-[#3EE7C6] font-bold font-mono">
                          {threat.blockedCount.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. BOTTOM TELEMETRY LEGEND BAR */}
      <div className="p-3 bg-[#0C131A] border-t border-[#1E2A35] flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-[#7C8DA0]">
        
        {/* Severity Legend */}
        <div className="flex items-center gap-3.5 flex-wrap">
          <span className="text-[#4A5A6A] uppercase font-bold text-[10px]">LEGEND:</span>
          {ALL_SEVERITIES.map((sev) => {
            const color = SEVERITY_COLORS[sev];
            return (
              <div key={sev} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color.hex }} />
                <span className="text-[#EAF2F5] text-[10px]">{sev}</span>
              </div>
            );
          })}
          <div className="flex items-center gap-1.5 pl-2 border-l border-[#1E2A35]">
            <span className="w-2 h-2 rounded-full bg-[#3EE7C6]" />
            <span className="text-[#3EE7C6] text-[10px]">Defensive Core Nodes</span>
          </div>
        </div>

        {/* Triangulation Telemetry */}
        <div className="flex items-center gap-2 text-[#4A5A6A]">
          <Terminal className="w-3.5 h-3.5 text-[#3EE7C6]" />
          <span>TRIANGULATION: <strong className="text-[#3EE7C6]">99.4%</strong> | ENCRYPTED: <strong className="text-[#EAF2F5]">AES-256</strong></span>
        </div>

      </div>

    </div>
  );
}
