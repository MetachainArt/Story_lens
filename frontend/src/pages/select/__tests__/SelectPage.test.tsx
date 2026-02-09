/**
 * @TASK P3-S3-T1 - SelectPage Component Tests
 * @SPEC specs/screens/select.yaml
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SelectPage from '../index';
import { useCameraStore } from '@/stores/camera';
import api from '@/services/api';

// Mock API
vi.mock('@/services/api', () => ({
  default: {
    post: vi.fn(),
  },
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Helper to create Blob
const createMockBlob = (): Blob => {
  return new Blob(['mock-image'], { type: 'image/jpeg' });
};

// Helper to render with router
const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <MemoryRouter initialEntries={['/select']}>
      <Routes>
        <Route path="/select" element={component} />
      </Routes>
    </MemoryRouter>
  );
};

describe('SelectPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store
    useCameraStore.setState({
      sessionId: 'test-session-id',
      capturedPhotos: [],
    });
  });

  afterEach(() => {
    // Clean up any object URLs
    vi.clearAllMocks();
  });

  describe('Redirect Logic', () => {
    it('should redirect to /camera if no photos captured', () => {
      useCameraStore.setState({ capturedPhotos: [] });
      renderWithRouter(<SelectPage />);

      // Should call navigate to /camera
      expect(mockNavigate).toHaveBeenCalledWith('/camera', { replace: true });
    });

    it('should not redirect if photos exist', () => {
      const mockPhotos = [createMockBlob(), createMockBlob()];
      useCameraStore.setState({ capturedPhotos: mockPhotos });

      renderWithRouter(<SelectPage />);

      // Should NOT redirect
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('Photo Preview Display', () => {
    it('should display photo preview when photos exist', () => {
      const mockPhotos = [createMockBlob(), createMockBlob(), createMockBlob()];
      useCameraStore.setState({ capturedPhotos: mockPhotos });

      renderWithRouter(<SelectPage />);

      // Should show image element
      const image = screen.getByRole('img', { name: /사진 미리보기/i });
      expect(image).toBeInTheDocument();
    });

    it('should display photo indicator with correct count', () => {
      const mockPhotos = [createMockBlob(), createMockBlob(), createMockBlob()];
      useCameraStore.setState({ capturedPhotos: mockPhotos });

      renderWithRouter(<SelectPage />);

      // Should show "1/3"
      expect(screen.getByText('1 / 3')).toBeInTheDocument();
    });
  });

  describe('Photo Navigation', () => {
    it('should show previous and next buttons', () => {
      const mockPhotos = [createMockBlob(), createMockBlob()];
      useCameraStore.setState({ capturedPhotos: mockPhotos });

      renderWithRouter(<SelectPage />);

      // Check for navigation buttons
      const prevButton = screen.getByRole('button', { name: /이전 사진/i });
      const nextButton = screen.getByRole('button', { name: /다음 사진/i });

      expect(prevButton).toBeInTheDocument();
      expect(nextButton).toBeInTheDocument();
    });

    it('should navigate to next photo when next button clicked', () => {
      const mockPhotos = [createMockBlob(), createMockBlob(), createMockBlob()];
      useCameraStore.setState({ capturedPhotos: mockPhotos });

      renderWithRouter(<SelectPage />);

      // Initially should show 1/3
      expect(screen.getByText('1 / 3')).toBeInTheDocument();

      // Click next button
      const nextButton = screen.getByRole('button', { name: /다음 사진/i });
      fireEvent.click(nextButton);

      // Should now show 2/3
      expect(screen.getByText('2 / 3')).toBeInTheDocument();
    });

    it('should navigate to previous photo when prev button clicked', () => {
      const mockPhotos = [createMockBlob(), createMockBlob()];
      useCameraStore.setState({ capturedPhotos: mockPhotos });

      renderWithRouter(<SelectPage />);

      // Navigate to second photo first
      const nextButton = screen.getByRole('button', { name: /다음 사진/i });
      fireEvent.click(nextButton);
      expect(screen.getByText('2 / 2')).toBeInTheDocument();

      // Click previous button
      const prevButton = screen.getByRole('button', { name: /이전 사진/i });
      fireEvent.click(prevButton);

      // Should go back to 1/2
      expect(screen.getByText('1 / 2')).toBeInTheDocument();
    });

    it('should wrap to last photo when clicking previous on first photo', () => {
      const mockPhotos = [createMockBlob(), createMockBlob(), createMockBlob()];
      useCameraStore.setState({ capturedPhotos: mockPhotos });

      renderWithRouter(<SelectPage />);

      // On first photo
      expect(screen.getByText('1 / 3')).toBeInTheDocument();

      // Click previous
      const prevButton = screen.getByRole('button', { name: /이전 사진/i });
      fireEvent.click(prevButton);

      // Should wrap to last photo (3/3)
      expect(screen.getByText('3 / 3')).toBeInTheDocument();
    });

    it('should wrap to first photo when clicking next on last photo', () => {
      const mockPhotos = [createMockBlob(), createMockBlob()];
      useCameraStore.setState({ capturedPhotos: mockPhotos });

      renderWithRouter(<SelectPage />);

      // Navigate to last photo
      const nextButton = screen.getByRole('button', { name: /다음 사진/i });
      fireEvent.click(nextButton);
      expect(screen.getByText('2 / 2')).toBeInTheDocument();

      // Click next again
      fireEvent.click(nextButton);

      // Should wrap to first photo (1/2)
      expect(screen.getByText('1 / 2')).toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    it('should render "이 사진 편집하기" button', () => {
      const mockPhotos = [createMockBlob()];
      useCameraStore.setState({ capturedPhotos: mockPhotos });

      renderWithRouter(<SelectPage />);

      const editButton = screen.getByRole('button', { name: /이 사진 편집하기/i });
      expect(editButton).toBeInTheDocument();
    });

    it('should render "다시 찍기" button', () => {
      const mockPhotos = [createMockBlob()];
      useCameraStore.setState({ capturedPhotos: mockPhotos });

      renderWithRouter(<SelectPage />);

      const retakeButton = screen.getByRole('button', { name: /다시 찍기/i });
      expect(retakeButton).toBeInTheDocument();
    });

    it('should navigate to /camera when "다시 찍기" clicked', () => {
      const mockPhotos = [createMockBlob()];
      useCameraStore.setState({ capturedPhotos: mockPhotos });

      renderWithRouter(<SelectPage />);

      const retakeButton = screen.getByRole('button', { name: /다시 찍기/i });
      fireEvent.click(retakeButton);

      expect(mockNavigate).toHaveBeenCalledWith('/camera');
    });
  });

  describe('Photo Upload and Navigation', () => {
    it('should upload photo and navigate to editor on "이 사진 편집하기" click', async () => {
      const mockPhotos = [createMockBlob(), createMockBlob()];
      useCameraStore.setState({
        capturedPhotos: mockPhotos,
        sessionId: 'test-session-123',
      });

      // Mock successful upload
      const mockPhotoResponse = {
        data: {
          id: 'photo-uuid-123',
          user_id: 'user-123',
          session_id: 'test-session-123',
          original_url: 'http://example.com/photo.jpg',
          edited_url: null,
          title: null,
          thumbnail_url: null,
          created_at: '2026-02-09T10:00:00',
          updated_at: '2026-02-09T10:00:00',
        },
      };
      (api.post as ReturnType<typeof vi.fn>).mockResolvedValue(mockPhotoResponse);

      renderWithRouter(<SelectPage />);

      const editButton = screen.getByRole('button', { name: /이 사진 편집하기/i });
      fireEvent.click(editButton);

      // Should show loading state (PrimaryButton shows "처리 중..." when isLoading)
      expect(screen.getByText(/처리 중.../i)).toBeInTheDocument();

      // Wait for upload to complete
      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith(
          '/api/v1/photos',
          expect.any(FormData),
          {
            headers: { 'Content-Type': 'multipart/form-data' },
          }
        );
      });

      // Should navigate to editor with photo ID
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/edit/photo-uuid-123');
      });
    });

    it('should show error message if upload fails', async () => {
      const mockPhotos = [createMockBlob()];
      useCameraStore.setState({
        capturedPhotos: mockPhotos,
        sessionId: 'test-session-123',
      });

      // Mock failed upload
      (api.post as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Upload failed')
      );

      renderWithRouter(<SelectPage />);

      const editButton = screen.getByRole('button', { name: /이 사진 편집하기/i });
      fireEvent.click(editButton);

      // Wait for error message
      await waitFor(() => {
        expect(screen.getByText(/업로드 실패/i)).toBeInTheDocument();
      });

      // Should not navigate
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should include session_id in upload request', async () => {
      const mockPhotos = [createMockBlob()];
      useCameraStore.setState({
        capturedPhotos: mockPhotos,
        sessionId: 'test-session-456',
      });

      (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { id: 'photo-123' },
      });

      renderWithRouter(<SelectPage />);

      const editButton = screen.getByRole('button', { name: /이 사진 편집하기/i });
      fireEvent.click(editButton);

      await waitFor(() => {
        const formDataArg = (api.post as ReturnType<typeof vi.fn>).mock.calls[0][1];
        expect(formDataArg.get('session_id')).toBe('test-session-456');
      });
    });
  });

  describe('Touch Gestures (Swipe)', () => {
    it('should support touch swipe to navigate photos', () => {
      const mockPhotos = [createMockBlob(), createMockBlob(), createMockBlob()];
      useCameraStore.setState({ capturedPhotos: mockPhotos });

      renderWithRouter(<SelectPage />);

      const image = screen.getByRole('img', { name: /사진 미리보기/i });

      // Simulate swipe left (next photo)
      fireEvent.touchStart(image, {
        touches: [{ clientX: 300, clientY: 100 }],
      });
      fireEvent.touchEnd(image, {
        changedTouches: [{ clientX: 100, clientY: 100 }],
      });

      // Should move to next photo
      expect(screen.getByText('2 / 3')).toBeInTheDocument();
    });

    it('should support touch swipe right to go to previous photo', () => {
      const mockPhotos = [createMockBlob(), createMockBlob()];
      useCameraStore.setState({ capturedPhotos: mockPhotos });

      renderWithRouter(<SelectPage />);

      // Navigate to second photo first
      const nextButton = screen.getByRole('button', { name: /다음 사진/i });
      fireEvent.click(nextButton);

      const image = screen.getByRole('img', { name: /사진 미리보기/i });

      // Simulate swipe right (previous photo)
      fireEvent.touchStart(image, {
        touches: [{ clientX: 100, clientY: 100 }],
      });
      fireEvent.touchEnd(image, {
        changedTouches: [{ clientX: 300, clientY: 100 }],
      });

      // Should move to previous photo
      expect(screen.getByText('1 / 2')).toBeInTheDocument();
    });
  });

  describe('Object URL Cleanup', () => {
    it('should revoke object URLs on unmount', () => {
      const mockPhotos = [createMockBlob()];
      useCameraStore.setState({ capturedPhotos: mockPhotos });

      // Spy on URL.revokeObjectURL
      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL');

      const { unmount } = renderWithRouter(<SelectPage />);

      // Unmount component
      unmount();

      // Should have called revokeObjectURL for each photo
      expect(revokeObjectURLSpy).toHaveBeenCalled();

      revokeObjectURLSpy.mockRestore();
    });
  });
});
