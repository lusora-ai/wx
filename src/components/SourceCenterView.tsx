/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Rss,
  Plus,
  Search,
  Globe,
  AlertTriangle,
  CheckCircle,
  Trash2,
  RefreshCw,
  ExternalLink,
  X,
  PlusCircle,
  Database,
  ArrowRight,
  Archive,
  RotateCcw,
  FileText,
  Filter,
  Activity,
  Bookmark,
  Copy,
  Check,
  ArrowUpDown,
} from 'lucide-react';
import { SourceFeed } from '../types';
import type { CreateSourceInput } from '../api/sources';
import type { SourceItemRecord } from '../api/sources';
import { sourceItemsApi } from '../api/sourceItems';
import { sourcePresetsApi, type SourcePreset } from '../api/sourcePresets';

interface SourceCenterViewProps {
  sources: SourceFeed[];
  onAddSource: (source: CreateSourceInput) => void | Promise<void>;
  onDeleteSource: (id: string) => void;
  onPermanentDeleteSource: (id: string) => void;
  onToggleStatus: (id: string) => void;
  isRefreshing: boolean;
  focusedSourceId?: string | null;
  focusedSourceItemId?: string | null;
  onTriggerCheck: (id: string) => void;
  onFetchAllSources: () => void;
  onGenerateTopic: (id: string) => void;
  onGenerateSourceItemTopic: (id: string) => void;
}

export default function SourceCenterView({
  sources,
  onAddSource,
  onDeleteSource,
  onPermanentDeleteSource,
  onToggleStatus,
  isRefreshing,
  focusedSourceId,
  focusedSourceItemId,
  onTriggerCheck,
  onFetchAllSources,
  onGenerateTopic,
  onGenerateSourceItemTopic
}: SourceCenterViewProps) {

  const [activeTab, setActiveTab] = useState<'sources' | 'items'>('sources');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [showTestData, setShowTestData] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPresetsOpen, setIsPresetsOpen] = useState(false);
  const [presets, setPresets] = useState<SourcePreset[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // SourceItem state
  const [sourceItems, setSourceItems] = useState<SourceItemRecord[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsFilter, setItemsFilter] = useState({ status: '', sourceId: '', keyword: '', today: false, highQuality: false });
  const [itemsSort, setItemsSort] = useState<'createdAt' | 'qualityScore'>('qualityScore');
  const [itemsError, setItemsError] = useState('');

  // Modal Form State
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [newSourceType, setNewSourceType] = useState<'manual' | 'url' | 'rss'>('manual');
  const [newSourceRegion, setNewSourceRegion] = useState<'global' | 'domestic'>('global');
  const [newSourceCategory, setNewSourceCategory] = useState('手动录入');
  const [newSourceRawText, setNewSourceRawText] = useState('');
  const [formError, setFormError] = useState('');

  // Extract Category List
  const categories = ['ALL', 'ARCHIVED', ...Array.from(new Set(sources.filter(s => s.status !== 'archived').map(s => s.category)))];

  // Test data patterns
  const TEST_PATTERNS = ['[DEV]', '[TEST]', '[MOCK]', 'E2E', '127.0.0.1', 'localhost'];

  function isTestSource(source: SourceFeed): boolean {
    const fields = [source.name, source.url].filter(Boolean);
    return fields.some((f) => TEST_PATTERNS.some((p) => f.includes(p)));
  }

  function isTestSourceItem(item: SourceItemRecord): boolean {
    const fields = [item.title, item.url, item.source?.name, item.source?.title, item.source?.url].filter(Boolean);
    return fields.some((f) => TEST_PATTERNS.some((p) => f.includes(p)));
  }

  // Filtering Logic
  const filteredSources = sources.filter(source => {
    const matchesSearch = source.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          source.url.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesArchived = activeCategory === 'ARCHIVED' ? source.status === 'archived' : source.status !== 'archived';
    const matchesCategory = activeCategory === 'ALL' || activeCategory === 'ARCHIVED' || source.category === activeCategory;
    const matchesTestData = showTestData || !isTestSource(source);
    if (!matchesArchived) return false;
    return matchesSearch && matchesCategory && matchesTestData;
  });

  const loadSourceItems = useCallback(async () => {
    setItemsLoading(true);
    setItemsError('');
    try {
      const params: Record<string, string> = {};
      if (itemsFilter.status) params.status = itemsFilter.status;
      if (itemsFilter.sourceId) params.sourceId = itemsFilter.sourceId;
      if (itemsFilter.keyword) params.keyword = itemsFilter.keyword;
      const items = await sourceItemsApi.list(params);
      let filtered = showTestData ? items : items.filter((item) => !isTestSourceItem(item));
      if (itemsFilter.today) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        filtered = filtered.filter((item) => new Date(item.createdAt) >= today);
      }
      if (itemsFilter.highQuality) {
        filtered = filtered.filter((item) => (item.qualityScore ?? 0) >= 60);
      }
      filtered.sort((a, b) => {
        if (itemsSort === 'qualityScore') return (b.qualityScore ?? 0) - (a.qualityScore ?? 0);
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setSourceItems(filtered);
    } catch (err) {
      setItemsError(err instanceof Error ? err.message : '加载抓取内容失败。');
    } finally {
      setItemsLoading(false);
    }
  }, [itemsFilter, itemsSort, showTestData]);

  const loadPresets = async () => {
    setPresetsLoading(true);
    try {
      const data = await sourcePresetsApi.list();
      setPresets(data);
    } catch {
      // ignore
    } finally {
      setPresetsLoading(false);
    }
  };

  const handleAddPreset = async (presetId: string) => {
    try {
      await sourcePresetsApi.add(presetId);
      setPresets((prev) => prev.map((p) => p.id === presetId ? { ...p, added: true } : p));
    } catch {
      // ignore
    }
  };

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (activeTab === 'items') loadSourceItems();
  }, [activeTab, loadSourceItems]);

  useEffect(() => {
    if (focusedSourceItemId) {
      setActiveTab('items');
    } else if (focusedSourceId) {
      setActiveTab('sources');
    }
  }, [focusedSourceId, focusedSourceItemId]);

  useEffect(() => {
    const targetId = focusedSourceItemId ? `source-item-row-${focusedSourceItemId}` : focusedSourceId ? `source-card-${focusedSourceId}` : '';
    if (!targetId) return;
    window.setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
  }, [focusedSourceId, focusedSourceItemId, sourceItems.length, activeTab]);

  useEffect(() => {
    if (isPresetsOpen) loadPresets();
  }, [isPresetsOpen]);

  const handleArchiveItem = async (id: string) => {
    try {
      await sourceItemsApi.archive(id);
      await loadSourceItems();
    } catch (err) {
      setItemsError(err instanceof Error ? err.message : '归档失败。');
    }
  };

  const handleRestoreItem = async (id: string) => {
    try {
      await sourceItemsApi.restore(id);
      await loadSourceItems();
    } catch (err) {
      setItemsError(err instanceof Error ? err.message : '恢复失败。');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceName.trim()) {
      setFormError('请填写标题/名称。');
      return;
    }
    if (newSourceType === 'manual' && !newSourceRawText.trim()) {
      setFormError('手动内容源必须填写原始内容。');
      return;
    }

    // Quick URL validation
    if ((newSourceType === 'url' || newSourceType === 'rss') && !newSourceUrl.trim()) {
      setFormError('URL/RSS 内容源必须填写链接。');
      return;
    }
    if (newSourceUrl && !newSourceUrl.startsWith('http://') && !newSourceUrl.startsWith('https://')) {
      setFormError('链接格式不正确，必须以 http:// 或 https:// 开头');
      return;
    }

    await onAddSource({
      name: newSourceName,
      title: newSourceName,
      url: newSourceUrl,
      type: newSourceType,
      rawText: newSourceRawText,
      region: newSourceRegion,
      language: 'en'
    });

    if (newSourceType === 'manual') {
      setActiveTab('items');
      await loadSourceItems();
    }

    // Reset Form
    setNewSourceName('');
    setNewSourceUrl('');
    setNewSourceType('manual');
    setNewSourceRegion('global');
    setNewSourceCategory('手动录入');
    setNewSourceRawText('');
    setFormError('');
    setIsModalOpen(false);
  };

  function qualityBadge(item: SourceItemRecord) {
    if (!item.qualityScore && item.qualityScore !== 0) return null;
    const score = item.qualityScore;
    let label = '高质量';
    let color = 'emerald';
    try {
      const issues: { type: string }[] = item.qualityIssues ? JSON.parse(item.qualityIssues) : [];
      if (issues.some((i) => i.type === 'blocked')) { label = '疑似反爬'; color = 'rose'; }
      else if (issues.some((i) => i.type === 'too_short')) { label = '内容过短'; color = 'amber'; }
      else if (score < 40) { label = '抓取失败'; color = 'rose'; }
      else if (score < 60) { label = '需检查'; color = 'amber'; }
    } catch { /* ignore */ }
    return (
      <span className={`text-badge-readable px-1.5 py-0.5 rounded bg-${color}-50 text-${color}-600 border border-${color}-100`}>
        {label} ({score})
      </span>
    );
  }

  function statusBadge(status: string) {
    if (status === 'archived') return <span className="text-badge-readable px-1.5 py-0.5 rounded bg-neutral-50 text-neutral-500 border border-neutral-100">已归档</span>;
    if (status === 'topic_generated') return <span className="text-badge-readable px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100">已生成选题</span>;
    return <span className="text-badge-readable px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">待处理</span>;
  }

  function isTodayRecommend(item: SourceItemRecord): boolean {
    if ((item.qualityScore ?? 0) < 60) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(item.createdAt) >= today;
  }

  function actionableState(item: SourceItemRecord) {
    if (item.status === 'topic_generated') return { label: '已生成选题', className: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
    if (item.status === 'archived') return { label: '已忽略', className: 'bg-neutral-50 text-neutral-500 border-neutral-100' };
    if ((item.qualityScore ?? 0) < 40) return { label: '抓取失败', className: 'bg-rose-50 text-rose-700 border-rose-100' };
    if ((item.rawText || '').trim().length < 200 || (item.qualityScore ?? 0) < 60) return { label: '内容不足', className: 'bg-amber-50 text-amber-700 border-amber-100' };
    return { label: '可生成选题', className: 'bg-blue-50 text-apple-blue border-blue-100' };
  }

  return (
    <div id="sources-view-wrapper" className="space-y-6 container mx-auto px-1 py-1">

      {/* Tab Switcher */}
      <div className="flex items-center space-x-1 p-0.5 rounded-xl bg-apple-bg border border-apple-border/50 text-xs text-apple-muted font-semibold w-fit">
        <button
          onClick={() => setActiveTab('sources')}
          className={`px-4 py-2 rounded-lg transition-all cursor-pointer flex items-center space-x-1.5 ${
            activeTab === 'sources'
              ? 'bg-white text-apple-dark shadow-xs font-bold'
              : 'hover:text-apple-dark text-apple-muted'
          }`}
        >
          <Rss className="h-4 w-4 text-apple-blue" />
          <span>内容源</span>
        </button>
        <button
          onClick={() => setActiveTab('items')}
          className={`px-4 py-2 rounded-lg transition-all cursor-pointer flex items-center space-x-1.5 ${
            activeTab === 'items'
              ? 'bg-white text-apple-dark shadow-xs font-bold'
              : 'hover:text-apple-dark text-apple-muted'
          }`}
        >
          <FileText className="h-4 w-4 text-apple-blue" />
          <span>抓取结果</span>
        </button>
      </div>

      {/* Sources Tab */}
      {activeTab === 'sources' && (
        <>
          {/* Search and Action Toolbar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-apple-border rounded-[24px] p-4 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
            {/* Search */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-apple-muted" />
              <input
                type="text"
                id="source-search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="搜索源名称、订阅链接..."
                className="w-full pl-9 pr-4 py-2.5 bg-apple-bg hover:bg-apple-bg border border-apple-border focus:border-apple-border focus:bg-white rounded-xl text-body-readable outline-none transition-all font-medium text-apple-dark placeholder-apple-muted"
              />
            </div>

            {/* Filter categories & Add action */}
            <div className="flex items-center space-x-3 self-end md:self-auto overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
              <div className="flex items-center space-x-1 p-0.5 rounded-xl bg-apple-bg border border-apple-border/50 text-body-readable text-apple-text-secondary font-semibold mr-1">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                      activeCategory === cat
                        ? 'bg-white text-apple-dark shadow-xs font-semibold'
                        : 'hover:text-apple-dark text-apple-text-secondary'
                    }`}
                  >
                    {cat === 'ALL' ? '全部频道' : cat === 'ARCHIVED' ? '已删除' : cat}
                  </button>
                ))}
              </div>

              <button
                onClick={onFetchAllSources}
                disabled={isRefreshing}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl border border-apple-border bg-white hover:bg-apple-bg text-apple-dark font-semibold text-button-readable shadow-xs transition-all cursor-pointer shrink-0 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>抓取全部 active 源</span>
              </button>

              <button
                onClick={() => setIsPresetsOpen(true)}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl border border-apple-border bg-white hover:bg-apple-bg text-apple-dark font-semibold text-button-readable shadow-xs transition-all cursor-pointer shrink-0"
              >
                <Bookmark className="h-4 w-4" />
                <span>常用预设</span>
              </button>

              <button
                onClick={() => setIsModalOpen(true)}
                id="add-source-modal-trigger"
                className="flex items-center space-x-1.5 px-4.5 py-2 rounded-xl bg-apple-blue hover:bg-apple-blue-hover text-white font-semibold text-button-readable shadow-xs transition-all cursor-pointer shrink-0"
              >
                <Plus className="h-4 w-4" />
                <span>添加内容源</span>
              </button>
            </div>
          </div>

          {/* Test data toggle */}
          <div className="flex items-center justify-end px-1">
            <label className="flex items-center space-x-2 text-caption-readable text-apple-muted cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showTestData}
                onChange={(e) => setShowTestData(e.target.checked)}
                className="rounded border-apple-border"
              />
              <span>显示测试/开发数据</span>
            </label>
          </div>

          {/* Grid of Feed Source Cards (Apple Bento Style) */}
          <div id="sources-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredSources.map((source) => {
              const isError = source.status === 'error';
              const isInactive = source.status === 'inactive';
              return (
                <div
                  key={source.id}
                  id={`source-card-${source.id}`}
                  className={`bg-white border hover:border-apple-border/80 rounded-[24px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)] transition-all flex flex-col justify-between space-y-4 relative overflow-hidden ${
                    focusedSourceId === source.id ? 'border-apple-blue ring-2 ring-blue-100' : 'border-apple-border'
                  }`}
                >
                  {/* Top Row: Type and badge action */}
                  <div className="flex items-center justify-between">
                    <span className={`text-[9px] font-bold font-mono tracking-wider px-2 py-0.5 rounded-md ${
                      source.type === 'rss'
                        ? 'bg-[#0066CC]/10 text-apple-blue border border-[#0066CC]/20'
                        : 'bg-emerald-55/15 text-emerald-600 border border-emerald-500/20'
                    }`}>
                      {source.type}
                    </span>

                    <div className="flex items-center space-x-1.5">
                      <div className={`h-2 w-2 rounded-full ${
                        source.status === 'active'
                          ? 'bg-emerald-500 shadow-xs shadow-emerald-500/20'
                          : isError
                            ? 'bg-rose-500 animate-pulse'
                            : 'bg-[#D2D2D7]'
                      }`}></div>
                      <span className="text-[10px] font-mono text-apple-muted uppercase font-semibold">
                        {source.status === 'archived' ? '已删除' : source.status === 'active' ? '正常' : isError ? '异常' : '暂停'}
                      </span>
                    </div>
                  </div>

                  {/* Title and stats bar */}
                  <div className="space-y-1.5">
                    <h4 className="text-card-title font-semibold flex items-center space-x-1">
                      <Globe className="h-4 w-4 text-apple-muted shrink-0" />
                      <span className="truncate">{source.name}</span>
                    </h4>
                    <p className="text-caption-readable font-mono truncate select-all">{source.url}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-apple-bg p-2.5 rounded-xl border border-apple-border/40 font-mono text-meta-readable">
                    <div>
                      <div className="text-apple-muted">已提取文章</div>
                      <div className="text-apple-dark font-bold mt-0.5">{source.articleCount} 篇</div>
                    </div>
                    <div>
                      <div className="text-apple-muted">上轮检查时间</div>
                      <div className="text-apple-dark font-semibold mt-0.5 truncate">{source.lastChecked}</div>
                    </div>
                  </div>

                  {source.items && source.items.length > 0 && (
                    <div className="space-y-2 rounded-xl border border-apple-border bg-white p-2.5">
                      <div className="text-caption-readable font-bold text-apple-muted uppercase">最近抓取内容</div>
                      {source.items.slice(0, 2).map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-2 text-body-readable">
                          <span className="truncate text-apple-dark font-semibold">{item.title}</span>
                          <button
                            type="button"
                            onClick={() => onGenerateSourceItemTopic(item.id)}
                            className="shrink-0 px-2 py-1 rounded-lg border border-[#0066CC]/30 bg-[#0066CC]/10 text-apple-blue font-bold text-meta-readable"
                          >
                            生成选题
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Action Buttons footer */}
                  <div className="pt-3 border-t border-apple-border/30 flex items-center justify-between space-x-2">
                    <span className="text-badge-readable font-semibold px-2 py-0.5 rounded bg-apple-bg text-apple-dark border border-apple-border/10">
                      {source.category}
                    </span>

                    <div className="flex items-center space-x-1">
                      {source.status === 'archived' ? (
                        <>
                          {/* Restore button for archived sources */}
                          <button
                            onClick={() => onToggleStatus(source.id)}
                            className="px-2 py-1 text-meta-readable font-bold rounded-lg border border-[#0066CC]/40 bg-[#0066CC]/10 text-apple-blue hover:bg-[#0066CC]/25 transition-all cursor-pointer"
                            title="恢复内容源"
                          >
                            恢复
                          </button>
                          {/* Permanent delete button for archived sources */}
                          <button
                            onClick={() => {
                              const isTest = isTestSource(source);
                              const msg = isTest
                                ? '这是测试内容源，可以安全清理。确认永久删除？'
                                : '永久删除会移除该内容源及关联抓取结果，无法撤销。';
                              if (window.confirm(msg)) onPermanentDeleteSource(source.id);
                            }}
                            className="px-2 py-1 text-meta-readable font-bold rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all cursor-pointer"
                            title="永久删除"
                          >
                            永久删除
                          </button>
                        </>
                      ) : (
                        <>
                          {/* Handle trigger manual diagnostic sync */}
                          <button
                            onClick={() => onTriggerCheck(source.id)}
                            className="p-1.5 rounded-lg border border-apple-border hover:bg-apple-bg text-apple-muted hover:text-apple-dark transition-all cursor-pointer"
                            title="立即验证拉取"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onGenerateTopic(source.id)}
                            className="px-2 py-1 text-meta-readable font-bold rounded-lg border border-[#0066CC]/40 bg-[#0066CC]/10 text-apple-blue hover:bg-[#0066CC]/20 transition-all cursor-pointer"
                            title="AI 提炼选题"
                          >
                            提炼
                          </button>

                          {/* Toggle source Active/Inactive */}
                          <button
                            onClick={() => onToggleStatus(source.id)}
                            className={`px-2 py-1 text-meta-readable font-bold rounded-lg border transition-all cursor-pointer ${
                              source.status === 'active'
                                ? 'border-apple-border text-apple-text-secondary hover:bg-apple-bg'
                                : 'border-[#0066CC]/40 bg-[#0066CC]/10 text-apple-blue hover:bg-[#0066CC]/25'
                            }`}
                          >
                            {source.status === 'active' ? '挂起' : '恢复'}
                          </button>

                          <button
                            onClick={() => {
                              if (window.confirm('删除后该内容源不会继续抓取，历史文章不会被删除。')) onDeleteSource(source.id);
                            }}
                            className="p-1.5 rounded-lg border border-rose-50 text-rose-500 hover:bg-rose-50 hover:border-rose-100 transition-all cursor-pointer"
                            title="删除内容源"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Error overlay alert if error */}
                  {isError && (
                    <div className="absolute top-1 right-24 bg-rose-50 text-rose-600 font-mono text-caption-readable rounded px-1.5 py-0.5 border border-rose-100 flex items-center space-x-1 shadow-xs">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      <span>504 Timeout</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* SourceItems Tab */}
      {activeTab === 'items' && (
        <>
          {/* Filters */}
          <div className="flex flex-col md:flex-row md:items-center gap-3 bg-white border border-apple-border rounded-[24px] p-4 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-apple-muted" />
              <input
                type="text"
                value={itemsFilter.keyword}
                onChange={(e) => setItemsFilter((f) => ({ ...f, keyword: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && loadSourceItems()}
                placeholder="搜索标题或内容..."
                className="w-full pl-9 pr-4 py-2.5 bg-apple-bg border border-apple-border focus:bg-white rounded-xl text-body-readable outline-none font-medium text-apple-dark placeholder-apple-muted"
              />
            </div>
            <select
              value={itemsFilter.status}
              onChange={(e) => setItemsFilter((f) => ({ ...f, status: e.target.value }))}
              className="px-3 py-2.5 bg-apple-bg border border-apple-border rounded-xl text-body-readable font-semibold text-apple-dark outline-none"
            >
              <option value="">全部状态</option>
              <option value="pending">待处理</option>
              <option value="topic_generated">已生成选题</option>
              <option value="archived">已归档</option>
            </select>
            <select
              value={itemsFilter.sourceId}
              onChange={(e) => setItemsFilter((f) => ({ ...f, sourceId: e.target.value }))}
              className="px-3 py-2.5 bg-apple-bg border border-apple-border rounded-xl text-body-readable font-semibold text-apple-dark outline-none"
            >
              <option value="">全部来源</option>
              {sources.filter((s) => s.status !== 'archived').map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <div className="flex items-center space-x-1 p-0.5 rounded-xl bg-apple-bg border border-apple-border/50 text-meta-readable font-semibold text-apple-text-secondary">
              <button
                onClick={() => setItemsFilter((f) => ({ ...f, today: !f.today }))}
                className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${itemsFilter.today ? 'bg-white text-apple-dark shadow-xs font-bold' : 'hover:text-apple-dark'}`}
              >
                今日
              </button>
              <button
                onClick={() => setItemsFilter((f) => ({ ...f, highQuality: !f.highQuality }))}
                className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${itemsFilter.highQuality ? 'bg-white text-apple-dark shadow-xs font-bold' : 'hover:text-apple-dark'}`}
              >
                高质量
              </button>
            </div>
            <select
              value={itemsSort}
              onChange={(e) => setItemsSort(e.target.value as 'createdAt' | 'qualityScore')}
              className="px-3 py-2.5 bg-apple-bg border border-apple-border rounded-xl text-body-readable font-semibold text-apple-dark outline-none"
            >
              <option value="createdAt">按时间排序</option>
              <option value="qualityScore">按质量排序</option>
            </select>
            <button
              onClick={loadSourceItems}
              disabled={itemsLoading}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl border border-apple-border bg-white hover:bg-apple-bg text-apple-dark font-semibold text-button-readable shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${itemsLoading ? 'animate-spin' : ''}`} />
              <span>刷新</span>
            </button>
          </div>

          {itemsError && (
            <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-meta-readable font-semibold flex items-center space-x-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>{itemsError}</span>
            </div>
          )}

          {/* Items Table */}
          <div className="bg-white border border-apple-border rounded-[24px] shadow-[0_4px_24px_rgba(0,0,0,0.02)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-body-readable">
                <thead>
                  <tr className="border-b border-apple-border bg-apple-bg/50">
                    <th className="text-left px-4 py-3 font-bold text-apple-muted uppercase text-caption-readable">标题</th>
                    <th className="text-left px-4 py-3 font-bold text-apple-muted uppercase text-caption-readable">来源</th>
                    <th className="text-left px-4 py-3 font-bold text-apple-muted uppercase text-caption-readable">质量</th>
                    <th className="text-left px-4 py-3 font-bold text-apple-muted uppercase text-caption-readable">状态</th>
                    <th className="text-left px-4 py-3 font-bold text-apple-muted uppercase text-caption-readable">发布时间</th>
                    <th className="text-left px-4 py-3 font-bold text-apple-muted uppercase text-caption-readable">抓取时间</th>
                    <th className="text-right px-4 py-3 font-bold text-apple-muted uppercase text-caption-readable">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceItems.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-apple-muted font-semibold text-body-readable">
                        {itemsLoading ? '加载中...' : '暂无抓取内容。'}
                      </td>
                    </tr>
                  )}
                  {sourceItems.map((item) => {
                    const state = actionableState(item);
                    return (
                    <tr
                      key={item.id}
                      id={`source-item-row-${item.id}`}
                      className={`border-b border-apple-border/50 hover:bg-apple-bg/30 transition ${
                        focusedSourceItemId === item.id ? 'bg-blue-50/70 ring-1 ring-blue-100' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {isTodayRecommend(item) && (
                            <span className="text-badge-readable px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-100 font-bold shrink-0">今日推荐</span>
                          )}
                          <span className="font-semibold text-apple-dark truncate max-w-[200px]" title={item.title}>{item.title}</span>
                        </div>
                        {item.summary && (
                          <div className="text-caption-readable text-apple-muted truncate max-w-[200px] mt-0.5">{item.summary.slice(0, 80)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-apple-muted font-mono text-caption-readable">
                        {item.source?.name || item.source?.title || '-'}
                      </td>
                      <td className="px-4 py-3">
                        {qualityBadge(item)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {statusBadge(item.status)}
                          <span className={`w-fit text-badge-readable px-1.5 py-0.5 rounded border font-bold ${state.className}`}>
                            {state.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-apple-muted font-mono text-caption-readable">
                        {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('zh-CN') : '-'}
                      </td>
                      <td className="px-4 py-3 text-apple-muted font-mono text-caption-readable">
                        {new Date(item.createdAt).toLocaleDateString('zh-CN')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end space-x-1">
                          {item.status !== 'archived' && item.status !== 'topic_generated' && (
                            <button
                              onClick={() => onGenerateSourceItemTopic(item.id)}
                              className="px-2 py-1 rounded-lg border border-[#0066CC]/30 bg-[#0066CC]/10 text-apple-blue font-bold text-meta-readable hover:bg-[#0066CC]/20 transition"
                            >
                              生成选题
                            </button>
                          )}
                          {item.sourceId && item.status !== 'archived' && (
                            <button
                              onClick={() => onTriggerCheck(item.sourceId)}
                              className="px-2 py-1 rounded-lg border border-apple-border bg-white text-apple-dark font-bold text-meta-readable hover:bg-apple-bg transition"
                            >
                              重新抓取
                            </button>
                          )}
                          {item.url && (
                            <>
                              <button
                                onClick={() => handleCopyUrl(item.url!)}
                                className="p-1.5 rounded-lg border border-apple-border hover:bg-apple-bg text-apple-muted hover:text-apple-dark transition"
                                title="复制链接"
                              >
                                {copiedUrl === item.url ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                              </button>
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg border border-apple-border hover:bg-apple-bg text-apple-muted hover:text-apple-dark transition"
                                title="查看原文"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </>
                          )}
                          {item.status === 'archived' ? (
                            <button
                              onClick={() => handleRestoreItem(item.id)}
                              className="p-1.5 rounded-lg border border-apple-border hover:bg-apple-bg text-apple-muted hover:text-apple-dark transition"
                              title="恢复"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleArchiveItem(item.id)}
                              className="p-1.5 rounded-lg border border-rose-50 text-rose-500 hover:bg-rose-50 hover:border-rose-100 transition"
                              title="归档"
                            >
                              <Archive className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Presets Modal */}
      {isPresetsOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50 p-4 transition-all animate-fade-in">
          <div className="bg-white border border-apple-border rounded-[24px] w-full max-w-lg overflow-hidden p-6 shadow-2xl relative space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-apple-border pb-3">
              <div className="flex items-center space-x-2">
                <div className="h-7 w-7 rounded-lg bg-apple-blue text-white flex items-center justify-center">
                  <Bookmark className="h-4 w-4" />
                </div>
                <h3 className="text-section-title font-bold text-apple-dark">常用内容源预设</h3>
              </div>
              <button
                onClick={() => setIsPresetsOpen(false)}
                className="h-6 w-6 rounded-full hover:bg-apple-bg flex items-center justify-center border border-apple-border text-apple-muted hover:text-apple-dark transition cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {presetsLoading && <div className="text-center text-apple-muted text-body-readable py-4">加载中...</div>}
              {!presetsLoading && presets.length === 0 && <div className="text-center text-apple-muted text-body-readable py-4">暂无预设。</div>}
              {presets.map((preset) => (
                <div key={preset.id} className="flex items-center justify-between p-3 rounded-xl border border-apple-border/50 hover:bg-apple-bg/50 transition">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className={`text-badge-readable font-bold font-mono tracking-wider px-1.5 py-0.5 rounded ${preset.type === 'rss' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {preset.type}
                      </span>
                      <span className="text-card-title font-bold text-apple-dark">{preset.name}</span>
                      <span className={`text-badge-readable px-1.5 py-0.5 rounded ${preset.region === 'domestic' ? 'bg-amber-50 text-amber-600' : 'bg-neutral-50 text-neutral-500'}`}>
                        {preset.region === 'domestic' ? '国内' : '海外'}
                      </span>
                    </div>
                    <p className="text-caption-readable text-apple-muted mt-0.5 truncate">{preset.description}</p>
                  </div>
                  <button
                    onClick={() => handleAddPreset(preset.id)}
                    disabled={preset.added}
                    className={`ml-3 px-3 py-1.5 rounded-lg text-meta-readable font-bold transition cursor-pointer ${preset.added ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-apple-blue text-white hover:bg-apple-blue-hover'}`}
                  >
                    {preset.added ? '已添加' : '添加'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Slide-in Form Drawer / Overlay Dialog (High-Fidelity Modal CSS) */}
      {isModalOpen && (
        <div id="add-source-modal-overlay" className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50 p-4 transition-all animate-fade-in">
          <div className="bg-white border border-apple-border rounded-[24px] w-full max-w-sm overflow-hidden p-6 shadow-2xl relative space-y-4 animate-scale-up">

            <div className="flex items-center justify-between border-b border-apple-border pb-3">
              <div className="flex items-center space-x-2">
                <div className="h-7 w-7 rounded-lg bg-apple-blue text-white flex items-center justify-center">
                  <PlusCircle className="h-4 w-4" />
                </div>
                <h3 className="text-section-title font-bold text-apple-dark">添加新的订阅采集源</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="h-6 w-6 rounded-full hover:bg-apple-bg flex items-center justify-center border border-apple-border text-apple-muted hover:text-apple-dark transition cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="p-2.5 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-caption-readable font-medium flex items-center space-x-1.5 animate-pulse">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-caption-readable font-bold text-apple-muted uppercase">源名称 (必填)</label>
                <input
                  type="text"
                  placeholder="如 VentureBeat, NVIDIA Developer Blog"
                  value={newSourceName}
                  onChange={(e) => setNewSourceName(e.target.value)}
                  className="w-full px-3 py-2 bg-apple-bg hover:bg-apple-bg focus:bg-white border border-apple-border focus:border-apple-border outline-none rounded-xl text-body-readable font-medium text-apple-dark transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-caption-readable font-bold text-apple-muted uppercase">源订阅链接 URL (必填)</label>
                <input
                  type="text"
                  placeholder="https://example.com/article"
                  value={newSourceUrl}
                  onChange={(e) => setNewSourceUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-apple-bg hover:bg-apple-bg focus:bg-white border border-apple-border focus:border-apple-border outline-none rounded-xl text-body-readable font-mono font-medium text-apple-dark transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-caption-readable font-bold text-apple-muted uppercase">获取技术</label>
                  <select
                    value={newSourceType}
                    onChange={(e) => setNewSourceType(e.target.value as 'manual' | 'url' | 'rss')}
                    className="w-full px-2 py-2 bg-apple-bg border border-apple-border outline-none rounded-xl text-body-readable font-semibold text-apple-dark"
                  >
                    <option value="manual">手动录入</option>
                    <option value="url">URL 保存</option>
                    <option value="rss">RSS 源</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-caption-readable font-bold text-apple-muted uppercase">来源地区</label>
                  <select
                    value={newSourceRegion}
                    onChange={(e) => setNewSourceRegion(e.target.value as 'global' | 'domestic')}
                    className="w-full px-2 py-2 bg-apple-bg border border-apple-border outline-none rounded-xl text-body-readable font-semibold text-apple-dark"
                  >
                    <option value="global">海外 / Global</option>
                    <option value="domestic">国内 / Domestic</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-caption-readable font-bold text-apple-muted uppercase">原始内容 / 摘要 {newSourceType === 'manual' ? '(必填)' : '(可选，抓取后自动回填)'}</label>
                <textarea
                  value={newSourceRawText}
                  onChange={(e) => setNewSourceRawText(e.target.value)}
                  placeholder="粘贴海外 AI 资讯原文、摘要或你手动整理的事实材料..."
                  className="w-full h-28 px-3 py-2 bg-apple-bg hover:bg-apple-bg focus:bg-white border border-apple-border focus:border-apple-border outline-none rounded-xl text-body-readable font-medium text-apple-dark transition-all resize-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-apple-blue hover:bg-apple-blue-hover text-white font-bold text-button-readable shadow-xs transition-all cursor-pointer flex items-center justify-center space-x-1"
                >
                  <Plus className="h-4 w-4" />
                  <span>注入系统订阅面板</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
