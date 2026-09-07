import { safeJsonArray } from './storage';
import type { UserStorage } from './userStorage';

export type StoryDraft = {
  id: string; photoId: string; topic: string; content: string; created_at: string; pending?: boolean;
};

export function readStoryDrafts(storage: UserStorage): StoryDraft[] {
  return safeJsonArray<StoryDraft>(storage.getItem('story_drafts')).filter(item =>
    item && typeof item.id === 'string' && typeof item.photoId === 'string'
    && typeof item.content === 'string' && typeof item.created_at === 'string');
}

export function findStoryDraft(storage: UserStorage, photoId: string): StoryDraft | undefined {
  return readStoryDrafts(storage).find(item => item.photoId === photoId);
}

export function removeStoryDraft(storage: UserStorage, photoId: string, content: string, supersededId?: string): void {
  storage.setItem('story_drafts', JSON.stringify(readStoryDrafts(storage).filter(item =>
    item.photoId !== photoId || (item.content !== content && item.id !== supersededId))));
}
