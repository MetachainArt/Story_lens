import { useEffect, useState } from 'react';
import { createSharpenedCanvas } from '@/utils/sharpness';

interface RenderedImage {
  image: HTMLImageElement;
  amount: number;
  canvas: HTMLCanvasElement | null;
  url: string | null;
  error: string | null;
}

/** Preview and export share the same sharpened source; stale renders are discarded. */
export function useSharpenedImage(image: HTMLImageElement | null, amount: number) {
  const [rendered, setRendered] = useState<RenderedImage | null>(null);

  useEffect(() => {
    if (!image || amount <= 0) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    const fail = () => {
      if (!cancelled) setRendered({ image, amount, canvas: null, url: null, error: '선명도 보정에 실패했어요. 선명도를 낮춘 뒤 다시 시도해 주세요.' });
    };
    // Coalesce slider changes before reading and processing the full-size source.
    const timer = window.setTimeout(() => {
      try {
        const canvas = createSharpenedCanvas(image, amount);
        canvas.toBlob(blob => {
          if (cancelled) return;
          if (!blob) { fail(); return; }
          objectUrl = URL.createObjectURL(blob);
          setRendered({ image, amount, canvas, url: objectUrl, error: null });
        }, 'image/png');
      } catch {
        fail();
      }
    }, 80);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [image, amount]);

  const current = amount > 0 && rendered?.image === image && rendered.amount === amount ? rendered : null;
  return {
    canvas: current?.canvas ?? null,
    previewUrl: current?.url ?? null,
    error: current?.error ?? null,
    isProcessing: amount > 0 && !current,
  };
}
