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

export default function PhotoBookPage() {
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [step, setStep] = useState<'select' | 'preview' | 'generating'>('select');
  const [bookTitle, setBookTitle] = useState('');
  const [bookPages, setBookPages] = useState<BookPage[]>([]);

  const loadPhotos = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/api/v1/photos');
      const data = Array.isArray(response.data) ? response.data : [];
      setPhotos(data);
    } catch {
      // Fallback to local
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

  const goToPreview = () => {
    const selected = photos.filter((p) => selectedIds.has(p.id));
    const pages: BookPage[] = selected.map((photo) => ({
      photo,
      imageUrl: resolveImageUrl(photo.edited_url || photo.thumbnail_url || photo.original_url),
    }));
    setBookPages(pages);
    if (!bookTitle.trim()) {
      const now = new Date();
      setBookTitle(`${now.getFullYear()}년 나의 사진 이야기`);
    }
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

  const generatePDF = async () => {
    setStep('generating');

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;

    // Cover page
    pdf.setFillColor(255, 245, 235); // warm cream
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(28);
    pdf.setTextColor(74, 55, 40);
    pdf.text(bookTitle, pageWidth / 2, pageHeight / 2 - 20, { align: 'center' });
    pdf.setFontSize(14);
    pdf.setTextColor(140, 120, 100);
    pdf.text(formatDate(new Date().toISOString()), pageWidth / 2, pageHeight / 2 + 10, { align: 'center' });

    // Content pages
    for (const page of bookPages) {
      pdf.addPage();
      pdf.setFillColor(255, 248, 240);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');

      let yPos = margin;

      // Photo
      try {
        const imgData = await loadImageAsBase64(page.imageUrl);
        const imgWidth = contentWidth;
        const imgHeight = contentWidth * 0.75; // 4:3 aspect
        pdf.addImage(imgData, 'JPEG', margin, yPos, imgWidth, imgHeight);
        yPos += imgHeight + 8;
      } catch {
        // Skip image if it fails to load
        yPos += 10;
      }

      // Topic
      if (page.photo.topic) {
        pdf.setFontSize(12);
        pdf.setTextColor(196, 117, 80);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`#${page.photo.topic}`, margin, yPos + 5);
        yPos += 12;
      }

      // Date
      pdf.setFontSize(9);
      pdf.setTextColor(160, 140, 120);
      pdf.setFont('helvetica', 'normal');
      pdf.text(formatDate(page.photo.created_at), margin, yPos + 4);
      yPos += 10;

      // Draft text
      if (page.photo.content) {
        pdf.setFontSize(11);
        pdf.setTextColor(74, 55, 40);
        pdf.setFont('helvetica', 'normal');
        const lines = pdf.splitTextToSize(page.photo.content, contentWidth);
        const lineHeight = 6;
        for (const line of lines) {
          if (yPos + lineHeight > pageHeight - margin) break;
          pdf.text(line, margin, yPos);
          yPos += lineHeight;
        }
      }
    }

    pdf.save(`${bookTitle || 'photobook'}.pdf`);
    setStep('preview');
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
      <PageHeader
        title={step === 'select' ? '사진집 만들기' : '미리보기'}
        showBack
        onBack={() => {
          if (step === 'preview') setStep('select');
          else navigate(-1);
        }}
      />

      <main className="story-content-container" style={{ paddingBottom: 30 }}>
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
                            top: 4,
                            right: 4,
                            width: 24,
                            height: 24,
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
                <PrimaryButton onClick={goToPreview} size="lg" className="story-cta-with-icon" style={{ width: '100%' }}>
                  <span className="story-icon-3d story-icon-3d-sm" aria-hidden="true">
                    <span className="story-icon-emoji">&#x1F4D6;</span>
                  </span>
                  <span>{selectedIds.size}장으로 사진집 만들기</span>
                </PrimaryButton>
              </div>
            )}
          </>
        )}

        {(step === 'preview' || step === 'generating') && (
          <>
            {/* Title */}
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
                {bookPages.length}페이지 사진집
              </p>
            </section>

            {/* Page previews */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {bookPages.map((page, index) => (
                <section
                  key={page.photo.id}
                  className="story-surface-card"
                  style={{ overflow: 'hidden', padding: 0 }}
                >
                  <div style={{ padding: '8px 12px 4px', fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>
                    {index + 1} / {bookPages.length}
                  </div>
                  <img
                    src={page.imageUrl}
                    alt=""
                    style={{ width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block' }}
                  />
                  <div style={{ padding: '10px 14px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      {page.photo.topic && (
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#C47550' }}>
                          #{page.photo.topic}
                        </span>
                      )}
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                        {formatDate(page.photo.created_at)}
                      </span>
                    </div>
                    {page.photo.content && (
                      <p
                        style={{
                          whiteSpace: 'pre-wrap',
                          fontSize: '0.85rem',
                          lineHeight: 'var(--line-height-relaxed)',
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        {page.photo.content}
                      </p>
                    )}
                  </div>
                </section>
              ))}
            </div>

            {/* Actions */}
            <div className="story-action-grid" style={{ marginTop: 16 }}>
              <SecondaryButton onClick={() => setStep('select')} size="md">
                사진 다시 선택
              </SecondaryButton>
              <PrimaryButton
                onClick={generatePDF}
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
