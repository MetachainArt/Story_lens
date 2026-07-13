import { describe, expect, it } from 'vitest';

import type { Photo } from '@/types/photo';
import { PHOTOBOOK_TEMPLATES } from '../config';
import { buildAutoSpreads } from '../layout';

function makePage(index: number) {
  const photo: Photo = {
    id: `photo-${index}`,
    session_id: 'session-1',
    user_id: 'user-1',
    original_url: `https://example.com/${index}.jpg`,
    edited_url: `https://example.com/${index}.jpg`,
    title: `사진 ${index}`,
    topic: `장면 ${index}`,
    thumbnail_url: `https://example.com/${index}.jpg`,
    content: null,
    music_url: null,
    created_at: '2026-07-13T00:00:00.000Z',
    updated_at: '2026-07-13T00:00:00.000Z',
  };

  return { photo, imageUrl: photo.edited_url as string };
}

describe('buildAutoSpreads', () => {
  const template = PHOTOBOOK_TEMPLATES.find((item) => item.id === 'magazine')!;

  it('creates one hero spread for a single photo', () => {
    const spreads = buildAutoSpreads([makePage(1)], template);

    expect(spreads).toHaveLength(1);
    expect(spreads[0].layout).toBe('hero');
    expect(spreads[0].pages.map((page) => page.photo.id)).toEqual(['photo-1']);
  });

  it('preserves every selected photo once and in order', () => {
    const pages = Array.from({ length: 10 }, (_, index) => makePage(index + 1));
    const spreads = buildAutoSpreads(pages, template);
    const placedIds = spreads.flatMap((spread) => spread.pages.map((page) => page.photo.id));

    expect(placedIds).toEqual(pages.map((page) => page.photo.id));
    expect(new Set(placedIds).size).toBe(pages.length);
    expect(spreads.some((spread) => spread.pages.length > 1)).toBe(true);
  });

  it('uses a smaller matching layout when the final spread has fewer photos', () => {
    const pages = Array.from({ length: 7 }, (_, index) => makePage(index + 1));
    const spreads = buildAutoSpreads(pages, template);
    const finalSpread = spreads.at(-1)!;

    expect(finalSpread.pages.length).toBeGreaterThan(0);
    expect(finalSpread.pages.length).toBeLessThanOrEqual(4);
    expect(spreads.flatMap((spread) => spread.pages)).toHaveLength(7);
  });
});
