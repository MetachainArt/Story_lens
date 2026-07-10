/**
 * @TASK P1-S0-T1 - Auth Store (httpOnly cookie based)
 * @SPEC Authentication store using Zustand. Tokens live only in httpOnly
 *       cookies set by the backend; they are never stored in localStorage.
 */
import { create } from 'zustand';
import { AUTH_FLAG_KEY } from '../constants/auth';
import api from '../services/api';
import type { User } from '../types/auth';

interface AuthStore {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasCheckedSession: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<void>;
  loadUser: () => Promise<void>;
  clearError: () => void;
}

function getAuthErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const detail = (error as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
    if (typeof detail === 'string') {
      return detail;
    }
  }
  return '로그인에 실패했습니다.';
}

function setAuthFlag(value: boolean) {
  if (value) {
    localStorage.setItem(AUTH_FLAG_KEY, '1');
  } else {
    localStorage.removeItem(AUTH_FLAG_KEY);
  }
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoading: false,
  isAuthenticated: false,
  hasCheckedSession: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/api/auth/login', { email, password });
      const { user } = response.data;

      setAuthFlag(true);
      set({
        user,
        isAuthenticated: true,
        hasCheckedSession: true,
        isLoading: false,
      });
    } catch (error: unknown) {
      const message = getAuthErrorMessage(error);
      set({
        error: message,
        isAuthenticated: false,
        hasCheckedSession: true,
        isLoading: false,
      });
      throw error;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await api.post('/api/auth/logout');
    } catch {
      // Logout API failure is non-critical; local session state still clears.
    } finally {
      setAuthFlag(false);
      set({
        user: null,
        isAuthenticated: false,
        hasCheckedSession: true,
        isLoading: false,
      });
    }
  },

  refreshTokens: async () => {
    try {
      await api.post('/api/auth/refresh', {});
      setAuthFlag(true);
      set({ isAuthenticated: true, hasCheckedSession: true });
    } catch (error) {
      setAuthFlag(false);
      set({
        user: null,
        isAuthenticated: false,
        hasCheckedSession: true,
      });
      throw error;
    }
  },

  loadUser: async () => {
    set({ isLoading: true });
    try {
      const response = await api.get('/api/v1/users/me');
      setAuthFlag(true);
      set({
        user: response.data,
        isAuthenticated: true,
        hasCheckedSession: true,
        isLoading: false,
      });
    } catch {
      setAuthFlag(false);
      set({
        user: null,
        isAuthenticated: false,
        hasCheckedSession: true,
        isLoading: false,
      });
    }
  },

  clearError: () => set({ error: null }),
}));

export default useAuthStore;
