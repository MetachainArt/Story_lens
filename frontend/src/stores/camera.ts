/**
 * @TASK P3-S2-T1 - Camera Store
 * @SPEC Zustand store for camera session and captured photos
 */
import { create } from 'zustand';

interface CameraStore {
  // State
  sessionId: string | null;
  capturedPhotos: Blob[];

  // Actions
  setSessionId: (id: string) => void;
  addPhoto: (blob: Blob) => void;
  clearPhotos: () => void;
}

export const useCameraStore = create<CameraStore>((set) => ({
  // Initial state
  sessionId: null,
  capturedPhotos: [],

  // Set session ID
  setSessionId: (id: string) => set({ sessionId: id }),

  // Add captured photo
  addPhoto: (blob: Blob) =>
    set((state) => ({
      capturedPhotos: [...state.capturedPhotos, blob],
    })),

  // Clear all photos
  clearPhotos: () => set({ capturedPhotos: [] }),
}));

export default useCameraStore;
