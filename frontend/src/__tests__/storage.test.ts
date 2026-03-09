import { describe, expect, it } from 'vitest';

import { resolveImageUrl } from '@/utils/storage';

describe('resolveImageUrl', () => {
  it('keeps absolute http URL as-is', () => {
    const url = 'http://localhost:8000/uploads/photos/a.jpg';
    expect(resolveImageUrl(url)).toBe(url);
  });

  it('keeps data URL as-is', () => {
    const dataUrl = 'data:image/jpeg;base64,abc123';
    expect(resolveImageUrl(dataUrl)).toBe(dataUrl);
  });

  it('resolves relative uploads URL with API base origin', () => {
    const base = (import.meta.env.VITE_API_URL?.trim() || window.location.origin).replace(/\/+$/, '');
    expect(resolveImageUrl('/uploads/photos/test.jpg')).toBe(`${base}/uploads/photos/test.jpg`);
  });
});
