import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useSharpenedImage } from '@/hooks/useSharpenedImage';

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it('discards outdated previews and releases image URLs on reset and unmount', () => {
  vi.useFakeTimers();
  const callbacks: BlobCallback[] = [];
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(), putImageData: vi.fn(),
    getImageData: () => ({ width: 1, height: 1, data: new Uint8ClampedArray([90, 90, 90, 255]) }),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => callbacks.push(callback));
  const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:latest');
  const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  const image = { naturalWidth: 1, naturalHeight: 1 } as HTMLImageElement;
  const { result, rerender, unmount } = renderHook(({ amount }) => useSharpenedImage(image, amount), { initialProps: { amount: 20 } });
  act(() => vi.advanceTimersByTime(80));
  rerender({ amount: 50 });
  act(() => callbacks[0](new Blob(['old'])));
  expect(createUrl).not.toHaveBeenCalled();
  expect(result.current.isProcessing).toBe(true);
  act(() => vi.advanceTimersByTime(80));
  act(() => callbacks[1](new Blob(['new'])));
  expect(result.current.previewUrl).toBe('blob:latest');
  expect(result.current.canvas).toBeInstanceOf(HTMLCanvasElement);
  rerender({ amount: 0 });
  expect(result.current.isProcessing).toBe(false);
  expect(result.current.canvas).toBeNull();
  expect(revokeUrl).toHaveBeenCalledWith('blob:latest');
  rerender({ amount: 30 });
  act(() => vi.advanceTimersByTime(80));
  unmount();
  act(() => callbacks[2](new Blob(['late'])));
  expect(createUrl).toHaveBeenCalledTimes(1);
});
