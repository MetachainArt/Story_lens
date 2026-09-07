import { useAuthStore } from '@/stores/auth';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import EditorPage from '../index';
import api from '@/services/api';
import { useEditorStore } from '@/stores/editor';

const mockNavigate = vi.fn();

vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const photo = {
  id: 'photo-1',
  user_id: 'user-1',
  session_id: 'session-1',
  original_url: 'https://cdn.example.com/photo.jpg',
  edited_url: null,
  thumbnail_url: null,
  title: null,
  topic: null,
  content: null,
  music_url: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function installCanvasAndImageMocks() {
  const context = {
    save: vi.fn(), restore: vi.fn(), translate: vi.fn(), rotate: vi.fn(), scale: vi.fn(),
    drawImage: vi.fn(), fillText: vi.fn(), strokeText: vi.fn(), strokeRect: vi.fn(),
    beginPath: vi.fn(), closePath: vi.fn(), moveTo: vi.fn(), arcTo: vi.fn(), fill: vi.fn(), stroke: vi.fn(),
    measureText: vi.fn(() => ({ width: 100 })),
    set filter(_value: string) {}, set fillStyle(_value: string) {}, set strokeStyle(_value: string) {},
    set lineWidth(_value: number) {}, set shadowColor(_value: string) {}, set shadowBlur(_value: number) {},
    set font(_value: string) {}, set textAlign(_value: string) {}, set textBaseline(_value: string) {},
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
    'data:image/jpeg;base64,AAAA',
  );
  vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
  vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(1200);
  vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(800);
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:server-photo');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    blob: async () => new Blob(['image'], { type: 'image/jpeg' }),
  }));
  vi.stubGlobal('Image', class {
    complete = true;
    naturalWidth = 1200;
    naturalHeight = 800;
    width = 1200;
    height = 800;
    crossOrigin = '';
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_value: string) { queueMicrotask(() => this.onload?.()); }
  });
}

function renderEditor() {
  return render(
    <MemoryRouter initialEntries={['/edit/photo-1']}>
      <Routes>
        <Route path="/edit/:photoId" element={<EditorPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('EditorPage server integration', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 'user-1' } as never });
    vi.resetAllMocks();
    sessionStorage.clear();
    useEditorStore.getState().reset();
    installCanvasAndImageMocks();
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url === '/api/v1/photos/photo-1') return { data: photo };
      return { data: [] };
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('loads the photo, filters, and creative assets together', async () => {
    renderEditor();

    expect(await screen.findByAltText('편집 중인 사진')).toHaveAttribute(
      'src',
      'https://cdn.example.com/photo.jpg',
    );
    expect(api.get).toHaveBeenCalledWith('/api/v1/photos/photo-1');
    expect(api.get).toHaveBeenCalledWith('/api/filters');
    expect(api.get).toHaveBeenCalledWith('/api/v1/creative-assets');
  });

  it('uploads one edited image and opens the saved gallery item', async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockResolvedValueOnce({ data: {} });
    renderEditor();
    fireEvent.load(await screen.findByAltText('편집 중인 사진'));

    await user.click(screen.getAllByRole('button', { name: '저장하기' })[0]);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/api/v1/photos/photo-1/upload-edited',
        expect.any(FormData),
      );
      expect(mockNavigate).toHaveBeenCalledWith('/gallery/photo-1');
    });
  });

  it('falls back to the JSON update endpoint when binary upload fails', async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockRejectedValueOnce(new Error('upload failed'));
    vi.mocked(api.put).mockResolvedValueOnce({ data: {} });
    renderEditor();
    fireEvent.load(await screen.findByAltText('편집 중인 사진'));

    await user.click(screen.getAllByRole('button', { name: '저장하기' })[0]);

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/api/v1/photos/photo-1', {
        edited_url: 'data:image/jpeg;base64,AAAA',
        topic: null,
      });
      expect(mockNavigate).toHaveBeenCalledWith('/gallery/photo-1');
    });
  });

  it('shows a retryable error when both save paths fail', async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockRejectedValueOnce(new Error('upload failed'));
    vi.mocked(api.put).mockRejectedValueOnce(new Error('update failed'));
    renderEditor();
    fireEvent.load(await screen.findByAltText('편집 중인 사진'));

    await user.click(screen.getAllByRole('button', { name: '저장하기' })[0]);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '저장 중 오류가 생겼어요. 다시 시도해 주세요.',
    );
    expect(mockNavigate).not.toHaveBeenCalledWith('/gallery/photo-1');
  });

  it('keeps the edited image when server upload and local storage both fail', async () => {
    sessionStorage.setItem('user:user-1:dev_photo_url', 'data:image/jpeg;base64,AAAA');
    const user = userEvent.setup();
    vi.mocked(api.post).mockRejectedValue(new Error('offline'));
    vi.mocked(localStorage.setItem).mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    renderEditor();
    fireEvent.load(await screen.findByAltText('편집 중인 사진'));
    await user.click(screen.getAllByRole('button', { name: '저장하기' })[0]);
    expect(await screen.findByRole('alert')).toHaveTextContent('저장');
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: '편집 사진 내려받기' })).toBeInTheDocument();
  });
});
