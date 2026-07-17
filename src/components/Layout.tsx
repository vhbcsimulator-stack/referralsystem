import React, { useState, useEffect } from 'react';
import { Menu, Bell } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { NotificationPanel } from './NotificationPanel';
import { useAuth } from '../context/AuthContext';
import { NotificationService } from '../services/notificationService';

interface LayoutProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ 
  activeTab, 
  onTabChange, 
  children 
}) => {
  const { profile } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = async () => {
    if (!profile) return;
    const notifications = await NotificationService.getNotifications();
    const count = notifications.filter(n => !n.is_read).length;
    setUnreadCount(count);
  };

  useEffect(() => {
    if (!profile) return;

    fetchUnreadCount();

    // Subscribe to notifications changes
    const unsubscribe = NotificationService.subscribeToNotifications(
      profile.id,
      () => {
        fetchUnreadCount();
      }
    );

    return () => {
      unsubscribe();
    };
  }, [profile]);

  return (
    <div className="app-container">
      {/* Sidebar for Desktop & Mobile */}
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={onTabChange} 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="main-content-wrapper">
        {/* AppBar / Top Header */}
        <header className="app-bar">
          <button 
            className="mobile-menu-btn" 
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu size={24} />
          </button>

          <div className="app-bar-actions">
            {/* Notification Bell */}
            <button 
              className={`notification-bell-btn ${unreadCount > 0 ? 'has-unread' : ''}`}
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Bell size={22} />
              {unreadCount > 0 && (
                <span className="unread-badge">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            
            {/* User Profile Summary */}
            <div className="topbar-profile">
              <div className="profile-avatar">
                {profile?.full_name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'U'}
              </div>
              <div className="profile-info-text">
                <span className="profile-name">{profile?.full_name || 'User'}</span>
                <span className="profile-role">{profile?.role === 'admin' ? 'Admin' : 'Referrer'}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Active view child content */}
        <main className="main-content-view">
          {children}
        </main>
      </div>

      {/* Notification Sliding Drawer Overlay */}
      {showNotifications && (
        <NotificationPanel 
          onClose={() => setShowNotifications(false)} 
          onRefreshCount={fetchUnreadCount}
        />
      )}
      
      {/* Mobile Sidebar backdrop */}
      {isSidebarOpen && (
        <div 
          className="sidebar-backdrop" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
};
