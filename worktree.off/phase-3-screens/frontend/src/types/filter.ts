/**
 * @TASK P3-S4-T1 - Filter Types
 * @SPEC TypeScript types for filter resource
 */

export interface Filter {
  id: number;
  name: string;
  label: string;
  css_filter: string;
  preview_url: string | null;
}

export interface EditHistory {
  id: string;
  photo_id: string;
  filter_name: string | null;
  adjustments: {
    brightness: number;
    contrast: number;
    saturation: number;
    temperature: number;
    sharpness: number;
  };
  crop_data: {
    rotation: number;
    flipX: boolean;
  } | null;
  created_at: string;
}
