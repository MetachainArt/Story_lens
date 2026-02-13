/**
 * @TASK P3-S6-T1 - Photo Types
 * @SPEC TypeScript types for photo resource
 */

export interface Photo {
  id: string;
  user_id: string;
  session_id: string;
  original_url: string;
  edited_url: string | null;
  title: string | null;
  topic: string | null;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface PhotoListResponse {
  photos: Photo[];
}
