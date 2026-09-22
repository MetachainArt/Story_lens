import { useAuthStore } from '@/stores/auth';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SelectPage from '../index';
import { useCameraStore } from '@/stores/camera';
import api from '@/services/api';
import sessionsService from '@/services/sessions';

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('@/services/sessions', () => ({
  default: {
    list: vi.fn(),
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

class ImageMock {
  onload: (() => void) | null = null;
  naturalWidth = 1000;
  naturalHeight = 800;
  width = 1000;
  height = 800;

  set src(_value: string) {
    setTimeout(() => this.onload?.(), 0);
  }
}

describe('SelectPage session recovery', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 'user-1' } as never });
    vi.clearAllMocks();
    mockNavigate.mockReset();
    sessionStorage.clear();
    useCameraStore.setState({
      sessionId: null,
      capturedPhotos: [new Blob(['photo'], { type: 'image/jpeg' })],
    });
    vi.mocked(sessionsService.list).mockResolvedValue([]);
    vi.stubGlobal('Image', ImageMock);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:select-photo');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  });

  it('creates a missing upload session before uploading an album photo', async () => {
    vi.mocked(api.post)
      .mockResolvedValueOnce({ data: { id: 'session-recovered-1' } })
      .mockResolvedValueOnce({ data: { id: 'photo-uploaded-1' } });

    render(
      <MemoryRouter>
        <SelectPage />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /이 사진 편집하기/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenNthCalledWith(1, '/api/v1/sessions', expect.objectContaining({
        title: expect.stringContaining('업로드'),
        date: expect.any(String),
      }));
      expect(api.post).toHaveBeenNthCalledWith(2, '/api/v1/photos', expect.any(FormData));
    });

    const uploadForm = vi.mocked(api.post).mock.calls[1][1] as FormData;
    expect(uploadForm.get('session_id')).toBe('session-recovered-1');
    expect(useCameraStore.getState().sessionId).toBe('session-recovered-1');
    expect(mockNavigate).toHaveBeenCalledWith('/edit/photo-uploaded-1');
    expect(sessionStorage.getItem('user:user-1:selected_topic_photo_id')).toBe('photo-uploaded-1');
  });

  it.each(['setItem', 'removeItem'] as const)('opens a successfully uploaded photo if session storage %s fails', async (operation) => {
    vi.mocked(api.post)
      .mockResolvedValueOnce({ data: { id: 'session-recovered-1' } })
      .mockResolvedValueOnce({ data: { id: 'photo-uploaded-1' } });
    const failingKey = operation === 'setItem' ? 'user:user-1:selected_topic_photo_id' : 'user:user-1:dev_photo_url';
    const original = Storage.prototype[operation];
    vi.spyOn(Storage.prototype, operation).mockImplementation(function (this: Storage, key: string, value?: string) {
      if (key === failingKey) throw new DOMException('Storage unavailable', 'QuotaExceededError');
      original.call(this, key, value as string);
    });

    render(<MemoryRouter><SelectPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /이 사진 편집하기/i }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/edit/photo-uploaded-1'));
    expect(api.post).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/업로드 실패/)).not.toBeInTheDocument();
  });
});
