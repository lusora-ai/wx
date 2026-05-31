/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  LayoutDashboard, 
  Rss, 
  Lightbulb, 
  Sparkles, 
  Library, 
  Send, 
  Settings, 
  Cpu, 
  TrendingUp, 
  User 
} from 'lucide-react';
import { SourceFeed, TopicArticle, AiDraft, AppConfig } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  sources: SourceFeed[];
  topics: TopicArticle[];
  drafts: AiDraft[];
  appConfig: AppConfig;
}

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  sources, 
  topics, 
  drafts, 
  appConfig 
}: SidebarProps) {
  
  // Calculate dynamic notifications
  const pendingTopicsCount = topics.filter(t => t.status === 'pending').length;
  const pendingReviewsCount = drafts.filter(d => d.status === 'pending_review').length;
  
  const menuItems = [
    { 
      id: 'dashboard', 
      label: '工作台总览', 
      sub: 'Dashboard',
      icon: LayoutDashboard,
      badge: 0 
    },
    { 
      id: 'sources', 
      label: '内容源中心', 
      sub: 'Content Sources',
      icon: Rss,
      badge: sources.filter(s => s.status === 'error').length ? '!' : 0,
      badgeType: 'warning'
    },
    { 
      id: 'topics', 
      label: '选题工作台', 
      sub: 'Topic Selector',
      icon: Lightbulb,
      badge: pendingTopicsCount 
    },
    { 
      id: 'workshop', 
      label: 'AI 写作工坊', 
      sub: 'AI Writer Studio',
      icon: Sparkles,
      badge: 0 
    },
    { 
      id: 'drafts', 
      label: '内容与草稿库', 
      sub: 'Content Library',
      icon: Library,
      badge: pendingReviewsCount,
      badgeType: 'primary' 
    },
    { 
      id: 'publish', 
      label: '微信发布中心', 
      sub: 'WeChat Publisher',
      icon: Send,
      badge: drafts.filter(d => d.status === 'approved').length
    },
    { 
      id: 'settings', 
      label: '控制台设置', 
      sub: 'System Settings',
      icon: Settings,
      badge: 0 
    }
  ];

  const tokenUsagePercentage = Math.round((appConfig.monthlyTokenUsed / appConfig.monthlyTokenLimit) * 100);

  return (
    <aside id="sidebar-container" className="w-64 bg-white/80 backdrop-blur-md border-r border-apple-border flex flex-col h-full select-none">
      {/* Brand Header */}
      <div id="brand-header" className="p-6 pb-5 flex items-center space-x-3 border-b border-apple-border/50">
        <div id="brand-logo" className="h-8 w-8 rounded-lg bg-apple-blue flex items-center justify-center relative shadow-xs overflow-hidden">
          <span className="font-sans font-bold text-sm text-white">顺</span>
        </div>
        <div className="flex flex-col">
          <span className="font-sans font-bold text-base tracking-tight text-apple-dark">小顺 AI 工作台</span>
          <span className="font-mono text-xs text-apple-muted tracking-wide">XIAOSHUN WORKBENCH</span>
        </div>
      </div>

      {/* Main Navigation Tab Container */}
      <nav id="sidebar-nav" className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
        <div className="text-caption-readable uppercase tracking-wider font-bold px-3 mb-2">主控制台</div>
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`sidebar-btn-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              className={`w-full group px-3 py-2.5 rounded-xl flex items-center justify-between text-left transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-apple-bg text-apple-dark font-semibold'
                  : 'text-apple-text-secondary hover:text-apple-dark hover:bg-apple-bg/55'
              }`}
            >
              <div className="flex items-center space-x-3">
                <IconComponent className={`h-[18px] w-[18px] transition-colors ${isActive ? 'text-apple-blue' : 'text-apple-text-secondary group-hover:text-apple-dark'}`} />
                <div className="flex flex-col">
                  <span className={`text-sm font-medium ${isActive ? 'text-apple-dark font-semibold' : 'text-apple-text-secondary group-hover:text-apple-dark'}`}>{item.label}</span>
                  <span id={`sidebar-sub-${item.id}`} className="text-caption-readable font-mono tracking-wide">{item.sub}</span>
                </div>
              </div>
              {item.badge !== 0 && (
                <span className={`px-2 py-0.5 rounded-full text-badge-readable font-mono font-bold leading-none ${
                    isActive
                      ? 'bg-white text-apple-dark border border-apple-border/20'
                      : item.badgeType === 'warning'
                        ? 'bg-amber-50 text-amber-600'
                        : item.badgeType === 'primary'
                          ? 'bg-[#0066CC]/10 text-apple-blue'
                          : 'bg-apple-bg text-apple-text-secondary'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Profile and Token Usage Monitor */}
      <div id="sidebar-footer" className="p-4 border-t border-apple-border/50 bg-apple-bg/30 space-y-4">
        {/* Token Balance Indicator */}
        <div id="token-usage-bar" className="space-y-1.5 p-3 rounded-2xl bg-apple-bg">
          <div className="flex items-center justify-between text-meta-readable font-medium">
            <span className="flex items-center space-x-1 uppercase tracking-wider">
              <span>Token 消耗</span>
            </span>
            <span className="font-mono text-apple-dark font-semibold">{tokenUsagePercentage}%</span>
          </div>
          <div className="w-full bg-[#E5E5E7] h-1.5 rounded-full overflow-hidden">
            <div
              style={{ width: `${tokenUsagePercentage}%` }}
              className={`h-full rounded-full transition-all duration-500 ${tokenUsagePercentage > 85 ? 'bg-rose-500' : 'bg-apple-blue'}`}
            ></div>
          </div>
          <div className="flex justify-between text-caption-readable font-mono">
            <span>已用 {(appConfig.monthlyTokenUsed / 10000).toFixed(1)}W</span>
            <span>额度 {(appConfig.monthlyTokenLimit / 10000).toFixed(0)}W</span>
          </div>
        </div>

        {/* User Card */}
        <div id="user-profile-card" className="flex items-center justify-between px-2">
          <div className="flex items-center space-x-2.5">
            <div className="h-8 w-8 rounded-full bg-[#0066CC]/10 border border-apple-blue/20 flex items-center justify-center overflow-hidden">
              <User className="h-4 w-4 text-apple-blue" />
            </div>
            <div className="flex flex-col">
              <span className="text-meta-readable font-semibold text-apple-dark">顺子老师</span>
              <span className="text-caption-readable text-apple-muted font-mono">CHIEF OPERATOR</span>
            </div>
          </div>
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="运行环境正常"></div>
        </div>
      </div>
    </aside>
  );
}
