const imageFileNamePattern = /\.(jpe?g|png|gif|webp|heic|heif)$/i;

export function isLikelyImageFile(file: File | Blob): boolean {
  if (file.type.startsWith('image/')) {
    return true;
  }

  if ('name' in file && typeof file.name === 'string') {
    return imageFileNamePattern.test(file.name);
  }

  return false;
}

export function inferImageMimeType(file: File): string {
  if (file.type.startsWith('image/')) {
    return file.type;
  }

  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith('.png')) return 'image/png';
  if (lowerName.endsWith('.gif')) return 'image/gif';
  if (lowerName.endsWith('.webp')) return 'image/webp';
  if (lowerName.endsWith('.heic') || lowerName.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

export function isHeicImageFile(file: File): boolean {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return type.includes('heic') || type.includes('heif') || name.endsWith('.heic') || name.endsWith('.heif');
}
