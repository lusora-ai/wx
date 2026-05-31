import { apiRequest } from './client';
import type { ArticleImageSlot } from '../types';

export type UpdateImageSlotInput = Partial<Pick<
  ArticleImageSlot,
  'promptZh' | 'promptEn' | 'negativePrompt' | 'aspectRatio' | 'stylePreset' | 'altText' | 'status'
>>;

export const imageSlotsApi = {
  list: (articleId: string) => apiRequest<ArticleImageSlot[]>(`/api/articles/${articleId}/image-slots`),
  generate: (articleId: string) => apiRequest<ArticleImageSlot[]>(`/api/articles/${articleId}/image-slots/generate`, { method: 'POST' }),
  update: (slotId: string, input: UpdateImageSlotInput) =>
    apiRequest<ArticleImageSlot>(`/api/image-slots/${slotId}`, { method: 'PATCH', body: JSON.stringify(input) }),
  regeneratePrompt: (slotId: string) =>
    apiRequest<ArticleImageSlot>(`/api/image-slots/${slotId}/regenerate-prompt`, { method: 'POST' }),
  skip: (slotId: string) =>
    apiRequest<ArticleImageSlot>(`/api/image-slots/${slotId}/skip`, { method: 'POST' }),
};
