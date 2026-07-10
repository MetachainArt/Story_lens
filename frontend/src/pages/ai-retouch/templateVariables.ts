import type { PromptTemplate, TemplateVariable } from '@/types/ai';

export type TemplateValues = Record<string, string>;
export const CHARACTER_CONCEPT_TEMPLATE_NAME = '영화·애니 의상 변신';

export function orderRetouchTemplates(templates: PromptTemplate[]): PromptTemplate[] {
  return [...templates].sort((left, right) => {
    const leftPriority = left.name === CHARACTER_CONCEPT_TEMPLATE_NAME ? 0 : 1;
    const rightPriority = right.name === CHARACTER_CONCEPT_TEMPLATE_NAME ? 0 : 1;
    return leftPriority - rightPriority;
  });
}

export function visibleVariables(template: PromptTemplate | null): TemplateVariable[] {
  if (!template) return [];
  const allowedKeys = template.visible_user_fields ?? [];
  return template.variables.filter((item) => allowedKeys.includes(item.key));
}

export function requiredVariablesComplete(
  template: PromptTemplate | null,
  values: TemplateValues,
): boolean {
  return visibleVariables(template).every(
    (variable) => !variable.required || String(values[variable.key] ?? '').trim().length > 0,
  );
}
