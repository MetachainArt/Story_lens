import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import SelectPage from '../index';
import { useCameraStore } from '@/stores/camera';
import sessionsService from '@/services/sessions';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/services/sessions', () => ({
  default: {
    list: vi.fn(),
  },
}));

class MockFileReader {
  public result: string | ArrayBuffer | null = 'data:image/jpeg;base64,mock';
  public onloadend: (() => void) | null = null;
  public onerror: (() => void) | null = null;

  readAsDataURL() {
    if (this.onloadend) {
      this.onloadend();
    }
  }
}

describe('SelectPage topic selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    useCameraStore.setState({
      sessionId: 'dev-session',
      capturedPhotos: [new Blob(['img'], { type: 'image/jpeg' })],
    });
    vi.mocked(sessionsService.list).mockResolvedValue([
      {
        id: 's1',
        user_id: 'u1',
        title: '봄 일정',
        date: '2026-03-10',
        location: '서울숲',
        keywords: ['봄꽃', '산책'],
        created_at: '2026-03-01T00:00:00Z',
      },
    ]);
    vi.stubGlobal('FileReader', MockFileReader as unknown as typeof FileReader);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  });

  it('saves selected suggested topic before moving to editor', async () => {
    render(
      <MemoryRouter>
        <SelectPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '#봄꽃' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '#봄꽃' }));
    fireEvent.click(screen.getByRole('button', { name: /이 사진 편집하기/i }));

    expect(sessionStorage.getItem('selected_topic')).toBe('봄꽃');
    expect(mockNavigate).toHaveBeenCalledWith('/edit/dev-photo');
  });

  it('uses custom topic input when provided', async () => {
    render(
      <MemoryRouter>
        <SelectPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(sessionsService.list).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByLabelText('직접 주제 입력'), {
      target: { value: '용기' },
    });
    fireEvent.click(screen.getByRole('button', { name: /이 사진 편집하기/i }));

    expect(sessionStorage.getItem('selected_topic')).toBe('용기');
  });
});
