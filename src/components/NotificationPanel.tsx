import React, { useState, useEffect } from 'react';
import { 
  X, 
  Calendar, 
  ShieldCheck, 
  RefreshCw, 
  CheckCircle2, 
  Bell,
  Inbox
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NotificationService } from '../services/notificationService';
import type { Notification } from '../services/notificationService';

interface NotificationPanelProps {
  onClose: () => void;
  onRefreshCount: () => void;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({ 
  onClose,
  onRefreshCount
}) => {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadNotifications = async () => {
    setIsLoading(true);
    const data = await NotificationService.getNotifications();
    setNotifications(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleMarkAsRead = async (id: string, isRead: boolean) => {
    if (isRead) return;
    await NotificationService.markAsRead(id);
    onRefreshCount();
    // Update local state directly to be fast, or reload
    setNotifications(prev => 
      prev.map(note => note.id === id ? { ...note, is_read: true } : note)
    );
  };

  const handleMarkAllAsRead = async () => {
    if (!profile) return;
    await NotificationService.markAllAsRead(profile.id);
    onRefreshCount();
    setNotifications(prev => prev.map(note => ({ ...note, is_read: true })));
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'new_request':
        return Calendar;
      case 'verification_update':
        return ShieldCheck;
      case 'status_change':
        return RefreshCw;
      case 'schedule_approved':
        return CheckCircle2;
      default:
        return Bell;
    }
  };

  const getTypeClass = (type: string) => {
    switch (type) {
      case 'new_request':
        return 'type-request';
      case 'verification_update':
        return 'type-verification';
      case 'status_change':
        return 'type-status';
      case 'schedule_approved':
        return 'type-approved';
      default:
        return 'type-default';
    }
  };

  const formatTime = (timestamp?: string) => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return date.toLocaleDateString();
    } catch {
      return timestamp;
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <>
      {/* Backdrop to close click */}
      <div className="notification-panel-backdrop" onClick={onClose} />
      
      {/* Panel Drawer */}
      <div className="notification-panel">
        <div className="notification-panel-header">
          <div className="flex-align-center gap-2">
            <h2>Notifications</h2>
            {unreadCount > 0 && (
              <span className="notification-unread-count">
                {unreadCount} new
              </span>
            )}
          </div>
          <button className="panel-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="notification-list-container">
          {isLoading ? (
            <div className="panel-center">
              <div className="spinner" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="panel-center empty">
              <Inbox size={48} className="empty-icon" />
              <p>No notifications yet</p>
            </div>
          ) : (
            <div className="notification-list">
              {notifications.map((note) => {
                const Icon = getTypeIcon(note.type);
                const isUnread = !note.is_read;

                return (
                  <div 
                    key={note.id} 
                    className={`notification-item ${isUnread ? 'unread' : ''}`}
                    onClick={() => handleMarkAsRead(note.id, note.is_read)}
                  >
                    <div className={`notification-icon-bg ${getTypeClass(note.type)}`}>
                      <Icon size={18} />
                    </div>
                    <div className="notification-content">
                      <span className="notification-title">{note.title}</span>
                      <p className="notification-message">{note.message}</p>
                      <span className="notification-time">{formatTime(note.created_at)}</span>
                    </div>
                    {isUnread && <div className="unread-dot" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {notifications.length > 0 && unreadCount > 0 && (
          <div className="notification-panel-footer">
            <button className="mark-all-read-btn" onClick={handleMarkAllAsRead}>
              Mark all as read
            </button>
          </div>
        )}
      </div>
    </>
  );
};
