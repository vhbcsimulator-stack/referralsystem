import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { supabase } from './core/supabase';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Dashboard } from './pages/Dashboard';
import { Users } from './pages/Users';
import { Leaderboard } from './pages/Leaderboard';
import { Clients } from './pages/Clients';
import { Schedules } from './pages/Schedules';
import { UserVerification } from './pages/UserVerification';
import { Settings } from './pages/Settings';

const AppContent: React.FC = () => {
  const { user, profile, loading } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  if (loading) {
    return (
      <div className="flex-center w-screen h-screen bg-background" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', width: '100vw', background: '#FAFAFA' }}>
        <div className="loading-spinner-wrapper" style={{ textAlign: 'center' }}>
          <div className="spinner-btn" style={{ width: '40px', height: '40px', borderTopColor: 'var(--primary-blue)', margin: '0 auto' }} />
          <p className="mt-4 font-semibold text-muted text-sm animate-pulse" style={{ marginTop: '16px', color: '#7E8B9B', fontWeight: 600 }}>Loading VHBC Sales Portal...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    if (isRegistering) {
      return <Signup onLoginClick={() => setIsRegistering(false)} />;
    }
    return <Login onRegisterClick={() => setIsRegistering(true)} />;
  }

  // Authenticated — enforce role gate before rendering any page
  const userRole = profile?.role;

  // If profile is still loading (null but user exists), stay on the loading screen
  if (!profile) {
    return (
      <div className="flex-center w-screen h-screen bg-background" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', width: '100vw', background: '#FAFAFA' }}>
        <div className="loading-spinner-wrapper" style={{ textAlign: 'center' }}>
          <div className="spinner-btn" style={{ width: '40px', height: '40px', borderTopColor: 'var(--primary-blue)', margin: '0 auto' }} />
          <p className="mt-4 font-semibold text-muted text-sm animate-pulse" style={{ marginTop: '16px', color: '#7E8B9B', fontWeight: 600 }}>Loading VHBC Sales Portal...</p>
        </div>
      </div>
    );
  }

  // Block referrers — sign out and return to login
  if (userRole === 'referrer') {
    supabase.auth.signOut();
    return <Login onRegisterClick={() => setIsRegistering(true)} />;
  }

  // Helper to render current view
  const renderView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard onNavigate={handleTabChange} />;
      case 'users':
        return userRole === 'admin' ? <Users /> : <Dashboard onNavigate={handleTabChange} />;
      case 'leaderboard':
        return <Leaderboard />;
      case 'clients':
        return <Clients />;
      case 'schedules':
        return <Schedules />;
      case 'verification':
        return userRole === 'admin' ? <UserVerification /> : <Dashboard onNavigate={handleTabChange} />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard onNavigate={handleTabChange} />;
    }
  };

  const handleTabChange = (tabId: string) => {
    // Role protection check
    const referrerAllowed = ['dashboard', 'leaderboard', 'clients', 'schedules', 'settings'];
    if ((userRole as string) === 'referrer' && !referrerAllowed.includes(tabId)) {
      setActiveTab('dashboard');
    } else {
      setActiveTab(tabId);
    }
  };

  return (
    <Layout activeTab={activeTab} onTabChange={handleTabChange}>
      {renderView()}
    </Layout>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
