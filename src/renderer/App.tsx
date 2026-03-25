import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ipc } from './lib/ipc';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import OnboardingFlow from './components/onboarding/OnboardingFlow';
import Shell from './components/layout/Shell';
import DashboardPage from './components/dashboard/DashboardPage';
import TimelinePage from './components/timeline/TimelinePage';
import ReportsPage from './components/reports/ReportsPage';
import RulesPage from './components/rules/RulesPage';
import SettingsPage from './components/settings/SettingsPage';

export default function App() {
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if onboarding is complete
    ipc<Record<string, string>>('settings:get').then((settings) => {
      if (settings && settings.onboarding_complete === 'true') {
        setShowOnboarding(false);
      } else {
        setShowOnboarding(true);
      }
    }).catch(() => {
      // If settings aren't available (dev mode without Electron), skip onboarding
      setShowOnboarding(false);
    });
  }, []);

  // Loading state while checking settings
  if (showOnboarding === null) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center">
        <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center animate-pulse">
          <span className="text-white font-bold text-sm">FL</span>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      {showOnboarding && (
        <OnboardingFlow onComplete={() => setShowOnboarding(false)} />
      )}

      <HashRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/timeline" element={<TimelinePage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/rules" element={<RulesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  );
}
