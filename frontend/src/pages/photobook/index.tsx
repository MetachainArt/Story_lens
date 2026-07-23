import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Photo } from '@/types/photo';
import PageHeader from '@/components/common/PageHeader';
import { PrimaryButton, SecondaryButton } from '@/components/common/Button';
import { safeJsonArray, resolveImageUrl } from '@/utils/storage';
import api from '@/services/api';
import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';
import {
  DEFAULT_PHOTOBOOK_FORMAT,
  PHOTOBOOK_FORMATS,
  PHOTOBOOK_TEMPLATE_COLLECTIONS,
  PHOTOBOOK_TEMPLATES,
  getExportPixelSize,
  isLandscapeFormat,
} from './config';
import type {
  BookFormat,
  BookFormatId,
  PhotoBookTemplate,
  TemplateCollectionId,
  TemplateId,
} from './config';
import { buildAutoSpreads } from './layout';
import type { BookPage, BookSpread } from './layout';
import './photobook.css';

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

function getPhotoLabel(photo: Photo): string {
  return photo.title || photo.topic || formatDate(photo.created_at);
}

type PhotoBookCopy = {
  title: string;
  content: string;
};

type PhotoBookCopyResponse = PhotoBookCopy & {
  source: 'gemini' | 'fallback';
};

const GENERIC_PHOTO_LABELS = new Set(['ai사진보정', 'ai이미지', '사진보정', '사진']);

function isGenericPhotoLabel(value: string | null | undefined): boolean {
  const normalized = (value || '').toLowerCase().replace(/\s+/g, '');
  return !normalized || GENERIC_PHOTO_LABELS.has(normalized);
}

function getFallbackPhotoBookCopy(photo: Photo, index: number): PhotoBookCopy {
  const existingTitle = [photo.topic, photo.title].find((value) => !isGenericPhotoLabel(value))?.trim();
  const existingContent = photo.content?.trim();
  const hasGenericContent = existingContent?.includes('사진 속 분위기와 감정이 오래 남을 수 있도록');

  return {
    title: existingTitle || `기억의 장면 ${String(index + 1).padStart(2, '0')}`,
    content: existingContent && !hasGenericContent
      ? existingContent
      : `${formatDate(photo.created_at)}의 장면을 사진 한 장에 온전히 담았습니다.`,
  };
}

type TemplateRenderMode = 'preview' | 'export';

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

async function exportDomPagesToPdf(
  container: HTMLElement,
  fileName: string,
  format: BookFormat,
): Promise<void> {
  const pageElements = Array.from(container.querySelectorAll<HTMLElement>('[data-pdf-page="true"]'));
  if (pageElements.length === 0) {
    throw new Error('No exportable pages found');
  }

  const orientation = isLandscapeFormat(format) ? 'landscape' : 'portrait';
  const exportSize = getExportPixelSize(format);
  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: [format.widthMm, format.heightMm],
  });
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  for (const [index, pageElement] of pageElements.entries()) {
    const imageData = await toPng(pageElement, {
      width: exportSize.width,
      height: exportSize.height,
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
  format: BookFormat;
  mode?: TemplateRenderMode;
};

type PhotoBookCanvasProps = {
  mode: TemplateRenderMode;
  format: BookFormat;
  background: string;
  borderColor?: string;
  shadow?: string;
  children: ReactNode;
};

type PhotoArtworkProps = {
  src: string;
  alt?: string;
  frameStyle?: CSSProperties;
  stageStyle?: CSSProperties;
  imageStyle?: CSSProperties;
};

function getPageMetrics(mode: TemplateRenderMode, format: BookFormat) {
  if (mode === 'export') {
    return {
      padding: isLandscapeFormat(format) ? 44 : 56,
      gap: 22,
      title: 34,
      subtitle: 18,
      body: 18,
      meta: 13,
      tag: 14,
      radius: 32,
    };
  }

  if (isLandscapeFormat(format)) {
    return {
      padding: 18,
      gap: 9,
      title: 17,
      subtitle: 11,
      body: 11,
      meta: 9,
      tag: 10,
      radius: 18,
    };
  }

  return {
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
  format,
  background,
  borderColor = 'rgba(120, 110, 94, 0.14)',
  shadow = '0 30px 80px rgba(15, 23, 42, 0.12)',
  children,
}: PhotoBookCanvasProps) {
  const isPreview = mode === 'preview';
  const exportSize = getExportPixelSize(format);
  const previewMaxWidth = isLandscapeFormat(format)
    ? 860
    : format.widthMm === format.heightMm
      ? 680
      : 600;

  return (
    <section
      className="photobook-page-canvas"
      style={{
        width: '100%',
        height: isPreview ? 'auto' : '100%',
        aspectRatio: `${exportSize.width} / ${exportSize.height}`,
        maxWidth: isPreview ? previewMaxWidth : undefined,
        margin: isPreview ? '0 auto 18px' : undefined,
        borderRadius: isPreview ? 8 : 0,
        border: isPreview ? `1px solid ${borderColor}` : undefined,
        boxShadow: isPreview ? shadow : undefined,
        background,
        overflow: 'hidden',
        position: 'relative',
        containerType: isPreview ? 'inline-size' : undefined,
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

export function MinimalPreview({ page, index, total, format, mode = 'preview' }: TemplatePreviewProps) {
  const metrics = getPageMetrics(mode, format);
  const summary = getPageSummary(page.photo.content, mode === 'export' ? 220 : 220);

  return (
    <PhotoBookCanvas mode={mode} format={format} background="linear-gradient(180deg, #FCFBF7 0%, #F2EEE7 100%)">
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

export function MagazinePreview({ page, index, total, format, mode = 'preview' }: TemplatePreviewProps) {
  const metrics = getPageMetrics(mode, format);
  const summary = getPageSummary(page.photo.content, mode === 'export' ? 170 : 190);

  return (
    <PhotoBookCanvas mode={mode} format={format} background="linear-gradient(160deg, #111111 0%, #1F1F1F 48%, #3B2C1F 100%)" borderColor="rgba(232, 197, 71, 0.22)">
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

        <div style={{ display: 'grid', gridTemplateColumns: isLandscapeFormat(format) || mode === 'export' ? 'minmax(0, 1.2fr) minmax(0, 0.85fr)' : '1fr', gap: metrics.gap, minHeight: 0 }}>
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

export function PolaroidPreview({ page, index, total, format, mode = 'preview' }: TemplatePreviewProps) {
  const metrics = getPageMetrics(mode, format);
  const summary = getPageSummary(page.photo.content, mode === 'export' ? 140 : 140);
  const rotation = mode === 'export' ? (index % 3 - 1) * 2.4 : (index % 3 - 1) * 1.5;

  return (
    <PhotoBookCanvas mode={mode} format={format} background="linear-gradient(180deg, #FFF7ED 0%, #F4E6D1 100%)" borderColor="rgba(196, 117, 80, 0.2)">
      <div style={{ height: '100%', padding: metrics.padding, display: 'grid', gridTemplateRows: 'auto 1fr auto', gap: metrics.gap }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: metrics.meta, color: '#A16B4E', letterSpacing: '0.16em', textTransform: 'uppercase' }}>instant memory</span>
          <span style={{ fontSize: metrics.meta, color: '#A16B4E' }}>{formatDate(page.photo.created_at)}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
          <div
            style={{
              width: isLandscapeFormat(format) ? '48%' : mode === 'export' ? '78%' : '82%',
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

export function CinematicPreview({ page, index, total, format, mode = 'preview' }: TemplatePreviewProps) {
  const metrics = getPageMetrics(mode, format);
  const summary = getPageSummary(page.photo.content, mode === 'export' ? 150 : 170);

  return (
    <PhotoBookCanvas mode={mode} format={format} background="radial-gradient(circle at top, #232323 0%, #0D0D0D 55%, #050505 100%)" borderColor="rgba(255,107,53,0.22)">
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

export function DiaryPreview({ page, index, total, format, mode = 'preview' }: TemplatePreviewProps) {
  const metrics = getPageMetrics(mode, format);
  const summary = getPageSummary(page.photo.content, mode === 'export' ? 180 : 200);

  return (
    <PhotoBookCanvas mode={mode} format={format} background="linear-gradient(180deg, #FFF8ED 0%, #F6ECD8 100%)" borderColor="rgba(139, 115, 85, 0.18)">
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0, transparent 42px, rgba(213,190,156,0.55) 43px)',
          opacity: 0.46,
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative', height: '100%', padding: metrics.padding, display: 'grid', gridTemplateRows: 'auto 1fr', gridTemplateColumns: isLandscapeFormat(format) ? 'minmax(0, 1.2fr) minmax(0, 0.8fr)' : '1fr', gap: metrics.gap }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gridColumn: '1 / -1' }}>
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
            aspectRatio: isLandscapeFormat(format) ? undefined : '4 / 3',
            height: isLandscapeFormat(format) ? '100%' : undefined,
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

export function GalleryPreview({ page, index, total, format, mode = 'preview' }: TemplatePreviewProps) {
  const metrics = getPageMetrics(mode, format);
  const summary = getPageSummary(page.photo.content, mode === 'export' ? 160 : 180);

  return (
    <PhotoBookCanvas mode={mode} format={format} background="linear-gradient(180deg, #F5EFE7 0%, #EBE2D6 100%)" borderColor="rgba(44,44,44,0.12)">
      <div style={{ height: '100%', padding: metrics.padding, display: 'grid', gridTemplateRows: 'auto 1fr auto', gap: metrics.gap }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#574A3D' }}>
          <span style={{ fontSize: metrics.meta, letterSpacing: '0.18em', textTransform: 'uppercase' }}>gallery selection</span>
          <span style={{ fontSize: metrics.meta }}>{formatDate(page.photo.created_at)}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
          <PhotoArtwork
            src={page.imageUrl}
            frameStyle={{
              width: isLandscapeFormat(format) ? '48%' : mode === 'export' ? '80%' : '84%',
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

export function StorybookPreview({ page, index, total, format, mode = 'preview' }: TemplatePreviewProps) {
  const metrics = getPageMetrics(mode, format);
  const landscape = isLandscapeFormat(format);
  const summary = getPageSummary(page.photo.content, landscape ? 120 : 180);

  return (
    <PhotoBookCanvas
      mode={mode}
      format={format}
      background="linear-gradient(145deg, #EAF3FF 0%, #FFF8E7 52%, #FDE8E1 100%)"
      borderColor="rgba(66,107,155,0.18)"
    >
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(90deg, rgba(66,107,155,0.08) 1px, transparent 1px), linear-gradient(rgba(66,107,155,0.08) 1px, transparent 1px)', backgroundSize: mode === 'export' ? '72px 72px' : '36px 36px', opacity: 0.35 }} />
      <div style={{ position: 'relative', height: '100%', padding: metrics.padding, display: 'grid', gridTemplateRows: 'auto 1fr auto', gap: metrics.gap, color: '#294A68' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontFamily: 'var(--font-family-serif)', fontSize: metrics.subtitle, fontWeight: 700 }}>우리의 작은 이야기</span>
          <span style={{ fontSize: metrics.meta, padding: '5px 10px', border: '1px solid rgba(66,107,155,0.24)', background: 'rgba(255,255,255,0.72)' }}>
            {index + 1} / {total}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: landscape ? 'minmax(0, 1.25fr) minmax(0, 0.75fr)' : '1fr', gap: metrics.gap, minHeight: 0 }}>
          <PhotoArtwork
            src={page.imageUrl}
            frameStyle={{ background: '#FFFFFF', padding: mode === 'export' ? 16 : 9, borderRadius: metrics.radius, boxShadow: '0 24px 52px rgba(66,107,155,0.16)', minHeight: 0 }}
            stageStyle={{ background: '#DCE9F4', borderRadius: metrics.radius - 9, flex: 1, minHeight: 0 }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'rgba(255,255,255,0.74)', border: '1px solid rgba(242,140,114,0.24)', padding: mode === 'export' ? 24 : 14, borderRadius: metrics.radius - 6 }}>
            <span style={{ color: '#F28C72', fontSize: metrics.meta, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>chapter {String(index + 1).padStart(2, '0')}</span>
            <p style={{ fontFamily: 'var(--font-family-serif)', fontSize: metrics.title, fontWeight: 700, lineHeight: 1.3, marginBottom: 9 }}>
              {page.photo.topic || '반짝이는 하루'}
            </p>
            <p style={{ fontSize: metrics.body, lineHeight: 1.75, color: '#4C667E', whiteSpace: 'pre-wrap' }}>{summary}</p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#58758F', fontSize: metrics.meta }}>
          <span>{formatDate(page.photo.created_at)}</span>
          <span>Story Lens Picture Book</span>
        </div>
      </div>
    </PhotoBookCanvas>
  );
}

export function ScrapbookPreview({ page, index, total, format, mode = 'preview' }: TemplatePreviewProps) {
  const metrics = getPageMetrics(mode, format);
  const landscape = isLandscapeFormat(format);
  const summary = getPageSummary(page.photo.content, landscape ? 105 : 150);
  const rotation = index % 2 === 0 ? -1.4 : 1.4;

  return (
    <PhotoBookCanvas
      mode={mode}
      format={format}
      background="linear-gradient(150deg, #FFF6D8 0%, #F9F2EA 46%, #E6F2EF 100%)"
      borderColor="rgba(201,71,85,0.2)"
    >
      <div style={{ height: '100%', padding: metrics.padding, display: 'grid', gridTemplateRows: 'auto 1fr auto', gap: metrics.gap, color: '#3D3A35' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: metrics.meta, fontWeight: 800, color: '#C94755', letterSpacing: '0.12em' }}>CUT & KEEP</span>
          <span style={{ fontSize: metrics.meta, color: '#2D8D83' }}>{String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: landscape ? 'minmax(0, 1.25fr) minmax(0, 0.75fr)' : '1fr', gap: metrics.gap, minHeight: 0, alignItems: 'stretch' }}>
          <div style={{ position: 'relative', minHeight: 0, transform: `rotate(${rotation}deg)`, background: '#FFFFFF', padding: mode === 'export' ? 18 : 10, boxShadow: '0 24px 46px rgba(73,59,43,0.16)' }}>
            <span style={{ position: 'absolute', width: mode === 'export' ? 110 : 62, height: mode === 'export' ? 30 : 18, top: -8, left: '50%', transform: 'translateX(-50%) rotate(-2deg)', background: 'rgba(242,140,114,0.76)', zIndex: 2 }} />
            <PhotoArtwork src={page.imageUrl} frameStyle={{ height: '100%', minHeight: 0 }} stageStyle={{ background: '#E8E7E2', height: '100%', minHeight: 0 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: mode === 'export' ? 22 : 13, background: '#FFFFFF', border: '2px dashed rgba(45,141,131,0.36)', boxShadow: '8px 8px 0 rgba(45,141,131,0.12)' }}>
            <span style={{ alignSelf: 'flex-start', background: '#2D8D83', color: '#FFFFFF', fontSize: metrics.meta, padding: '5px 9px', marginBottom: 8 }}>TODAY</span>
            <p style={{ fontFamily: 'var(--font-family-serif)', fontSize: metrics.title, fontWeight: 800, lineHeight: 1.3, color: '#C94755', marginBottom: 8 }}>
              {page.photo.topic || '오늘의 한 조각'}
            </p>
            <p style={{ fontSize: metrics.body, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{summary}</p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: metrics.meta, color: '#6C655B' }}>
          <span>{formatDate(page.photo.created_at)}</span>
          <span style={{ color: '#C94755' }}>made with memories</span>
        </div>
      </div>
    </PhotoBookCanvas>
  );
}

export function TravelPreview({ page, index, total, format, mode = 'preview' }: TemplatePreviewProps) {
  const metrics = getPageMetrics(mode, format);
  const landscape = isLandscapeFormat(format);
  const summary = getPageSummary(page.photo.content, landscape ? 115 : 170);

  return (
    <PhotoBookCanvas
      mode={mode}
      format={format}
      background="linear-gradient(145deg, #E9F1EB 0%, #F7F4EA 56%, #FBE8DE 100%)"
      borderColor="rgba(49,94,88,0.2)"
    >
      <div style={{ height: '100%', padding: metrics.padding, display: 'grid', gridTemplateRows: 'auto 1fr auto', gap: metrics.gap, color: '#244E49' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', borderBottom: '2px solid #315E58', paddingBottom: 8 }}>
          <div>
            <p style={{ fontSize: metrics.meta, letterSpacing: '0.18em', color: '#E0724B', marginBottom: 3 }}>TRAVEL NOTES</p>
            <p style={{ fontFamily: 'var(--font-family-serif)', fontSize: metrics.subtitle, fontWeight: 700 }}>{page.photo.topic || '기억하고 싶은 곳'}</p>
          </div>
          <span style={{ fontFamily: 'monospace', fontSize: metrics.meta }}>{String(index + 1).padStart(2, '0')}—{String(total).padStart(2, '0')}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: landscape ? 'minmax(0, 1.45fr) minmax(0, 0.55fr)' : '1fr', gap: metrics.gap, minHeight: 0 }}>
          <PhotoArtwork
            src={page.imageUrl}
            frameStyle={{ background: '#FFFFFF', padding: mode === 'export' ? 15 : 9, boxShadow: '0 24px 52px rgba(49,94,88,0.14)', minHeight: 0 }}
            stageStyle={{ background: '#DDE6E2', flex: 1, minHeight: 0 }}
          />
          <div style={{ display: 'grid', alignContent: 'center', gap: metrics.gap, minHeight: 0 }}>
            <div style={{ background: '#315E58', color: '#FFFFFF', padding: mode === 'export' ? 20 : 12 }}>
              <p style={{ fontSize: metrics.meta, letterSpacing: '0.16em', marginBottom: 7 }}>MEMORY TICKET</p>
              <p style={{ fontSize: metrics.body, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{summary}</p>
            </div>
            <div style={{ border: '1px dashed #E0724B', color: '#A34E30', padding: mode === 'export' ? 16 : 10, fontSize: metrics.meta, display: 'flex', justifyContent: 'space-between' }}>
              <span>DATE</span>
              <span>{formatDate(page.photo.created_at)}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: metrics.meta, color: '#567A75' }}>
          <span>Story Lens Journey</span>
          <span>keep exploring</span>
        </div>
      </div>
    </PhotoBookCanvas>
  );
}

export function FamilyPreview({ page, index, total, format, mode = 'preview' }: TemplatePreviewProps) {
  const metrics = getPageMetrics(mode, format);
  const landscape = isLandscapeFormat(format);
  const summary = getPageSummary(page.photo.content, landscape ? 110 : 165);

  return (
    <PhotoBookCanvas
      mode={mode}
      format={format}
      background="linear-gradient(145deg, #F9F1F2 0%, #FFFDF8 52%, #EAF2EF 100%)"
      borderColor="rgba(125,57,69,0.18)"
    >
      <div style={{ position: 'absolute', inset: mode === 'export' ? 30 : 14, border: '1px solid rgba(125,57,69,0.18)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', height: '100%', padding: metrics.padding, display: 'grid', gridTemplateRows: 'auto 1fr auto', gap: metrics.gap, color: '#49343A' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--font-family-serif)', fontWeight: 800, fontSize: metrics.subtitle }}>Together, always</span>
          <span style={{ fontSize: metrics.meta, color: '#49756C' }}>{index + 1} of {total}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: landscape ? 'minmax(0, 1.2fr) minmax(0, 0.8fr)' : '1fr', gap: metrics.gap, minHeight: 0, alignItems: 'stretch' }}>
          <PhotoArtwork
            src={page.imageUrl}
            frameStyle={{ background: '#FFFFFF', border: '1px solid rgba(125,57,69,0.15)', padding: mode === 'export' ? 17 : 9, boxShadow: '0 24px 52px rgba(125,57,69,0.12)', minHeight: 0 }}
            stageStyle={{ background: '#EEE8E5', minHeight: 0, flex: 1 }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: landscape ? 'left' : 'center', padding: mode === 'export' ? 24 : 13 }}>
            <span style={{ color: '#49756C', fontSize: metrics.meta, letterSpacing: '0.12em', marginBottom: 8 }}>OUR DAYS</span>
            <p style={{ fontFamily: 'var(--font-family-serif)', fontSize: metrics.title, fontWeight: 800, lineHeight: 1.35, color: '#7D3945', marginBottom: 9 }}>
              {page.photo.topic || '함께라서 좋은 날'}
            </p>
            <p style={{ fontSize: metrics.body, lineHeight: 1.8, color: '#665057', whiteSpace: 'pre-wrap' }}>{summary}</p>
          </div>
        </div>

        <div style={{ height: mode === 'export' ? 12 : 7, display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1fr' }}>
          <span style={{ background: '#7D3945' }} />
          <span style={{ background: '#E9B85B' }} />
          <span style={{ background: '#49756C' }} />
        </div>
      </div>
    </PhotoBookCanvas>
  );
}

type AutoSpreadPreviewProps = {
  spread: BookSpread;
  index: number;
  total: number;
  format: BookFormat;
  template: PhotoBookTemplate;
  mode?: TemplateRenderMode;
};

function getThemeVariables(template: PhotoBookTemplate, mode: TemplateRenderMode, format: BookFormat): CSSProperties {
  const metrics = getPageMetrics(mode, format);
  return {
    '--spread-bg': template.previewBg,
    '--spread-accent': template.previewAccent,
    '--spread-secondary': template.previewSecondary,
    '--spread-ink': template.isDark ? '#fffaf2' : '#273449',
    '--spread-muted': template.isDark ? '#d9d1c6' : '#68758a',
    '--spread-pad': `${metrics.padding}px`,
    '--spread-gap': `${metrics.gap}px`,
    '--spread-title': `${metrics.title}px`,
    '--spread-body': `${metrics.body}px`,
    '--spread-meta': `${metrics.meta}px`,
  } as CSSProperties;
}

function AutoSpreadPreview({ spread, index, total, format, template, mode = 'preview' }: AutoSpreadPreviewProps) {
  const firstPage = spread.pages[0];
  const title = firstPage.copy?.title || firstPage.photo.topic || firstPage.photo.title || template.name;
  const summary = getPageSummary(firstPage.copy?.content || firstPage.photo.content, mode === 'export' ? 150 : 100);

  return (
    <PhotoBookCanvas
      mode={mode}
      format={format}
      background={template.previewBg}
      borderColor={`${template.previewAccent}33`}
    >
      <article
        className={`photobook-spread photobook-spread--${template.layout} photobook-spread-layout--${spread.layout}${template.isDark ? ' is-dark' : ''}`}
        data-book-format={format.id}
        style={getThemeVariables(template, mode, format)}
      >
        <div className="photobook-spread-decor" aria-hidden="true">
          {template.decorations.slice(0, 4).map((decoration, decorationIndex) => (
            <span key={`${decoration}-${decorationIndex}`}>{decoration}</span>
          ))}
        </div>

        <header className="photobook-spread-header">
          <span>사진 이야기</span>
          <strong>{String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</strong>
        </header>

        <div className="photobook-spread-heading">
          <span>{template.mark}</span>
          <h2>{title}</h2>
        </div>

        <div className="photobook-spread-media">
          {spread.pages.map((page, photoIndex) => (
            <figure key={page.photo.id} className={`photobook-spread-photo photobook-spread-photo--${photoIndex + 1}`}>
              <img
                className="photobook-image--contain"
                src={mode === 'export' ? (page.exportImageUrl || page.imageUrl) : page.imageUrl}
                alt={mode === 'preview' ? (page.photo.title || page.photo.topic || `사진 ${photoIndex + 1}`) : ''}
              />
              <figcaption>
                <span>{String(photoIndex + 1).padStart(2, '0')}</span>
                {spread.pages.length > 1 ? (
                  <span className="photobook-spread-caption-copy">
                    <strong>{page.copy?.title || page.photo.topic || formatDate(page.photo.created_at)}</strong>
                    <small>{page.copy?.content || page.photo.content || ''}</small>
                  </span>
                ) : (
                  <time>{formatDate(page.photo.created_at)}</time>
                )}
              </figcaption>
            </figure>
          ))}
        </div>

        <footer className="photobook-spread-footer">
          <p>{summary}</p>
          <div>
            <strong>꿈꾸는 카메라</strong>
            <time>{formatDate(firstPage.photo.created_at)}</time>
          </div>
        </footer>
      </article>
    </PhotoBookCanvas>
  );
}

type AutoBookCoverProps = {
  title: string;
  firstPage: BookPage;
  imageUrl?: string | null;
  photoCount: number;
  format: BookFormat;
  template: PhotoBookTemplate;
  mode?: TemplateRenderMode;
};

function AutoBookCover({ title, firstPage, imageUrl, photoCount, format, template, mode = 'preview' }: AutoBookCoverProps) {
  return (
    <PhotoBookCanvas mode={mode} format={format} background={template.previewBg} borderColor={`${template.previewAccent}33`}>
      <article
        className={`photobook-book-cover photobook-spread--${template.layout}${template.isDark ? ' is-dark' : ''}`}
        data-book-format={format.id}
        style={getThemeVariables(template, mode, format)}
      >
        <div className="photobook-cover-decor" aria-hidden="true">
          {template.decorations.slice(0, 4).map((decoration, index) => <span key={`${decoration}-${index}`}>{decoration}</span>)}
        </div>
        <header>
          <span>STORY LENS PHOTO BOOK</span>
          <strong>{template.mark}</strong>
        </header>
        <div className="photobook-cover-body">
          <div className="photobook-cover-copy">
            <small>사진 이야기</small>
            <h1>{title}</h1>
            <p>{photoCount}장의 사진으로 만든 {template.name}</p>
          </div>
          <figure>
            <img
              className="photobook-image--contain"
              src={imageUrl || (mode === 'export' ? (firstPage.exportImageUrl || firstPage.imageUrl) : firstPage.imageUrl)}
              alt={mode === 'preview' ? '사진집 표지' : ''}
            />
          </figure>
        </div>
        <footer>
          <span>꿈꾸는 카메라</span>
          <span>{formatDate(new Date().toISOString())}</span>
          <span>{format.name}</span>
        </footer>
      </article>
    </PhotoBookCanvas>
  );
}

type AutoBookEndingProps = {
  imageUrl: string;
  message: string;
  format: BookFormat;
  template: PhotoBookTemplate;
  mode?: TemplateRenderMode;
};

function AutoBookEnding({ imageUrl, message, format, template, mode = 'preview' }: AutoBookEndingProps) {
  return (
    <PhotoBookCanvas mode={mode} format={format} background={template.previewBg} borderColor={`${template.previewAccent}33`}>
      <article
        className={`photobook-book-ending photobook-spread--${template.layout}${template.isDark ? ' is-dark' : ''}`}
        style={getThemeVariables(template, mode, format)}
      >
        <figure>
          <img className="photobook-image--contain" src={imageUrl} alt={mode === 'preview' ? '마지막 장 사진' : ''} />
        </figure>
        <div className="photobook-ending-copy">
          <small>THE END · 꿈꾸는 카메라</small>
          <h2>{message.trim() || '우리의 이야기는 계속됩니다.'}</h2>
          <span>{template.decorations.slice(0, 3).join('  ')}</span>
        </div>
      </article>
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
  const [coverPhotoId, setCoverPhotoId] = useState<string | null>(null);
  const [endingPhotoId, setEndingPhotoId] = useState<string | null>(null);
  const [endingMessage, setEndingMessage] = useState('우리의 이야기는 계속됩니다.');
  const [photoBookCopy, setPhotoBookCopy] = useState<Record<string, PhotoBookCopy>>({});
  const [copyLoadingIds, setCopyLoadingIds] = useState<Set<string>>(new Set());
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>('minimal');
  const [activeTemplateCollection, setActiveTemplateCollection] = useState<TemplateCollectionId>('all');
  const [isTemplateLibraryExpanded, setIsTemplateLibraryExpanded] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<BookFormatId>(DEFAULT_PHOTOBOOK_FORMAT.id);
  const exportContainerRef = useRef<HTMLDivElement | null>(null);
  const copyEditVersionRef = useRef<Record<string, number>>({});
  const selectedTemplateMeta = PHOTOBOOK_TEMPLATES.find((template) => template.id === selectedTemplate) ?? PHOTOBOOK_TEMPLATES[0];
  const selectedFormatMeta = PHOTOBOOK_FORMATS.find((format) => format.id === selectedFormat) ?? DEFAULT_PHOTOBOOK_FORMAT;
  const filteredTemplates = useMemo(
    () => activeTemplateCollection === 'all'
      ? PHOTOBOOK_TEMPLATES
      : PHOTOBOOK_TEMPLATES.filter((template) => template.collection === activeTemplateCollection),
    [activeTemplateCollection],
  );
  const visibleTemplates = activeTemplateCollection === 'all' && !isTemplateLibraryExpanded
    ? filteredTemplates.slice(0, 12)
    : filteredTemplates;
  const hiddenTemplateCount = filteredTemplates.length - visibleTemplates.length;
  const bookSpreads = useMemo(() => buildAutoSpreads(bookPages, selectedTemplateMeta), [bookPages, selectedTemplateMeta]);
  const exportSpreads = useMemo(() => buildAutoSpreads(exportPages, selectedTemplateMeta), [exportPages, selectedTemplateMeta]);
  const exportSize = getExportPixelSize(selectedFormatMeta);
  const selectedPhotosInOrder = useMemo(
    () => [...selectedIds]
      .map((id) => photos.find((photo) => photo.id === id))
      .filter((photo): photo is Photo => Boolean(photo)),
    [photos, selectedIds],
  );
  const firstSelectedImageUrl = selectedPhotosInOrder[0]
    ? resolveImageUrl(selectedPhotosInOrder[0].edited_url || selectedPhotosInOrder[0].thumbnail_url || selectedPhotosInOrder[0].original_url)
    : '';
  const coverPhoto = selectedPhotosInOrder.find((photo) => photo.id === coverPhotoId);
  const endingPhoto = selectedPhotosInOrder.find((photo) => photo.id === endingPhotoId);
  const coverImageUrl = coverPhoto
    ? resolveImageUrl(coverPhoto.edited_url || coverPhoto.thumbnail_url || coverPhoto.original_url)
    : '';
  const endingImageUrl = endingPhoto
    ? resolveImageUrl(endingPhoto.edited_url || endingPhoto.thumbnail_url || endingPhoto.original_url)
    : '';
  const exportCoverPage = exportPages.find((page) => page.photo.id === coverPhotoId);
  const exportEndingPage = exportPages.find((page) => page.photo.id === endingPhotoId);

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

  const generatePhotoBookCopy = async (photo: Photo, index: number) => {
    const editVersionAtRequest = copyEditVersionRef.current[photo.id] || 0;
    setCopyLoadingIds((previous) => new Set(previous).add(photo.id));
    try {
      const response = await api.post<PhotoBookCopyResponse>(
        `/api/v1/photos/${photo.id}/photobook-copy`,
        { sequence: index + 1 },
      );
      const fallback = getFallbackPhotoBookCopy(photo, index);
      const generated = response.data;
      setPhotoBookCopy((previous) => ({
        ...previous,
        [photo.id]: (copyEditVersionRef.current[photo.id] || 0) === editVersionAtRequest
          ? {
              title: generated.title?.trim() || fallback.title,
              content: generated.content?.trim() || fallback.content,
            }
          : previous[photo.id] || fallback,
      }));
    } catch {
      setPhotoBookCopy((previous) => ({
        ...previous,
        [photo.id]: previous[photo.id] || getFallbackPhotoBookCopy(photo, index),
      }));
    } finally {
      setCopyLoadingIds((previous) => {
        const next = new Set(previous);
        next.delete(photo.id);
        return next;
      });
    }
  };

  const goToTemplateSelect = () => {
    if (!bookTitle.trim()) {
      const now = new Date();
      setBookTitle(`${now.getFullYear()}년 나의 사진 이야기`);
    }
    setCoverPhotoId(null);
    setEndingPhotoId(null);
    setExportError(null);
    setPhotoBookCopy((previous) => {
      const next = { ...previous };
      selectedPhotosInOrder.forEach((photo, index) => {
        next[photo.id] = next[photo.id] || getFallbackPhotoBookCopy(photo, index);
      });
      return next;
    });
    setStep('template');
    selectedPhotosInOrder.forEach((photo, index) => {
      void generatePhotoBookCopy(photo, index);
    });
  };

  const goToPreview = () => {
    if (!coverPhoto || !endingPhoto) return;

    const pages: BookPage[] = selectedPhotosInOrder.map((photo) => ({
      photo,
      imageUrl: resolveImageUrl(photo.edited_url || photo.thumbnail_url || photo.original_url),
      copy: photoBookCopy[photo.id] || getFallbackPhotoBookCopy(
        photo,
        selectedPhotosInOrder.findIndex((selectedPhoto) => selectedPhoto.id === photo.id),
      ),
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
      await exportDomPagesToPdf(exportContainer, bookTitle || 'photobook', selectedFormatMeta);
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

  const renderPreviewSpread = (
    spread: BookSpread,
    index: number,
    total: number,
    mode: TemplateRenderMode = 'preview',
  ) => (
    <AutoSpreadPreview
      key={spread.id}
      spread={spread}
      index={index}
      total={total}
      format={selectedFormatMeta}
      template={selectedTemplateMeta}
      mode={mode}
    />
  );

  const renderExportSpread = (spread: BookSpread, index: number, total: number) => (
      <div
        data-pdf-page="true"
        style={{
          width: exportSize.width,
          height: exportSize.height,
          background: '#FFFFFF',
          boxSizing: 'border-box',
          overflow: 'hidden',
          fontFamily: '"Noto Sans KR", "Malgun Gothic", "맑은 고딕", -apple-system, sans-serif',
        }}
      >
        {renderPreviewSpread(spread, index, total, 'export')}
      </div>
  );

  const renderExportCover = (firstPage: BookPage) => (
    <div
      data-pdf-page="true"
      style={{
        width: exportSize.width,
        height: exportSize.height,
        background: selectedTemplateMeta.previewBg,
        boxSizing: 'border-box',
        overflow: 'hidden',
        fontFamily: '"Noto Sans KR", "Malgun Gothic", "맑은 고딕", -apple-system, sans-serif',
      }}
    >
      <AutoBookCover
        title={bookTitle || `${new Date().getFullYear()}년 나의 사진 이야기`}
        firstPage={firstPage}
        imageUrl={exportCoverPage?.exportImageUrl || exportCoverPage?.imageUrl || coverImageUrl}
        photoCount={bookPages.length}
        format={selectedFormatMeta}
        template={selectedTemplateMeta}
        mode="export"
      />
    </div>
  );

  const renderExportEnding = (lastPage: BookPage) => (
    <div
      data-pdf-page="true"
      style={{
        width: exportSize.width,
        height: exportSize.height,
        background: selectedTemplateMeta.previewBg,
        boxSizing: 'border-box',
        overflow: 'hidden',
        fontFamily: '"Noto Sans KR", "Malgun Gothic", "맑은 고딕", -apple-system, sans-serif',
      }}
    >
      <AutoBookEnding
        imageUrl={
          exportEndingPage?.exportImageUrl
          || exportEndingPage?.imageUrl
          || endingImageUrl
          || lastPage.exportImageUrl
          || lastPage.imageUrl
        }
        message={endingMessage}
        format={selectedFormatMeta}
        template={selectedTemplateMeta}
        mode="export"
      />
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
    <div className="story-page-shell photobook-page">
      <PageHeader title={stepTitle} showBack onBack={handleBack} />

      <main className="story-content-container photobook-main">

        {/* ─── Step 1: Photo Selection ─── */}
        {step === 'select' && (
          <>
            <section className="photobook-intro story-surface-card">
              <div>
                <span className="photobook-eyebrow">MY PHOTO BOOK</span>
                <h2>사진집에 넣을 사진을 선택하세요</h2>
                <p>선택한 순서대로 보기 좋은 페이지를 자동으로 구성해요.</p>
              </div>
              <label className="photobook-title-field">
                <span>사진집 제목</span>
                <input
                  value={bookTitle}
                  onChange={(e) => setBookTitle(e.target.value)}
                  placeholder="예: 2026년 봄 이야기"
                  className="story-field"
                />
              </label>
            </section>

            <div className="photobook-selection-summary" aria-live="polite">
              <span>보관함 사진 {photos.length}장</span>
              <strong>{selectedIds.size}장 선택</strong>
            </div>

            {photos.length === 0 ? (
              <section className="story-surface-card photobook-empty-state">
                <strong>보관함에 사진이 없어요</strong>
                <p>먼저 사진을 촬영하거나 보관함에 저장해 주세요.</p>
              </section>
            ) : (
              <div className="photobook-photo-grid">
                {photos.map((photo) => {
                  const isSelected = selectedIds.has(photo.id);
                  const url = resolveImageUrl(photo.thumbnail_url || photo.edited_url || photo.original_url);
                  const label = photo.title || photo.topic || '보관함 사진';
                  return (
                    <button
                      type="button"
                      key={photo.id}
                      onClick={() => toggleSelect(photo.id)}
                      className={`photobook-photo-choice${isSelected ? ' is-selected' : ''}`}
                      aria-label={`${label} 선택`}
                      aria-pressed={isSelected}
                    >
                      <img src={url} alt={`${label} 선택`} />
                      <span className="photobook-photo-date">{formatDate(photo.created_at)}</span>
                      {isSelected && (
                        <span className="photobook-selection-order" aria-hidden="true">
                          {[...selectedIds].indexOf(photo.id) + 1}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {selectedIds.size > 0 && (
              <div className="photobook-primary-action">
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
            <section className="photobook-studio-hero">
              <div>
                <span className="photobook-studio-kicker">STORY LENS BOOK STUDIO</span>
                <h2 aria-label="나의 사진을 한 권의 작품으로">나의 사진을<br /><span>한 권의 작품으로</span></h2>
                <p>사진은 그대로, 인상은 완전히 다르게. 마음에 드는 표지에서 이야기를 시작하세요.</p>
              </div>
              <div className="photobook-studio-stats" aria-label="사진집 구성 요약">
                <span><strong>{selectedIds.size}</strong>선택 사진</span>
                <span><strong>{PHOTOBOOK_TEMPLATES.length}</strong>표지 디자인</span>
                <span><strong>{PHOTOBOOK_FORMATS.length}</strong>책 크기</span>
              </div>
            </section>

            <section className="photobook-option-section" aria-labelledby="photobook-template-title">
              <div className="photobook-studio-heading">
                <div>
                  <span>DESIGN LIBRARY</span>
                  <h3 id="photobook-template-title">표지 디자인 골라보기</h3>
                </div>
                <b>{PHOTOBOOK_TEMPLATES.length}가지 디자인</b>
              </div>

              <div className="photobook-collection-tabs" role="group" aria-label="사진집 디자인 컬렉션">
                {PHOTOBOOK_TEMPLATE_COLLECTIONS.map((collection) => {
                  const count = collection.id === 'all'
                    ? PHOTOBOOK_TEMPLATES.length
                    : PHOTOBOOK_TEMPLATES.filter((template) => template.collection === collection.id).length;
                  const isActive = activeTemplateCollection === collection.id;
                  return (
                    <button
                      type="button"
                      key={collection.id}
                      className={isActive ? 'is-active' : ''}
                      onClick={() => {
                        setActiveTemplateCollection(collection.id);
                        setIsTemplateLibraryExpanded(false);
                      }}
                      aria-label={`${collection.label} ${count}개 보기`}
                      aria-pressed={isActive}
                    >
                      <span>{collection.label}</span>
                      <small>{count}</small>
                    </button>
                  );
                })}
              </div>

              <div className="photobook-studio-layout">
                <div className="photobook-template-library">
                  <div className="photobook-template-grid">
                    {visibleTemplates.map((tpl, templateIndex) => {
                      const isActive = tpl.id === selectedTemplate;
                      const templatePhoto = selectedPhotosInOrder[templateIndex % selectedPhotosInOrder.length];
                      const templateImageUrl = templatePhoto
                        ? resolveImageUrl(templatePhoto.edited_url || templatePhoto.thumbnail_url || templatePhoto.original_url)
                        : firstSelectedImageUrl;
                      return (
                        <button
                          type="button"
                          key={tpl.id}
                          onClick={() => setSelectedTemplate(tpl.id)}
                          className={`photobook-template-card${isActive ? ' is-active' : ''}`}
                          style={{
                            '--book-template-bg': tpl.previewBg,
                            '--book-template-accent': tpl.previewAccent,
                            '--book-template-secondary': tpl.previewSecondary,
                          } as CSSProperties}
                          aria-label={`${tpl.name}: ${tpl.description}`}
                          aria-pressed={isActive}
                        >
                          <span className={`photobook-shelf-book photobook-shelf-book--${tpl.layout}`} aria-hidden="true">
                            <span className="photobook-cover-index">SL · {String(templateIndex + 1).padStart(2, '0')}</span>
                            {tpl.isNew && <span className="photobook-template-new">NEW</span>}
                            <span className="photobook-cover-photo">
                              {templateImageUrl && <img src={templateImageUrl} alt="" />}
                            </span>
                            <strong>{tpl.name}</strong>
                            <small>{tpl.mark}</small>
                            {isActive && <span className="photobook-template-check">✓</span>}
                          </span>
                          <span className="photobook-template-copy">
                            <small>{tpl.category}{tpl.isNew ? ' · NEW' : ''}</small>
                            <strong>{tpl.name}</strong>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {hiddenTemplateCount > 0 && (
                    <button
                      type="button"
                      className="photobook-template-expand"
                      onClick={() => setIsTemplateLibraryExpanded(true)}
                      aria-label={`전체 ${PHOTOBOOK_TEMPLATES.length}개 디자인 펼쳐보기`}
                    >
                      <span>전체 {PHOTOBOOK_TEMPLATES.length}개 디자인 펼쳐보기</span>
                      <small>새로운 디자인 {hiddenTemplateCount}개 더 보기</small>
                      <b aria-hidden="true">↓</b>
                    </button>
                  )}
                </div>

                <aside
                  className={`photobook-studio-inspector${selectedTemplateMeta.isDark ? ' is-dark' : ''}`}
                  aria-label="선택한 사진집 미리보기"
                  style={{
                    '--book-template-bg': selectedTemplateMeta.previewBg,
                    '--book-template-accent': selectedTemplateMeta.previewAccent,
                    '--book-template-secondary': selectedTemplateMeta.previewSecondary,
                  } as CSSProperties}
                >
                  <span className="photobook-inspector-kicker">LIVE COVER PREVIEW</span>
                  <div className="photobook-book-stage" aria-hidden="true">
                    <div className={`photobook-studio-book photobook-studio-book--${selectedTemplateMeta.layout}`}>
                      <span>STORY LENS · {selectedTemplateMeta.mark}</span>
                      <div>
                        {firstSelectedImageUrl && <img src={firstSelectedImageUrl} alt="" />}
                      </div>
                      <strong>{bookTitle || `${new Date().getFullYear()}년 나의 사진 이야기`}</strong>
                      <small>{selectedTemplateMeta.decorations.slice(0, 3).join('  ')}</small>
                    </div>
                  </div>

                  <div className="photobook-inspector-copy">
                    <span>선택한 디자인</span>
                    <h4>{selectedTemplateMeta.name} 선택됨</h4>
                    <p>{selectedTemplateMeta.description}</p>
                  </div>

                  <div className="photobook-inspector-formats">
                    <strong id="photobook-format-title">책 크기</strong>
                    <div className="photobook-studio-format-grid" aria-labelledby="photobook-format-title">
                      {PHOTOBOOK_FORMATS.map((format) => {
                        const isActive = format.id === selectedFormat;
                        return (
                          <button
                            type="button"
                            key={format.id}
                            className={isActive ? 'is-active' : ''}
                            onClick={() => setSelectedFormat(format.id)}
                            aria-label={`${format.name} ${format.description}`}
                            aria-pressed={isActive}
                          >
                            <span>{format.shortName}</span>
                            <small>{format.description}</small>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="photobook-inspector-meta">
                    <span>{selectedTemplateMeta.category}</span>
                    <span>{selectedIds.size}장 자동 배치</span>
                    <span>PDF 저장</span>
                  </div>
                </aside>
              </div>
            </section>

            <section className="photobook-option-section" aria-labelledby="photobook-copy-title">
              <div className="photobook-section-heading">
                <div>
                  <span>03</span>
                  <h3 id="photobook-copy-title">사진별 제목과 이야기 다듬기</h3>
                </div>
                <p>AI가 사진을 살펴보고 만든 문구를 자유롭게 고칠 수 있어요</p>
              </div>

              <div className="photobook-copy-grid">
                {selectedPhotosInOrder.map((photo, index) => {
                  const copy = photoBookCopy[photo.id] || getFallbackPhotoBookCopy(photo, index);
                  const isGenerating = copyLoadingIds.has(photo.id);
                  const imageUrl = resolveImageUrl(photo.thumbnail_url || photo.edited_url || photo.original_url);
                  return (
                    <article className="photobook-copy-card" key={photo.id}>
                      <figure>
                        <img className="photobook-image--contain" src={imageUrl} alt="" />
                        <span>{String(index + 1).padStart(2, '0')}</span>
                      </figure>
                      <div className="photobook-copy-fields">
                        <label>
                          <span>사진 제목</span>
                          <input
                            aria-label={`사진 ${index + 1} 제목`}
                            value={copy.title}
                            maxLength={40}
                            onChange={(event) => {
                              copyEditVersionRef.current[photo.id] = (copyEditVersionRef.current[photo.id] || 0) + 1;
                              setPhotoBookCopy((previous) => ({
                                ...previous,
                                [photo.id]: { ...copy, title: event.target.value },
                              }));
                            }}
                          />
                        </label>
                        <label>
                          <span>사진 이야기</span>
                          <textarea
                            aria-label={`사진 ${index + 1} 내용`}
                            value={copy.content}
                            maxLength={240}
                            rows={3}
                            onChange={(event) => {
                              copyEditVersionRef.current[photo.id] = (copyEditVersionRef.current[photo.id] || 0) + 1;
                              setPhotoBookCopy((previous) => ({
                                ...previous,
                                [photo.id]: { ...copy, content: event.target.value },
                              }));
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          className="photobook-copy-regenerate"
                          onClick={() => void generatePhotoBookCopy(photo, index)}
                          disabled={isGenerating}
                        >
                          {isGenerating ? '사진 분석 중…' : 'AI 문구 다시 만들기'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
              <p className="photobook-copy-note" role="status">
                {copyLoadingIds.size > 0
                  ? `AI가 ${copyLoadingIds.size}장의 사진을 살펴보고 있어요. 먼저 문구를 수정해도 괜찮아요.`
                  : '사진별 제목과 이야기가 준비됐어요. 원하는 말로 바로 수정해 보세요.'}
              </p>
            </section>

            <section className="photobook-option-section" aria-labelledby="photobook-boundary-title">
              <div className="photobook-section-heading">
                <div>
                  <span>04</span>
                  <h3 id="photobook-boundary-title">표지와 마지막 장 사진 정하기</h3>
                </div>
                <p>본문에는 선택한 {selectedPhotosInOrder.length}장을 모두 넣어요</p>
              </div>

              <div className="photobook-boundary-grid">
                <article className="photobook-boundary-panel">
                  <div className="photobook-boundary-preview">
                    {coverPhoto ? (
                      <img src={coverImageUrl} alt="표지 사진 미리보기" />
                    ) : (
                      <div className="photobook-boundary-placeholder" aria-hidden="true">
                        <span>01</span>
                        <strong>표지 사진을 골라주세요</strong>
                      </div>
                    )}
                    <span>표지</span>
                  </div>
                  <div className="photobook-boundary-controls">
                    <strong>표지 사진</strong>
                    <p>{coverPhoto ? getPhotoLabel(coverPhoto) : '아래 사진에서 한 장을 선택해 주세요.'}</p>
                    <div className="photobook-boundary-photo-strip" role="group" aria-label="표지 사진 선택">
                      {selectedPhotosInOrder.map((photo, index) => {
                        const isActive = photo.id === coverPhotoId;
                        const isUsedForEnding = selectedPhotosInOrder.length > 1 && photo.id === endingPhotoId;
                        return (
                          <button
                            type="button"
                            key={photo.id}
                            className={isActive ? 'is-active' : ''}
                            onClick={() => setCoverPhotoId(photo.id)}
                            disabled={isUsedForEnding}
                            aria-label={`표지로 선택: ${getPhotoLabel(photo)}`}
                            aria-pressed={isActive}
                            title={isUsedForEnding ? '마지막 장에 사용 중인 사진이에요' : getPhotoLabel(photo)}
                          >
                            <img
                              src={resolveImageUrl(photo.thumbnail_url || photo.edited_url || photo.original_url)}
                              alt=""
                            />
                            <span>{String(index + 1).padStart(2, '0')}</span>
                          </button>
                        );
                      })}
                    </div>
                    <label className="photobook-boundary-field">
                      <span>표지 제목</span>
                      <input value={bookTitle} onChange={(event) => setBookTitle(event.target.value)} maxLength={60} />
                    </label>
                  </div>
                </article>

                <article className="photobook-boundary-panel">
                  <div className="photobook-boundary-preview">
                    {endingPhoto ? (
                      <img src={endingImageUrl} alt="마지막 장 사진 미리보기" />
                    ) : (
                      <div className="photobook-boundary-placeholder" aria-hidden="true">
                        <span>END</span>
                        <strong>마지막 사진을 골라주세요</strong>
                      </div>
                    )}
                    <span>마지막</span>
                  </div>
                  <div className="photobook-boundary-controls">
                    <strong>마지막 장 사진</strong>
                    <p>{endingPhoto ? getPhotoLabel(endingPhoto) : '표지와 다른 사진을 선택해 주세요.'}</p>
                    <div className="photobook-boundary-photo-strip" role="group" aria-label="마지막 장 사진 선택">
                      {selectedPhotosInOrder.map((photo, index) => {
                        const isActive = photo.id === endingPhotoId;
                        const isUsedForCover = selectedPhotosInOrder.length > 1 && photo.id === coverPhotoId;
                        return (
                          <button
                            type="button"
                            key={photo.id}
                            className={isActive ? 'is-active' : ''}
                            onClick={() => setEndingPhotoId(photo.id)}
                            disabled={isUsedForCover}
                            aria-label={`마지막 장으로 선택: ${getPhotoLabel(photo)}`}
                            aria-pressed={isActive}
                            title={isUsedForCover ? '표지에 사용 중인 사진이에요' : getPhotoLabel(photo)}
                          >
                            <img
                              src={resolveImageUrl(photo.thumbnail_url || photo.edited_url || photo.original_url)}
                              alt=""
                            />
                            <span>{String(index + 1).padStart(2, '0')}</span>
                          </button>
                        );
                      })}
                    </div>
                    <label className="photobook-boundary-field">
                      <span>마지막 장 문구</span>
                      <input
                        aria-label="마지막 장 문구"
                        value={endingMessage}
                        onChange={(event) => setEndingMessage(event.target.value)}
                        maxLength={80}
                      />
                    </label>
                  </div>
                </article>
              </div>
              <p className="photobook-boundary-note">
                선택한 사진은 표지나 마지막 장으로 정해도 본문에서 빠지지 않아요.
              </p>
            </section>

            <div className="photobook-primary-action">
              {(!coverPhoto || !endingPhoto) && (
                <p className="photobook-primary-hint" role="status">표지와 마지막 장 사진을 정하면 미리볼 수 있어요.</p>
              )}
              <PrimaryButton
                onClick={goToPreview}
                disabled={!coverPhoto || !endingPhoto}
                size="lg"
                className="story-cta-with-icon"
                style={{ width: '100%' }}
              >
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
            <section className="photobook-preview-toolbar story-surface-card">
              <div className="photobook-preview-title-row">
                <span className="photobook-preview-mark" style={{ color: selectedTemplateMeta.previewAccent }} aria-hidden="true">
                  {selectedTemplateMeta.mark}
                </span>
                <label>
                  <span>사진집 제목</span>
                  <input
                    value={bookTitle}
                    onChange={(e) => setBookTitle(e.target.value)}
                    className="story-field"
                  />
                </label>
              </div>
              <div className="photobook-preview-meta">
                <span>{selectedTemplateMeta.name}</span>
                <span>{selectedFormatMeta.name}</span>
                <span>{bookSpreads.length + 2}페이지 · 표지와 마지막 장 포함</span>
                <strong>자동 배치 완료</strong>
              </div>
            </section>

            <div className="photobook-preview-list">
              {bookPages[0] && (
                <AutoBookCover
                  title={bookTitle || `${new Date().getFullYear()}년 나의 사진 이야기`}
                  firstPage={bookPages[0]}
                  imageUrl={coverImageUrl}
                  photoCount={bookPages.length}
                  format={selectedFormatMeta}
                  template={selectedTemplateMeta}
                />
              )}
              {bookSpreads.map((spread, index) =>
                renderPreviewSpread(spread, index, bookSpreads.length),
              )}
              {bookPages.at(-1) && (
                <AutoBookEnding
                  imageUrl={endingImageUrl || bookPages.at(-1)!.imageUrl}
                  message={endingMessage}
                  format={selectedFormatMeta}
                  template={selectedTemplateMeta}
                />
              )}
            </div>

            <div className="story-action-grid photobook-preview-actions">
              <SecondaryButton onClick={() => setStep('template')} size="md">
                디자인 변경
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
              <section className="story-surface-card photobook-export-error" role="alert">
                <p>{exportError}</p>
              </section>
            )}

            <div
              ref={exportContainerRef}
              aria-hidden="true"
              style={{
                position: 'fixed',
                left: -10000,
                top: 0,
                width: exportSize.width,
                opacity: 0,
                pointerEvents: 'none',
                zIndex: -1,
                fontFamily: '"Noto Sans KR", "Malgun Gothic", "맑은 고딕", -apple-system, sans-serif',
              }}
            >
              {exportPages[0] && renderExportCover(exportPages[0])}
              {exportSpreads.map((spread, index) => (
                <div key={`export-${spread.id}`}>
                  {renderExportSpread(spread, index, exportSpreads.length)}
                </div>
              ))}
              {exportPages.at(-1) && renderExportEnding(exportPages.at(-1)!)}
            </div>
          </>
        )}

        <div className="photobook-home-action">
          <SecondaryButton onClick={() => navigate('/')} fullWidth className="story-cta-with-icon">
            <span className="story-icon-3d story-icon-3d-sm" aria-hidden="true">
              <span className="story-icon-emoji">&#x1F3E0;</span>
            </span>
            <span>홈으로</span>
          </SecondaryButton>
        </div>
      </main>
    </div>
  );
}
