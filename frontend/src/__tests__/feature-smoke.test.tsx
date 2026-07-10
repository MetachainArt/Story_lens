import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AiRetouchPage from '@/pages/ai-retouch';
import EditorPage from '@/pages/editor';
import MusicPage from '@/pages/music';
import TemplatesPage from '@/pages/templates';
import api from '@/services/api';
import { AUTH_FLAG_KEY } from '@/constants/auth';
import { useAuthStore } from '@/stores/auth';
import type { Category, PromptTemplate } from '@/types/ai';

const mockNavigate = vi.fn();

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockUser = {
  id: 'user-1',
  email: 'teacher@example.com',
  name: 'Teacher',
  role: 'teacher' as const,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
};

const templateCategory: Category = {
  id: 'category-template',
  name: 'Template',
  slug: 'template',
  kind: 'template',
  description: null,
  sort_order: 1,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const retouchCategory: Category = {
  ...templateCategory,
  id: 'category-retouch',
  name: 'Retouch',
  slug: 'retouch',
  kind: 'retouch',
};

function makeTemplate(overrides: Partial<PromptTemplate> = {}): PromptTemplate {
  return {
    id: 'template-1',
    category_id: templateCategory.id,
    category: templateCategory,
    name: 'Smoke template',
    description: 'Smoke description',
    thumbnail_url: null,
    base_prompt: 'Make a safe image',
    variables: [],
    default_values: {},
    negative_terms: [],
    recommended_age: null,
    locale_labels: {},
    requires_source_photo: false,
    aspect_ratio: '4:3',
    visible_user_fields: [],
    is_public: true,
    is_active: true,
    is_recommended: true,
    example_image_url: null,
    usage_count: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function installBrowserImageMocks() {
  const canvasContext = {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    arcTo: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    strokeRect: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    drawImage: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    measureText: vi.fn(() => ({ width: 120 })),
    set filter(_value: string) {},
    set fillStyle(_value: string) {},
    set strokeStyle(_value: string) {},
    set lineWidth(_value: number) {},
    set shadowColor(_value: string) {},
    set shadowBlur(_value: number) {},
    set font(_value: string) {},
    set textAlign(_value: string) {},
    set textBaseline(_value: string) {},
  };

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    canvasContext as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,AAAA');
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
    callback(new Blob(['image'], { type: 'image/jpeg' }));
  });
  vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
  vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(1200);
  vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(800);

  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['image'], { type: 'image/png' }),
    }),
  );

  vi.stubGlobal(
    'Image',
    class {
      complete = true;
      width = 1200;
      height = 800;
      naturalWidth = 1200;
      naturalHeight = 800;
      crossOrigin = '';
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(_value: string) {
        window.setTimeout(() => this.onload?.(), 0);
      }

      get src() {
        return '';
      }
    },
  );

  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:smoke-image');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
}

describe('current feature smoke tests', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockNavigate.mockClear();
    sessionStorage.clear();
    useAuthStore.setState({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      hasCheckedSession: false,
      error: null,
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('logs in with httpOnly-cookie flow and stores only the safe session marker', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { user: mockUser } });

    await act(async () => {
      await useAuthStore.getState().login('teacher@example.com', 'password123');
    });

    expect(api.post).toHaveBeenCalledWith('/api/auth/login', {
      email: 'teacher@example.com',
      password: 'password123',
    });
    expect(localStorage.setItem).toHaveBeenCalledWith(AUTH_FLAG_KEY, '1');
    expect(localStorage.setItem).not.toHaveBeenCalledWith('access_token', expect.any(String));
    expect(localStorage.setItem).not.toHaveBeenCalledWith('refresh_token', expect.any(String));
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('saves one edited photo and navigates to the saved gallery item', async () => {
    installBrowserImageMocks();
    const user = userEvent.setup();
    sessionStorage.setItem('dev_photo_url', 'data:image/png;base64,AAAA');
    vi.mocked(api.post).mockResolvedValueOnce({ data: { id: 'uploaded-photo-1' } });

    const { container } = render(
      <MemoryRouter initialEntries={['/edit/dev-photo']}>
        <Routes>
          <Route path="/edit/:photoId" element={<EditorPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.load(await screen.findByAltText('편집 중인 사진'));

    const saveButton = await waitFor(() => {
      const button = container.querySelector('header button.story-cta-primary') as HTMLButtonElement | null;
      expect(button).toBeTruthy();
      expect(button).not.toBeDisabled();
      return button!;
    });

    await user.click(saveButton);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/v1/photos', expect.any(FormData));
    });
    expect(mockNavigate).toHaveBeenCalledWith('/gallery/uploaded-photo-1');
  });

  it('creates one music job, polls the result, and saves the generated music URL', async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockResolvedValueOnce({ data: { task_id: 'music-task-1' } });
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        status: 'SUCCESS',
        tracks: [
          {
            id: 'track-1',
            audio_url: 'https://cdn.example.com/music.mp3',
            local_url: '/uploads/music/photo-1/smoke.mp3',
            stream_url: '',
            image_url: '',
            title: 'Smoke track',
            duration: 8,
            tags: 'warm',
          },
        ],
      },
    });
    vi.mocked(api.put).mockResolvedValueOnce({ data: {} });

    render(
      <MemoryRouter initialEntries={[{ pathname: '/music/photo-1', state: { topic: 'picnic' } }]}>
        <Routes>
          <Route path="/music/:photoId" element={<MusicPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /AI 음악 만들기/ }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/v1/music/generate', {
        topic: 'picnic',
        style: expect.any(String),
        mood: expect.any(String),
        draft_text: '',
        photo_id: 'photo-1',
      });
      expect(api.put).toHaveBeenCalledWith('/api/v1/photos/photo-1', {
        music_url: '/uploads/music/photo-1/smoke.mp3',
      });
    });
  });

  it('creates one AI image from a selected template', async () => {
    const user = userEvent.setup();
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url === '/api/v1/categories') return { data: [templateCategory] };
      if (url === '/api/v1/prompt-templates') return { data: [makeTemplate()] };
      return { data: {} };
    });
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        job_id: 'ai-job-1',
        status: 'succeeded',
        photo_id: 'ai-photo-1',
        result_url: '/uploads/photos/ai-photo-1.jpg',
        message: 'ok',
      },
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/templates']}>
        <TemplatesPage />
      </MemoryRouter>,
    );

    const card = await waitFor(() => {
      const element = container.querySelector('button.ai-template-card') as HTMLButtonElement | null;
      expect(element).toBeTruthy();
      return element!;
    });
    await user.click(card);
    const submit = await waitFor(() => {
      const element = container.querySelector('button.ai-submit-button') as HTMLButtonElement | null;
      expect(element).toBeTruthy();
      return element!;
    });
    await user.click(submit);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/v1/image-generations', {
        template_id: 'template-1',
        variable_values: {},
        source_photo_id: null,
        provider_options: { aspect_ratio: '4:3' },
      });
    });
    expect(mockNavigate).toHaveBeenCalledWith('/gallery/ai-photo-1', {
      replace: true,
      state: { fromAiGeneration: true },
    });
  });

  it('shows a login-expired message instead of a deployment warning when retouch authentication fails', async () => {
    vi.mocked(api.get).mockRejectedValue({ response: { status: 401 } });

    render(
      <MemoryRouter initialEntries={['/ai-retouch']}>
        <AiRetouchPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('로그인이 만료됐어요. 다시 로그인해 주세요.')).toBeInTheDocument();
    expect(screen.queryByText(/백엔드 배포 후/)).not.toBeInTheDocument();
  });

  it('retouches one existing gallery photo and saves it as a new generated photo', async () => {
    const user = userEvent.setup();
    const retouchTemplate = makeTemplate({
      id: 'retouch-template-1',
      category_id: retouchCategory.id,
      category: retouchCategory,
      name: 'Retouch smoke',
      requires_source_photo: true,
      locale_labels: { kind: 'retouch' },
    });

    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url === '/api/v1/categories') return { data: [retouchCategory] };
      if (url === '/api/v1/prompt-templates') return { data: [retouchTemplate] };
      if (url === '/api/v1/photos/source-photo-1') {
        return {
          data: {
            id: 'source-photo-1',
            user_id: 'user-1',
            session_id: 'session-1',
            original_url: '/uploads/photos/source.jpg',
            edited_url: null,
            title: null,
            topic: null,
            thumbnail_url: null,
            content: null,
            music_url: null,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
        };
      }
      return { data: {} };
    });
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        job_id: 'retouch-job-1',
        status: 'succeeded',
        photo_id: 'retouched-photo-1',
        result_url: '/uploads/photos/retouched-photo-1.jpg',
        message: 'ok',
      },
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/ai-retouch?sourcePhotoId=source-photo-1']}>
        <Routes>
          <Route path="/ai-retouch" element={<AiRetouchPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const card = await waitFor(() => {
      const element = container.querySelector('button.ai-template-card') as HTMLButtonElement | null;
      expect(element).toBeTruthy();
      return element!;
    });
    await user.click(card);
    const submit = await waitFor(() => {
      const element = container.querySelector('button.ai-submit-button') as HTMLButtonElement | null;
      expect(element).toBeTruthy();
      return element!;
    });
    await user.click(submit);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/v1/image-generations', {
        template_id: 'retouch-template-1',
        variable_values: {},
        source_photo_id: 'source-photo-1',
        source_photo_ids: ['source-photo-1'],
        provider_options: {
          aspect_ratio: '4:3',
          retouch_kind: 'Retouch smoke',
          _client_request_id: expect.any(String),
        },
      });
    });
    expect(mockNavigate).toHaveBeenCalledWith('/gallery/retouched-photo-1', {
      replace: true,
      state: { fromAiGeneration: true, fromAiRetouch: true },
    });
  });
});
