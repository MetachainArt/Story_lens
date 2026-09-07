type PixelBuffer = Pick<ImageData, 'data' | 'width' | 'height'>;

/** Increase local edge contrast. Keep only original neighbouring rows in memory. */
export function sharpenPixels(image: PixelBuffer, amount: number): void {
  const strength = Math.max(0, Math.min(50, amount)) / 100;
  if (!Number.isFinite(strength) || strength === 0 || image.width === 0 || image.height === 0) return;
  const { data, width, height } = image;
  const stride = width * 4;
  let previous = data.slice(0, stride);
  let current = previous.slice();
  let next = data.slice(stride, stride * 2);

  for (let y = 0; y < height; y += 1) {
    if (y === height - 1) next = current;
    for (let x = 0; x < width; x += 1) {
      const center = x * 4;
      if (current[center + 3] === 0) continue;
      const left = Math.max(0, x - 1) * 4;
      const right = Math.min(width - 1, x + 1) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const value = current[center + channel];
        const contrast =
          (value - current[left + channel]) * (current[left + 3] / 255) +
          (value - current[right + channel]) * (current[right + 3] / 255) +
          (value - previous[center + channel]) * (previous[center + 3] / 255) +
          (value - next[center + channel]) * (next[center + 3] / 255);
        data[y * stride + center + channel] = value + strength * contrast;
      }
    }
    previous = current;
    current = next;
    next = data.slice((y + 2) * stride, (y + 3) * stride);
  }
}

export function createSharpenedCanvas(image: HTMLImageElement, amount: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('사진 보정을 준비하지 못했어요. 다시 시도해 주세요.');
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  sharpenPixels(pixels, amount);
  context.putImageData(pixels, 0, 0);
  return canvas;
}
