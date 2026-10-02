import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, User as UserIcon } from 'lucide-react';
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
  initialMode = 'signin'
}) => {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();
  
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setEmail('');
    setPassword('');
    setName('');
    setMode(initialMode);
  }, [isOpen, initialMode]);

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
        case 'auth/user-not-found':
          return 'Invalid email or password. Please try again.';
        case 'auth/email-already-in-use':
          return 'An account already exists with this email. Please sign in instead.';
        case 'auth/weak-password':
          return 'Password must be at least 6 characters.';
        case 'auth/popup-closed-by-user':
          return 'Sign in popup was closed. Please try again.';
        case 'auth/user-disabled':
          return 'This account has been disabled.';
        case 'auth/network-request-failed':
          return 'Network error. Please check your internet connection.';
        default:
          return (error as { message?: string }).message || 'Authentication error. Please try again.';
      }
    }
    return 'An unexpected error occurred. Please try again.';
  };

  const handlePostAuthRouting = (userEmail?: string | null) => {
    const isOwnerUser = userEmail?.trim().toLowerCase() === OWNER_EMAIL.toLowerCase();
    
    if (isOwnerUser) {
      setSuccessMessage('Owner authenticated! Opening admin panel...');
      setTimeout(() => {
        onClose();
        if (!window.location.pathname.startsWith('/admin')) {
          window.history.pushState({}, '', '/admin');
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      }, 500);
    } else {
      setSuccessMessage('Signed in successfully! Welcome to The Shade Store.');
      setTimeout(() => {
        onClose();
        // Ensure customers remain strictly on customer storefront
        if (window.location.pathname.startsWith('/admin')) {
          window.history.replaceState({}, '', '/');
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      }, 500);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsGoogleLoading(true);

    try {
      const signedInUser = await signInWithGoogle();
      handlePostAuthRouting(signedInUser?.email || null);
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        setErrorMessage(formatFirebaseError(err));
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setErrorMessage('Please enter your email.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);

    try {
      let authedUser;
      if (mode === 'signup') {
        authedUser = await signUpWithEmail(trimmedEmail, password, name);
      } else {
        authedUser = await signInWithEmail(trimmedEmail, password);
      }
      handlePostAuthRouting(authedUser?.email || trimmedEmail);
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
              <UserIcon className="w-4 h-4 text-neutral-200" />
            </div>
            <div>
              <span className="font-serif text-xl font-semibold text-neutral-900 block leading-tight">
                {mode === 'signup' ? 'Create Account' : 'Welcome to The Shade Store'}
              </span>
              <p className="text-[11px] text-neutral-500">
                {mode === 'signup' ? 'Sign up for customer inquiries & updates' : 'Sign in to your account or store manager'}
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

          {/* Quick Google Sign In */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading || isLoading}
            className="w-full min-h-[44px] flex items-center justify-center gap-3 px-4 py-2.5 bg-white hover:bg-neutral-50 active:bg-neutral-100 border border-neutral-300 rounded-xl text-sm font-medium text-neutral-800 transition-colors shadow-2xs cursor-pointer disabled:opacity-50 mb-4"
          >
            {isGoogleLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-neutral-700" />
            ) : (
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>Continue with Google</span>
          </button>

          <div className="relative flex items-center justify-center my-4">
            <div className="border-t border-neutral-200 w-full" />
            <span className="bg-[#FAF9F6] px-3 text-[11px] uppercase tracking-wider text-neutral-400 font-medium shrink-0">
              or continue with email
            </span>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your Name"
                  className="w-full px-3.5 py-2.5 bg-white border border-neutral-300 rounded-xl text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 transition-colors"
                  disabled={isLoading}
                  autoComplete="name"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-neutral-800 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
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
                  placeholder={mode === 'signup' ? 'Create a password (min 6 chars)' : 'Enter your password'}
                  className="w-full px-3.5 py-2.5 pr-10 bg-white border border-neutral-300 rounded-xl text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 transition-colors"
                  disabled={isLoading}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  required
                  minLength={6}
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
              disabled={isLoading || isGoogleLoading}
              className="w-full min-h-[44px] mt-2 flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-950 text-white rounded-xl text-sm font-semibold transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin text-white" />}
              <span>{isLoading ? 'Signing in...' : mode === 'signup' ? 'Create Account' : 'Sign In'}</span>
            </button>
          </form>

          {/* Mode Switcher */}
          <div className="mt-4 pt-4 border-t border-neutral-200/70 text-center">
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className="text-xs text-neutral-600 hover:text-neutral-950 font-medium cursor-pointer"
            >
              {mode === 'signin' ? (
                <span>Need an account? <strong className="underline underline-offset-2">Create one</strong></span>
              ) : (
                <span>Already have an account? <strong className="underline underline-offset-2">Sign in</strong></span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

