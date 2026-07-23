import type { Photo } from '@/types/photo';
import type { PhotoBookTemplate, SpreadLayout } from './config';

export type BookPage = {
  photo: Photo;
  imageUrl: string;
  exportImageUrl?: string;
  copy?: {
    title: string;
    content: string;
  };
};

export type BookSpread = {
  id: string;
  index: number;
  layout: SpreadLayout;
  pages: BookPage[];
};

const LAYOUT_CAPACITY: Record<SpreadLayout, number> = {
  hero: 1,
  duo: 2,
  trio: 3,
  grid4: 4,
  'story-strip': 3,
  collage: 4,
};

function matchingLayout(photoCount: number): SpreadLayout {
  if (photoCount >= 4) return 'grid4';
  if (photoCount === 3) return 'trio';
  if (photoCount === 2) return 'duo';
  return 'hero';
}

export function buildAutoSpreads(pages: BookPage[], template: PhotoBookTemplate): BookSpread[] {
  const spreads: BookSpread[] = [];
  let cursor = 0;
  let sequenceIndex = 0;

  while (cursor < pages.length) {
    const requestedLayout = template.layoutSequence[sequenceIndex % template.layoutSequence.length] ?? 'hero';
    const remaining = pages.length - cursor;
    const requestedCapacity = LAYOUT_CAPACITY[requestedLayout];
    const layout = remaining < requestedCapacity ? matchingLayout(remaining) : requestedLayout;
    const count = Math.min(LAYOUT_CAPACITY[layout], remaining);
    const spreadPages = pages.slice(cursor, cursor + count);

    spreads.push({
      id: `spread-${spreads.length}-${spreadPages.map((page) => page.photo.id).join('-')}`,
      index: spreads.length,
      layout,
      pages: spreadPages,
    });

    cursor += count;
    sequenceIndex += 1;
  }

  return spreads;
}
