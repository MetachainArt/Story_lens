import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import EditorPage from '../index';

vi.mock('../../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

describe('EditorPage topic integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.setItem('dev_photo_url', 'data:image/jpeg;base64,mock');
    sessionStorage.setItem('selected_topic', '용기');

    (localStorage.getItem as unknown as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
      if (key === 'saved_photos') {
        return '[]';
      }
      return null;
    });

    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      drawImage: vi.fn(),
      filter: 'none',
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/jpeg;base64,result');

    const ImageMock = class {
      onload: (() => void) | null = null;
      src = '';
      width = 800;
      height = 600;

      constructor() {
        setTimeout(() => {
          if (this.onload) {
            this.onload();
          }
        }, 0);
      }
    };
    vi.stubGlobal('Image', ImageMock);
  });

  it('shows selected topic badge from selection step', async () => {
    render(
      <MemoryRouter initialEntries={['/edit/dev-photo']}>
        <Routes>
          <Route path="/edit/:photoId" element={<EditorPage />} />
          <Route path="/saved" element={<div>saved</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('#용기')).toBeInTheDocument();
    });
  });

  it('stores selected topic in local saved photo payload', async () => {
    render(
      <MemoryRouter initialEntries={['/edit/dev-photo']}>
        <Routes>
          <Route path="/edit/:photoId" element={<EditorPage />} />
          <Route path="/saved" element={<div>saved</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /저장/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /저장/i }));

    await waitFor(() => {
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'saved_photos',
        expect.stringContaining('"topic":"용기"')
      );
    });
  });
});
