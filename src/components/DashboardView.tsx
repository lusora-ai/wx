/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Cpu, 
  Rss, 
  Lightbulb, 
  Library, 
  Send, 
  TrendingUp, 
  ArrowRight, 
  Clock, 
  Sparkles, 
  CheckCircle, 
  Flame, 
  Settings2 
} from 'lucide-react';
import { SourceFeed, TopicArticle, AiDraft, SystemLog, AppConfig } from '../types';

interface DashboardViewProps {
  sources: SourceFeed[];
  topics: TopicArticle[];
  drafts: AiDraft[];
  logs: SystemLog[];
  appConfig: AppConfig;
  setActiveTab: (tab: string) => void;
  setSelectedTopicIdForWorkshop: (id: string | null) => void;
}

export default function DashboardView({ 
  sources, 
  topics, 
  drafts, 
  logs, 
  appConfig, 
  setActiveTab,
  setSelectedTopicIdForWorkshop
}: DashboardViewProps) {
  
  // High-fidelity business stats
  const activeSourcesCount = sources.filter(s => s.status === 'active').length;
  const pendingTopicsCount = topics.filter(t => t.status === 'pending').length;
  const draftsCount = drafts.length;
  const pendingReviewsCount = drafts.filter(d => d.status === 'pending_review').length;
  const syncedDraftsCount = drafts.filter(d => d.status === 'synced').length;
  
  // Calculate approximate token cost: e.g. $0.05 per 1M tokens (Gemini 2.5 Flash), assuming 80% is Flash, 20% is Pro ($1.25 per 1M). Average: ~$0.29 per 1M.
  const estimatedCostUsd = ((appConfig.monthlyTokenUsed / 1000000) * 0.29).toFixed(2);

  // Highest rated hot topics
  const trendingTopics = [...topics].sort((a, b) => b.hotScore - a.hotScore).slice(0, 2);

  // Quick handoff helper
  const handleQuickWrite = (topicId: string) => {
    setSelectedTopicIdForWorkshop(topicId);
    setActiveTab('workshop');
  };

  return (
    <div id="dashboard-view-wrapper" className="space-y-6 container mx-auto px-1 py-1">
      {/* 1. Statistics Cards (Apple Card Grids) */}
      <section id="stat-cards-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Token Card */}
        <div className="bg-white border border-apple-border rounded-[24px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-apple-muted font-mono tracking-wider">MONTHLY TOKENS</span>
            <div className="h-7 w-7 rounded-lg bg-apple-bg border border-apple-border/50 flex items-center justify-center">
              <Cpu className="h-4 w-4 text-apple-dark" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-2xl font-bold font-sans text-apple-dark leading-tight">
              {(appConfig.monthlyTokenUsed / 10000).toFixed(1)}<span className="text-sm font-medium text-apple-muted">万</span>
            </div>
            <p className="text-[10px] text-apple-muted mt-0.5">
              本月预估费用: <span className="font-mono text-apple-dark font-semibold">${estimatedCostUsd}</span> USD
            </p>
          </div>
          <div className="w-full bg-apple-bg h-1 rounded-full overflow-hidden">
            <div 
              style={{ width: `${(appConfig.monthlyTokenUsed / appConfig.monthlyTokenLimit) * 100}%` }} 
              className="h-full bg-[#0066CC] rounded-full"
            ></div>
          </div>
        </div>

        {/* Source Feeds Card */}
        <div className="bg-white border border-apple-border rounded-[24px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-apple-muted font-mono tracking-wider">ACTIVE SOURCES</span>
            <div className="h-7 w-7 rounded-lg bg-apple-bg border border-apple-border/50 flex items-center justify-center">
              <Rss className="h-4 w-4 text-apple-dark" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-2xl font-bold font-sans text-apple-dark leading-tight">
              {activeSourcesCount}<span className="text-sm font-medium text-apple-muted"> / {sources.length}</span>
            </div>
            <p className="text-[10px] text-emerald-500 mt-0.5 font-medium flex items-center space-x-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>数据拉取轮询在运行中</span>
            </p>
          </div>
          <button 
            onClick={() => setActiveTab('sources')} 
            className="text-[10px] text-apple-muted hover:text-apple-dark font-semibold flex items-center space-x-1 cursor-pointer text-left self-start"
          >
            <span>源中心管理</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        {/* Pending Selection Card */}
        <div className="bg-white border border-apple-border rounded-[24px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-apple-muted font-mono tracking-wider">TOPIC PIPELINE</span>
            <div className="h-7 w-7 rounded-lg bg-apple-bg border border-apple-border/50 flex items-center justify-center">
              <Lightbulb className="h-4 w-4 text-apple-dark" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-2xl font-bold font-sans text-apple-dark leading-tight">
              {pendingTopicsCount}<span className="text-sm font-medium text-apple-muted"> 篇</span>
            </div>
            <p className="text-[10px] text-apple-muted mt-0.5">海外前沿 AI资讯待审并推进</p>
          </div>
          <button 
            onClick={() => setActiveTab('topics')} 
            className="text-[10px] text-apple-muted hover:text-apple-dark font-semibold flex items-center space-x-1 cursor-pointer text-left self-start"
          >
            <span>开始选题决策</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        {/* Synced Drafts Card */}
        <div className="bg-white border border-apple-border rounded-[24px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-apple-muted font-mono tracking-wider">SYNCED POSTS</span>
            <div className="h-7 w-7 rounded-lg bg-apple-bg border border-apple-border/50 flex items-center justify-center">
              <Send className="h-4 w-4 text-apple-dark" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-2xl font-bold font-sans text-apple-dark leading-tight">
              {syncedDraftsCount}<span className="text-sm font-medium text-apple-muted"> / {draftsCount}</span>
            </div>
            <p className="text-[10px] text-apple-muted mt-0.5">其中 <span className="font-semibold text-apple-dark">{pendingReviewsCount} 篇</span> 双向草稿待主编审核</p>
          </div>
          <button 
            onClick={() => setActiveTab('drafts')} 
            className="text-[10px] text-apple-muted hover:text-apple-dark font-semibold flex items-center space-x-1 cursor-pointer text-left self-start"
          >
            <span>审核草稿队列</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

      </section>

      {/* 2. Middle Section: Production Chart & Hot recommendation panel */}
      <section id="middle-dashboard-panels" className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Output Trend Visualizer (Apple Glassmorphic look with hand-drawn SVG representation) */}
        <div className="bg-white border border-apple-border rounded-[24px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)] lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <h3 className="text-xs font-bold text-apple-dark flex items-center space-x-1.5">
                <TrendingUp className="h-4 w-4 text-apple-blue" />
                <span>微信图文生产力趋势 (五月)</span>
              </h3>
              <p className="text-[10px] text-apple-muted font-medium">每日推送文章与 Token 损耗时变对比图表</p>
            </div>
            {/* Segment control inside dashboard card */}
            <div className="flex items-center space-x-1 p-0.5 rounded-xl bg-apple-bg border border-apple-border/50 text-[10px] font-semibold text-apple-muted">
              <span className="px-2 py-1 rounded-lg bg-white text-apple-dark shadow-xs">近 7 天</span>
              <span className="px-1.5 py-1 rounded hover:text-apple-dark cursor-pointer">近 30 天</span>
            </div>
          </div>

          {/* Precise High-Fidelity SVG Line Graph */}
          <div id="recharts-custom-graph" className="h-44 w-full relative pt-2">
            <div className="absolute left-0 bottom-0 top-0 w-8 flex flex-col justify-between text-[9px] font-mono text-apple-muted pr-1">
              <span>50k</span>
              <span>30k</span>
              <span>10k</span>
              <span>0</span>
            </div>
            
            <div className="ml-10 h-36 border-b border-l border-apple-border/60 relative">
              {/* Grid Lines */}
              <div className="absolute left-0 right-0 top-1/4 border-t border-dashed border-apple-border/30 w-full h-[1px]"></div>
              <div className="absolute left-0 right-0 top-2/4 border-t border-dashed border-apple-border/30 w-full h-[1px]"></div>
              <div className="absolute left-0 right-0 top-3/4 border-t border-dashed border-apple-border/30 w-full h-[1px]"></div>
              
              {/* Beautiful paths representing values */}
              <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                {/* Accent Fill under line */}
                <path 
                  d="M 5,95 L 20,80 L 35,45 L 50,70 L 65,30 L 80,15 L 95,15 L 95,95 Z" 
                  fill="url(#trendGrad)" 
                  className="opacity-15"
                />
                {/* Main Line - Styled in Gorgeous Apple Blue */}
                <path 
                  d="M 5,95 L 20,80 L 35,45 L 50,70 L 65,30 L 80,15 L 95,15" 
                  fill="none" 
                  stroke="#0066CC" 
                  strokeWidth="2.2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                />
                
                {/* Gradient Definitions */}
                <defs>
                  <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0066CC" />
                    <stop offset="100%" stopColor="#0066CC" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Circles at nodes */}
                <circle cx="5" cy="95" r="2" fill="#0066CC" />
                <circle cx="20" cy="80" r="2" fill="#0066CC" />
                <circle cx="35" cy="45" r="2" fill="#0066CC" />
                <circle cx="50" cy="70" r="2" fill="#0066CC" stroke="#ffffff" strokeWidth="0.5" />
                <circle cx="65" cy="30" r="2.5" fill="#0066cc" stroke="#ffffff" strokeWidth="0.5" />
                <circle cx="80" cy="15" r="3" fill="#0066cc" stroke="#ffffff" strokeWidth="0.8" />
                <circle cx="95" cy="15" r="3" fill="#0066cc" stroke="#ffffff" strokeWidth="0.8" />
              </svg>
            </div>
            
            {/* Legend label text along x-axis */}
            <div className="ml-10 mt-1 flex justify-between text-[9px] font-mono text-apple-muted">
              <span>05-18 (周一)</span>
              <span>05-19</span>
              <span>05-20</span>
              <span>05-21</span>
              <span>05-22</span>
              <span>05-23</span>
              <span>05-24 (今天)</span>
            </div>
          </div>

          <div className="pt-2 border-t border-apple-border/50 flex items-center justify-between text-[10px] text-apple-muted">
            <span className="flex items-center space-x-1">
              <span className="inline-block h-2 w-2 rounded-full bg-apple-blue"></span>
              <span>大模型内容生成请求 (词数/Token 估算)</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="inline-block h-2 w-3 rounded-md bg-[#0066CC]/15"></span>
              <span>微信公众号草稿同步成功率: <strong className="text-apple-dark font-semibold">100%</strong></span>
            </span>
          </div>

        </div>

        {/* Hot Overseas AI Headlines needing attention */}
        <div className="bg-white border border-apple-border rounded-[24px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex flex-col">
              <h3 className="text-xs font-bold text-apple-dark flex items-center space-x-1.5">
                <Flame className="h-4 w-4 text-amber-500" />
                <span>极力推荐前沿选题 ({trendingTopics.length})</span>
              </h3>
              <p className="text-[10px] text-apple-muted font-medium">海外热度较高、读者群极感兴趣的前沿文章</p>
            </div>

            <div className="space-y-3">
              {trendingTopics.map((topic) => {
                return (
                  <div key={topic.id} className="p-3 bg-apple-bg hover:bg-apple-bg/75 border border-apple-border/50 rounded-2xl transition-all space-y-2">
                    <div className="flex items-start justify-between space-x-2">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-apple-border/40 text-apple-dark font-mono tracking-wider">{topic.category}</span>
                      <span className="text-[10px] font-semibold text-amber-600 flex items-center font-mono opacity-90">
                        🔥 Hot {topic.hotScore}
                      </span>
                    </div>
                    <h4 className="text-[11px] font-bold text-apple-dark leading-snug line-clamp-2 hover:underline cursor-pointer">
                      {topic.translatedTitle}
                    </h4>
                    <p className="text-[10px] text-apple-muted line-clamp-2 leading-relaxed">{topic.summary}</p>
                    <div className="flex justify-between items-center pt-2 text-[9px] font-mono text-apple-muted border-t border-apple-border/30">
                      <span>来自 {topic.sourceName}</span>
                      <button 
                        onClick={() => handleQuickWrite(topic.id)} 
                        className="text-apple-blue hover:text-apple-blue-hover font-semibold flex items-center space-x-0.5 cursor-pointer"
                      >
                        <span>立即写作</span>
                        <ArrowRight className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button 
            onClick={() => setActiveTab('topics')} 
            className="w-full text-center text-xs font-semibold text-apple-muted hover:text-apple-dark pt-3 border-t border-apple-border/40 flex items-center justify-center space-x-1 cursor-pointer"
          >
            <span>进入选题面板挑选更多</span>
            <ArrowRight className="h-3 w-3 text-apple-muted" />
          </button>
        </div>

      </section>

      {/* 3. Bottom Section: Recent active logs & Quick remote block */}
      <section id="bottom-log-panel" className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Operation logs listing */}
        <div className="bg-white border border-apple-border rounded-[24px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)] lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <h3 className="text-xs font-bold text-apple-dark flex items-center space-x-1.5">
                <Clock className="h-4 w-4 text-apple-blue" />
                <span>控制台任务审计日志与事件反馈</span>
              </h3>
              <p className="text-[10px] text-apple-muted font-medium">包含 RSS 定时扫描、大语言模型生成记录和微信接口同步凭证</p>
            </div>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-apple-bg text-apple-dark border border-apple-border/20">
              本周审计事务: {logs.length}
            </span>
          </div>

          <div className="divide-y divide-apple-border/30 max-h-56 overflow-y-auto">
            {logs.slice(0, 5).map((log) => {
              return (
                <div key={log.id} className="py-2.5 flex items-start justify-between space-x-4 text-[11px]">
                  <div className="flex items-start space-x-2.5 min-w-0">
                    <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${
                      log.type === 'success' 
                        ? 'bg-emerald-500' 
                        : log.type === 'warning'
                          ? 'bg-amber-500'
                          : log.type === 'error'
                            ? 'bg-rose-500'
                            : 'bg-apple-muted'
                    }`}></span>
                    <div className="min-w-0">
                      <p className="text-apple-dark font-medium line-clamp-1">{log.action}</p>
                      <div className="flex items-center space-x-2 text-[9px] font-mono text-apple-muted mt-0.5">
                        <span className="font-semibold text-apple-dark/80">{log.module}</span>
                        <span>•</span>
                        <span>操盘手: {log.operator}</span>
                        {log.tokensUsed && (
                          <>
                            <span>•</span>
                            <span className="text-apple-muted">消耗: {log.tokensUsed} tokens</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono text-apple-muted text-right shrink-0 whitespace-nowrap mt-0.5">{log.time}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sleek Tool belt (Apple inspired remote grid) */}
        <div id="quick-toolset-panel" className="bg-white border border-apple-border rounded-[24px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex flex-col">
              <h3 className="text-xs font-bold text-apple-dark flex items-center space-x-1.5">
                <Settings2 className="h-4 w-4 text-apple-blue" />
                <span>多端协同快捷小功能</span>
              </h3>
              <p className="text-[10px] text-apple-muted font-medium">一键启动系统高频操作通道</p>
            </div>

            <div className="grid grid-cols-2 gap-3 pb-2">
              <button 
                onClick={() => setActiveTab('sources')} 
                className="p-3 rounded-2xl border border-apple-border/40 bg-apple-bg/50 hover:bg-apple-bg hover:border-apple-border transition-all text-left space-y-1.5 cursor-pointer group"
              >
                <Rss className="h-4 w-4 text-apple-muted group-hover:text-apple-blue transition-colors" />
                <div className="text-[10px] font-bold text-apple-dark">配置内容源</div>
                <div className="text-[9px] leading-tight text-apple-muted">新增 RSS/URL 跟踪</div>
              </button>

              <button 
                onClick={() => setActiveTab('topics')} 
                className="p-3 rounded-2xl border border-apple-border/40 bg-apple-bg/50 hover:bg-apple-bg hover:border-apple-border transition-all text-left space-y-1.5 cursor-pointer group"
              >
                <Lightbulb className="h-4 w-4 text-apple-muted group-hover:text-amber-500 transition-colors" />
                <div className="text-[10px] font-bold text-apple-dark">筛选热点</div>
                <div className="text-[9px] leading-tight text-apple-muted">查看今日科技头条</div>
              </button>

              <button 
                onClick={() => setActiveTab('workshop')} 
                className="p-3 rounded-2xl border border-apple-border/40 bg-apple-bg/50 hover:bg-apple-bg hover:border-apple-border transition-all text-left space-y-1.5 cursor-pointer group"
              >
                <Sparkles className="h-4 w-4 text-apple-muted group-hover:text-apple-blue transition-colors" />
                <div className="text-[10px] font-bold text-apple-dark">AI 写作</div>
                <div className="text-[9px] leading-tight text-apple-muted">定制微信三版本图文</div>
              </button>

              <button 
                onClick={() => setActiveTab('drafts')} 
                className="p-3 rounded-2xl border border-apple-border/40 bg-apple-bg/50 hover:bg-apple-bg hover:border-apple-border transition-all text-left space-y-1.5 cursor-pointer group"
              >
                <Library className="h-4 w-4 text-apple-muted group-hover:text-emerald-500 transition-colors" />
                <div className="text-[10px] font-bold text-apple-dark">审核成文</div>
                <div className="text-[9px] leading-tight text-apple-muted">打主审分回填批改</div>
              </button>
            </div>
          </div>

          <div className="pt-3 border-t border-apple-border/50 flex items-center justify-between text-[9px] font-mono text-apple-muted">
            <span>当前可用模型: Gemini 2.5 Pro</span>
            <span className="text-apple-blue hover:text-apple-blue-hover hover:underline cursor-pointer font-semibold" onClick={() => setActiveTab('settings')}>参数调优</span>
          </div>
        </div>

      </section>
    </div>
  );
}
