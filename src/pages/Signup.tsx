import React, { useState } from 'react';
import { User, Mail, Phone, Lock, Eye, EyeOff, UserPlus } from 'lucide-react';
import { supabase } from '../core/supabase';

interface SignupProps {
  onLoginClick: () => void;
}

export const Signup: React.FC<SignupProps> = ({ onLoginClick }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (!fullName || !email || !password || !confirmPassword) {
        throw new Error('Please fill in all required fields.');
      }

      if (password !== confirmPassword) {
        throw new Error('Passwords do not match.');
      }

      if (password.length < 8) {
        throw new Error('Password must be at least 8 characters long.');
      }

      // Sign up using Supabase Client
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          data: {
            full_name: fullName.trim(),
            mobile_number: mobileNumber.trim(),
            id_card_url: '', // Empty initially, can be updated later
          }
        }
      });

      if (error) throw error;

      setSuccessMessage('Registration successful! Please sign in to continue.');
      
      // Auto transition to Login after 2 seconds
      setTimeout(() => {
        onLoginClick();
      }, 2000);
    } catch (err: any) {
      console.error('Sign-up error:', err);
      setErrorMessage(err.message || 'An unexpected error occurred during registration.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card">
        {/* Logo Header */}
        <div className="auth-logo-section">
          <div className="auth-icon-wrapper signup">
            <UserPlus size={36} />
          </div>
          <h2>Create Account</h2>
          <p>Join VHBC Sales Portal today</p>
        </div>

        {/* Status Banners */}
        {errorMessage && (
          <div className="auth-error-banner">
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="auth-success-banner">
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="fullName">Full Name *</label>
            <div className="input-with-icon">
              <User className="input-icon" size={18} />
              <input
                id="fullName"
                type="text"
                className="form-control"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address *</label>
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
            <label htmlFor="mobile">Mobile Number (Optional)</label>
            <div className="input-with-icon">
              <Phone className="input-icon" size={18} />
              <input
                id="mobile"
                type="tel"
                className="form-control"
                placeholder="0917XXXXXXX"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password *</label>
            <div className="input-with-icon">
              <Lock className="input-icon" size={18} />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="form-control"
                placeholder="Min. 8 characters"
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

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password *</label>
            <div className="input-with-icon">
              <Lock className="input-icon" size={18} />
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                className="form-control"
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={isLoading}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-gradient w-full mt-4 auth-submit-btn"
            disabled={isLoading}
          >
            {isLoading ? <div className="spinner-btn" /> : 'Sign Up'}
          </button>
        </form>

        <div className="auth-footer">
          <span>Already have an account? </span>
          <button type="button" onClick={onLoginClick}>Sign In</button>
        </div>
      </div>
    </div>
  );
};
