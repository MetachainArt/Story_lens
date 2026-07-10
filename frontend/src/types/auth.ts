/**
 * Authentication type definitions.
 */

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: 'teacher' | 'student' | 'parent';
  teacher_id?: string | null;
  is_active: boolean;
  privacy_consent_at?: string | null;
  privacy_policy_version?: string | null;
  can_manage_templates?: boolean;
  created_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export interface AuthResponse {
  user: User;
}

export interface PasswordChangeRequest {
  current_password: string;
  new_password: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  hasCheckedSession?: boolean;
  isLoading: boolean;
}
