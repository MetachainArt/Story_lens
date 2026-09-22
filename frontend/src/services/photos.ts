import api from './api';
import type { Photo, PhotoPageResponse } from '@/types/photo';

/** Consume the server cursor so monthly and student views include every photo. */
export async function listAllPhotos(filters: { year?: number; month?: number; student_id?: string }): Promise<Photo[]> {
  const photos = new Map<string, Photo>();
  let offset = 0;
  for (;;) {
    const response = await api.get<PhotoPageResponse>('/api/v1/photos/page', {
      params: { ...filters, offset, limit: 50 },
    });
    if (!Array.isArray(response.data?.items)) throw new Error('사진 목록을 불러오지 못했어요.');
    for (const photo of response.data.items) photos.set(photo.id, photo);
    const next = response.data.next_offset;
    if (next === null) return [...photos.values()];
    if (!Number.isInteger(next) || next <= offset) throw new Error('사진 목록을 이어서 불러오지 못했어요.');
    offset = next;
  }
}
