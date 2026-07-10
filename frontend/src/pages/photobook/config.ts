export type TemplateId =
  | 'minimal'
  | 'magazine'
  | 'polaroid'
  | 'cinematic'
  | 'diary'
  | 'gallery'
  | 'storybook'
  | 'scrapbook'
  | 'travel'
  | 'family';

export type TemplateLayout =
  | 'clean'
  | 'editorial'
  | 'instant'
  | 'cinema'
  | 'note'
  | 'art'
  | 'storybook'
  | 'scrapbook'
  | 'travel'
  | 'family';

export type PhotoBookTemplate = {
  id: TemplateId;
  name: string;
  category: string;
  mark: string;
  description: string;
  previewBg: string;
  previewAccent: string;
  previewSecondary: string;
  layout: TemplateLayout;
};

export const PHOTOBOOK_TEMPLATES: PhotoBookTemplate[] = [
  {
    id: 'minimal',
    name: '모던 화이트',
    category: '깔끔한 앨범',
    mark: '01',
    description: '여백과 사진이 또렷한 차분한 구성',
    previewBg: '#F7F5F0',
    previewAccent: '#2F2A24',
    previewSecondary: '#C9B79C',
    layout: 'clean',
  },
  {
    id: 'magazine',
    name: '에디토리얼 매거진',
    category: '잡지 형식',
    mark: 'M',
    description: '큰 제목과 칼럼이 있는 세련된 잡지',
    previewBg: '#171717',
    previewAccent: '#F0CC58',
    previewSecondary: '#A77B57',
    layout: 'editorial',
  },
  {
    id: 'polaroid',
    name: '포토 스티커',
    category: '귀여운 앨범',
    mark: '✦',
    description: '폴라로이드와 스티커로 꾸민 추억',
    previewBg: '#FFF4E8',
    previewAccent: '#D66D5A',
    previewSecondary: '#77A7A1',
    layout: 'instant',
  },
  {
    id: 'cinematic',
    name: '시네마 화보',
    category: '감성 화보',
    mark: '35',
    description: '한 장면처럼 깊고 선명한 영화 구성',
    previewBg: '#101010',
    previewAccent: '#FF7048',
    previewSecondary: '#786E67',
    layout: 'cinema',
  },
  {
    id: 'diary',
    name: '마이 다이어리',
    category: '기록 앨범',
    mark: 'N',
    description: '날짜와 글을 함께 남기는 따뜻한 일기',
    previewBg: '#FFF8EA',
    previewAccent: '#7B624A',
    previewSecondary: '#D5A86B',
    layout: 'note',
  },
  {
    id: 'gallery',
    name: '아트 갤러리',
    category: '전시 앨범',
    mark: 'A',
    description: '사진을 작품처럼 보여주는 전시 구성',
    previewBg: '#EFE8DE',
    previewAccent: '#292929',
    previewSecondary: '#80654B',
    layout: 'art',
  },
  {
    id: 'storybook',
    name: '꿈꾸는 동화책',
    category: '이야기 앨범',
    mark: '★',
    description: '사진마다 한 편의 장면이 되는 동화책',
    previewBg: '#EAF3FF',
    previewAccent: '#426B9B',
    previewSecondary: '#F28C72',
    layout: 'storybook',
  },
  {
    id: 'scrapbook',
    name: '컬러 스크랩북',
    category: '활기찬 앨범',
    mark: 'CUT',
    description: '색종이와 메모를 붙인 경쾌한 구성',
    previewBg: '#FFF5D8',
    previewAccent: '#C94755',
    previewSecondary: '#2D8D83',
    layout: 'scrapbook',
  },
  {
    id: 'travel',
    name: '트래블 저널',
    category: '여행 앨범',
    mark: 'GO',
    description: '티켓과 장소 기록을 담은 여행 잡지',
    previewBg: '#E9F1EB',
    previewAccent: '#315E58',
    previewSecondary: '#E0724B',
    layout: 'travel',
  },
  {
    id: 'family',
    name: '패밀리 앨범',
    category: '가족 앨범',
    mark: '家',
    description: '함께한 날을 밝고 포근하게 모은 앨범',
    previewBg: '#F7EFEF',
    previewAccent: '#7D3945',
    previewSecondary: '#49756C',
    layout: 'family',
  },
];

export type BookFormatId = 'square' | 'portrait' | 'landscape' | 'compact';

export type BookFormat = {
  id: BookFormatId;
  name: string;
  shortName: string;
  description: string;
  widthMm: number;
  heightMm: number;
};

export const PHOTOBOOK_FORMATS: BookFormat[] = [
  {
    id: 'square',
    name: '정사각 앨범',
    shortName: '정사각',
    description: '210 × 210 mm',
    widthMm: 210,
    heightMm: 210,
  },
  {
    id: 'portrait',
    name: '세로 잡지',
    shortName: 'A4 세로',
    description: '210 × 297 mm',
    widthMm: 210,
    heightMm: 297,
  },
  {
    id: 'landscape',
    name: '가로 화보',
    shortName: 'A4 가로',
    description: '297 × 210 mm',
    widthMm: 297,
    heightMm: 210,
  },
  {
    id: 'compact',
    name: '콤팩트 북',
    shortName: 'A5 세로',
    description: '148 × 210 mm',
    widthMm: 148,
    heightMm: 210,
  },
];

export const DEFAULT_PHOTOBOOK_FORMAT = PHOTOBOOK_FORMATS[1];

export function isLandscapeFormat(format: BookFormat): boolean {
  return format.widthMm > format.heightMm;
}

export function getExportPixelSize(format: BookFormat): { width: number; height: number } {
  if (format.widthMm === format.heightMm) {
    return { width: 900, height: 900 };
  }

  const longEdge = 1123;
  if (isLandscapeFormat(format)) {
    return {
      width: longEdge,
      height: Math.round(longEdge * (format.heightMm / format.widthMm)),
    };
  }

  return {
    width: Math.round(longEdge * (format.widthMm / format.heightMm)),
    height: longEdge,
  };
}
