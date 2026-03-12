import { useState, useEffect, useCallback, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Photo } from '@/types/photo';
import PageHeader from '@/components/common/PageHeader';
import { PrimaryButton, SecondaryButton } from '@/components/common/Button';
import { safeJsonArray, resolveImageUrl } from '@/utils/storage';
import api from '@/services/api';
import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

type BookPage = {
  photo: Photo;
  imageUrl: string;
  exportImageUrl?: string;
};

type TemplateRenderMode = 'preview' | 'export';

type TemplateId = 'minimal' | 'magazine' | 'polaroid' | 'cinematic' | 'diary' | 'gallery';

type Template = {
  id: TemplateId;
  name: string;
  emoji: string;
  description: string;
  previewBg: string;
  previewAccent: string;
};

const TEMPLATES: Template[] = [
  {
    id: 'minimal',
    name: '미니멀',
    emoji: '🤍',
    description: '깔끔한 여백과 정갈한 레이아웃',
    previewBg: '#FAFAFA',
    previewAccent: '#333333',
  },
  {
    id: 'magazine',
    name: '매거진',
    emoji: '📰',
    description: '세련된 잡지 스타일 편집',
    previewBg: '#1A1A1A',
    previewAccent: '#E8C547',
  },
  {
    id: 'polaroid',
    name: '폴라로이드',
    emoji: '📸',
    description: '따뜻한 감성의 즉석사진 스타일',
    previewBg: '#FFF8F0',
    previewAccent: '#C47550',
  },
  {
    id: 'cinematic',
    name: '시네마틱',
    emoji: '🎬',
    description: '영화 같은 와이드 구도',
    previewBg: '#0D0D0D',
    previewAccent: '#FF6B35',
  },
  {
    id: 'diary',
    name: '다이어리',
    emoji: '📖',
    description: '손글씨 느낌의 일기장 스타일',
    previewBg: '#FEF9EF',
    previewAccent: '#8B7355',
  },
  {
    id: 'gallery',
    name: '갤러리',
    emoji: '🖼️',
    description: '미술관의 액자 스타일',
    previewBg: '#F5F0EB',
    previewAccent: '#2C2C2C',
  },
];

const EXPORT_PAGE_WIDTH = 794;
const EXPORT_PAGE_HEIGHT = 1123;

function sanitizePdfFileName(value: string): string {
  const trimmed = value.trim();
  const safeValue = trimmed || 'photobook';
  return safeValue.replace(/[\\/:*?"<>|]/g, '_');
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('Failed to convert blob to data URL'));
    };
    reader.onerror = () => reject(new Error('Failed to read image blob'));
    reader.readAsDataURL(blob);
  });
}

async function fetchImageAsDataUrl(url: string): Promise<string> {
  if (!url) {
    throw new Error('Image URL is empty');
  }

  if (/^data:image\//i.test(url) || /^blob:/i.test(url)) {
    return url;
  }

  // Convert cross-origin API URLs to same-origin proxy paths
  // (Vite dev proxy + Vercel rewrite handle /uploads/* → API server)
  const apiBase = (import.meta.env.VITE_API_URL?.trim() || '').replace(/\/+$/, '');
  const proxyUrl = apiBase && url.startsWith(apiBase) ? url.slice(apiBase.length) : null;

  // Try same-origin proxy first (avoids CORS)
  if (proxyUrl) {
    try {
      const response = await fetch(proxyUrl);
      if (response.ok) {
        const blob = await response.blob();
        return blobToDataUrl(blob);
      }
    } catch {
      // Fall through to cross-origin attempt
    }
  }

  // Fallback: direct cross-origin fetch
  const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
  if (!response.ok) {
    throw new Error(`Image request failed: ${response.status}`);
  }

  const blob = await response.blob();
  return blobToDataUrl(blob);
}

function waitForNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

async function waitForContainerImages(container: HTMLElement): Promise<void> {
  const images = Array.from(container.querySelectorAll('img'));

  await Promise.all(
    images.map((img) => new Promise<void>((resolve) => {
      const source = img.currentSrc || img.src;

      if (img.complete || source.startsWith('data:image/') || source.startsWith('blob:')) {
        resolve();
        return;
      }

      const timeoutId = window.setTimeout(() => resolve(), 5000);
      const finish = () => {
        window.clearTimeout(timeoutId);
        resolve();
      };
      img.addEventListener('load', finish, { once: true });
      img.addEventListener('error', finish, { once: true });
    })),
  );
}

async function exportDomPagesToPdf(container: HTMLElement, fileName: string): Promise<void> {
  const pageElements = Array.from(container.querySelectorAll<HTMLElement>('[data-pdf-page="true"]'));
  if (pageElements.length === 0) {
    throw new Error('No exportable pages found');
  }

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  for (const [index, pageElement] of pageElements.entries()) {
    const imageData = await toPng(pageElement, {
      width: EXPORT_PAGE_WIDTH,
      height: EXPORT_PAGE_HEIGHT,
      pixelRatio: 2,
      backgroundColor: '#FFFFFF',
    });

    if (index > 0) {
      pdf.addPage();
    }
    pdf.addImage(imageData, 'PNG', 0, 0, pdfWidth, pdfHeight);
  }

  pdf.save(`${sanitizePdfFileName(fileName)}.pdf`);
}

/* ─── Template-specific Preview Renderers ─── */

type TemplatePreviewProps = {
  page: BookPage;
  index: number;
  total: number;
  mode?: TemplateRenderMode;
};

type PhotoBookCanvasProps = {
  mode: TemplateRenderMode;
  background: string;
  borderColor?: string;
  shadow?: string;
  previewMinHeight?: number;
  children: ReactNode;
};

type PhotoArtworkProps = {
  src: string;
  alt?: string;
  frameStyle?: CSSProperties;
  stageStyle?: CSSProperties;
  imageStyle?: CSSProperties;
};

function getPageMetrics(mode: TemplateRenderMode) {
  return mode === 'export'
    ? {
        padding: 56,
        gap: 22,
        title: 34,
        subtitle: 18,
        body: 18,
        meta: 13,
        tag: 14,
        radius: 32,
      }
    : {
        padding: 24,
        gap: 12,
        title: 20,
        subtitle: 12,
        body: 13,
        meta: 10,
        tag: 11,
        radius: 24,
      };
}

function getPageSummary(content: string | null | undefined, limit: number): string {
  const text = content?.trim();
  if (!text) {
    return '사진 속 분위기와 감정이 오래 남을 수 있도록 여백을 남겨 두었습니다.';
  }
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit).trimEnd()}...`;
}

function PhotoBookCanvas({
  mode,
  background,
  borderColor = 'rgba(120, 110, 94, 0.14)',
  shadow = '0 30px 80px rgba(15, 23, 42, 0.12)',
  previewMinHeight = 760,
  children,
}: PhotoBookCanvasProps) {
  const isPreview = mode === 'preview';

  return (
    <section
      style={{
        width: '100%',
        height: isPreview ? 'auto' : '100%',
        minHeight: isPreview ? previewMinHeight : undefined,
        aspectRatio: isPreview ? undefined : `${EXPORT_PAGE_WIDTH} / ${EXPORT_PAGE_HEIGHT}`,
        maxWidth: isPreview ? 540 : undefined,
        margin: isPreview ? '0 auto 18px' : undefined,
        borderRadius: isPreview ? 30 : 0,
        border: isPreview ? `1px solid ${borderColor}` : undefined,
        boxShadow: isPreview ? shadow : undefined,
        background,
        overflow: isPreview ? 'visible' : 'hidden',
        position: 'relative',
      }}
    >
      {children}
    </section>
  );
}

function PhotoArtwork({ src, alt = '', frameStyle, stageStyle, imageStyle }: PhotoArtworkProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, ...frameStyle }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          minHeight: 0,
          ...stageStyle,
        }}
      >
        <img
          src={src}
          alt={alt}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            objectPosition: 'center center',
            display: 'block',
            ...imageStyle,
          }}
        />
      </div>
    </div>
  );
}

function MinimalPreview({ page, index, total, mode = 'preview' }: TemplatePreviewProps) {
  const metrics = getPageMetrics(mode);
  const summary = getPageSummary(page.photo.content, mode === 'export' ? 220 : 220);

  return (
    <PhotoBookCanvas mode={mode} background="linear-gradient(180deg, #FCFBF7 0%, #F2EEE7 100%)" previewMinHeight={800}>
      <div
        style={{
          height: '100%',
          padding: metrics.padding,
          display: 'grid',
          gridTemplateRows: 'auto 1fr auto',
          gap: metrics.gap,
          color: '#2F2A24',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: metrics.meta, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#8B7F72' }}>
            Story Lens Edition
          </span>
          <span style={{ fontSize: metrics.meta, color: '#8B7F72' }}>
            {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </span>
        </div>

        <PhotoArtwork
          src={page.imageUrl}
          frameStyle={{
            background: '#E9E0D1',
            padding: mode === 'export' ? 18 : 10,
            borderRadius: metrics.radius,
            boxShadow: '0 22px 44px rgba(80, 62, 38, 0.14)',
            flex: 1,
          }}
          stageStyle={{
            background: 'linear-gradient(180deg, #FDFBF8 0%, #ECE4D8 100%)',
            borderRadius: metrics.radius - 8,
            flex: 1,
          }}
        />

        <div style={{ background: 'rgba(255,255,255,0.72)', borderRadius: metrics.radius - 8, padding: mode === 'export' ? 24 : 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, marginBottom: 10 }}>
            <div>
              {page.photo.topic && (
                <p style={{ fontFamily: 'var(--font-family-serif)', fontSize: metrics.title, fontWeight: 700, marginBottom: 6 }}>
                  {page.photo.topic}
                </p>
              )}
              <p style={{ fontSize: metrics.meta, color: '#8B7F72', letterSpacing: '0.12em' }}>{formatDate(page.photo.created_at)}</p>
            </div>
            <span style={{ fontSize: metrics.tag, color: '#6B5F52', padding: '6px 12px', borderRadius: 999, background: '#F4EBDC' }}>
              quiet frame
            </span>
          </div>
          <p style={{ fontSize: metrics.body, lineHeight: 1.8, color: '#544A40', whiteSpace: 'pre-wrap' }}>{summary}</p>
        </div>
      </div>
    </PhotoBookCanvas>
  );
}

function MagazinePreview({ page, index, total, mode = 'preview' }: TemplatePreviewProps) {
  const metrics = getPageMetrics(mode);
  const summary = getPageSummary(page.photo.content, mode === 'export' ? 170 : 190);

  return (
    <PhotoBookCanvas mode={mode} background="linear-gradient(160deg, #111111 0%, #1F1F1F 48%, #3B2C1F 100%)" borderColor="rgba(232, 197, 71, 0.22)" previewMinHeight={820}>
      <div
        style={{
          height: '100%',
          padding: metrics.padding,
          display: 'grid',
          gridTemplateRows: mode === 'preview' ? 'auto auto auto' : 'auto 1fr auto',
          gap: metrics.gap,
          color: '#F8F2E8',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: metrics.meta, color: '#E8C547', letterSpacing: '0.24em', textTransform: 'uppercase' }}>Photo Review</span>
          <span style={{ fontSize: metrics.meta, color: '#B9A68D' }}>{formatDate(page.photo.created_at)}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: mode === 'preview' ? '1fr' : 'minmax(0, 1.2fr) minmax(0, 0.85fr)', gap: metrics.gap, minHeight: 0 }}>
          <PhotoArtwork
            src={page.imageUrl}
            frameStyle={{
              background: 'rgba(255,255,255,0.06)',
              padding: mode === 'export' ? 16 : 10,
              borderRadius: metrics.radius,
              boxShadow: '0 24px 48px rgba(0,0,0,0.34)',
              minHeight: 0,
            }}
            stageStyle={{
              background: '#050505',
              borderRadius: metrics.radius - 10,
              aspectRatio: mode === 'preview' ? '4 / 3' : '3 / 4',
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 0, background: mode === 'preview' ? 'rgba(255,255,255,0.04)' : undefined, borderRadius: mode === 'preview' ? metrics.radius - 8 : undefined, padding: mode === 'preview' ? 16 : 0 }}>
            <div>
              {page.photo.topic && (
                <p style={{ fontFamily: 'var(--font-family-serif)', fontSize: metrics.title + (mode === 'export' ? 4 : 2), lineHeight: 1.05, fontWeight: 700, color: '#FFF7EE', marginBottom: 10 }}>
                  {page.photo.topic}
                </p>
              )}
              <p style={{ fontSize: metrics.body, lineHeight: 1.8, color: '#DDCFBE', whiteSpace: 'pre-wrap' }}>{summary}</p>
            </div>
            <div style={{ paddingTop: metrics.gap, borderTop: '1px solid rgba(232,197,71,0.22)' }}>
              <p style={{ fontSize: metrics.meta, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#E8C547', marginBottom: 8 }}>
                feature story {String(index + 1).padStart(2, '0')}
              </p>
              <p style={{ fontSize: metrics.meta, color: '#B9A68D', lineHeight: 1.7 }}>
                A generous frame lets the full photograph breathe while the story sits beside it like an editorial note.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: metrics.meta, color: '#B9A68D' }}>
          <span>{String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>
          <span style={{ letterSpacing: '0.18em', textTransform: 'uppercase' }}>Edition No. {String(total).padStart(2, '0')}</span>
        </div>
      </div>
    </PhotoBookCanvas>
  );
}

function PolaroidPreview({ page, index, total, mode = 'preview' }: TemplatePreviewProps) {
  const metrics = getPageMetrics(mode);
  const summary = getPageSummary(page.photo.content, mode === 'export' ? 140 : 140);
  const rotation = mode === 'export' ? (index % 3 - 1) * 2.4 : (index % 3 - 1) * 1.5;

  return (
    <PhotoBookCanvas mode={mode} background="linear-gradient(180deg, #FFF7ED 0%, #F4E6D1 100%)" borderColor="rgba(196, 117, 80, 0.2)" previewMinHeight={820}>
      <div style={{ height: '100%', padding: metrics.padding, display: 'grid', gridTemplateRows: 'auto 1fr auto', gap: metrics.gap }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: metrics.meta, color: '#A16B4E', letterSpacing: '0.16em', textTransform: 'uppercase' }}>instant memory</span>
          <span style={{ fontSize: metrics.meta, color: '#A16B4E' }}>{formatDate(page.photo.created_at)}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
          <div
            style={{
              width: mode === 'export' ? '78%' : '82%',
              background: '#FFFDF8',
              padding: mode === 'export' ? '22px 22px 72px' : '14px 14px 44px',
              borderRadius: 18,
              boxShadow: '0 26px 54px rgba(103, 74, 52, 0.18)',
              transform: `rotate(${rotation}deg)`,
            }}
          >
            <img
              src={page.imageUrl}
              alt=""
              style={{ width: '100%', aspectRatio: '4 / 5', objectFit: 'contain', display: 'block', background: '#EDE4D7', borderRadius: 10 }}
            />
            <div style={{ paddingTop: mode === 'export' ? 18 : 12, textAlign: 'center', color: '#5E4638' }}>
              {page.photo.topic && (
                <p style={{ fontFamily: 'var(--font-family-serif)', fontSize: metrics.title, fontWeight: 700, marginBottom: 8 }}>
                  {page.photo.topic}
                </p>
              )}
              <p style={{ fontSize: metrics.body, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{summary}</p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: metrics.meta, color: '#A16B4E' }}>
          <span>{String(index + 1).padStart(2, '0')} of {String(total).padStart(2, '0')}</span>
          <span style={{ letterSpacing: '0.12em', textTransform: 'uppercase' }}>kept with care</span>
        </div>
      </div>
    </PhotoBookCanvas>
  );
}

function CinematicPreview({ page, index, total, mode = 'preview' }: TemplatePreviewProps) {
  const metrics = getPageMetrics(mode);
  const summary = getPageSummary(page.photo.content, mode === 'export' ? 150 : 170);

  return (
    <PhotoBookCanvas mode={mode} background="radial-gradient(circle at top, #232323 0%, #0D0D0D 55%, #050505 100%)" borderColor="rgba(255,107,53,0.22)" previewMinHeight={820}>
      <div style={{ height: '100%', padding: metrics.padding, display: 'grid', gridTemplateRows: 'auto 1fr auto', gap: metrics.gap, color: '#F6EFE8' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: metrics.meta, letterSpacing: '0.24em', textTransform: 'uppercase', color: '#FF6B35' }}>scene {String(index + 1).padStart(2, '0')}</span>
          <span style={{ fontSize: metrics.meta, color: '#B3A49A' }}>{String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>
        </div>

        <PhotoArtwork
          src={page.imageUrl}
          frameStyle={{
            background: '#040404',
            padding: mode === 'export' ? 20 : 12,
            borderRadius: metrics.radius,
            boxShadow: '0 30px 64px rgba(0,0,0,0.34)',
            flex: 1,
          }}
          stageStyle={{
            background: '#111111',
            borderRadius: metrics.radius - 10,
            flex: 1,
          }}
          imageStyle={{ filter: 'contrast(1.04) saturate(0.95)' }}
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: metrics.gap, alignItems: 'end' }}>
          <div>
            {page.photo.topic && (
              <p style={{ fontFamily: 'var(--font-family-serif)', fontSize: metrics.title + (mode === 'export' ? 4 : 2), fontWeight: 700, color: '#FFF4EB', marginBottom: 8 }}>
                {page.photo.topic}
              </p>
            )}
            <p style={{ fontSize: metrics.body, lineHeight: 1.75, color: '#C2B4A8', whiteSpace: 'pre-wrap', fontStyle: 'italic' }}>
              {summary}
            </p>
          </div>
          <div style={{ minWidth: mode === 'export' ? 90 : 64, textAlign: 'right' }}>
            <p style={{ fontSize: metrics.meta, color: '#FF6B35', marginBottom: 6, letterSpacing: '0.16em', textTransform: 'uppercase' }}>take</p>
            <p style={{ fontSize: metrics.title + (mode === 'export' ? 10 : 6), lineHeight: 1, fontFamily: 'monospace', color: '#F6EFE8' }}>
              {String(index + 1).padStart(2, '0')}
            </p>
          </div>
        </div>
      </div>
    </PhotoBookCanvas>
  );
}

function DiaryPreview({ page, index, total, mode = 'preview' }: TemplatePreviewProps) {
  const metrics = getPageMetrics(mode);
  const summary = getPageSummary(page.photo.content, mode === 'export' ? 180 : 200);

  return (
    <PhotoBookCanvas mode={mode} background="linear-gradient(180deg, #FFF8ED 0%, #F6ECD8 100%)" borderColor="rgba(139, 115, 85, 0.18)" previewMinHeight={820}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0, transparent 42px, rgba(213,190,156,0.55) 43px)',
          opacity: 0.46,
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative', height: '100%', padding: metrics.padding, display: 'grid', gridTemplateRows: 'auto auto 1fr', gap: metrics.gap }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-family-serif)', fontSize: metrics.subtitle, color: '#7A624B', fontWeight: 700 }}>
            {formatDate(page.photo.created_at)}
          </span>
          <span style={{ fontSize: metrics.meta, color: '#A4896D' }}>page {index + 1}/{total}</span>
        </div>

        <PhotoArtwork
          src={page.imageUrl}
          frameStyle={{
            background: '#FFFDF8',
            padding: mode === 'export' ? 16 : 10,
            borderRadius: metrics.radius,
            boxShadow: '0 20px 42px rgba(105, 78, 48, 0.12)',
          }}
          stageStyle={{
            background: '#E9DDC8',
            borderRadius: metrics.radius - 10,
            aspectRatio: '4 / 3',
          }}
        />

        <div style={{ background: 'rgba(255,251,242,0.84)', borderRadius: metrics.radius - 8, padding: mode === 'export' ? 24 : 14, backdropFilter: 'blur(1px)' }}>
          {page.photo.topic && (
            <p style={{ fontFamily: 'var(--font-family-serif)', fontSize: metrics.title, fontWeight: 700, color: '#5A4A35', marginBottom: 10 }}>
              {page.photo.topic}
            </p>
          )}
          <p style={{ fontSize: metrics.body, color: '#6D5D4A', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>{summary}</p>
        </div>
      </div>
    </PhotoBookCanvas>
  );
}

function GalleryPreview({ page, index, total, mode = 'preview' }: TemplatePreviewProps) {
  const metrics = getPageMetrics(mode);
  const summary = getPageSummary(page.photo.content, mode === 'export' ? 160 : 180);

  return (
    <PhotoBookCanvas mode={mode} background="linear-gradient(180deg, #F5EFE7 0%, #EBE2D6 100%)" borderColor="rgba(44,44,44,0.12)" previewMinHeight={820}>
      <div style={{ height: '100%', padding: metrics.padding, display: 'grid', gridTemplateRows: 'auto 1fr auto', gap: metrics.gap }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#574A3D' }}>
          <span style={{ fontSize: metrics.meta, letterSpacing: '0.18em', textTransform: 'uppercase' }}>gallery selection</span>
          <span style={{ fontSize: metrics.meta }}>{formatDate(page.photo.created_at)}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
          <PhotoArtwork
            src={page.imageUrl}
            frameStyle={{
              width: mode === 'export' ? '80%' : '84%',
              background: 'linear-gradient(145deg, #795B3C 0%, #4A3726 100%)',
              padding: mode === 'export' ? 20 : 12,
              borderRadius: metrics.radius,
              boxShadow: '0 28px 64px rgba(45, 31, 18, 0.18)',
            }}
            stageStyle={{
              background: '#F6F0E8',
              padding: mode === 'export' ? 18 : 10,
              borderRadius: metrics.radius - 10,
              aspectRatio: '4 / 5',
            }}
          />
        </div>

        <div style={{ background: 'rgba(255,255,255,0.74)', borderRadius: metrics.radius - 8, padding: mode === 'export' ? 22 : 14, textAlign: 'center' }}>
          {page.photo.topic && (
            <p style={{ fontFamily: 'var(--font-family-serif)', fontSize: metrics.title, fontWeight: 700, color: '#2C2C2C', marginBottom: 8 }}>
              {page.photo.topic}
            </p>
          )}
          <p style={{ fontSize: metrics.meta, color: '#756757', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>
            plate {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </p>
          <p style={{ fontSize: metrics.body, color: '#554B41', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{summary}</p>
        </div>
      </div>
    </PhotoBookCanvas>
  );
}

/* ─── Main Component ─── */

export default function PhotoBookPage() {
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [step, setStep] = useState<'select' | 'template' | 'preview' | 'generating'>('select');
  const [bookTitle, setBookTitle] = useState('');
  const [bookPages, setBookPages] = useState<BookPage[]>([]);
  const [exportPages, setExportPages] = useState<BookPage[]>([]);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>('minimal');
  const exportContainerRef = useRef<HTMLDivElement | null>(null);

  const loadPhotos = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/api/v1/photos');
      const data = Array.isArray(response.data) ? response.data : [];
      setPhotos(data);
    } catch {
      const saved = safeJsonArray<{
        id?: unknown;
        edited_url?: unknown;
        topic?: unknown;
        created_at?: unknown;
      }>(localStorage.getItem('saved_photos'));

      const local: Photo[] = saved
        .filter(
          (item): item is { id: string; edited_url: string; topic: string | null; created_at: string } =>
            !!item &&
            typeof item === 'object' &&
            typeof item.id === 'string' &&
            typeof item.edited_url === 'string' &&
            typeof item.created_at === 'string',
        )
        .map((item) => ({
          id: item.id,
          session_id: 'local',
          user_id: 'local',
          original_url: item.edited_url,
          edited_url: item.edited_url,
          title: null,
          topic: typeof item.topic === 'string' ? item.topic : null,
          thumbnail_url: item.edited_url,
          content: null,
          music_url: null,
          created_at: item.created_at,
          updated_at: item.created_at,
        }));
      setPhotos(local);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const goToTemplateSelect = () => {
    if (!bookTitle.trim()) {
      const now = new Date();
      setBookTitle(`${now.getFullYear()}년 나의 사진 이야기`);
    }
    setExportError(null);
    setStep('template');
  };

  const goToPreview = () => {
    const selected = photos.filter((p) => selectedIds.has(p.id));
    const pages: BookPage[] = selected.map((photo) => ({
      photo,
      imageUrl: resolveImageUrl(photo.edited_url || photo.thumbnail_url || photo.original_url),
    }));
    setExportError(null);
    setBookPages(pages);
    setStep('preview');
  };

  const handleGeneratePDF = async () => {
    setStep('generating');
    setExportError(null);
    setExportProgress(`이미지 준비 중... (0/${bookPages.length})`);

    try {
      // Fetch images individually - skip failures instead of aborting
      const preparedPages: BookPage[] = [];
      for (const [i, page] of bookPages.entries()) {
        setExportProgress(`이미지 준비 중... (${i + 1}/${bookPages.length})`);
        try {
          const exportImageUrl = await fetchImageAsDataUrl(page.imageUrl);
          preparedPages.push({ ...page, exportImageUrl });
        } catch {
          // Use original URL as fallback if conversion fails
          preparedPages.push(page);
        }
      }

      setExportProgress('PDF 렌더링 중...');
      setExportPages(preparedPages);
      await waitForNextPaint();

      // Ensure fonts are fully loaded before rendering when supported
      if ('fonts' in document) {
        await document.fonts.ready;
      }

      const exportContainer = exportContainerRef.current;
      if (!exportContainer) {
        throw new Error('Export container is not ready');
      }

      await waitForContainerImages(exportContainer);
      await exportDomPagesToPdf(exportContainer, bookTitle || 'photobook');
    } catch (error) {
      setExportError(
        error instanceof Error
          ? `PDF 생성에 실패했어요. ${error.message}`
          : 'PDF 생성에 실패했어요. 잠시 후 다시 시도해주세요.',
      );
    } finally {
      setExportPages([]);
      setExportProgress('');
      setStep('preview');
    }
  };

  const handleBack = () => {
    if (step === 'preview') setStep('template');
    else if (step === 'template') setStep('select');
    else navigate(-1);
  };

  const stepTitle = step === 'select'
    ? '사진집 만들기'
    : step === 'template'
      ? '템플릿 선택'
      : '미리보기';

  const renderPreviewPage = (
    page: BookPage,
    index: number,
    total: number,
    mode: TemplateRenderMode = 'preview',
  ) => {
    switch (selectedTemplate) {
      case 'minimal': return <MinimalPreview key={page.photo.id} page={page} index={index} total={total} mode={mode} />;
      case 'magazine': return <MagazinePreview key={page.photo.id} page={page} index={index} total={total} mode={mode} />;
      case 'polaroid': return <PolaroidPreview key={page.photo.id} page={page} index={index} total={total} mode={mode} />;
      case 'cinematic': return <CinematicPreview key={page.photo.id} page={page} index={index} total={total} mode={mode} />;
      case 'diary': return <DiaryPreview key={page.photo.id} page={page} index={index} total={total} mode={mode} />;
      case 'gallery': return <GalleryPreview key={page.photo.id} page={page} index={index} total={total} mode={mode} />;
    }
  };

  const selectedTemplateMeta = TEMPLATES.find((template) => template.id === selectedTemplate) ?? TEMPLATES[0];
  const coverImageUrl = exportPages[0]?.exportImageUrl || bookPages[0]?.imageUrl || null;

  const renderExportPage = (page: BookPage, index: number, total: number) => {
    const exportPage = page.exportImageUrl
      ? { ...page, imageUrl: page.exportImageUrl }
      : page;

    return (
      <div
        data-pdf-page="true"
        style={{
          width: EXPORT_PAGE_WIDTH,
          height: EXPORT_PAGE_HEIGHT,
          background: '#FFFFFF',
          boxSizing: 'border-box',
          overflow: 'hidden',
          fontFamily: '"Noto Sans KR", "Malgun Gothic", "맑은 고딕", -apple-system, sans-serif',
        }}
      >
        {renderPreviewPage(exportPage, index, total, 'export')}
      </div>
    );
  };

  const renderExportCover = () => (
    <div
      data-pdf-page="true"
      style={{
        width: EXPORT_PAGE_WIDTH,
        height: EXPORT_PAGE_HEIGHT,
        background: `linear-gradient(165deg, ${selectedTemplateMeta.previewBg} 0%, #F8F4EE 100%)`,
        color: selectedTemplateMeta.previewAccent,
        padding: 72,
        boxSizing: 'border-box',
        display: 'grid',
        gridTemplateRows: 'auto 1fr auto',
        gap: 32,
        fontFamily: '"Noto Sans KR", "Malgun Gothic", "맑은 고딕", -apple-system, sans-serif',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 28, letterSpacing: '0.3em', textTransform: 'uppercase' }}>Story Lens</span>
        <span style={{ fontSize: 56 }}>{selectedTemplateMeta.emoji}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)', gap: 36, alignItems: 'center' }}>
        <div>
          <p style={{ fontSize: 18, letterSpacing: '0.24em', opacity: 0.72, marginBottom: 20 }}>
            PHOTO BOOK
          </p>
          <h1 style={{ fontSize: 52, lineHeight: 1.2, marginBottom: 18, wordBreak: 'keep-all' }}>
            {bookTitle || `${new Date().getFullYear()}년 나의 사진 이야기`}
          </h1>
          <p style={{ fontSize: 22, lineHeight: 1.6, opacity: 0.82 }}>
            {selectedTemplateMeta.name} 스타일로 다시 다듬은 {bookPages.length}장의 이야기
          </p>
        </div>

        <div
          style={{
            background: 'rgba(255,255,255,0.68)',
            borderRadius: 30,
            padding: 20,
            boxShadow: '0 24px 54px rgba(32, 24, 18, 0.12)',
          }}
        >
          <div
            style={{
              background: '#F2EBE0',
              borderRadius: 22,
              aspectRatio: '4 / 5',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {coverImageUrl ? (
              <img src={coverImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
            ) : null}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 18, opacity: 0.72 }}>
        <span>{formatDate(new Date().toISOString())}</span>
        <span>{selectedTemplateMeta.description}</span>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="story-page-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--color-text-secondary)' }}>불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="story-page-shell">
      <PageHeader title={stepTitle} showBack onBack={handleBack} />

      <main className="story-content-container" style={{ paddingBottom: 30 }}>

        {/* ─── Step 1: Photo Selection ─── */}
        {step === 'select' && (
          <>
            <section className="story-surface-card" style={{ padding: 14, marginBottom: 12 }}>
              <p style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 8 }}>
                사진집에 넣을 사진을 선택하세요
              </p>
              <input
                value={bookTitle}
                onChange={(e) => setBookTitle(e.target.value)}
                placeholder="사진집 제목 (예: 2026년 봄 이야기)"
                className="story-field"
                style={{ height: 42, padding: '0 12px' }}
              />
            </section>

            {photos.length === 0 ? (
              <section className="story-surface-card" style={{ padding: 24, textAlign: 'center' }}>
                <p style={{ color: 'var(--color-text-secondary)' }}>보관함에 사진이 없어요</p>
              </section>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                {photos.map((photo) => {
                  const isSelected = selectedIds.has(photo.id);
                  const url = resolveImageUrl(photo.thumbnail_url || photo.edited_url || photo.original_url);
                  return (
                    <button
                      key={photo.id}
                      onClick={() => toggleSelect(photo.id)}
                      style={{
                        position: 'relative',
                        aspectRatio: '1/1',
                        borderRadius: 'var(--radius-xl)',
                        overflow: 'hidden',
                        border: isSelected ? '3px solid #C47550' : '1.5px solid var(--color-border)',
                        padding: 0,
                        background: 'none',
                        cursor: 'pointer',
                      }}
                    >
                        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#EEF1F5' }} />
                      {isSelected && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 4, right: 4,
                            width: 24, height: 24,
                            borderRadius: '50%',
                            background: '#C47550',
                            color: '#FFF8F0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                          }}
                        >
                          {[...selectedIds].indexOf(photo.id) + 1}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {selectedIds.size > 0 && (
              <div style={{ marginTop: 16 }}>
                <PrimaryButton onClick={goToTemplateSelect} size="lg" className="story-cta-with-icon" style={{ width: '100%' }}>
                  <span className="story-icon-3d story-icon-3d-sm" aria-hidden="true">
                    <span className="story-icon-emoji">&#x1F4D6;</span>
                  </span>
                  <span>{selectedIds.size}장으로 사진집 만들기</span>
                </PrimaryButton>
              </div>
            )}
          </>
        )}

        {/* ─── Step 2: Template Selection ─── */}
        {step === 'template' && (
          <>
            <section className="story-surface-card" style={{ padding: 14, marginBottom: 12, textAlign: 'center' }}>
              <p style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4 }}>
                어떤 스타일의 사진집을 만들까요?
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                원하는 디자인을 선택하세요
              </p>
            </section>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              {TEMPLATES.map((tpl) => {
                const isActive = tpl.id === selectedTemplate;
                return (
                  <button
                    key={tpl.id}
                    onClick={() => setSelectedTemplate(tpl.id)}
                    style={{
                      border: isActive ? '2.5px solid #C47550' : '1.5px solid var(--color-border)',
                      borderRadius: 16,
                      overflow: 'hidden',
                      background: 'white',
                      padding: 0,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      transform: isActive ? 'scale(1.02)' : 'scale(1)',
                      boxShadow: isActive ? '0 4px 20px rgba(196,117,80,0.18)' : '0 1px 4px rgba(0,0,0,0.05)',
                    }}
                  >
                    {/* Template preview bar */}
                    <div style={{
                      height: 56,
                      background: tpl.previewBg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                    }}>
                      <span style={{ fontSize: '1.6rem' }}>{tpl.emoji}</span>
                      {/* Mini layout icon */}
                      <div style={{
                        position: 'absolute',
                        bottom: 4, right: 8,
                        display: 'flex', gap: 2,
                      }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: tpl.previewAccent, opacity: 0.6 }} />
                        <div style={{ width: 10, height: 6, borderRadius: 2, background: tpl.previewAccent, opacity: 0.3, alignSelf: 'flex-end' }} />
                      </div>
                    </div>
                    <div style={{ padding: '10px 12px 12px' }}>
                      <p style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-text-primary)', marginBottom: 2 }}>
                        {tpl.name}
                      </p>
                      <p style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                        {tpl.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: 16 }}>
              <PrimaryButton onClick={goToPreview} size="lg" className="story-cta-with-icon" style={{ width: '100%' }}>
                <span className="story-icon-3d story-icon-3d-sm" aria-hidden="true">
                  <span className="story-icon-emoji">&#x2728;</span>
                </span>
                <span>{selectedTemplateMeta.name} 스타일로 미리보기</span>
              </PrimaryButton>
            </div>
          </>
        )}

        {/* ─── Step 3: Preview ─── */}
        {(step === 'preview' || step === 'generating') && (
          <>
            {/* Title bar */}
            <section className="story-surface-card" style={{ padding: 14, marginBottom: 12, textAlign: 'center' }}>
              <input
                value={bookTitle}
                onChange={(e) => setBookTitle(e.target.value)}
                className="story-field"
                style={{
                  textAlign: 'center',
                  height: 44,
                  fontFamily: 'var(--font-family-serif)',
                  fontSize: '1.1rem',
                  fontWeight: 600,
                }}
              />
              <p style={{ marginTop: 6, fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                {selectedTemplateMeta.emoji}{' '}
                {selectedTemplateMeta.name} · {bookPages.length}페이지
              </p>
            </section>

            {/* Page previews */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {bookPages.map((page, index) =>
                renderPreviewPage(page, index, bookPages.length),
              )}
            </div>

            {/* Actions */}
            <div className="story-action-grid" style={{ marginTop: 16 }}>
              <SecondaryButton onClick={() => setStep('template')} size="md">
                템플릿 변경
              </SecondaryButton>
              <PrimaryButton
                onClick={handleGeneratePDF}
                disabled={step === 'generating'}
                size="md"
                className="story-cta-with-icon"
                style={{ cursor: step === 'generating' ? 'wait' : 'pointer' }}
              >
                <span className="story-icon-3d story-icon-3d-sm" aria-hidden="true">
                  <span className="story-icon-emoji">&#x1F4E5;</span>
                </span>
                <span>{step === 'generating' ? (exportProgress || 'PDF 생성 중...') : 'PDF 다운로드'}</span>
              </PrimaryButton>
            </div>

            {exportError && (
              <section className="story-surface-card" style={{ marginTop: 12, padding: 14, textAlign: 'center' }}>
                <p style={{ color: '#9F3A20', fontSize: '0.85rem', lineHeight: 1.6 }}>{exportError}</p>
              </section>
            )}

            <div
              ref={exportContainerRef}
              aria-hidden="true"
              style={{
                position: 'fixed',
                left: -10000,
                top: 0,
                width: EXPORT_PAGE_WIDTH,
                opacity: 0,
                pointerEvents: 'none',
                zIndex: -1,
                fontFamily: '"Noto Sans KR", "Malgun Gothic", "맑은 고딕", -apple-system, sans-serif',
              }}
            >
              {exportPages.length > 0 && renderExportCover()}
              {exportPages.map((page, index) => (
                <div key={`export-${page.photo.id}`}>
                  {renderExportPage(page, index, exportPages.length)}
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
