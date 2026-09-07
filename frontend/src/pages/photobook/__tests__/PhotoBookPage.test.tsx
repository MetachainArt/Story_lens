import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import PhotoBookPage from '../index';

const photoFixtures = [
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
  {
    id: 'photo-2',
    session_id: 'session-1',
    user_id: 'user-1',
    original_url: 'https://example.com/original-2.jpg',
    edited_url: 'https://example.com/edited-2.jpg',
    title: '두 번째 사진',
    topic: '여름날',
    thumbnail_url: 'https://example.com/thumb-2.jpg',
    content: '바닷가에서 보낸 오후',
    music_url: null,
    created_at: '2026-06-12T09:00:00.000Z',
    updated_at: '2026-06-12T09:00:00.000Z',
  },
  {
    id: 'photo-3',
    session_id: 'session-1',
    user_id: 'user-1',
    original_url: 'https://example.com/original-3.jpg',
    edited_url: 'https://example.com/edited-3.jpg',
    title: '세 번째 사진',
    topic: '가을날',
    thumbnail_url: 'https://example.com/thumb-3.jpg',
    content: '단풍길을 함께 걸었던 날',
    music_url: null,
    created_at: '2026-10-18T09:00:00.000Z',
    updated_at: '2026-10-18T09:00:00.000Z',
  },
];

const { mockToPng, mockPdf, mockApiGet, mockApiPost, mockJsPdfConstructor } = vi.hoisted(() => ({
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
  mockApiPost: vi.fn(),
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
    post: mockApiPost,
  },
}));

describe('PhotoBookPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockJsPdfConstructor.mockImplementation(function MockJsPDF() {
      return mockPdf;
    });

    mockApiGet.mockResolvedValue({
      data: { items: photoFixtures.slice(0, 1), next_offset: null },
    });
    mockApiPost.mockImplementation((url: string) => Promise.resolve({
      data: url.includes('photo-2')
        ? { title: '바다를 마주한 오후', content: '푸른 바다 앞에서 여름의 바람을 느끼는 장면입니다.', source: 'gemini' }
        : url.includes('photo-3')
          ? { title: '단풍길의 동행', content: '붉게 물든 길을 나란히 걷는 가을의 기록입니다.', source: 'gemini' }
          : { title: '벚꽃 아래 웃음', content: '봄빛 아래 환하게 웃는 순간을 담았습니다.', source: 'gemini' },
    }));

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
    await user.click(screen.getByRole('button', { name: '표지로 선택: 테스트 사진' }));
    await user.click(screen.getByRole('button', { name: '마지막 장으로 선택: 테스트 사진' }));
  }

  it('loads older photos without losing the current selection and allows retry', async () => {
    const user = userEvent.setup();
    const photo = { id: 'first', title: '첫 사진', original_url: '/first.jpg', created_at: '2026-01-01' };
    mockApiGet.mockResolvedValueOnce({ data: { items: [photo, ...Array.from({ length: 49 }, (_, index) => ({ ...photo, id: `filler-${index}`, title: `사진 ${index}` }))], next_offset: 50 } });
    mockApiGet.mockRejectedValueOnce(new Error('Network Error'));
    mockApiGet.mockResolvedValueOnce({ data: { items: [photo, { ...photo, id: 'older', title: '오래된 사진' }], next_offset: null } });
    render(<MemoryRouter><PhotoBookPage /></MemoryRouter>);
    await user.click(await screen.findByRole('button', { name: '첫 사진 선택' }));
    await user.click(screen.getByRole('button', { name: '사진 더 보기' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('다음 사진');
    expect(screen.getByRole('button', { name: '첫 사진 선택' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: '사진 더 보기' }));
    await user.click(await screen.findByRole('button', { name: '오래된 사진 선택' }));
    expect(screen.getByText('2장 선택')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '첫 사진 선택' })).toHaveLength(1);
    expect(mockApiGet).toHaveBeenLastCalledWith('/api/v1/photos/page', { params: { offset: 50, limit: 50 } });
  });

  it('offers twenty-eight photobook designs, curated collections, and four print sizes', async () => {
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
      '내추럴 보태니컬',
      '블랙 앤 화이트',
      '한옥의 하루',
      '오션 블루',
      '캠핑 로그',
      '졸업 컬렉션',
      '우정 스냅',
      '뮤직 플레이리스트',
    ];

    templateNames.slice(0, 12).forEach((name) => {
      expect(screen.getByRole('button', { name: new RegExp(`^${name}:`) })).toBeInTheDocument();
    });
    templateNames.slice(12).forEach((name) => {
      expect(screen.queryByRole('button', { name: new RegExp(`^${name}:`) })).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: '전체 28개 디자인 펼쳐보기' }));

    templateNames.forEach((name) => {
      expect(screen.getByRole('button', { name: new RegExp(`^${name}:`) })).toBeInTheDocument();
    });

    ['정사각 앨범', '세로 잡지', '가로 화보', '콤팩트 북'].forEach((name) => {
      expect(screen.getByRole('button', { name: new RegExp(name) })).toBeInTheDocument();
    });

    ['전체', '모던', '일상', '여행', '가족·성장', '기념', '재미'].forEach((name) => {
      expect(screen.getByRole('button', { name: new RegExp(`^${name} \\d+개 보기$`) })).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: '표지 디자인 골라보기' })).toBeInTheDocument();
    expect(screen.getByLabelText('선택한 사진집 미리보기')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '나의 사진을 한 권의 작품으로' })).toBeInTheDocument();
    expect(screen.getByText('28가지 디자인')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '표지와 마지막 장 사진 정하기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '표지로 선택: 테스트 사진' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '마지막 장으로 선택: 테스트 사진' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('마지막 장 문구')).toBeInTheDocument();
  });

  it('filters photobook designs by collection without losing the selected design', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <PhotoBookPage />
      </MemoryRouter>,
    );

    await selectPhotoAndOpenTemplates(user);
    await user.click(screen.getByRole('button', { name: /^여행/ }));

    expect(screen.getByRole('button', { name: /^트래블 저널:/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^시티 트래블 매거진:/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^한옥의 하루:/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^오션 블루:/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^캠핑 로그:/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^모던 화이트:/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^트래블 저널:/ }));
    expect(screen.getByText('트래블 저널 선택됨')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /트래블 저널 스타일로 미리보기/i })).toBeInTheDocument();
  });

  it('keeps every selected photo in the body while using chosen cover and ending photos', async () => {
    const user = userEvent.setup();
    mockApiGet.mockResolvedValueOnce({ data: { items: photoFixtures, next_offset: null } });
    render(
      <MemoryRouter>
        <PhotoBookPage />
      </MemoryRouter>,
    );

    for (const photoName of ['테스트 사진', '두 번째 사진', '세 번째 사진']) {
      const thumbnail = await screen.findByRole('img', { name: `${photoName} 선택` });
      await user.click(thumbnail.closest('button') as HTMLButtonElement);
    }
    await user.click(screen.getByRole('button', { name: /3장으로 사진집 만들기/i }));

    await user.click(screen.getByRole('button', { name: '표지로 선택: 두 번째 사진' }));
    await user.click(screen.getByRole('button', { name: '마지막 장으로 선택: 세 번째 사진' }));
    await user.clear(screen.getByLabelText('마지막 장 문구'));
    await user.type(screen.getByLabelText('마지막 장 문구'), '다음 이야기도 함께해요');
    await user.click(screen.getByRole('button', { name: /모던 화이트 스타일로 미리보기/i }));

    const cover = await screen.findByRole('img', { name: '사진집 표지' });
    const ending = screen.getByRole('img', { name: '마지막 장 사진' });
    expect(cover).toHaveAttribute('src', 'https://example.com/edited-2.jpg');
    expect(ending).toHaveAttribute('src', 'https://example.com/edited-3.jpg');
    expect(screen.getByRole('img', { name: '테스트 사진' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '두 번째 사진' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '세 번째 사진' })).toBeInTheDocument();
    expect(screen.getByText('다음 이야기도 함께해요')).toBeInTheDocument();
  });

  it('creates editable photo-specific copy, removes generic magazine labels, and preserves whole images', async () => {
    const user = userEvent.setup();
    const genericPhotos = photoFixtures.slice(0, 2).map((photo) => ({
      ...photo,
      title: 'AI 사진보정',
      topic: 'AI 사진보정',
      content: null,
    }));
    mockApiGet.mockResolvedValueOnce({ data: { items: genericPhotos, next_offset: null } });

    render(
      <MemoryRouter>
        <PhotoBookPage />
      </MemoryRouter>,
    );

    const choices = await screen.findAllByRole('img', { name: 'AI 사진보정 선택' });
    await user.click(choices[0].closest('button') as HTMLButtonElement);
    await user.click(choices[1].closest('button') as HTMLButtonElement);
    await user.click(screen.getByRole('button', { name: /2장으로 사진집 만들기/i }));

    expect(await screen.findByDisplayValue('벚꽃 아래 웃음')).toBeInTheDocument();
    expect(await screen.findByDisplayValue('바다를 마주한 오후')).toBeInTheDocument();
    expect(mockApiPost).toHaveBeenCalledWith('/api/v1/photos/photo-1/photobook-copy', { sequence: 1 });
    expect(mockApiPost).toHaveBeenCalledWith('/api/v1/photos/photo-2/photobook-copy', { sequence: 2 });

    const secondTitle = screen.getByLabelText('사진 2 제목');
    const secondContent = screen.getByLabelText('사진 2 내용');
    await user.clear(secondTitle);
    await user.type(secondTitle, '우리가 함께 선 자리');
    await user.clear(secondContent);
    await user.type(secondContent, '무대 위에서 나란히 웃었던 특별한 하루입니다.');

    await user.click(screen.getByRole('button', { name: /^에디토리얼 매거진:/ }));
    await user.click(screen.getAllByRole('button', { name: '표지로 선택: AI 사진보정' })[0]);
    await user.click(screen.getAllByRole('button', { name: '마지막 장으로 선택: AI 사진보정' })[1]);
    await user.click(screen.getByRole('button', { name: /에디토리얼 매거진 스타일로 미리보기/i }));

    expect((await screen.findAllByText('우리가 함께 선 자리')).length).toBeGreaterThan(0);
    expect(screen.getByText('무대 위에서 나란히 웃었던 특별한 하루입니다.')).toBeInTheDocument();
    expect(screen.queryByText('잡지 형식')).not.toBeInTheDocument();
    expect(screen.getAllByText('꿈꾸는 카메라').length).toBeGreaterThan(0);

    const bodyImages = document.querySelectorAll('.photobook-spread-photo img');
    expect(bodyImages.length).toBeGreaterThan(0);
    bodyImages.forEach((image) => {
      expect(image).toHaveClass('photobook-image--contain');
    });
    expect(screen.getByRole('img', { name: '사진집 표지' })).toHaveClass('photobook-image--contain');
    expect(screen.getByRole('img', { name: '마지막 장 사진' })).toHaveClass('photobook-image--contain');
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
