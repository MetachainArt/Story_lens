import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PhotoPrivacyGate from '../PhotoPrivacyGate';
import api from '@/services/api';


const mockLogout = vi.fn();

vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: (selector: (state: { logout: typeof mockLogout }) => unknown) =>
    selector({ logout: mockLogout }),
}));

const status = {
  policy_version: '2026-07-10',
  consent_required: true,
  consented_at: null,
  retention_days: 365,
};

function renderGate() {
  return render(
    <MemoryRouter>
      <PhotoPrivacyGate>
        <p>사진 작업 화면</p>
      </PhotoPrivacyGate>
    </MemoryRouter>,
  );
}

describe('PhotoPrivacyGate', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(api.get).mockResolvedValue({ data: status });
  });

  it('requires an explicit check before accepting photo processing', async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockResolvedValue({
      data: { ...status, consent_required: false, consented_at: '2026-07-10T00:00:00Z' },
    });
    renderGate();

    expect(await screen.findByText('사진 저장과 AI 처리 안내')).toBeInTheDocument();
    const acceptButton = screen.getByRole('button', { name: '동의하고 계속하기' });
    expect(acceptButton).toBeDisabled();

    await user.click(screen.getByRole('checkbox'));
    await user.click(acceptButton);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/v1/users/me/privacy-consent', {
        accepted: true,
      });
    });
    expect(await screen.findByText('사진 작업 화면')).toBeInTheDocument();
  });

  it('opens the photo tool immediately when current consent exists', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { ...status, consent_required: false, consented_at: '2026-07-10T00:00:00Z' },
    });
    renderGate();

    expect(await screen.findByText('사진 작업 화면')).toBeInTheDocument();
  });
});
