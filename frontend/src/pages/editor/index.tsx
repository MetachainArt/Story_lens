/**
 * @TASK P3-S4-T1 - Editor Page Implementation
 * @SPEC specs/screens/editor.yaml
 */
import { useEffect, useState, useRef, useCallback, useMemo, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useEditorStore } from '../../stores/editor';
import type { Photo } from '../../types/photo';
import type { Filter } from '../../types/filter';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { isAllowedImageUrl, resolveImageUrl, safeJsonArray } from '../../utils/storage';

export default function EditorPage() {
  const { photoId } = useParams<{ photoId: string }>();
  const navigate = useNavigate();

  const [photo, setPhoto] = useState<Photo | null>(null);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState('');

  const imageRef = useRef<HTMLImageElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);

  // Zoom & Pan state
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);

  const getTouchDist = (t1: React.Touch, t2: React.Touch) =>
    Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

  const clampZoom = (z: number) => Math.min(Math.max(z, 0.5), 5);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch start
      e.preventDefault();
      const dist = getTouchDist(e.touches[0], e.touches[1]);
      pinchRef.current = { dist, zoom };
      dragRef.current = null;
    } else if (e.touches.length === 1 && zoom > 1) {
      // Pan start (only when zoomed in)
      dragRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, panX, panY };
    }
  }, [zoom, panX, panY]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const dist = getTouchDist(e.touches[0], e.touches[1]);
      const scale = dist / pinchRef.current.dist;
      setZoom(clampZoom(pinchRef.current.zoom * scale));
    } else if (e.touches.length === 1 && dragRef.current && zoom > 1) {
      const dx = e.touches[0].clientX - dragRef.current.startX;
      const dy = e.touches[0].clientY - dragRef.current.startY;
      setPanX(dragRef.current.panX + dx);
      setPanY(dragRef.current.panY + dy);
    }
  }, [zoom]);

  const handleTouchEnd = useCallback(() => {
    pinchRef.current = null;
    dragRef.current = null;
    // Reset pan when zoom returns to 1
    if (zoom <= 1) {
      setPanX(0);
      setPanY(0);
    }
  }, [zoom]);

  // Reset pan when zoom changes to <= 1
  useEffect(() => {
    if (zoom <= 1) {
      setPanX(0);
      setPanY(0);
    }
  }, [zoom]);

  const {
    selectedFilter,
    adjustments,
    rotation,
    flipX,
    cropRect,
    activeTab,
    setPhotoId,
    setOriginalUrl,
    setFilter,
    setAdjustment,
    setRotation,
    setFlipX,
    setCropRect,
    setActiveTab,
    getComputedFilterCss,
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
    const savedTopic = sessionStorage.getItem('selected_topic') || '';
    setSelectedTopic(savedTopic);
    if (devPhotoUrl && isAllowedImageUrl(devPhotoUrl)) {
      setPhoto({
        id: 'dev-photo',
        session_id: 'dev-session',
        user_id: '11111111-1111-1111-1111-111111111111',
        original_url: devPhotoUrl,
        edited_url: null,
        title: null,
        topic: savedTopic || null,
        thumbnail_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
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

          const normalizedPhoto: Photo = {
            ...photoRes.data,
            original_url: resolveImageUrl(photoRes.data.original_url),
            edited_url: photoRes.data.edited_url
              ? resolveImageUrl(photoRes.data.edited_url)
              : null,
            thumbnail_url: photoRes.data.thumbnail_url
              ? resolveImageUrl(photoRes.data.thumbnail_url)
              : null,
          };

          setPhoto(normalizedPhoto);
          setFilters(filtersRes.data);
          setPhotoId(photoId);
          setOriginalUrl(normalizedPhoto.original_url);
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

  // Memoized CSS computations
  const filterCss = useMemo(() => {
    const parts: string[] = [];
    if (selectedFilter && selectedFilter !== 'normal') {
      const f = filters.find(f => f.name === selectedFilter);
      if (f && f.css_filter && f.css_filter !== 'none') parts.push(f.css_filter);
    }
    if (adjustments.brightness !== 0) parts.push(`brightness(${1 + adjustments.brightness / 100})`);
    if (adjustments.contrast !== 0) parts.push(`contrast(${1 + adjustments.contrast / 100})`);
    if (adjustments.saturation !== 0) parts.push(`saturate(${1 + adjustments.saturation / 100})`);
    if (adjustments.temperature > 0) parts.push(`sepia(${adjustments.temperature / 100})`);
    if (adjustments.temperature < 0) parts.push(`hue-rotate(${adjustments.temperature}deg)`);
    if (adjustments.sharpness > 0) parts.push(`contrast(${1 + adjustments.sharpness / 150})`);
    if (adjustments.sharpness < 0) parts.push(`blur(${Math.abs(adjustments.sharpness) / 15}px)`);
    return parts.length > 0 ? parts.join(' ') : '';
  }, [selectedFilter, filters, adjustments]);

  const transformCss = useMemo(() => {
    const parts: string[] = [];
    if (panX !== 0 || panY !== 0) parts.push(`translate(${panX}px, ${panY}px)`);
    if (zoom !== 1) parts.push(`scale(${zoom})`);
    if (rotation !== 0) parts.push(`rotate(${rotation}deg)`);
    if (flipX) parts.push('scaleX(-1)');
    return parts.length > 0 ? parts.join(' ') : '';
  }, [panX, panY, zoom, rotation, flipX]);

  // Preload image for saving
  useEffect(() => {
    if (!photo) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { imageRef.current = img; };
    img.src = photo.original_url;
  }, [photo]);

  // Handle save - DEV: 서버 없이 바로 저장 화면으로 이동
  const handleSave = async () => {
    if (!photo) {
      setError('편집할 사진 정보가 없습니다.');
      return;
    }

    if (!imageRef.current) {
      setError('이미지 로딩이 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.');
      return;
    }

    try {
      setIsSaving(true);

      // Draw to canvas with all effects applied
      const img = imageRef.current;
      // Apply crop
      const cropL = Math.round((cropRect.left / 100) * img.width);
      const cropT = Math.round((cropRect.top / 100) * img.height);
      const cropW = Math.round(img.width * (1 - (cropRect.left + cropRect.right) / 100));
      const cropH = Math.round(img.height * (1 - (cropRect.top + cropRect.bottom) / 100));
      const canvas = document.createElement('canvas');
      const rad = (rotation * Math.PI) / 180;
      const absC = Math.abs(Math.cos(rad));
      const absS = Math.abs(Math.sin(rad));
      canvas.width = Math.round(cropW * absC + cropH * absS);
      canvas.height = Math.round(cropW * absS + cropH * absC);
      const ctx = canvas.getContext('2d')!;

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(rad);
      if (flipX) ctx.scale(-1, 1);
      ctx.filter = getComputedFilterCss() || 'none';
      ctx.drawImage(img, cropL, cropT, cropW, cropH, -cropW / 2, -cropH / 2, cropW, cropH);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      const topicToSave = selectedTopic.trim() || photo.topic || null;

      const isDevMode = isAllowedImageUrl(sessionStorage.getItem('dev_photo_url'));
      let serverPhotoId: string | null = null;

      if (!isDevMode) {
        // API mode: upload edited image as file (avoids large JSON body)
        const [header, base64] = dataUrl.split(',');
        const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: mime });
        const editFormData = new FormData();
        editFormData.append('file', blob, 'edited.jpg');
        if (topicToSave) editFormData.append('topic', topicToSave);
        await api.post(`/api/v1/photos/${photo.id}/upload-edited`, editFormData);
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
        serverPhotoId = photo.id;
      } else {
        // Dev mode: upload edited photo to server for AI writing
        try {
          const [header, base64] = dataUrl.split(',');
          const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const blob = new Blob([bytes], { type: mime });
          const formData = new FormData();
          formData.append('file', blob, 'photo.jpg');
          if (topicToSave) formData.append('topic', topicToSave);
          const uploadRes = await api.post('/api/v1/photos', formData);
          serverPhotoId = uploadRes.data?.id || null;
        } catch {
          // Upload failed (not logged in, etc.) - continue with local save
        }
      }

      const savedPhotos = safeJsonArray<{
        id?: unknown;
        edited_url?: unknown;
        topic?: unknown;
        created_at?: unknown;
      }>(localStorage.getItem('saved_photos'));
      const normalizedSavedPhotos = savedPhotos
        .filter((item): item is { id: string; edited_url: string; topic: string | null; created_at: string } => {
          if (!item || typeof item !== 'object') {
            return false;
          }
          const typedItem = item as {
            id?: unknown;
            edited_url?: unknown;
            topic?: unknown;
            created_at?: unknown;
          };
          return (
            typeof typedItem.id === 'string' &&
            typeof typedItem.edited_url === 'string' &&
            (typedItem.topic === null || typeof typedItem.topic === 'string') &&
            typeof typedItem.created_at === 'string'
          );
        })
        .map((item) => ({
          id: item.id,
          edited_url: item.edited_url,
          topic: item.topic,
          created_at: item.created_at,
        }));

      const finalPhotoId = serverPhotoId || `local-${Date.now()}`;
      const currentPhoto = {
        id: finalPhotoId,
        edited_url: dataUrl,
        topic: topicToSave,
        created_at: new Date().toISOString(),
      };

      localStorage.setItem('saved_photos', JSON.stringify([currentPhoto, ...normalizedSavedPhotos]));

      // Navigate to saved screen with state
      navigate('/saved', {
        state: {
          photoId: finalPhotoId,
          editedUrl: dataUrl,
          topic: topicToSave,
        },
      });
    } catch (err) {
      console.error('Save error:', err);
      setError('저장 중 오류가 발생했습니다. 다시 시도해 주세요.');
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
          {isSaving ? '저장 중...' : '✨ 저장'}
        </button>
      </header>

      {selectedTopic.trim() && (
        <div style={{ padding: '8px 16px 0' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              borderRadius: 'var(--radius-full)',
              background: 'rgba(212,132,90,0.18)',
              border: '1.5px solid rgba(196,117,80,0.35)',
              color: 'var(--color-text-primary)',
              padding: '6px 12px',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            <span>주제</span>
            <span>#{selectedTopic.trim()}</span>
          </div>
        </div>
      )}

      {/* Photo Preview - CSS 필터 + 회전 + 줌 실시간 적용 */}
      <div
        ref={previewRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflow: 'hidden', position: 'relative', touchAction: zoom > 1 ? 'none' : 'pan-y' }}
      >
        <div
          style={{
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-xl)',
            border: '2px solid var(--color-border)',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src={photo.original_url}
            alt="편집 중"
            draggable={false}
            style={{
              maxWidth: '100%',
              maxHeight: '45dvh',
              objectFit: 'contain',
              display: 'block',
              filter: filterCss || undefined,
              transform: transformCss || undefined,
              transition: pinchRef.current ? 'none' : 'filter 0.15s, transform 0.3s ease',
              clipPath: (cropRect.top > 0 || cropRect.left > 0 || cropRect.right > 0 || cropRect.bottom > 0)
                ? `inset(${cropRect.top}% ${cropRect.right}% ${cropRect.bottom}% ${cropRect.left}%)`
                : undefined,
            }}
          />
        </div>

        {/* Zoom controls overlay */}
        <div
          style={{
            position: 'absolute',
            right: 'max(20px, env(safe-area-inset-right))',
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            zIndex: 10,
          }}
        >
          <button
            onClick={() => setZoom(clampZoom(zoom + 0.25))}
            aria-label="확대"
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'rgba(74,55,40,0.6)',
              backdropFilter: 'blur(8px)',
              border: '1.5px solid rgba(255,248,240,0.2)',
              color: '#FFF8F0',
              fontSize: '1.3rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            +
          </button>

          <div
            style={{
              textAlign: 'center',
              fontSize: '0.7rem',
              fontWeight: 600,
              color: '#FFF8F0',
              background: 'rgba(74,55,40,0.6)',
              backdropFilter: 'blur(8px)',
              borderRadius: 'var(--radius-lg)',
              padding: '4px 2px',
              fontFamily: 'var(--font-family)',
              minWidth: 40,
            }}
          >
            {Math.round(zoom * 100)}%
          </div>

          <button
            onClick={() => setZoom(clampZoom(zoom - 0.25))}
            aria-label="축소"
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'rgba(74,55,40,0.6)',
              backdropFilter: 'blur(8px)',
              border: '1.5px solid rgba(255,248,240,0.2)',
              color: '#FFF8F0',
              fontSize: '1.3rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            &minus;
          </button>

          {zoom !== 1 && (
            <button
              onClick={() => { setZoom(1); setPanX(0); setPanY(0); }}
              aria-label="원래 크기"
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'rgba(212,132,90,0.75)',
                backdropFilter: 'blur(8px)',
                border: '1.5px solid rgba(255,248,240,0.2)',
                color: '#FFF8F0',
                fontSize: '0.65rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-family)',
              }}
            >
              1:1
            </button>
          )}
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
              cropRect={cropRect}
              onRotate90={() => setRotation(rotation + 90)}
              onSetRotation={setRotation}
              onFlip={() => setFlipX(!flipX)}
              onCropChange={setCropRect}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Filter Panel Component
const FilterPanel = memo(function FilterPanel({
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
});

// Adjustment Panel Component
const AdjustmentPanel = memo(function AdjustmentPanel({
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
            onInput={(e) => onAdjustmentChange(key, Number((e.target as HTMLInputElement).value))}
            aria-label={label}
            style={{ width: '100%', height: 24, borderRadius: 'var(--radius-full)', cursor: 'pointer', accentColor: '#D4845A' }}
          />
        </div>
      ))}
    </div>
  );
});

// Crop Panel Component
const CropPanel = memo(function CropPanel({
  rotation,
  flipX,
  cropRect,
  onRotate90,
  onSetRotation,
  onFlip,
  onCropChange,
}: {
  rotation: number;
  flipX: boolean;
  cropRect: { top: number; left: number; right: number; bottom: number };
  onRotate90: () => void;
  onSetRotation: (deg: number) => void;
  onFlip: () => void;
  onCropChange: (rect: Partial<{ top: number; left: number; right: number; bottom: number }>) => void;
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

  const cropSliders = [
    { key: 'top' as const, label: '위', emoji: '⬆' },
    { key: 'bottom' as const, label: '아래', emoji: '⬇' },
    { key: 'left' as const, label: '왼쪽', emoji: '⬅' },
    { key: 'right' as const, label: '오른쪽', emoji: '➡' },
  ];

  const hasCrop = cropRect.top > 0 || cropRect.left > 0 || cropRect.right > 0 || cropRect.bottom > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', maxHeight: 190 }}>
      {/* Crop sliders */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>잘라내기</span>
          {hasCrop && (
            <button
              onClick={() => onCropChange({ top: 0, left: 0, right: 0, bottom: 0 })}
              style={{ fontSize: '0.75rem', color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-family)' }}
            >
              초기화
            </button>
          )}
        </div>
        {cropSliders.map(({ key, label, emoji }) => (
          <div key={key} style={{ marginBottom: 6 }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 2, fontFamily: 'var(--font-family)', color: 'var(--color-text-secondary)' }}>
              <span>{emoji} {label}</span>
              <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{cropRect[key]}%</span>
            </label>
            <input
              type="range"
              min="0"
              max="50"
              step="1"
              value={cropRect[key]}
              onChange={(e) => onCropChange({ [key]: Number(e.target.value) })}
              style={{ width: '100%', height: 20, borderRadius: 'var(--radius-full)', cursor: 'pointer', accentColor: '#D4845A' }}
            />
          </div>
        ))}
      </div>

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
          onInput={(e) => onSetRotation(Number((e.target as HTMLInputElement).value))}
          aria-label="회전 각도"
          style={{ width: '100%', height: 20, borderRadius: 'var(--radius-full)', cursor: 'pointer', accentColor: '#D4845A' }}
        />
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onSetRotation(0)} style={btnStyle()}>0° 초기화</button>
        <button onClick={onRotate90} style={btnStyle()}>+90°</button>
        <button onClick={onFlip} style={btnStyle(flipX)}>뒤집기</button>
      </div>
    </div>
  );
});


