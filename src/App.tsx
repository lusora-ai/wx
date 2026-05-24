/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardView from './components/DashboardView';
import SourceCenterView from './components/SourceCenterView';
import TopicWorkbenchView from './components/TopicWorkbenchView';
import AiWorkshopView from './components/AiWorkshopView';
import DraftLibraryView from './components/DraftLibraryView';
import PublishCenterView from './components/PublishCenterView';
import SettingsView from './components/SettingsView';

import { 
  SourceFeed, 
  TopicArticle, 
  AiDraft, 
  SystemLog, 
  ModelSetting, 
  AppConfig, 
  SyncTask 
} from './types';

import { 
  initialSources, 
  initialTopics, 
  initialDrafts, 
  initialLogs, 
  defaultModelSetting, 
  initialConfig 
} from './data/mockData';

export default function App() {
  // Global States loaded from mockup models
  const [sources, setSources] = useState<SourceFeed[]>(() => {
    const saved = localStorage.getItem('xs_sources');
    return saved ? JSON.parse(saved) : initialSources;
  });

  const [topics, setTopics] = useState<TopicArticle[]>(() => {
    const saved = localStorage.getItem('xs_topics');
    return saved ? JSON.parse(saved) : initialTopics;
  });

  const [drafts, setDrafts] = useState<AiDraft[]>(() => {
    const saved = localStorage.getItem('xs_drafts');
    return saved ? JSON.parse(saved) : initialDrafts;
  });

  const [logs, setLogs] = useState<SystemLog[]>(() => {
    const saved = localStorage.getItem('xs_logs');
    return saved ? JSON.parse(saved) : initialLogs;
  });

  const [appConfig, setAppConfig] = useState<AppConfig>(() => {
    const saved = localStorage.getItem('xs_app_config');
    return saved ? JSON.parse(saved) : initialConfig;
  });

  const [modelSetting, setModelSetting] = useState<ModelSetting>(() => {
    const saved = localStorage.getItem('xs_model_setting');
    return saved ? JSON.parse(saved) : defaultModelSetting;
  });

  // Navigation tab switcher state
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Multi-view sync values helper (stores handoff references)
  const [selectedTopicIdForWorkshop, setSelectedTopicIdForWorkshop] = useState<string | null>(null);
  const [selectedDraftIdForPublish, setSelectedDraftIdForPublish] = useState<string | null>(null);

  // Synchronizing task queue indicators
  const [syncTasks, setSyncTasks] = useState<SyncTask[]>([]);
  const [isRefreshingFeeds, setIsRefreshingFeeds] = useState(false);

  // Auto save database parameters into Client-side storage 
  useEffect(() => {
    localStorage.setItem('xs_sources', JSON.stringify(sources));
    localStorage.setItem('xs_topics', JSON.stringify(topics));
    localStorage.setItem('xs_drafts', JSON.stringify(drafts));
    localStorage.setItem('xs_logs', JSON.stringify(logs));
    localStorage.setItem('xs_app_config', JSON.stringify(appConfig));
    localStorage.setItem('xs_model_setting', JSON.stringify(modelSetting));
  }, [sources, topics, drafts, logs, appConfig, modelSetting]);

  // Append new system records
  const addSystemLog = (module: string, action: string, type: SystemLog['type'], tokensUsed?: number) => {
    const newLog: SystemLog = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      time: new Date().toISOString().replace('T', ' ').substring(0, 19),
      module,
      action,
      operator: '顺子老师 (主理人)',
      type,
      tokensUsed
    };
    setLogs(prev => [newLog, ...prev]);

    // Track tokens cost if appropriate
    if (tokensUsed) {
      setAppConfig(prev => ({
        ...prev,
        monthlyTokenUsed: prev.monthlyTokenUsed + tokensUsed
      }));
    }
  };

  // 1. Source Feed Actions
  const handleAddSource = (sourceData: Omit<SourceFeed, 'id' | 'articleCount' | 'lastChecked'>) => {
    const newSource: SourceFeed = {
      ...sourceData,
      id: `src-${Date.now()}`,
      articleCount: 0,
      lastChecked: '从未检查'
    };
    setSources(prev => [...prev, newSource]);
    addSystemLog('采集源管理', `成功追加了新的订阅通道 [${sourceData.name}]，等待首期资讯验证获取。`, 'success');
  };

  const handleDeleteSource = (id: string) => {
    const targetSource = sources.find(s => s.id === id);
    setSources(prev => prev.filter(s => s.id !== id));
    addSystemLog('采集源管理', `彻底移除了采集订阅通道 [${targetSource?.name || '未知源'}]。`, 'warning');
  };

  const handleToggleSourceStatus = (id: string) => {
    setSources(prev => prev.map(s => {
      if (s.id === id) {
        const nextStatus: SourceFeed['status'] = s.status === 'active' ? 'inactive' : 'active';
        addSystemLog('采集源管理', `切换订阅源 [${s.name}] 的可用状态为 [${nextStatus === 'active' ? '正常启用' : '挂起暂停'}]。`, 'info');
        return { ...s, status: nextStatus };
      }
      return s;
    }));
  };

  const handleVerifyCheckSource = (id: string) => {
    // Simulates validating an RSS feed with a direct ping
    setSources(prev => prev.map(s => {
      if (s.id === id) {
        addSystemLog('采集源监控', `验证连接订阅配置: 对 [${s.name}] 发起试探性 Ping 检查...`, 'info');
        setTimeout(() => {
          setSources(cur => cur.map(now => {
            if (now.id === id) {
              addSystemLog('采集源中心', `采集成功：[${now.name}] 通道校验合格，增量抓取 0 篇新内容。`, 'success');
              return {
                ...now,
                status: 'active',
                lastChecked: new Date().toISOString().replace('T', ' ').substring(0, 16)
              };
            }
            return now;
          }));
        }, 1000);
        return s;
      }
      return s;
    }));
  };

  const handleRefreshGlobalFeeds = () => {
    setIsRefreshingFeeds(true);
    addSystemLog('采集调度', '点击开始轮询拉取今日海外各大科技资讯站点 RSS 文章...', 'info');

    setTimeout(() => {
      setIsRefreshingFeeds(false);

      // Simulates adding 1 more topic from Hacker News summary to indicate growth
      const newBonusTopic: TopicArticle = {
        id: `topic-${Date.now()}`,
        originalTitle: 'NVIDIA Omniverse upgrades with Gemini models: Interactive CAD 3D editing inside VR space',
        originalUrl: 'https://developer.nvidia.com/omniverse',
        sourceId: 'src-4',
        sourceName: 'NVIDIA Developer Blog',
        pullTime: new Date().toISOString().replace('T', ' ').substring(0, 16),
        translatedTitle: '英伟达 Omniverse 联动 Gemini：支持虚拟现实 VR 空间下智能 3D 精细编排',
        summary: '英伟达宣布完成 Omniverse 主物理引擎与轻量大语言模型 Gemini API 深度绑定。工程师现在可以采用纯自然语言，实时生成、调度并测试带有高能物理刚性动力学模拟的 CAD 数字孪生，极大释放工业模型加工效率。',
        rawContent: 'NVIDIA today unlocked seamless real-time neural 3D editing integrations. Gemini models parse semantic layouts inside VR goggles, translating conversational commands into fine-grained geometric parameters. Spatial computing developers are calling it a landmark shift for rapid industrial asset engineering.',
        englishOutline: [
          'Unveiling of NV-Omniverse spatial upgrades.',
          'The rendering layer: Conversational scene orchestration.',
          'Safety protocols and multi-user sync benchmarks.'
        ],
        chineseOutline: [
          '英伟达全新空间渲染版本登场。',
          '交互细节拆讲：如何通过自然语言下达指令实时润饰 CAD 模型。',
          '工业协同安全系数与网络延时数据。'
        ],
        category: '模型发布',
        readingTime: '3 min',
        status: 'pending',
        hotScore: 88
      };

      setTopics(prev => {
        // Prevent duplicate appending
        if (prev.some(t => t.originalTitle.includes('Omniverse'))) return prev;
        return [newBonusTopic, ...prev];
      });

      // Update source checklist count
      setSources(prev => prev.map(s => {
        if (s.id === 'src-4') {
          return { ...s, articleCount: s.articleCount + 1, lastChecked: new Date().toISOString().replace('T', ' ').substring(0, 16) };
        }
        return { ...s, lastChecked: new Date().toISOString().replace('T', ' ').substring(0, 16) };
      }));

      addSystemLog('采集源中心', '海外 RSS 定时扫描成功。拉入 1 篇关于 [英伟达CAD 3D立体空间编辑] 的前沿科技选题，首批翻译已推送。', 'success', 3500);
    }, 1500);
  };

  // 2. Topic selecting actions
  const handlePushToWorkshop = (id: string) => {
    setTopics(prev => prev.map(t => {
      if (t.id === id) {
        addSystemLog('选题工作台', `选定最新科技议题并推送至工坊: [${t.translatedTitle}]，已挂入生成队列。`, 'success');
        return { ...t, status: 'pushed' };
      }
      return t;
    }));
    setSelectedTopicIdForWorkshop(id);
    setActiveTab('workshop'); // shift tab
  };

  const handleArchiveTopic = (id: string) => {
    setTopics(prev => prev.map(t => {
      if (t.id === id) {
        const nextStatus: TopicArticle['status'] = t.status === 'archived' ? 'pending' : 'archived';
        addSystemLog('选题工作台', `把选题文章 [${t.translatedTitle}] 执行 [${nextStatus === 'archived' ? '标记归档' : '恢复激活'}]。`, 'info');
        return { ...t, status: nextStatus };
      }
      return t;
    }));
  };

  // 3. Workshop & saving drafts
  const handleSaveDraftToLibrary = (updatedDraft: AiDraft) => {
    setDrafts(prev => {
      const exists = prev.some(d => d.id === updatedDraft.id);
      if (exists) {
        addSystemLog('AI写作工坊', `更新了 AI 图文草稿 [${updatedDraft.versions[updatedDraft.selectedAudience].title.substring(0, 20)}...] 的内容、主编反馈以及多版本。`, 'success', updatedDraft.tokenCost);
        return prev.map(d => d.id === updatedDraft.id ? updatedDraft : d);
      } else {
        addSystemLog('AI写作工坊', `成功将新生成的打工、学生等分众多版本精美草稿保存加入草稿库，主编星级评分待标。`, 'success', updatedDraft.tokenCost);
        return [updatedDraft, ...prev];
      }
    });
  };

  const handleUpdateDraftStatus = (id: string, status: AiDraft['status'], score?: number, feedback?: string) => {
    setDrafts(prev => prev.map(d => {
      if (d.id === id) {
        const payloadScore = score !== undefined ? score : d.reviewScore;
        const payloadFeedback = feedback !== undefined ? feedback : d.reviewerFeedback;
        
        let logAction = `审核意见录入。草稿 [${d.versions[d.selectedAudience].title.substring(0, 15)}...] 状态标记为 [${status}]`;
        if (score) {
          logAction += `，主编给予 [${score}星/优秀] 优质成文评级`;
        }
        
        addSystemLog('内容库中心', logAction, 'success');
        return { 
          ...d, 
          status, 
          reviewScore: payloadScore, 
          reviewerFeedback: payloadFeedback,
          lastEdited: new Date().toISOString().replace('T', ' ').substring(0, 16)
        };
      }
      return d;
    }));
  };

  const handleDeleteDraft = (id: string) => {
    const targetDraft = drafts.find(d => d.id === id);
    setDrafts(prev => prev.filter(d => d.id !== id));
    addSystemLog('内容库中心', `把草稿 [${targetDraft?.versions[targetDraft.selectedAudience].title.substring(0, 20)}...] 彻底销毁，缓存数据已抹除。`, 'warning');
  };

  // 4. Publishing & WeChat syncing (authentically simulated ticker with progress updates)
  const handleTriggerWechatSync = (draftId: string) => {
    const targetDraft = drafts.find(d => d.id === draftId);
    if (!targetDraft) return;

    // Check if task already running to avoid duplications
    if (syncTasks.some(t => t.draftId === draftId && (t.status === 'syncing' || t.status === 'queued'))) {
      return;
    }

    const taskId = `task-${Date.now()}`;
    const selectedAudience = targetDraft.selectedAudience;
    const taskTitle = targetDraft.versions[selectedAudience].title;

    // Add initial queued sync task
    const initialTask: SyncTask = {
      id: taskId,
      draftId,
      title: taskTitle,
      progress: 0,
      status: 'queued',
      message: '正在排队建立数据流，验证本地微信公众号凭证密钥...',
      timestamp: new Date().toISOString().replace('T', ' ').substring(11, 19),
      syncedVersion: selectedAudience
    };

    setSyncTasks(prev => [initialTask, ...prev]);
    addSystemLog('微信发布', `已添加公众号草稿同步同步任务，代号: ${taskId}`, 'info');

    // Begin progress tracking tickers 
    let currentProgress = 5;
    const interval = setInterval(() => {
      currentProgress += 25;
      
      setSyncTasks(prev => prev.map(t => {
        if (t.id === taskId) {
          if (currentProgress >= 100) {
            clearInterval(interval);
            
            // Sync success - update drafts state too
            setDrafts(curDrafts => curDrafts.map(d => {
              if (d.id === draftId) {
                return {
                  ...d,
                  status: 'synced',
                  syncedTime: new Date().toISOString().replace('T', ' ').substring(0, 16),
                  wechatMediaId: `media_wx_${Math.random().toString(36).substring(2, 12)}`
                };
              }
              return d;
            }));

            addSystemLog('微信发布', `公众号草稿箱一键上传成功！同步文件: [${taskTitle.substring(0, 16)}...]。微信回填 MediaID 校验通过。`, 'success', 8000);

            return {
              ...t,
              progress: 100,
              status: 'completed',
              message: '完成微信端同步：数据载荷顺利承接，草稿箱内已挂置。',
              timestamp: new Date().toISOString().replace('T', ' ').substring(11, 19)
            };
          } else if (currentProgress === 30) {
            return {
              ...t,
              progress: 30,
              status: 'syncing',
              message: '已连接至微信服务器。正在请求 API AccessToken...'
            };
          } else if (currentProgress === 55) {
            return {
              ...t,
              progress: 55,
              status: 'syncing',
              message: '正在向微信官方CDN图床上传正文头图配图物料并锁定...'
            };
          } else {
            return {
              ...t,
              progress: 80,
              status: 'syncing',
              message: '图文 Markdown 转换标准微信 HTML 并组装 XML 完成。向微信 /draft/add 接口推送 JSON 载荷...'
            };
          }
        }
        return t;
      }));

    }, 1200);
  };

  return (
    <div id="saas-system-layout" className="flex h-screen bg-apple-bg text-apple-dark font-sans overflow-hidden antialiased select-none">
      
      {/* 1. Left Sidebar Navigation */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        sources={sources}
        topics={topics}
        drafts={drafts}
        appConfig={appConfig}
      />

      {/* 2. Main Frame */}
      <main id="app-main-layout" className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        
        {/* Top Header info bar */}
        <Header 
          activeTab={activeTab} 
          appConfig={appConfig} 
          onRefreshFeeds={handleRefreshGlobalFeeds}
          isRefreshingFeeds={isRefreshingFeeds}
        />

        {/* Core Scroll View content layout */}
        <div id="viewport-pane" className="flex-1 overflow-y-auto p-8 bg-apple-bg">
          {activeTab === 'dashboard' && (
            <DashboardView 
              sources={sources}
              topics={topics}
              drafts={drafts}
              logs={logs}
              appConfig={appConfig}
              setActiveTab={setActiveTab}
              setSelectedTopicIdForWorkshop={setSelectedTopicIdForWorkshop}
            />
          )}

          {activeTab === 'sources' && (
            <SourceCenterView 
              sources={sources}
              onAddSource={handleAddSource}
              onDeleteSource={handleDeleteSource}
              onToggleStatus={handleToggleSourceStatus}
              isRefreshing={isRefreshingFeeds}
              onTriggerCheck={handleVerifyCheckSource}
            />
          )}

          {activeTab === 'topics' && (
            <TopicWorkbenchView 
              topics={topics}
              onPushToWorkshop={handlePushToWorkshop}
              onArchiveTopic={handleArchiveTopic}
            />
          )}

          {activeTab === 'workshop' && (
            <AiWorkshopView 
              topics={topics}
              drafts={drafts}
              selectedTopicId={selectedTopicIdForWorkshop}
              setSelectedTopicId={setSelectedTopicIdForWorkshop}
              modelSetting={modelSetting}
              onSaveDraft={handleSaveDraftToLibrary}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === 'drafts' && (
            <DraftLibraryView 
              drafts={drafts}
              onUpdateDraftStatus={handleUpdateDraftStatus}
              onDeleteDraft={handleDeleteDraft}
              setSelectedTopicIdForWorkshop={setSelectedTopicIdForWorkshop}
              setSelectedDraftIdForPublish={setSelectedDraftIdForPublish}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === 'publish' && (
            <PublishCenterView 
              drafts={drafts}
              selectedDraftId={selectedDraftIdForPublish}
              setSelectedDraftId={setSelectedDraftIdForPublish}
              syncTasks={syncTasks}
              onTriggerSyncTask={handleTriggerWechatSync}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView 
              modelSetting={modelSetting}
              appConfig={appConfig}
              onSaveModelSetting={setModelSetting}
              onSaveAppConfig={setAppConfig}
            />
          )}
        </div>

      </main>
    </div>
  );
}
