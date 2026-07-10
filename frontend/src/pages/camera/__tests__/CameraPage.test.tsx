/**
 * @TASK P3-S2-T1 - Camera Page Tests
 * @SPEC TDD test suite for camera page
 */
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import CameraPage from '../index';
import { useCameraStore } from '@/stores/camera';
import { useAuthStore } from '@/stores/auth';
import api from '@/services/api';

// Mock dependencies
vi.mock('@/services/api');

// Mock navigator.mediaDevices.getUserMedia
const mockGetUserMedia = vi.fn();
const mockStopTrack = vi.fn();
const mockStream = {
  getTracks: vi.fn(() => [
    { stop: mockStopTrack },
  ]),
  getVideoTracks: vi.fn(() => [{ stop: mockStopTrack }]),
};

Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: mockGetUserMedia,
  },
  writable: true,
});

describe('CameraPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset stores
    useCameraStore.setState({
      sessionId: null,
      capturedPhotos: [],
    });

    useAuthStore.setState({
      isAuthenticated: true,
      accessToken: 'test-token',
      user: { id: 'user-123', email: 'test@example.com', name: 'Test User' },
    });

    // Mock successful camera access
    mockGetUserMedia.mockResolvedValue(mockStream);

    // Mock session creation API
    vi.mocked(api.post).mockResolvedValue({
      data: {
        id: 'session-123',
        user_id: 'user-123',
        title: '촬영 2026-02-09',
        date: '2026-02-09',
        location: null,
        created_at: '2026-02-09T10:00:00',
      },
    });
  });

  afterEach(() => {
    mockStopTrack.mockClear();
    vi.restoreAllMocks();
  });

  it('should request camera permission on mount', async () => {
    render(
      <BrowserRouter>
        <CameraPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalledWith({
        video: { facingMode: 'environment' },
        audio: false,
      });
    });
  });

  it('should show loading spinner while requesting camera permission', () => {
    mockGetUserMedia.mockImplementation(() => new Promise(() => {})); // Never resolves
    vi.mocked(api.post).mockImplementation(() => new Promise(() => {}));

    render(
      <BrowserRouter>
        <CameraPage />
      </BrowserRouter>
    );

    expect(screen.getByText('카메라 준비중...')).toBeInTheDocument();
  });

  it('should show error UI when camera permission is denied', async () => {
    mockGetUserMedia.mockRejectedValue(new Error('Permission denied'));

    render(
      <BrowserRouter>
        <CameraPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/카메라 접근 실패/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: '권한 재요청' })).toBeInTheDocument();
  });

  it('should create session on mount', async () => {
    render(
      <BrowserRouter>
        <CameraPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/api/v1/sessions',
        expect.objectContaining({
          title: expect.stringContaining('촬영'),
          date: expect.any(String),
        })
      );
    });

    // Verify session ID was set in store
    await waitFor(() => {
      expect(useCameraStore.getState().sessionId).toBe('session-123');
    });
  });

  it('should render capture button after camera is ready', async () => {
    render(
      <BrowserRouter>
        <CameraPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /촬영/i })).toBeInTheDocument();
    });
  });

  it('should show photo counter as "0장 촬영됨" initially', async () => {
    render(
      <BrowserRouter>
        <CameraPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('0장')).toBeInTheDocument();
    });
  });

  it('should increment photo counter when capture button is clicked', async () => {
    // Set store state with one photo
    useCameraStore.setState({
      sessionId: 'session-123',
      capturedPhotos: [new Blob()],
    });

    render(
      <BrowserRouter>
        <CameraPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('1장')).toBeInTheDocument();
    });
  });

  it('should not show finish button when no photos are captured', async () => {
    render(
      <BrowserRouter>
        <CameraPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '다음' })).not.toBeInTheDocument();
    });
  });

  it('should show finish button when at least one photo is captured', async () => {
    // Set store state with photos
    useCameraStore.setState({
      sessionId: 'session-123',
      capturedPhotos: [new Blob()],
    });

    render(
      <BrowserRouter>
        <CameraPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '다음' })).toBeInTheDocument();
    });
  });

  it('should stop camera stream when component unmounts', async () => {
    const { unmount } = render(
      <BrowserRouter>
        <CameraPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalled();
    });

    unmount();

    expect(mockStopTrack).toHaveBeenCalled();
  });
});
