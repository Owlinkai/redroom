/**
 * AuthContext — Global auth state + modal control for Redroom platform.
 * 
 * Provides:
 * - user: current user or null
 * - isAdmin: boolean
 * - isAnalyst: boolean (any logged-in user)
 * - showAuthModal(): opens the login/register modal
 * - showAdminRequired(): shows "admin access required" overlay
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface AuthContextValue {
  user: { id: number; openId: string; name: string | null; email: string | null; role: string } | null;
  isAdmin: boolean;
  isAnalyst: boolean;
  isLoading: boolean;
  showAuthModal: () => void;
  hideAuthModal: () => void;
  showAdminRequired: () => void;
  hideAdminRequired: () => void;
  authModalOpen: boolean;
  adminRequiredOpen: boolean;
  logout: () => void;
  refresh: () => void;
}

const AuthCtx = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, loading: isLoading, logout, refresh } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [adminRequiredOpen, setAdminRequiredOpen] = useState(false);

  const showAuthModal = useCallback(() => setAuthModalOpen(true), []);
  const hideAuthModal = useCallback(() => setAuthModalOpen(false), []);
  const showAdminRequired = useCallback(() => setAdminRequiredOpen(true), []);
  const hideAdminRequired = useCallback(() => setAdminRequiredOpen(false), []);

  const value: AuthContextValue = {
    user: user as AuthContextValue['user'],
    isAdmin: user?.role === 'admin',
    isAnalyst: !!user,
    isLoading,
    showAuthModal,
    hideAuthModal,
    showAdminRequired,
    hideAdminRequired,
    authModalOpen,
    adminRequiredOpen,
    logout,
    refresh,
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
