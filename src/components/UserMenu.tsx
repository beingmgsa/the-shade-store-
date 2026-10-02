import React, { useState, useRef, useEffect } from 'react';
import { User as UserIcon, LogOut, Check, ChevronDown, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const OWNER_EMAIL = 'beingmagrajwork@gmail.com';

interface UserMenuProps {
  onOpenAuth: (mode?: 'signin' | 'signup') => void;
  onOpenAdmin?: () => void;
}

export const UserMenu: React.FC<UserMenuProps> = ({ onOpenAuth, onOpenAdmin }) => {
  const { user, logout, loading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading) {
    return (
      <div className="w-8 h-8 rounded-full bg-neutral-200 animate-pulse" />
    );
  }

  if (!user) {
    return null;
  }

  // Check if current logged-in user is the store owner
  const isOwner = user.email?.toLowerCase().trim() === OWNER_EMAIL.toLowerCase();

  // Get user display initial or name
  const displayName = isOwner ? 'Store Owner' : (user.displayName || user.email?.split('@')[0] || 'User');
  const initial = (displayName.charAt(0) || 'U').toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        type="button"
        className={`min-h-[38px] sm:min-h-[40px] px-2 sm:px-2.5 py-1 inline-flex items-center gap-1.5 rounded-lg border transition-colors shadow-2xs cursor-pointer ${
          isOwner 
            ? 'border-neutral-900 bg-neutral-950 text-white hover:bg-neutral-850' 
            : 'border-neutral-200/90 bg-white/80 hover:bg-white text-neutral-900'
        }`}
        aria-expanded={isOpen}
      >
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={displayName}
            className="w-6 h-6 rounded-full object-cover border border-neutral-200"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className={`w-6 h-6 rounded-full text-[11px] font-semibold flex items-center justify-center ${
            isOwner ? 'bg-emerald-600 text-white' : 'bg-neutral-900 text-white'
          }`}>
            {initial}
          </div>
        )}
        <span className="max-w-[80px] sm:max-w-[120px] truncate hidden xs:inline text-xs sm:text-sm font-medium">
          {displayName}
        </span>
        <ChevronDown className={`w-3 h-3 shrink-0 ${isOwner ? 'text-neutral-400' : 'text-neutral-400'}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-64 bg-white rounded-xl shadow-xl border border-neutral-200/80 py-2 z-50 animate-in fade-in duration-150">
          <div className="px-3.5 py-2.5 border-b border-neutral-100">
            <div className="flex items-center justify-between gap-1">
              <p className="text-xs font-semibold text-neutral-900 truncate">
                {displayName}
              </p>
              {isOwner && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-neutral-900 text-emerald-400">
                  OWNER
                </span>
              )}
            </div>
            {user.email && (
              <p className="text-[11px] text-neutral-500 truncate mt-0.5 font-mono">
                {user.email}
              </p>
            )}
            <div className="mt-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-neutral-50 text-[10px] font-medium text-neutral-700 border border-neutral-200/60">
              <Check className="w-2.5 h-2.5 text-emerald-600" />
              <span>{isOwner ? 'Verified Store Owner' : 'Signed In'}</span>
            </div>
          </div>

          {/* Owner-only Admin Panel Button */}
          {isOwner && onOpenAdmin && (
            <div className="p-1.5 border-b border-neutral-100">
              <button
                onClick={() => {
                  setIsOpen(false);
                  onOpenAdmin();
                }}
                className="w-full text-left px-3 py-2 text-xs font-semibold text-white bg-neutral-950 hover:bg-neutral-800 rounded-lg flex items-center justify-between transition-colors cursor-pointer shadow-xs"
              >
                <span className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Open Admin Panel</span>
                </span>
                <span className="text-[10px] bg-neutral-800 text-neutral-300 px-1.5 py-0.5 rounded">
                  Edit Frames
                </span>
              </button>
            </div>
          )}

          <div className="pt-1">
            <button
              onClick={async () => {
                setIsOpen(false);
                await logout();
              }}
              className="w-full text-left px-3.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

