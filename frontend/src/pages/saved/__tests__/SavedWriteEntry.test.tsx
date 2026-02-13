import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, useLocation } from 'react-router-dom';

import SavedPage from '../index';
import { useEditorStore } from '@/stores/editor';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: vi.fn(),
  };
});

vi.mock('@/stores/editor', () => ({
  useEditorStore: vi.fn(),
}));

describe('SavedPage write entry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useEditorStore).mockReturnValue({
      photoId: 'photo-1',
      originalUrl: 'data:image/jpeg;base64,origin',
      selectedFilter: null,
      filterCss: '',
      adjustments: { brightness: 0, contrast: 0, saturation: 0, temperature: 0, sharpness: 0 },
      rotation: 0,
      flipX: false,
      activeTab: 'filter',
      setPhotoId: vi.fn(),
      setOriginalUrl: vi.fn(),
      setFilter: vi.fn(),
      setAdjustment: vi.fn(),
      setRotation: vi.fn(),
      setFlipX: vi.fn(),
      setActiveTab: vi.fn(),
      reset: vi.fn(),
      getComputedFilterCss: vi.fn().mockReturnValue(''),
      getComputedTransform: vi.fn().mockReturnValue(''),
    });
    vi.mocked(useLocation).mockReturnValue({
      pathname: '/saved',
      search: '',
      hash: '',
      state: {
        photoId: 'photo-1',
        editedUrl: 'data:image/jpeg;base64,edited',
        topic: '용기',
      },
      key: 'default',
    });
  });

  it('navigates to writing page with topic state', async () => {
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <SavedPage />
      </BrowserRouter>
    );

    await user.click(screen.getByRole('button', { name: '글쓰기 시작하기' }));

    expect(mockNavigate).toHaveBeenCalledWith('/write/photo-1', {
      state: {
        photoId: 'photo-1',
        topic: '용기',
        imageUrl: 'data:image/jpeg;base64,edited',
      },
    });
  });
});
