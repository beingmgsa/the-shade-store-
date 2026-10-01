import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const OWNER_EMAIL = 'beingmagrajwork@gmail.com';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({ 
  isOpen, 
  onClose, 
}) => {
  const { signInWithEmail } = useAuth();
  
  const [email, setEmail] = useState(OWNER_EMAIL);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setEmail(OWNER_EMAIL);
    setPassword('');
  }, [isOpen]);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formatFirebaseError = (error: unknown): string => {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const code = (error as { code: string }).code;
      switch (code) {
        case 'auth/invalid-email':
          return 'Please enter a valid email address.';
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          return 'Incorrect email or password. Please verify your credentials.';
        case 'auth/user-disabled':
          return 'This owner account has been disabled.';
        case 'auth/network-request-failed':
          return 'Network error. Please check your internet connection and try again.';
        default:
          return (error as { message?: string }).message || 'Authentication error. Please try again.';
      }
    }
    return 'An unexpected error occurred. Please try again.';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (trimmedEmail !== OWNER_EMAIL.toLowerCase()) {
      setErrorMessage(`Access Restricted: Only the verified owner (${OWNER_EMAIL}) may sign in.`);
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your admin password.');
      return;
    }

    setIsLoading(true);

    try {
      await signInWithEmail(trimmedEmail, password);
      setSuccessMessage('Owner authenticated successfully! Accessing portal...');
      setTimeout(() => {
        onClose();
        // Redirect to admin panel
        if (!window.location.pathname.startsWith('/admin')) {
          window.history.pushState({}, '', '/admin');
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      }, 700);
    } catch (err) {
      setErrorMessage(formatFirebaseError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="relative w-full max-w-md bg-[#FAF9F6] rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-neutral-200/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <span className="font-serif text-xl font-semibold text-neutral-900 block leading-tight">
                Store Owner Sign In
              </span>
              <p className="text-[11px] text-neutral-500">
                The Shade Store · Admin Portal
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-900 hover:bg-neutral-200/60 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {/* Feedback Alerts */}
          {errorMessage && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200/80 flex items-start gap-2.5 text-xs text-red-700 leading-relaxed">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200/80 flex items-start gap-2.5 text-xs text-emerald-800 leading-relaxed">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>{successMessage}</span>
              </div>
            </div>
          )}

          <div className="mb-4 p-3 bg-neutral-100/70 rounded-xl border border-neutral-200/70 text-xs text-neutral-600">
            <p className="font-medium text-neutral-900 mb-0.5">Admin Security Policy</p>
            <p className="text-[11px] leading-relaxed">
              Public user registration is disabled. Only the designated store owner email is authorized to access catalog management.
            </p>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-neutral-800 mb-1">
                Owner Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="beingmagrajwork@gmail.com"
                className="w-full px-3.5 py-2.5 bg-white border border-neutral-300 rounded-xl text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 transition-colors"
                disabled={isLoading}
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-800 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your Firebase owner password"
                  className="w-full px-3.5 py-2.5 pr-10 bg-white border border-neutral-300 rounded-xl text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 transition-colors"
                  disabled={isLoading}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 p-1 cursor-pointer"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full min-h-[44px] mt-2 flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-950 text-white rounded-xl text-sm font-semibold transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin text-white" />}
              <span>{isLoading ? 'Verifying...' : 'Sign In to Admin Panel'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
