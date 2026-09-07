import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getUserStorage } from '@/utils/userStorage';
import { useAuthStore } from '@/stores/auth';

describe('account-owned browser records', () => {
  const records = new Map<string, string>();
  beforeEach(() => {
    records.clear();
    vi.mocked(localStorage.getItem).mockImplementation(key => records.get(key) ?? null);
    vi.mocked(localStorage.setItem).mockImplementation((key, value) => { records.set(key, value); });
    vi.mocked(localStorage.removeItem).mockImplementation(key => { records.delete(key); });
  });

  it('isolates users and preserves unowned legacy records without adopting them', () => {
    records.set('saved_photos', 'legacy-private-photo');
    useAuthStore.setState({ user: { id: 'a' } as never });
    const a = getUserStorage();
    expect(a.getItem('saved_photos')).toBeNull();
    a.setItem('saved_photos', 'photo-a');
    useAuthStore.setState({ user: { id: 'b' } as never });
    const b = getUserStorage();
    expect(b.getItem('saved_photos')).toBeNull();
    a.setItem('saved_photos', 'late-photo-a');
    expect(b.getItem('saved_photos')).toBeNull();
    expect(a.getItem('saved_photos')).toBe('late-photo-a');
    expect(records.get('saved_photos')).toBe('legacy-private-photo');
  });

  it('never reads private records or writes without a known owner', () => {
    useAuthStore.setState({ user: null });
    expect(getUserStorage().getItem('saved_photos')).toBeNull();
    expect(() => getUserStorage().setItem('saved_photos', 'photo')).toThrow();
  });
});
