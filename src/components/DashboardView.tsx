/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileCheck,
  FileText,
  Lightbulb,
  PackageCheck,
  PenTool,
  Plus,
  RefreshCw,
  Rss,
  Send,
} from 'lucide-react';
import { SourceFeed, TopicArticle, AiDraft, SystemLog, AppConfig } from '../types';
import { tasksApi, type ContentTask, type TodayTaskResponse } from '../api/tasks';

interface DashboardViewProps {
  sources: SourceFeed[];
  topics: TopicArticle[];
  drafts: AiDraft[];
  logs: SystemLog[];
  appConfig: AppConfig;
  setActiveTab: (tab: string) => void;
  setSelectedTopicIdForWorkshop: (id: string | null) => void;
  onTaskAction?: (task: ContentTask) => void;
  onFetchToday?: () => void;
}

const taskTypeLabel: Record<ContentTask['type'], string> = {
  FETCH_SOURCE: '内容源抓取',
  REVIEW_SOURCE_ITEM: '候选内容筛选',
  CREATE_TOPIC: '可生成选题',
  GENERATE_ARTICLE: '待生成文章',
  QUALITY_CHECK: '需质量检查',
  EDIT_ARTICLE: '需修改',
  CREATE_PACKAGE: '可生成发布包',
  READY_TO_MANUAL_PUBLISH: '等待手动发布',
};

const priorityLabel: Record<ContentTask['priority'], string> = {
  high: '高',
  medium: '中',
  low: '低',
};

const statusLabel: Record<ContentTask['status'], string> = {
  pending: '待处理',
  blocked: '受阻',
  done: '已完成',
};

function priorityClass(priority: ContentTask['priority']) {
  if (priority === 'high') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (priority === 'medium') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-neutral-200 bg-neutral-50 text-neutral-600';
}

function statusClass(status: ContentTask['status']) {
  if (status === 'done') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'blocked') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-blue-200 bg-blue-50 text-blue-700';
}

function statItems(data: TodayTaskResponse | null) {
  const stats = data?.stats;
  return [
    { label: '已抓取内容数', value: stats?.fetchedItemsToday ?? 0, icon: Rss, tab: 'sources' as string },
    { label: '可用候选内容数', value: stats?.usableSourceItems ?? 0, icon: FileText, tab: 'sources' as string },
    { label: '已生成选题数', value: stats?.topicsToday ?? 0, icon: Lightbulb, tab: 'topics' as string },
    { label: '已生成文章数', value: stats?.articlesToday ?? 0, icon: PenTool, tab: 'workshop' as string },
    { label: '已通过质检文章数', value: stats?.passedQualityArticles ?? 0, icon: FileCheck, tab: 'workshop' as string },
    { label: '已生成发布包数', value: stats?.publishPackagesToday ?? 0, icon: PackageCheck, tab: 'publish' as string },
  ];
}

export default function DashboardView({
  sources,
  topics,
  drafts,
  logs,
  appConfig,
  setActiveTab,
  setSelectedTopicIdForWorkshop,
  onTaskAction,
  onFetchToday,
}: DashboardViewProps) {
  const [todayTasks, setTodayTasks] = useState<TodayTaskResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState('');

  const hasRealData = sources.length > 0 || topics.length > 0 || drafts.length > 0 || logs.length > 0 || appConfig.monthlyTokenUsed > 0;

  const loadTasks = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await tasksApi.today();
      setTodayTasks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '任务加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTasks();
  }, []);

  const handleTaskAction = (task: ContentTask) => {
    if (onTaskAction) {
      onTaskAction(task);
      return;
    }
    if (task.type === 'GENERATE_ARTICLE' && task.relatedEntityType === 'topic') {
      setSelectedTopicIdForWorkshop(task.relatedEntityId);
    }
    setActiveTab(task.actionHref);
  };

  const handleFetchToday = async () => {
    if (!onFetchToday) return;
    setIsFetching(true);
    try {
      await onFetchToday();
      await loadTasks();
    } finally {
      setIsFetching(false);
    }
  };

  const primaryTask = todayTasks?.primaryTask ?? null;
  const pendingTasks = todayTasks?.tasks.filter((task) => task.status !== 'done') ?? [];
  const doneTasks = todayTasks?.tasks.filter((task) => task.status === 'done') ?? [];

  if (!loading && !primaryTask && pendingTasks.length === 0 && !hasRealData) {
    return (
      <div id="dashboard-view-wrapper" className="container mx-auto px-1 py-1">
        <section className="min-h-[460px] bg-white border border-apple-border rounded-[24px] p-8 shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col items-center justify-center text-center space-y-5">
          <div className="h-12 w-12 rounded-2xl bg-apple-bg border border-apple-border flex items-center justify-center">
            <Rss className="h-6 w-6 text-apple-blue" />
          </div>
          <div className="space-y-2">
            <h2 className="text-section-title font-bold text-apple-dark">今天还没有可处理内容</h2>
            <p className="text-body-readable text-apple-muted max-w-md">
              暂无真实内容，先添加内容源，或抓取现有 RSS/URL 内容源。
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => setActiveTab('sources')}
              className="px-4 py-2 rounded-xl bg-apple-blue text-white text-button-readable font-bold flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              <span>添加内容源</span>
            </button>
            <button
              onClick={handleFetchToday}
              disabled={!onFetchToday || isFetching}
              className="px-4 py-2 rounded-xl border border-apple-border bg-white text-apple-dark text-button-readable font-bold flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              <span>抓取现有内容源</span>
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div id="dashboard-view-wrapper" className="space-y-6 container mx-auto px-1 py-1">
      <section className="bg-white border border-apple-border rounded-[24px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-section-title font-bold text-apple-dark">今日内容生产进度</h2>
            <p className="text-caption-readable text-apple-muted mt-1">
              内容源抓取 → 候选内容筛选 → 今日任务生成 → 选题确认 → 文章生成 → 质量检查 → 编辑修订 → 发布包 → dry-run 发布记录
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadTasks}
              disabled={loading}
              className="px-3 py-2 rounded-xl border border-apple-border bg-white text-apple-dark text-button-readable font-bold flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>刷新任务</span>
            </button>
            <button
              onClick={handleFetchToday}
              disabled={!onFetchToday || isFetching}
              className="px-3 py-2 rounded-xl bg-apple-blue text-white text-button-readable font-bold flex items-center gap-1.5 disabled:opacity-50"
            >
              <Rss className={`h-4 w-4 ${isFetching ? 'animate-pulse' : ''}`} />
              <span>{isFetching ? '抓取中' : '抓取今日内容'}</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl border border-rose-100 bg-rose-50 text-rose-700 text-body-readable font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mt-5">
          {statItems(todayTasks).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={() => setActiveTab(item.tab)}
                className="rounded-2xl border border-apple-border bg-apple-bg/35 p-4 text-left hover:border-apple-blue hover:ring-2 hover:ring-blue-100 transition cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <Icon className="h-4 w-4 text-apple-blue" />
                  <span className="text-2xl font-bold text-apple-dark">{item.value}</span>
                </div>
                <div className="mt-2 text-caption-readable font-bold text-apple-muted">{item.label}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Smart workflow suggestions */}
      {!loading && todayTasks && (() => {
        const stats = todayTasks.stats;
        const suggestions: Array<{ icon: typeof Rss; text: string; tab: string; count: number }> = [];
        if (stats.usableSourceItems > 0) suggestions.push({ icon: Lightbulb, text: '个高质量候选内容可生成选题', tab: 'sources', count: stats.usableSourceItems });
        const pendingTopics = pendingTasks.filter((t) => t.type === 'GENERATE_ARTICLE');
        if (pendingTopics.length > 0) suggestions.push({ icon: PenTool, text: '个选题待生成文章', tab: 'topics', count: pendingTopics.length });
        const needQuality = pendingTasks.filter((t) => t.type === 'QUALITY_CHECK');
        if (needQuality.length > 0) suggestions.push({ icon: FileCheck, text: '篇文章待质量检查', tab: 'workshop', count: needQuality.length });
        const canPackage = pendingTasks.filter((t) => t.type === 'CREATE_PACKAGE');
        if (canPackage.length > 0) suggestions.push({ icon: PackageCheck, text: '篇文章可生成发布包', tab: 'workshop', count: canPackage.length });
        const readyPublish = doneTasks.filter((t) => t.type === 'READY_TO_MANUAL_PUBLISH');
        if (readyPublish.length > 0) suggestions.push({ icon: Send, text: '个发布包等待手动发布', tab: 'publish', count: readyPublish.length });
        if (suggestions.length === 0) return null;
        return (
          <section className="bg-white border border-apple-border rounded-[24px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
            <h3 className="text-section-title font-bold text-apple-dark mb-3">下一步建议</h3>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.tab + s.text}
                    onClick={() => setActiveTab(s.tab)}
                    className="px-4 py-2.5 rounded-xl border border-apple-border bg-apple-bg/35 hover:border-apple-blue hover:ring-2 hover:ring-blue-100 text-body-readable font-bold text-apple-dark flex items-center gap-2 transition cursor-pointer"
                  >
                    <Icon className="h-4 w-4 text-apple-blue" />
                    <span>你有 <b className="text-apple-blue">{s.count}</b>{s.text}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-apple-muted" />
                  </button>
                );
              })}
            </div>
          </section>
        );
      })()}

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-1 bg-white border border-apple-border rounded-[24px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-section-title font-bold text-apple-dark">当前最该处理</h3>
            {primaryTask && (
              <span className={`px-2 py-0.5 rounded-lg border text-badge-readable font-bold ${priorityClass(primaryTask.priority)}`}>
                {priorityLabel[primaryTask.priority]}优先级
              </span>
            )}
          </div>
          {primaryTask ? (
            <div className="space-y-4">
              <div>
                <div className="text-badge-readable font-bold text-apple-blue">{taskTypeLabel[primaryTask.type]}</div>
                <h4 className="text-card-title font-bold text-apple-dark mt-1 leading-snug">{primaryTask.title}</h4>
                <p className="text-body-readable text-apple-muted mt-2 leading-relaxed">{primaryTask.description}</p>
              </div>
              <div className="rounded-2xl border border-apple-border bg-apple-bg/40 p-3 text-body-readable text-apple-dark">
                <span className="font-bold">原因：</span>{primaryTask.reason}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleTaskAction(primaryTask)}
                  className="flex-1 px-4 py-2 rounded-xl bg-apple-blue text-white text-button-readable font-bold flex items-center justify-center gap-1.5"
                >
                  <span>{primaryTask.actionLabel}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleTaskAction(primaryTask)}
                  className="px-4 py-2 rounded-xl border border-apple-border bg-white text-apple-dark text-button-readable font-bold"
                >
                  查看详情
                </button>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-apple-muted">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
              <div className="text-body-readable font-bold">当前没有待处理任务</div>
              <div className="text-caption-readable mt-1">可以抓取内容源或查看发布中心。</div>
            </div>
          )}
        </div>

        <div className="xl:col-span-2 bg-white border border-apple-border rounded-[24px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-section-title font-bold text-apple-dark">待处理任务</h3>
              <p className="text-caption-readable text-apple-muted mt-0.5">按优先级排序，只基于真实本地数据生成。</p>
            </div>
            <span className="text-caption-readable font-mono text-apple-muted">{pendingTasks.length} pending / {doneTasks.length} done</span>
          </div>

          <div className="space-y-3">
            {loading && (
              <div className="py-8 text-center text-apple-muted font-semibold">任务加载中...</div>
            )}
            {!loading && pendingTasks.length === 0 && (
              <div className="py-8 text-center text-apple-muted font-semibold">暂无待处理任务。</div>
            )}
            {pendingTasks.map((taskItem) => (
              <div key={taskItem.id} className="rounded-2xl border border-apple-border bg-white hover:bg-apple-bg/30 p-4 transition">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-badge-readable font-bold text-apple-blue">{taskTypeLabel[taskItem.type]}</span>
                      <span className={`px-2 py-0.5 rounded-lg border text-badge-readable font-bold ${priorityClass(taskItem.priority)}`}>
                        {priorityLabel[taskItem.priority]}优先级
                      </span>
                      <span className={`px-2 py-0.5 rounded-lg border text-badge-readable font-bold ${statusClass(taskItem.status)}`}>
                        {statusLabel[taskItem.status]}
                      </span>
                    </div>
                    <h4 className="text-card-title font-bold text-apple-dark mt-1 truncate">{taskItem.title}</h4>
                    <p className="text-caption-readable text-apple-muted mt-1">{taskItem.reason}</p>
                  </div>
                  <button
                    onClick={() => handleTaskAction(taskItem)}
                    className="px-3 py-2 rounded-xl border border-apple-border bg-white hover:bg-apple-bg text-apple-dark text-button-readable font-bold flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <span>{taskItem.actionLabel}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {doneTasks.length > 0 && (
        <section className="bg-white border border-apple-border rounded-[24px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
          <h3 className="text-section-title font-bold text-apple-dark mb-3">已完成记录</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {doneTasks.slice(0, 4).map((taskItem) => (
              <button
                key={taskItem.id}
                onClick={() => handleTaskAction(taskItem)}
                className="text-left rounded-2xl border border-emerald-100 bg-emerald-50/40 p-3 hover:bg-emerald-50 transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-badge-readable font-bold text-emerald-700">{taskTypeLabel[taskItem.type]}</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="text-body-readable font-bold text-apple-dark mt-1 line-clamp-1">{taskItem.title}</div>
                <div className="text-caption-readable text-apple-muted mt-1">发布包已生成，dry-run 已记录，等待手动发布。</div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
