import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import EditorPage from '../index';
import api from '@/services/api';
import { useEditorStore } from '@/stores/editor';

vi.mock('@/services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

const drawImage = vi.fn();
const putImageData = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  useEditorStore.getState().reset();
  vi.mocked(api.get).mockImplementation(async (url) => ({ data: url.includes('/photos/') ? {
    id: 'sharp-photo', original_url: 'https://example.test/source.png', edited_url: null,
  } : [] }));
  vi.mocked(api.post).mockResolvedValue({ data: {} });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage, putImageData,
    getImageData: () => ({ width: 4, height: 1, data: new Uint8ClampedArray([80, 80, 80, 255, 80, 80, 80, 255, 120, 120, 120, 255, 120, 120, 120, 255]) }),
    save: vi.fn(), restore: vi.fn(), translate: vi.fn(), rotate: vi.fn(), scale: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => {
    queueMicrotask(() => callback(new Blob(['sharpened'], { type: 'image/png' })));
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,AAAA');
  vi.spyOn(URL, 'createObjectURL').mockReturnValueOnce('blob:original').mockReturnValue('blob:sharpened');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['original']) }));
  vi.stubGlobal('Image', class {
    complete = true; naturalWidth = 4; naturalHeight = 1; crossOrigin = '';
    onload: (() => void) | null = null;
    set src(_value: string) { queueMicrotask(() => this.onload?.()); }
  });
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('shows the sharpened pixels and uses that same canvas when saving', async () => {
  render(<MemoryRouter initialEntries={['/edit/sharp-photo']}><Routes>
    <Route path="/edit/:photoId" element={<EditorPage />} />
    <Route path="/gallery/:photoId" element={<p>저장 결과</p>} />
  </Routes></MemoryRouter>);
  await screen.findByAltText('편집 중인 사진');
  fireEvent.click(screen.getByRole('button', { name: '보정' }));
  fireEvent.change(screen.getByRole('slider', { name: /^선명도/ }), { target: { value: '50' } });
  await waitFor(() => expect(screen.getByAltText('편집 중인 사진')).toHaveAttribute('src', 'blob:sharpened'));
  expect(putImageData.mock.calls[0][0].data[4]).toBe(60);
  drawImage.mockClear();
  fireEvent.click(screen.getAllByRole('button', { name: '저장하기' })[0]);
  await screen.findByText('저장 결과');
  expect(drawImage).toHaveBeenCalledWith(expect.any(HTMLCanvasElement), 0, 0, 4, 1, -2, -0.5, 4, 1);
});
