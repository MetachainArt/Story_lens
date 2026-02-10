/**
 * @TASK P1-S0-T1 - Auth Store with Refresh Token Support
 * @SPEC Authentication store using Zustand with refresh token handling
 */
import { create } from 'zustand';
import type { User } from '../types/auth';
import api from '../services/api';

interface AuthStore {
  // State
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<void>;
  loadUser: () => Promise<void>;
  clearError: () => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  // Initial state - DEV: 기본 사용자 설정 (로그인 없이 테스트용)
  user: { id: '11111111-1111-1111-1111-111111111111', email: '1@1.com', name: '선생님', role: 'teacher' as const, is_active: true, created_at: '' },
  accessToken: localStorage.getItem('access_token') || 'dev-token',
  refreshToken: localStorage.getItem('refresh_token'),
  isLoading: false,
  isAuthenticated: true,
  error: null,

  // Login
  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/api/auth/login', { email, password });
      const { access_token, refresh_token, user } = response.data;

      // Store tokens
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);

      set({
        accessToken: access_token,
        refreshToken: refresh_token,
        user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Login failed';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  // Logout
  logout: async () => {
    set({ isLoading: true });
    try {
      await api.post('/api/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear tokens
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');

      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  // Refresh tokens
  refreshTokens: async () => {
    const { refreshToken } = get();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await api.post('/api/auth/refresh', {
        refresh_token: refreshToken,
      });
      const { access_token, refresh_token } = response.data;

      // Store new tokens
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);

      set({
        accessToken: access_token,
        refreshToken: refresh_token,
      });
    } catch (error) {
      // Refresh failed, logout user
      get().logout();
      throw error;
    }
  },

  // Load user
  loadUser: async () => {
    const { accessToken } = get();
    if (!accessToken) {
      set({ user: null, isAuthenticated: false });
      return;
    }

    set({ isLoading: true });
    try {
      const response = await api.get('/api/users/me');
      set({
        user: response.data,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      console.error('Load user error:', error);
      // Don't logout immediately, let interceptor handle token refresh
      set({ isLoading: false });
    }
  },

  // Set tokens (used by interceptor)
  setTokens: (accessToken: string, refreshToken: string) => {
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
    set({ accessToken, refreshToken });
  },

  // Clear error
  clearError: () => set({ error: null }),
}));

export default useAuthStore;
