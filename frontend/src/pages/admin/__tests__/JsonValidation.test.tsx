import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AssetsPage from '../assets';
import PresetsPage from '../presets';
import api from '@/services/api';
vi.mock('@/services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
describe.each([['assets', AssetsPage, 'payload JSON'], ['presets', PresetsPage, 'values JSON']] as const)('%s invalid JSON', (_name, Page, placeholder) => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(api.get).mockResolvedValue({ data: [] }); });
  it('keeps invalid authored JSON and does not save an empty replacement', async () => {
    render(<MemoryRouter><Page /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText('시스템 이름'), { target: { value: 'test' } });
    fireEvent.change(screen.getByPlaceholderText('사용자 표시 이름'), { target: { value: '테스트' } });
    fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value: '{"brightness": 10,}' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByText(/JSON.*올바르지/)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
    expect(api.put).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText(placeholder)).toHaveValue('{"brightness": 10,}');
  });

  it.each([false, true])('reports successful save separately when list refresh fails (editing=%s)', async (editing) => {
    const item = { id: 'item-1', name: 'saved', label: '저장 항목', asset_type: 'sticker', payload: {}, values: {}, css_filter: 'none', is_active: true, is_public: true };
    vi.mocked(api.get).mockResolvedValueOnce({ data: editing ? [item] : [] }).mockRejectedValueOnce(new Error('list unavailable'));
    vi.mocked(api.post).mockResolvedValue({ data: item });
    vi.mocked(api.put).mockResolvedValue({ data: item });
    render(<MemoryRouter><Page /></MemoryRouter>);
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
    if (editing) fireEvent.click(await screen.findByRole('button', { name: /저장 항목/ }));
    fireEvent.change(screen.getByPlaceholderText('시스템 이름'), { target: { value: 'saved' } });
    fireEvent.change(screen.getByPlaceholderText('사용자 표시 이름'), { target: { value: '저장 항목' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByText(/저장은 완료.*목록/)).toBeInTheDocument();
    expect(screen.queryByText(/저장하지 못했어요/)).not.toBeInTheDocument();
    expect(editing ? api.put : api.post).toHaveBeenCalledTimes(1);
  });
});
