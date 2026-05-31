import { apiRequest } from './client';

export type ContentTaskType =
  | 'FETCH_SOURCE'
  | 'REVIEW_SOURCE_ITEM'
  | 'CREATE_TOPIC'
  | 'GENERATE_ARTICLE'
  | 'QUALITY_CHECK'
  | 'EDIT_ARTICLE'
  | 'CREATE_PACKAGE'
  | 'READY_TO_MANUAL_PUBLISH';

export type ContentTask = {
  id: string;
  type: ContentTaskType;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'blocked' | 'done';
  relatedEntityType: 'source' | 'sourceItem' | 'topic' | 'article' | 'publishTask';
  relatedEntityId: string;
  actionLabel: string;
  actionHref: string;
  actionPayload?: {
    tab: string;
    sourceId?: string;
    sourceItemId?: string;
    topicId?: string;
    articleId?: string;
    publishTaskId?: string;
  };
  reason: string;
  derivedAt: string;
};

export type TodayTaskStats = {
  fetchedItemsToday: number;
  usableSourceItems: number;
  topicsToday: number;
  articlesToday: number;
  passedQualityArticles: number;
  publishPackagesToday: number;
};

export type TodayTaskResponse = {
  stats: TodayTaskStats;
  primaryTask: ContentTask | null;
  tasks: ContentTask[];
};

export const tasksApi = {
  today: () => apiRequest<TodayTaskResponse>('/api/tasks/today'),
};
