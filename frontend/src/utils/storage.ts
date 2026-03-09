export const safeJsonParse = <T>(value: string | null, fallback: T): T => {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export const safeJsonArray = <T>(value: string | null): T[] => {
  const parsed = safeJsonParse<unknown>(value, []);
  return Array.isArray(parsed) ? (parsed as T[]) : [];
};

export const isAllowedImageUrl = (value: string | null): boolean => {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value, window.location.origin);
    if (url.protocol === 'data:') {
      return /^data:image\//i.test(value);
    }
    return ['http:', 'https:', 'blob:'].includes(url.protocol);
  } catch {
    return false;
  }
};

const ABSOLUTE_IMAGE_URL_PATTERN = /^(https?:|data:|blob:)/i;

export const resolveImageUrl = (value: string | null | undefined): string => {
  if (!value) {
    return '';
  }

  if (ABSOLUTE_IMAGE_URL_PATTERN.test(value)) {
    return value;
  }

  const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
  const baseUrl = (configuredApiUrl || window.location.origin).replace(/\/+$/, '');
  const normalizedPath = value.startsWith('/') ? value : `/${value}`;
  return `${baseUrl}${normalizedPath}`;
};
