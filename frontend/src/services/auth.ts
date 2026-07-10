/**
 * Authentication API service.
 */
import api from './api';
import { AUTH_FLAG_KEY } from '../constants/auth';
import type {
  AuthResponse,
  LoginRequest,
  PasswordChangeRequest,
  RegisterRequest,
  User,
} from '../types/auth';

export const authService = {
  async register(data: RegisterRequest): Promise<User> {
    const response = await api.post<User>('/api/auth/register', data);
    return response.data;
  },

  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/api/auth/login', data);
    localStorage.setItem(AUTH_FLAG_KEY, '1');
    return response.data;
  },

  async logout(): Promise<void> {
    try {
      await api.post('/api/auth/logout');
    } finally {
      localStorage.removeItem(AUTH_FLAG_KEY);
    }
  },

  async getCurrentUser(): Promise<User> {
    const response = await api.get<User>('/api/v1/users/me');
    return response.data;
  },

  async updateProfile(data: Partial<User>): Promise<User> {
    const response = await api.patch<User>('/api/v1/users/me', data);
    return response.data;
  },

  async changePassword(data: PasswordChangeRequest): Promise<void> {
    await api.post('/api/auth/password/change', data);
  },

  async deleteAccount(): Promise<void> {
    try {
      await api.delete('/api/v1/users/me');
    } finally {
      localStorage.removeItem(AUTH_FLAG_KEY);
    }
  },

  getToken(): null {
    return null;
  },

  setToken(): void {
    // Tokens are stored only in httpOnly cookies set by the backend.
  },

  removeToken(): void {
    localStorage.removeItem(AUTH_FLAG_KEY);
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem(AUTH_FLAG_KEY);
  },
};

export default authService;
