import React, { useState } from 'react';
import apiClient from '../utils/axiosConfig';
import './LoginModal.css';

function LoginModal({ onClose, onLogin }) {
  const [step, setStep] = useState('role'); // 'role', 'auth'
  const [isLogin, setIsLogin] = useState(true);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    adminSecret: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, text: '', color: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // OTP state
  const [otpMode, setOtpMode] = useState(false);
  const [otpStep, setOtpStep] = useState('email'); // 'email', 'verify'
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpMessage, setOtpMessage] = useState('');
  const [otpCountdown, setOtpCountdown] = useState(0);

  // Registration OTP verification state
  const [regVerifyStep, setRegVerifyStep] = useState(false);
  const [regVerifyEmail, setRegVerifyEmail] = useState('');
  const [regOtpCode, setRegOtpCode] = useState('');
  const [regOtpLoading, setRegOtpLoading] = useState(false);
  const [regOtpMessage, setRegOtpMessage] = useState('');
  const [regOtpCountdown, setRegOtpCountdown] = useState(0);

  const calculatePasswordStrength = (password) => {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
    if (score <= 2) return { score: 1, text: 'Weak', color: '#ef4444' };
    if (score <= 4) return { score: 2, text: 'Fair', color: '#f59e0b' };
    if (score <= 5) return { score: 3, text: 'Good', color: '#10b981' };
    return { score: 4, text: 'Strong', color: '#059669' };
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
    if (name === 'password' && !isLogin) {
      setPasswordStrength(calculatePasswordStrength(value));
    }
  };

  const selectRole = (admin) => {
    setIsAdminMode(admin);
    setStep('auth');
    setError('');
    setOtpMode(false);
    setOtpStep('email');
    setOtpEmail('');
    setOtpCode('');
  };

  const goBackToRole = () => {
    setStep('role');
    setError('');
    setOtpMode(false);
    setOtpStep('email');
    setOtpEmail('');
    setOtpCode('');
    setFormData({ name: '', email: '', password: '', confirmPassword: '', adminSecret: '' });
  };

  // OTP handlers
  const startOtpCountdown = () => {
    setOtpCountdown(60);
    const timer = setInterval(() => {
      setOtpCountdown(prev => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async () => {
    if (!otpEmail || !otpEmail.includes('@')) {
      setError('Please enter a valid email');
      return;
    }
    setOtpLoading(true);
    setError('');
    setOtpMessage('');
    try {
      await apiClient.post('/auth/send-otp', { email: otpEmail, purpose: 'login' });
      setOtpStep('verify');
      setOtpMessage('OTP sent to your email!');
      startOtpCountdown();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (otpCountdown > 0) return;
    await handleSendOtp();
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length !== 6) {
      setError('Please enter the 6-digit OTP');
      return;
    }
    setOtpLoading(true);
    setError('');
    try {
      const res = await apiClient.post('/auth/verify-otp', {
        email: otpEmail,
        code: otpCode,
        purpose: 'login'
      });
      if (res.data.accessToken) {
        localStorage.setItem('accessToken', res.data.accessToken);
        localStorage.setItem('refreshToken', res.data.refreshToken);
        onLogin({
          name: res.data.user.name,
          email: res.data.user.email,
          id: res.data.user.id,
          role: res.data.user.role || 'user'
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setOtpLoading(false);
    }
  };

  // Registration OTP verification handlers
  const startRegOtpCountdown = () => {
    setRegOtpCountdown(60);
    const timer = setInterval(() => {
      setRegOtpCountdown(prev => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleRegResendOtp = async () => {
    if (regOtpCountdown > 0) return;
    setRegOtpLoading(true);
    setError('');
    try {
      await apiClient.post('/auth/send-otp', { email: regVerifyEmail, purpose: 'register' });
      setRegOtpMessage('New verification code sent!');
      startRegOtpCountdown();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend code');
    } finally {
      setRegOtpLoading(false);
    }
  };

  const handleRegVerifyOtp = async () => {
    if (!regOtpCode || regOtpCode.length !== 6) {
      setError('Please enter the 6-digit verification code');
      return;
    }
    setRegOtpLoading(true);
    setError('');
    try {
      const res = await apiClient.post('/auth/verify-otp', {
        email: regVerifyEmail,
        code: regOtpCode,
        purpose: 'register'
      });
      if (res.data.accessToken) {
        localStorage.setItem('accessToken', res.data.accessToken);
        localStorage.setItem('refreshToken', res.data.refreshToken);
        onLogin({
          name: res.data.user.name,
          email: res.data.user.email,
          id: res.data.user.id,
          role: res.data.user.role || 'user'
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed');
    } finally {
      setRegOtpLoading(false);
    }
  };

  const validateForm = () => {
    if (!formData.email || !formData.password) {
      setError('Please fill in all fields');
      return false;
    }
    if (!formData.email.includes('@')) {
      setError('Please enter a valid email');
      return false;
    }
    if (!isLogin) {
      if (!formData.name.trim() || formData.name.trim().length < 2 || formData.name.trim().length > 50) {
        setError('Name must be between 2 and 50 characters');
        return false;
      }
      if (formData.password.length < 8) { setError('Password must be at least 8 characters'); return false; }
      if (!/[A-Z]/.test(formData.password)) { setError('Password needs an uppercase letter'); return false; }
      if (!/[a-z]/.test(formData.password)) { setError('Password needs a lowercase letter'); return false; }
      if (!/[0-9]/.test(formData.password)) { setError('Password needs a number'); return false; }
      if (!/[!@#$%^&*(),.?":{}|<>]/.test(formData.password)) { setError('Password needs a special character'); return false; }
      if (formData.password !== formData.confirmPassword) { setError('Passwords do not match'); return false; }
    }
    if (isAdminMode && !formData.adminSecret) {
      setError('Admin secret key is required');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        const payload = { email: formData.email, password: formData.password };
        if (isAdminMode) payload.adminSecret = formData.adminSecret;
        const response = await apiClient.post('/auth/login', payload);

        // Check if email verification is required
        if (response.data.requiresVerification) {
          setRegVerifyEmail(response.data.email);
          setRegVerifyStep(true);
          setRegOtpMessage('Please verify your email to continue.');
          startRegOtpCountdown();
          setLoading(false);
          return;
        }

        localStorage.setItem('accessToken', response.data.accessToken);
        localStorage.setItem('refreshToken', response.data.refreshToken);
        onLogin({
          name: response.data.user.name,
          email: response.data.user.email,
          id: response.data.user.id,
          role: response.data.user.role || 'user'
        });
      } else if (isAdminMode) {
        const response = await apiClient.post('/auth/admin/register', {
          name: formData.name, email: formData.email,
          password: formData.password, adminSecret: formData.adminSecret
        });
        localStorage.setItem('accessToken', response.data.accessToken);
        localStorage.setItem('refreshToken', response.data.refreshToken);
        onLogin({
          name: response.data.user.name, email: response.data.user.email,
          id: response.data.user.id, role: response.data.user.role || 'admin'
        });
      } else {
        const response = await apiClient.post('/auth/register', {
          name: formData.name, email: formData.email, password: formData.password
        });
        
        // Registration now requires email verification
        if (response.data.requiresVerification) {
          setRegVerifyEmail(response.data.email);
          setRegVerifyStep(true);
          setRegOtpMessage('A verification code has been sent to your email.');
          startRegOtpCountdown();
          setLoading(false);
          return;
        }

        localStorage.setItem('accessToken', response.data.accessToken);
        localStorage.setItem('refreshToken', response.data.refreshToken);
        onLogin({
          name: response.data.user.name, email: response.data.user.email,
          id: response.data.user.id, role: response.data.user.role || 'user'
        });
      }
    } catch (err) {
      // Handle requiresVerification from 403 error (login with unverified email)
      if (err.response?.data?.requiresVerification) {
        setRegVerifyEmail(err.response.data.email);
        setRegVerifyStep(true);
        setRegOtpMessage(err.response.data.message);
        startRegOtpCountdown();
        setLoading(false);
        return;
      }
      if (err.response?.status === 429) setError('Too many attempts. Please try again in 15 minutes.');
      else if (err.response?.data?.errors) setError(err.response.data.errors.map(e => e.msg).join('. '));
      else if (err.response?.data?.message) setError(err.response.data.message);
      else if (err.message) setError(`Connection error: ${err.message}`);
      else setError(isLogin ? 'Login failed. Check your credentials.' : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Role Selection
  if (step === 'role') {
    return (
      <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal-content role-select-modal">
          <button className="modal-close" onClick={onClose}>✕</button>

          <div className="modal-brand">
            <div className="brand-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg></div>
            <h1>DengueSpot</h1>
            <p>Community Dengue Prevention Platform</p>
          </div>

          <div className="role-prompt">Choose how you'd like to continue</div>

          <div className="role-cards">
            <button className="role-card user-card" onClick={() => selectRole(false)}>
              <div className="role-card-glow user-glow"></div>
              <div className="role-card-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
              <h3>User</h3>
              <p>Report hotspots, track dengue activity, access AI assistant</p>
              <div className="role-card-arrow">→</div>
            </button>

            <button className="role-card admin-card" onClick={() => selectRole(true)}>
              <div className="role-card-glow admin-glow"></div>
              <div className="role-card-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
              <h3>Admin</h3>
              <p>Manage hotspots, approve reports, oversee users & analytics</p>
              <div className="role-card-arrow">→</div>
            </button>
          </div>

          <div className="modal-footer-text">
            Help prevent dengue in your community
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Login / Register Form
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal-content auth-modal ${isAdminMode ? 'admin-mode' : 'user-mode'}`}>
        <button className="modal-close" onClick={onClose}>✕</button>

        {/* Back Button */}
        <button className="back-btn" onClick={goBackToRole}>
          ← Back
        </button>

        {/* Header */}
        <div className="auth-header">
          <div className={`auth-icon ${isAdminMode ? 'admin' : 'user'}`}>
            {isAdminMode ? <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> : <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
          </div>
          <h2>{isAdminMode ? 'Admin Access' : 'Welcome'}</h2>
          <p>{isAdminMode ? 'Requires admin secret key' : 'Login or create an account'}</p>
        </div>

        {/* Tabs */}
        <div className="auth-tabs">
          <button
            className={`auth-tab ${isLogin && !otpMode ? 'active' : ''}`}
            onClick={() => { setIsLogin(true); setOtpMode(false); setError(''); }}
          >
            <span className="tab-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></span> Login
          </button>
          {!isAdminMode && (
            <button
              className={`auth-tab ${otpMode ? 'active' : ''}`}
              onClick={() => { setOtpMode(true); setIsLogin(true); setError(''); setOtpStep('email'); }}
            >
              <span className="tab-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></span> OTP Login
            </button>
          )}
          <button
            className={`auth-tab ${!isLogin && !otpMode ? 'active' : ''}`}
            onClick={() => { setIsLogin(false); setOtpMode(false); setError(''); }}
          >
            <span className="tab-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg></span> Register
          </button>
        </div>

        {/* Registration Email Verification OTP Step */}
        {regVerifyStep ? (
          <div className="auth-form otp-form">
            {regOtpMessage && <div className="otp-success">{regOtpMessage}</div>}
            <p className="otp-desc">Enter the 6-digit code sent to <strong>{regVerifyEmail}</strong></p>
            <div className="field">
              <label>Verification Code</label>
              <div className="field-input otp-input-wrap">
                <span className="field-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></span>
                <input
                  type="text"
                  placeholder="000000"
                  value={regOtpCode}
                  onChange={e => { setRegOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                  maxLength={6}
                  className="otp-code-input"
                  autoFocus
                />
              </div>
            </div>

            {error && (
              <div className="auth-error">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                <span>{error}</span>
              </div>
            )}

            <button className="auth-submit" onClick={handleRegVerifyOtp} disabled={regOtpLoading}>
              {regOtpLoading ? <span className="spinner"></span> : 'Verify Email & Complete'}
            </button>

            <div className="otp-actions">
              <button type="button" className="otp-resend" onClick={handleRegResendOtp} disabled={regOtpCountdown > 0}>
                {regOtpCountdown > 0 ? `Resend in ${regOtpCountdown}s` : 'Resend Code'}
              </button>
              <button type="button" className="otp-change-email" onClick={() => { setRegVerifyStep(false); setRegOtpCode(''); setError(''); }}>
                Back to form
              </button>
            </div>
          </div>
        ) : otpMode ? (
          <div className="auth-form otp-form">
            {otpStep === 'email' ? (
              <>
                <p className="otp-desc">We'll send a 6-digit code to your email for passwordless login.</p>
                <div className="field">
                  <label>Email</label>
                  <div className="field-input">
                    <span className="field-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></span>
                    <input type="email" placeholder="your@email.com" value={otpEmail} onChange={e => { setOtpEmail(e.target.value); setError(''); }} autoComplete="email" />
                  </div>
                </div>

                {error && (
                  <div className="auth-error">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                    <span>{error}</span>
                  </div>
                )}

                <button className="auth-submit" onClick={handleSendOtp} disabled={otpLoading}>
                  {otpLoading ? <span className="spinner"></span> : 'Send OTP Code'}
                </button>
              </>
            ) : (
              <>
                {otpMessage && <div className="otp-success">{otpMessage}</div>}
                <p className="otp-desc">Enter the 6-digit code sent to <strong>{otpEmail}</strong></p>
                <div className="field">
                  <label>OTP Code</label>
                  <div className="field-input otp-input-wrap">
                    <span className="field-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></span>
                    <input
                      type="text"
                      placeholder="000000"
                      value={otpCode}
                      onChange={e => { setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                      maxLength={6}
                      className="otp-code-input"
                      autoFocus
                    />
                  </div>
                </div>

                {error && (
                  <div className="auth-error">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                    <span>{error}</span>
                  </div>
                )}

                <button className="auth-submit" onClick={handleVerifyOtp} disabled={otpLoading}>
                  {otpLoading ? <span className="spinner"></span> : 'Verify & Login'}
                </button>

                <div className="otp-actions">
                  <button type="button" className="otp-resend" onClick={handleResendOtp} disabled={otpCountdown > 0}>
                    {otpCountdown > 0 ? `Resend in ${otpCountdown}s` : 'Resend OTP'}
                  </button>
                  <button type="button" className="otp-change-email" onClick={() => { setOtpStep('email'); setOtpCode(''); setError(''); }}>
                    Change email
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <div className="field">
              <label>Full Name</label>
              <div className="field-input">
                <span className="field-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>
                <input type="text" name="name" placeholder="Your full name" value={formData.name} onChange={handleChange} autoComplete="name" />
              </div>
            </div>
          )}

          <div className="field">
            <label>Email</label>
            <div className="field-input">
              <span className="field-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></span>
              <input type="email" name="email" placeholder="your@email.com" value={formData.email} onChange={handleChange} autoComplete="email" />
            </div>
          </div>

          <div className="field">
            <label>Password</label>
            <div className="field-input">
              <span className="field-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></span>
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                placeholder="Enter password"
                value={formData.password}
                onChange={handleChange}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
              />
              <button type="button" className="toggle-pw" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
              </button>
            </div>
            {!isLogin && formData.password && (
              <div className="pw-strength">
                <div className="pw-bar">
                  <div className="pw-fill" style={{ width: `${(passwordStrength.score / 4) * 100}%`, backgroundColor: passwordStrength.color }} />
                </div>
                <span style={{ color: passwordStrength.color }}>{passwordStrength.text}</span>
              </div>
            )}
            {!isLogin && (
              <div className="pw-hint">8+ chars, uppercase, lowercase, number, special char</div>
            )}
          </div>

          {!isLogin && (
            <div className="field">
              <label>Confirm Password</label>
              <div className="field-input">
                <span className="field-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></span>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  placeholder="Confirm password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  autoComplete="new-password"
                />
                <button type="button" className="toggle-pw" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                  {showConfirmPassword ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                </button>
              </div>
            </div>
          )}

          {isAdminMode && (
            <div className="field admin-secret-field">
              <label>Admin Secret Key</label>
              <div className="field-input admin-input">
                <span className="field-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg></span>
                <input type="password" name="adminSecret" placeholder="Enter admin secret" value={formData.adminSecret} onChange={handleChange} />
              </div>
              <div className="admin-hint">Contact system administrator for this key</div>
            </div>
          )}

          {error && (
            <div className="auth-error">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              <span>{error}</span>
            </div>
          )
          }

          <button type="submit" className={`auth-submit ${isAdminMode ? 'admin' : ''}`} disabled={loading}>
            {loading ? (
              <span className="spinner"></span>
            ) : (
              isLogin ? 'Sign In' : 'Create Account'
            )}
          </button>
        </form>
        )}

        {!isAdminMode && !otpMode && !regVerifyStep && (
          <div className="oauth-section">
            <div className="oauth-divider">
              <span>or continue with</span>
            </div>
            <button
              className="google-btn"
              onClick={() => { window.location.href = '/api/oauth/google'; }}
              type="button"
            >
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              <span>Google</span>
            </button>
          </div>
        )}

        <div className="auth-footer">
          <div className="footer-line"></div>
          <span>DengueSpot &bull; Fight Dengue Together</span>
        </div>
      </div>
    </div>
  );
}

export default LoginModal;
