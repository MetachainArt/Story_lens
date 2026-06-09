export interface Category {
  id: string;
  name: string;
  slug: string;
  kind: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TemplateVariable {
  key: string;
  label: string;
  input_type: 'choice' | 'text' | 'textarea' | string;
  choices: string[];
  default_value: string | null;
  required: boolean;
  helper_text?: string | null;
}

export interface PromptTemplate {
  id: string;
  category_id: string | null;
  category?: Category | null;
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  base_prompt: string;
  variables: TemplateVariable[];
  default_values: Record<string, string>;
  negative_terms: string[];
  recommended_age: string | null;
  locale_labels: Record<string, unknown>;
  requires_source_photo: boolean;
  aspect_ratio: string;
  visible_user_fields: string[];
  is_public: boolean;
  is_active: boolean;
  is_recommended: boolean;
  example_image_url: string | null;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreativeAsset {
  id: string;
  category_id: string | null;
  asset_type: 'frame' | 'sticker' | 'emoji' | 'speech' | 'text' | string;
  name: string;
  label: string;
  asset_url: string | null;
  preview_url: string | null;
  payload: Record<string, unknown>;
  is_public: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface AdjustmentPreset {
  id: string;
  name: string;
  label: string;
  css_filter: string;
  values: Record<string, unknown>;
  preview_url: string | null;
  is_public: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface ImageGenerationResponse {
  job_id: string;
  status: 'processing' | 'succeeded' | 'failed' | string;
  photo_id: string | null;
  result_url: string | null;
  message: string;
}

export interface ImageGenerationJob {
  id: string;
  status: 'processing' | 'succeeded' | 'failed' | string;
  provider: string;
  provider_model: string;
  template_id: string;
  photo_id: string | null;
  result_url: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateUsage {
  template_id: string;
  template_name: string;
  usage_count: number;
  last_used_at: string | null;
}
