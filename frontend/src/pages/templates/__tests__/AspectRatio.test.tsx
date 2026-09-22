import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import TemplatesPage from '../index';
import api from '@/services/api';
import { useAuthStore } from '@/stores/auth';
vi.mock('@/services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: { id: 'square-user' } as never });
  vi.mocked(localStorage.getItem).mockReturnValue(null);
});
it('preserves a square template aspect ratio in the generation request', async () => {
  const template = { id: 'square', name: '정사각 스티커', variables: [], default_values: {}, visible_user_fields: [], requires_source_photo: false, aspect_ratio: '1:1' };
  vi.mocked(api.get).mockImplementation(async (url) => ({ data: url.includes('prompt-templates') ? [template] : [] }));
  vi.mocked(api.post).mockReturnValue(new Promise(() => {}));
  render(<MemoryRouter><TemplatesPage /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: /정사각 스티커/ }));
  fireEvent.click(screen.getByRole('button', { name: '이미지 만들기' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/image-generations', expect.objectContaining({ provider_options: expect.objectContaining({ aspect_ratio: '1:1' }) })));
});
