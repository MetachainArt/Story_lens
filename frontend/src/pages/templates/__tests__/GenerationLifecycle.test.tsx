import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import TemplatesPage from '../index';
import RetouchPage from '../../ai-retouch';
import { useAuthStore } from '@/stores/auth';

const { get, post, navigate } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), navigate: vi.fn() }));
vi.mock('@/services/api', () => ({ default: { get, post } }));
vi.mock('react-router-dom', async () => ({ ...await vi.importActual('react-router-dom'), useNavigate: () => navigate }));

const cases = [
  ['templates', TemplatesPage, 'story_lens_active_ai_generation_job_id'],
  ['retouch', RetouchPage, 'story_lens_active_ai_retouch_job_id'],
] as const;

describe.each(cases)('%s polling lifecycle', (_name, Page, key) => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ user: { id: 'poll-user' } as never });
    vi.mocked(localStorage.getItem).mockImplementation((name) => name === key || name === `user:poll-user:${key}` ? 'job-1' : null);
  });
  afterEach(() => { vi.mocked(localStorage.getItem).mockReset(); vi.useRealTimers(); });

  it('cancels an in-flight poll on exit, preserves its job, and recovers on return', async () => {
    let finish!: (value: unknown) => void;
    get.mockImplementation((url: string) => url.includes('/image-generations/')
      ? new Promise((resolve) => { finish = resolve; })
      : Promise.resolve({ data: [] }));
    const first = render(<MemoryRouter><Page /></MemoryRouter>);
    await waitFor(() => expect(finish).toBeTypeOf('function'));
    const poll = get.mock.calls.find(([url]) => url.includes('/image-generations/'));
    first.unmount();
    await act(async () => { finish({ data: { status: 'succeeded', photo_id: 'photo-1' } }); });
    expect(navigate).not.toHaveBeenCalled();
    expect(poll?.[1]?.signal.aborted).toBe(true);
    expect(localStorage.removeItem).not.toHaveBeenCalledWith(`user:poll-user:${key}`);
    get.mockImplementation((url: string) => Promise.resolve({ data: url.includes('/image-generations/') ? { status: 'succeeded', photo_id: 'photo-1' } : [] }));
    render(<MemoryRouter><Page /></MemoryRouter>);
    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
  });

  it('clears the pending polling delay on exit', async () => {
    vi.useFakeTimers();
    get.mockImplementation((url: string) => Promise.resolve({ data: url.includes('/image-generations/') ? { status: 'processing' } : [] }));
    const page = render(<MemoryRouter><Page /></MemoryRouter>);
    await act(async () => {});
    expect(get.mock.calls.filter(([url]) => url.includes('/image-generations/'))).toHaveLength(1);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    page.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(get.mock.calls.filter(([url]) => url.includes('/image-generations/'))).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps only the current StrictMode poll active', async () => {
    const finish: Array<(value: unknown) => void> = [];
    get.mockImplementation((url: string) => url.includes('/image-generations/')
      ? new Promise((resolve) => { finish.push(resolve); })
      : Promise.resolve({ data: [] }));
    render(<StrictMode><MemoryRouter><Page /></MemoryRouter></StrictMode>);
    await waitFor(() => expect(finish).toHaveLength(2));
    await act(async () => { finish[0]({ data: { status: 'succeeded', photo_id: 'stale-photo' } }); });
    expect(navigate).not.toHaveBeenCalled();
    await act(async () => { finish[1]({ data: { status: 'succeeded', photo_id: 'current-photo' } }); });
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/gallery/current-photo', expect.anything());
  });
});

 it('retains a submitted template job when its POST completes after leaving the page', async () => {
   vi.clearAllMocks();
   useAuthStore.setState({ user: { id: 'poll-user' } as never });
   const storage = new Map<string, string>();
   vi.mocked(localStorage.getItem).mockImplementation((key) => storage.get(key) ?? null);
   vi.mocked(localStorage.setItem).mockImplementation((key, value) => { storage.set(key, value); });
   const template = { id: 'template-1', name: '테스트 카드', variables: [], default_values: {}, visible_user_fields: [], locale_labels: {}, requires_source_photo: false, aspect_ratio: '4:3' };
   get.mockImplementation((url: string) => Promise.resolve({ data: url.includes('/prompt-templates') ? [template] : [] }));
   let finish!: (value: unknown) => void;
   post.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
   const page = render(<MemoryRouter><TemplatesPage /></MemoryRouter>);
   fireEvent.click(await screen.findByRole('button', { name: /테스트 카드/ }));
   fireEvent.click(screen.getByRole('button', { name: '이미지 만들기' }));
   expect(post).toHaveBeenCalledTimes(1);
   page.unmount();
   await act(async () => { finish({ data: { job_id: 'late-job', status: 'succeeded', photo_id: 'late-photo' } }); });
   expect(localStorage.setItem).toHaveBeenCalledWith('user:poll-user:story_lens_active_ai_generation_job_id', 'late-job');
   expect(navigate).not.toHaveBeenCalled();
   expect(get.mock.calls.filter(([url]) => url.includes('/image-generations/'))).toHaveLength(0);
 });

 describe('template submission recovery before a job id arrives', () => {
   const prefix = 'user:poll-user:';
   const jobKey = `${prefix}story_lens_active_ai_generation_job_id`;
   const requestKey = `${prefix}story_lens_active_ai_generation_request`;
   let saved: Map<string, string>;
   beforeEach(() => {
     vi.clearAllMocks();
     saved = new Map();
     useAuthStore.setState({ user: { id: 'poll-user' } as never });
     vi.mocked(localStorage.getItem).mockImplementation((key) => saved.get(key) ?? null);
     vi.mocked(localStorage.setItem).mockImplementation((key, value) => { saved.set(key, value); });
     vi.mocked(localStorage.removeItem).mockImplementation((key) => { saved.delete(key); });
     const template = { id: 'template-1', name: '테스트 카드', variables: [], default_values: {}, visible_user_fields: [], locale_labels: {}, requires_source_photo: false, aspect_ratio: '4:3' };
     get.mockImplementation((url: string) => Promise.resolve({ data: url.includes('/prompt-templates') ? [template] : [] }));
   });
   afterEach(() => {
     vi.mocked(localStorage.getItem).mockReset();
     vi.mocked(localStorage.setItem).mockReset();
     vi.mocked(localStorage.removeItem).mockReset();
   });
   it('reuses the pending POST on re-entry instead of submitting a second request', async () => {
     let finish!: (value: unknown) => void;
     post.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
     const first = render(<MemoryRouter><TemplatesPage /></MemoryRouter>);
     fireEvent.click(await screen.findByRole('button', { name: /테스트 카드/ }));
     fireEvent.click(screen.getByRole('button', { name: '이미지 만들기' }));
     const persisted = saved.get(requestKey);
     expect(persisted).toBeTruthy();
     first.unmount();
     render(<MemoryRouter><TemplatesPage /></MemoryRouter>);
     fireEvent.click(await screen.findByRole('button', { name: /테스트 카드/ }));
     expect(screen.getByRole('button', { name: '만드는 중...' })).toBeDisabled();
     expect(post).toHaveBeenCalledTimes(1);
     await act(async () => { finish({ data: { job_id: 'recovered-job', status: 'succeeded', photo_id: 'recovered-photo' } }); });
     expect(navigate).toHaveBeenCalledTimes(1);
     expect(navigate).toHaveBeenCalledWith('/gallery/recovered-photo', expect.anything());
   });
   it('recovers a persisted submission after reload using exactly the same request id and payload', async () => {
     const payload = { template_id: 'template-1', variable_values: { color: 'blue' }, source_photo_id: null, provider_options: { aspect_ratio: '4:3', _client_request_id: 'persisted-id' } };
     saved.set(requestKey, JSON.stringify({ requestId: 'persisted-id', payload }));
     post.mockResolvedValue({ data: { job_id: 'persisted-job', status: 'succeeded', photo_id: 'persisted-photo' } });
     render(<StrictMode><MemoryRouter><TemplatesPage /></MemoryRouter></StrictMode>);
     await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
     expect(post).toHaveBeenCalledTimes(1);
     expect(post).toHaveBeenCalledWith('/api/v1/image-generations', payload);
     expect(saved.has(requestKey)).toBe(false);
   });
   it('releases a rejected request so corrected input can be submitted', async () => {
     saved.set(requestKey, JSON.stringify({ requestId: 'invalid-id', payload: { template_id: 'template-1' } }));
     post.mockRejectedValueOnce({ response: { status: 422, data: { detail: 'Invalid option' } } });
     const page = render(<MemoryRouter><TemplatesPage /></MemoryRouter>);
     await waitFor(() => expect(saved.has(requestKey)).toBe(false));
     page.unmount();
   });
   it('does not overwrite a newer request marker and job with an old POST response', async () => {
     let finish!: (value: unknown) => void;
     post.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
     const first = render(<MemoryRouter><TemplatesPage /></MemoryRouter>);
     fireEvent.click(await screen.findByRole('button', { name: /테스트 카드/ }));
     fireEvent.click(screen.getByRole('button', { name: '이미지 만들기' }));
     first.unmount();
     saved.set(requestKey, JSON.stringify({ requestId: 'newer-request', payload: { template_id: 'other-template' } }));
     saved.set(jobKey, 'newer-job');
     await act(async () => { finish({ data: { job_id: 'old-job', status: 'succeeded', photo_id: 'old-photo' } }); });
     expect(saved.get(jobKey)).toBe('newer-job');
     expect(navigate).not.toHaveBeenCalled();
   });
 });
