import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import api from '@/services/api';
import WritePage from '../index';
vi.mock('@/services/api', () => ({ default: { post: vi.fn(), put: vi.fn() } }));
function renderDraft(content = '보존할 나의 글') {
  render(<MemoryRouter initialEntries={[{ pathname: '/write/photo-1', state: { content, topic: '가족' } }]}>
    <Routes><Route path="/write/:photoId" element={<WritePage />} /></Routes>
  </MemoryRouter>);
}

function pendingResponse() {
  let resolve!: (value: { data: { draft?: string; reply?: string; source?: string } }) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<{ data: { draft?: string; reply?: string; source?: string } }>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
describe('writing failure recovery', () => {
  beforeEach(() => { vi.clearAllMocks(); useAuthStore.setState({ user: { id: 'user-1' } as never }); sessionStorage.clear(); localStorage.clear(); });
  it.each(['provider-error', 'empty-reply'])('keeps existing draft when compilation fails: %s', async (failure) => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockResolvedValueOnce({ data: { reply: '함께한 시간이 좋았구나.' } });
    renderDraft();
    await user.type(screen.getByLabelText('메시지 입력'), '가족과 산책했어');
    await user.click(screen.getByRole('button', { name: '전송' }));
    await screen.findByText('함께한 시간이 좋았구나.');
    if (failure === 'provider-error') vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 503, data: { detail: 'AI 글쓰기를 사용할 수 없어요.' } } });
    else vi.mocked(api.post).mockResolvedValueOnce({ data: { reply: ' ' } });
    await user.click(screen.getByRole('button', { name: '대화로 글 완성하기' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText(/대화 내용으로 글을 완성했어요/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '✏️ 혼자 쓰기' }));
    expect(screen.getByLabelText('작성 본문')).toHaveValue('보존할 나의 글');
  });
  it('keeps existing writing when AI draft generation fails', async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockRejectedValueOnce(new Error('offline'));
    renderDraft();
    await user.click(screen.getByRole('button', { name: '✏️ 혼자 쓰기' }));
    await user.click(screen.getByRole('button', { name: 'AI 글 생성' }));
    await screen.findByText(/기존 글을 유지/);
    expect(screen.getByLabelText('작성 본문')).toHaveValue('보존할 나의 글');
  });
  it.each(['success', 'failure'])('preserves writing added while draft generation is pending: %s', async (result) => {
    const user = userEvent.setup();
    const pending = pendingResponse();
    vi.mocked(api.post).mockReturnValueOnce(pending.promise);
    renderDraft('');
    await user.click(screen.getByRole('button', { name: '✏️ 혼자 쓰기' }));
    await user.click(screen.getByRole('button', { name: 'AI 글 생성' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    await user.type(screen.getByLabelText('작성 본문'), '기다리면서 직접 쓴 소중한 글');

    await act(async () => {
      if (result === 'success') pending.resolve({ data: { draft: '늦게 도착한 AI 초안', source: 'gemini' } });
      else pending.reject(new Error('offline'));
    });

    expect(screen.getByLabelText('작성 본문')).toHaveValue('기다리면서 직접 쓴 소중한 글');
    expect(screen.getByRole('status')).toHaveTextContent(/요청 중.*글.*유지/);
    expect(screen.getByRole('button', { name: 'AI 글 생성' })).toBeEnabled();
  });
  it('keeps a draft deliberately cleared while generation is pending', async () => {
    const user = userEvent.setup();
    const pending = pendingResponse();
    vi.mocked(api.post).mockReturnValueOnce(pending.promise);
    renderDraft();
    await user.click(screen.getByRole('button', { name: '✏️ 혼자 쓰기' }));
    await user.click(screen.getByRole('button', { name: 'AI 글 생성' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    await user.clear(screen.getByLabelText('작성 본문'));
    await act(async () => pending.resolve({ data: { draft: '늦게 도착한 AI 초안' } }));
    expect(screen.getByLabelText('작성 본문')).toHaveValue('');
    expect(screen.getByRole('status')).toHaveTextContent(/요청 중.*글.*유지/);
  });
  it.each(['success', 'failure'])('preserves writing edited while chat compilation is pending: %s', async (result) => {
    const user = userEvent.setup();
    const pending = pendingResponse();
    vi.mocked(api.post)
      .mockResolvedValueOnce({ data: { reply: '함께한 시간이 좋았구나.' } })
      .mockReturnValueOnce(pending.promise);
    renderDraft();
    await user.type(screen.getByLabelText('메시지 입력'), '가족과 산책했어');
    await user.click(screen.getByRole('button', { name: '전송' }));
    await screen.findByText('함께한 시간이 좋았구나.');
    await user.click(screen.getByRole('button', { name: '대화로 글 완성하기' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    await user.click(screen.getByRole('button', { name: '✏️ 혼자 쓰기' }));
    await user.clear(screen.getByLabelText('작성 본문'));
    await user.type(screen.getByLabelText('작성 본문'), '새로 고친 나의 이야기');

    await act(async () => {
      if (result === 'success') pending.resolve({ data: { reply: '늦게 도착한 완성된 글' } });
      else pending.reject(new Error('offline'));
    });

    expect(screen.getByLabelText('작성 본문')).toHaveValue('새로 고친 나의 이야기');
    if (result === 'success') expect(screen.getByRole('status')).toHaveTextContent(/요청 중.*글.*유지/);
    else expect(screen.getByRole('alert')).toHaveTextContent(/유지/);
  });
  it('restores failed chat input without inventing an AI response', async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 503, data: { detail: 'AI 글쓰기를 사용할 수 없어요.' } } });
    renderDraft();
    await user.type(screen.getByLabelText('메시지 입력'), '우리 가족 이야기');
    await user.click(screen.getByRole('button', { name: '전송' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('AI 글쓰기를 사용할 수 없어요.');
    expect(screen.getByLabelText('메시지 입력')).toHaveValue('우리 가족 이야기');
    expect(screen.queryByText('잠깐 생각 중이야... 다시 말해줄래? 😊')).not.toBeInTheDocument();
  });
});
