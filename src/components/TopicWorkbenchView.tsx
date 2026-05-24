/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Lightbulb, 
  Search, 
  ArrowRight, 
  Clock, 
  TrendingUp, 
  Archive, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Flame,
  CheckCircle2,
  Bookmark,
  FileText
} from 'lucide-react';
import { TopicArticle } from '../types';

interface TopicWorkbenchViewProps {
  topics: TopicArticle[];
  onPushToWorkshop: (id: string) => void;
  onArchiveTopic: (id: string) => void;
}

export default function TopicWorkbenchView({
  topics,
  onPushToWorkshop,
  onArchiveTopic
}: TopicWorkbenchViewProps) {
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [minHotScore, setMinHotScore] = useState(0);
  const [expandedTopicId, setExpandedTopicId] = useState<string | null>('topic-1'); // Default expand first for high-fidelity ease of assessment

  // Category and sorting logic
  const categories = ['ALL', ...Array.from(new Set(topics.map(t => t.category)))];

  const filteredTopics = topics.filter(topic => {
    const matchesSearch = topic.translatedTitle.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          topic.originalTitle.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          topic.summary.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'ALL' || topic.category === selectedCategory;
    const matchesHot = topic.hotScore >= minHotScore;
    
    return matchesSearch && matchesCategory && matchesHot;
  });

  const toggleExpand = (id: string) => {
    if (expandedTopicId === id) {
      setExpandedTopicId(null);
    } else {
      setExpandedTopicId(id);
    }
  };

  return (
    <div id="topics-view-wrapper" className="space-y-6 container mx-auto px-1 py-1">
      
      {/* Dynamic Filter bar to match Apple Design system */}
      <div className="bg-white border border-apple-border rounded-[24px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Search phrase */}
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-apple-muted" />
            <input
              type="text"
              id="topic-search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索资讯、大纲关键词、原英文词组..."
              className="w-full pl-9 pr-4 py-2 bg-apple-bg hover:bg-apple-bg border border-apple-border focus:border-apple-border focus:bg-white rounded-xl text-xs outline-none transition-all font-medium text-apple-dark placeholder-apple-muted/80"
            />
          </div>

          {/* Model Slider Hot selection */}
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <SlidersHorizontal className="h-3.5 w-3.5 text-apple-muted" />
              <span className="text-[11px] font-semibold text-apple-muted">热度阈值:</span>
              <input 
                type="range" 
                min="0" 
                max="90" 
                value={minHotScore}
                onChange={(e) => setMinHotScore(parseInt(e.target.value))}
                className="w-24 h-1 bg-[#E5E5E7] rounded-lg appearance-none cursor-pointer accent-apple-blue" 
              />
              <span className="font-mono text-xs font-bold text-apple-dark">{minHotScore}+</span>
            </div>

            <div className="h-4 w-[1px] bg-apple-border/50"></div>

            <div className="flex items-center space-x-1 p-0.5 rounded-xl bg-apple-bg border border-apple-border/50 text-xs font-semibold text-apple-muted">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    selectedCategory === cat 
                      ? 'bg-white text-apple-dark shadow-xs font-semibold' 
                      : 'hover:text-apple-dark text-apple-muted'
                  }`}
                >
                  {cat === 'ALL' ? '全部领域' : cat}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Row list of Topic Articles */}
      <div id="topics-list-container" className="space-y-4">
        {filteredTopics.length === 0 ? (
          <div className="p-12 text-center bg-white border border-apple-border rounded-[24px] flex flex-col items-center justify-center space-y-2">
            <Lightbulb className="h-8 w-8 text-apple-muted/65" />
            <h4 className="text-xs font-bold text-apple-dark">没有找到匹配的资讯选题</h4>
            <p className="text-[10px] text-apple-muted">请尝试放宽筛选词或者在右上角再次进行海外 RSS 抓取</p>
          </div>
        ) : (
          filteredTopics.map((topic) => {
            const isExpanded = expandedTopicId === topic.id;
            const isPushed = topic.status === 'pushed';
            const isArchived = topic.status === 'archived';

            return (
              <div 
                key={topic.id}
                id={`topic-row-${topic.id}`}
                className={`bg-white border rounded-[24px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.01)] transition-all ${
                  isExpanded 
                    ? 'border-apple-border/90' 
                    : 'border-apple-border/60 hover:border-apple-border'
                } ${isArchived ? 'opacity-65' : ''}`}
              >
                {/* Header Row */}
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1 select-text">
                    <div className="flex items-center space-x-2.5">
                      <span className="text-[9px] font-bold font-mono tracking-wider px-2 py-0.5 rounded bg-apple-dark text-white leading-none">
                        {topic.category}
                      </span>
                      <span className="text-[10px] text-apple-muted font-mono flex items-center space-x-1 font-medium">
                        <Clock className="h-3 w-3" />
                        <span>抓取于 {topic.pullTime}</span>
                      </span>
                      <span className="text-[10px] text-apple-muted font-mono font-medium">
                        • {topic.readingTime} 英文阅读时长
                      </span>
                    </div>

                    <h3 className="text-xs font-bold text-apple-dark pr-4 leading-normal mt-1">
                      {topic.translatedTitle}
                    </h3>
                    
                    <p className="text-[10px] font-mono text-apple-muted line-clamp-1 italic max-w-4xl tracking-tight">
                      EN: {topic.originalTitle}
                    </p>
                  </div>

                  {/* Hot meter & Toggle actions */}
                  <div className="flex items-center space-x-3 shrink-0">
                    <div className="flex items-center space-x-1 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-lg px-2 py-1 select-none text-[10px] font-sans font-bold">
                      <Flame className="h-3.5 w-3.5 fill-amber-500 text-amber-500 animate-pulse" />
                      <span>热度 {topic.hotScore}</span>
                    </div>

                    <button 
                      onClick={() => toggleExpand(topic.id)}
                      className="p-1.5 rounded-lg border border-apple-border hover:bg-apple-bg text-apple-muted hover:text-apple-dark transition-all cursor-pointer"
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Always visible Abstract Summary */}
                <div className="mt-3.5 p-3.5 rounded-2xl bg-apple-bg border border-apple-border/40 text-[11px] leading-relaxed text-apple-dark font-medium select-text">
                  <strong className="text-apple-dark font-bold block mb-1 text-[10px] tracking-wide">AI 提炼之中文摘要：</strong>
                  {topic.summary}
                </div>

                {/* Collapsible Outlines comparison zone */}
                {isExpanded && (
                  <div id={`topic-expanded-${topic.id}`} className="mt-5 pt-4 border-t border-apple-border/50 grid grid-cols-1 md:grid-cols-2 gap-5 animate-fade-in">
                    
                    {/* Chinese Outline */}
                    <div className="p-4 rounded-xl border border-apple-border/40 bg-apple-bg/30">
                      <h4 className="text-[10px] font-bold text-apple-dark uppercase tracking-wider mb-2.5 flex items-center space-x-1">
                        <FileText className="h-3.5 w-3.5 text-apple-blue" />
                        <span>AI 预排版中文大纲 (参考)</span>
                      </h4>
                      <ul className="space-y-2 list-none text-[11px] text-apple-dark">
                        {topic.chineseOutline.map((line, idx) => (
                          <li key={idx} className="flex items-start space-x-1.5 font-medium leading-relaxed">
                            <span className="font-mono text-[10px] font-extrabold text-apple-blue mt-0.5 whitespace-nowrap">{idx+1}.</span>
                            <span>{line}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Original English Outline */}
                    <div className="p-4 rounded-xl border border-apple-border/40 bg-apple-bg/10 font-mono">
                      <h4 className="text-[10px] font-bold text-apple-muted uppercase tracking-wider mb-2.5 flex items-center space-x-1">
                        <Bookmark className="h-3.5 w-3.5 text-apple-muted/80" />
                        <span>Original English Syllabus</span>
                      </h4>
                      <ul className="space-y-2 list-none text-[11px] text-apple-muted">
                        {topic.englishOutline.map((line, idx) => (
                          <li key={idx} className="flex items-start space-x-1.5 leading-relaxed">
                            <span className="text-[10px] font-bold text-apple-muted/50 mt-0.5 whitespace-nowrap">{idx+1}.</span>
                            <span>{line}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                  </div>
                )}

                {/* Action Controls footer */}
                <div className="mt-4 pt-3.5 border-t border-apple-border/40 flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-[10px] font-mono text-apple-muted font-medium">
                    <span>源站点代号: {topic.sourceId}</span>
                    <span>•</span>
                    <a 
                      href={topic.originalUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-apple-muted hover:text-apple-dark hover:underline flex items-center space-x-0.5 cursor-pointer"
                    >
                      <span>访问英文源址</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>

                  <div className="flex items-center space-x-2">
                    {/* Archive toggle */}
                    {!isPushed && (
                      <button
                        onClick={() => onArchiveTopic(topic.id)}
                        className={`text-xs px-3 py-1.5 rounded-xl border font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                          isArchived
                            ? 'border-apple-border bg-apple-bg text-apple-dark'
                            : 'border-apple-border text-apple-muted hover:text-apple-dark hover:bg-apple-bg'
                        }`}
                      >
                        <Archive className="h-3.5 w-3.5" />
                        <span>{isArchived ? '已归档' : '归档'}</span>
                      </button>
                    )}

                    {/* Push forward write */}
                    <button
                      onClick={() => onPushToWorkshop(topic.id)}
                      disabled={isPushed}
                      className={`text-xs font-bold px-4 py-1.5 rounded-xl transition-all cursor-pointer flex items-center space-x-1 shadow-xs ${
                        isPushed 
                          ? 'bg-apple-bg border border-apple-border text-apple-muted cursor-not-allowed' 
                          : 'bg-apple-blue hover:bg-apple-blue-hover text-white border border-[#0066CC] font-bold'
                      }`}
                    >
                      {isPushed ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          <span>已进入写作队列</span>
                        </>
                      ) : (
                        <>
                          <span>推送至 AI 写作工坊</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>

              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
