/**
 * @TASK P3-S2-T1 - Session Types
 * @SPEC TypeScript types for session resource
 */

export interface Session {
  id: string;
  user_id: string;
  title: string;
  date: string;
  location: string | null;
  created_at: string;
}

export interface CreateSessionRequest {
  title: string;
  date: string;
  location?: string | null;
}

export interface CreateSessionResponse extends Session {}
