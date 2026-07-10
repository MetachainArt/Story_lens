import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import api from '@/services/api';
import { useEditorStore, type DecorationOverlay, type EditorEditSnapshot } from '@/stores/editor';
import type { CreativeAsset } from '@/types/ai';
import type { Filter } from '@/types/filter';
import type { Photo } from '@/types/photo';
import { isAllowedImageUrl, resolveImageUrl, safeJsonArray } from '@/utils/storage';

const fallbackFilters: Filter[] = [
  { id: 'normal', name: 'normal', label: '원본', css_filter: 'none', preview_url: null },
  { id: 'warm', name: 'warm', label: '따뜻함', css_filter: 'brightness(1.1) saturate(1.25) sepia(0.18)', preview_url: null },
  { id: 'cool', name: 'cool', label: '시원함', css_filter: 'brightness(1.05) saturate(0.92) hue-rotate(12deg)', preview_url: null },
  { id: 'happy', name: 'happy', label: '화사함', css_filter: 'brightness(1.18) saturate(1.35) contrast(1.06)', preview_url: null },
  { id: 'film', name: 'film', label: '필름', css_filter: 'brightness(1.04) saturate(0.82) sepia(0.22) contrast(0.94)', preview_url: null },
];

const tabLabels = {
  filter: '필터',
  adjustment: '보정',
  crop: '자르기',
  decorate: '꾸미기',
} as const;

function payloadText(asset: CreativeAsset) {
  const text = asset.payload.text;
  return typeof text === 'string' && text.trim() ? text : asset.label.slice(0, 2);
}

function payloadColor(payload: Record<string, unknown>, fallback = '#D4845A') {
  return typeof payload.color === 'string' ? payload.color : fallback;
}

function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawDecorations(ctx: CanvasRenderingContext2D, decorations: DecorationOverlay[], width: number, height: number) {
  decorations.forEach((item) => {
    const x = (item.x / 100) * width;
    const y = (item.y / 100) * height;
    if (item.type === 'frame') {
      const lineWidth = Math.max(12, Math.min(width, height) * 0.04);
      ctx.save();
      ctx.strokeStyle = typeof item.payload.borderColor === 'string' ? item.payload.borderColor : '#FFFDF8';
      ctx.lineWidth = lineWidth;
      ctx.shadowColor = 'rgba(74, 55, 40, 0.2)';
      ctx.shadowBlur = 16;
      ctx.strokeRect(lineWidth / 2, lineWidth / 2, width - lineWidth, height - lineWidth);
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((item.rotation * Math.PI) / 180);
    const fontSize = Math.max(28, Math.min(width, height) * 0.1 * item.scale);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (item.type === 'speech') {
      const text = item.text || '좋아요!';
      ctx.font = `700 ${Math.max(22, fontSize * 0.38)}px sans-serif`;
      const metrics = ctx.measureText(text);
      const bubbleW = Math.max(metrics.width + 44, 120);
      const bubbleH = 58;
      ctx.fillStyle = '#FFFDF8';
      ctx.strokeStyle = '#D4845A';
      ctx.lineWidth = 4;
      drawRoundRect(ctx, -bubbleW / 2, -bubbleH / 2, bubbleW, bubbleH, 18);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#4A3728';
      ctx.fillText(text, 0, 2);
      ctx.restore();
      return;
    }

    if (item.type === 'text') {
      ctx.font = `800 ${Math.max(22, fontSize * 0.45)}px sans-serif`;
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.88)';
      ctx.fillStyle = payloadColor(item.payload, '#4A3728');
      ctx.strokeText(item.text || item.label, 0, 0);
      ctx.fillText(item.text || item.label, 0, 0);
      ctx.restore();
      return;
    }

    ctx.font = `900 ${fontSize}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillStyle = payloadColor(item.payload);
    const text = typeof item.payload.text === 'string' ? item.payload.text : item.label;
    ctx.strokeText(text, 0, 0);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  });
}

function overlayStyle(item: DecorationOverlay, selected = false): CSSProperties {
  if (item.type === 'frame') {
    return {
      position: 'absolute',
      inset: 10,
      border: `10px solid ${typeof item.payload.borderColor === 'string' ? item.payload.borderColor : '#FFFDF8'}`,
      borderRadius: typeof item.payload.radius === 'number' ? item.payload.radius : 8,
      boxShadow: 'inset 0 0 0 1px rgba(74,55,40,0.08), 0 8px 24px rgba(74,55,40,0.12)',
      pointerEvents: 'none',
    };
  }

  return {
    position: 'absolute',
    left: `${item.x}%`,
    top: `${item.y}%`,
    transform: `translate(-50%, -50%) rotate(${item.rotation}deg) scale(${item.scale})`,
    transformOrigin: 'center',
    fontWeight: 900,
    fontSize: item.type === 'emoji' || item.type === 'sticker' ? 44 : 20,
    color: payloadColor(item.payload, '#4A3728'),
    textShadow: '0 2px 0 rgba(255,255,255,0.9), 0 8px 18px rgba(74,55,40,0.18)',
    background: item.type === 'speech' ? '#FFFDF8' : item.type === 'text' ? 'rgba(255,253,248,0.82)' : 'transparent',
    border: item.type === 'speech' ? '2px solid #D4845A' : 'none',
    borderRadius: item.type === 'speech' ? 18 : 8,
    padding: item.type === 'speech' ? '8px 14px' : item.type === 'text' ? '4px 8px' : 0,
    outline: selected ? '3px solid rgba(95, 124, 173, 0.78)' : 'none',
    outlineOffset: selected ? 6 : 0,
    cursor: 'grab',
    pointerEvents: 'auto',
    touchAction: 'none',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  };
}

function clampPercent(value: number): number {
  return Math.max(5, Math.min(95, Math.round(value)));
}

function isLoadedImage(image: HTMLImageElement | null): image is HTMLImageElement {
  return Boolean(image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
}

function imageNaturalWidth(image: HTMLImageElement): number {
  return image.naturalWidth || image.width || 1;
}

function imageNaturalHeight(image: HTMLImageElement): number {
  return image.naturalHeight || image.height || 1;
}

function canvasToSizedJpegDataUrl(canvas: HTMLCanvasElement, maxEdge = 1280, quality = 0.82): string {
  const longestEdge = Math.max(canvas.width, canvas.height);
  if (longestEdge <= maxEdge) {
    return canvas.toDataURL('image/jpeg', quality);
  }

  const scale = maxEdge / longestEdge;
  const resizedCanvas = document.createElement('canvas');
  resizedCanvas.width = Math.max(1, Math.round(canvas.width * scale));
  resizedCanvas.height = Math.max(1, Math.round(canvas.height * scale));

  const resizedContext = resizedCanvas.getContext('2d');
  if (!resizedContext) {
    return canvas.toDataURL('image/jpeg', quality);
  }

  resizedContext.drawImage(canvas, 0, 0, resizedCanvas.width, resizedCanvas.height);
  return resizedCanvas.toDataURL('image/jpeg', quality);
}

type EditorHistorySnapshot = EditorEditSnapshot & { zoom: number };

export default function EditorPage() {
  const { photoId } = useParams<{ photoId: string }>();
  const navigate = useNavigate();
  const imageRef = useRef<HTMLImageElement | null>(null);
  const previewImageRef = useRef<HTMLImageElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const previousDecorationCountRef = useRef(0);

  const [photo, setPhoto] = useState<Photo | null>(null);
  const [filters, setFilters] = useState<Filter[]>(fallbackFilters);
  const [assets, setAssets] = useState<CreativeAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState('');
  const [zoom, setZoom] = useState(1);
  const [undoStack, setUndoStack] = useState<EditorHistorySnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<EditorHistorySnapshot[]>([]);
  const [selectedDecorationId, setSelectedDecorationId] = useState<string | null>(null);
  const [draggingDecorationId, setDraggingDecorationId] = useState<string | null>(null);

  const {
    selectedFilter,
    adjustments,
    rotation,
    flipX,
    cropRect,
    decorations,
    activeTab,
    setPhotoId,
    setOriginalUrl,
    setFilter,
    setAdjustment,
    setRotation,
    setFlipX,
    setCropRect,
    addDecoration,
    updateDecoration,
    removeDecoration,
    clearDecorations,
    restoreEdits,
    setActiveTab,
    getComputedFilterCss,
    reset,
  } = useEditorStore();

  const filterCss = getComputedFilterCss();
  const transformCss = useMemo(() => {
    const parts: string[] = [];
    if (zoom !== 1) parts.push(`scale(${zoom})`);
    if (rotation !== 0) parts.push(`rotate(${rotation}deg)`);
    if (flipX) parts.push('scaleX(-1)');
    return parts.join(' ');
  }, [zoom, rotation, flipX]);

  const takeEditSnapshot = (): EditorHistorySnapshot => {
    const state = useEditorStore.getState();
    return {
      selectedFilter: state.selectedFilter,
      filterCss: state.filterCss,
      adjustments: { ...state.adjustments },
      rotation: state.rotation,
      flipX: state.flipX,
      cropRect: { ...state.cropRect },
      decorations: state.decorations.map((item) => ({
        ...item,
        payload: { ...item.payload },
      })),
      zoom,
    };
  };

  const rememberEditState = () => {
    setUndoStack((previous) => [...previous.slice(-24), takeEditSnapshot()]);
    setRedoStack([]);
  };

  const restoreEditSnapshot = (snapshot: EditorHistorySnapshot) => {
    restoreEdits(snapshot);
    setZoom(snapshot.zoom);
    setSelectedDecorationId(null);
    setDraggingDecorationId(null);
  };

  const handleUndo = () => {
    const previous = undoStack[undoStack.length - 1];
    if (!previous) return;
    const current = takeEditSnapshot();
    setUndoStack((stack) => stack.slice(0, -1));
    setRedoStack((stack) => [current, ...stack].slice(0, 25));
    restoreEditSnapshot(previous);
  };

  const handleRedo = () => {
    const next = redoStack[0];
    if (!next) return;
    const current = takeEditSnapshot();
    setRedoStack((stack) => stack.slice(1));
    setUndoStack((stack) => [...stack.slice(-24), current]);
    restoreEditSnapshot(next);
  };

  const handleSelectFilter = (name: string, css: string) => {
    rememberEditState();
    setFilter(name, css);
  };

  const handleAdjustmentChange = (key: keyof typeof adjustments, value: number) => {
    rememberEditState();
    setAdjustment(key, value);
  };

  const handleZoomChange = (value: number) => {
    rememberEditState();
    setZoom(value);
  };

  const handleRotate = (value: number) => {
    rememberEditState();
    setRotation(value);
  };

  const handleFlip = () => {
    rememberEditState();
    setFlipX(!flipX);
  };

  const handleCropChange = (rect: Partial<typeof cropRect>) => {
    rememberEditState();
    setCropRect(rect);
  };

  const handleAddDecoration = (overlay: Omit<DecorationOverlay, 'id'>) => {
    rememberEditState();
    addDecoration(overlay);
  };

  const handleUpdateDecoration = (id: string, patch: Partial<DecorationOverlay>) => {
    rememberEditState();
    updateDecoration(id, patch);
  };

  const handleRemoveDecoration = (id: string) => {
    rememberEditState();
    removeDecoration(id);
  };

  const handleClearDecorations = () => {
    rememberEditState();
    clearDecorations();
  };

  useEffect(() => {
    if (!photoId) {
      navigate('/');
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      const savedTopic = sessionStorage.getItem('selected_topic') || '';
      setSelectedTopic(savedTopic);
      const devPhotoUrl = sessionStorage.getItem('dev_photo_url');

      try {
        if (devPhotoUrl && isAllowedImageUrl(devPhotoUrl)) {
          const devPhoto = {
            id: 'dev-photo',
            session_id: 'dev-session',
            user_id: '11111111-1111-1111-1111-111111111111',
            original_url: devPhotoUrl,
            edited_url: null,
            title: null,
            topic: savedTopic || null,
            thumbnail_url: null,
            content: null,
            music_url: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } satisfies Photo;
          setPhoto(devPhoto);
          setFilters(fallbackFilters);
        } else {
          const [photoRes, filterRes, assetRes] = await Promise.all([
            api.get<Photo>(`/api/v1/photos/${photoId}`),
            api.get<Filter[]>('/api/filters'),
            api.get<CreativeAsset[]>('/api/v1/creative-assets'),
          ]);
          const normalizedPhoto: Photo = {
            ...photoRes.data,
            original_url: resolveImageUrl(photoRes.data.original_url),
            edited_url: photoRes.data.edited_url ? resolveImageUrl(photoRes.data.edited_url) : null,
            thumbnail_url: photoRes.data.thumbnail_url ? resolveImageUrl(photoRes.data.thumbnail_url) : null,
          };
          setPhoto(normalizedPhoto);
          setFilters(filterRes.data.length > 0 ? filterRes.data : fallbackFilters);
          setAssets(assetRes.data);
        }
        setPhotoId(photoId);
      } catch {
        setError('사진을 불러오지 못했어요. 다시 시도해 주세요.');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
    return () => reset();
  }, [photoId, navigate, reset, setPhotoId]);

  const editSourceUrl = photo?.edited_url || photo?.original_url || '';

  const getReadyImage = useCallback(() => {
    if (isLoadedImage(imageRef.current)) return imageRef.current;
    if (isLoadedImage(previewImageRef.current)) {
      imageRef.current = previewImageRef.current;
      return previewImageRef.current;
    }
    return null;
  }, []);

  useEffect(() => {
    if (!editSourceUrl) return;
    setOriginalUrl(editSourceUrl);
    setUndoStack([]);
    setRedoStack([]);
    imageRef.current = null;
    let blobUrl: string | null = null;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      imageRef.current = img;
      setError((current) => (current?.startsWith('사진을 불러오지') ? null : current));
    };
    img.onerror = () => {
      if (cancelled) return;
      imageRef.current = null;
      const visibleImage = previewImageRef.current;
      const visibleReady = Boolean(visibleImage?.complete && visibleImage.naturalWidth > 0);
      if (visibleReady && visibleImage) {
        imageRef.current = visibleImage;
        setError((current) => (current?.startsWith('사진을 불러오지') ? null : current));
        return;
      }
    };

    const load = async () => {
      try {
        const apiBase = (import.meta.env.VITE_API_URL?.trim() ?? '').replace(/\/+$/, '');
        const src = editSourceUrl;
        const proxyPath = apiBase && src.startsWith(apiBase) ? src.slice(apiBase.length) : src;
        const resp = await fetch(proxyPath, { credentials: 'include' });
        if (!resp.ok) throw new Error('fetch failed');
        const blob = await resp.blob();
        blobUrl = URL.createObjectURL(blob);
        img.src = blobUrl;
      } catch {
        img.crossOrigin = 'anonymous';
        img.src = editSourceUrl;
      }
    };

    load();
    const readinessTimer = window.setInterval(() => {
      if (cancelled) return;
      const readyImage = getReadyImage();
      if (readyImage) {
        imageRef.current = readyImage;
        window.clearInterval(readinessTimer);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearInterval(readinessTimer);
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [editSourceUrl, getReadyImage, setOriginalUrl]);

  useEffect(() => {
    if (decorations.length > previousDecorationCountRef.current) {
      const latest = decorations[decorations.length - 1];
      if (latest && latest.type !== 'frame') {
        setSelectedDecorationId(latest.id);
      }
    }
    if (selectedDecorationId && !decorations.some((item) => item.id === selectedDecorationId)) {
      setSelectedDecorationId(null);
    }
    previousDecorationCountRef.current = decorations.length;
  }, [decorations, selectedDecorationId]);

  const moveDecorationToPointer = (id: string, clientX: number, clientY: number) => {
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    updateDecoration(id, {
      x: clampPercent(((clientX - rect.left) / rect.width) * 100),
      y: clampPercent(((clientY - rect.top) / rect.height) * 100),
    });
  };

  const handleDecorationPointerDown = (event: ReactPointerEvent<HTMLSpanElement>, item: DecorationOverlay) => {
    if (item.type === 'frame') return;
    event.preventDefault();
    event.stopPropagation();
    setActiveTab('decorate');
    setSelectedDecorationId(item.id);
    setDraggingDecorationId(item.id);
    rememberEditState();
    event.currentTarget.setPointerCapture(event.pointerId);
    moveDecorationToPointer(item.id, event.clientX, event.clientY);
  };

  const handleDecorationPointerMove = (event: ReactPointerEvent<HTMLSpanElement>, item: DecorationOverlay) => {
    if (draggingDecorationId !== item.id) return;
    event.preventDefault();
    moveDecorationToPointer(item.id, event.clientX, event.clientY);
  };

  const handleDecorationPointerUp = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (draggingDecorationId) {
      event.preventDefault();
      setDraggingDecorationId(null);
    }
  };

  const handleSave = async () => {
    const readyImage = getReadyImage();
    if (!photo || !readyImage) {
      setError('이미지 로딩이 끝난 뒤 다시 저장해 주세요.');
      return;
    }

    try {
      setError(null);
      setIsSaving(true);
      const img = readyImage;
      const sourceWidth = imageNaturalWidth(img);
      const sourceHeight = imageNaturalHeight(img);
      let cropL = Math.round((cropRect.left / 100) * sourceWidth);
      let cropT = Math.round((cropRect.top / 100) * sourceHeight);
      let cropW = Math.round(sourceWidth * (1 - (cropRect.left + cropRect.right) / 100));
      let cropH = Math.round(sourceHeight * (1 - (cropRect.top + cropRect.bottom) / 100));
      cropW = Math.max(1, cropW);
      cropH = Math.max(1, cropH);
      const safeZoom = Math.max(1, zoom);
      if (safeZoom > 1) {
        const zoomedW = Math.max(1, Math.round(cropW / safeZoom));
        const zoomedH = Math.max(1, Math.round(cropH / safeZoom));
        cropL += Math.round((cropW - zoomedW) / 2);
        cropT += Math.round((cropH - zoomedH) / 2);
        cropW = zoomedW;
        cropH = zoomedH;
      }
      cropL = Math.max(0, Math.min(cropL, sourceWidth - 1));
      cropT = Math.max(0, Math.min(cropT, sourceHeight - 1));
      cropW = Math.max(1, Math.min(cropW, sourceWidth - cropL));
      cropH = Math.max(1, Math.min(cropH, sourceHeight - cropT));
      const rad = (rotation * Math.PI) / 180;
      const rawW = Math.round(cropW * Math.abs(Math.cos(rad)) + cropH * Math.abs(Math.sin(rad)));
      const rawH = Math.round(cropW * Math.abs(Math.sin(rad)) + cropH * Math.abs(Math.cos(rad)));
      const scale = Math.min(1, 1920 / Math.max(rawW, rawH, 1));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(rawW * scale));
      canvas.height = Math.max(1, Math.round(rawH * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas unavailable');

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(rad);
      if (flipX) ctx.scale(-1, 1);
      ctx.scale(scale, scale);
      ctx.filter = filterCss || 'none';
      ctx.drawImage(img, cropL, cropT, cropW, cropH, -cropW / 2, -cropH / 2, cropW, cropH);
      ctx.restore();
      drawDecorations(ctx, decorations, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      const topicToSave = selectedTopic.trim() || photo.topic || null;
      const isDevMode = isAllowedImageUrl(sessionStorage.getItem('dev_photo_url'));
      let serverPhotoId: string | null = null;

      const [header, base64] = dataUrl.split(',');
      const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: mime });

      if (!isDevMode) {
        try {
          const formData = new FormData();
          formData.append('file', blob, 'edited.jpg');
          if (topicToSave) formData.append('topic', topicToSave);
          await api.post(`/api/v1/photos/${photo.id}/upload-edited`, formData);
        } catch {
          await api.put(`/api/v1/photos/${photo.id}`, { edited_url: dataUrl, topic: topicToSave });
        }
        navigate(`/gallery/${photo.id}`);
        return;
      }

      try {
        const formData = new FormData();
        formData.append('file', blob, 'photo.jpg');
        if (topicToSave) formData.append('topic', topicToSave);
        const uploadRes = await api.post('/api/v1/photos', formData);
        serverPhotoId = uploadRes.data?.id || null;
      } catch {
        serverPhotoId = null;
      }

      if (serverPhotoId) {
        navigate(`/gallery/${serverPhotoId}`);
        return;
      }

      const savedPhotos = safeJsonArray<{ id?: unknown; edited_url?: unknown; topic?: unknown; created_at?: unknown }>(
        localStorage.getItem('saved_photos')
      );
      const finalPhotoId = `local-${Date.now()}`;
      const localDataUrl = canvasToSizedJpegDataUrl(canvas);
      const currentPhoto = { id: finalPhotoId, edited_url: localDataUrl, topic: topicToSave, created_at: new Date().toISOString() };
      const normalized = savedPhotos
        .filter((item) => typeof item.id === 'string' && typeof item.edited_url === 'string' && typeof item.created_at === 'string')
        .map((item) => ({
          id: item.id as string,
          edited_url: item.edited_url as string,
          topic: typeof item.topic === 'string' ? item.topic : null,
          created_at: item.created_at as string,
        }));
      try {
        localStorage.setItem('saved_photos', JSON.stringify([currentPhoto, ...normalized].slice(0, 25)));
      } catch {
        // Some mobile in-app browsers have tiny storage quotas. Keep the saved
        // result visible through route state instead of failing the whole save.
      }
      navigate('/saved', { state: { photoId: finalPhotoId, editedUrl: localDataUrl, topic: topicToSave } });
    } catch {
      setError('저장 중 오류가 생겼어요. 다시 시도해 주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  const isSaveDisabled = isSaving || !photo || !editSourceUrl;
  const saveLabel = isSaving ? '저장 중...' : !editSourceUrl ? '사진 준비 중...' : activeTab === 'decorate' ? '꾸미기 저장하기' : '저장하기';
  const saveButtonStyle: CSSProperties = {
    minHeight: 46,
    padding: '0 18px',
    fontWeight: 900,
    cursor: isSaveDisabled ? 'wait' : 'pointer',
    opacity: isSaveDisabled ? 0.65 : 1,
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <LoadingSpinner />
      </div>
    );
  }

  if (error && !photo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <div className="story-surface-card" style={{ padding: 24, textAlign: 'center' }}>
          <p style={{ marginBottom: 12, fontWeight: 800 }}>{error}</p>
          <button onClick={() => navigate('/')} className="story-cta-primary" style={{ minHeight: 44, padding: '0 18px', fontWeight: 800 }}>
            홈으로
          </button>
        </div>
      </div>
    );
  }

  if (!photo) return null;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--color-bg-primary)' }}>
      <header className="story-page-header">
        <div className="story-page-header__left">
          <button onClick={() => navigate(-1)} aria-label="뒤로 가기" className="story-page-back">
            <span style={{ fontSize: 24 }}>‹</span>
          </button>
        </div>
        <h1 className="story-page-title">사진 편집</h1>
        <div className="story-page-header__right" style={{ width: 'auto', flexBasis: 'auto' }}>
          <button
            onClick={handleSave}
            disabled={isSaveDisabled}
            className="story-cta-primary"
            style={saveButtonStyle}
          >
            {saveLabel}
          </button>
        </div>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
          padding: '8px 12px',
          background: 'rgba(255,253,248,0.78)',
          borderBottom: '1px solid rgba(219, 203, 184, 0.62)',
        }}
      >
        <button
          type="button"
          onClick={handleUndo}
          disabled={undoStack.length === 0}
          className="story-cta-secondary"
          style={{ minHeight: 40, fontWeight: 900, cursor: undoStack.length === 0 ? 'default' : 'pointer', opacity: undoStack.length === 0 ? 0.5 : 1 }}
        >
          ↶ 되돌리기
        </button>
        <button
          type="button"
          onClick={handleRedo}
          disabled={redoStack.length === 0}
          className="story-cta-secondary"
          style={{ minHeight: 40, fontWeight: 900, cursor: redoStack.length === 0 ? 'default' : 'pointer', opacity: redoStack.length === 0 ? 0.5 : 1 }}
        >
          ↷ 다시 실행
        </button>
      </div>

      <section style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflow: 'hidden' }}>
        <div
          ref={previewRef}
          style={{
            position: 'relative',
            maxWidth: 'min(94vw, 760px)',
            maxHeight: '52dvh',
            background: 'var(--color-surface)',
            border: '2px solid var(--color-border)',
            borderRadius: 8,
            overflow: 'hidden',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <img
            src={editSourceUrl}
            alt="편집 중인 사진"
            draggable={false}
            ref={previewImageRef}
            onLoad={(event) => {
              if (!imageRef.current) imageRef.current = event.currentTarget;
              setError((current) => (current?.startsWith('사진을 불러오지') ? null : current));
            }}
            onError={() => {
              if (!imageRef.current) {
                setError('사진을 불러오지 못했어요. 화면을 새로고침한 뒤 다시 시도해 주세요.');
              }
            }}
            style={{
              display: 'block',
              maxWidth: '100%',
              maxHeight: '52dvh',
              objectFit: 'contain',
              filter: filterCss || undefined,
              transform: transformCss || undefined,
              transition: 'filter 0.15s, transform 0.25s ease',
              clipPath: cropRect.top || cropRect.left || cropRect.right || cropRect.bottom
                ? `inset(${cropRect.top}% ${cropRect.right}% ${cropRect.bottom}% ${cropRect.left}%)`
                : undefined,
            }}
          />
          {decorations.map((item) => (
            <span
              key={item.id}
              style={overlayStyle(item, selectedDecorationId === item.id)}
              onPointerDown={(event) => handleDecorationPointerDown(event, item)}
              onPointerMove={(event) => handleDecorationPointerMove(event, item)}
              onPointerUp={handleDecorationPointerUp}
              onPointerCancel={handleDecorationPointerUp}
              title={item.type === 'frame' ? undefined : '끌어서 위치를 바꿀 수 있어요'}
            >
              {item.type === 'speech' || item.type === 'text' ? item.text || item.label : payloadText({ payload: item.payload, label: item.label } as CreativeAsset)}
            </span>
          ))}
        </div>
      </section>

      <section style={{ background: 'var(--color-surface)', borderTop: '1.5px solid var(--color-border)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '1.5px solid var(--color-border)' }}>
          {(Object.keys(tabLabels) as Array<keyof typeof tabLabels>).map((tab) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                aria-selected={active}
                style={{
                  minHeight: 48,
                  background: active ? 'var(--color-primary-light)' : 'transparent',
                  border: 0,
                  borderBottom: active ? '3px solid var(--color-primary)' : '3px solid transparent',
                  color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  fontWeight: active ? 900 : 700,
                  cursor: 'pointer',
                }}
              >
                {tabLabels[tab]}
              </button>
            );
          })}
        </div>

        <div style={{ padding: 16, minHeight: 220, maxHeight: 260, overflowY: 'auto' }}>
          {error && (
            <div
              role="alert"
              style={{
                marginBottom: 12,
                padding: '12px 14px',
                borderRadius: 14,
                border: '1px solid rgba(211, 88, 71, 0.28)',
                background: 'rgba(255, 238, 233, 0.86)',
                color: '#9A3D2F',
                fontWeight: 800,
              }}
            >
              {error}
            </div>
          )}
          {activeTab === 'filter' && (
            <FilterPanel filters={filters} selectedFilter={selectedFilter} onSelectFilter={handleSelectFilter} photoUrl={editSourceUrl} />
          )}
          {activeTab === 'adjustment' && <AdjustmentPanel adjustments={adjustments} onAdjustmentChange={handleAdjustmentChange} />}
          {activeTab === 'crop' && (
            <CropPanel
              rotation={rotation}
              zoom={zoom}
              flipX={flipX}
              cropRect={cropRect}
              onZoom={handleZoomChange}
              onRotate={handleRotate}
              onFlip={handleFlip}
              onCropChange={handleCropChange}
            />
          )}
          {activeTab === 'decorate' && (
            <DecorationPanel2
              assets={assets}
              decorations={decorations}
              selectedDecorationId={selectedDecorationId}
              onAdd={handleAddDecoration}
              onUpdate={handleUpdateDecoration}
              onRemove={handleRemoveDecoration}
              onClear={handleClearDecorations}
              onSelect={setSelectedDecorationId}
            />
          )}
        </div>
        <div
          style={{
            position: 'sticky',
            bottom: 0,
            zIndex: 8,
            padding: '10px 16px calc(12px + env(safe-area-inset-bottom))',
            background: 'linear-gradient(180deg, rgba(255,253,248,0.72), var(--color-surface) 42%)',
            boxShadow: '0 -14px 24px rgba(65, 72, 93, 0.08)',
          }}
        >
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaveDisabled}
            className="story-cta-primary"
            style={{ ...saveButtonStyle, width: '100%', minHeight: 54, fontSize: '1rem' }}
          >
            {saveLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

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
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(78px, 1fr))', gap: 10 }}>
      {filters.map((filter) => {
        const selected = selectedFilter === filter.name;
        return (
          <button
            key={filter.id}
            onClick={() => onSelectFilter(filter.name, filter.css_filter)}
            style={{
              aspectRatio: '1 / 1',
              borderRadius: 8,
              overflow: 'hidden',
              border: selected ? '2.5px solid var(--color-primary)' : '1.5px solid var(--color-border)',
              background: 'var(--color-bg-soft)',
              padding: 0,
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: filter.css_filter }} />
            <span style={{ position: 'absolute', insetInline: 0, bottom: 0, padding: '4px 0', color: '#FFF8F0', background: 'rgba(74,55,40,0.68)', fontSize: 12, fontWeight: 800 }}>
              {filter.label}
            </span>
          </button>
        );
      })}
    </div>
  );
});

const AdjustmentPanel = memo(function AdjustmentPanel({
  adjustments,
  onAdjustmentChange,
}: {
  adjustments: { brightness: number; contrast: number; saturation: number; temperature: number; sharpness: number };
  onAdjustmentChange: (key: keyof typeof adjustments, value: number) => void;
}) {
  const controls = [
    { key: 'brightness' as const, label: '밝기' },
    { key: 'saturation' as const, label: '색감' },
    { key: 'contrast' as const, label: '대비' },
    { key: 'temperature' as const, label: '온도' },
    { key: 'sharpness' as const, label: '선명도' },
  ];
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {controls.map(({ key, label }) => (
        <label key={key} style={{ display: 'grid', gap: 5, fontWeight: 800 }}>
          <span style={{ display: 'flex', justifyContent: 'space-between' }}>
            {label}
            <span style={{ color: 'var(--color-primary)' }}>{adjustments[key]}</span>
          </span>
          <input type="range" min="-50" max="50" value={adjustments[key]} onChange={(event) => onAdjustmentChange(key, Number(event.target.value))} style={{ accentColor: '#D4845A' }} />
        </label>
      ))}
    </div>
  );
});

const CropPanel = memo(function CropPanel({
  rotation,
  zoom,
  flipX,
  cropRect,
  onZoom,
  onRotate,
  onFlip,
  onCropChange,
}: {
  rotation: number;
  zoom: number;
  flipX: boolean;
  cropRect: { top: number; left: number; right: number; bottom: number };
  onZoom: (value: number) => void;
  onRotate: (value: number) => void;
  onFlip: () => void;
  onCropChange: (rect: Partial<{ top: number; left: number; right: number; bottom: number }>) => void;
}) {
  const sliders = [
    { key: 'top' as const, label: '위' },
    { key: 'bottom' as const, label: '아래' },
    { key: 'left' as const, label: '왼쪽' },
    { key: 'right' as const, label: '오른쪽' },
  ];
  const zoomPercent = Math.round(zoom * 100);
  const rotationDegrees = Math.round(rotation);
  const nextQuarterRotation = rotationDegrees >= 180 ? -90 : rotationDegrees + 90;

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
        <button className="story-cta-secondary" onClick={() => onRotate(nextQuarterRotation)} style={{ minHeight: 42, fontWeight: 800, cursor: 'pointer' }}>90도 회전</button>
        <button className="story-cta-secondary" onClick={onFlip} style={{ minHeight: 42, fontWeight: 800, cursor: 'pointer', borderColor: flipX ? 'var(--color-primary)' : undefined }}>좌우 반전</button>
        <button className="story-cta-secondary" onClick={() => { onRotate(0); onZoom(1); onCropChange({ top: 0, right: 0, bottom: 0, left: 0 }); }} style={{ minHeight: 42, fontWeight: 800, cursor: 'pointer' }}>초기화</button>
      </div>
      <div style={{ display: 'grid', gap: 5, fontWeight: 800 }}>
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span>확대</span>
          <span style={{ color: 'var(--color-primary)', fontWeight: 900, minWidth: 56, textAlign: 'right' }}>{zoomPercent}%</span>
        </span>
        <input aria-label={`확대 ${zoomPercent}%`} type="range" min="1" max="3" step="0.1" value={zoom} onChange={(event) => onZoom(Number(event.target.value))} style={{ accentColor: '#D4845A' }} />
        <button
          type="button"
          className="story-cta-secondary"
          onClick={() => onZoom(1)}
          disabled={zoomPercent === 100}
          style={{ minHeight: 40, fontWeight: 900, cursor: zoomPercent === 100 ? 'default' : 'pointer', opacity: zoomPercent === 100 ? 0.62 : 1 }}
        >
          기본 100%로
        </button>
      </div>
      <label style={{ display: 'grid', gap: 5, fontWeight: 800 }}>
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span>각도</span>
          <span style={{ color: 'var(--color-primary)', fontWeight: 900, minWidth: 56, textAlign: 'right' }}>{rotationDegrees}도</span>
        </span>
        <input aria-label={`각도 ${rotationDegrees}도`} type="range" min="-180" max="180" value={rotation} onChange={(event) => onRotate(Number(event.target.value))} style={{ accentColor: '#D4845A' }} />
      </label>
      {sliders.map(({ key, label }) => (
        <label key={key} style={{ display: 'grid', gap: 5, fontWeight: 800 }}>
          <span style={{ display: 'flex', justifyContent: 'space-between' }}>{label}<span>{cropRect[key]}%</span></span>
          <input type="range" min="0" max="45" value={cropRect[key]} onChange={(event) => onCropChange({ [key]: Number(event.target.value) })} style={{ accentColor: '#D4845A' }} />
        </label>
      ))}
    </div>
  );
});

const DecorationPanel = memo(function DecorationPanel({
  assets,
  decorations,
  onAdd,
  onUpdate,
  onRemove,
  onClear,
}: {
  assets: CreativeAsset[];
  decorations: DecorationOverlay[];
  onAdd: (overlay: Omit<DecorationOverlay, 'id'>) => void;
  onUpdate: (id: string, patch: Partial<DecorationOverlay>) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const usableAssets = assets.length > 0 ? assets : [
    { id: 'frame-polaroid', asset_type: 'frame', name: 'polaroid', label: '폴라로이드', asset_url: null, preview_url: null, payload: { borderColor: '#FFFDF8' }, is_public: true, is_active: true, sort_order: 0, created_at: '', updated_at: '', category_id: null },
    { id: 'sticker-heart', asset_type: 'sticker', name: 'heart', label: '하트', asset_url: null, preview_url: null, payload: { text: '♥', color: '#F472B6' }, is_public: true, is_active: true, sort_order: 0, created_at: '', updated_at: '', category_id: null },
    { id: 'emoji-smile', asset_type: 'emoji', name: 'smile', label: '웃음', asset_url: null, preview_url: null, payload: { text: '☺' }, is_public: true, is_active: true, sort_order: 0, created_at: '', updated_at: '', category_id: null },
  ] satisfies CreativeAsset[];

  const addAsset = (asset: CreativeAsset) => {
    onAdd({
      assetId: asset.id,
      type: asset.asset_type === 'frame' || asset.asset_type === 'emoji' || asset.asset_type === 'speech' || asset.asset_type === 'text' ? asset.asset_type : 'sticker',
      label: asset.label,
      payload: asset.payload,
      x: asset.asset_type === 'frame' ? 50 : 72,
      y: asset.asset_type === 'frame' ? 50 : 28,
      scale: 1,
      rotation: 0,
      text: asset.asset_type === 'speech' ? '좋아요!' : asset.asset_type === 'text' ? '나의 이야기' : undefined,
    });
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))', gap: 8 }}>
        {usableAssets.map((asset) => (
          <button key={asset.id} className="story-cta-secondary" onClick={() => addAsset(asset)} style={{ minHeight: 64, padding: 8, fontWeight: 800, cursor: 'pointer' }}>
            <span style={{ display: 'block', fontSize: 24 }}>{asset.asset_type === 'frame' ? '□' : payloadText(asset)}</span>
            {asset.label}
          </button>
        ))}
        <button className="story-cta-secondary" onClick={() => addAsset({ id: 'speech-local', asset_type: 'speech', name: 'speech', label: '말풍선', asset_url: null, preview_url: null, payload: {}, is_public: true, is_active: true, sort_order: 0, created_at: '', updated_at: '', category_id: null })} style={{ minHeight: 64, padding: 8, fontWeight: 800, cursor: 'pointer' }}>
          말풍선
        </button>
        <button className="story-cta-secondary" onClick={() => addAsset({ id: 'text-local', asset_type: 'text', name: 'text', label: '짧은 글', asset_url: null, preview_url: null, payload: { color: '#4A3728' }, is_public: true, is_active: true, sort_order: 0, created_at: '', updated_at: '', category_id: null })} style={{ minHeight: 64, padding: 8, fontWeight: 800, cursor: 'pointer' }}>
          짧은 글
        </button>
      </div>

      {decorations.length > 0 && (
        <div style={{ display: 'grid', gap: 8 }}>
          <button className="story-cta-secondary" onClick={onClear} style={{ minHeight: 38, fontWeight: 800, cursor: 'pointer' }}>꾸미기 모두 지우기</button>
          {decorations.map((item) => (
            <div key={item.id} className="story-surface-card" style={{ padding: 10, display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
              <div style={{ display: 'grid', gap: 6 }}>
                <strong>{item.label}</strong>
                {(item.type === 'speech' || item.type === 'text') && (
                  <input className="story-field" value={item.text ?? ''} onChange={(event) => onUpdate(item.id, { text: event.target.value })} style={{ minHeight: 38 }} />
                )}
                {item.type !== 'frame' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <input aria-label="가로 위치" type="range" min="10" max="90" value={item.x} onChange={(event) => onUpdate(item.id, { x: Number(event.target.value) })} />
                    <input aria-label="세로 위치" type="range" min="10" max="90" value={item.y} onChange={(event) => onUpdate(item.id, { y: Number(event.target.value) })} />
                  </div>
                )}
              </div>
              <button className="story-cta-secondary" onClick={() => onRemove(item.id)} style={{ minHeight: 38, padding: '0 10px', fontWeight: 800, cursor: 'pointer' }}>삭제</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
void DecorationPanel;

const fallbackDecorationAssets = [
  { id: 'frame-polaroid', asset_type: 'frame', name: 'polaroid', label: '폴라로이드', asset_url: null, preview_url: null, payload: { borderColor: '#FFFDF8' }, is_public: true, is_active: true, sort_order: 0, created_at: '', updated_at: '', category_id: null },
  { id: 'sticker-heart', asset_type: 'sticker', name: 'heart', label: '하트', asset_url: null, preview_url: null, payload: { text: '♥', color: '#F472B6' }, is_public: true, is_active: true, sort_order: 0, created_at: '', updated_at: '', category_id: null },
  { id: 'emoji-smile', asset_type: 'emoji', name: 'smile', label: '웃음', asset_url: null, preview_url: null, payload: { text: '☺' }, is_public: true, is_active: true, sort_order: 0, created_at: '', updated_at: '', category_id: null },
] satisfies CreativeAsset[];

const DecorationPanel2 = memo(function DecorationPanel2({
  assets,
  decorations,
  selectedDecorationId,
  onAdd,
  onUpdate,
  onRemove,
  onClear,
  onSelect,
}: {
  assets: CreativeAsset[];
  decorations: DecorationOverlay[];
  selectedDecorationId: string | null;
  onAdd: (overlay: Omit<DecorationOverlay, 'id'>) => void;
  onUpdate: (id: string, patch: Partial<DecorationOverlay>) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onSelect: (id: string | null) => void;
}) {
  const usableAssets = assets.length > 0 ? assets : fallbackDecorationAssets;
  const selectedDecoration = decorations.find((item) => item.id === selectedDecorationId) ?? null;

  const addAsset = (asset: CreativeAsset) => {
    onAdd({
      assetId: asset.id,
      type: asset.asset_type === 'frame' || asset.asset_type === 'emoji' || asset.asset_type === 'speech' || asset.asset_type === 'text' ? asset.asset_type : 'sticker',
      label: asset.label,
      payload: asset.payload,
      x: asset.asset_type === 'frame' ? 50 : 72,
      y: asset.asset_type === 'frame' ? 50 : 28,
      scale: 1,
      rotation: 0,
      text: asset.asset_type === 'speech' ? '좋아요!' : asset.asset_type === 'text' ? '나의 이야기' : undefined,
    });
  };

  const removeSelected = () => {
    if (!selectedDecoration) return;
    onRemove(selectedDecoration.id);
    onSelect(null);
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {selectedDecoration && selectedDecoration.type !== 'frame' && (
        <div
          className="story-surface-card"
          style={{
            padding: 12,
            display: 'grid',
            gap: 10,
            background: 'linear-gradient(135deg, rgba(255,248,236,0.95), rgba(238,244,255,0.95))',
            borderColor: 'rgba(95, 124, 173, 0.42)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <strong style={{ color: 'var(--color-primary)' }}>{selectedDecoration.label} 바로 조절</strong>
            <span style={{ fontSize: '0.85rem', fontWeight: 900, color: 'var(--color-text-secondary)' }}>
              {Math.round(selectedDecoration.scale * 100)}%
            </span>
          </div>
          <label style={{ display: 'grid', gap: 5, fontWeight: 800 }}>
            크기
            <input
              aria-label={`${selectedDecoration.label} 크기`}
              type="range"
              min="0.5"
              max="2.4"
              step="0.1"
              value={selectedDecoration.scale}
              onChange={(event) => onUpdate(selectedDecoration.id, { scale: Number(event.target.value) })}
              style={{ accentColor: '#D4845A' }}
            />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button
              type="button"
              className="story-cta-secondary"
              onClick={() => onUpdate(selectedDecoration.id, { x: 50, y: 50 })}
              style={{ minHeight: 38, fontWeight: 900, cursor: 'pointer' }}
            >
              가운데로
            </button>
            <button
              type="button"
              className="story-cta-secondary"
              onClick={() => onUpdate(selectedDecoration.id, { x: 50, y: 50, scale: 1, rotation: 0 })}
              style={{ minHeight: 38, fontWeight: 900, cursor: 'pointer' }}
            >
              기본값
            </button>
          </div>
        </div>
      )}

      <div className="story-surface-card" style={{ padding: 12, background: 'rgba(238,244,255,0.72)' }}>
        <strong style={{ display: 'block', marginBottom: 4, color: 'var(--color-text-primary)' }}>
          쉽게 바꾸는 방법
        </strong>
        <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.88rem', fontWeight: 650 }}>
          사진 위의 이모티콘이나 글자를 누른 뒤 손가락으로 끌어서 위치를 바꿔요.
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))', gap: 8 }}>
        {usableAssets.map((asset) => (
          <button
            key={asset.id}
            className="story-cta-secondary"
            onClick={() => addAsset(asset)}
            style={{ minHeight: 64, padding: 8, fontWeight: 800, cursor: 'pointer' }}
            type="button"
          >
            <span style={{ display: 'block', fontSize: 24 }}>{asset.asset_type === 'frame' ? '□' : payloadText(asset)}</span>
            {asset.label}
          </button>
        ))}
        <button
          className="story-cta-secondary"
          onClick={() => addAsset({ id: 'speech-local', asset_type: 'speech', name: 'speech', label: '말풍선', asset_url: null, preview_url: null, payload: {}, is_public: true, is_active: true, sort_order: 0, created_at: '', updated_at: '', category_id: null })}
          style={{ minHeight: 64, padding: 8, fontWeight: 800, cursor: 'pointer' }}
          type="button"
        >
          말풍선
        </button>
        <button
          className="story-cta-secondary"
          onClick={() => addAsset({ id: 'text-local', asset_type: 'text', name: 'text', label: '짧은 글', asset_url: null, preview_url: null, payload: { color: '#4A3728' }, is_public: true, is_active: true, sort_order: 0, created_at: '', updated_at: '', category_id: null })}
          style={{ minHeight: 64, padding: 8, fontWeight: 800, cursor: 'pointer' }}
          type="button"
        >
          짧은 글
        </button>
      </div>

      {selectedDecoration && selectedDecoration.type !== 'frame' && (
        <div className="story-surface-card" style={{ padding: 12, display: 'grid', gap: 10, borderColor: 'rgba(95, 124, 173, 0.42)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <strong style={{ color: 'var(--color-primary)' }}>{selectedDecoration.label} 변경</strong>
            <button type="button" className="story-cta-secondary" onClick={removeSelected} style={{ minHeight: 34, padding: '0 10px', fontWeight: 900, cursor: 'pointer' }}>
              삭제
            </button>
          </div>
          {(selectedDecoration.type === 'speech' || selectedDecoration.type === 'text') && (
            <label style={{ display: 'grid', gap: 5, fontWeight: 800 }}>
              문구
              <input
                className="story-field"
                value={selectedDecoration.text ?? ''}
                onChange={(event) => onUpdate(selectedDecoration.id, { text: event.target.value })}
                placeholder="넣고 싶은 문구를 적어 주세요"
                style={{ minHeight: 42 }}
              />
            </label>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label style={{ display: 'grid', gap: 5, fontWeight: 800 }}>
              가로
              <input type="range" min="5" max="95" value={selectedDecoration.x} onChange={(event) => onUpdate(selectedDecoration.id, { x: Number(event.target.value) })} />
            </label>
            <label style={{ display: 'grid', gap: 5, fontWeight: 800 }}>
              세로
              <input type="range" min="5" max="95" value={selectedDecoration.y} onChange={(event) => onUpdate(selectedDecoration.id, { y: Number(event.target.value) })} />
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label style={{ display: 'grid', gap: 5, fontWeight: 800 }}>
              크기
              <input type="range" min="0.5" max="2.4" step="0.1" value={selectedDecoration.scale} onChange={(event) => onUpdate(selectedDecoration.id, { scale: Number(event.target.value) })} />
            </label>
            <label style={{ display: 'grid', gap: 5, fontWeight: 800 }}>
              기울기
              <input type="range" min="-45" max="45" value={selectedDecoration.rotation} onChange={(event) => onUpdate(selectedDecoration.id, { rotation: Number(event.target.value) })} />
            </label>
          </div>
          <button
            type="button"
            className="story-cta-secondary"
            onClick={() => onUpdate(selectedDecoration.id, { x: 50, y: 50, scale: 1, rotation: 0 })}
            style={{ minHeight: 38, fontWeight: 900, cursor: 'pointer' }}
          >
            가운데로 다시 놓기
          </button>
        </div>
      )}

      {decorations.length > 0 && (
        <div style={{ display: 'grid', gap: 8 }}>
          <button className="story-cta-secondary" onClick={() => { onClear(); onSelect(null); }} style={{ minHeight: 38, fontWeight: 800, cursor: 'pointer' }} type="button">
            꾸미기 모두 지우기
          </button>
          {decorations.map((item) => (
            <div
              key={item.id}
              className="story-surface-card"
              style={{
                padding: 10,
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 8,
                alignItems: 'center',
                borderColor: selectedDecorationId === item.id ? 'rgba(95, 124, 173, 0.55)' : undefined,
                background: selectedDecorationId === item.id ? 'rgba(238,244,255,0.74)' : undefined,
              }}
            >
              <div style={{ display: 'grid', gap: 4 }}>
                <strong>{item.label}</strong>
                <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.82rem', fontWeight: 650 }}>
                  {item.type === 'frame' ? '프레임' : '변경을 눌러 위치와 크기를 바꿀 수 있어요.'}
                </span>
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                {item.type !== 'frame' && (
                  <button className="story-cta-secondary" onClick={() => onSelect(item.id)} style={{ minHeight: 34, padding: '0 10px', fontWeight: 900, cursor: 'pointer' }} type="button">
                    변경
                  </button>
                )}
                <button
                  className="story-cta-secondary"
                  onClick={() => {
                    onRemove(item.id);
                    if (selectedDecorationId === item.id) onSelect(null);
                  }}
                  style={{ minHeight: 34, padding: '0 10px', fontWeight: 800, cursor: 'pointer' }}
                  type="button"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
