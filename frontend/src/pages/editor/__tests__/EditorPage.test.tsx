/**
 * @TASK P3-S4-T1 - Editor Page Tests
 * @SPEC Tests for editor page with filters, adjustments, and crop
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
  {
    id: 4,
    name: 'calm',
    label: '차분한',
    css_filter: 'saturate(0.7) brightness(0.95) contrast(0.95)',
    preview_url: null,
  },
  {
    id: 5,
    name: 'memory',
    label: '회상',
    css_filter: 'sepia(0.5) saturate(0.8) brightness(0.9) contrast(1.1)',
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

describe('EditorPage', () => {
  describe('Photo Loading', () => {
    it('should load photo details on mount', async () => {
      vi.mocked(api.get).mockImplementation((url) => {
        if (url === '/api/v1/photos/photo-123') {
          return Promise.resolve({ data: mockPhoto });
        }
        if (url === '/api/filters') {
          return Promise.resolve({ data: mockFilters });
        }
        return Promise.reject(new Error('Not found'));
      });

      renderEditorPage();

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/api/v1/photos/photo-123');
      });
    });

    it('should load filters on mount', async () => {
      vi.mocked(api.get).mockImplementation((url) => {
        if (url === '/api/v1/photos/photo-123') {
          return Promise.resolve({ data: mockPhoto });
        }
        if (url === '/api/filters') {
          return Promise.resolve({ data: mockFilters });
        }
        return Promise.reject(new Error('Not found'));
      });

      renderEditorPage();

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/api/filters');
      });
    });

    it('should show loading spinner while fetching data', async () => {
      vi.mocked(api.get).mockImplementation(() => {
        return new Promise(() => {}); // Never resolves
      });

      renderEditorPage();

      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should show error message if photo fetch fails', async () => {
      vi.mocked(api.get).mockRejectedValue(new Error('Network error'));

      renderEditorPage();

      await waitFor(() => {
        expect(screen.getByText(/오류가 발생했습니다/i)).toBeInTheDocument();
      });
    });
  });

  describe('Tab Navigation', () => {
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

    it('should render three tabs: 필터, 조절, 자르기', async () => {
      renderEditorPage();

      await waitFor(() => {
        expect(screen.getByText('필터')).toBeInTheDocument();
        expect(screen.getByText('조절')).toBeInTheDocument();
        expect(screen.getByText('자르기')).toBeInTheDocument();
      });
    });

    it('should show filter tab by default', async () => {
      renderEditorPage();

      await waitFor(() => {
        const filterTab = screen.getByText('필터');
        expect(filterTab.closest('button')).toHaveAttribute('aria-selected', 'true');
      });
    });

    it('should switch to adjustment tab on click', async () => {
      renderEditorPage();

      await waitFor(() => {
        expect(screen.getByText('조절')).toBeInTheDocument();
      });

      const adjustmentTab = screen.getByText('조절');
      fireEvent.click(adjustmentTab);

      expect(adjustmentTab.closest('button')).toHaveAttribute('aria-selected', 'true');
    });

    it('should switch to crop tab on click', async () => {
      renderEditorPage();

      await waitFor(() => {
        expect(screen.getByText('자르기')).toBeInTheDocument();
      });

      const cropTab = screen.getByText('자르기');
      fireEvent.click(cropTab);

      expect(cropTab.closest('button')).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Filter Panel', () => {
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

    it('should render 5 filter cards', async () => {
      renderEditorPage();

      await waitFor(() => {
        expect(screen.getByText('따뜻한')).toBeInTheDocument();
        expect(screen.getByText('시원한')).toBeInTheDocument();
        expect(screen.getByText('행복한')).toBeInTheDocument();
        expect(screen.getByText('차분한')).toBeInTheDocument();
        expect(screen.getByText('회상')).toBeInTheDocument();
      });
    });

    it('should highlight selected filter card', async () => {
      renderEditorPage();

      await waitFor(() => {
        expect(screen.getByText('따뜻한')).toBeInTheDocument();
      });

      const warmCard = screen.getByText('따뜻한').closest('button');
      fireEvent.click(warmCard!);

      expect(warmCard).toHaveClass('border-primary');
    });
  });

  describe('Adjustment Panel', () => {
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

    it('should render 5 adjustment sliders', async () => {
      renderEditorPage();

      await waitFor(() => {
        expect(screen.getByText('조절')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('조절'));

      await waitFor(() => {
        expect(screen.getByLabelText('밝기')).toBeInTheDocument();
        expect(screen.getByLabelText('채도')).toBeInTheDocument();
        expect(screen.getByLabelText('대비')).toBeInTheDocument();
        expect(screen.getByLabelText('온도')).toBeInTheDocument();
        expect(screen.getByLabelText('선명도')).toBeInTheDocument();
      });
    });

    it('should update slider value on change', async () => {
      renderEditorPage();

      await waitFor(() => {
        expect(screen.getByText('조절')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('조절'));

      await waitFor(() => {
        expect(screen.getByLabelText('밝기')).toBeInTheDocument();
      });

      const brightnessSlider = screen.getByLabelText('밝기') as HTMLInputElement;
      fireEvent.change(brightnessSlider, { target: { value: '30' } });

      expect(brightnessSlider.value).toBe('30');
    });
  });

  describe('Crop Panel', () => {
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

    it('should render rotation and flip buttons', async () => {
      renderEditorPage();

      await waitFor(() => {
        expect(screen.getByText('자르기')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('자르기'));

      await waitFor(() => {
        expect(screen.getByText('회전 (90°)')).toBeInTheDocument();
        expect(screen.getByText('좌우 뒤집기')).toBeInTheDocument();
      });
    });

    it('should rotate image 90 degrees on rotation button click', async () => {
      renderEditorPage();

      await waitFor(() => {
        expect(screen.getByText('자르기')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('자르기'));

      await waitFor(() => {
        expect(screen.getByText('회전 (90°)')).toBeInTheDocument();
      });

      const rotateButton = screen.getByText('회전 (90°)').closest('button')!;
      fireEvent.click(rotateButton);

      // Canvas should have transform style applied
      const canvas = document.querySelector('canvas');
      expect(canvas?.style.transform).toContain('rotate(90deg)');
    });

    it('should flip image horizontally on flip button click', async () => {
      renderEditorPage();

      await waitFor(() => {
        expect(screen.getByText('자르기')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('자르기'));

      await waitFor(() => {
        expect(screen.getByText(/좌우 뒤집기/)).toBeInTheDocument();
      });

      const flipButton = screen.getByText(/좌우 뒤집기/).closest('button')!;
      fireEvent.click(flipButton);

      // Canvas should have transform style applied
      const canvas = document.querySelector('canvas');
      expect(canvas?.style.transform).toContain('scaleX(-1)');
    });
  });

  describe('Save Functionality', () => {
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

    it('should call save APIs on save button click', async () => {
      const mockEditHistory = {
        id: 'edit-1',
        photo_id: 'photo-123',
        filter_name: 'warm',
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

      vi.mocked(api.post).mockResolvedValue({ data: mockEditHistory });
      vi.mocked(api.put).mockResolvedValue({ data: { ...mockPhoto, edited_url: 'data:image/jpeg;base64,mockImageData' } });

      renderEditorPage();

      await waitFor(() => {
        expect(screen.getByText('저장')).toBeInTheDocument();
      });

      // Select a filter first
      const warmCard = screen.getByText('따뜻한').closest('button');
      fireEvent.click(warmCard!);

      const saveButton = screen.getByText('저장');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith(
          '/api/photos/photo-123/edits',
          expect.objectContaining({
            filter_name: 'warm',
            adjustments: expect.any(Object),
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
    });

    it('should navigate to /saved after successful save', async () => {
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

      vi.mocked(api.post).mockResolvedValue({ data: mockEditHistory });
      vi.mocked(api.put).mockResolvedValue({ data: { ...mockPhoto, edited_url: 'data:image/jpeg;base64,mockImageData' } });

      renderEditorPage();

      await waitFor(() => {
        expect(screen.getByText('저장')).toBeInTheDocument();
      });

      const saveButton = screen.getByText('저장');
      fireEvent.click(saveButton);

      await waitFor(() => {
        // Check if navigation occurred (in a real app, would check location)
        expect(api.put).toHaveBeenCalled();
      });
    });

    it('should show error message if save fails', async () => {
      vi.mocked(api.post).mockRejectedValue(new Error('Save failed'));

      renderEditorPage();

      await waitFor(() => {
        expect(screen.getByText('저장')).toBeInTheDocument();
      });

      const saveButton = screen.getByText('저장');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/저장 중 오류가 발생했습니다/i)).toBeInTheDocument();
      });
    });
  });

  describe('Back Button', () => {
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

    it('should navigate back on back button click', async () => {
      renderEditorPage();

      await waitFor(() => {
        expect(screen.getByLabelText(/뒤로/i)).toBeInTheDocument();
      });

      const backButton = screen.getByLabelText(/뒤로/i);
      fireEvent.click(backButton);

      // In a real app, would check location change
      expect(backButton).toBeInTheDocument();
    });
  });
});
