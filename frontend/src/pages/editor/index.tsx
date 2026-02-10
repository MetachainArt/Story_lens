/**
 * @TASK P3-S4-T1 - Editor Page Implementation
 * @SPEC specs/screens/editor.yaml
 */
import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useEditorStore } from '../../stores/editor';
import type { Photo } from '../../types/photo';
import type { Filter } from '../../types/filter';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function EditorPage() {
  const { photoId } = useParams<{ photoId: string }>();
  const navigate = useNavigate();

  const [photo, setPhoto] = useState<Photo | null>(null);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const {
    selectedFilter,
    adjustments,
    rotation,
    flipX,
    activeTab,
    setPhotoId,
    setOriginalUrl,
    setFilter,
    setAdjustment,
    setRotation,
    setFlipX,
    setActiveTab,
    getComputedFilterCss,
    getComputedTransform,
    reset,
  } = useEditorStore();

  // Load photo and filters - DEV: blob URL 직접 사용
  useEffect(() => {
    if (!photoId) {
      navigate('/home');
      return;
    }

    // DEV: sessionStorage에서 blob URL 가져오기
    const devPhotoUrl = sessionStorage.getItem('dev_photo_url');
    if (devPhotoUrl) {
      setPhoto({
        id: 'dev-photo',
        session_id: 'dev-session',
        user_id: '11111111-1111-1111-1111-111111111111',
        original_url: devPhotoUrl,
        edited_url: null,
        created_at: new Date().toISOString(),
      } as Photo);
      setPhotoId(photoId);
      setOriginalUrl(devPhotoUrl);

      // 기본 필터 목록 (서버 없이)
      setFilters([
        { id: 1, name: 'normal', label: '원본', css_filter: 'none', preview_url: null },
        { id: 2, name: 'grayscale', label: '흑백', css_filter: 'grayscale(100%)', preview_url: null },
        { id: 3, name: 'sepia', label: '세피아', css_filter: 'sepia(80%)', preview_url: null },
        { id: 4, name: 'warm', label: '따뜻한', css_filter: 'sepia(30%) saturate(140%)', preview_url: null },
        { id: 5, name: 'cool', label: '시원한', css_filter: 'hue-rotate(180deg) saturate(80%)', preview_url: null },
        { id: 6, name: 'bright', label: '밝은', css_filter: 'brightness(130%) contrast(110%)', preview_url: null },
        { id: 7, name: 'vivid', label: '선명한', css_filter: 'saturate(180%) contrast(120%)', preview_url: null },
        { id: 8, name: 'soft', label: '부드러운', css_filter: 'brightness(110%) contrast(90%) saturate(90%)', preview_url: null },
        { id: 9, name: 'vintage', label: '빈티지', css_filter: 'sepia(50%) contrast(90%) brightness(90%)', preview_url: null },
        { id: 10, name: 'dramatic', label: '드라마', css_filter: 'contrast(150%) brightness(90%) saturate(120%)', preview_url: null },
      ]);

      setIsLoading(false);
    } else {
      // 원래 API 호출 (서버가 있을 때)
      const loadData = async () => {
        try {
          setIsLoading(true);
          const [photoRes, filtersRes] = await Promise.all([
            api.get(`/api/v1/photos/${photoId}`),
            api.get('/api/filters'),
          ]);

          setPhoto(photoRes.data);
          setFilters(filtersRes.data);
          setPhotoId(photoId);
          setOriginalUrl(photoRes.data.original_url);
        } catch (err: any) {
          console.error('Load error:', err);
          setError('오류가 발생했습니다. 다시 시도해주세요.');
        } finally {
          setIsLoading(false);
        }
      };

      loadData();
    }

    return () => {
      reset();
    };
  }, [photoId, navigate, setPhotoId, setOriginalUrl, reset]);

  // Draw canvas when photo or effects change
  useEffect(() => {
    if (!photo || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Load image
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;

      // Set canvas size
      canvas.width = img.width;
      canvas.height = img.height;

      // Apply CSS filters (brightness, contrast, saturation, etc.)
      ctx.filter = getComputedFilterCss();

      // Draw image
      ctx.drawImage(img, 0, 0);

      // Reset filter before pixel manipulation
      ctx.filter = 'none';

      // 샤픈: 양수일 때 convolution kernel 적용
      if (adjustments.sharpness > 0) {
        const strength = adjustments.sharpness / 50; // 0~1
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const src = imageData.data;
        const w = canvas.width;
        const h = canvas.height;
        const out = new Uint8ClampedArray(src);

        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const idx = (y * w + x) * 4;
            for (let c = 0; c < 3; c++) {
              const center = src[idx + c];
              const neighbors =
                src[((y - 1) * w + x) * 4 + c] +
                src[((y + 1) * w + x) * 4 + c] +
                src[(y * w + x - 1) * 4 + c] +
                src[(y * w + x + 1) * 4 + c];
              out[idx + c] = Math.min(255, Math.max(0,
                center + strength * (4 * center - neighbors)
              ));
            }
          }
        }

        imageData.data.set(out);
        ctx.putImageData(imageData, 0, 0);
      }
    };
    img.src = photo.original_url;
  }, [photo, selectedFilter, adjustments, getComputedFilterCss]);

  // Handle save - DEV: 서버 없이 바로 저장 화면으로 이동
  const handleSave = async () => {
    if (!photo || !canvasRef.current) return;

    try {
      setIsSaving(true);

      // Get data URL from canvas
      const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.9);

      // DEV: blob URL이면 서버 저장 건너뛰기
      const isDevMode = sessionStorage.getItem('dev_photo_url');
      if (!isDevMode) {
        // 서버가 있을 때만 API 호출
        await api.post(`/api/photos/${photo.id}/edits`, {
          filter_name: selectedFilter,
          adjustments: {
            brightness: adjustments.brightness,
            contrast: adjustments.contrast,
            saturation: adjustments.saturation,
            temperature: adjustments.temperature,
            sharpness: adjustments.sharpness,
          },
          crop_data: { rotation, flipX },
        });
        await api.put(`/api/v1/photos/${photo.id}`, { edited_url: dataUrl });
      }

      // 로컬 갤러리에 저장
      const savedPhotos = JSON.parse(localStorage.getItem('saved_photos') || '[]');
      savedPhotos.unshift({
        id: `local-${Date.now()}`,
        edited_url: dataUrl,
        created_at: new Date().toISOString(),
      });
      localStorage.setItem('saved_photos', JSON.stringify(savedPhotos));

      // Navigate to saved screen with state
      navigate('/saved', {
        state: {
          photoId: photo.id,
          editedUrl: dataUrl,
        },
      });
    } catch (err: any) {
      console.error('Save error:', err);
      setError('저장 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <div className="text-center">
          <p className="text-text-primary mb-4">{error}</p>
          <button
            onClick={() => navigate('/home')}
            className="px-4 py-2 bg-primary text-white rounded-lg"
          >
            홈으로
          </button>
        </div>
      </div>
    );
  }

  if (!photo) return null;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--color-bg-primary)' }}>
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          background: 'linear-gradient(180deg, var(--color-surface) 0%, var(--color-bg-soft) 100%)',
          borderBottom: '1.5px solid var(--color-border)',
        }}
      >
        <button
          onClick={() => navigate(-1)}
          aria-label="뒤로 가기"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: 'var(--color-text-primary)' }}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <h1 style={{ fontFamily: 'var(--font-family-serif)', fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '0.05em' }}>
          편집
        </h1>

        <button
          onClick={handleSave}
          disabled={isSaving}
          style={{
            padding: '10px 24px',
            background: 'linear-gradient(135deg, #D4845A 0%, #C47550 100%)',
            color: '#FFF8F0',
            border: '2px solid rgba(255,255,255,0.2)',
            borderRadius: 'var(--radius-2xl)',
            fontSize: '1rem',
            fontWeight: 600,
            fontFamily: 'var(--font-family)',
            cursor: isSaving ? 'not-allowed' : 'pointer',
            boxShadow: 'var(--shadow-cute)',
            opacity: isSaving ? 0.5 : 1,
          }}
        >
          {isSaving ? '저장 중...' : '&#x2728; 저장'}
        </button>
      </header>

      {/* Canvas Container */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflow: 'hidden' }}>
        <div
          style={{
            position: 'relative',
            maxWidth: '100%',
            maxHeight: '100%',
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-xl)',
            border: '2px solid var(--color-border)',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              maxWidth: '100%',
              maxHeight: '55vh',
              objectFit: 'contain',
              display: 'block',
              transform: getComputedTransform(),
              transition: 'transform 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: 'var(--color-surface)', borderTop: '1.5px solid var(--color-border)' }}>
        <div style={{ display: 'flex', borderBottom: '1.5px solid var(--color-border)' }}>
          {(['filter', 'adjustment', 'crop'] as const).map((tab) => {
            const labels = { filter: '필터', adjustment: '조절', crop: '자르기' };
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                aria-selected={isActive}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  fontFamily: 'var(--font-family)',
                  fontSize: '0.95rem',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  background: isActive ? 'var(--color-primary-light)' : 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '2.5px solid var(--color-primary)' : '2.5px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div style={{ padding: 16, height: 200, overflowY: 'auto' }}>
          {activeTab === 'filter' && (
            <FilterPanel
              filters={filters}
              selectedFilter={selectedFilter}
              onSelectFilter={setFilter}
              photoUrl={photo.original_url}
            />
          )}

          {activeTab === 'adjustment' && (
            <AdjustmentPanel
              adjustments={adjustments}
              onAdjustmentChange={setAdjustment}
            />
          )}

          {activeTab === 'crop' && (
            <CropPanel
              rotation={rotation}
              flipX={flipX}
              onRotate90={() => setRotation(rotation + 90)}
              onSetRotation={setRotation}
              onFlip={() => setFlipX(!flipX)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Filter Panel Component
function FilterPanel({
  filters,
  selectedFilter,
  onSelectFilter,
  photoUrl,
}: {
  filters: Filter[];
  selectedFilter: string | null;
  onSelectFilter: (name: string, css: string) => void;
  photoUrl: string;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
      {filters.map((filter) => {
        const isSelected = selectedFilter === filter.name;
        return (
          <button
            key={filter.id}
            onClick={() => onSelectFilter(filter.name, filter.css_filter)}
            style={{
              position: 'relative',
              aspectRatio: '1/1',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              border: isSelected ? '2.5px solid var(--color-primary)' : '2px solid var(--color-border)',
              boxShadow: isSelected ? 'var(--shadow-cute)' : 'var(--shadow-sm)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: 'var(--color-bg-soft)',
              padding: 0,
            }}
          >
            <div style={{ width: '100%', height: '100%', filter: filter.css_filter }}>
              <img src={photoUrl} alt={filter.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                background: isSelected ? 'rgba(212,132,90,0.85)' : 'rgba(74,55,40,0.6)',
                color: '#FFF8F0',
                fontSize: '0.7rem',
                padding: '3px 0',
                textAlign: 'center',
                fontFamily: 'var(--font-family)',
              }}
            >
              {filter.label}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// Adjustment Panel Component
function AdjustmentPanel({
  adjustments,
  onAdjustmentChange,
}: {
  adjustments: {
    brightness: number;
    contrast: number;
    saturation: number;
    temperature: number;
    sharpness: number;
  };
  onAdjustmentChange: (key: keyof typeof adjustments, value: number) => void;
}) {
  const adjustmentControls = [
    { key: 'brightness' as const, label: '밝기' },
    { key: 'saturation' as const, label: '채도' },
    { key: 'contrast' as const, label: '대비' },
    { key: 'temperature' as const, label: '온도' },
    { key: 'sharpness' as const, label: '샤픈 (선명도)' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {adjustmentControls.map(({ key, label }) => (
        <div key={key}>
          <label
            htmlFor={`adj-${key}`}
            style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4, fontFamily: 'var(--font-family)', color: 'var(--color-text-primary)' }}
          >
            <span>{label}</span>
            <span style={{ color: 'var(--color-primary)', fontWeight: 600, minWidth: 32, textAlign: 'right' }}>{adjustments[key]}</span>
          </label>
          <input
            id={`adj-${key}`}
            type="range"
            min="-50"
            max="50"
            value={adjustments[key]}
            onChange={(e) => onAdjustmentChange(key, Number(e.target.value))}
            aria-label={label}
            style={{ width: '100%', height: 6, borderRadius: 'var(--radius-full)', appearance: 'none', background: 'var(--color-border)', cursor: 'pointer', accentColor: '#D4845A' }}
          />
        </div>
      ))}
    </div>
  );
}

// Crop Panel Component
function CropPanel({
  rotation,
  flipX,
  onRotate90,
  onSetRotation,
  onFlip,
}: {
  rotation: number;
  flipX: boolean;
  onRotate90: () => void;
  onSetRotation: (deg: number) => void;
  onFlip: () => void;
}) {
  const btnStyle = (active = false): React.CSSProperties => ({
    flex: 1,
    padding: '10px 0',
    background: active ? 'linear-gradient(135deg, #D4845A 0%, #C47550 100%)' : 'var(--color-bg-soft)',
    color: active ? '#FFF8F0' : 'var(--color-text-primary)',
    border: active ? '1.5px solid rgba(255,255,255,0.2)' : '1.5px solid var(--color-border)',
    borderRadius: 'var(--radius-xl)',
    cursor: 'pointer',
    fontFamily: 'var(--font-family)',
    fontSize: '0.85rem',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    transition: 'all 0.2s',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Rotation slider */}
      <div>
        <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4, fontFamily: 'var(--font-family)', color: 'var(--color-text-primary)' }}>
          <span>각도 조절</span>
          <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{rotation}°</span>
        </label>
        <input
          type="range"
          min="-180"
          max="180"
          step="1"
          value={rotation}
          onChange={(e) => onSetRotation(Number(e.target.value))}
          aria-label="회전 각도"
          style={{ width: '100%', height: 6, borderRadius: 'var(--radius-full)', appearance: 'none', background: 'var(--color-border)', cursor: 'pointer', accentColor: '#D4845A' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--color-text-light)', marginTop: 2 }}>
          <span>-180°</span>
          <span>0°</span>
          <span>180°</span>
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => onSetRotation(0)} style={btnStyle()}>
          0° 초기화
        </button>
        <button onClick={onRotate90} style={btnStyle()}>
          +90°
        </button>
        <button onClick={onFlip} style={btnStyle(flipX)}>
          뒤집기
        </button>
      </div>
    </div>
  );
}
