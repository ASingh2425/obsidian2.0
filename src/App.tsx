/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { BootSequence } from './components/BootSequence';
import { LandingPage } from './components/LandingPage';
import { Dashboard } from './components/Dashboard';
import { ShiftGraphPrototype } from './presentation/prototype/ShiftGraphPrototype';
import { BehavioralObservatory } from './presentation/observatory/BehavioralObservatory';
import { Compass, Sparkles, Activity } from 'lucide-react';

export default function App() {
  const [experience, setExperience] = useState<'observatory' | 'shift-graph' | 'legacy'>(() => {
    if (typeof window !== 'undefined') {
      if (window.location.search.includes('shift-graph') || window.location.pathname.includes('/spatial')) {
        return 'shift-graph';
      }
      if (window.location.search.includes('legacy')) {
        return 'legacy';
      }
    }
    // Default to the new requested Behavioral Observatory concept
    return 'observatory';
  });

  const [bootCompleted, setBootCompleted] = useState(false);
  const [currentView, setCurrentView] = useState<'landing' | 'dashboard'>('landing');
  const [autoStartSimulation, setAutoStartSimulation] = useState(false);

  // 1. BEHAVIORAL OBSERVATORY (New Concept)
  if (experience === 'observatory') {
    return (
      <BehavioralObservatory
        onSwitchToSpatial={() => setExperience('shift-graph')}
      />
    );
  }

  // 2. SPATIAL FORENSICS (Shift Graph Prototype)
  if (experience === 'shift-graph') {
    return (
      <ShiftGraphPrototype
        onSwitchToLegacy={() => setExperience('legacy')}
        onSwitchToObservatory={() => setExperience('observatory')}
      />
    );
  }

  // 3. LEGACY OBSIDIAN 1.0 SHELL
  return (
    <div className="relative min-h-screen">
      {/* Floating Launcher to return to Obsidian 2.0 Concepts */}
      <div className="fixed top-3 right-3 z-50 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setExperience('observatory')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0b0e14]/90 hover:bg-[#111620] text-sky-400 border border-sky-500/40 shadow-xl backdrop-blur-md text-xs font-mono transition-all hover:scale-105"
        >
          <Activity className="w-3.5 h-3.5" />
          <span>OBSERVATORY CONCEPT</span>
        </button>
        <button
          type="button"
          onClick={() => setExperience('shift-graph')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0b0e14]/90 hover:bg-[#111620] text-slate-300 border border-white/20 shadow-xl backdrop-blur-md text-xs font-mono transition-all hover:scale-105"
        >
          <Compass className="w-3.5 h-3.5 text-sky-400" />
          <span>SPATIAL FORENSICS</span>
        </button>
      </div>

      {!bootCompleted ? (
        <BootSequence onComplete={() => setBootCompleted(true)} />
      ) : currentView === 'dashboard' ? (
        <Dashboard
          onReturnToLanding={() => {
            setCurrentView('landing');
            setAutoStartSimulation(false);
          }}
          autoStartSimulation={autoStartSimulation}
        />
      ) : (
        <LandingPage
          onLaunchDashboard={() => {
            setAutoStartSimulation(false);
            setCurrentView('dashboard');
          }}
          onRunSimulation={() => {
            setAutoStartSimulation(true);
            setCurrentView('dashboard');
          }}
        />
      )}
    </div>
  );
}
