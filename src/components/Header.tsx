/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, 
  Clock, 
  Cpu, 
  HelpCircle, 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { AppConfig } from '../types';

interface HeaderProps {
  activeTab: string;
  appConfig: AppConfig;
  onRefreshFeeds: () => void;
  isRefreshingFeeds: boolean;
}

export default function Header({ 
  activeTab, 
  appConfig, 
  onRefreshFeeds, 
  isRefreshingFeeds 
}: HeaderProps) {
  
  const [timeStr, setTimeStr] = useState('2026-05-24 11:53:45 UTC');
  
  useEffect(() => {
    // Elegant clock simulation
    const interval = setInterval(() => {
      const now = new Date();
      const formatDigit = (num: number) => num.toString().padStart(2, '0');
      const year = now.getFullYear();
      const month = formatDigit(now.getMonth() + 1);
      const day = formatDigit(now.getDate());
      const hours = formatDigit(now.getHours());
      const minutes = formatDigit(now.getMinutes());
      const seconds = formatDigit(now.getSeconds());
      setTimeStr(`${year}-${month}-${day} ${hours}:${minutes}:${seconds}`);
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  const tabDetails: Record<string, { title: string; subtitle: string }> = {
    dashboard: { 
      title: '工作台总览', 
      subtitle: '全面掌控 AI 节点监控、内容生产进度、多渠道 Token 统计与业务大盘。' 
    },
    sources: { 
      title: '内容源中心', 
      subtitle: '追踪海外主流前沿技术官方站点、科技日报 RSS 和独立开发者社区，第一时间拉取原汁英文资讯。' 
    },
    topics: { 
      title: '选题工作台', 
      subtitle: '汇总翻译源数据：英文大纲提炼、AI 中文速读。选定核心题材一键送入写作工坊。' 
    },
    workshop: { 
      title: 'AI 写作工坊', 
      subtitle: '工作台的核心引擎：运用长上下文推理，针对[打工人 / 大学生 / 自由职业者]定制高点击率微信文章。' 
    },
    drafts: { 
      title: '内容与草稿库', 
      subtitle: '管理多受众群体的文章草稿，查看 AI 写作评级，修正错漏，执行终核流程。' 
    },
    publish: { 
      title: '微信发布中心', 
      subtitle: '模拟微信官方公众号界面呈现，查看排版，监测批次自动同步，拉取后台 MediaId。' 
    },
    settings: { 
      title: '控制台设置', 
      subtitle: '设置底座模型参数 (如 Gemini), 绑定微信 AppID 密钥，以及精细化微调多受众的特色注入 Prompt。' 
    }
  };

  const activeDetails = tabDetails[activeTab] || { title: '工作台', subtitle: '管理后台' };

  return (
    <header id="header-container" className="h-16 bg-white/50 backdrop-blur-md border-b border-apple-border px-8 flex items-center justify-between select-none shrink-0">
      {/* Page Title & Sub */}
      <div className="flex flex-col">
        <h1 id="header-page-title" className="text-sm font-bold text-apple-dark tracking-tight flex items-center space-x-2">
          <span>{activeDetails.title}</span>
          <span className="h-1.5 w-1.5 rounded-full bg-apple-border/65"></span>
          <span className="text-[10px] text-apple-blue font-mono tracking-wider font-semibold uppercase">{activeTab}</span>
        </h1>
        <p id="header-page-subtitle" className="text-[11px] text-apple-muted font-medium truncate max-w-lg md:max-w-2xl">{activeDetails.subtitle}</p>
      </div>

      {/* Utilities Container */}
      <div className="flex items-center space-x-4">
        {/* Sync sources status */}
        <button
          onClick={onRefreshFeeds}
          disabled={isRefreshingFeeds}
          id="global-feed-refresh-btn"
          className="flex items-center space-x-1.5 px-4.5 py-1.5 rounded-full border border-apple-border hover:border-apple-border bg-white shadow-xs hover:bg-apple-bg transition-all text-xs font-semibold text-apple-dark cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${isRefreshingFeeds ? 'animate-spin text-apple-blue' : 'text-apple-muted'}`} />
          <span>{isRefreshingFeeds ? '正在下载海外资讯...' : '同步海外资讯'}</span>
        </button>

         {/* Real-time Clock */}
        <div id="system-clock-display" className="hidden lg:flex items-center space-x-2 px-4 py-1.5 rounded-full bg-apple-bg border border-apple-border/50 font-mono text-xs text-apple-muted">
          <Clock className="h-3 w-3 text-apple-muted" />
          <span>{timeStr}</span>
        </div>

        {/* WeChat Sync Quick Badge */}
        <div id="wechat-badge-indicator" className="flex items-center space-x-1.5 text-xs font-medium text-apple-muted">
          <div className={`h-2.5 w-2.5 rounded-full ${appConfig.wechatIsConfigured ? 'bg-emerald-500 shadow-xs shadow-emerald-500/20' : 'bg-[#D2D2D7]'}`}></div>
          <span className="hidden sm:inline">微信网关:</span>
          <span className="font-semibold text-apple-dark">{appConfig.wechatIsConfigured ? '已连接' : '未联通'}</span>
        </div>
      </div>
    </header>
  );
}
