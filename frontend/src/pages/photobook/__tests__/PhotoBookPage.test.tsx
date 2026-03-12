import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import PhotoBookPage from '../index';

const { mockToPng, mockPdf, mockApiGet } = vi.hoisted(() => ({
  mockToPng: vi.fn(),
  mockPdf: {
    internal: {
      pageSize: {
        getWidth: () => 210,
        getHeight: () => 297,
      },
    },
    addPage: vi.fn(),
    addImage: vi.fn(),
    save: vi.fn(),
  },
  mockApiGet: vi.fn(),
}));

vi.mock('html-to-image', () => ({
  toPng: mockToPng,
}));

vi.mock('jspdf', () => ({
  jsPDF: function MockJsPDF() {
    return mockPdf;
  },
}));

vi.mock('@/services/api', () => ({
  default: {
    get: mockApiGet,
  },
}));

describe('PhotoBookPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockApiGet.mockResolvedValue({
      data: [
        {
          id: 'photo-1',
          session_id: 'session-1',
          user_id: 'user-1',
          original_url: 'https://example.com/original.jpg',
          edited_url: 'https://example.com/edited.jpg',
          title: '테스트 사진',
          topic: '봄날',
          thumbnail_url: 'https://example.com/thumb.jpg',
          content: '벚꽃 아래에서 웃었던 날',
          music_url: null,
          created_at: '2026-03-10T09:00:00.000Z',
          updated_at: '2026-03-10T09:00:00.000Z',
        },
      ],
    });

    mockToPng.mockResolvedValue('data:image/png;base64,canvas-image');

    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { ready: Promise.resolve() },
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        blob: async () => new Blob(['image-bytes'], { type: 'image/jpeg' }),
      }),
    );
  });

  it('exports photobook pages through DOM capture PDF flow', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter>
        <PhotoBookPage />
      </MemoryRouter>,
    );

    await screen.findByText('사진집에 넣을 사진을 선택하세요');

    const thumbnail = container.querySelector('img[src="https://example.com/thumb.jpg"]');
    expect(thumbnail).not.toBeNull();
    const photoButton = thumbnail?.closest('button');
    expect(photoButton).not.toBeNull();

    await user.click(photoButton as HTMLButtonElement);
    await user.click(screen.getByRole('button', { name: /1장으로 사진집 만들기/i }));
    await user.click(screen.getByRole('button', { name: /미니멀 스타일로 미리보기/i }));
    await user.click(screen.getByRole('button', { name: /PDF 다운로드/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('https://example.com/edited.jpg', { mode: 'cors', credentials: 'omit' });
      expect(mockToPng).toHaveBeenCalledTimes(2);
      expect(mockPdf.addImage).toHaveBeenCalledTimes(2);
      expect(mockPdf.addPage).toHaveBeenCalledTimes(1);
      expect(mockPdf.save).toHaveBeenCalledWith('2026년 나의 사진 이야기.pdf');
    });
  });
});
