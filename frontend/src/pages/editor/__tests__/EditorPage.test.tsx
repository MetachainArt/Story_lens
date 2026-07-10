import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import EditorPage from '../index';
import { useEditorStore } from '@/stores/editor';

const mockNavigate = vi.fn();

vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function installImageMocks() {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['image'], { type: 'image/jpeg' }),
    }),
  );
  vi.stubGlobal(
    'Image',
    class {
      complete = true;
      naturalWidth = 1200;
      naturalHeight = 800;
      width = 1200;
      height = 800;
      crossOrigin = '';
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    },
  );
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:editor-photo');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
  vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(1200);
  vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(800);
}

function renderEditor() {
  return render(
    <MemoryRouter initialEntries={['/edit/dev-photo']}>
      <Routes>
        <Route path="/edit/:photoId" element={<EditorPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('EditorPage controls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    useEditorStore.getState().reset();
    sessionStorage.setItem('dev_photo_url', 'data:image/jpeg;base64,AAAA');
    installImageMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders the current four-tab editor and a ready photo', async () => {
    renderEditor();

    expect(await screen.findByRole('heading', { name: '사진 편집' })).toBeInTheDocument();
    expect(screen.getByAltText('편집 중인 사진')).toBeInTheDocument();
    for (const name of ['필터', '보정', '자르기', '꾸미기']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('applies a filter and enables undo', async () => {
    const user = userEvent.setup();
    renderEditor();
    const image = await screen.findByAltText('편집 중인 사진');

    await user.click(screen.getByRole('button', { name: '따뜻함' }));

    expect(image).toHaveStyle({ filter: 'brightness(1.1) saturate(1.25) sepia(0.18)' });
    expect(screen.getByRole('button', { name: '↶ 되돌리기' })).toBeEnabled();
  });

  it('updates brightness from the adjustment panel', async () => {
    const user = userEvent.setup();
    renderEditor();
    await screen.findByAltText('편집 중인 사진');

    await user.click(screen.getByRole('button', { name: '보정' }));
    const brightness = screen.getByRole('slider', { name: /^밝기/ });
    fireEvent.change(brightness, { target: { value: '20' } });

    expect(brightness).toHaveValue('20');
  });

  it('shows zoom and angle values and restores their defaults', async () => {
    const user = userEvent.setup();
    renderEditor();
    await screen.findByAltText('편집 중인 사진');
    await user.click(screen.getByRole('button', { name: '자르기' }));

    const zoom = screen.getByRole('slider', { name: '확대 100%' });
    const angle = screen.getByRole('slider', { name: '각도 0도' });
    fireEvent.change(zoom, { target: { value: '1.5' } });
    fireEvent.change(angle, { target: { value: '30' } });
    expect(screen.getByRole('slider', { name: '확대 150%' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: '각도 30도' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '초기화' }));
    expect(screen.getByRole('slider', { name: '확대 100%' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: '각도 0도' })).toBeInTheDocument();
  });

  it('adds a decoration and changes its size on mobile-friendly controls', async () => {
    const user = userEvent.setup();
    renderEditor();
    await screen.findByAltText('편집 중인 사진');
    await user.click(screen.getByRole('button', { name: '꾸미기' }));
    await user.click(screen.getByRole('button', { name: /하트/ }));

    const size = screen.getByRole('slider', { name: '하트 크기' });
    fireEvent.change(size, { target: { value: '2' } });
    expect(size).toHaveValue('2');
    expect(screen.getByRole('slider', { name: '가로' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: '세로' })).toBeInTheDocument();
  });

  it('undoes and redoes the latest edit', async () => {
    const user = userEvent.setup();
    renderEditor();
    await screen.findByAltText('편집 중인 사진');
    await user.click(screen.getByRole('button', { name: '따뜻함' }));

    await user.click(screen.getByRole('button', { name: '↶ 되돌리기' }));
    expect(screen.getByRole('button', { name: '↷ 다시 실행' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: '↷ 다시 실행' }));

    await waitFor(() => {
      expect(useEditorStore.getState().filterCss).toBe(
        'brightness(1.1) saturate(1.25) sepia(0.18)',
      );
    });
  });

  it('returns to the previous screen from the header', async () => {
    const user = userEvent.setup();
    renderEditor();
    await screen.findByAltText('편집 중인 사진');

    await user.click(screen.getByRole('button', { name: '뒤로 가기' }));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});
