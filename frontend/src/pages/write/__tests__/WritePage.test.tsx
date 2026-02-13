import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import WritePage from '../index';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('WritePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    (localStorage.getItem as unknown as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
      if (key === 'story_drafts') {
        return '[]';
      }
      return null;
    });
  });

  it('renders topic from location state', () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/write/photo-1',
            state: { photoId: 'photo-1', topic: '용기', imageUrl: 'data:image/jpeg;base64,x' },
          },
        ]}
      >
        <Routes>
          <Route path="/write/:photoId" element={<WritePage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('주제 #용기')).toBeInTheDocument();
  });

  it('saves draft and goes home', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/write/photo-1',
            state: { photoId: 'photo-1', topic: '용기' },
          },
        ]}
      >
        <Routes>
          <Route path="/write/:photoId" element={<WritePage />} />
        </Routes>
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText('스토리 초안'), '오늘은 용기를 내서 웃어봤다.');
    await user.click(screen.getByRole('button', { name: '초안 저장' }));

    expect(localStorage.setItem).toHaveBeenCalledWith(
      'story_drafts',
      expect.stringContaining('오늘은 용기를 내서 웃어봤다.')
    );
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
});
