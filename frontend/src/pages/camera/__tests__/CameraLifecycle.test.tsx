import { act, render, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import CameraPage from '../index';
import api from '@/services/api';
import { useCameraStore } from '@/stores/camera';

vi.mock('@/services/api', () => ({ default: { post: vi.fn() } }));
beforeEach(() => {
  vi.resetAllMocks();
  useCameraStore.setState({ sessionId: null, capturedPhotos: [] });
  vi.mocked(api.post).mockResolvedValue({ data: { id: 'session' } });
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(() => new Promise(() => {})) },
  });
});
afterEach(() => vi.restoreAllMocks());

it('creates only one session when StrictMode replays the mount effect', async () => {
  render(<StrictMode><MemoryRouter><CameraPage /></MemoryRouter></StrictMode>);
  await waitFor(() => expect(useCameraStore.getState().sessionId).toBe('session'));
  expect(api.post).toHaveBeenCalledOnce();
  expect(api.post).toHaveBeenCalledWith('/api/v1/sessions', expect.objectContaining({
    title: expect.stringContaining('촬영'),
    date: expect.any(String),
  }));
});

it.each(['success', 'failure'])('does not replace a newer session after the camera page closes: %s', async (result) => {
  let resolveSession!: (response: { data: { id: string } }) => void;
  let rejectSession!: (error: Error) => void;
  vi.mocked(api.post).mockReturnValueOnce(new Promise((resolve, reject) => {
    resolveSession = resolve;
    rejectSession = reject;
  }));
  const { unmount } = render(<MemoryRouter><CameraPage /></MemoryRouter>);
  await waitFor(() => expect(api.post).toHaveBeenCalledOnce());
  unmount();
  useCameraStore.getState().setSessionId('newer-upload-session');

  await act(async () => {
    if (result === 'success') resolveSession({ data: { id: 'late-camera-session' } });
    else rejectSession(new Error('offline'));
  });

  expect(useCameraStore.getState().sessionId).toBe('newer-upload-session');
});

it('does not create a session when the camera page closes before initialization', async () => {
  const { unmount } = render(<MemoryRouter><CameraPage /></MemoryRouter>);
  unmount();
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  expect(api.post).not.toHaveBeenCalled();
  expect(useCameraStore.getState().sessionId).toBeNull();
});

it('stops a camera stream granted after the camera page is closed', async () => {
  let resolvePermission!: (stream: unknown) => void;
  const getUserMedia = vi.fn(() => new Promise(resolve => { resolvePermission = resolve; }));
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  const stop = vi.fn();
  const { unmount } = render(<MemoryRouter><CameraPage /></MemoryRouter>);
  await waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce());
  unmount();
  await act(async () => { resolvePermission({ getTracks: () => [{ stop }] }); });
  expect(stop).toHaveBeenCalledOnce();
});

it('does not request another camera after a pending permission request is rejected on a closed page', async () => {
  let rejectPermission!: (error: Error) => void;
  const getUserMedia = vi.fn(() => new Promise((_resolve, reject) => { rejectPermission = reject; }));
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  const { unmount } = render(<MemoryRouter><CameraPage /></MemoryRouter>);
  await waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce());
  unmount();
  await act(async () => { rejectPermission(new Error('Permission denied')); });
  expect(getUserMedia).toHaveBeenCalledOnce();
});
