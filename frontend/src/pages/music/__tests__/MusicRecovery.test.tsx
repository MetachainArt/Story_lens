import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MusicPage from '../index';
import api from '@/services/api';
import { useAuthStore } from '@/stores/auth';

vi.mock('@/services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
const jobKey = 'user:music-user:story_lens_music_job:photo-1';
const track = { id: 'track-1', title: '나의 노래', audio_url: 'https://audio.example/test.mp3', stream_url: '', local_url: '/uploads/music/photo-1/song.mp3', duration: 60, tags: '' };
let storage: Map<string, string>;
function mount() {
  return render(<MemoryRouter initialEntries={['/music/photo-1']}><Routes><Route path="/music/:photoId" element={<MusicPage />} /></Routes></MemoryRouter>);
}
beforeEach(() => {
  vi.clearAllMocks();
  storage = new Map();
  useAuthStore.setState({ user: { id: 'music-user' } as never });
  vi.mocked(localStorage.getItem).mockImplementation((key) => storage.get(key) ?? null);
  vi.mocked(localStorage.setItem).mockImplementation((key, value) => { storage.set(key, value); });
  vi.mocked(localStorage.removeItem).mockImplementation((key) => { storage.delete(key); });
  vi.mocked(api.post).mockResolvedValue({ data: { task_id: 'task-1' } });
  vi.mocked(api.get).mockResolvedValue({ data: { status: 'PENDING' } });
  vi.mocked(api.put).mockResolvedValue({ data: {} });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('music result recovery and private media', () => {
  it('persists a task and resumes after remount without another paid request', async () => {
    const first = mount();
    fireEvent.click(screen.getByRole('button', { name: 'AI 음악 만들기' }));
    await waitFor(() => expect(storage.has(jobKey)).toBe(true));
    first.unmount();
    vi.mocked(api.get).mockResolvedValue({ data: { status: 'SUCCESS', tracks: [track] } });
    mount();
    expect(await screen.findByText('나의 노래')).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(storage.has(jobKey)).toBe(false));
  });

  it('restores every completed track after re-entry without regenerating', async () => {
    const secondTrack = { ...track, id: 'track-2', title: '두 번째 노래', local_url: '/uploads/music/photo-1/song-2.mp3' };
    storage.set(jobKey, JSON.stringify({ taskId: 'old-task', style: '재즈' }));
    vi.mocked(api.get).mockResolvedValue({ data: { status: 'SUCCESS', tracks: [track, secondTrack] } });
    const page = mount();
    await screen.findByText('두 번째 노래');
    await waitFor(() => expect(storage.has(jobKey)).toBe(false));
    page.unmount();
    mount();
    expect(await screen.findByText('나의 노래')).toBeInTheDocument();
    expect(await screen.findByText('두 번째 노래')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('does not turn an HTTP error into a downloaded mp3', async () => {
    storage.set('user:music-user:saved_music', JSON.stringify([{ photoId: 'photo-1', track }]));
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"detail":"Not found"}', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
    mount();
    fireEvent.click(await screen.findByTitle('음악 다운로드'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/v1/media/uploads/music/photo-1/song.mp3'), { credentials: 'include' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('다운로드');
  });

  it('uses the authenticated media path and reports playback failure', async () => {
    storage.set('user:music-user:saved_music', JSON.stringify([{ photoId: 'photo-1', track }]));
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new Error('unavailable'));
    mount();
    fireEvent.click(await screen.findByRole('button', { name: '나의 노래 재생' }));
    await waitFor(() => expect(document.querySelector('audio')?.src).toContain('/api/v1/media/uploads/music/photo-1/song.mp3'));
    expect(await screen.findByRole('alert')).toHaveTextContent('재생');
  });

  it('stops an in-flight poll from scheduling again after leaving', async () => {
    vi.useFakeTimers();
    storage.set(jobKey, JSON.stringify({ taskId: 'old-task', style: '재즈' }));
    let resolve!: (value: unknown) => void;
    vi.mocked(api.get).mockImplementation(() => new Promise((done) => { resolve = done; }));
    const page = mount();
    await act(async () => {});
    expect(api.get).toHaveBeenCalledTimes(1);
    page.unmount();
    await act(async () => { resolve({ data: { status: 'PENDING' } }); });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not recover a different account task', async () => {
    storage.set('user:other-user:story_lens_music_job:photo-1', JSON.stringify({ taskId: 'private-task', style: '재즈' }));
    mount();
    await act(async () => {});
    expect(api.get).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'AI 음악 만들기' })).toBeEnabled();
  });

  it('shows an explicit warning if completed music could not be saved to the photo', async () => {
    storage.set(jobKey, JSON.stringify({ taskId: 'old-task', style: '재즈' }));
    vi.mocked(api.get).mockResolvedValue({ data: { status: 'SUCCESS', tracks: [track] } });
    vi.mocked(api.put).mockRejectedValue(new Error('save failed'));
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('사진에 저장하지 못했어요');
    expect(storage.has(jobKey)).toBe(true);
  });

  it('keeps polling the accepted task when browser storage rejects its recovery marker', async () => {
    vi.mocked(localStorage.setItem).mockImplementation(() => { throw new DOMException('Storage full', 'QuotaExceededError'); });
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'AI 음악 만들기' }));
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/music/status/task-1', expect.objectContaining({ params: { photo_id: 'photo-1' } })));
    expect(await screen.findByRole('alert')).toHaveTextContent('이 화면을 유지');
    expect(screen.getByRole('button', { name: 'AI가 작곡 중...' })).toBeDisabled();
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it('allows an explicit new generation after a completed result had a save warning', async () => {
    storage.set(jobKey, JSON.stringify({ taskId: 'old-task', style: '재즈' }));
    vi.mocked(api.get).mockResolvedValue({ data: { status: 'SUCCESS', tracks: [track] } });
    vi.mocked(api.put).mockRejectedValue(new Error('save failed'));
    mount();
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: '다시 만들기' }));
    vi.mocked(api.get).mockResolvedValue({ data: { status: 'PENDING' } });
    fireEvent.click(screen.getByRole('button', { name: 'AI 음악 만들기' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  });
});
