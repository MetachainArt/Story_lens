import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Photo } from '@/types/photo';
import PageHeader from '@/components/common/PageHeader';
import { PrimaryButton, SecondaryButton } from '@/components/common/Button';
import { safeJsonArray, resolveImageUrl } from '@/utils/storage';
import api from '@/services/api';
import { jsPDF } from 'jspdf';

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

type BookPage = {
  photo: Photo;
  imageUrl: string;
};

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

/* ─── Template-specific Preview Renderers ─── */

function MinimalPreview({ page, index, total }: { page: BookPage; index: number; total: number }) {
  return (
    <section style={{
      background: '#FAFAFA',
      borderRadius: 12,
      padding: 24,
      marginBottom: 12,
    }}>
      <img
        src={page.imageUrl}
        alt=""
        style={{ width: '100%', maxHeight: 260, objectFit: 'cover', display: 'block', borderRadius: 4 }}
      />
      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          {page.photo.topic && (
            <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#333', marginBottom: 4 }}>
              {page.photo.topic}
            </p>
          )}
          {page.photo.content && (
            <p style={{ fontSize: '0.8rem', color: '#666', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {page.photo.content}
            </p>
          )}
        </div>
        <span style={{ fontSize: '0.65rem', color: '#BBB', flexShrink: 0, marginLeft: 12 }}>
          {index + 1}/{total}
        </span>
      </div>
    </section>
  );
}

function MagazinePreview({ page, index, total }: { page: BookPage; index: number; total: number }) {
  const isEven = index % 2 === 0;
  return (
    <section style={{
      background: '#1A1A1A',
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 12,
      display: 'flex',
      flexDirection: isEven ? 'row' : 'row-reverse',
      minHeight: 200,
    }}>
      <img
        src={page.imageUrl}
        alt=""
        style={{ width: '55%', objectFit: 'cover', display: 'block' }}
      />
      <div style={{ flex: 1, padding: '18px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          {page.photo.topic && (
            <p style={{ fontSize: '0.65rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#E8C547', fontWeight: 700, marginBottom: 8 }}>
              #{page.photo.topic}
            </p>
          )}
          {page.photo.content && (
            <p style={{ fontSize: '0.78rem', color: '#D4D4D4', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {page.photo.content}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
          <span style={{ fontSize: '0.6rem', color: '#777' }}>{formatDate(page.photo.created_at)}</span>
          <span style={{ fontSize: '0.6rem', color: '#555' }}>{index + 1}/{total}</span>
        </div>
      </div>
    </section>
  );
}

function PolaroidPreview({ page, index, total }: { page: BookPage; index: number; total: number }) {
  const rotation = (index % 3 - 1) * 2;
  return (
    <section style={{
      background: '#FFF8F0',
      borderRadius: 12,
      padding: 20,
      marginBottom: 12,
      display: 'flex',
      justifyContent: 'center',
    }}>
      <div style={{
        background: 'white',
        padding: '12px 12px 40px 12px',
        borderRadius: 4,
        boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
        transform: `rotate(${rotation}deg)`,
        maxWidth: 280,
        width: '100%',
      }}>
        <img
          src={page.imageUrl}
          alt=""
          style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block' }}
        />
        <div style={{ padding: '10px 4px 0', textAlign: 'center' }}>
          {page.photo.topic && (
            <p style={{ fontFamily: 'var(--font-family-serif)', fontSize: '0.9rem', color: '#5A4030', fontWeight: 600 }}>
              #{page.photo.topic}
            </p>
          )}
          {page.photo.content && (
            <p style={{ fontSize: '0.75rem', color: '#8B7355', marginTop: 4, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
              {page.photo.content?.slice(0, 80)}{(page.photo.content?.length ?? 0) > 80 ? '...' : ''}
            </p>
          )}
          <p style={{ fontSize: '0.6rem', color: '#C4A882', marginTop: 6 }}>
            {formatDate(page.photo.created_at)} · {index + 1}/{total}
          </p>
        </div>
      </div>
    </section>
  );
}

function CinematicPreview({ page, index, total }: { page: BookPage; index: number; total: number }) {
  return (
    <section style={{
      background: '#0D0D0D',
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 12,
    }}>
      <div style={{ position: 'relative' }}>
        <img
          src={page.imageUrl}
          alt=""
          style={{ width: '100%', aspectRatio: '21/9', objectFit: 'cover', display: 'block', filter: 'contrast(1.05) saturate(0.9)' }}
        />
        {/* Film grain overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, transparent 60%, rgba(0,0,0,0.7))',
          pointerEvents: 'none',
        }} />
        {/* Letterbox bars */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 16, background: '#0D0D0D' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 16, background: '#0D0D0D' }} />
      </div>
      <div style={{ padding: '14px 18px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {page.photo.topic && (
              <p style={{ fontSize: '1rem', fontWeight: 700, color: '#FF6B35', letterSpacing: '-0.02em' }}>
                {page.photo.topic}
              </p>
            )}
            {page.photo.content && (
              <p style={{ fontSize: '0.78rem', color: '#999', marginTop: 6, lineHeight: 1.6, whiteSpace: 'pre-wrap', fontStyle: 'italic' }}>
                "{page.photo.content?.slice(0, 100)}{(page.photo.content?.length ?? 0) > 100 ? '...' : ''}"
              </p>
            )}
          </div>
          <span style={{ fontSize: '0.9rem', fontFamily: 'monospace', color: '#444', flexShrink: 0, marginLeft: 12 }}>
            {String(index + 1).padStart(2, '0')}/{String(total).padStart(2, '0')}
          </span>
        </div>
      </div>
    </section>
  );
}

function DiaryPreview({ page, index, total }: { page: BookPage; index: number; total: number }) {
  return (
    <section style={{
      background: '#FEF9EF',
      borderRadius: 12,
      border: '1px dashed #D4C4A8',
      padding: 18,
      marginBottom: 12,
    }}>
      {/* Date header like diary */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{
          fontFamily: 'var(--font-family-serif)',
          fontSize: '0.9rem',
          color: '#8B7355',
          fontWeight: 600,
          borderBottom: '2px solid #D4C4A8',
          paddingBottom: 2,
        }}>
          {formatDate(page.photo.created_at)}
        </span>
        <span style={{ fontSize: '0.65rem', color: '#C4B08A' }}>p.{index + 1}/{total}</span>
      </div>
      {/* Photo with tape effect */}
      <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
        <img
          src={page.imageUrl}
          alt=""
          style={{
            width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block',
            borderRadius: 6, border: '3px solid white', boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
          }}
        />
        {/* Tape strips */}
        <div style={{
          position: 'absolute', top: -4, left: '20%', width: 50, height: 14,
          background: 'rgba(212,196,168,0.5)', borderRadius: 2, transform: 'rotate(-3deg)',
        }} />
        <div style={{
          position: 'absolute', top: -4, right: '15%', width: 45, height: 14,
          background: 'rgba(212,196,168,0.4)', borderRadius: 2, transform: 'rotate(2deg)',
        }} />
      </div>
      {/* Content like handwritten note */}
      <div style={{ marginTop: 14 }}>
        {page.photo.topic && (
          <p style={{
            fontFamily: 'var(--font-family-serif)',
            fontSize: '0.95rem', color: '#5A4A35', fontWeight: 600, marginBottom: 6,
          }}>
            📌 {page.photo.topic}
          </p>
        )}
        {page.photo.content && (
          <p style={{
            fontSize: '0.82rem', color: '#7A6A55', lineHeight: 1.8, whiteSpace: 'pre-wrap',
            backgroundImage: 'repeating-linear-gradient(transparent, transparent 23px, #E8DCC8 24px)',
            paddingTop: 2,
          }}>
            {page.photo.content}
          </p>
        )}
      </div>
    </section>
  );
}

function GalleryPreview({ page, index, total }: { page: BookPage; index: number; total: number }) {
  return (
    <section style={{
      background: '#F5F0EB',
      borderRadius: 12,
      padding: 28,
      marginBottom: 12,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      {/* Frame */}
      <div style={{
        background: 'white',
        padding: '18px 18px 60px 18px',
        borderRadius: 2,
        boxShadow: '0 4px 16px rgba(0,0,0,0.15), inset 0 0 0 1px rgba(0,0,0,0.05)',
        maxWidth: 300,
        width: '100%',
      }}>
        <div style={{
          border: '1px solid #E5E0D8',
          padding: 4,
        }}>
          <img
            src={page.imageUrl}
            alt=""
            style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }}
          />
        </div>
        <div style={{ padding: '14px 4px 0', textAlign: 'center' }}>
          {page.photo.topic && (
            <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#2C2C2C', letterSpacing: '0.06em' }}>
              {page.photo.topic}
            </p>
          )}
          <p style={{ fontSize: '0.6rem', color: '#AAA', marginTop: 4, letterSpacing: '0.1em' }}>
            {formatDate(page.photo.created_at)}
          </p>
        </div>
      </div>
      {/* Museum label */}
      {page.photo.content && (
        <div style={{
          background: 'white', borderRadius: 4, padding: '10px 14px',
          marginTop: 10, maxWidth: 280, width: '100%',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        }}>
          <p style={{ fontSize: '0.75rem', color: '#555', lineHeight: 1.6, whiteSpace: 'pre-wrap', textAlign: 'center' }}>
            {page.photo.content}
          </p>
        </div>
      )}
      <span style={{ fontSize: '0.6rem', color: '#BBB', marginTop: 8 }}>{index + 1} of {total}</span>
    </section>
  );
}

/* ─── PDF Generator per Template ─── */

function generateTemplatePDF(
  pdf: jsPDF,
  bookPages: BookPage[],
  bookTitle: string,
  templateId: TemplateId,
  loadImageAsBase64: (url: string) => Promise<string>,
) {
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  const configs: Record<TemplateId, { bg: [number, number, number]; accent: [number, number, number]; textColor: [number, number, number]; subColor: [number, number, number] }> = {
    minimal:   { bg: [250, 250, 250], accent: [51, 51, 51],   textColor: [51, 51, 51],    subColor: [170, 170, 170] },
    magazine:  { bg: [26, 26, 26],    accent: [232, 197, 71],  textColor: [212, 212, 212], subColor: [119, 119, 119] },
    polaroid:  { bg: [255, 248, 240], accent: [196, 117, 80],  textColor: [90, 64, 48],    subColor: [196, 168, 130] },
    cinematic: { bg: [13, 13, 13],    accent: [255, 107, 53],  textColor: [153, 153, 153], subColor: [68, 68, 68] },
    diary:     { bg: [254, 249, 239], accent: [139, 115, 85],  textColor: [90, 74, 53],    subColor: [196, 176, 138] },
    gallery:   { bg: [245, 240, 235], accent: [44, 44, 44],    textColor: [85, 85, 85],    subColor: [170, 170, 170] },
  };

  const c = configs[templateId];

  return async () => {
    // Cover page
    pdf.setFillColor(...c.bg);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(28);
    pdf.setTextColor(...c.accent);
    pdf.text(bookTitle, pageWidth / 2, pageHeight / 2 - 20, { align: 'center' });
    pdf.setFontSize(12);
    pdf.setTextColor(...c.subColor);
    pdf.text(formatDate(new Date().toISOString()), pageWidth / 2, pageHeight / 2 + 10, { align: 'center' });

    // Content pages
    for (const page of bookPages) {
      pdf.addPage();
      pdf.setFillColor(...c.bg);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');

      let yPos = margin + 10;

      // Photo
      try {
        const imgData = await loadImageAsBase64(page.imageUrl);
        const imgWidth = templateId === 'cinematic' ? contentWidth : contentWidth - 20;
        const imgRatio = templateId === 'cinematic' ? 0.42 : 0.75;
        const imgHeight = imgWidth * imgRatio;
        const imgX = templateId === 'cinematic' ? margin : margin + 10;
        pdf.addImage(imgData, 'JPEG', imgX, yPos, imgWidth, imgHeight);
        yPos += imgHeight + 12;
      } catch {
        yPos += 10;
      }

      // Topic
      if (page.photo.topic) {
        pdf.setFontSize(13);
        pdf.setTextColor(...c.accent);
        pdf.setFont('helvetica', 'bold');
        const topicText = templateId === 'diary' ? `📌 ${page.photo.topic}` : `#${page.photo.topic}`;
        pdf.text(topicText, margin + 10, yPos + 5);
        yPos += 12;
      }

      // Date
      pdf.setFontSize(8);
      pdf.setTextColor(...c.subColor);
      pdf.setFont('helvetica', 'normal');
      pdf.text(formatDate(page.photo.created_at), margin + 10, yPos + 4);
      yPos += 10;

      // Content
      if (page.photo.content) {
        pdf.setFontSize(10);
        pdf.setTextColor(...c.textColor);
        pdf.setFont('helvetica', templateId === 'cinematic' ? 'italic' : 'normal');
        const text = templateId === 'cinematic' ? `"${page.photo.content}"` : page.photo.content;
        const lines = pdf.splitTextToSize(text, contentWidth - 20);
        const lineHeight = 6;
        for (const line of lines) {
          if (yPos + lineHeight > pageHeight - margin) break;
          pdf.text(line, margin + 10, yPos);
          yPos += lineHeight;
        }
      }
    }

    pdf.save(`${bookTitle || 'photobook'}.pdf`);
  };
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
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>('minimal');

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
    setStep('template');
  };

  const goToPreview = () => {
    const selected = photos.filter((p) => selectedIds.has(p.id));
    const pages: BookPage[] = selected.map((photo) => ({
      photo,
      imageUrl: resolveImageUrl(photo.edited_url || photo.thumbnail_url || photo.original_url),
    }));
    setBookPages(pages);
    setStep('preview');
  };

  const loadImageAsBase64 = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('No canvas context'));
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = url;
    });
  };

  const handleGeneratePDF = async () => {
    setStep('generating');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const generator = generateTemplatePDF(pdf, bookPages, bookTitle, selectedTemplate, loadImageAsBase64);
    await generator();
    setStep('preview');
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

  const renderPreviewPage = (page: BookPage, index: number, total: number) => {
    switch (selectedTemplate) {
      case 'minimal': return <MinimalPreview key={page.photo.id} page={page} index={index} total={total} />;
      case 'magazine': return <MagazinePreview key={page.photo.id} page={page} index={index} total={total} />;
      case 'polaroid': return <PolaroidPreview key={page.photo.id} page={page} index={index} total={total} />;
      case 'cinematic': return <CinematicPreview key={page.photo.id} page={page} index={index} total={total} />;
      case 'diary': return <DiaryPreview key={page.photo.id} page={page} index={index} total={total} />;
      case 'gallery': return <GalleryPreview key={page.photo.id} page={page} index={index} total={total} />;
    }
  };

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
                      <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                <span>{TEMPLATES.find(t => t.id === selectedTemplate)?.name} 스타일로 미리보기</span>
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
                {TEMPLATES.find(t => t.id === selectedTemplate)?.emoji}{' '}
                {TEMPLATES.find(t => t.id === selectedTemplate)?.name} · {bookPages.length}페이지
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
                <span>{step === 'generating' ? 'PDF 생성 중...' : 'PDF 다운로드'}</span>
              </PrimaryButton>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
