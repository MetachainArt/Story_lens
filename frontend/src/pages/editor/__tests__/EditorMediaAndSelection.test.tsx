import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import EditorPage from '../index';
import { useAuthStore } from '@/stores/auth';
import { useEditorStore } from '@/stores/editor';
import api from '@/services/api';

vi.mock('@/services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

const photo = {
  id: 'server-photo', original_url: 'https://api.storylens.test/api/v1/media/uploads/photo.jpg',
  topic: '가족', edited_url: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('VITE_API_URL', 'https://api.storylens.test');
  sessionStorage.clear();
  useAuthStore.setState({ user: { id: 'owner' } as never });
  useEditorStore.getState().reset();
  vi.mocked(api.get).mockImplementation(async (url, options) => ({ data: options?.responseType === 'blob'
    ? new Blob(['image'], { type: 'image/jpeg' })
    : url.includes('/photos/') ? photo : [] }));
  vi.mocked(api.post).mockResolvedValue({ data: { id: 'saved-photo' } });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    save: vi.fn(), restore: vi.fn(), translate: vi.fn(), rotate: vi.fn(), scale: vi.fn(), drawImage: vi.fn(), filter: 'none',
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,QUFBQQ==');
  vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
  vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(1200);
  vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(800);
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:verified-photo');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['image'], { type: 'image/jpeg' }) }));
  vi.stubGlobal('Image', class {
    complete = true; naturalWidth = 1200; naturalHeight = 800;
    onload: (() => void) | null = null;
    set src(_value: string) { queueMicrotask(() => this.onload?.()); }
  });
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

function renderEditor(id = 'server-photo') {
  return render(<MemoryRouter initialEntries={[`/edit/${id}`]}><Routes>
    <Route path="/edit/:photoId" element={<EditorPage />} />
    <Route path="/gallery/:photoId" element={<p>저장 결과</p>} />
  </Routes></MemoryRouter>);
}

async function savePhoto() {
  await waitFor(() => expect(screen.getAllByRole('button', { name: '저장하기' })[0]).toBeEnabled());
  fireEvent.click(screen.getAllByRole('button', { name: '저장하기' })[0]);
  await screen.findByText('저장 결과');
  return vi.mocked(api.post).mock.calls.find(([url]) => url.endsWith('/upload-edited'))?.[1] as FormData;
}

it('loads the requested server photo despite a stale temporary photo', async () => {
  sessionStorage.setItem('user:owner:dev_photo_url', 'data:image/jpeg;base64,T0xE');
  renderEditor();
  expect(await screen.findByAltText('편집 중인 사진')).toHaveAttribute('src', photo.original_url);
  expect(api.get).toHaveBeenCalledWith('/api/v1/photos/server-photo');
  await savePhoto();
  expect(api.post).toHaveBeenCalledWith('/api/v1/photos/server-photo/upload-edited', expect.any(FormData));
});

it('keeps the existing photo topic instead of a previous upload topic', async () => {
  sessionStorage.setItem('user:owner:selected_topic', '이전 업로드 주제');
  renderEditor();
  await screen.findByAltText('편집 중인 사진');
  expect((await savePhoto()).get('topic')).toBe('가족');
});

it('only applies a selection topic to its matching new photo', async () => {
  sessionStorage.setItem('user:owner:selected_topic', '새 선택 주제');
  sessionStorage.setItem('user:owner:selected_topic_photo_id', 'server-photo');
  vi.mocked(api.get).mockImplementation(async (url, options) => ({ data: options?.responseType === 'blob'
    ? new Blob(['image'], { type: 'image/jpeg' }) : url.includes('/photos/') ? { ...photo, topic: null } : [] }));
  renderEditor();
  await screen.findByAltText('편집 중인 사진');
  expect((await savePhoto()).get('topic')).toBe('새 선택 주제');
  expect(sessionStorage.getItem('user:owner:selected_topic_photo_id')).toBeNull();
});

it('loads the matching local saved photo instead of the last temporary image', async () => {
  sessionStorage.setItem('user:owner:dev_photo_url', 'data:image/jpeg;base64,T0xE');
  vi.mocked(localStorage.getItem).mockImplementation(key => key === 'user:owner:saved_photos'
    ? JSON.stringify([{ id: 'local-123', edited_url: 'data:image/jpeg;base64,TkVX', topic: '로컬 주제', created_at: '2026-09-22' }]) : null);
  renderEditor('local-123');
  expect(await screen.findByAltText('편집 중인 사진')).toHaveAttribute('src', 'data:image/jpeg;base64,TkVX');
});

it('keeps private image requests on the API origin with session refresh support', async () => {
  renderEditor();
  await screen.findByAltText('편집 중인 사진');
  await waitFor(() => expect(api.get).toHaveBeenCalledWith(photo.original_url, expect.objectContaining({ responseType: 'blob', withCredentials: true })));
  expect(fetch).not.toHaveBeenCalledWith('/api/v1/media/uploads/photo.jpg', expect.anything());
});

it('does not use the displayed cross-origin image when the image response is HTML', async () => {
  vi.mocked(api.get).mockImplementation(async (url, options) => ({ data: options?.responseType === 'blob'
    ? new Blob(['<html>SPA</html>'], { type: 'text/html' }) : url.includes('/photos/') ? photo : [] }));
  vi.mocked(fetch).mockResolvedValue({ ok: true, blob: async () => new Blob(['<html>SPA</html>'], { type: 'text/html' }) } as Response);
  renderEditor();
  fireEvent.load(await screen.findByAltText('편집 중인 사진'));
  await act(async () => { await Promise.resolve(); });
  expect(screen.getAllByRole('button', { name: /저장하기|사진 준비 중/ })[0]).toBeDisabled();
  expect(await screen.findByRole('alert')).toHaveTextContent('사진');
  expect(HTMLCanvasElement.prototype.toDataURL).not.toHaveBeenCalled();
});
