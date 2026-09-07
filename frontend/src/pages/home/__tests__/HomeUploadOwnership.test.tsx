import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import HomePage from '../index';
import { useAuthStore } from '@/stores/auth';
import { useCameraStore } from '@/stores/camera';
import api from '@/services/api';

const navigate = vi.fn();
vi.mock('@/services/api', () => ({ default: { post: vi.fn() } }));
vi.mock('react-router-dom', async () => ({
  ...await vi.importActual<typeof import('react-router-dom')>('react-router-dom'),
  useNavigate: () => navigate,
}));

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: { id: 'account-a', role: 'student' } as never });
  useCameraStore.setState({ sessionId: null, capturedPhotos: [] });
});

it.each(['success', 'failure'] as const)('ignores A upload %s after switching to B', async (outcome) => {
  let resolveRequest!: (value: unknown) => void;
  let rejectRequest!: (reason: Error) => void;
  vi.mocked(api.post).mockReturnValueOnce(new Promise((resolve, reject) => {
    resolveRequest = resolve;
    rejectRequest = reject;
  }));
  const view = render(<MemoryRouter><HomePage /></MemoryRouter>);
  fireEvent.change(view.container.querySelector('input[type=file]')!, {
    target: { files: [new File(['private-a'], 'a.jpg', { type: 'image/jpeg' })] },
  });
  const bPhoto = new Blob(['private-b'], { type: 'image/jpeg' });
  act(() => {
    useAuthStore.setState({ user: { id: 'account-b', role: 'student' } as never });
    useCameraStore.setState({ sessionId: 'session-b', capturedPhotos: [bPhoto] });
  });
  await act(async () => {
    if (outcome === 'success') resolveRequest({ data: { id: 'session-a' } });
    else rejectRequest(new Error('offline'));
  });
  expect(useCameraStore.getState().sessionId).toBe('session-b');
  expect(useCameraStore.getState().capturedPhotos).toEqual([bPhoto]);
  expect(navigate).not.toHaveBeenCalled();
});

it('ignores a delayed upload response after leaving the home page', async () => {
  let resolveRequest!: (value: unknown) => void;
  vi.mocked(api.post).mockReturnValueOnce(new Promise(resolve => { resolveRequest = resolve; }));
  const view = render(<MemoryRouter><HomePage /></MemoryRouter>);
  fireEvent.change(view.container.querySelector('input[type=file]')!, {
    target: { files: [new File(['private-a'], 'a.jpg', { type: 'image/jpeg' })] },
  });
  await waitFor(() => expect(api.post).toHaveBeenCalled());
  view.unmount();
  await act(async () => { resolveRequest({ data: { id: 'late-session' } }); });
  expect(useCameraStore.getState().sessionId).toBeNull();
  expect(useCameraStore.getState().capturedPhotos).toEqual([]);
  expect(navigate).not.toHaveBeenCalled();
});
