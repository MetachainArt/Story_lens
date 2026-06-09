/**
 * @TASK P3-S4-T1 - Editor Store
 * @SPEC Zustand store for editor state management
 */
import { create } from 'zustand';

export interface DecorationOverlay {
  id: string;
  assetId?: string;
  type: 'frame' | 'sticker' | 'emoji' | 'speech' | 'text';
  label: string;
  payload: Record<string, unknown>;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  text?: string;
}

interface EditorStore {
  // Photo data
  photoId: string | null;
  originalUrl: string | null;

  // Filter state
  selectedFilter: string | null;
  filterCss: string;

  // Adjustment state
  adjustments: {
    brightness: number; // -50 ~ +50
    contrast: number;
    saturation: number;
    temperature: number;
    sharpness: number;
  };

  // Crop state
  rotation: number; // 0, 90, 180, 270
  flipX: boolean;
  cropRect: { top: number; left: number; right: number; bottom: number };
  decorations: DecorationOverlay[];

  // UI state
  activeTab: 'filter' | 'adjustment' | 'crop' | 'decorate';

  // Actions
  setPhotoId: (id: string) => void;
  setOriginalUrl: (url: string) => void;
  setFilter: (name: string, css: string) => void;
  setAdjustment: (key: keyof EditorStore['adjustments'], value: number) => void;
  setRotation: (deg: number) => void;
  setFlipX: (flip: boolean) => void;
  setCropRect: (rect: Partial<{ top: number; left: number; right: number; bottom: number }>) => void;
  addDecoration: (overlay: Omit<DecorationOverlay, 'id'>) => void;
  updateDecoration: (id: string, patch: Partial<DecorationOverlay>) => void;
  removeDecoration: (id: string) => void;
  clearDecorations: () => void;
  setActiveTab: (tab: EditorStore['activeTab']) => void;
  reset: () => void;
  getComputedFilterCss: () => string;
  getComputedTransform: () => string;
}

const initialState = {
  photoId: null,
  originalUrl: null,
  selectedFilter: null,
  filterCss: '',
  adjustments: {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    temperature: 0,
    sharpness: 0,
  },
  rotation: 0,
  flipX: false,
  cropRect: { top: 0, left: 0, right: 0, bottom: 0 },
  decorations: [],
  activeTab: 'filter' as const,
};

export const useEditorStore = create<EditorStore>((set, get) => ({
  ...initialState,

  setPhotoId: (id: string) => set({ photoId: id }),

  setOriginalUrl: (url: string) => set({ originalUrl: url }),

  setFilter: (name: string, css: string) =>
    set({ selectedFilter: name, filterCss: css }),

  setAdjustment: (key, value) =>
    set((state) => ({
      adjustments: {
        ...state.adjustments,
        [key]: value,
      },
    })),

  setRotation: (deg: number) => set({ rotation: deg }),

  setFlipX: (flip: boolean) => set({ flipX: flip }),

  setCropRect: (rect) =>
    set((state) => ({
      cropRect: { ...state.cropRect, ...rect },
    })),

  addDecoration: (overlay) =>
    set((state) => ({
      decorations: [
        ...state.decorations,
        {
          ...overlay,
          id: `decoration-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        },
      ],
    })),

  updateDecoration: (id, patch) =>
    set((state) => ({
      decorations: state.decorations.map((item) =>
        item.id === id ? { ...item, ...patch } : item
      ),
    })),

  removeDecoration: (id) =>
    set((state) => ({
      decorations: state.decorations.filter((item) => item.id !== id),
    })),

  clearDecorations: () => set({ decorations: [] }),

  setActiveTab: (tab) => set({ activeTab: tab }),

  reset: () => set(initialState),

  // Compute CSS filter string from adjustments
  getComputedFilterCss: () => {
    const { filterCss, adjustments } = get();
    const parts: string[] = [];

    if (filterCss) {
      parts.push(filterCss);
    }

    if (adjustments.brightness !== 0) {
      parts.push(`brightness(${1 + adjustments.brightness / 100})`);
    }

    if (adjustments.contrast !== 0) {
      parts.push(`contrast(${1 + adjustments.contrast / 100})`);
    }

    if (adjustments.saturation !== 0) {
      parts.push(`saturate(${1 + adjustments.saturation / 100})`);
    }

    if (adjustments.temperature !== 0) {
      const temp = adjustments.temperature;
      if (temp > 0) {
        parts.push(`sepia(${temp / 100})`);
      } else {
        parts.push(`hue-rotate(${temp}deg)`);
      }
    }

    // 선명도 음수 → 블러 효과 (양수는 canvas sharpen으로 처리)
    if (adjustments.sharpness < 0) {
      parts.push(`blur(${Math.abs(adjustments.sharpness) / 15}px)`);
    }

    return parts.join(' ');
  },

  // Compute CSS transform string from rotation and flip
  getComputedTransform: () => {
    const { rotation, flipX } = get();
    const parts: string[] = [];

    if (rotation !== 0) {
      parts.push(`rotate(${rotation}deg)`);
    }

    if (flipX) {
      parts.push('scaleX(-1)');
    }

    return parts.join(' ');
  },
}));

export default useEditorStore;
