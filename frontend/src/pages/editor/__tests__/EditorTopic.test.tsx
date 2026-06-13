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

function getSaveButton() {
  const buttons = screen.getAllByRole('button', { name: /저장/i });
  expect(buttons.length).toBeGreaterThan(0);
  return buttons[0];
}

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
      save: vi.fn(),
      restore: vi.fn(),
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
      naturalWidth = 800;
      naturalHeight = 600;
      complete = true;

      constructor() {
        setTimeout(() => {
          this.onload?.();
        }, 0);
      }
    };
    vi.stubGlobal('Image', ImageMock);
  });

  it('loads a dev photo from selection step', async () => {
    render(
      <MemoryRouter initialEntries={['/edit/dev-photo']}>
        <Routes>
          <Route path="/edit/:photoId" element={<EditorPage />} />
          <Route path="/saved" element={<div>saved</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByAltText('편집 중인 사진')).toBeInTheDocument();
      expect(getSaveButton()).toBeEnabled();
    });
  });

  it('stores selected topic in local saved photo payload', async () => {
    render(
      <MemoryRouter initialEntries={['/edit/dev-photo']}>
        <Routes>
          <Route path="/edit/:photoId" element={<EditorPage />} />
          <Route path="/saved" element={<div>saved</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(getSaveButton()).toBeInTheDocument();
    });

    fireEvent.click(getSaveButton());

    await waitFor(() => {
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'saved_photos',
        expect.stringContaining('"topic":"용기"'),
      );
    });
  });

  it('does not fail the save when temporary local storage is full', async () => {
    const api = await import('../../../services/api');
    vi.mocked(api.default.post).mockRejectedValue(new Error('network down'));
    (localStorage.setItem as unknown as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
      if (key === 'saved_photos') {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      }
    });

    render(
      <MemoryRouter initialEntries={['/edit/dev-photo']}>
        <Routes>
          <Route path="/edit/:photoId" element={<EditorPage />} />
          <Route path="/saved" element={<div>saved</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(getSaveButton()).toBeInTheDocument();
    });

    fireEvent.click(getSaveButton());

    await waitFor(() => {
      expect(screen.getByText('saved')).toBeInTheDocument();
    });
    expect(screen.queryByText('저장 중 오류가 생겼어요. 다시 시도해 주세요.')).not.toBeInTheDocument();
  });
});
