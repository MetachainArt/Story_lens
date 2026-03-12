/**
 * @TASK P3-S4-T1 - Editor Page Implementation
 * @SPEC specs/screens/editor.yaml
 */
import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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

  // Load photo and filters
  useEffect(() => {
    if (!photoId) {
      navigate('/home');
      return;
    }

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

      // Apply filter
      ctx.filter = getComputedFilterCss();

      // Draw image
      ctx.drawImage(img, 0, 0);
    };
    img.src = photo.original_url;
  }, [photo, selectedFilter, adjustments, getComputedFilterCss]);

  // Handle save
  const handleSave = async () => {
    if (!photo || !canvasRef.current) return;

    try {
      setIsSaving(true);

      // Get data URL from canvas
      const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.9);

      // Save edit history
      await api.post(`/api/photos/${photo.id}/edits`, {
        filter_name: selectedFilter,
        adjustments: {
          brightness: adjustments.brightness,
          contrast: adjustments.contrast,
          saturation: adjustments.saturation,
          temperature: adjustments.temperature,
          sharpness: adjustments.sharpness,
        },
        crop_data: {
          rotation,
          flipX,
        },
      });

      // Update photo with edited URL
      await api.put(`/api/v1/photos/${photo.id}`, {
        edited_url: dataUrl,
      });

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
    <div className="min-h-screen bg-bg-primary flex flex-col">
      {/* Header */}
      <header className="bg-surface shadow-sm px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          aria-label="뒤로 가기"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        <h1 className="text-lg font-semibold text-text-primary">편집</h1>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
        >
          {isSaving ? '저장 중...' : '저장'}
        </button>
      </header>

      {/* Canvas Container */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <div className="relative max-w-full max-h-full">
          <canvas
            ref={canvasRef}
            className="max-w-full max-h-[60vh] object-contain"
            style={{
              transform: getComputedTransform(),
              transition: 'transform 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-surface border-t border-gray-200">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('filter')}
            aria-selected={activeTab === 'filter'}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'filter'
                ? 'text-primary border-b-2 border-primary'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            필터
          </button>
          <button
            onClick={() => setActiveTab('adjustment')}
            aria-selected={activeTab === 'adjustment'}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'adjustment'
                ? 'text-primary border-b-2 border-primary'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            조절
          </button>
          <button
            onClick={() => setActiveTab('crop')}
            aria-selected={activeTab === 'crop'}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'crop'
                ? 'text-primary border-b-2 border-primary'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            자르기
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4 h-48 overflow-y-auto">
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
              onRotate={() => setRotation(rotation + 90)}
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
    <div className="grid grid-cols-5 gap-3">
      {filters.map((filter) => (
        <motion.button
          key={filter.id}
          onClick={() => onSelectFilter(filter.name, filter.css_filter)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-colors ${
            selectedFilter === filter.name
              ? 'border-primary'
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <div
            className="w-full h-full bg-gray-200 flex items-center justify-center"
            style={{ filter: filter.css_filter }}
          >
            <img
              src={photoUrl}
              alt={filter.label}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs py-1 text-center">
            {filter.label}
          </div>
        </motion.button>
      ))}
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
    { key: 'sharpness' as const, label: '선명도' },
  ];

  return (
    <div className="space-y-4">
      {adjustmentControls.map(({ key, label }) => (
        <div key={key} className="space-y-2">
          <label htmlFor={`adj-${key}`} className="flex justify-between text-sm">
            <span>{label}</span>
            <span className="text-gray-500">{adjustments[key]}</span>
          </label>
          <input
            id={`adj-${key}`}
            type="range"
            min="-50"
            max="50"
            value={adjustments[key]}
            onChange={(e) => onAdjustmentChange(key, Number(e.target.value))}
            aria-label={label}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
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
  onRotate,
  onFlip,
}: {
  rotation: number;
  flipX: boolean;
  onRotate: () => void;
  onFlip: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <button
          onClick={onRotate}
          className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <span>회전 (90°)</span>
        </button>

        <button
          onClick={onFlip}
          className={`flex-1 py-3 rounded-lg transition-colors flex items-center justify-center gap-2 ${
            flipX
              ? 'bg-primary text-white'
              : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
            />
          </svg>
          <span>좌우 뒤집기</span>
        </button>
      </div>

      <div className="text-sm text-gray-500 text-center">
        현재 회전: {rotation}°
      </div>
    </div>
  );
}
