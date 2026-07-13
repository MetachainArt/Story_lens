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
  | 'family'
  | 'city-magazine'
  | 'baby'
  | 'wedding'
  | 'yearbook'
  | 'pet'
  | 'season'
  | 'recipe'
  | 'retro'
  | 'comic'
  | 'celebration';

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
  | 'family'
  | 'city'
  | 'baby'
  | 'wedding'
  | 'yearbook'
  | 'pet'
  | 'season'
  | 'recipe'
  | 'retro'
  | 'comic'
  | 'celebration';

export type SpreadLayout = 'hero' | 'duo' | 'trio' | 'grid4' | 'story-strip' | 'collage';

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
  layoutSequence: SpreadLayout[];
  decorations: string[];
  isDark?: boolean;
};

export const PHOTOBOOK_TEMPLATES: PhotoBookTemplate[] = [
  {
    id: 'minimal', name: '모던 화이트', category: '깔끔한 앨범', mark: '01',
    description: '여백과 사진이 또렷한 차분한 구성', previewBg: '#F7F5F0', previewAccent: '#2F2A24',
    previewSecondary: '#C9B79C', layout: 'clean', layoutSequence: ['hero', 'duo', 'trio', 'grid4'], decorations: ['·', '○'],
  },
  {
    id: 'magazine', name: '에디토리얼 매거진', category: '잡지 형식', mark: 'M',
    description: '큰 제목과 칼럼이 있는 세련된 잡지', previewBg: '#171717', previewAccent: '#F0CC58',
    previewSecondary: '#A77B57', layout: 'editorial', layoutSequence: ['hero', 'story-strip', 'duo', 'grid4'], decorations: ['✦', '●'], isDark: true,
  },
  {
    id: 'polaroid', name: '포토 스티커', category: '귀여운 앨범', mark: '✦',
    description: '폴라로이드와 스티커로 꾸민 추억', previewBg: '#FFF4E8', previewAccent: '#D66D5A',
    previewSecondary: '#77A7A1', layout: 'instant', layoutSequence: ['collage', 'duo', 'grid4'], decorations: ['🌼', '♥', '✦'],
  },
  {
    id: 'cinematic', name: '시네마 화보', category: '감성 화보', mark: '35',
    description: '한 장면처럼 깊고 선명한 영화 구성', previewBg: '#101010', previewAccent: '#FF7048',
    previewSecondary: '#786E67', layout: 'cinema', layoutSequence: ['hero', 'story-strip', 'duo'], decorations: ['●', '▶'], isDark: true,
  },
  {
    id: 'diary', name: '마이 다이어리', category: '기록 앨범', mark: 'N',
    description: '날짜와 글을 함께 남기는 따뜻한 일기', previewBg: '#FFF8EA', previewAccent: '#7B624A',
    previewSecondary: '#D5A86B', layout: 'note', layoutSequence: ['duo', 'story-strip', 'hero'], decorations: ['✎', '☕', '♡'],
  },
  {
    id: 'gallery', name: '아트 갤러리', category: '전시 앨범', mark: 'A',
    description: '사진을 작품처럼 보여주는 전시 구성', previewBg: '#EFE8DE', previewAccent: '#292929',
    previewSecondary: '#80654B', layout: 'art', layoutSequence: ['hero', 'grid4', 'duo'], decorations: ['□', '—'],
  },
  {
    id: 'storybook', name: '꿈꾸는 동화책', category: '이야기 앨범', mark: '★',
    description: '사진마다 한 편의 장면이 되는 동화책', previewBg: '#EAF3FF', previewAccent: '#426B9B',
    previewSecondary: '#F28C72', layout: 'storybook', layoutSequence: ['hero', 'trio', 'story-strip'], decorations: ['☁', '★', '🌈'],
  },
  {
    id: 'scrapbook', name: '컬러 스크랩북', category: '활기찬 앨범', mark: 'CUT',
    description: '색종이와 메모를 붙인 경쾌한 구성', previewBg: '#FFF5D8', previewAccent: '#C94755',
    previewSecondary: '#2D8D83', layout: 'scrapbook', layoutSequence: ['collage', 'grid4', 'duo'], decorations: ['✂', '🌿', '✦'],
  },
  {
    id: 'travel', name: '트래블 저널', category: '여행 앨범', mark: 'GO',
    description: '티켓과 장소 기록을 담은 여행 잡지', previewBg: '#E9F1EB', previewAccent: '#315E58',
    previewSecondary: '#E0724B', layout: 'travel', layoutSequence: ['hero', 'grid4', 'story-strip'], decorations: ['✈', '⌖', '☀'],
  },
  {
    id: 'family', name: '패밀리 앨범', category: '가족 앨범', mark: '家',
    description: '함께한 날을 밝고 포근하게 모은 앨범', previewBg: '#F7EFEF', previewAccent: '#7D3945',
    previewSecondary: '#49756C', layout: 'family', layoutSequence: ['hero', 'duo', 'grid4'], decorations: ['♥', '⌂', '🌿'],
  },
  {
    id: 'city-magazine', name: '시티 트래블 매거진', category: '도시 여행', mark: 'CITY',
    description: '도시의 표정과 골목을 담는 여행 특집', previewBg: '#E9EDF0', previewAccent: '#1F3A4A',
    previewSecondary: '#E45D3B', layout: 'city', layoutSequence: ['duo', 'hero', 'trio', 'grid4'], decorations: ['⌂', '→', '✦'],
  },
  {
    id: 'baby', name: '베이비 첫 기록', category: '성장 앨범', mark: 'BABY',
    description: '작은 표정과 성장 순간을 포근하게 기록', previewBg: '#FFF7F2', previewAccent: '#C96F75',
    previewSecondary: '#8BB8B1', layout: 'baby', layoutSequence: ['hero', 'duo', 'collage'], decorations: ['☁', '🧸', '♡'],
  },
  {
    id: 'wedding', name: '웨딩 클래식', category: '기념 앨범', mark: 'VOW',
    description: '우아한 여백과 섬세한 장식의 기념 화보', previewBg: '#F8F5F0', previewAccent: '#725D67',
    previewSecondary: '#B7A17C', layout: 'wedding', layoutSequence: ['hero', 'duo', 'story-strip'], decorations: ['♡', '❀', '∞'],
  },
  {
    id: 'yearbook', name: '우리들의 이어북', category: '학교·모임', mark: '26',
    description: '친구들의 표정과 한마디가 모이는 기록집', previewBg: '#EDF2F8', previewAccent: '#31598A',
    previewSecondary: '#E3A53F', layout: 'yearbook', layoutSequence: ['grid4', 'story-strip', 'duo'], decorations: ['★', '✓', '✎'],
  },
  {
    id: 'pet', name: '반려동물 스토리', category: '반려 앨범', mark: 'PAW',
    description: '사랑스러운 표정과 일상을 발랄하게 구성', previewBg: '#F2F6EA', previewAccent: '#477151',
    previewSecondary: '#F28B54', layout: 'pet', layoutSequence: ['hero', 'collage', 'duo'], decorations: ['🐾', '♥', '✦'],
  },
  {
    id: 'season', name: '사계절 컬렉션', category: '계절 앨범', mark: '4S',
    description: '봄·여름·가을·겨울의 색을 한 권에 정리', previewBg: '#F4F1E8', previewAccent: '#3C6B62',
    previewSecondary: '#D85B4B', layout: 'season', layoutSequence: ['grid4', 'hero', 'duo'], decorations: ['❀', '☀', '🍂', '❄'],
  },
  {
    id: 'recipe', name: '우리집 레시피', category: '음식 기록', mark: 'RECIPE',
    description: '요리 과정과 완성 사진을 잡지처럼 배치', previewBg: '#FFF9EE', previewAccent: '#A6422B',
    previewSecondary: '#63825A', layout: 'recipe', layoutSequence: ['duo', 'story-strip', 'grid4'], decorations: ['✦', '＋', '☕'],
  },
  {
    id: 'retro', name: '레트로 필름 로그', category: '필름 감성', mark: '24',
    description: '필름 프레임과 날짜가 있는 빈티지 기록', previewBg: '#E9DCC8', previewAccent: '#8B3A2E',
    previewSecondary: '#2E5A56', layout: 'retro', layoutSequence: ['story-strip', 'duo', 'collage'], decorations: ['●', '✦', 'REC'],
  },
  {
    id: 'comic', name: '포토 코믹북', category: '재미있는 앨범', mark: 'WOW',
    description: '말풍선과 칸 구성으로 만드는 유쾌한 이야기', previewBg: '#FFF1C9', previewAccent: '#243D8F',
    previewSecondary: '#E64335', layout: 'comic', layoutSequence: ['grid4', 'trio', 'hero'], decorations: ['WOW!', '★', '💬'],
  },
  {
    id: 'celebration', name: '생일 파티북', category: '축하 앨범', mark: 'HBD',
    description: '케이크와 색종이 장식이 가득한 축하 기록', previewBg: '#FFF0F4', previewAccent: '#C54372',
    previewSecondary: '#4A88A7', layout: 'celebration', layoutSequence: ['collage', 'hero', 'grid4'], decorations: ['🎂', '🎉', '★'],
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
  { id: 'square', name: '정사각 앨범', shortName: '정사각', description: '210 × 210 mm', widthMm: 210, heightMm: 210 },
  { id: 'portrait', name: '세로 잡지', shortName: 'A4 세로', description: '210 × 297 mm', widthMm: 210, heightMm: 297 },
  { id: 'landscape', name: '가로 화보', shortName: 'A4 가로', description: '297 × 210 mm', widthMm: 297, heightMm: 210 },
  { id: 'compact', name: '콤팩트 북', shortName: 'A5 세로', description: '148 × 210 mm', widthMm: 148, heightMm: 210 },
];

export const DEFAULT_PHOTOBOOK_FORMAT = PHOTOBOOK_FORMATS[1];

export function isLandscapeFormat(format: BookFormat): boolean {
  return format.widthMm > format.heightMm;
}

export function getExportPixelSize(format: BookFormat): { width: number; height: number } {
  if (format.widthMm === format.heightMm) return { width: 900, height: 900 };

  const longEdge = 1123;
  if (isLandscapeFormat(format)) {
    return { width: longEdge, height: Math.round(longEdge * (format.heightMm / format.widthMm)) };
  }

  return { width: Math.round(longEdge * (format.widthMm / format.heightMm)), height: longEdge };
}
