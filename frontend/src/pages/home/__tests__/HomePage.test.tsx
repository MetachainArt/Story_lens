import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import HomePage from '../index';
import api from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { useCameraStore } from '@/stores/camera';
import type { User } from '@/types/auth';

const mockNavigate = vi.fn();
const mockLogout = vi.fn();
const mockAddPhoto = vi.fn();
const mockSetSessionId = vi.fn();
const mockClearPhotos = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/stores/auth', () => ({ useAuthStore: vi.fn() }));
vi.mock('@/stores/camera', () => ({ useCameraStore: vi.fn() }));
vi.mock('@/services/api', () => ({ default: { post: vi.fn() } }));

const baseUser: User = {
  id: 'user-1',
  email: 'user@example.com',
  name: '지민',
  role: 'student',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
};

function setUser(user: User) {
  vi.mocked(useAuthStore).mockReturnValue({ user, logout: mockLogout } as ReturnType<typeof useAuthStore>);
}

function renderPage() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  );
}

describe('HomePage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setUser(baseUser);
    vi.mocked(useCameraStore).mockReturnValue({
      addPhoto: mockAddPhoto,
      setSessionId: mockSetSessionId,
      clearPhotos: mockClearPhotos,
    } as ReturnType<typeof useCameraStore>);
  });

  it('shows the main creation actions to a regular user', () => {
    renderPage();

    expect(screen.getAllByRole('button', { name: 'AI 이미지 만들기' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'AI사진보정' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '사진 촬영' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '사진 업로드' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '수업 일정 보기' })).toBeInTheDocument();
  });

  it('routes creation and schedule actions to their screens', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getAllByRole('button', { name: 'AI 이미지 만들기' })[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/templates');
    await user.click(screen.getByRole('button', { name: '수업 일정 보기' }));
    expect(mockNavigate).toHaveBeenCalledWith('/sessions');
  });

  it('limits a parent account to viewing the gallery', () => {
    setUser({ ...baseUser, role: 'parent' });
    renderPage();

    expect(screen.queryByRole('button', { name: 'AI 이미지 만들기' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '사진 촬영' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '사진 보기' })).toBeInTheDocument();
  });

  it('shows management actions only to a teacher', () => {
    setUser({
      ...baseUser,
      role: 'teacher',
      can_manage_templates: true,
    });
    renderPage();

    expect(screen.getByRole('button', { name: '학생 사진 보기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'AI 템플릿 관리' })).toBeInTheDocument();
  });

  it('hides template management from a teacher without that permission', () => {
    setUser({ ...baseUser, role: 'teacher', can_manage_templates: false });
    renderPage();

    expect(screen.getByRole('button', { name: '학생 사진 보기' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'AI 템플릿 관리' })).not.toBeInTheDocument();
  });

  it('starts one session and sends selected gallery images to the select page', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { id: 'session-1' } });
    const { container } = renderPage();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const image = new File(['image'], 'memory.jpg', { type: 'image/jpeg' });

    fireEvent.change(input, { target: { files: [image] } });

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/v1/sessions', expect.objectContaining({ date: expect.any(String) }));
      expect(mockClearPhotos).toHaveBeenCalledOnce();
      expect(mockSetSessionId).toHaveBeenCalledWith('session-1');
      expect(mockAddPhoto).toHaveBeenCalledWith(image);
      expect(mockNavigate).toHaveBeenCalledWith('/select');
    });
  });

  it('clears the session and returns to login on logout', async () => {
    const user = userEvent.setup();
    mockLogout.mockResolvedValueOnce(undefined);
    renderPage();

    await user.click(screen.getByRole('button', { name: '로그아웃' }));

    expect(mockLogout).toHaveBeenCalledOnce();
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
});
