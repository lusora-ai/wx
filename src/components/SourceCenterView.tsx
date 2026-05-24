/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
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
  ArrowRight
} from 'lucide-react';
import { SourceFeed } from '../types';

interface SourceCenterViewProps {
  sources: SourceFeed[];
  onAddSource: (source: Omit<SourceFeed, 'id' | 'articleCount' | 'lastChecked'>) => void;
  onDeleteSource: (id: string) => void;
  onToggleStatus: (id: string) => void;
  isRefreshing: boolean;
  onTriggerCheck: (id: string) => void;
}

export default function SourceCenterView({
  sources,
  onAddSource,
  onDeleteSource,
  onToggleStatus,
  isRefreshing,
  onTriggerCheck
}: SourceCenterViewProps) {
  
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Modal Form State
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [newSourceType, setNewSourceType] = useState<'RSS' | 'WEBSITE'>('RSS');
  const [newSourceCategory, setNewSourceCategory] = useState('海外科技媒体');
  const [formError, setFormError] = useState('');

  // Extract Category List
  const categories = ['ALL', ...Array.from(new Set(sources.map(s => s.category)))];

  // Filtering Logic
  const filteredSources = sources.filter(source => {
    const matchesSearch = source.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          source.url.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === 'ALL' || source.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceName.trim() || !newSourceUrl.trim()) {
      setFormError('请填写所有必填字段');
      return;
    }
    
    // Quick URL validation
    if (!newSourceUrl.startsWith('http://') && !newSourceUrl.startsWith('https://')) {
      setFormError('链接格式不正确，必须以 http:// 或 https:// 开头');
      return;
    }

    onAddSource({
      name: newSourceName,
      url: newSourceUrl,
      type: newSourceType,
      category: newSourceCategory,
      status: 'active'
    });

    // Reset Form
    setNewSourceName('');
    setNewSourceUrl('');
    setNewSourceType('RSS');
    setNewSourceCategory('海外科技媒体');
    setFormError('');
    setIsModalOpen(false);
  };

  return (
    <div id="sources-view-wrapper" className="space-y-6 container mx-auto px-1 py-1">
      
      {/* Search and Action Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-apple-border rounded-[24px] p-4 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-apple-muted" />
          <input
            type="text"
            id="source-search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜索源名称、订阅链接..."
            className="w-full pl-9 pr-4 py-2 bg-apple-bg hover:bg-apple-bg border border-apple-border focus:border-apple-border focus:bg-white rounded-xl text-xs outline-none transition-all font-medium text-apple-dark placeholder-apple-muted/80"
          />
        </div>

        {/* Filter categories & Add action */}
        <div className="flex items-center space-x-3 self-end md:self-auto overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <div className="flex items-center space-x-1 p-0.5 rounded-xl bg-apple-bg border border-apple-border/50 text-xs text-apple-muted font-semibold mr-1">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  activeCategory === cat 
                    ? 'bg-white text-apple-dark shadow-xs font-semibold' 
                    : 'hover:text-apple-dark text-apple-muted'
                }`}
              >
                {cat === 'ALL' ? '全部频道' : cat}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            id="add-source-modal-trigger"
            className="flex items-center space-x-1.5 px-4.5 py-2 rounded-xl bg-apple-blue hover:bg-apple-blue-hover text-white font-semibold text-xs shadow-xs transition-all cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>添加内容源</span>
          </button>
        </div>
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
              className="bg-white border border-apple-border hover:border-apple-border/80 rounded-[24px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)] transition-all flex flex-col justify-between space-y-4 relative overflow-hidden"
            >
              {/* Top Row: Type and badge action */}
              <div className="flex items-center justify-between">
                <span className={`text-[9px] font-bold font-mono tracking-wider px-2 py-0.5 rounded-md ${
                  source.type === 'RSS' 
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
                    {source.status === 'active' ? '正常' : isError ? '异常' : '暂停'}
                  </span>
                </div>
              </div>

              {/* Title and stats bar */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold text-apple-dark flex items-center space-x-1">
                  <Globe className="h-3.5 w-3.5 text-apple-muted shrink-0" />
                  <span className="truncate">{source.name}</span>
                </h4>
                <p className="text-[10px] text-apple-muted font-mono font-medium truncate select-all">{source.url}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-apple-bg p-2.5 rounded-xl border border-apple-border/40 font-mono text-[10px]">
                <div>
                  <div className="text-apple-muted">已提取文章</div>
                  <div className="text-apple-dark font-bold mt-0.5">{source.articleCount} 篇</div>
                </div>
                <div>
                  <div className="text-apple-muted">上轮检查时间</div>
                  <div className="text-apple-dark font-semibold mt-0.5 text-[9px] truncate">{source.lastChecked}</div>
                </div>
              </div>

              {/* Action Buttons footer */}
              <div className="pt-3 border-t border-apple-border/30 flex items-center justify-between space-x-2">
                <span className="text-[9px] font-semibold px-2 py-0.5 rounded bg-apple-bg text-apple-dark border border-apple-border/10">
                  {source.category}
                </span>

                <div className="flex items-center space-x-1">
                  {/* Handle trigger manual diagnostic sync */}
                  <button
                    onClick={() => onTriggerCheck(source.id)}
                    className="p-1.5 rounded-lg border border-apple-border hover:bg-apple-bg text-apple-muted hover:text-apple-dark transition-all cursor-pointer"
                    title="立即验证拉取"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                  
                  {/* Toggle source Active/Inactive */}
                  <button
                    onClick={() => onToggleStatus(source.id)}
                    className={`px-2 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                      source.status === 'active'
                        ? 'border-apple-border text-apple-muted hover:bg-apple-bg'
                        : 'border-[#0066CC]/40 bg-[#0066CC]/10 text-apple-blue hover:bg-[#0066CC]/25'
                    }`}
                  >
                    {source.status === 'active' ? '挂起' : '恢复'}
                  </button>

                  <button
                    onClick={() => onDeleteSource(source.id)}
                    className="p-1.5 rounded-lg border border-rose-50 text-rose-500 hover:bg-rose-50 hover:border-rose-100 transition-all cursor-pointer"
                    title="彻底删除"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Error overlay alert if error */}
              {isError && (
                <div className="absolute top-1 right-24 bg-rose-50 text-rose-600 font-mono text-[9px] rounded px-1.5 py-0.5 border border-rose-100 flex items-center space-x-1 shadow-xs">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  <span>504 Timeout</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Slide-in Form Drawer / Overlay Dialog (High-Fidelity Modal CSS) */}
      {isModalOpen && (
        <div id="add-source-modal-overlay" className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50 p-4 transition-all animate-fade-in">
          <div className="bg-white border border-apple-border rounded-[24px] w-full max-w-sm overflow-hidden p-6 shadow-2xl relative space-y-4 animate-scale-up">
            
            <div className="flex items-center justify-between border-b border-apple-border pb-3">
              <div className="flex items-center space-x-2">
                <div className="h-7 w-7 rounded-lg bg-apple-blue text-white flex items-center justify-center">
                  <PlusCircle className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-bold text-apple-dark">添加新的订阅采集源</h3>
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
                <div className="p-2.5 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-[10px] font-medium flex items-center space-x-1.5 animate-pulse">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-apple-muted uppercase">源名称 (必填)</label>
                <input
                  type="text"
                  placeholder="如 VentureBeat, NVIDIA Developer Blog"
                  value={newSourceName}
                  onChange={(e) => setNewSourceName(e.target.value)}
                  className="w-full px-3 py-2 bg-apple-bg hover:bg-apple-bg focus:bg-white border border-apple-border focus:border-apple-border outline-none rounded-xl text-xs font-medium text-apple-dark transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-apple-muted uppercase">源订阅链接 URL (必填)</label>
                <input
                  type="text"
                  placeholder="https://example.com/rss.xml"
                  value={newSourceUrl}
                  onChange={(e) => setNewSourceUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-apple-bg hover:bg-apple-bg focus:bg-white border border-apple-border focus:border-apple-border outline-none rounded-xl text-xs font-mono font-medium text-apple-dark transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-apple-muted uppercase">获取技术</label>
                  <select
                    value={newSourceType}
                    onChange={(e) => setNewSourceType(e.target.value as 'RSS' | 'WEBSITE')}
                    className="w-full px-2 py-2 bg-apple-bg border border-apple-border outline-none rounded-xl text-xs font-semibold text-apple-dark"
                  >
                    <option value="RSS">RSS XML</option>
                    <option value="WEBSITE">WEB Crawler</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-apple-muted uppercase">领域分类</label>
                  <select
                    value={newSourceCategory}
                    onChange={(e) => setNewSourceCategory(e.target.value)}
                    className="w-full px-2 py-2 bg-apple-bg border border-apple-border outline-none rounded-xl text-xs font-semibold text-apple-dark"
                  >
                    <option value="官方博客">官方博客</option>
                    <option value="海外科技媒体">海外科技媒体</option>
                    <option value="开发者社区">开发者社区</option>
                    <option value="独立黑客周报">独立黑客周报</option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-apple-blue hover:bg-apple-blue-hover text-white font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center space-x-1"
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
