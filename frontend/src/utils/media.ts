import api from '@/services/api';
import { resolveImageUrl } from './storage';

/** Read private media through the API client so cookies and token refresh apply. */
export async function fetchImageBlob(source: string, signal?: AbortSignal): Promise<Blob> {
  const url = resolveImageUrl(source);
  if (!url) throw new Error('사진 주소가 없습니다.');

  const browserOrigin = window.location.origin || 'http://localhost';
  const apiBase = import.meta.env.VITE_API_URL?.trim() || api.defaults?.baseURL || browserOrigin;
  const target = new URL(url, browserOrigin);
  const isApiImage = ['http:', 'https:'].includes(target.protocol)
    && target.origin === new URL(apiBase, browserOrigin).origin;
  let blob: Blob;
  if (isApiImage) {
    const response = await api.get<Blob>(target.href, {
      responseType: 'blob',
      withCredentials: true,
      ...(signal ? { signal } : {}),
    });
    blob = response.data;
  } else {
    const response = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
      ...(signal ? { signal } : {}),
    });
    if (!response.ok) throw new Error(`사진 요청에 실패했습니다 (${response.status}).`);
    blob = await response.blob();
  }

  if (!blob || !blob.type?.toLowerCase().startsWith('image/') || !blob.size) {
    throw new Error('사진 파일을 받지 못했어요. 다시 불러와 주세요.');
  }
  return blob;
}
