import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Trophy, 
  UserCheck, 
  Calendar, 
  ShieldCheck, 
  Settings, 
  LogOut,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export interface NavigationItem {
  id: string;
  name: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  roles: ('admin' | 'referrer')[];
}

export const NAV_ITEMS: NavigationItem[] = [
  { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'referrer'] },
  { id: 'users', name: 'Users', icon: Users, roles: ['admin'] },
  { id: 'leaderboard', name: 'Leaderboard', icon: Trophy, roles: ['admin', 'referrer'] },
  { id: 'clients', name: 'Clients', icon: UserCheck, roles: ['admin', 'referrer'] },
  { id: 'schedules', name: 'Schedules', icon: Calendar, roles: ['admin', 'referrer'] },
  { id: 'verification', name: 'User Verification', icon: ShieldCheck, roles: ['admin'] },
  { id: 'settings', name: 'Settings', icon: Settings, roles: ['admin', 'referrer'] },
];

interface SidebarProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  onTabChange, 
  isOpen = false, 
  onClose 
}) => {
  const { profile, signOut } = useAuth();
  const userRole = profile?.role || 'referrer';

  // Filter items based on user role
  const visibleNavItems = NAV_ITEMS.filter(item => item.roles.includes(userRole));

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      {/* Logo Area */}
      <div className="sidebar-header">
        <div className="logo-container">
          <div className="logo-icon-bg">
            <span className="logo-sparkle">✨</span>
          </div>
          <div className="logo-text">
            <span className="logo-title">VHBC</span>
            <span className="logo-subtitle">Sales Portal</span>
          </div>
        </div>
        {onClose && (
          <button className="mobile-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        )}
      </div>

      <div className="sidebar-divider" />

      {/* Navigation List */}
      <nav className="sidebar-nav">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => {
                onTabChange(item.id);
                if (onClose) onClose();
              }}
            >
              <Icon size={20} className="nav-icon" />
              <span className="nav-text">{item.name}</span>
            </button>
          );
        })}
      </nav>

      {/* Logout Area */}
      <div className="sidebar-footer">
        <button className="logout-btn" onClick={signOut}>
          <LogOut size={20} className="logout-icon" />
          <span className="logout-text">Log out</span>
        </button>
      </div>
    </aside>
  );
};
