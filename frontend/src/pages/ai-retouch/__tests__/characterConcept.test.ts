import { describe, expect, it } from 'vitest';
import type { PromptTemplate } from '@/types/ai';
import {
  orderRetouchTemplates,
  requiredVariablesComplete,
  visibleVariables,
} from '../templateVariables';

const characterTemplate = {
  id: 'character-template',
  category_id: 'retouch',
  category: null,
  name: '영화·애니 의상 변신',
  description: '작품과 캐릭터 분위기로 변신해요.',
  thumbnail_url: null,
  base_prompt: '{work_title} {character_name}',
  variables: [
    {
      key: 'work_title',
      label: '애니메이션·영화 제목',
      input_type: 'text',
      choices: [],
      default_value: '',
      required: true,
      helper_text: '작품명을 적어 주세요.',
    },
    {
      key: 'character_name',
      label: '캐릭터 이름',
      input_type: 'text',
      choices: [],
      default_value: '',
      required: true,
      helper_text: '캐릭터명을 적어 주세요.',
    },
  ],
  default_values: {},
  negative_terms: [],
  recommended_age: '전체',
  locale_labels: { kind: 'retouch', character_inspired_mode: true },
  requires_source_photo: true,
  aspect_ratio: '4:3',
  visible_user_fields: ['work_title', 'character_name'],
  is_public: true,
  is_active: true,
  is_recommended: true,
  example_image_url: null,
  usage_count: 0,
  created_at: '',
  updated_at: '',
} satisfies PromptTemplate;

describe('character concept retouch variables', () => {
  it('shows text variables even when they have no choices', () => {
    expect(visibleVariables(characterTemplate).map((item) => item.key)).toEqual([
      'work_title',
      'character_name',
    ]);
  });

  it('requires both the work and character names', () => {
    expect(requiredVariablesComplete(characterTemplate, {})).toBe(false);
    expect(requiredVariablesComplete(characterTemplate, { work_title: '겨울 왕국' })).toBe(false);
    expect(requiredVariablesComplete(characterTemplate, {
      work_title: '겨울 왕국',
      character_name: '엘사',
    })).toBe(true);
  });

  it('keeps the character concept card in the first position', () => {
    const otherTemplate = { ...characterTemplate, id: 'other-template', name: '키 늘리기' };
    expect(orderRetouchTemplates([otherTemplate, characterTemplate])[0]?.name).toBe(
      '영화·애니 의상 변신',
    );
  });
});
