/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { BootSequence } from './components/BootSequence';
import { LandingPage } from './components/LandingPage';
import { Dashboard } from './components/Dashboard';

export default function App() {
  const [bootCompleted, setBootCompleted] = useState(false);
  const [currentView, setCurrentView] = useState<'landing' | 'dashboard'>('landing');
  const [autoStartSimulation, setAutoStartSimulation] = useState(false);

  // If boot sequence is active
  if (!bootCompleted) {
    return <BootSequence onComplete={() => setBootCompleted(true)} />;
  }

  // Switch between Landing Page and SOC Dashboard
  if (currentView === 'dashboard') {
    return (
      <Dashboard
        onReturnToLanding={() => {
          setCurrentView('landing');
          setAutoStartSimulation(false);
        }}
        autoStartSimulation={autoStartSimulation}
      />
    );
  }

  return (
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
  );
}
