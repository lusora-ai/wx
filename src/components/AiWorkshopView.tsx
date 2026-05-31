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
  Save, 
  Wand2, 
  Clock,
  Play, 
  FileText,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  Eye,
  Type,
  PackageCheck
} from 'lucide-react';
import { imageSlotsApi } from '../api/imageSlots';
import { articlesApi, type ArticleWorkflowStatus, type QualityCheckResult } from '../api/articles';
import type { ArticleRecord } from '../api/articles';
import type { UpdateImageSlotInput } from '../api/imageSlots';
import { TopicArticle, AiDraft, ModelSetting, ArticleImageSlot, AudienceKey, VisualPlan } from '../types';
import ImageSlotMarker from './ImageSlotMarker';

interface AiWorkshopViewProps {
  topics: TopicArticle[];
  drafts: AiDraft[];
  selectedTopicId: string | null;
  selectedArticleId?: string | null;
  setSelectedTopicId: (id: string | null) => void;
  modelSetting: ModelSetting;
  onSaveDraft: (draft: AiDraft) => void;
  onGenerateArticle: (topicId: string, options: { audience: AudienceKey; tone?: string; targetLength?: number }) => Promise<{ article: ArticleRecord; visualPlanStatus?: string; visualPlanWarnings?: string[] } | undefined>;
  onCreatePublishPackage?: (articleId: string) => Promise<void>;
  setActiveTab: (tab: string) => void;
}

export default function AiWorkshopView({
  topics,
  drafts,
  selectedTopicId,
  selectedArticleId,
  setSelectedTopicId,
  modelSetting,
  onSaveDraft,
  onGenerateArticle,
  onCreatePublishPackage,
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

  // Generation parameters. Model routing is fixed server-side in Phase 11.
  const [temperature, setTemperature] = useState(modelSetting.temperature);
  const [targetLength, setTargetLength] = useState(900);
  const [outlineTone, setOutlineTone] = useState('创意幽默');
  const [editorMode, setEditorMode] = useState<'preview' | 'markdown'>('preview');
  const [activeImageSlotKey, setActiveImageSlotKey] = useState<string | null>(null);
  const [imageSlotBusy, setImageSlotBusy] = useState(false);
  const [qualityResult, setQualityResult] = useState<QualityCheckResult | null>(null);
  const [qualityLoading, setQualityLoading] = useState(false);
  const [workflowStatus, setWorkflowStatus] = useState<ArticleWorkflowStatus | null>(null);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [workflowError, setWorkflowError] = useState('');
  const [workflowReloadKey, setWorkflowReloadKey] = useState(0);
  const [packageLoading, setPackageLoading] = useState(false);

  // Multi-audience text state
  const [generatingProgress, setGeneratingProgress] = useState(0);
  const [generatingByAudience, setGeneratingByAudience] = useState<Partial<Record<AudienceKey, boolean>>>({});
  const [generateErrors, setGenerateErrors] = useState<Partial<Record<AudienceKey, string>>>({});
  const [generateStage, setGenerateStage] = useState('');
  const [activeAudienceTab, setActiveAudienceTab] = useState<'officeWorker' | 'student' | 'freelancer'>('officeWorker');
  const isGenerating = Boolean(generatingByAudience[activeAudienceTab]);

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
  const [imageSlotsByAudience, setImageSlotsByAudience] = useState<Partial<Record<AudienceKey, ArticleImageSlot[]>>>({});
  const [articleIdsByAudience, setArticleIdsByAudience] = useState<Partial<Record<AudienceKey, string>>>({});
  const [visualPlanByAudience, setVisualPlanByAudience] = useState<Partial<Record<AudienceKey, VisualPlan | null>>>({});
  const [visualPlanLoading, setVisualPlanLoading] = useState(false);

  useEffect(() => {
    if (!selectedArticleId) return;
    const matchingDraft = drafts.find((draft) => Object.values(draft.articleIds || {}).includes(selectedArticleId));
    if (!matchingDraft) return;
    const matchingAudience = (Object.entries(matchingDraft.articleIds || {}).find(([, id]) => id === selectedArticleId)?.[0] || matchingDraft.selectedAudience) as AudienceKey;
    setSelectedTopicId(matchingDraft.topicId);
    setActiveAudienceTab(matchingAudience);
    window.setTimeout(() => {
      document.getElementById('workshop-view-wrapper')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }, [selectedArticleId, drafts, setSelectedTopicId]);

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
        setImageSlotsByAudience(matchingDraft.imageSlots || {});
        setArticleIdsByAudience(matchingDraft.articleIds || {});
        setVisualPlanByAudience(matchingDraft.visualPlans || {});
        
        setActiveAudienceTab(matchingDraft.selectedAudience);
      } else {
        // No existing draft — start with empty fields, user clicks Generate
        setDraftOfficeWorkerTitle('');
        setDraftOfficeWorkerExcerpt('');
        setDraftOfficeWorkerContent('');
        setDraftStudentTitle('');
        setDraftStudentExcerpt('');
        setDraftStudentContent('');
        setDraftFreelancerTitle('');
        setDraftFreelancerExcerpt('');
        setDraftFreelancerContent('');
        setImageSlotsByAudience({});
        setArticleIdsByAudience({});
        setVisualPlanByAudience({});
      }
    }
  }, [activeTopic, drafts]);

  // Trigger typewriter simulation when clicking generate
  const handleGenerate = async () => {
    if (!activeTopic) return;
    const existingArticleId = drafts.find(d => d.topicId === activeTopic.id)?.articleIds?.[activeAudienceTab];
    if (existingArticleId && !window.confirm('当前受众版本已生成。重新生成会创建新文章并替换当前预览，是否继续？')) {
      return;
    }
    setGeneratingByAudience((current) => ({ ...current, [activeAudienceTab]: true }));
    setGenerateErrors((current) => ({ ...current, [activeAudienceTab]: '' }));
    setGeneratingProgress(0);
    setGenerateStage('准备选题资料');
    const stages = [
      { delay: 150, progress: 10, label: '准备选题资料' },
      { delay: 900, progress: 25, label: '读取事实点' },
      { delay: 2500, progress: 45, label: '正在生成正文' },
      { delay: 15000, progress: 70, label: '正在规划段落配图' },
      { delay: 45000, progress: 90, label: '保存文章版本' },
    ];
    const timers = stages.map((stage) => window.setTimeout(() => {
      setGeneratingProgress(stage.progress);
      setGenerateStage(stage.label);
    }, stage.delay));
    try {
      const result = await onGenerateArticle(activeTopic.id, {
        audience: activeAudienceTab,
        tone: outlineTone,
        targetLength,
      });
      if (result) {
        const { article, visualPlanStatus, visualPlanWarnings } = result;
        setEditorTitleState(article.title);
        setEditorContentState(article.markdown);
        setEditorExcerptState(article.summary || '');
        setImageSlotsByAudience((current) => ({ ...current, [activeAudienceTab]: article.imageSlots || [] }));
        setArticleIdsByAudience((current) => ({ ...current, [activeAudienceTab]: article.id }));
        setVisualPlanByAudience((current) => ({
          ...current,
          [activeAudienceTab]: safeParseVisualPlan(article.visualPlanJson),
        }));
        if (visualPlanStatus === 'failed') {
          const warningMsg = visualPlanWarnings?.length
            ? visualPlanWarnings.join('；')
            : '段落配图方案生成失败，可点击"重新生成段落配图"重试。';
          setGenerateErrors((current) => ({ ...current, [activeAudienceTab]: warningMsg }));
        }
      }
      setGeneratingProgress(100);
      setGenerateStage('正文已生成');
    } catch (error) {
      setGenerateErrors((current) => ({
        ...current,
        [activeAudienceTab]: error instanceof Error ? error.message : '生成失败，请稍后重试。',
      }));
    } finally {
      timers.forEach(window.clearTimeout);
      setGeneratingByAudience((current) => ({ ...current, [activeAudienceTab]: false }));
    }
  };

  // Save drafts handler
  const handleSaveDraft = () => {
    if (!activeTopic) return;

    const draftPayload: AiDraft = {
      id: drafts.find(d => d.topicId === activeTopic.id)?.id || `draft-${Date.now()}`,
      topicId: activeTopic.id,
      articleIds: { ...(drafts.find(d => d.topicId === activeTopic.id)?.articleIds || {}), ...articleIdsByAudience },
      imageSlots: imageSlotsByAudience,
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

  const getCurrentArticleId = () => {
    const draft = drafts.find(d => d.topicId === activeTopic?.id);
    return articleIdsByAudience[activeAudienceTab] || draft?.articleIds?.[activeAudienceTab];
  };

  const getCurrentImageSlots = () => imageSlotsByAudience[activeAudienceTab] || [];
  const currentArticleId = getCurrentArticleId();
  const currentVisualPlan = visualPlanByAudience[activeAudienceTab] || null;

  function safeParseVisualPlan(value?: string | null): VisualPlan | null {
    if (!value) return null;
    try {
      return JSON.parse(value) as VisualPlan;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    let cancelled = false;
    if (!currentArticleId) {
      setWorkflowStatus(null);
      setWorkflowError('');
      return;
    }
    setWorkflowLoading(true);
    setWorkflowError('');
    articlesApi.workflowStatus(currentArticleId)
      .then((status) => {
        if (!cancelled) setWorkflowStatus(status);
      })
      .catch((error) => {
        if (!cancelled) {
          setWorkflowStatus(null);
          setWorkflowError(error instanceof Error ? error.message : '工作流状态加载失败');
        }
      })
      .finally(() => {
        if (!cancelled) setWorkflowLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentArticleId, workflowReloadKey]);

  const workflowStageLabel: Record<ArticleWorkflowStatus['stage'], string> = {
    draft: '草稿',
    needs_quality_check: '待质量检查',
    quality_outdated: '需重新质检',
    quality_failed: '需修改',
    quality_passed: '可生成发布包',
    package_ready: '发布包已生成',
    waiting_manual_publish: '等待手动发布',
  };

  const getWorkflowAdvice = () => {
    if (!currentArticleId) return '这篇选题还没有生成文章。';
    if (workflowLoading) return '正在读取工作流状态。';
    if (workflowError) return workflowError;
    return workflowStatus?.nextAction.reason || '继续检查文章内容和发布包状态。';
  };

  const getWorkflowStatusLabel = () => {
    if (!currentArticleId) return '待生成文章';
    if (workflowLoading) return '读取中';
    if (!workflowStatus) return '状态未知';
    return workflowStageLabel[workflowStatus.stage];
  };

  const updateSlotInState = (slot: ArticleImageSlot) => {
    setImageSlotsByAudience((current) => ({
      ...current,
      [activeAudienceTab]: (current[activeAudienceTab] || []).map((item) => item.id === slot.id ? slot : item),
    }));
  };

  const handleSelectImageSlot = (slotKey: string) => {
    setActiveImageSlotKey(slotKey);
    setTimeout(() => {
      document.getElementById(`image-slot-card-${slotKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
  };

  const handleUpdateImageSlot = async (slotId: string, input: UpdateImageSlotInput) => {
    const updated = await imageSlotsApi.update(slotId, input);
    updateSlotInState(updated);
  };

  const handleRegenerateImageSlot = async (slotId: string) => {
    const updated = await imageSlotsApi.regeneratePrompt(slotId);
    updateSlotInState(updated);
  };

  const handleSkipImageSlot = async (slotId: string) => {
    const updated = await imageSlotsApi.skip(slotId);
    updateSlotInState(updated);
  };

  const handleGenerateImageSlots = async () => {
    if (!currentArticleId) return;
    setImageSlotBusy(true);
    try {
      const slots = await imageSlotsApi.generate(currentArticleId);
      setImageSlotsByAudience((current) => ({ ...current, [activeAudienceTab]: slots }));
    } finally {
      setImageSlotBusy(false);
    }
  };

  const handleRegenerateVisualPlan = async () => {
    if (!currentArticleId) return;
    setVisualPlanLoading(true);
    setGenerateErrors((current) => ({ ...current, [activeAudienceTab]: '' }));
    try {
      const result = await articlesApi.generateVisualPlan(currentArticleId);
      if (result.visualPlan) {
        setVisualPlanByAudience((current) => ({ ...current, [activeAudienceTab]: result.visualPlan }));
      } else {
        setGenerateErrors((current) => ({
          ...current,
          [activeAudienceTab]: result.warnings.join('；') || '段落配图方案生成失败，可稍后重试。',
        }));
      }
    } catch (error) {
      setGenerateErrors((current) => ({
        ...current,
        [activeAudienceTab]: error instanceof Error ? error.message : '段落配图方案生成失败，可稍后重试。',
      }));
    } finally {
      setVisualPlanLoading(false);
    }
  };

  const copyVisualPrompt = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  const handleQualityCheck = async () => {
    if (!currentArticleId) return;
    setQualityLoading(true);
    setQualityResult(null);
    try {
      const result = await articlesApi.qualityCheck(currentArticleId);
      setQualityResult(result);
      // Auto-ensure PublishTask when quality check passes
      if (result.passed) {
        try {
          const ensureResult = await articlesApi.ensurePublishTask(currentArticleId);
          if (ensureResult.ensured && ensureResult.publishTaskId) {
            setGenerateErrors((prev) => ({
              ...prev,
              ['officeWorker']: ensureResult.reused ? '质量检查通过，已有发布包。' : '质量检查通过，已生成发布包并进入微信发布中心。',
            }));
          }
        } catch {
          // ensure failed silently — user can still manually create package
        }
      }
      setWorkflowReloadKey((value) => value + 1);
    } catch {
      setQualityResult({ passed: false, score: 0, issues: [{ type: 'error', message: '质量检查请求失败。', severity: 'high' }] });
      setWorkflowReloadKey((value) => value + 1);
    } finally {
      setQualityLoading(false);
    }
  };

  const handleWorkflowAction = async () => {
    if (!currentArticleId) {
      await handleGenerate();
      return;
    }
    if (!workflowStatus || workflowStatus.nextAction.type === 'run_quality_check') {
      await handleQualityCheck();
      return;
    }
    if (workflowStatus.nextAction.type === 'edit_article') {
      setEditorMode('markdown');
      return;
    }
    if (workflowStatus.nextAction.type === 'create_package') {
      setPackageLoading(true);
      try {
        const ensureResult = await articlesApi.ensurePublishTask(currentArticleId);
        if (ensureResult.ensured) {
          setGenerateErrors((prev) => ({
            ...prev,
            ['officeWorker']: ensureResult.reused ? '已有发布包，可直接使用。' : '已生成发布包并进入微信发布中心。',
          }));
        }
        setWorkflowReloadKey((value) => value + 1);
      } catch {
        // fallback to onCreatePublishPackage
        if (onCreatePublishPackage) {
          await onCreatePublishPackage(currentArticleId);
          setWorkflowReloadKey((value) => value + 1);
        }
      } finally {
        setPackageLoading(false);
      }
      return;
    }
    if (workflowStatus.nextAction.type === 'view_publish_task') {
      setActiveTab('publish');
    }
  };

  const renderArticlePreview = (content: string) => {
    const slots = getCurrentImageSlots();
    const slotMap = new Map(slots.map((slot) => [slot.slotKey, slot]));
    const parts = content.split(/(\{\{IMAGE_SLOT:img_\d+\}\})/g);
    return (
      <div className="w-full flex-1 p-5 overflow-y-auto text-body-readable font-semibold text-apple-dark leading-relaxed font-sans">
        {parts.map((part, index) => {
          const match = part.match(/\{\{IMAGE_SLOT:(img_\d+)\}\}/);
          if (match) {
            return <ImageSlotMarker key={`${part}-${index}`} slotKey={match[1]} slot={slotMap.get(match[1])} onSelect={handleSelectImageSlot} />;
          }
          if (!part.trim()) return null;
          return <div key={index} className="whitespace-pre-wrap mb-3">{part}</div>;
        })}
      </div>
    );
  };

  if (!activeTopic) {
    return (
      <div className="p-12 text-center bg-white border border-apple-border rounded-[24px] flex flex-col items-center justify-center space-y-3 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
        <Sparkles className="h-10 w-10 text-apple-blue animate-pulse" />
        <h4 className="text-section-title font-bold text-apple-dark">未拉取/选定任何资讯主题进行重写</h4>
        <p className="text-meta-readable text-apple-muted max-w-sm">请先前往［选题工作台］挑选海外资讯并一键推送，或刷新同步接口。</p>
        <button
          onClick={() => setActiveTab('topics')}
          className="px-4.5 py-2 text-button-readable font-semibold bg-[#0066CC] hover:bg-apple-blue-hover text-white rounded-xl cursor-pointer shadow-xs"
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
            <div className="text-caption-readable font-bold text-apple-muted uppercase tracking-wide">当前精选重写选题</div>
            <select
              value={activeTopic.id}
              onChange={(e) => setSelectedTopicId(e.target.value)}
              className="mt-0.5 bg-transparent border-none text-body-readable font-bold text-apple-dark outline-none p-0 cursor-pointer max-w-sm sm:max-w-md md:max-w-lg truncate"
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
          <div className="text-caption-readable text-apple-muted font-medium">原创出处: <span className="font-mono text-apple-dark font-semibold">{activeTopic.sourceName}</span></div>
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

      <section className="bg-white border border-apple-border rounded-[24px] p-4 shadow-[0_4px_24px_rgba(0,0,0,0.02)] grid grid-cols-1 md:grid-cols-5 gap-3">
        <div className="rounded-2xl border border-apple-border bg-apple-bg/35 p-3">
          <div className="text-caption-readable font-bold text-apple-muted">关联 Topic</div>
          <div className="text-body-readable font-bold text-apple-dark line-clamp-2 mt-1">{activeTopic.translatedTitle}</div>
        </div>
        <div className="rounded-2xl border border-apple-border bg-apple-bg/35 p-3">
          <div className="text-caption-readable font-bold text-apple-muted">关联 SourceItem</div>
          <div className="text-body-readable font-bold text-apple-dark mt-1">{workflowStatus?.sourceItemId || activeTopic.sourceItemId || '未绑定'}</div>
        </div>
        <div className="rounded-2xl border border-apple-border bg-apple-bg/35 p-3">
          <div className="text-caption-readable font-bold text-apple-muted">当前版本</div>
          <div className="text-body-readable font-bold text-apple-dark mt-1">v{workflowStatus?.version.currentVersion ?? 0}</div>
        </div>
        <div className="rounded-2xl border border-apple-border bg-apple-bg/35 p-3">
          <div className="text-caption-readable font-bold text-apple-muted">工作流状态</div>
          <div className="text-body-readable font-bold text-apple-dark mt-1">{getWorkflowStatusLabel()}</div>
          {workflowStatus?.quality.checked && (
            <div className="text-caption-readable text-apple-muted mt-1">
              质检 {workflowStatus.quality.passed ? '通过' : `${workflowStatus.quality.riskCount} 个风险项`}
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-3">
          <div className="text-caption-readable font-bold text-apple-blue">下一步建议</div>
          <div className="text-body-readable font-bold text-apple-dark mt-1">{getWorkflowAdvice()}</div>
          <button
            type="button"
            onClick={handleWorkflowAction}
            disabled={qualityLoading || packageLoading || workflowLoading}
            className="mt-2 px-3 py-1.5 rounded-xl bg-apple-blue text-white text-caption-readable font-bold flex items-center gap-1.5 disabled:opacity-50"
          >
            {workflowStatus?.nextAction.type === 'create_package' ? <PackageCheck className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
            <span>{packageLoading ? '生成中...' : workflowStatus?.nextAction.label || (currentArticleId ? '运行质量检查' : '生成文章')}</span>
          </button>
        </div>
      </section>

      {workflowStatus?.quality.risks.length ? (
        <section className="bg-white border border-amber-200 rounded-[24px] p-4 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
          <h3 className="text-section-title font-bold text-apple-dark mb-2">质量风险项</h3>
          <div className="space-y-2">
            {workflowStatus.quality.risks.map((risk) => (
              <div key={`${risk.code}-${risk.message}`} className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-body-readable text-amber-800">
                <span className="font-mono font-bold">[{risk.severity}] {risk.code}</span>
                <span className="ml-2 font-semibold">{risk.message}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* 2. Parameters Drawer block & main editor split */}
      <section id="editor-panels" className="grid grid-cols-1 lg:grid-cols-6 gap-6 items-start">
        
        {/* Generation parameters */}
        <div className="bg-white border border-apple-border rounded-[24px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-5 lg:col-span-1">
          <div className="flex items-center space-x-2 border-b border-apple-border pb-3">
            <Settings2 className="h-4.5 w-4.5 text-apple-blue" />
            <h3 className="text-section-title font-bold text-apple-dark">生成参数</h3>
          </div>

          {/* Prompt sliders */}
          <div className="space-y-4">
            {/* temperature */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-meta-readable font-semibold text-apple-muted">
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
              <div className="flex justify-between text-caption-readable text-apple-muted font-mono">
                <span>严肃写实</span>
                <span>天马行空</span>
              </div>
            </div>

            {/* target limit length */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-meta-readable font-semibold text-apple-muted">
                <span>推测单版字数限制</span>
                <span className="font-mono text-apple-dark font-bold">{targetLength} 字</span>
              </div>
              <input
                type="range"
                min="700"
                max="1000"
                step="100"
                value={targetLength}
                onChange={(e) => setTargetLength(parseInt(e.target.value))}
                className="w-full h-1 bg-[#E5E5E7] rounded-lg appearance-none cursor-pointer accent-apple-blue"
              />
              <div className="flex justify-between text-caption-readable text-apple-muted font-mono">
                <span>短快轻（700）</span>
                <span>标准稿（1000）</span>
              </div>
            </div>

            {/* Tone category tuning */}
            <div className="space-y-1.5">
              <label className="text-caption-readable font-bold text-apple-muted uppercase">词藻风趣度 (Tone)</label>
              <select
                value={outlineTone}
                onChange={(e) => setOutlineTone(e.target.value)}
                className="w-full px-2 py-2 bg-apple-bg border border-apple-border outline-none rounded-xl text-body-readable font-semibold text-apple-dark cursor-pointer animate-fade-in"
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
            className="w-full py-2.5 rounded-xl bg-[#0066CC] hover:bg-apple-blue-hover text-white font-bold text-button-readable shadow-xs transition-all cursor-pointer flex items-center justify-center space-x-1.5 disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>生成中 ({generatingProgress}%)</span>
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" />
                <span>生成当前版本</span>
              </>
            )}
          </button>
          
          <div className="text-caption-readable font-mono text-apple-muted text-center leading-relaxed font-semibold">
            单篇生成，约 60–90 秒。
          </div>
          <div className="text-caption-readable text-apple-muted text-center font-semibold">
            不同受众请切换后分别生成。
          </div>
          {generateErrors[activeAudienceTab] && (
            <div className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-meta-readable font-semibold text-rose-600 leading-relaxed">
              {generateErrors[activeAudienceTab]}
            </div>
          )}
        </div>

        {/* Big Editing Workspace Grid (Tabbed editor) */}
        <div className="bg-white border border-apple-border rounded-[24px] shadow-[0_4px_24px_rgba(0,0,0,0.02)] lg:col-span-3 overflow-hidden flex flex-col h-[520px]">
          
          {/* Segment Control header to select Audience tab */}
          <div className="p-4 bg-apple-bg/50 border-b border-apple-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
            <div className="flex items-center space-x-1.5 p-0.5 rounded-xl bg-apple-bg border border-apple-border/50 text-meta-readable font-semibold text-apple-muted w-full sm:w-auto">
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

            <span className="text-caption-readable font-mono font-semibold px-2 py-1 rounded bg-[#E5E5E7]/50 text-apple-dark shrink-0 text-center border border-apple-border/20">
              字数计: <span className="text-apple-blue font-bold">{getEditorContentState().length}</span> / {targetLength}
            </span>
          </div>

          {/* Simulated typewriter or Loading indicator in workbench */}
          {isGenerating ? (
            <div id="loading-animation-pane" className="flex-1 flex flex-col items-center justify-center space-y-3 p-12">
              <Sparkles className="h-10 w-10 text-apple-blue animate-spin" />
              <div className="text-body-readable font-bold text-apple-dark font-mono tracking-wider">XIAOSHUN AI ENGINE DISTRIBUTING PROCESS...</div>
              <p className="text-caption-readable text-apple-muted font-medium text-center max-w-sm">{generateStage || '准备生成'}：正在生成「{activeAudienceTab === 'officeWorker' ? '打工人' : activeAudienceTab === 'student' ? '大学生' : '自由职业者'}」单篇文章。</p>
              
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
                  className="w-full bg-transparent border-none text-card-title font-bold text-apple-dark outline-none p-0 placeholder-apple-muted/50"
                />
              </div>

              {/* Excerpt Summary input */}
              <div className="p-3 bg-apple-bg/50 border-b border-apple-border/40 text-meta-readable flex items-center space-x-2">
                <span className="text-caption-readable font-bold text-apple-muted uppercase shrink-0">微信摘要:</span>
                <input
                  type="text"
                  value={getEditorExcerptState()}
                  onChange={(e) => setEditorExcerptState(e.target.value)}
                  placeholder="微信图文摘要，展示在消息卡片下方..."
                  className="w-full bg-transparent border-none text-meta-readable text-apple-dark outline-none p-0 placeholder-apple-muted/50 font-medium"
                />
              </div>

              {/* Markdown Toolbar helpers */}
              <div className="px-4 py-1.5 bg-apple-bg/25 border-b border-apple-border flex items-center justify-between text-apple-muted shrink-0">
                <div className="flex items-center space-x-2 text-meta-readable font-semibold text-[#0066CC]">
                  <button onClick={() => appendFormat('B')} className="px-2 py-0.5 rounded hover:bg-apple-bg hover:text-apple-dark transition cursor-pointer">B</button>
                  <button onClick={() => appendFormat('I')} className="px-2 py-0.5 rounded hover:bg-apple-bg hover:text-apple-dark transition cursor-pointer">I</button>
                  <button onClick={() => appendFormat('H1')} className="px-2 py-0.5 rounded hover:bg-apple-bg hover:text-apple-dark transition cursor-pointer">H3</button>
                  <button onClick={() => appendFormat('LIST')} className="px-2 py-0.5 rounded hover:bg-apple-bg hover:text-apple-dark transition cursor-pointer">List</button>
                  <button onClick={() => appendFormat('CODE')} className="px-2 py-0.5 rounded hover:bg-apple-bg hover:text-apple-dark transition cursor-pointer font-mono">&lt;/&gt;</button>
                </div>
                <div className="flex items-center gap-1 rounded-lg bg-white border border-apple-border p-0.5">
                  <button type="button" onClick={() => setEditorMode('preview')} className={`px-2 py-0.5 rounded-md text-caption-readable font-bold ${editorMode === 'preview' ? 'bg-apple-bg text-apple-dark' : 'text-apple-muted'}`}>预览</button>
                  <button type="button" onClick={() => setEditorMode('markdown')} className={`px-2 py-0.5 rounded-md text-caption-readable font-bold ${editorMode === 'markdown' ? 'bg-apple-bg text-apple-dark' : 'text-apple-muted'}`}>Markdown 原文</button>
                </div>
              </div>

              {editorMode === 'markdown' ? (
                <textarea
                  value={getEditorContentState()}
                  onChange={(e) => setEditorContentState(e.target.value)}
                  id="draft-active-textarea-body"
                  placeholder="此处支持原生 Markdown 格式排版直接录入，请在此处完善大模型生成的正文内容。"
                  className="w-full flex-1 p-5 outline-none resize-none overflow-y-auto text-body-readable font-semibold text-apple-dark leading-relaxed placeholder-apple-muted/50 font-sans"
                />
              ) : renderArticlePreview(getEditorContentState())}

              {/* Quality check result display */}
              {qualityResult && (
                <div className={`px-4 py-2.5 border-t text-caption-readable font-semibold ${
                  qualityResult.passed
                    ? 'bg-emerald-50/50 border-emerald-200 text-emerald-700'
                    : 'bg-amber-50/50 border-amber-200 text-amber-700'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold">质量检查：{qualityResult.passed ? '通过' : '有问题'}</span>
                    <span className="font-mono">得分: {qualityResult.score}/100</span>
                  </div>
                  {qualityResult.issues.length > 0 && (
                    <ul className="space-y-0.5 list-disc list-inside">
                      {qualityResult.issues.map((issue, i) => (
                        <li key={i} className={`${
                          issue.severity === 'high' ? 'text-rose-600' : issue.severity === 'medium' ? 'text-amber-600' : 'text-neutral-500'
                        }`}>
                          [{issue.severity}] {issue.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Sticky bottom CTA row */}
              <div className="p-3.5 bg-apple-bg/45 border-t border-apple-border flex items-center justify-between shrink-0 select-none">
                <div className="flex items-center space-x-2">
                  <div className="text-caption-readable font-mono text-apple-muted flex items-center space-x-1">
                    <Clock className="h-3 w-3" />
                    <span>暂存在本地草稿池</span>
                  </div>
                  {currentArticleId && (
                    <button
                      onClick={handleQualityCheck}
                      disabled={qualityLoading}
                      className="px-3 py-1 rounded-xl border border-apple-border bg-white text-caption-readable font-bold text-apple-dark flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                    >
                      <AlertCircle className="h-3 w-3" />
                      <span>{qualityLoading ? '检查中...' : '质量检查'}</span>
                    </button>
                  )}
                </div>

                <button
                  onClick={handleSaveDraft}
                  id="save-draft-workbench-btn"
                  className="px-4.5 py-2 bg-[#0066CC] hover:bg-apple-blue-hover text-white rounded-xl text-button-readable font-bold shadow-xs transition flex items-center space-x-1 cursor-pointer border border-[#0066CC]"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>生成完毕：导入草稿库</span>
                </button>
              </div>

            </div>
          )}

        </div>

        <div className="lg:col-span-2 space-y-4">
          <section className="bg-white border border-apple-border rounded-[24px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-section-title font-bold text-apple-dark">段落配图方案</h3>
                <p className="text-caption-readable text-apple-muted font-semibold mt-1">
                  {currentVisualPlan
                    ? `${1 + currentVisualPlan.imagePromptSet.inlineImages.length + 1} 条，基于 v${currentVisualPlan.basedOnArticleVersion} 文章生成`
                    : currentArticleId ? '正文已生成，段落配图可重试生成。' : '生成文章后自动规划。'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleRegenerateVisualPlan}
                disabled={!currentArticleId || visualPlanLoading}
                className="px-3 py-1.5 rounded-xl bg-apple-blue text-white text-caption-readable font-bold disabled:opacity-50 flex items-center gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${visualPlanLoading ? 'animate-spin' : ''}`} />
                <span>{visualPlanLoading ? '生成中' : '重新生成段落配图'}</span>
              </button>
            </div>
            {currentVisualPlan?.stale && (
              <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-caption-readable font-semibold text-amber-700">
                文章已修改，当前段落配图方案可能已过期，建议重新生成段落配图方案。
              </div>
            )}
            {currentVisualPlan ? (
              <div className="space-y-3">
                {[currentVisualPlan.imagePromptSet.cover, ...currentVisualPlan.imagePromptSet.inlineImages, currentVisualPlan.imagePromptSet.socialShare].map((item) => (
                  <div key={item.slot} className="rounded-xl border border-apple-border bg-apple-bg/30 p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-body-readable font-bold text-apple-dark">{item.label}</div>
                        <div className="text-caption-readable text-apple-muted font-semibold">
                          {item.relatedSectionTitle ? `对应小节：${item.relatedSectionTitle} · ` : ''}{item.placementHint} · {item.suggestedRatio}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyVisualPrompt(`【${item.label}】\n用途：${item.purpose}\n位置：${item.placementHint}\n提示词：${item.prompt}\n负面提示词：${item.negativePrompt}`)}
                        className="px-2 py-1 rounded-lg border border-apple-border bg-white text-meta-readable font-bold"
                      >
                        复制
                      </button>
                    </div>
                    <p className="text-caption-readable text-apple-dark leading-relaxed select-text">{item.purpose}</p>
                    <p className="text-caption-readable text-apple-muted leading-relaxed select-text">{item.prompt}</p>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => copyVisualPrompt([currentVisualPlan.imagePromptSet.cover, ...currentVisualPlan.imagePromptSet.inlineImages, currentVisualPlan.imagePromptSet.socialShare].map((item) => `【${item.label}】\n用途：${item.purpose}\n位置：${item.placementHint}\n提示词：${item.prompt}\n负面提示词：${item.negativePrompt}`).join('\n\n'))}
                  className="w-full px-3 py-2 rounded-xl border border-apple-border bg-white text-button-readable font-bold text-apple-dark"
                >
                  一键复制全部段落配图提示词
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-apple-border bg-apple-bg/30 p-5 text-center text-caption-readable text-apple-muted font-semibold">
                暂无段落配图方案。Kimi 失败时不会用固定模板冒充文章阅读结果。
              </div>
            )}
          </section>

        </div>

      </section>

    </div>
  );
}
