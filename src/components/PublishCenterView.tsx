/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Send,
  Smartphone,
  CheckCircle,
  AlertTriangle,
  Clock,
  Smartphone as IphoneIcon,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  ExternalLink,
  ChevronLeft,
  Share2,
  FileCheck,
  Award,
  BookOpen,
  Copy,
  Download,
  Tag,
  FileText,
  Image,
  Link2,
  Wrench,
  Package
} from 'lucide-react';
import { AiDraft, SyncTask, PublishPackage, PublishImagePrompt } from '../types';
import { publishApi } from '../api/publish';
import { wechatApi, type WechatPocResult, type WechatPocRun, type WechatProbeResult, type WechatStatusResponse } from '../api/wechat';

interface PublishCenterViewProps {
  drafts: AiDraft[];
  selectedDraftId: string | null;
  selectedPublishTaskId?: string | null;
  setSelectedDraftId: (id: string | null) => void;
  setSelectedPublishTaskId: (id: string | null) => void;
  syncTasks: SyncTask[];
  onTriggerSyncTask: (draftId: string) => void;
  onRefresh?: () => void;
  setActiveTab?: (tab: string) => void;
}

const wechatRunLabels: Record<WechatPocRun['mode'], string> = {
  probe: '编辑器探测',
  inject_poc: '注入测试',
  draft_save_poc: '保存草稿 PoC',
};

function parseWechatPocRuns(packageJson?: string): WechatPocRun[] {
  if (!packageJson) return [];
  try {
    const parsed = JSON.parse(packageJson) as { wechatPocRuns?: unknown };
    if (!Array.isArray(parsed.wechatPocRuns)) return [];
    return parsed.wechatPocRuns.filter((run): run is WechatPocRun => {
      if (!run || typeof run !== 'object') return false;
      const item = run as Partial<WechatPocRun>;
      return Boolean(item.runId && item.publishTaskId && item.mode && item.ranAt);
    });
  } catch {
    return [];
  }
}

function mergeWechatPocRuns(storedRuns: WechatPocRun[], result: WechatPocResult | WechatProbeResult | null) {
  const merged = [...(result?.recentRuns || []), ...storedRuns];
  const seen = new Set<string>();
  return merged.filter((run) => {
    if (seen.has(run.runId)) return false;
    seen.add(run.runId);
    return true;
  });
}

type MainActionMode =
  | 'save_to_wechat_draft'
  | 'create_package'
  | 'needs_quality_check'
  | 'quality_outdated'
  | 'quality_failed'
  | 'package_loading'
  | 'package_missing'
  | 'no_selection';

const audienceLabels: Record<string, string> = {
  officeWorker: '打工人',
  student: '大学生',
  freelancer: '自雇者',
};

function parsePackageJson(packageJson?: string | null): Partial<PublishPackage> | null {
  if (!packageJson) return null;
  try {
    const parsed = JSON.parse(packageJson) as Partial<PublishPackage>;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function isReadyPublishTask(task?: SyncTask | null) {
  if (!task) return false;
  return ['completed', 'success', 'package_ready'].includes(String(task.status));
}

function findDraftForTask(task: SyncTask | undefined, drafts: AiDraft[]) {
  if (!task) return undefined;
  return drafts.find((draft) => (
    draft.id === task.draftId ||
    draft.topicId === task.draftId ||
    Object.values(draft.articleIds || {}).includes(task.articleId || '')
  ));
}

function findLatestTaskForDraft(draft: AiDraft | undefined, tasks: SyncTask[]) {
  if (!draft) return undefined;
  const articleIds = new Set(Object.values(draft.articleIds || {}).filter(Boolean));
  return tasks.find((task) => (
    task.draftId === draft.id ||
    task.draftId === draft.topicId ||
    (task.articleId ? articleIds.has(task.articleId) : false)
  ));
}

function taskOptionLabel(task: SyncTask) {
  const audience = audienceLabels[task.syncedVersion] || task.syncedVersion || '文章';
  return `【${audience}】${task.title}`;
}

function isDevRuntime() {
  return Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);
}

export default function PublishCenterView({
  drafts,
  selectedDraftId,
  selectedPublishTaskId,
  setSelectedDraftId,
  setSelectedPublishTaskId,
  syncTasks,
  onTriggerSyncTask,
  onRefresh,
  setActiveTab
}: PublishCenterViewProps) {

  const [showTestData, setShowTestData] = useState(false);
  const [showManualSection, setShowManualSection] = useState(false);
  const [showDebugSection, setShowDebugSection] = useState(false);
  const [saveFlowStatus, setSaveFlowStatus] = useState<string | null>(null);
  const [saveFlowError, setSaveFlowError] = useState<string | null>(null);

  // Test data patterns
  const TEST_PATTERNS = ['[DEV]', '[TEST]', '[MOCK]', 'E2E'];

  function isTestTask(task: SyncTask): boolean {
    const fields = [task.title, task.outputHtml, task.outputMarkdown].filter(Boolean);
    return fields.some((f) => TEST_PATTERNS.some((p) => f.includes(p)));
  }

  function isTestDraft(draft: AiDraft): boolean {
    const fields = [draft.translatedTitle, draft.versions.officeWorker.title, draft.versions.student.title, draft.versions.freelancer.title].filter(Boolean);
    return fields.some((f) => TEST_PATTERNS.some((p) => f.includes(p)));
  }

  // Filter test data
  const filteredDrafts = showTestData ? drafts : drafts.filter((d) => !isTestDraft(d));
  const filteredTasks = showTestData ? syncTasks : syncTasks.filter((t) => !isTestTask(t));

  // Task-first selection: PublishCenter's primary state is selectedPublishTaskId.
  const activePublishTask = selectedPublishTaskId
    ? filteredTasks.find((t) => t.id === selectedPublishTaskId)
    : undefined;

  const handoffDraft = selectedDraftId
    ? filteredDrafts.find(d => d.id === selectedDraftId || d.topicId === selectedDraftId)
    : undefined;

  // activeDraft is only contextual; it must not override an existing PublishTask selection.
  const activeDraft = activePublishTask
    ? findDraftForTask(activePublishTask, filteredDrafts)
    : handoffDraft;

  // Resolve handoff state once, otherwise default to the latest successful PublishTask.
  useEffect(() => {
    if (selectedPublishTaskId && filteredTasks.some((task) => task.id === selectedPublishTaskId)) return;

    if (handoffDraft) {
      const matchingTask = findLatestTaskForDraft(handoffDraft, filteredTasks);
      if (matchingTask) {
        if (matchingTask.id !== selectedPublishTaskId) setSelectedPublishTaskId(matchingTask.id);
      } else if (selectedPublishTaskId) {
        setSelectedPublishTaskId(null);
      }
      return;
    }

    const latestSuccessTask = filteredTasks.find(isReadyPublishTask);
    const fallbackTask = latestSuccessTask || filteredTasks[0];
    if (fallbackTask && fallbackTask.id !== selectedPublishTaskId) {
      setSelectedPublishTaskId(fallbackTask.id);
    } else if (!fallbackTask && selectedPublishTaskId) {
      setSelectedPublishTaskId(null);
    }
  }, [selectedPublishTaskId, handoffDraft, filteredTasks, setSelectedPublishTaskId]);

  // Scroll selected task into view
  useEffect(() => {
    if (activePublishTask) {
      window.setTimeout(() => {
        document.getElementById(`publish-task-${activePublishTask.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 80);
    }
  }, [activePublishTask?.id]);

  // Handle task card click
  const handleSelectTask = (taskId: string) => {
    setSelectedPublishTaskId(taskId);
    setSelectedDraftId(null);
    setSaveFlowStatus(null);
    setSaveFlowError(null);
    setWechatPocResult(null);
  };

  const handleDropdownSelectTask = (taskId: string) => {
    const task = filteredTasks.find(t => t.id === taskId);
    setSelectedPublishTaskId(taskId || null);
    setSelectedDraftId(null);
    setSaveFlowStatus(null);
    setSaveFlowError(null);
    setWechatPocResult(null);
    if (isDevRuntime() && task) {
      const packageJson = parsePackageJson(task.packageJson);
      const previewTitle = packageJson?.title || task.title || '';
      const mainActionMode: MainActionMode = (isReadyPublishTask(task) && (packageJson?.title || packageJson?.markdown || packageJson?.html || task.outputHtml || task.outputMarkdown))
        ? 'save_to_wechat_draft'
        : 'package_missing';
      console.debug({
        source: 'publish-select-change',
        selectedPublishTaskId: taskId,
        activePublishTaskId: task.id,
        previewTitle,
        mainActionMode,
      });
    }
  };

  // Create package for a task that has no packageJson
  const handleCreatePackageForTask = async () => {
    if (!activePublishTask) return;
    const articleId = activePublishTask.articleId || activePublishTask.draftId;
    setSaveFlowStatus('正在生成发布包...');
    setSaveFlowError(null);
    try {
      const result = await publishApi.create(articleId);
      setSelectedPublishTaskId(result.id);
      setSaveFlowStatus('发布包已生成');
      onRefresh?.();
    } catch (error) {
      setSaveFlowError(error instanceof Error ? error.message : '生成发布包失败');
      setSaveFlowStatus(null);
    }
  };

  // Create package when no task exists (from article)
  const handleStartSync = () => {
    if (!activeDraft) return;
    const existingTask = filteredTasks.find(t => t.draftId === activeDraft.id || t.draftId === activeDraft.topicId);
    if (existingTask) return;
    onTriggerSyncTask(activeDraft.id);
  };

  const getTaskStatusBadge = (task: SyncTask) => {
    const pocRuns = parseWechatPocRuns(task.packageJson);
    const lastSaveRun = pocRuns.find(r => r.mode === 'draft_save_poc');
    const manualConfirmed = task.packageJson ? (() => { try { return JSON.parse(task.packageJson).wechatManualConfirmed === true; } catch { return false; } })() : false;
    if (manualConfirmed) {
      return <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded text-badge-readable font-mono font-bold">已人工确认草稿存在</span>;
    }
    if (lastSaveRun?.success) {
      return <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded text-badge-readable font-mono font-bold">微信草稿箱已保存</span>;
    }
    if (lastSaveRun?.errorCode === 'WECHAT_SAVE_RESULT_UNKNOWN') {
      return <span className="bg-amber-50 text-amber-600 border border-amber-100 px-2 py-0.5 rounded text-badge-readable font-mono font-bold">已点击保存，待确认草稿箱</span>;
    }
    if (task.status === 'completed') {
      return <span className="bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded text-badge-readable font-mono font-bold">发布内容已生成</span>;
    }
    if (task.status === 'failed') {
      return <span className="bg-rose-50 text-rose-600 border border-rose-100 px-2 py-0.5 rounded text-badge-readable font-mono font-bold">导出失败</span>;
    }
    return <span className="bg-neutral-50 text-neutral-500 border border-neutral-100 px-2 py-0.5 rounded text-badge-readable font-mono font-bold">处理中</span>;
  };

  const [loadedPackage, setLoadedPackage] = useState<{ taskId: string; pkg: PublishPackage } | null>(null);
  const [pkgLoading, setPkgLoading] = useState(false);
  const [packageLoadAttemptedTaskId, setPackageLoadAttemptedTaskId] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState('');
  const [wechatStatus, setWechatStatus] = useState<WechatStatusResponse | null>(null);
  const [wechatPocResult, setWechatPocResult] = useState<WechatPocResult | WechatProbeResult | null>(null);
  const [wechatPocLoading, setWechatPocLoading] = useState(false);
  const storedWechatPocRuns = parseWechatPocRuns(activePublishTask?.packageJson);
  const visibleWechatPocRuns = mergeWechatPocRuns(storedWechatPocRuns, wechatPocResult);
  const wechatRunsByMode = {
    probe: visibleWechatPocRuns.filter((run) => run.mode === 'probe').slice(0, 3),
    inject_poc: visibleWechatPocRuns.filter((run) => run.mode === 'inject_poc').slice(0, 3),
    draft_save_poc: visibleWechatPocRuns.filter((run) => run.mode === 'draft_save_poc').slice(0, 3),
  };

  const pkg = loadedPackage && loadedPackage.taskId === activePublishTask?.id ? loadedPackage.pkg : null;
  const storedPackage = parsePackageJson(activePublishTask?.packageJson);
  const activePackage = pkg || storedPackage;
  const packageAvailable = Boolean(
    activePackage?.title ||
    activePackage?.markdown ||
    activePackage?.html ||
    activePublishTask?.outputHtml ||
    activePublishTask?.outputMarkdown
  );
  const previewTitle = activePackage?.title || activePublishTask?.title || '';
  const previewSummary = activePackage?.summary || (activePublishTask?.outputMarkdown ? activePublishTask.outputMarkdown.slice(0, 140) : '');
  const previewContent = activePackage?.markdown || activePublishTask?.outputMarkdown || '';
  const currentVersionData = activeDraft ? activeDraft.versions[activeDraft.selectedAudience] : null;
  // Auto-select existing task for activeDraft if no task is currently selected
  useEffect(() => {
    if (activePublishTask || !activeDraft) return;
    const existingTask = filteredTasks.find(t => t.draftId === activeDraft.id || t.draftId === activeDraft.topicId);
    if (existingTask && existingTask.id !== selectedPublishTaskId) {
      setSelectedPublishTaskId(existingTask.id);
    }
  }, [activePublishTask, activeDraft, filteredTasks, selectedPublishTaskId, setSelectedPublishTaskId]);

  const mainActionMode: MainActionMode = activePublishTask
    ? (packageAvailable && isReadyPublishTask(activePublishTask)
      ? 'save_to_wechat_draft'
      : (pkgLoading || packageLoadAttemptedTaskId !== activePublishTask.id ? 'package_loading' : 'package_missing'))
    : activeDraft
      ? (activeDraft.status === 'approved' || activeDraft.reviewScore > 0
        ? 'create_package'
        : activeDraft.status === 'failed'
          ? 'quality_failed'
          : activeDraft.status === 'editing'
            ? 'quality_outdated'
            : 'needs_quality_check')
      : 'no_selection';

  useEffect(() => {
    if (!activePublishTask?.id) {
      setLoadedPackage(null);
      setPackageLoadAttemptedTaskId(null);
      return;
    }
    let cancelled = false;
    setPkgLoading(true);
    setPackageLoadAttemptedTaskId(null);
    publishApi.getPackage(activePublishTask.id)
      .then((data) => { if (!cancelled) setLoadedPackage({ taskId: activePublishTask.id, pkg: data }); })
      .catch(() => { if (!cancelled) setLoadedPackage(null); })
      .finally(() => {
        if (!cancelled) {
          setPackageLoadAttemptedTaskId(activePublishTask.id);
          setPkgLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [activePublishTask?.id]);

  useEffect(() => {
    wechatApi.status()
      .then((status) => setWechatStatus(status))
      .catch(() => setWechatStatus(null));
  }, []);

  const handleWechatPocCheck = async () => {
    if (!activePublishTask?.id) return;
    setWechatPocLoading(true);
    setWechatPocResult(null);
    try {
      const result = await wechatApi.runDraftPoc(activePublishTask.id);
      setWechatPocResult(result);
    } catch (error) {
      setWechatPocResult({
        success: false,
        mode: 'poc_check',
        message: error instanceof Error ? error.message : '自动化 PoC 检查失败。',
        errorCode: 'WECHAT_UNKNOWN_ERROR',
        evidence: {
          sessionChecked: false,
          editorReached: false,
          htmlPrepared: false,
          contentInjected: false,
          draftSaved: false,
        },
      });
    } finally {
      setWechatPocLoading(false);
    }
  };

  const handleWechatPocAction = async (action: 'probe' | 'inject' | 'save') => {
    if (!activePublishTask?.id) return;
    if (action === 'save') {
      const confirmed = window.confirm('确认执行真实保存草稿 PoC？该操作会打开微信公众号后台，尝试将当前发布包保存为公众号草稿。不会群发，不会定时发布，但会在草稿箱生成内容。');
      if (!confirmed) return;
    }
    setWechatPocLoading(true);
    setWechatPocResult(null);
    try {
      const activeRunId = wechatPocResult && 'runId' in wechatPocResult ? wechatPocResult.runId ?? null : null;
      const result = action === 'probe'
        ? await wechatApi.probeEditor(activePublishTask.id)
        : action === 'inject'
          ? await wechatApi.injectDraftPoc(activePublishTask.id)
          : await wechatApi.saveDraftPoc(activePublishTask.id, true, activeRunId);
      setWechatPocResult(result);
    } catch (error) {
      setWechatPocResult({
        success: false,
        mode: 'poc_check',
        message: error instanceof Error ? error.message : '微信自动化 PoC 执行失败。',
        errorCode: 'WECHAT_UNKNOWN_ERROR',
        evidence: {
          sessionChecked: false,
          draftPageOpened: false,
          titleInputFound: false,
          editorFound: false,
          saveButtonFound: false,
          htmlPrepared: false,
          contentInjected: false,
          draftSaved: false,
        },
        warnings: [],
      });
    } finally {
      setWechatPocLoading(false);
    }
  };

  const handleSaveToWechat = async () => {
    if (!activePublishTask?.id) return;
    if (!wechatStatus?.enabled) return;
    if (!packageAvailable) {
      setSaveFlowError('发布包内容缺失，请重新生成发布包。');
      setSaveFlowStatus(null);
      return;
    }
    const confirmed = window.confirm('确认保存到微信公众号草稿箱？\n\n该操作会打开微信公众号后台，将当前发布包的内容保存为公众号草稿。\n\n不会群发，不会定时发布。');
    if (!confirmed) return;

    setWechatPocLoading(true);
    setSaveFlowStatus('正在探测编辑器...');
    setSaveFlowError(null);
    setWechatPocResult(null);

    try {
      // Step 1: Validate session, then probe editor
      const sessionResult = await wechatApi.validateSession();
      if (!sessionResult.success) {
        setSaveFlowError(sessionResult.message || '微信 session 校验失败');
        setSaveFlowStatus(null);
        return;
      }
      const probeResult = await wechatApi.probeEditor(activePublishTask.id);
      if (!probeResult.success) {
        setSaveFlowError(probeResult.message || '编辑器探测失败');
        setWechatPocResult(probeResult);
        setSaveFlowStatus(null);
        return;
      }
      setSaveFlowStatus('正在注入内容...');

      // Step 2: Inject content
      const injectResult = await wechatApi.injectDraftPoc(activePublishTask.id);
      if (!injectResult.success) {
        setSaveFlowError(injectResult.message || '内容注入失败');
        setWechatPocResult(injectResult);
        setSaveFlowStatus(null);
        return;
      }
      setSaveFlowStatus('正在保存草稿...');

      // Step 3: Save draft
      const activeRunId = injectResult.runId ?? null;
      const saveResult = await wechatApi.saveDraftPoc(activePublishTask.id, true, activeRunId);
      setWechatPocResult(saveResult);

      if (saveResult.success) {
        setSaveFlowStatus('草稿已保存到微信公众号');
      } else if (saveResult.errorCode === 'WECHAT_SAVE_RESULT_UNKNOWN' && saveResult.evidence?.saveClicked === true) {
        setSaveFlowStatus('已点击保存，请到微信公众号草稿箱确认是否生成。');
        setSaveFlowError(null);
      } else {
        setSaveFlowError(saveResult.message || '保存草稿失败');
        setSaveFlowStatus(null);
      }
    } catch (error) {
      setSaveFlowError(error instanceof Error ? error.message : '保存到微信草稿箱失败');
      setSaveFlowStatus(null);
    } finally {
      setWechatPocLoading(false);
    }
  };

  const copyText = async (text?: string | null, label?: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      if (label) { setCopyFeedback(`${label} 已复制`); window.setTimeout(() => setCopyFeedback(''), 2200); }
    } catch {
      if (label) { setCopyFeedback(`${label} 复制失败`); window.setTimeout(() => setCopyFeedback(''), 2200); }
    }
  };

  const downloadText = (filename: string, text?: string | null, mime = 'text/plain;charset=utf-8') => {
    if (!text) return;
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const legacyImagePromptText = (slots: PublishPackage['imageSlots']) => {
    if (!slots.length) return '';
    return slots.map((s) =>
      `【${s.slotKey}】${s.aspectRatio} ${s.stylePreset}\n中文: ${s.promptZh}\n英文: ${s.promptEn}\n负面: ${s.negativePrompt}\nAlt: ${s.altText}`
    ).join('\n\n');
  };

  const imagePrompts: PublishImagePrompt[] = pkg?.imagePromptSet
    ? [pkg.imagePromptSet.cover, ...pkg.imagePromptSet.inlineImages, ...(pkg.imagePromptSet.socialShare ? [pkg.imagePromptSet.socialShare] : [])]
    : [];

  const buildImagePromptText = (prompts: PublishImagePrompt[]) => {
    if (prompts.length > 0) {
      return prompts.map((item) =>
        `【${item.label}｜${item.slot}｜${item.suggestedRatio}】\n用途：${item.purpose}\n对应小节：${item.relatedSectionTitle || '无'}\n插入段落：${item.insertAfterParagraph || '无'}\n位置：${item.placementHint}\n提示词：${item.prompt}\n负面提示词：${item.negativePrompt}`
      ).join('\n\n');
    }
    return pkg ? legacyImagePromptText(pkg.imageSlots) : '';
  };

  return (
    <div id="publish-view-wrapper" className="space-y-6 container mx-auto px-1 py-1">

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

      {/* 1. Header Select row */}
      <section id="select-publish-draft" className="bg-white border border-apple-border rounded-[24px] p-4 shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <div className="h-8 w-8 rounded-lg bg-apple-bg border border-apple-border/50 flex items-center justify-center text-apple-blue">
            <Smartphone className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="text-caption-readable font-bold text-apple-muted uppercase tracking-wide">可 dry-run 导出的微信图文列表</div>
            {filteredTasks.length === 0 ? (
              <span className="text-body-readable text-apple-muted font-semibold mt-0.5">暂无可用发布包</span>
            ) : (
              <select
                value={selectedPublishTaskId || ''}
                onChange={(e) => handleDropdownSelectTask(e.target.value)}
                className="mt-0.5 bg-transparent border-none text-body-readable font-bold text-apple-dark outline-none p-0 cursor-pointer max-w-sm sm:max-w-md md:max-w-lg truncate"
              >
                {filteredTasks.map(task => (
                  <option key={task.id} value={task.id} className="text-apple-dark bg-white font-semibold">
                    {taskOptionLabel(task).slice(0, 52)}{taskOptionLabel(task).length > 52 ? '...' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Sync Trigger Action */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          {(() => {
            if (mainActionMode === 'save_to_wechat_draft') {
              return (
                <button
                  type="button"
                  onClick={handleSaveToWechat}
                  disabled={wechatPocLoading || !wechatStatus?.enabled}
                  className="px-5 py-2.5 bg-[#07C160] hover:bg-[#06AD56] text-white rounded-xl text-button-readable font-bold shadow-xs transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border border-[#07C160]"
                >
                  {wechatPocLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>{saveFlowStatus || '处理中...'}</span>
                    </>
                  ) : saveFlowStatus?.startsWith('已点击保存') ? (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      <span>{saveFlowStatus}</span>
                    </>
                  ) : saveFlowStatus === '草稿已保存到微信公众号' ? (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      <span>已保存到微信草稿箱</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      <span>保存到微信公众号草稿箱</span>
                    </>
                  )}
                </button>
              );
            }

            if (mainActionMode === 'package_loading') {
              return (
                <button
                  type="button"
                  disabled
                  className="px-5 py-2.5 bg-[#0066CC] text-white rounded-xl text-button-readable font-bold shadow-xs transition-all flex items-center space-x-1.5 disabled:opacity-60 disabled:cursor-not-allowed border border-[#0066CC]"
                >
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>加载发布包内容...</span>
                </button>
              );
            }

            if (mainActionMode === 'package_missing') {
              return (
                <button
                  type="button"
                  onClick={handleCreatePackageForTask}
                  className="px-5 py-2.5 bg-[#0066CC] hover:bg-apple-blue-hover text-white rounded-xl text-button-readable font-bold shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <Package className="h-4 w-4" />
                  <span>重新生成发布内容</span>
                </button>
              );
            }

            if (mainActionMode === 'needs_quality_check') {
              return (
                <button
                  type="button"
                  onClick={() => {
                    if (!activeDraft) return;
                    setSelectedDraftId(activeDraft.id);
                    setActiveTab?.('workshop');
                  }}
                  disabled={!activeDraft}
                  className="px-5 py-2.5 bg-[#0066CC] hover:bg-apple-blue-hover text-white rounded-xl text-button-readable font-bold shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border border-[#0066CC]"
                >
                  <FileCheck className="h-4 w-4" />
                  <span>去文章工作区质检</span>
                </button>
              );
            }

            if (mainActionMode === 'quality_outdated') {
              return (
                <button
                  type="button"
                  onClick={() => {
                    if (!activeDraft) return;
                    setSelectedDraftId(activeDraft.id);
                    setActiveTab?.('workshop');
                  }}
                  disabled={!activeDraft}
                  className="px-5 py-2.5 bg-[#0066CC] hover:bg-apple-blue-hover text-white rounded-xl text-button-readable font-bold shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border border-[#0066CC]"
                >
                  <FileCheck className="h-4 w-4" />
                  <span>重新质量检查</span>
                </button>
              );
            }

            if (mainActionMode === 'quality_failed') {
              return (
                <button
                  type="button"
                  onClick={() => {
                    if (!activeDraft) return;
                    setSelectedDraftId(activeDraft.id);
                    setActiveTab?.('workshop');
                  }}
                  disabled={!activeDraft}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-button-readable font-bold shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border border-amber-600"
                >
                  <AlertTriangle className="h-4 w-4" />
                  <span>查看质量问题</span>
                </button>
              );
            }

            if (mainActionMode === 'create_package') {
              return (
                <button
                  onClick={handleStartSync}
                  disabled={!activeDraft}
                  id="wechat-trigger-sync-btn"
                  className="px-5 py-2.5 bg-[#0066CC] hover:bg-apple-blue-hover text-white rounded-xl text-button-readable font-bold shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border border-[#0066CC]"
                >
                  <Send className="h-4 w-4" />
                  <span>创建发布包</span>
                </button>
              );
            }

            return (
              <button
                type="button"
                disabled
                className="px-5 py-2.5 bg-[#0066CC] text-white rounded-xl text-button-readable font-bold shadow-xs transition-all flex items-center space-x-1.5 disabled:opacity-40 disabled:cursor-not-allowed border border-[#0066CC]"
              >
                <Package className="h-4 w-4" />
                <span>请选择发布包</span>
              </button>
            );
          })()}
          {saveFlowError && (
            <div className="text-caption-readable text-rose-600 font-semibold max-w-xs text-right">{saveFlowError}</div>
          )}
          {saveFlowStatus === '草稿已保存到微信公众号' && (
            <div className="text-caption-readable text-emerald-600 font-semibold">内容已保存到微信公众号后台草稿箱，可在微信公众号后台查看。</div>
          )}
          {saveFlowStatus?.startsWith('已点击保存') && (
            <div className="flex flex-col items-end gap-1">
              <div className="text-caption-readable text-amber-600 font-semibold">{saveFlowStatus}。浏览器保持打开，可手动确认。</div>
              <button
                type="button"
                onClick={async () => {
                  if (!activePublishTask?.id) return;
                  try {
                    await wechatApi.confirmManual(activePublishTask.id);
                    setSaveFlowStatus('用户已手动确认草稿存在。');
                    onRefresh?.();
                  } catch {
                    setSaveFlowStatus('用户已手动确认草稿存在。（后端记录失败）');
                  }
                }}
                className="text-caption-readable text-emerald-600 font-semibold underline cursor-pointer hover:text-emerald-700"
              >
                我已确认草稿箱存在
              </button>
            </div>
          )}
          {saveFlowStatus === '用户已手动确认草稿存在。' && (
            <div className="text-caption-readable text-emerald-600 font-semibold">已人工确认草稿存在于微信公众号草稿箱。</div>
          )}
          {mainActionMode === 'package_missing' && (
            <div className="text-caption-readable text-amber-600 font-semibold max-w-xs text-right">发布内容缺失，请重新生成发布内容。</div>
          )}
          {mainActionMode === 'save_to_wechat_draft' && !wechatStatus?.enabled && (
            <div className="text-caption-readable text-amber-600 font-semibold max-w-xs text-right">微信自动化未启用，请在设置中确认后端配置。</div>
          )}
        </div>
      </section>

      {/* 2. Middle Grid: iPhone Simulator on the Right, Queue Statuses on Left */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        
        {/* Left Side: Sync Queue logs */}
        <div className="space-y-4 lg:col-span-2">
          
          {/* Active queue task panel */}
          <div className="bg-white border border-apple-border rounded-[24px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-4">
            <h3 className="text-section-title font-bold text-apple-dark flex items-center space-x-2 border-b border-apple-border pb-3">
              <Share2 className="h-4.5 w-4.5 text-apple-blue" />
              <span>dry-run 草稿任务记录</span>
            </h3>

            <div className="space-y-3.5">
              {filteredTasks.length === 0 ? (
                <div className="py-8 text-center text-caption-readable text-apple-muted font-semibold">当前暂无 dry-run 任务</div>
              ) : (
                filteredTasks.map((task) => (
                  <div
                    key={task.id}
                    id={`publish-task-${task.id}`}
                    onClick={() => handleSelectTask(task.id)}
                    className={`p-3.5 bg-apple-bg/50 border rounded-xl space-y-2.5 text-body-readable font-semibold text-apple-dark cursor-pointer hover:border-apple-blue/50 transition ${
                      activePublishTask?.id === task.id ? 'border-apple-blue ring-2 ring-blue-100' : 'border-apple-border'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <h4 className="line-clamp-1 text-card-title truncate max-w-xs text-apple-dark font-bold">{task.title}</h4>
                      {getTaskStatusBadge(task)}
                    </div>
                    
                    {/* Progress tracking bar */}
                    <div className="space-y-1">
                      <div className="w-full bg-[#E5E5E7] h-1.5 rounded-full overflow-hidden">
                        <div 
                          style={{ width: `${task.progress}%` }} 
                          className="h-full bg-apple-blue rounded-full transition-all duration-300"
                        ></div>
                      </div>
                      <div className="flex justify-between text-caption-readable font-mono text-apple-muted font-bold">
                        <span>进度: {task.progress}%</span>
                        <span>系统通道: wx_draft_v2</span>
                      </div>
                    </div>

                    <p className="text-caption-readable text-apple-muted font-semibold italic">{task.message}</p>
                    <div className="flex justify-between items-center text-caption-readable font-mono text-apple-muted pt-1 border-t border-apple-border/50">
                      <span>通信版本: {task.syncedVersion === 'officeWorker' ? '社群社畜' : task.syncedVersion === 'student' ? '考研大专' : '自由人客群'}</span>
                      <span>时间: {task.timestamp}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Manual publish fallback - collapsible */}
          {activePublishTask?.id && (
            <div className="bg-white border border-apple-border rounded-[24px] shadow-[0_4px_24px_rgba(0,0,0,0.02)] overflow-hidden">
              <button
                type="button"
                onClick={() => setShowManualSection(!showManualSection)}
                className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-apple-bg/30 transition"
              >
                <div className="flex items-center gap-2">
                  <Copy className="h-4 w-4 text-apple-muted" />
                  <span className="text-section-title font-bold text-apple-dark">手动发布备用</span>
                  <span className="text-caption-readable text-apple-muted">复制/下载内容手动粘贴到微信后台</span>
                </div>
                <ChevronDown className={`h-4 w-4 text-apple-muted transition-transform ${showManualSection ? 'rotate-180' : ''}`} />
              </button>
              {showManualSection && (
                <div className="px-5 pb-4 space-y-3 border-t border-apple-border pt-3">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => copyText(activePublishTask?.outputHtml)} disabled={!activePublishTask?.outputHtml} className="px-3 py-2 rounded-xl border border-apple-border bg-white text-meta-readable font-bold text-apple-dark disabled:opacity-40 flex items-center gap-1.5">
                      <Copy className="h-3 w-3" />复制 HTML
                    </button>
                    <button type="button" onClick={() => downloadText(`${activeDraft?.id || 'article'}.html`, activePublishTask?.outputHtml)} disabled={!activePublishTask?.outputHtml} className="px-3 py-2 rounded-xl border border-apple-border bg-white text-meta-readable font-bold text-apple-dark disabled:opacity-40 flex items-center gap-1.5">
                      <Download className="h-3 w-3" />下载 HTML
                    </button>
                    <button type="button" onClick={() => downloadText(`${activeDraft?.id || 'article'}.md`, activePublishTask?.outputMarkdown || currentVersionData?.content)} disabled={!activeDraft} className="px-3 py-2 rounded-xl border border-apple-border bg-white text-meta-readable font-bold text-apple-dark disabled:opacity-40 flex items-center gap-1.5">
                      <Download className="h-3 w-3" />下载 Markdown
                    </button>
                    <button type="button" onClick={() => copyText(activePublishTask?.outputMarkdown || currentVersionData?.content)} disabled={!activeDraft} className="px-3 py-2 rounded-xl border border-apple-border bg-white text-meta-readable font-bold text-apple-dark disabled:opacity-40 flex items-center gap-1.5">
                      <Copy className="h-3 w-3" />复制 Markdown
                    </button>
                  </div>
                  <p className="text-caption-readable text-apple-muted font-semibold">复制内容后手动粘贴到微信公众号编辑器中。适用于自动化功能不可用时。</p>
                </div>
              )}
            </div>
          )}

          {/* Advanced debug - collapsible */}
          {wechatStatus?.enabled && activePublishTask?.id && (
            <div className="bg-white border border-apple-border rounded-[24px] shadow-[0_4px_24px_rgba(0,0,0,0.02)] overflow-hidden">
              <button
                type="button"
                onClick={() => setShowDebugSection(!showDebugSection)}
                className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-apple-bg/30 transition"
              >
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-apple-muted" />
                  <span className="text-section-title font-bold text-apple-dark">高级调试</span>
                  <span className="text-caption-readable text-apple-muted">分步执行 PoC 探测/注入/保存</span>
                </div>
                <ChevronDown className={`h-4 w-4 text-apple-muted transition-transform ${showDebugSection ? 'rotate-180' : ''}`} />
              </button>
              {showDebugSection && (
                <div className="px-5 pb-4 space-y-3 border-t border-apple-border pt-3">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={handleWechatPocCheck} disabled={wechatPocLoading} className="px-3 py-2 rounded-xl border border-apple-border bg-white text-meta-readable font-bold text-apple-dark disabled:opacity-40">
                      {wechatPocLoading ? '检查中...' : '自动化 PoC 检查'}
                    </button>
                    <button type="button" onClick={() => handleWechatPocAction('probe')} disabled={wechatPocLoading} className="px-3 py-2 rounded-xl border border-apple-border bg-white text-meta-readable font-bold text-apple-dark disabled:opacity-40">
                      探测编辑器
                    </button>
                    <button type="button" onClick={() => handleWechatPocAction('inject')} disabled={wechatPocLoading} className="px-3 py-2 rounded-xl border border-apple-border bg-white text-meta-readable font-bold text-apple-dark disabled:opacity-40">
                      注入测试，不保存
                    </button>
                    <button type="button" onClick={() => handleWechatPocAction('save')} disabled={wechatPocLoading} className="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-meta-readable font-bold text-rose-700 disabled:opacity-40">
                      保存草稿 PoC
                    </button>
                  </div>
                  <p className="text-caption-readable text-apple-muted font-semibold">分步执行自动化流程，用于调试和验证。正常发布请使用上方主按钮。</p>
                </div>
              )}
            </div>
          )}

          {/* Publish Package Panel */}
          {pkg && (
            <div className="bg-white border border-apple-border rounded-[24px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-4">
              <h4 className="text-section-title font-bold text-apple-dark flex items-center space-x-1.5">
                <FileCheck className="h-4 w-4 text-[#34C759]" />
                <span>发布包一键复制</span>
              </h4>
              {pkgLoading ? (
                <div className="py-4 text-center text-caption-readable text-apple-muted font-semibold">加载中...</div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => copyText(pkg.title, '标题')} className="px-3 py-2 rounded-xl border border-apple-border bg-white text-meta-readable font-bold flex items-center gap-1.5 hover:bg-apple-bg transition cursor-pointer">
                      <Copy className="h-3 w-3" />复制标题
                    </button>
                    <button type="button" onClick={() => copyText(pkg.summary, '摘要')} className="px-3 py-2 rounded-xl border border-apple-border bg-white text-meta-readable font-bold flex items-center gap-1.5 hover:bg-apple-bg transition cursor-pointer">
                      <Copy className="h-3 w-3" />复制摘要
                    </button>
                    <button type="button" onClick={() => copyText(pkg.markdown, 'Markdown')} className="px-3 py-2 rounded-xl border border-apple-border bg-white text-meta-readable font-bold flex items-center gap-1.5 hover:bg-apple-bg transition cursor-pointer">
                      <FileText className="h-3 w-3" />复制 Markdown
                    </button>
                    <button type="button" onClick={() => copyText(pkg.html, 'HTML')} className="px-3 py-2 rounded-xl border border-apple-border bg-white text-meta-readable font-bold flex items-center gap-1.5 hover:bg-apple-bg transition cursor-pointer">
                      <FileText className="h-3 w-3" />复制 HTML
                    </button>
                    <button type="button" onClick={() => copyText(buildImagePromptText(imagePrompts), '全部配图提示词')} className="px-3 py-2 rounded-xl border border-apple-border bg-white text-meta-readable font-bold flex items-center gap-1.5 hover:bg-apple-bg transition cursor-pointer">
                      <Image className="h-3 w-3" />一键复制段落配图
                    </button>
                    <button type="button" onClick={() => copyText(pkg.tags.join(', '), '标签')} className="px-3 py-2 rounded-xl border border-apple-border bg-white text-meta-readable font-bold flex items-center gap-1.5 hover:bg-apple-bg transition cursor-pointer">
                      <Tag className="h-3 w-3" />复制标签
                    </button>
                    <button type="button" onClick={() => copyText(pkg.privateDomainCta || pkg.cta, 'CTA')} className="px-3 py-2 rounded-xl border border-apple-border bg-white text-meta-readable font-bold flex items-center gap-1.5 hover:bg-apple-bg transition cursor-pointer">
                      <Copy className="h-3 w-3" />复制 CTA
                    </button>
                    <button type="button" onClick={() => copyText(pkg.aiDisclosure ? '本文由 AI 辅助生成，并经过人工审核编辑。' : '', 'AI 声明')} className="px-3 py-2 rounded-xl border border-apple-border bg-white text-meta-readable font-bold flex items-center gap-1.5 hover:bg-apple-bg transition cursor-pointer">
                      <Copy className="h-3 w-3" />复制 AI 声明
                    </button>
                    {pkg.sourceUrl && (
                      <button type="button" onClick={() => copyText(pkg.sourceUrl, '来源链接')} className="px-3 py-2 rounded-xl border border-apple-border bg-white text-meta-readable font-bold flex items-center gap-1.5 hover:bg-apple-bg transition cursor-pointer col-span-2">
                        <Link2 className="h-3 w-3" />复制来源链接
                      </button>
                    )}
                  </div>
                  <div className="rounded-2xl border border-apple-border bg-apple-bg/35 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-body-readable font-bold text-apple-dark">段落配图方案</div>
                        <div className="text-caption-readable text-apple-muted">
                          {imagePrompts.length > 0 ? `${imagePrompts.length} 条，来源：${pkg.imagePromptSource || 'legacy'}，基于 v${pkg.visualPlan?.basedOnArticleVersion || '-'} 文章` : '暂无段落配图方案'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyText(buildImagePromptText(imagePrompts), '全部配图提示词')}
                        className="px-3 py-1.5 rounded-xl bg-apple-blue text-white text-meta-readable font-bold flex items-center gap-1.5"
                      >
                        <Copy className="h-3 w-3" />复制全部
                      </button>
                    </div>
                    {pkg.imagePromptWarnings?.length ? (
                      <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-caption-readable font-semibold text-amber-700">
                        {pkg.imagePromptWarnings.join('；')}
                      </div>
                    ) : null}
                    <div className="space-y-2">
                      {(imagePrompts.length > 0 ? imagePrompts : []).map((item) => (
                        <div key={item.slot} className="rounded-xl border border-apple-border bg-white p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-body-readable font-bold text-apple-dark">{item.label}</div>
                              <div className="text-caption-readable text-apple-muted">
                                {item.relatedSectionTitle ? `对应小节：${item.relatedSectionTitle} · ` : ''}
                                {item.insertAfterParagraph ? `第 ${item.insertAfterParagraph} 段后 · ` : ''}
                                {item.purpose} · {item.suggestedRatio}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => copyText(`【${item.label}】\n用途：${item.purpose}\n对应小节：${item.relatedSectionTitle || '无'}\n插入位置：${item.placementHint}\n提示词：${item.prompt}\n负面提示词：${item.negativePrompt}`, item.label)}
                              className="px-2 py-1 rounded-lg border border-apple-border bg-white text-meta-readable font-bold flex items-center gap-1"
                            >
                              <Copy className="h-3 w-3" />复制
                            </button>
                          </div>
                          <p className="text-caption-readable text-apple-dark leading-relaxed select-text">{item.prompt}</p>
                          <p className="text-caption-readable text-apple-muted leading-relaxed select-text">位置：{item.placementHint}</p>
                          <p className="text-caption-readable text-apple-muted leading-relaxed select-text">负面：{item.negativePrompt}</p>
                        </div>
                      ))}
                      {imagePrompts.length === 0 && pkg.imageSlots.length > 0 && pkg.imageSlots.map((slot) => (
                        <div key={slot.slotKey} className="rounded-xl border border-apple-border bg-white p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-body-readable font-bold text-apple-dark">{slot.slotKey}</div>
                              <div className="text-caption-readable text-apple-muted">{slot.aspectRatio} · 旧配图提示词</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => copyText(slot.promptZh, slot.slotKey)}
                              className="px-2 py-1 rounded-lg border border-apple-border bg-white text-meta-readable font-bold flex items-center gap-1"
                            >
                              <Copy className="h-3 w-3" />复制
                            </button>
                          </div>
                          <p className="text-caption-readable text-apple-dark leading-relaxed mt-2 select-text">{slot.promptZh}</p>
                        </div>
                      ))}
                      {imagePrompts.length === 0 && pkg.imageSlots.length === 0 && (
                        <div className="rounded-xl border border-dashed border-apple-border bg-white p-4 text-center text-caption-readable text-apple-muted font-semibold">
                          暂无段落配图方案。不会用固定模板冒充 Kimi 文章阅读结果。
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1 border-t border-apple-border">
                    <button type="button" onClick={() => downloadText(`${pkg.title || 'article'}.html`, pkg.html, 'text/html')} className="flex-1 px-3 py-2 rounded-xl bg-[#0066CC] text-white text-meta-readable font-bold flex items-center justify-center gap-1.5 cursor-pointer">
                      <Download className="h-3 w-3" />下载 HTML
                    </button>
                    <button type="button" onClick={() => downloadText(`${pkg.title || 'article'}.md`, pkg.markdown)} className="flex-1 px-3 py-2 rounded-xl border border-apple-border bg-white text-meta-readable font-bold flex items-center justify-center gap-1.5 cursor-pointer">
                      <Download className="h-3 w-3" />下载 Markdown
                    </button>
                    <button type="button" onClick={() => downloadText(`${pkg.title || 'article'}-package.json`, JSON.stringify(pkg, null, 2), 'application/json;charset=utf-8')} className="flex-1 px-3 py-2 rounded-xl border border-apple-border bg-white text-meta-readable font-bold flex items-center justify-center gap-1.5 cursor-pointer">
                      <Download className="h-3 w-3" />下载 JSON
                    </button>
                  </div>
                  {copyFeedback && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-caption-readable font-bold text-emerald-700 text-center">
                      {copyFeedback}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {wechatStatus?.enabled && wechatPocResult && (
            <div className="bg-white border border-apple-border rounded-[24px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-3">
              <h4 className="text-section-title font-bold text-apple-dark">微信公众号自动化 PoC 结果</h4>
              <div className={`rounded-xl border px-3 py-2 text-body-readable font-bold ${
                wechatPocResult.success ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-amber-50 border-amber-100 text-amber-800'
              }`}>
                {wechatPocResult.message}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-caption-readable font-bold">
                {Object.entries(wechatPocResult.evidence).map(([key, value]) => (
                  <div key={key} className={`rounded-lg border px-2 py-1 ${value ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-neutral-50 text-neutral-500 border-neutral-100'}`}>
                    {key}: {typeof value === 'boolean' ? (value ? 'yes' : 'no') : String(value ?? 'null')}
                  </div>
                ))}
              </div>
              {'diagnostics' in wechatPocResult && wechatPocResult.diagnostics && (
                <div className="text-caption-readable font-mono text-apple-muted space-y-1">
                  <div>injectionStrategy: {String(wechatPocResult.evidence.injectionStrategy ?? 'null')}</div>
                  <div>runId: {String('runId' in wechatPocResult ? wechatPocResult.runId ?? 'null' : 'null')}</div>
                  <div>currentUrl: {wechatPocResult.diagnostics.currentUrl}</div>
                  <div>pageTitle: {wechatPocResult.diagnostics.pageTitle || '-'}</div>
                  {typeof wechatPocResult.diagnostics.keepBrowserOpen === 'boolean' && (
                    <div>keepBrowserOpen: {String(wechatPocResult.diagnostics.keepBrowserOpen)}</div>
                  )}
                  {wechatPocResult.diagnostics.keepAliveUntil && (
                    <div>keepAliveUntil: {wechatPocResult.diagnostics.keepAliveUntil}</div>
                  )}
                  {typeof wechatPocResult.diagnostics.editorTextLengthAfterInject === 'number' && (
                    <div>editorTextLengthAfterInject: {wechatPocResult.diagnostics.editorTextLengthAfterInject}</div>
                  )}
                </div>
              )}
              {wechatPocResult.warnings?.length ? (
                <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-caption-readable font-semibold text-amber-800">
                  {wechatPocResult.warnings.join('；')}
                </div>
              ) : null}
              {wechatPocResult.errorCode && (
                <div className="text-caption-readable font-mono text-apple-muted">errorCode: {wechatPocResult.errorCode}</div>
              )}
              <p className="text-caption-readable text-apple-muted font-semibold">PoC 模式不会保存真实草稿；只有真实执行并成功后，才允许显示真实草稿保存完成文案。</p>
            </div>
          )}

          {wechatStatus?.enabled && activePublishTask?.id && (
            <div className="bg-white border border-apple-border rounded-[24px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-3">
              <h4 className="text-section-title font-bold text-apple-dark">微信 PoC 最近 3 次记录</h4>
              <div className="grid grid-cols-1 gap-3">
                {(['probe', 'inject_poc', 'draft_save_poc'] as WechatPocRun['mode'][]).map((mode) => (
                  <div key={mode} className="rounded-xl border border-apple-border bg-apple-bg/40 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-body-readable font-bold text-apple-dark">{wechatRunLabels[mode]}</div>
                      <div className="text-caption-readable font-mono text-apple-muted">{wechatRunsByMode[mode].length}/3</div>
                    </div>
                    {wechatRunsByMode[mode].length === 0 ? (
                      <div className="text-caption-readable text-apple-muted font-semibold">暂无真实运行记录</div>
                    ) : (
                      <div className="space-y-2">
                        {wechatRunsByMode[mode].map((run) => (
                          <div key={run.runId} className="rounded-lg border border-apple-border bg-white px-3 py-2 text-caption-readable">
                            <div className="flex items-center justify-between gap-2 font-bold">
                              <span className={run.success ? 'text-emerald-700' : 'text-rose-700'}>
                                {run.success ? 'success' : 'failed'}{run.errorCode ? ` · ${run.errorCode}` : ''}
                              </span>
                              <span className="font-mono text-apple-muted">{new Date(run.ranAt).toLocaleString('zh-CN')}</span>
                            </div>
                            <div className="mt-1 text-apple-muted font-semibold line-clamp-2">{run.message}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-caption-readable text-apple-muted font-semibold">只有保存草稿 PoC 连续 3 次 draftSaved=true，才允许升级为受控保存草稿功能。</p>
            </div>
          )}

          {/* Quick specs instruction layout */}
          <div className="bg-white border border-apple-border rounded-[24px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-3">
            <h4 className="text-section-title font-bold text-apple-dark flex items-center space-x-1.5">
              <Award className="h-4 w-4 text-[#34C759]" />
              <span>发布说明</span>
            </h4>
            <ul className="space-y-1.5 list-disc list-inside text-body-readable text-apple-muted leading-normal font-semibold">
              {wechatStatus?.enabled ? (
                <>
                  <li>点击"保存到微信公众号草稿箱"可一键将内容保存到微信后台。</li>
                  <li>不会群发、不会定时发布，仅保存为草稿。</li>
                  <li>如需手动发布，展开"手动发布备用"复制内容。</li>
                </>
              ) : (
                <>
                  <li>发布包生成后，可复制 Markdown/HTML 手动粘贴到微信公众号编辑器。</li>
                  <li>开启微信自动化后可一键保存到草稿箱。</li>
                </>
              )}
            </ul>
          </div>

        </div>

        {/* Right Side: Smartphone Preview container (High visual fidelity iPhone wrapper) */}
        <div className="lg:col-span-3 flex flex-col items-center justify-center p-4 bg-apple-bg/50 border border-apple-border rounded-[24px] min-h-[580px]">
          
          <div className="select-none text-caption-readable text-apple-muted uppercase tracking-widest font-bold mb-4 flex items-center space-x-1.5 font-mono">
            <Smartphone className="h-4 w-4 text-apple-blue" />
            <span>WeChat 真机样式预览栏</span>
          </div>

          {/* High-fidelity simulated iPhone viewport container */}
          <div id="simulated-iphone-frame" className="w-[316px] h-[550px] bg-apple-dark rounded-[38px] p-2.5 shadow-2xl border-4 border-apple-dark relative flex flex-col shrink-0">
            
            {/* Speaker block notch camera */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-5 bg-apple-dark rounded-xl z-25 flex items-center justify-center">
              <div className="w-10 h-1 bg-neutral-800 rounded-full mr-2"></div>
              <div className="w-1.5 h-1.5 bg-neutral-800 rounded-full"></div>
            </div>

            {/* Simulated status bar */}
            <div className="w-full bg-white border-b border-apple-border/30 h-10 rounded-t-[26px] px-5 pt-5 flex items-center justify-between text-caption-readable text-apple-dark shrink-0 font-sans select-none">
              <span className="font-bold text-caption-readable">12:00</span>
              <div className="flex items-center space-x-1 font-mono text-caption-readable font-bold">
                <span>5G</span>
                <span className="inline-block w-4 h-2 bg-apple-dark rounded-xs"></span>
              </div>
            </div>

            {/* WeChat Header simulation */}
            <div className="w-full bg-white border-b border-apple-border/50 px-3.5 py-2 flex items-center justify-between shrink-0 select-none text-body-readable font-bold text-apple-dark">
              <ChevronLeft className="h-4.5 w-4.5 text-apple-dark cursor-pointer font-bold" />
              <span className="truncate max-w-[150px] font-bold">微信公众号图文</span>
              <span className="text-xl tracking-tighter cursor-pointer leading-none text-apple-muted">•••</span>
            </div>

            {/* WeChat Native content list - Scroll container scrollable */}
            <div id="wechat-render-screen" className="flex-1 bg-white overflow-y-auto px-4 py-4 select-text max-h-[420px]">
              {activePublishTask && packageAvailable ? (
                <article className="space-y-4 text-left">
                  {/* Article WeChat Title */}
                  <h1 className="text-card-title font-bold text-apple-dark leading-snug">
                    {previewTitle}
                  </h1>

                  {/* Subtitle pub info */}
                  <div className="flex items-center space-x-2 text-caption-readable text-apple-muted select-none font-semibold">
                    <span className="text-apple-blue font-bold hover:underline cursor-pointer">小顺 AI 运营组</span>
                    <span>2026-05-24</span>
                    <span className="font-mono">北京</span>
                  </div>

                  {/* Featured mock article cover box */}
                  <div className="w-full h-32 rounded-xl bg-apple-dark border border-apple-dark/10 overflow-hidden relative select-none">
                    {/* Pure CSS background visual banner to mock cover */}
                    <div className="absolute inset-0 bg-apple-dark text-white flex flex-col justify-between p-3.5">
                      <div className="text-caption-readable font-mono tracking-wider text-apple-muted flex justify-between font-bold">
                        <span>XIAOSHUN AI WEEKLY</span>
                        <span>CH.03</span>
                      </div>
                      <div className="space-y-1">
                        <div className="text-body-readable font-bold tracking-tight text-white leading-tight line-clamp-1">
                          {previewTitle}
                        </div>
                        <div className="text-caption-readable font-bold text-apple-blue tracking-widest font-mono uppercase">
                          AUDIENCE SPECIFIC OUTREACH
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Message abstract box */}
                  <div className="p-3 bg-apple-bg border-l-2 border-apple-blue text-body-readable text-apple-muted leading-normal font-semibold whitespace-pre-wrap select-all">
                    {previewSummary || '发布包摘要为空，请检查发布包内容。'}
                  </div>

                  {/* Main Paragraph content body rendered with CSS WeChat presets */}
                  <div className="text-body-readable leading-relaxed text-apple-dark space-y-3 whitespace-pre-wrap font-sans font-semibold selection:bg-apple-blue/15">
                    {previewContent || '发布包正文为空，请重新生成发布内容。'}

                    {/* Footer note signature */}
                    <div className="pt-4 border-t border-dashed border-apple-border font-mono text-caption-readable text-apple-muted select-none text-center leading-normal font-semibold">
                      <span>本文由 <b>小顺AI内容工作台</b> 针对其目标社群定制发布。</span>
                      <br />
                      <span>发布包 ID: {activePublishTask.id}</span>
                    </div>
                  </div>
                </article>
              ) : activePublishTask && pkgLoading ? (
                <div className="h-full flex flex-col items-center justify-center text-apple-muted p-8 select-none">
                  <RefreshCw className="h-6 w-6 mb-1.5 animate-spin" />
                  <span className="text-caption-readable text-center font-bold">正在加载当前发布包预览</span>
                </div>
              ) : activePublishTask ? (
                <div className="h-full flex flex-col items-center justify-center text-apple-muted p-8 select-none">
                  <AlertTriangle className="h-6 w-6 mb-1.5 text-amber-600" />
                  <span className="text-caption-readable text-center font-bold">发布内容缺失，请重新生成发布内容。</span>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-apple-muted p-8 select-none">
                  <BookOpen className="h-6 w-6 mb-1.5" />
                  <span className="text-caption-readable text-center font-bold">请选择发布包</span>
                </div>
              )}
            </div>

            {/* Simulated iPhone Home Indicator bar bottom */}
            <div className="w-full bg-white h-7 rounded-b-[26px] flex items-center justify-center shrink-0 select-none">
              <div className="w-28 h-1 bg-[#E5E5E7] rounded-full mb-1"></div>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
