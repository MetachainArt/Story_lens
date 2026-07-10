import { describe, expect, it, vi } from 'vitest';

import { captureVideoFrame } from '../capture';

describe('captureVideoFrame', () => {
  it('draws the video at its native size and returns a JPEG blob', async () => {
    const video = { videoWidth: 1920, videoHeight: 1080 } as HTMLVideoElement;
    const context = { drawImage: vi.fn() };
    const resultBlob = new Blob(['frame'], { type: 'image/jpeg' });
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
      toBlob: vi.fn((callback: BlobCallback) => callback(resultBlob)),
    } as unknown as HTMLCanvasElement;

    const result = await captureVideoFrame(video, () => canvas);

    expect(canvas.width).toBe(1920);
    expect(canvas.height).toBe(1080);
    expect(context.drawImage).toHaveBeenCalledWith(video, 0, 0, 1920, 1080);
    expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.9);
    expect(result).toBe(resultBlob);
  });

  it('returns null when a 2D canvas context is unavailable', async () => {
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => null),
    } as unknown as HTMLCanvasElement;

    await expect(
      captureVideoFrame({ videoWidth: 0, videoHeight: 0 } as HTMLVideoElement, () => canvas),
    ).resolves.toBeNull();
    expect(canvas.width).toBe(1280);
    expect(canvas.height).toBe(720);
  });
});
