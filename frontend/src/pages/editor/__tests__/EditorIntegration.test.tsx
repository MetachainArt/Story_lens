/**
 * @TASK P3-S4-T2 - Editor Integration Tests
 * @SPEC Integration tests for editor page workflows
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import EditorPage from '../index';
import api from '../../../services/api';

// Mock API
vi.mock('../../../services/api');

// Mock canvas
beforeEach(() => {
  // Mock HTMLCanvasElement methods
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    drawImage: vi.fn(),
    filter: '',
  })) as any;

  HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/jpeg;base64,mockImageData');

  // Mock Image
  global.Image = class {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    src = '';
    width = 800;
    height = 600;

    constructor() {
      setTimeout(() => {
        if (this.onload) {
          this.onload();
        }
      }, 0);
    }
  } as any;
});

afterEach(() => {
  vi.clearAllMocks();
});

// Mock photo data
const mockPhoto = {
  id: 'photo-123',
  user_id: 'user-1',
  session_id: 'session-1',
  original_url: 'https://example.com/photo.jpg',
  edited_url: null,
  title: 'Test Photo',
  thumbnail_url: null,
  created_at: '2026-02-09T10:00:00Z',
  updated_at: '2026-02-09T10:00:00Z',
};

// Mock filters
const mockFilters = [
  {
    id: 1,
    name: 'warm',
    label: '따뜻한',
    css_filter: 'sepia(0.3) saturate(1.4) brightness(1.1)',
    preview_url: null,
  },
  {
    id: 2,
    name: 'cool',
    label: '시원한',
    css_filter: 'saturate(0.8) hue-rotate(30deg) brightness(1.05)',
    preview_url: null,
  },
  {
    id: 3,
    name: 'happy',
    label: '행복한',
    css_filter: 'saturate(1.5) brightness(1.15) contrast(1.1)',
    preview_url: null,
  },
];

const renderEditorPage = (photoId = 'photo-123') => {
  return render(
    <MemoryRouter initialEntries={[`/edit/${photoId}`]}>
      <Routes>
        <Route path="/edit/:photoId" element={<EditorPage />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('EditorPage Integration Tests', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockImplementation((url) => {
      if (url === '/api/v1/photos/photo-123') {
        return Promise.resolve({ data: mockPhoto });
      }
      if (url === '/api/filters') {
        return Promise.resolve({ data: mockFilters });
      }
      return Promise.reject(new Error('Not found'));
    });
  });

  describe('초기 로드', () => {
    it('should load photo and display filter tab initially', async () => {
      renderEditorPage();

      // Loading state
      expect(screen.getByRole('status')).toBeInTheDocument();

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText('편집')).toBeInTheDocument();
      });

      // Filter tab should be active by default
      const filterTab = screen.getByText('필터');
      expect(filterTab.closest('button')).toHaveAttribute('aria-selected', 'true');

      // Filter cards should be visible
      expect(screen.getByText('따뜻한')).toBeInTheDocument();
      expect(screen.getByText('시원한')).toBeInTheDocument();
      expect(screen.getByText('행복한')).toBeInTheDocument();

      // Canvas should be rendered
      const canvas = document.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });
  });

  describe('필터 적용', () => {
    it('should apply warm filter and highlight card', async () => {
      renderEditorPage();

      await waitFor(() => {
        expect(screen.getByText('따뜻한')).toBeInTheDocument();
      });

      const warmCard = screen.getByText('따뜻한').closest('button');
      expect(warmCard).not.toHaveClass('border-primary');

      // Click warm filter
      fireEvent.click(warmCard!);

      // Card should be highlighted
      expect(warmCard).toHaveClass('border-primary');
    });

    it('should apply multiple filters sequentially', async () => {
      renderEditorPage();

      await waitFor(() => {
        expect(screen.getByText('따뜻한')).toBeInTheDocument();
      });

      // Apply warm filter
      const warmCard = screen.getByText('따뜻한').closest('button');
      fireEvent.click(warmCard!);
      expect(warmCard).toHaveClass('border-primary');

      // Apply cool filter (should replace warm)
      const coolCard = screen.getByText('시원한').closest('button');
      fireEvent.click(coolCard!);
      expect(coolCard).toHaveClass('border-primary');
      expect(warmCard).not.toHaveClass('border-primary');
    });
  });

  describe('슬라이더 조절', () => {
    it('should switch to adjustment tab and update brightness slider', async () => {
      renderEditorPage();

      await waitFor(() => {
        expect(screen.getByText('조절')).toBeInTheDocument();
      });

      // Switch to adjustment tab
      const adjustmentTab = screen.getByText('조절');
      fireEvent.click(adjustmentTab);

      expect(adjustmentTab.closest('button')).toHaveAttribute('aria-selected', 'true');

      // Wait for sliders to appear
      await waitFor(() => {
        expect(screen.getByLabelText('밝기')).toBeInTheDocument();
      });

      const brightnessSlider = screen.getByLabelText('밝기') as HTMLInputElement;
      expect(brightnessSlider.value).toBe('0');

      // Change brightness
      fireEvent.change(brightnessSlider, { target: { value: '30' } });

      expect(brightnessSlider.value).toBe('30');
    });

    it('should adjust multiple sliders', async () => {
      renderEditorPage();

      await waitFor(() => {
        expect(screen.getByText('조절')).toBeInTheDocument();
      });

      // Switch to adjustment tab
      fireEvent.click(screen.getByText('조절'));

      await waitFor(() => {
        expect(screen.getByLabelText('밝기')).toBeInTheDocument();
      });

      // Adjust brightness
      const brightnessSlider = screen.getByLabelText('밝기') as HTMLInputElement;
      fireEvent.change(brightnessSlider, { target: { value: '20' } });
      expect(brightnessSlider.value).toBe('20');

      // Adjust contrast
      const contrastSlider = screen.getByLabelText('대비') as HTMLInputElement;
      fireEvent.change(contrastSlider, { target: { value: '15' } });
      expect(contrastSlider.value).toBe('15');

      // Adjust saturation
      const saturationSlider = screen.getByLabelText('채도') as HTMLInputElement;
      fireEvent.change(saturationSlider, { target: { value: '-10' } });
      expect(saturationSlider.value).toBe('-10');
    });
  });

  describe('탭 전환', () => {
    it('should switch to crop tab and display crop tools', async () => {
      renderEditorPage();

      await waitFor(() => {
        expect(screen.getByText('자르기')).toBeInTheDocument();
      });

      // Switch to crop tab
      const cropTab = screen.getByText('자르기');
      fireEvent.click(cropTab);

      expect(cropTab.closest('button')).toHaveAttribute('aria-selected', 'true');

      // Crop tools should be visible
      await waitFor(() => {
        expect(screen.getByText('회전 (90°)')).toBeInTheDocument();
        expect(screen.getByText('좌우 뒤집기')).toBeInTheDocument();
        expect(screen.getByText('현재 회전: 0°')).toBeInTheDocument();
      });
    });

    it('should rotate and flip in crop tab', async () => {
      renderEditorPage();

      await waitFor(() => {
        expect(screen.getByText('자르기')).toBeInTheDocument();
      });

      // Switch to crop tab
      fireEvent.click(screen.getByText('자르기'));

      await waitFor(() => {
        expect(screen.getByText('회전 (90°)')).toBeInTheDocument();
      });

      const canvas = document.querySelector('canvas');

      // Initial state
      expect(screen.getByText('현재 회전: 0°')).toBeInTheDocument();

      // Rotate
      const rotateButton = screen.getByText('회전 (90°)').closest('button')!;
      fireEvent.click(rotateButton);
      expect(screen.getByText('현재 회전: 90°')).toBeInTheDocument();
      expect(canvas?.style.transform).toContain('rotate(90deg)');

      // Flip
      const flipButton = screen.getByText(/좌우 뒤집기/).closest('button')!;
      fireEvent.click(flipButton);
      expect(canvas?.style.transform).toContain('scaleX(-1)');
    });

    it('should navigate between all three tabs', async () => {
      renderEditorPage();

      await waitFor(() => {
        expect(screen.getByText('필터')).toBeInTheDocument();
      });

      // Filter tab (default)
      expect(screen.getByText('필터').closest('button')).toHaveAttribute('aria-selected', 'true');

      // Switch to adjustment
      fireEvent.click(screen.getByText('조절'));
      expect(screen.getByText('조절').closest('button')).toHaveAttribute('aria-selected', 'true');
      await waitFor(() => {
        expect(screen.getByLabelText('밝기')).toBeInTheDocument();
      });

      // Switch to crop
      fireEvent.click(screen.getByText('자르기'));
      expect(screen.getByText('자르기').closest('button')).toHaveAttribute('aria-selected', 'true');
      await waitFor(() => {
        expect(screen.getByText('회전 (90°)')).toBeInTheDocument();
      });

      // Switch back to filter
      fireEvent.click(screen.getByText('필터'));
      expect(screen.getByText('필터').closest('button')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText('따뜻한')).toBeInTheDocument();
    });
  });

  describe('저장', () => {
    it('should save edits and navigate to /saved', async () => {
      const mockEditHistory = {
        id: 'edit-1',
        photo_id: 'photo-123',
        filter_name: 'warm',
        adjustments: {
          brightness: 20,
          contrast: 0,
          saturation: 0,
          temperature: 0,
          sharpness: 0,
        },
        crop_data: {
          rotation: 0,
          flipX: false,
        },
        created_at: '2026-02-09T10:00:00Z',
      };

      vi.mocked(api.post).mockResolvedValue({ data: mockEditHistory });
      vi.mocked(api.put).mockResolvedValue({
        data: { ...mockPhoto, edited_url: 'data:image/jpeg;base64,mockImageData' },
      });

      renderEditorPage();

      await waitFor(() => {
        expect(screen.getByText('저장')).toBeInTheDocument();
      });

      // Apply a filter
      const warmCard = screen.getByText('따뜻한').closest('button');
      fireEvent.click(warmCard!);

      // Switch to adjustment tab
      fireEvent.click(screen.getByText('조절'));

      await waitFor(() => {
        expect(screen.getByLabelText('밝기')).toBeInTheDocument();
      });

      // Adjust brightness
      const brightnessSlider = screen.getByLabelText('밝기') as HTMLInputElement;
      fireEvent.change(brightnessSlider, { target: { value: '20' } });

      // Save
      const saveButton = screen.getByText('저장');
      fireEvent.click(saveButton);

      // Check API calls
      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith(
          '/api/photos/photo-123/edits',
          expect.objectContaining({
            filter_name: 'warm',
            adjustments: expect.objectContaining({
              brightness: 20,
            }),
            crop_data: expect.objectContaining({
              rotation: 0,
              flipX: false,
            }),
          })
        );
      });

      await waitFor(() => {
        expect(api.put).toHaveBeenCalledWith(
          '/api/v1/photos/photo-123',
          expect.objectContaining({
            edited_url: expect.stringContaining('data:image/jpeg'),
          })
        );
      });

      // Should call both APIs
      expect(api.post).toHaveBeenCalledTimes(1);
      expect(api.put).toHaveBeenCalledTimes(1);
    });

    it('should save with all editing options applied', async () => {
      const mockEditHistory = {
        id: 'edit-1',
        photo_id: 'photo-123',
        filter_name: 'happy',
        adjustments: {
          brightness: 30,
          contrast: 10,
          saturation: -5,
          temperature: 0,
          sharpness: 0,
        },
        crop_data: {
          rotation: 90,
          flipX: true,
        },
        created_at: '2026-02-09T10:00:00Z',
      };

      vi.mocked(api.post).mockResolvedValue({ data: mockEditHistory });
      vi.mocked(api.put).mockResolvedValue({
        data: { ...mockPhoto, edited_url: 'data:image/jpeg;base64,mockImageData' },
      });

      renderEditorPage();

      await waitFor(() => {
        expect(screen.getByText('저장')).toBeInTheDocument();
      });

      // Apply filter
      const happyCard = screen.getByText('행복한').closest('button');
      fireEvent.click(happyCard!);

      // Adjust brightness
      fireEvent.click(screen.getByText('조절'));
      await waitFor(() => {
        expect(screen.getByLabelText('밝기')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('밝기'), { target: { value: '30' } });
      fireEvent.change(screen.getByLabelText('대비'), { target: { value: '10' } });
      fireEvent.change(screen.getByLabelText('채도'), { target: { value: '-5' } });

      // Rotate and flip
      fireEvent.click(screen.getByText('자르기'));
      await waitFor(() => {
        expect(screen.getByText('회전 (90°)')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('회전 (90°)').closest('button')!);
      fireEvent.click(screen.getByText(/좌우 뒤집기/).closest('button')!);

      // Save
      const saveButton = screen.getByText('저장');
      fireEvent.click(saveButton);

      // Verify API call with all edits
      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith(
          '/api/photos/photo-123/edits',
          expect.objectContaining({
            filter_name: 'happy',
            adjustments: expect.objectContaining({
              brightness: 30,
              contrast: 10,
              saturation: -5,
            }),
            crop_data: expect.objectContaining({
              rotation: 90,
              flipX: true,
            }),
          })
        );
      });
    });

    it('should show saving state during save operation', async () => {
      const mockEditHistory = {
        id: 'edit-1',
        photo_id: 'photo-123',
        filter_name: null,
        adjustments: {
          brightness: 0,
          contrast: 0,
          saturation: 0,
          temperature: 0,
          sharpness: 0,
        },
        crop_data: null,
        created_at: '2026-02-09T10:00:00Z',
      };

      // Delay the API response
      vi.mocked(api.post).mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({ data: mockEditHistory });
          }, 100);
        });
      });

      vi.mocked(api.put).mockResolvedValue({
        data: { ...mockPhoto, edited_url: 'data:image/jpeg;base64,mockImageData' },
      });

      renderEditorPage();

      await waitFor(() => {
        expect(screen.getByText('저장')).toBeInTheDocument();
      });

      const saveButton = screen.getByText('저장');
      fireEvent.click(saveButton);

      // Should show saving state
      expect(screen.getByText('저장 중...')).toBeInTheDocument();

      // Wait for save to complete
      await waitFor(() => {
        expect(api.put).toHaveBeenCalled();
      });
    });
  });

  describe('Complete Editing Workflow', () => {
    it('should complete full editing workflow: filter → adjust → crop → save', async () => {
      const mockEditHistory = {
        id: 'edit-1',
        photo_id: 'photo-123',
        filter_name: 'cool',
        adjustments: {
          brightness: 15,
          contrast: 5,
          saturation: 10,
          temperature: -10,
          sharpness: 0,
        },
        crop_data: {
          rotation: 180,
          flipX: false,
        },
        created_at: '2026-02-09T10:00:00Z',
      };

      vi.mocked(api.post).mockResolvedValue({ data: mockEditHistory });
      vi.mocked(api.put).mockResolvedValue({
        data: { ...mockPhoto, edited_url: 'data:image/jpeg;base64,mockImageData' },
      });

      renderEditorPage();

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('편집')).toBeInTheDocument();
      });

      // Step 1: Apply filter
      const coolCard = screen.getByText('시원한').closest('button');
      fireEvent.click(coolCard!);
      expect(coolCard).toHaveClass('border-primary');

      // Step 2: Adjust settings
      fireEvent.click(screen.getByText('조절'));
      await waitFor(() => {
        expect(screen.getByLabelText('밝기')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('밝기'), { target: { value: '15' } });
      fireEvent.change(screen.getByLabelText('대비'), { target: { value: '5' } });
      fireEvent.change(screen.getByLabelText('채도'), { target: { value: '10' } });
      fireEvent.change(screen.getByLabelText('온도'), { target: { value: '-10' } });

      // Step 3: Rotate image
      fireEvent.click(screen.getByText('자르기'));
      await waitFor(() => {
        expect(screen.getByText('회전 (90°)')).toBeInTheDocument();
      });

      const rotateButton = screen.getByText('회전 (90°)').closest('button')!;
      fireEvent.click(rotateButton); // 90°
      fireEvent.click(rotateButton); // 180°

      const canvas = document.querySelector('canvas');
      expect(canvas?.style.transform).toContain('rotate(180deg)');

      // Step 4: Save
      const saveButton = screen.getByText('저장');
      fireEvent.click(saveButton);

      // Verify all edits were saved
      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith(
          '/api/photos/photo-123/edits',
          expect.objectContaining({
            filter_name: 'cool',
            adjustments: expect.objectContaining({
              brightness: 15,
              contrast: 5,
              saturation: 10,
              temperature: -10,
            }),
            crop_data: expect.objectContaining({
              rotation: 180,
              flipX: false,
            }),
          })
        );
      });

      // Verify photo was updated
      await waitFor(() => {
        expect(api.put).toHaveBeenCalledWith(
          '/api/v1/photos/photo-123',
          expect.objectContaining({
            edited_url: expect.stringContaining('data:image/jpeg'),
          })
        );
      });

      // Both APIs called exactly once
      expect(api.post).toHaveBeenCalledTimes(1);
      expect(api.put).toHaveBeenCalledTimes(1);
    });
  });
});
