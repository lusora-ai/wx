/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Cpu, 
  Settings2, 
  User, 
  Users, 
  Briefcase, 
  GraduationCap, 
  FileEdit, 
  Check, 
  Save, 
  Wand2, 
  Clock,
  Play, 
  FileText,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  Eye,
  Type
} from 'lucide-react';
import { TopicArticle, AiDraft, AudienceVersion, ModelSetting } from '../types';

interface AiWorkshopViewProps {
  topics: TopicArticle[];
  drafts: AiDraft[];
  selectedTopicId: string | null;
  setSelectedTopicId: (id: string | null) => void;
  modelSetting: ModelSetting;
  onSaveDraft: (draft: AiDraft) => void;
  setActiveTab: (tab: string) => void;
}

export default function AiWorkshopView({
  topics,
  drafts,
  selectedTopicId,
  setSelectedTopicId,
  modelSetting,
  onSaveDraft,
  setActiveTab
}: AiWorkshopViewProps) {
  
  // Find currently active topic to generate from
  const pushedTopics = topics.filter(t => t.status === 'pushed' || t.id === selectedTopicId);
  // Default to first item if none selected but items are pushed
  const activeTopic = topics.find(t => t.id === selectedTopicId) || pushedTopics[0] || topics[0];

  useEffect(() => {
    if (activeTopic && !selectedTopicId) {
      setSelectedTopicId(activeTopic.id);
    }
  }, [activeTopic, selectedTopicId, setSelectedTopicId]);

  // Model parameters (Local sliders override default setting)
  const [modelType, setModelType] = useState<'Gemini' | 'Claude' | 'DeepSeek'>(modelSetting.provider as any || 'Gemini');
  const [temperature, setTemperature] = useState(modelSetting.temperature);
  const [targetLength, setTargetLength] = useState(1200);
  const [outlineTone, setOutlineTone] = useState('创意幽默');

  // Multi-audience text state
  const [generatingProgress, setGeneratingProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeAudienceTab, setActiveAudienceTab] = useState<'officeWorker' | 'student' | 'freelancer'>('officeWorker');

  // Draft text structures: loaded from raw topic if exists, or initial mock
  const [draftOfficeWorkerTitle, setDraftOfficeWorkerTitle] = useState('');
  const [draftOfficeWorkerContent, setDraftOfficeWorkerContent] = useState('');
  const [draftOfficeWorkerExcerpt, setDraftOfficeWorkerExcerpt] = useState('');

  const [draftStudentTitle, setDraftStudentTitle] = useState('');
  const [draftStudentContent, setDraftStudentContent] = useState('');
  const [draftStudentExcerpt, setDraftStudentExcerpt] = useState('');

  const [draftFreelancerTitle, setDraftFreelancerTitle] = useState('');
  const [draftFreelancerContent, setDraftFreelancerContent] = useState('');
  const [draftFreelancerExcerpt, setDraftFreelancerExcerpt] = useState('');

  // Sync state with selected topic
  useEffect(() => {
    if (activeTopic) {
      // Find matches in existing drafts to pre-load edits!
      const matchingDraft = drafts.find(d => d.topicId === activeTopic.id);
      
      if (matchingDraft) {
        setDraftOfficeWorkerTitle(matchingDraft.versions.officeWorker.title);
        setDraftOfficeWorkerContent(matchingDraft.versions.officeWorker.content);
        setDraftOfficeWorkerExcerpt(matchingDraft.versions.officeWorker.excerpt);

        setDraftStudentTitle(matchingDraft.versions.student.title);
        setDraftStudentContent(matchingDraft.versions.student.content);
        setDraftStudentExcerpt(matchingDraft.versions.student.excerpt);

        setDraftFreelancerTitle(matchingDraft.versions.freelancer.title);
        setDraftFreelancerContent(matchingDraft.versions.freelancer.content);
        setDraftFreelancerExcerpt(matchingDraft.versions.freelancer.excerpt);
        
        setActiveAudienceTab(matchingDraft.selectedAudience);
      } else {
        // Build fallback template based on topic properties
        const baseTitle = activeTopic.translatedTitle;
        setDraftOfficeWorkerTitle(`【程序员摸鱼大招】谷歌闪电发布 Gemini 2.5 Flash！长拼长红！${baseTitle}`);
        setDraftOfficeWorkerExcerpt(`${activeTopic.summary} 本文带你彻底搞定职场痛点...`);
        setDraftOfficeWorkerContent(`### 🚀 职场提效必备：谷歌 Gemini 2.5 Flash 带来的摸鱼秘籍！\n\n谷歌刚刚更新的 **Gemini 2.5 Flash** 极速轻量大模型真是打工人解压神仙工具。它的 200万 Token 超长上下文能力是什么概念？相当于可以一次吃掉一整年的工作档案、代码库、或者会议音频，在两秒内瞬间吐出重点。\n\n#### 👨‍💻 打工人痛点解析\n每天加班写汇报？整理那些繁复难缠的公司报表？直接把所有的原始数据拖进本系统进行提炼！\n\n*   **高频问题一：** 数小时会议录音音频？\n*   **高频问题二：** 几万行没有注释的堆砌祖传屎山？\n\n现在调用本模型：\`models/gemini-2.5-flash\`，百万文本成本降至 0.05 美分，一饭之资，解千愁。\n\n#### 💻 三步提成打工人效率大纲\n1.  **打包上传**：点击一键上传 PDF、日志文档；\n2.  **触发精炼**：结合专业提示词调配；\n3.  **即刻导出**。从此你就能下午四点打卡下班！`);

        setDraftStudentTitle(`【期末不挂科】大学生科研/蹭公开课一键摸鱼！Gemini 2.5 Flash 正式宣布：200万无损字数！`);
        setDraftStudentExcerpt(`英语论文根本看不完？大伙都在用这个！今天谷歌Gemini2.5Flash闪电般登场...`);
        setDraftStudentContent(`### 🎓 大学生拯救发际线行动！\n\n各位同学，期末论文、毕业大作业、英语教授发下来的几万字前沿 Paper 还在一个个字查翻译吗？\n\n现在谷歌在它的官方控制台扔出的 **Gemini 2.5 Flash** 绝对是神仙助手！最耀眼的是：它是轻量极速架构，专为低资费、高频多模态设计。\n\n#### 📚 我们的学业解药\n*   **学术论文一键超度**：把这学期三十篇论文打包丢给它，输入 *"请把这个量子力学公式用大一萌新能听懂的大白话论述一边"*；\n*   **B站/Coursera 英文网课听写**：直接支持音频一键转中英对照纪要。`);

        setDraftFreelancerTitle(`【单兵套利】谷歌 Gemini 2.5 Flash 无死角清洗海外 AI 资讯！一人成报社，月入十万的副业套路公开`);
        setDraftFreelancerExcerpt(`如何用极快速度、极低接口成本监控并清洗整个 Reddit、TechCrunch？自由职业者的变现天花板...`);
        setDraftFreelancerContent(`### 💼 独立开发者/自由职业者的降维神器：Gemini 2.5 Flash 变现论\n\n对于自由创作者和出海小队来说，最大的痛点就是：**没有团队、没有预算**。\n\n谷歌这个 2.5 Flash 核心定位就是针对批量化和全自动。每 100万 Token 仅收五美分，可以说是“把大模型当白菜卖”。\n\n#### 💰 自由人变现商业落地闭环\n1.  **AI 资讯自动清洗站**：直接设置国外前沿资讯网站，通过 XML 批量监控最新文章。拉入小顺工作台翻译为打工人或自由职业者痛点，多渠道推送到微信同步，打造个人超级垂直大号，累积粉丝接单；\n2.  **多模态分析套利**：上传国外的优秀项目界面或视频，输出优质的技术评测，收割第一波流量热度！`);
      }
    }
  }, [activeTopic, drafts]);

  // Model selection items:
  const modelOptions = [
    { id: 'Gemini', name: 'Gemini 2.5 Pro (推荐)', icon: '✨' },
    { id: 'Claude', name: 'Claude 3.5 Sonnet', icon: '🎨' },
    { id: 'DeepSeek', name: 'DeepSeek-V3 (极速)', icon: '⚡' }
  ];

  // Trigger typewriter simulation when clicking generate
  const handleGenerate = () => {
    setIsGenerating(true);
    setGeneratingProgress(0);
    
    const interval = setInterval(() => {
      setGeneratingProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsGenerating(false);
          return 100;
        }
        return prev + 5;
      });
    }, 120);
  };

  // Save drafts handler
  const handleSaveDraft = () => {
    if (!activeTopic) return;

    const draftPayload: AiDraft = {
      id: drafts.find(d => d.topicId === activeTopic.id)?.id || `draft-${Date.now()}`,
      topicId: activeTopic.id,
      originalTitle: activeTopic.originalTitle,
      translatedTitle: activeTopic.translatedTitle,
      category: activeTopic.category,
      selectedAudience: activeAudienceTab,
      status: 'pending_review',
      reviewScore: 0,
      reviewerFeedback: '大纲和分众排版已完成。等待主编在内容库页面执行评分终审核。',
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      lastEdited: new Date().toISOString().replace('T', ' ').substring(0, 16),
      tokenCost: isGenerating ? 42500 : 15420,
      versions: {
        officeWorker: {
          title: draftOfficeWorkerTitle,
          excerpt: draftOfficeWorkerExcerpt,
          content: draftOfficeWorkerContent,
          wordCount: draftOfficeWorkerContent.length
        },
        student: {
          title: draftStudentTitle,
          excerpt: draftStudentExcerpt,
          content: draftStudentContent,
          wordCount: draftStudentContent.length
        },
        freelancer: {
          title: draftFreelancerTitle,
          excerpt: draftFreelancerExcerpt,
          content: draftFreelancerContent,
          wordCount: draftFreelancerContent.length
        }
      }
    };

    onSaveDraft(draftPayload);
    setActiveTab('drafts'); // redirect immediately
  };

  // Helper formatting for simple editors: Markdowns actions!
  const appendFormat = (symbol: string) => {
    let currentText = '';
    let setText: React.Dispatch<React.SetStateAction<string>> | null = null;

    if (activeAudienceTab === 'officeWorker') {
      currentText = draftOfficeWorkerContent;
      setText = setDraftOfficeWorkerContent;
    } else if (activeAudienceTab === 'student') {
      currentText = draftStudentContent;
      setText = setDraftStudentContent;
    } else {
      currentText = draftFreelancerContent;
      setText = setDraftFreelancerContent;
    }

    if (setText) {
      if (symbol === 'B') {
        setText(currentText + ' **加粗文本**');
      } else if (symbol === 'I') {
        setText(currentText + ' *斜体文本*');
      } else if (symbol === 'H1') {
        setText(currentText + '\n\n### 新标题三');
      } else if (symbol === 'LIST') {
        setText(currentText + '\n*   列表项一\n*   列表项二');
      } else if (symbol === 'CODE') {
        setText(currentText + '\n\`\`\`python\nprint("Hello Xiaoshun AI")\n\`\`\`');
      }
    }
  };

  // Get current text editing states based on active segment tab
  const getEditorTitleState = () => {
    if (activeAudienceTab === 'officeWorker') return draftOfficeWorkerTitle;
    if (activeAudienceTab === 'student') return draftStudentTitle;
    return draftFreelancerTitle;
  };

  const getEditorExcerptState = () => {
    if (activeAudienceTab === 'officeWorker') return draftOfficeWorkerExcerpt;
    if (activeAudienceTab === 'student') return draftStudentExcerpt;
    return draftFreelancerExcerpt;
  };

  const getEditorContentState = () => {
    if (activeAudienceTab === 'officeWorker') return draftOfficeWorkerContent;
    if (activeAudienceTab === 'student') return draftStudentContent;
    return draftFreelancerContent;
  };

  const setEditorTitleState = (val: string) => {
    if (activeAudienceTab === 'officeWorker') setDraftOfficeWorkerTitle(val);
    else if (activeAudienceTab === 'student') setDraftStudentTitle(val);
    else setDraftFreelancerTitle(val);
  };

  const setEditorExcerptState = (val: string) => {
    if (activeAudienceTab === 'officeWorker') setDraftOfficeWorkerExcerpt(val);
    else if (activeAudienceTab === 'student') setDraftStudentExcerpt(val);
    else setDraftFreelancerExcerpt(val);
  };

  const setEditorContentState = (val: string) => {
    if (activeAudienceTab === 'officeWorker') setDraftOfficeWorkerContent(val);
    else if (activeAudienceTab === 'student') setDraftStudentContent(val);
    else setDraftFreelancerContent(val);
  };

  if (!activeTopic) {
    return (
      <div className="p-12 text-center bg-white border border-apple-border rounded-[24px] flex flex-col items-center justify-center space-y-3 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
        <Sparkles className="h-10 w-10 text-apple-blue animate-pulse" />
        <h4 className="text-sm font-bold text-apple-dark">未拉取/选定任何资讯主题进行重写</h4>
        <p className="text-[11px] text-apple-muted max-w-sm">请先前往［选题工作台］挑选海外资讯并一键推送，或刷新同步接口。</p>
        <button 
          onClick={() => setActiveTab('topics')} 
          className="px-4.5 py-2 text-xs font-semibold bg-[#0066CC] hover:bg-apple-blue-hover text-white rounded-xl cursor-pointer shadow-xs"
        >
          前往选题工作台
        </button>
      </div>
    );
  }

  return (
    <div id="workshop-view-wrapper" className="space-y-6 container mx-auto px-1 py-1">
      
      {/* 1. Pick active news topic select row */}
      <section id="topic-picker-bar" className="bg-white border border-apple-border rounded-[24px] p-4 shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <div className="h-8 w-8 rounded-lg bg-apple-bg border border-apple-border/50 flex items-center justify-center text-apple-blue">
            <FileText className="h-4.5 w-4.5" />
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-bold text-apple-muted uppercase tracking-wide">当前精选重写选题</div>
            <select
              value={activeTopic.id}
              onChange={(e) => setSelectedTopicId(e.target.value)}
              className="mt-0.5 bg-transparent border-none text-[11px] font-bold text-apple-dark outline-none p-0 cursor-pointer max-w-sm sm:max-w-md md:max-w-lg truncate"
            >
              {topics.map(t => (
                <option key={t.id} value={t.id}>
                  {t.translatedTitle} ({t.category})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action sync triggers */}
        <div className="flex items-center space-x-3 shrink-0">
          <div className="text-[10px] text-apple-muted font-medium">原创出处: <span className="font-mono text-apple-dark font-semibold">{activeTopic.sourceName}</span></div>
          <a
            href={activeTopic.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg border border-apple-border text-apple-muted hover:text-apple-dark hover:bg-apple-bg transition cursor-pointer"
            title="阅读原文"
          >
            <Eye className="h-3.5 w-3.5" />
          </a>
        </div>
      </section>

      {/* 2. Parameters Drawer block & main editor split */}
      <section id="editor-panels" className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        
        {/* Model Slider Column */}
        <div className="bg-white border border-apple-border rounded-[24px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-5 lg:col-span-1">
          <div className="flex items-center space-x-2 border-b border-apple-border pb-3">
            <Settings2 className="h-4.5 w-4.5 text-apple-blue" />
            <h3 className="text-xs font-bold text-apple-dark">底座 AI 写手参数配置</h3>
          </div>

          {/* Model provider card tab */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-apple-muted uppercase">生成模型引擎 选择</label>
            <div className="space-y-1 pt-0.5">
              {modelOptions.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setModelType(opt.id as any)}
                  className={`w-full px-3 py-2 border rounded-xl text-left text-xs font-semibold flex items-center justify-between transition cursor-pointer ${
                    modelType === opt.id 
                      ? 'border-apple-blue bg-apple-blue text-white shadow-xs' 
                      : 'border-apple-border hover:bg-apple-bg/50 text-apple-muted'
                  }`}
                >
                  <span className="flex items-center space-x-2">
                    <span>{opt.icon}</span>
                    <span>{opt.name}</span>
                  </span>
                  {modelType === opt.id && <Check className="h-3.5 w-3.5 text-white" />}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[1px] bg-apple-border/50"></div>

          {/* Prompt sliders */}
          <div className="space-y-4">
            {/* temperature */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[10px] font-semibold text-apple-muted">
                <span>温度系 (Creativity)</span>
                <span className="font-mono text-apple-dark font-bold">{temperature}</span>
              </div>
              <input 
                type="range" 
                min="0.2" 
                max="1.2" 
                step="0.1" 
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full h-1 bg-[#E5E5E7] rounded-lg appearance-none cursor-pointer accent-apple-blue" 
              />
              <div className="flex justify-between text-[8px] text-apple-muted font-mono">
                <span>严肃写实</span>
                <span>天马行空</span>
              </div>
            </div>

            {/* target limit length */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[10px] font-semibold text-apple-muted">
                <span>推测单版字数限制</span>
                <span className="font-mono text-apple-dark font-bold">{targetLength} 字</span>
              </div>
              <input 
                type="range" 
                min="600" 
                max="1800" 
                step="100" 
                value={targetLength}
                onChange={(e) => setTargetLength(parseInt(e.target.value))}
                className="w-full h-1 bg-[#E5E5E7] rounded-lg appearance-none cursor-pointer accent-apple-blue" 
              />
              <div className="flex justify-between text-[8px] text-apple-muted font-mono">
                <span>短快轻（600）</span>
                <span>深度长文（1800）</span>
              </div>
            </div>

            {/* Tone category tuning */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-apple-muted uppercase">词藻风趣度 (Tone)</label>
              <select
                value={outlineTone}
                onChange={(e) => setOutlineTone(e.target.value)}
                className="w-full px-2 py-2 bg-apple-bg border border-apple-border outline-none rounded-xl text-xs font-semibold text-apple-dark cursor-pointer animate-fade-in"
              >
                <option value="创意幽默">创意幽默 (多用流行热词)</option>
                <option value="专业干货">专业干货 (深度场景拆拆)</option>
                <option value="焦虑醒脑">焦虑醒脑 (行业大洗牌警示)</option>
                <option value="激情安抚">激情安抚 (睡后收入与副业鼓励)</option>
              </select>
            </div>
          </div>

          <div className="h-[1px] bg-apple-border/50"></div>

          {/* Trigger write action */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full py-2.5 rounded-xl bg-[#0066CC] hover:bg-apple-blue-hover text-white font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center space-x-1.5 disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>生成中 ({generatingProgress}%)</span>
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" />
                <span>开始多受众版本重写</span>
              </>
            )}
          </button>
          
          <div className="text-[9px] font-mono text-apple-muted text-center leading-relaxed font-semibold">
            点击将对 “打工人 / 大学生 / 自由创作者” 三个受众分别生成独有框架
          </div>
        </div>

        {/* Big Editing Workspace Grid (Tabbed editor) */}
        <div className="bg-white border border-apple-border rounded-[24px] shadow-[0_4px_24px_rgba(0,0,0,0.02)] lg:col-span-3 overflow-hidden flex flex-col h-[520px]">
          
          {/* Segment Control header to select Audience tab */}
          <div className="p-4 bg-apple-bg/50 border-b border-apple-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
            <div className="flex items-center space-x-1.5 p-0.5 rounded-xl bg-apple-bg border border-apple-border/50 text-xs font-semibold text-apple-muted w-full sm:w-auto">
              {[
                { id: 'officeWorker', label: '打工人分众', icon: Briefcase },
                { id: 'student', label: '大学生分众', icon: GraduationCap },
                { id: 'freelancer', label: '自由职业分众', icon: Users }
              ].map(tab => {
                const TabIcon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveAudienceTab(tab.id as any)}
                    className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                      activeAudienceTab === tab.id 
                        ? 'bg-white text-apple-dark shadow-xs font-semibold animate-fade-in' 
                        : 'hover:text-apple-dark text-apple-muted'
                    }`}
                  >
                    <TabIcon className="h-3.5 w-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <span className="text-[10px] font-mono font-semibold px-2 py-1 rounded bg-[#E5E5E7]/50 text-apple-dark shrink-0 text-center border border-apple-border/20">
              字数计: <span className="text-apple-blue font-bold">{getEditorContentState().length}</span> / {targetLength}
            </span>
          </div>

          {/* Simulated typewriter or Loading indicator in workbench */}
          {isGenerating ? (
            <div id="loading-animation-pane" className="flex-1 flex flex-col items-center justify-center space-y-3 p-12">
              <Sparkles className="h-10 w-10 text-apple-blue animate-spin" />
              <div className="text-xs font-bold text-apple-dark font-mono tracking-wider">XIAOSHUN AI ENGINE DISTRIBUTING PROCESS...</div>
              <p className="text-[10px] text-apple-muted font-medium text-center max-w-sm">正在针对「{activeAudienceTab === 'officeWorker' ? '企业办公社畜' : activeAudienceTab === 'student' ? '考研论文党' : '单兵客群'}」定制独占行文重点大纲以及痛点钩子...</p>
              
              <div className="w-56 h-1 w bg-apple-bg border border-apple-border/40 rounded-full overflow-hidden">
                <div style={{ width: `${generatingProgress}%` }} className="h-full bg-apple-blue rounded-full transition-all duration-100"></div>
              </div>
            </div>
          ) : (
            /* Markdown Edit Canvas Frame */
            <div id="active-editor-canvas" className="flex-1 flex flex-col min-h-0 select-text">
              
              {/* Title Input area */}
              <div className="p-4 border-b border-apple-border/40 flex items-start space-x-2">
                <Type className="h-4.5 w-4.5 text-apple-muted mt-1 shrink-0" />
                <input
                  type="text"
                  value={getEditorTitleState()}
                  id="draft-active-title-input"
                  onChange={(e) => setEditorTitleState(e.target.value)}
                  placeholder="请输入该版本文章主标题..."
                  className="w-full bg-transparent border-none text-xs font-bold text-apple-dark outline-none p-0 placeholder-apple-muted/50"
                />
              </div>

              {/* Excerpt Summary input */}
              <div className="p-3 bg-apple-bg/50 border-b border-apple-border/40 text-[11px] flex items-center space-x-2">
                <span className="text-[9px] font-bold text-apple-muted uppercase shrink-0">微信摘要:</span>
                <input
                  type="text"
                  value={getEditorExcerptState()}
                  onChange={(e) => setEditorExcerptState(e.target.value)}
                  placeholder="微信图文摘要，展示在消息卡片下方..."
                  className="w-full bg-transparent border-none text-[11px] text-apple-dark outline-none p-0 placeholder-apple-muted/50 font-medium"
                />
              </div>

              {/* Markdown Toolbar helpers */}
              <div className="px-4 py-1.5 bg-apple-bg/25 border-b border-apple-border flex items-center justify-between text-apple-muted shrink-0">
                <div className="flex items-center space-x-2 text-[10px] font-semibold text-[#0066CC]">
                  <button onClick={() => appendFormat('B')} className="px-2 py-0.5 rounded hover:bg-apple-bg hover:text-apple-dark transition cursor-pointer">B</button>
                  <button onClick={() => appendFormat('I')} className="px-2 py-0.5 rounded hover:bg-apple-bg hover:text-apple-dark transition cursor-pointer">I</button>
                  <button onClick={() => appendFormat('H1')} className="px-2 py-0.5 rounded hover:bg-apple-bg hover:text-apple-dark transition cursor-pointer">H3</button>
                  <button onClick={() => appendFormat('LIST')} className="px-2 py-0.5 rounded hover:bg-apple-bg hover:text-apple-dark transition cursor-pointer">List</button>
                  <button onClick={() => appendFormat('CODE')} className="px-2 py-0.5 rounded hover:bg-apple-bg hover:text-apple-dark transition cursor-pointer font-mono">&lt;/&gt;</button>
                </div>
                <span className="text-[9px] font-mono font-semibold tracking-wide text-apple-muted select-none">Markdown / 富文本编辑器形式</span>
              </div>

              {/* Textarea Code Content */}
              <textarea
                value={getEditorContentState()}
                onChange={(e) => setEditorContentState(e.target.value)}
                id="draft-active-textarea-body"
                placeholder="此处支持原生 Markdown 格式排版直接录入，请在此处完善大模型生成的正文内容。"
                className="w-full flex-1 p-5 outline-none resize-none overflow-y-auto text-xs font-semibold text-apple-dark leading-relaxed placeholder-apple-muted/50 font-sans"
              />

              {/* Sticky bottom CTA row */}
              <div className="p-3.5 bg-apple-bg/45 border-t border-apple-border flex items-center justify-between shrink-0 select-none">
                <div className="text-[9px] font-mono text-apple-muted flex items-center space-x-1">
                  <Clock className="h-3 w-3" />
                  <span>暂存在本地草稿池，更新将覆盖已存副本</span>
                </div>

                <button
                  onClick={handleSaveDraft}
                  id="save-draft-workbench-btn"
                  className="px-4.5 py-2 bg-[#0066CC] hover:bg-apple-blue-hover text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center space-x-1 cursor-pointer border border-[#0066CC]"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>生成完毕：导入草稿库</span>
                </button>
              </div>

            </div>
          )}

        </div>

      </section>

    </div>
  );
}
