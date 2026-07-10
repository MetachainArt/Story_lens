export type CanvasFactory = () => HTMLCanvasElement;

export async function captureVideoFrame(
  video: HTMLVideoElement,
  createCanvas: CanvasFactory = () => document.createElement('canvas'),
): Promise<Blob | null> {
  const canvas = createCanvas();
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  const context = canvas.getContext('2d');
  if (!context) return null;

  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', 0.9);
  });
}
