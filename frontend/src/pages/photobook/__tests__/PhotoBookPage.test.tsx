import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import PhotoBookPage from '../index';

const { mockToPng, mockPdf, mockApiGet, mockJsPdfConstructor } = vi.hoisted(() => ({
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
  mockJsPdfConstructor: vi.fn(function MockJsPDF() {}),
}));

vi.mock('html-to-image', () => ({
  toPng: mockToPng,
}));

vi.mock('jspdf', () => ({
  jsPDF: mockJsPdfConstructor,
}));

vi.mock('@/services/api', () => ({
  default: {
    get: mockApiGet,
  },
}));

describe('PhotoBookPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockJsPdfConstructor.mockImplementation(function MockJsPDF() {
      return mockPdf;
    });

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

  async function selectPhotoAndOpenTemplates(user: ReturnType<typeof userEvent.setup>) {
    const thumbnail = await screen.findByRole('img', { name: '테스트 사진 선택' });
    const photoButton = thumbnail.closest('button');
    expect(photoButton).not.toBeNull();

    await user.click(photoButton as HTMLButtonElement);
    await user.click(screen.getByRole('button', { name: /1장으로 사진집 만들기/i }));
  }

  it('offers twenty photobook designs and four print sizes', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <PhotoBookPage />
      </MemoryRouter>,
    );

    await selectPhotoAndOpenTemplates(user);

    const templateNames = [
      '모던 화이트',
      '에디토리얼 매거진',
      '포토 스티커',
      '시네마 화보',
      '마이 다이어리',
      '아트 갤러리',
      '꿈꾸는 동화책',
      '컬러 스크랩북',
      '트래블 저널',
      '패밀리 앨범',
      '시티 트래블 매거진',
      '베이비 첫 기록',
      '웨딩 클래식',
      '우리들의 이어북',
      '반려동물 스토리',
      '사계절 컬렉션',
      '우리집 레시피',
      '레트로 필름 로그',
      '포토 코믹북',
      '생일 파티북',
    ];

    templateNames.forEach((name) => {
      expect(screen.getByRole('button', { name: new RegExp(`^${name}:`) })).toBeInTheDocument();
    });

    ['정사각 앨범', '세로 잡지', '가로 화보', '콤팩트 북'].forEach((name) => {
      expect(screen.getByRole('button', { name: new RegExp(name) })).toBeInTheDocument();
    });

    expect(screen.getByLabelText('표지 사진 추가')).toBeInTheDocument();
    expect(screen.getByLabelText('마지막 장 사진 추가')).toBeInTheDocument();
    expect(screen.getByLabelText('마지막 장 문구')).toBeInTheDocument();
  });

  it('uses separately uploaded cover and ending images with a custom ending message', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <PhotoBookPage />
      </MemoryRouter>,
    );

    await selectPhotoAndOpenTemplates(user);
    await user.upload(screen.getByLabelText('표지 사진 추가'), new File(['cover'], 'cover.jpg', { type: 'image/jpeg' }));
    await user.upload(screen.getByLabelText('마지막 장 사진 추가'), new File(['ending'], 'ending.jpg', { type: 'image/jpeg' }));
    await user.clear(screen.getByLabelText('마지막 장 문구'));
    await user.type(screen.getByLabelText('마지막 장 문구'), '다음 이야기도 함께해요');
    await user.click(screen.getByRole('button', { name: /모던 화이트 스타일로 미리보기/i }));

    const cover = await screen.findByRole('img', { name: '사진집 표지' });
    const ending = screen.getByRole('img', { name: '마지막 장 사진' });
    expect(cover).toHaveAttribute('src', expect.stringMatching(/^data:image\/jpeg;base64,/));
    expect(ending).toHaveAttribute('src', expect.stringMatching(/^data:image\/jpeg;base64,/));
    expect(screen.getByText('다음 이야기도 함께해요')).toBeInTheDocument();
  });

  it('exports photobook pages through DOM capture PDF flow', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter>
        <PhotoBookPage />
      </MemoryRouter>,
    );

    await screen.findByText('사진집에 넣을 사진을 선택하세요');
    expect(container.querySelector('img[src="https://example.com/thumb.jpg"]')).not.toBeNull();

    await selectPhotoAndOpenTemplates(user);
    await user.click(screen.getByRole('button', { name: /모던 화이트 스타일로 미리보기/i }));
    await user.click(screen.getByRole('button', { name: /PDF 다운로드/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('https://example.com/edited.jpg', { mode: 'cors', credentials: 'omit' });
      expect(mockToPng).toHaveBeenCalledTimes(3);
      expect(mockPdf.addImage).toHaveBeenCalledTimes(3);
      expect(mockPdf.addPage).toHaveBeenCalledTimes(2);
      expect(mockPdf.save).toHaveBeenCalledWith('2026년 나의 사진 이야기.pdf');
    });
  });

  it('exports a landscape photo book with the selected physical size', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <PhotoBookPage />
      </MemoryRouter>,
    );

    await selectPhotoAndOpenTemplates(user);
    await user.click(screen.getByRole('button', { name: /가로 화보/ }));
    await user.click(screen.getByRole('button', { name: /에디토리얼 매거진/ }));
    await user.click(screen.getByRole('button', { name: /에디토리얼 매거진 스타일로 미리보기/i }));
    await user.click(screen.getByRole('button', { name: /PDF 다운로드/i }));

    await waitFor(() => {
      expect(mockJsPdfConstructor).toHaveBeenCalledWith({
        orientation: 'landscape',
        unit: 'mm',
        format: [297, 210],
      });
      expect(mockToPng).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({ width: 1123, height: 794 }),
      );
    });
  });
});
