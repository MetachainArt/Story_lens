import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SavedPage from '../index';
import { useEditorStore } from '@/stores/editor';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: vi.fn(),
  };
});

vi.mock('@/stores/editor', () => ({ useEditorStore: vi.fn() }));

function setLocation(state: unknown) {
  vi.mocked(useLocation).mockReturnValue({
    pathname: '/saved',
    search: '',
    hash: '',
    state,
    key: 'saved-test',
  });
}

function setEditor(photoId: string | null, originalUrl: string) {
  vi.mocked(useEditorStore).mockReturnValue({ photoId, originalUrl } as ReturnType<typeof useEditorStore>);
}

function renderPage() {
  return render(
    <MemoryRouter>
      <SavedPage />
    </MemoryRouter>,
  );
}

describe('SavedPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setEditor('photo-1', 'https://cdn.example.com/original.jpg');
    setLocation({
      photoId: 'photo-1',
      editedUrl: 'data:image/jpeg;base64,edited',
      topic: '용기',
    });
  });

  it('shows completion, the edited image, and its topic', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: '완료!' })).toBeInTheDocument();
    expect(screen.getByAltText('편집 사진')).toHaveAttribute(
      'src',
      'data:image/jpeg;base64,edited',
    );
    expect(screen.getByText('#용기')).toBeInTheDocument();
  });

  it('uses the editor image when navigation state has no edited image', () => {
    setLocation(null);
    renderPage();

    expect(screen.getByAltText('편집 사진')).toHaveAttribute(
      'src',
      'https://cdn.example.com/original.jpg',
    );
  });

  it('routes home, edit, and writing commands', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: '홈으로' }));
    expect(mockNavigate).toHaveBeenCalledWith('/');
    await user.click(screen.getByRole('button', { name: '다시 편집' }));
    expect(mockNavigate).toHaveBeenCalledWith('/edit/photo-1');
    await user.click(screen.getByRole('button', { name: '글로 이어쓰기' }));
    expect(mockNavigate).toHaveBeenCalledWith('/write/photo-1', {
      state: {
        photoId: 'photo-1',
        topic: '용기',
        imageUrl: 'data:image/jpeg;base64,edited',
      },
    });
  });

  it('disables re-editing when there is no saved photo id', () => {
    setEditor(null, '');
    setLocation(null);
    renderPage();

    expect(screen.queryByAltText('편집 사진')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 편집' })).toBeDisabled();
  });
});
