import { useAuthStore } from '@/stores/auth';

export type UserStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Capture the owner once, so an old async response cannot write to a new account. */
export function getUserStorage(kind: 'local' | 'session' = 'local'): UserStorage {
  const ownerId = useAuthStore.getState().user?.id;
  const storage = kind === 'local' ? localStorage : sessionStorage;
  const keyFor = (key: string) => `user:${encodeURIComponent(ownerId || '')}:${key}`;
  return {
    getItem(key) {
      if (!ownerId) return null;
      try { return storage.getItem(keyFor(key)); } catch { return null; }
    },
    setItem(key, value) {
      if (!ownerId) throw new Error('로그인 상태를 확인한 뒤 다시 저장해 주세요.');
      storage.setItem(keyFor(key), value);
    },
    removeItem(key) {
      if (ownerId) storage.removeItem(keyFor(key));
    },
  };
}
