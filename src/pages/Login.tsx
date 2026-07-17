import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, LockOpen } from 'lucide-react';
import { supabase } from '../core/supabase';
import { useAuth } from '../context/AuthContext';

interface LoginProps {
  onRegisterClick: () => void;
}

export const Login: React.FC<LoginProps> = ({ onRegisterClick }) => {
  const { refreshProfile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (!email || !password) {
        throw new Error('Please enter both email and password.');
      }

      // 1. Sign in with password
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) throw error;
      if (!data.user) throw new Error('Authentication failed.');

      // 2. Fetch user profile
      const { data: userData, error: userError } = await supabase
        .from('app_users')
        .select('verification_status, role')
        .eq('id', data.user.id)
        .maybeSingle();

      if (userError) throw userError;

      const role = userData?.role || data.user.user_metadata?.role;

      // 3. Authorization Check — only admins are allowed into this portal
      if (role === 'admin') {
        // Allow Admins through
      } else {
        await supabase.auth.signOut();
        if (role === 'referrer') {
          // Show message but do not navigate anywhere
          setErrorMessage('Access denied. This portal is for administrators only.');
          return;
        }
        throw new Error('Access denied. Invalid user role.');
      }

      // Refresh Auth Context state
      await refreshProfile();
    } catch (err: any) {
      console.error('Sign-in error:', err);
      setErrorMessage(err.message || 'An unexpected error occurred during login.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card">
        {/* Logo Header */}
        <div className="auth-logo-section">
          <div className="auth-icon-wrapper">
            <LockOpen size={36} />
          </div>
          <h2>Welcome Back</h2>
          <p>Sign in to continue to VHBC Sales Portal</p>
        </div>

        {/* Error SnackBar banner */}
        {errorMessage && (
          <div className="auth-error-banner">
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <div className="input-with-icon">
              <Mail className="input-icon" size={18} />
              <input
                id="email"
                type="email"
                className="form-control"
                placeholder="example@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="input-with-icon">
              <Lock className="input-icon" size={18} />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="form-control"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="forgot-password-link">
            <button type="button" onClick={() => {}}>Forgot Password?</button>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full mt-4 auth-submit-btn"
            disabled={isLoading}
          >
            {isLoading ? <div className="spinner-btn" /> : 'Sign In'}
          </button>
        </form>

        <div className="auth-footer">
          <span>Don't have an account? </span>
          <button type="button" onClick={onRegisterClick}>Sign Up</button>
        </div>
      </div>
    </div>
  );
};
