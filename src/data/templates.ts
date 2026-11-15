export type TemplateId = 'minimal' | 'cinematic' | 'grid';

export interface TemplateOption {
  id: TemplateId;
  label: string;
  description: string;
}

export const templates: TemplateOption[] = [
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Clean typography, restrained motion, content-first layout.',
  },
  {
    id: 'cinematic',
    label: 'Cinematic',
    description: 'Dramatic hero, large type scale, darker spacing.',
  },
  {
    id: 'grid',
    label: 'Grid',
    description: 'Compact, engineering-dashboard feel.',
  },
];
