/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Archive,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FileText,
  Lightbulb,
  PenTool,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import type { AiDraft, TopicArticle } from '../types';

interface TopicWorkbenchViewProps {
  topics: TopicArticle[];
  drafts: AiDraft[];
  selectedTopicId?: string | null;
  onPushToWorkshop: (id: string) => void;
  onArchiveTopic: (id: string) => void;
  onOpenDraftLibrary: (draftId: string) => void;
  setActiveTab: (tab: string) => void;
  setSelectedTopicIdForWorkshop: (id: string | null) => void;
}

const TEST_PATTERNS = ['[DEV]', '[TEST]', '[MOCK]', 'E2E'];

function isTestTopic(topic: TopicArticle): boolean {
  const fields = [topic.title, topic.originalTitle, topic.translatedTitle, topic.summary].filter(Boolean);
  return fields.some((field) => TEST_PATTERNS.some((pattern) => field.includes(pattern)));
}

function audienceLabel(key: string) {
  if (key === 'officeWorker') return '打工人';
  if (key === 'student') return '大学生';
  if (key === 'freelancer') return '自由职业者';
  return key;
}

export default function TopicWorkbenchView({
  topics,
  drafts,
  selectedTopicId,
  onPushToWorkshop,
  onArchiveTopic,
  onOpenDraftLibrary,
  setActiveTab,
  setSelectedTopicIdForWorkshop,
}: TopicWorkbenchViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [minHotScore, setMinHotScore] = useState(0);
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null);

  // Show all non-test topics (sourceItemId is not required)
  const queueTopics = topics.filter((topic) => !isTestTopic(topic));
  const categories = ['ALL', ...Array.from(new Set(queueTopics.map((topic) => topic.category)))];

  const filteredTopics = queueTopics.filter((topic) => {
    const keyword = searchTerm.toLowerCase();
    const matchesSearch =
      topic.translatedTitle.toLowerCase().includes(keyword) ||
      topic.originalTitle.toLowerCase().includes(keyword) ||
      topic.summary.toLowerCase().includes(keyword);
    const matchesCategory = selectedCategory === 'ALL' || topic.category === selectedCategory;
    const matchesHot = topic.hotScore >= minHotScore;
    return matchesSearch && matchesCategory && matchesHot;
  });

  useEffect(() => {
    if (!selectedTopicId) return;
    window.setTimeout(() => {
      document.getElementById(`topic-card-${selectedTopicId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  }, [selectedTopicId, filteredTopics.length]);

  const getDraft = (topicId: string) => drafts.find((draft) => draft.topicId === topicId);

  const getWorkflowStatus = (topic: TopicArticle) => {
    const draft = getDraft(topic.id);
    if (!draft) return { label: '待送写作工坊', icon: PenTool };
    if (draft.status === 'approved' || draft.status === 'exported' || draft.status === 'synced') return { label: '已进入草稿库', icon: CheckCircle2 };
    if (draft.status === 'review_pending' || draft.status === 'pending_review') return { label: '需质检', icon: FileText };
    return { label: '已生成文章', icon: FileText };
  };

  const openWorkshop = (topicId: string) => {
    setSelectedTopicIdForWorkshop(topicId);
    setActiveTab('workshop');
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('ALL');
    setMinHotScore(0);
  };

  const hasActiveFilters = searchTerm || selectedCategory !== 'ALL' || minHotScore > 0;

  return (
    <div id="topics-view-wrapper" className="space-y-6 container mx-auto px-1 py-1">
      <section className="bg-white border border-apple-border rounded-[24px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-section-title font-bold text-apple-dark">选题队列</h2>
            <p className="text-caption-readable text-apple-muted mt-1">
              显示所有真实选题，不显示测试数据。
            </p>
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-apple-muted" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="搜索选题、来源、摘要..."
                className="w-full pl-9 pr-4 py-2.5 bg-apple-bg border border-apple-border focus:bg-white rounded-xl text-body-readable outline-none font-medium text-apple-dark placeholder-apple-muted"
              />
            </div>
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-apple-muted" />
              <span className="text-meta-readable font-semibold text-apple-muted">热度</span>
              <input
                type="range"
                min="0"
                max="90"
                value={minHotScore}
                onChange={(event) => setMinHotScore(Number(event.target.value))}
                className="w-24 h-1 bg-[#E5E5E7] rounded-lg appearance-none cursor-pointer accent-apple-blue"
              />
              <span className="font-mono text-body-readable font-bold text-apple-dark">{minHotScore}+</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1.5 rounded-xl border text-body-readable font-bold whitespace-nowrap ${
                selectedCategory === category
                  ? 'bg-apple-blue text-white border-[#0066CC]'
                  : 'bg-white text-apple-dark border-apple-border hover:bg-apple-bg'
              }`}
            >
              {category === 'ALL' ? '全部领域' : category}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        {filteredTopics.length === 0 ? (
          <div className="p-12 text-center bg-white border border-apple-border rounded-[24px] flex flex-col items-center justify-center space-y-3">
            <Lightbulb className="h-8 w-8 text-apple-muted/65" />
            {queueTopics.length === 0 ? (
              <>
                <h4 className="text-card-title font-bold text-apple-dark">还没有选题</h4>
                <p className="text-meta-readable text-apple-muted">请先在内容源中心添加内容源并抓取，然后生成选题。</p>
                <button
                  onClick={() => setActiveTab('sources')}
                  className="px-4 py-2 rounded-xl bg-apple-blue text-white text-button-readable font-bold"
                >
                  去内容源中心
                </button>
              </>
            ) : hasActiveFilters ? (
              <>
                <h4 className="text-card-title font-bold text-apple-dark">当前筛选条件下没有选题</h4>
                <p className="text-meta-readable text-apple-muted">共 {queueTopics.length} 个选题，但不匹配当前筛选条件。</p>
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 rounded-xl border border-apple-border bg-white text-apple-dark text-button-readable font-bold"
                >
                  清空筛选
                </button>
              </>
            ) : (
              <>
                <h4 className="text-card-title font-bold text-apple-dark">暂无真实选题队列</h4>
                <p className="text-meta-readable text-apple-muted">请先在候选内容池从 SourceItem 生成选题。</p>
              </>
            )}
          </div>
        ) : (
          filteredTopics.map((topic) => {
            const draft = getDraft(topic.id);
            const status = getWorkflowStatus(topic);
            const StatusIcon = status.icon;
            const targetAudiences = (topic.targetAudiences || []).map(audienceLabel).join(' / ') || '待定';
            const isSourceExpanded = expandedSourceId === topic.id;
            const rawContentPreview = topic.rawContent?.slice(0, 600) || '';
            const hasMoreContent = (topic.rawContent?.length || 0) > 600;

            return (
              <article
                key={topic.id}
                id={`topic-card-${topic.id}`}
                className={`bg-white border rounded-[24px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-4 ${
                  selectedTopicId === topic.id ? 'border-apple-blue ring-2 ring-blue-100' : 'border-apple-border'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-badge-readable font-bold px-2 py-0.5 rounded bg-apple-dark text-white">{topic.category}</span>
                      <span className="text-badge-readable font-bold px-2 py-0.5 rounded bg-blue-50 text-apple-blue border border-blue-100 flex items-center gap-1">
                        <StatusIcon className="h-3.5 w-3.5" />
                        {status.label}
                      </span>
                      <span className="text-caption-readable text-apple-muted font-mono">热度 {topic.hotScore}</span>
                      {!topic.sourceItemId && (
                        <span className="text-caption-readable text-amber-600 font-mono">无来源绑定</span>
                      )}
                    </div>
                    <h3 className="text-card-title font-bold text-apple-dark mt-2 leading-snug">{topic.translatedTitle}</h3>
                    <p className="text-caption-readable text-apple-muted mt-1 truncate">来源文章：{topic.originalTitle}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {!draft ? (
                      <button
                        onClick={() => {
                          if (topic.status !== 'pushed') onPushToWorkshop(topic.id);
                          openWorkshop(topic.id);
                        }}
                        className="px-4 py-2 rounded-xl bg-apple-blue text-white text-button-readable font-bold flex items-center gap-1.5"
                      >
                        <span>推送到写作工坊</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => openWorkshop(topic.id)}
                          className="px-4 py-2 rounded-xl border border-apple-border bg-white text-apple-dark text-button-readable font-bold flex items-center gap-1.5"
                        >
                          <FileText className="h-4 w-4" />
                          <span>查看文章</span>
                        </button>
                        <button
                          onClick={() => onOpenDraftLibrary(draft.id)}
                          className="px-4 py-2 rounded-xl bg-apple-blue text-white text-button-readable font-bold flex items-center gap-1.5"
                        >
                          <span>进入内容与草稿库</span>
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    {topic.status !== 'pushed' && topic.status !== 'archived' && (
                      <button
                        onClick={() => onArchiveTopic(topic.id)}
                        className="p-2 rounded-xl border border-apple-border text-apple-muted hover:bg-apple-bg"
                        title="归档"
                      >
                        <Archive className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-apple-border bg-apple-bg/35 p-3 lg:col-span-2">
                    <div className="text-meta-readable font-bold text-apple-dark mb-1">推荐角度</div>
                    <p className="text-body-readable text-apple-dark leading-relaxed">{topic.angle || topic.summary}</p>
                  </div>
                  <div className="rounded-2xl border border-apple-border bg-white p-3">
                    <div className="text-meta-readable font-bold text-apple-muted mb-1">目标受众</div>
                    <p className="text-body-readable font-bold text-apple-dark">{targetAudiences}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-apple-border bg-white p-3">
                  <div className="text-meta-readable font-bold text-apple-muted mb-1">摘要</div>
                  <p className="text-body-readable text-apple-dark leading-relaxed">{topic.summary}</p>
                  <div className="flex items-center gap-3 mt-2">
                    {topic.originalUrl && (
                      <a
                        href={topic.originalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-caption-readable font-bold text-apple-blue hover:underline"
                      >
                        <span>查看原文</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {topic.rawContent && (
                      <button
                        type="button"
                        onClick={() => setExpandedSourceId(isSourceExpanded ? null : topic.id)}
                        className="inline-flex items-center gap-1 text-caption-readable font-bold text-apple-muted hover:text-apple-dark transition"
                      >
                        <span>{isSourceExpanded ? '收起来源内容' : '查看来源内容'}</span>
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isSourceExpanded ? 'rotate-180' : ''}`} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Expandable source content */}
                {isSourceExpanded && topic.rawContent && (
                  <div className="rounded-2xl border border-apple-border bg-apple-bg/35 p-4 space-y-2">
                    <div className="text-meta-readable font-bold text-apple-dark">来源内容</div>
                    <p className="text-body-readable text-apple-dark leading-relaxed whitespace-pre-wrap select-text">
                      {rawContentPreview}
                    </p>
                    {hasMoreContent && (
                      <button
                        type="button"
                        onClick={() => setExpandedSourceId(null)}
                        className="text-caption-readable font-bold text-apple-blue hover:underline"
                      >
                        内容较长，点击收起
                      </button>
                    )}
                    {!hasMoreContent && topic.rawContent.length > 0 && (
                      <p className="text-caption-readable text-apple-muted">共 {topic.rawContent.length} 字</p>
                    )}
                  </div>
                )}
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
