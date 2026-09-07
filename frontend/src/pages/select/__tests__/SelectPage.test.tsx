import { useAuthStore } from '@/stores/auth';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SelectPage from '../index';
import api from '@/services/api';
import sessionsService from '@/services/sessions';
import { useCameraStore } from '@/stores/camera';

const mockNavigate = vi.fn();

vi.mock('@/services/api', () => ({ default: { post: vi.fn() } }));
vi.mock('@/services/sessions', () => ({ default: { list: vi.fn() } }));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function imageBlob(label = 'image'): Blob {
  return new Blob([label], { type: 'image/jpeg' });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <SelectPage />
    </MemoryRouter>,
  );
}

describe('SelectPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 'user-1' } as never });
    vi.resetAllMocks();
    sessionStorage.clear();
    vi.mocked(sessionsService.list).mockResolvedValue([]);
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => `blob:${blob.size}`);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.stubGlobal(
      'Image',
      class {
        naturalWidth = 1200;
        naturalHeight = 800;
        width = 1200;
        height = 800;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_value: string) {
          queueMicrotask(() => this.onload?.());
        }
      },
    );
    useCameraStore.setState({
      sessionId: 'session-1',
      capturedPhotos: [imageBlob('first')],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns to the camera when there are no photos', async () => {
    useCameraStore.setState({ capturedPhotos: [] });
    renderPage();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/camera', { replace: true });
    });
  });

  it('shows the current photo and its position', async () => {
    useCameraStore.setState({ capturedPhotos: [imageBlob('one'), imageBlob('two')] });
    renderPage();

    expect(screen.getByRole('img', { name: '촬영한 사진' })).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    await waitFor(() => {
      expect(sessionsService.list).toHaveBeenCalled();
    });
  });

  it('moves between photos with previous and next controls', async () => {
    const user = userEvent.setup();
    useCameraStore.setState({ capturedPhotos: [imageBlob('one'), imageBlob('two')] });
    renderPage();

    await user.click(screen.getByRole('button', { name: '다음' }));
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '이전' }));
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('supports a mobile swipe gesture', async () => {
    useCameraStore.setState({ capturedPhotos: [imageBlob('one'), imageBlob('two')] });
    renderPage();
    const preview = screen.getByRole('img', { name: '촬영한 사진' }).parentElement!;

    fireEvent.touchStart(preview, { touches: [{ clientX: 240 }] });
    fireEvent.touchEnd(preview, { changedTouches: [{ clientX: 80 }] });

    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    await waitFor(() => {
      expect(sessionsService.list).toHaveBeenCalled();
    });
  });

  it('uploads exactly one selected photo and opens the editor', async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockResolvedValueOnce({ data: { id: 'photo-1' } });
    renderPage();

    await user.click(screen.getByRole('button', { name: '이 사진 편집하기' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/v1/photos', expect.any(FormData));
      expect(mockNavigate).toHaveBeenCalledWith('/edit/photo-1');
    });
  });

  it('keeps the user on the page and explains an upload failure', async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Network Error'));
    renderPage();

    await user.click(screen.getByRole('button', { name: '이 사진 편집하기' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '서버에 사진을 보내지 못했어요',
    );
    expect(mockNavigate).not.toHaveBeenCalledWith(expect.stringMatching(/^\/edit\//));
  });
});
