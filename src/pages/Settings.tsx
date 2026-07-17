import React, { useState } from 'react';
import { 
  Bell, 
  Info,
  CheckCircle2,
  AlertCircle,
  Mail
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../core/supabase';

export const Settings: React.FC = () => {
  const { profile, refreshProfile } = useAuth();

  // Profile Form States
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Password Form States
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Preference Toggles
  const [pushNotifications, setPushNotifications] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!fullName.trim()) {
      setProfileMessage({ text: 'Display name cannot be empty.', isError: true });
      return;
    }

    setIsSavingProfile(true);
    setProfileMessage(null);

    try {
      // 1. Update public.app_users table
      const { error: dbErr } = await supabase
        .from('app_users')
        .update({ full_name: fullName.trim() })
        .eq('id', profile.id);

      if (dbErr) throw dbErr;

      // 2. Update auth metadata
      const { error: authErr } = await supabase.auth.updateUser({
        data: { full_name: fullName.trim() }
      });

      if (authErr) throw authErr;

      await refreshProfile();
      setProfileMessage({ text: 'Profile updated successfully!', isError: false });
    } catch (err: any) {
      console.error('Error saving profile:', err);
      setProfileMessage({ text: err.message || 'Failed to update profile.', isError: true });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setPasswordMessage({ text: 'Password must be at least 8 characters.', isError: true });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ text: 'Passwords do not match.', isError: true });
      return;
    }

    setIsSavingPassword(true);
    setPasswordMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage({ text: 'Password updated successfully!', isError: false });
    } catch (err: any) {
      console.error('Error saving password:', err);
      setPasswordMessage({ text: err.message || 'Failed to update password.', isError: true });
    } finally {
      setIsSavingPassword(false);
    }
  };

  const getInitials = () => {
    return profile?.full_name
      ?.split(' ')
      .map(w => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U';
  };

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

  return (
    <div className="main-view-container fade-in">
      {/* Title Header */}
      <div className="view-header-row">
        <div>
          <h1>Settings</h1>
          <p className="subtitle">Manage your account credentials and preferences</p>
        </div>
      </div>

      <div className="settings-page-content mt-4">
        {/* Profile Card */}
        <div className="settings-section">
          <span className="settings-section-label">ACCOUNT SETTINGS</span>
          
          <div className="premium-card mt-2">
            <div className="profile-details-hero">
              <div className="settings-avatar-circle">
                {getInitials()}
              </div>
              <div className="profile-hero-info">
                <h3>{profile?.full_name || 'User'}</h3>
                <span className="profile-hero-badge">
                  {profile?.role === 'admin' ? 'Administrator' : 'Referrer'}
                </span>
                <p className="profile-hero-meta">Member since {memberSince}</p>
              </div>
            </div>

            <div className="sidebar-divider m-0 mt-6" style={{ margin: '24px 0' }} />

            <form onSubmit={handleSaveProfile} className="settings-form">
              {profileMessage && (
                <div className={`settings-status-banner ${profileMessage.isError ? 'error' : 'success'}`}>
                  {profileMessage.isError ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
                  <span>{profileMessage.text}</span>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="settingsEmail">Email Address (Read-only)</label>
                <input
                  id="settingsEmail"
                  type="email"
                  className="form-control"
                  value={profile?.email || ''}
                  disabled
                  style={{ background: '#F4F7FE', cursor: 'not-allowed', borderStyle: 'dashed' }}
                />
              </div>

              <div className="form-group">
                <label htmlFor="settingsName">Display Name</label>
                <input
                  id="settingsName"
                  type="text"
                  className="form-control"
                  placeholder="Your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={isSavingProfile}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSavingProfile}
              >
                {isSavingProfile ? <div className="spinner-btn" /> : 'Save Profile'}
              </button>
            </form>
          </div>
        </div>

        {/* Security Password Card */}
        <div className="settings-section mt-6">
          <span className="settings-section-label">SECURITY</span>
          
          <div className="premium-card mt-2">
            <form onSubmit={handleSavePassword} className="settings-form">
              {passwordMessage && (
                <div className={`settings-status-banner ${passwordMessage.isError ? 'error' : 'success'}`}>
                  {passwordMessage.isError ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
                  <span>{passwordMessage.text}</span>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="settingsPassword">New Password</label>
                <input
                  id="settingsPassword"
                  type="password"
                  className="form-control"
                  placeholder="Min. 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isSavingPassword}
                />
              </div>

              <div className="form-group">
                <label htmlFor="settingsConfirmPassword">Confirm New Password</label>
                <input
                  id="settingsConfirmPassword"
                  type="password"
                  className="form-control"
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isSavingPassword}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSavingPassword}
              >
                {isSavingPassword ? <div className="spinner-btn" /> : 'Update Password'}
              </button>
            </form>
          </div>
        </div>

        {/* Preferences Toggle Card */}
        <div className="settings-section mt-6">
          <span className="settings-section-label">PREFERENCES</span>
          
          <div className="premium-card mt-2">
            <div className="preferences-list">
              <div className="preference-item flex-between">
                <div className="pref-details">
                  <span className="pref-title flex-align-center gap-1"><Bell size={16} /> Push Notifications</span>
                  <p className="pref-desc">Receive real-time alerts inside the dashboard</p>
                </div>
                <input
                  type="checkbox"
                  className="pref-toggle-checkbox"
                  checked={pushNotifications}
                  onChange={(e) => setPushNotifications(e.target.checked)}
                />
              </div>

              <div className="sidebar-divider" style={{ margin: '18px 0' }} />

              <div className="preference-item flex-between">
                <div className="pref-details">
                  <span className="pref-title flex-align-center gap-1"><Mail size={16} /> Email Alerts</span>
                  <p className="pref-desc">Receive scheduled newsletters and status updates via email</p>
                </div>
                <input
                  type="checkbox"
                  className="pref-toggle-checkbox"
                  checked={emailAlerts}
                  onChange={(e) => setEmailAlerts(e.target.checked)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* About App Card */}
        <div className="settings-section mt-6">
          <span className="settings-section-label">ABOUT</span>
          
          <div className="premium-card mt-2">
            <div className="about-card-content flex-align-center gap-4">
              <div className="about-app-icon">
                <Info size={24} />
              </div>
              <div>
                <h3>VHBC Sales Portal</h3>
                <p className="about-version">Version 0.1.0 (React SPA)</p>
                <p className="pref-desc mt-1">
                  A high-fidelity client referral portal integrating Supabase real-time notifications, schedules verification, and agent pipelines.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
