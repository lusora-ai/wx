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
  RefreshCw, 
  ExternalLink,
  ChevronLeft,
  Share2,
  FileCheck,
  Award,
  BookOpen
} from 'lucide-react';
import { AiDraft, SyncTask } from '../types';

interface PublishCenterViewProps {
  drafts: AiDraft[];
  selectedDraftId: string | null;
  setSelectedDraftId: (id: string | null) => void;
  syncTasks: SyncTask[];
  onTriggerSyncTask: (draftId: string) => void;
}

export default function PublishCenterView({
  drafts,
  selectedDraftId,
  setSelectedDraftId,
  syncTasks,
  onTriggerSyncTask
}: PublishCenterViewProps) {
  
  // Find currently active draft for phone rendering
  const approvedDrafts = drafts.filter(d => d.status === 'approved' || d.status === 'synced');
  // Default to first approved or any first draft for beautiful phone rendering
  const activeDraft = drafts.find(d => d.id === selectedDraftId) || approvedDrafts[0] || drafts[0];

  useEffect(() => {
    if (activeDraft && !selectedDraftId) {
      setSelectedDraftId(activeDraft.id);
    }
  }, [activeDraft, selectedDraftId, setSelectedDraftId]);

  // Handle trigger syncing with progress bars
  const handleStartSync = () => {
    if (!activeDraft) return;
    onTriggerSyncTask(activeDraft.id);
  };

  const getTaskStatusBadge = (status: SyncTask['status']) => {
    switch (status) {
      case 'queued':
        return <span className="bg-neutral-50 text-neutral-500 border border-neutral-105-30 px-2 py-0.5 rounded text-[9px] font-mono font-bold animate-pulse">登载排队</span>;
      case 'syncing':
        return <span className="bg-amber-50 text-amber-500 border border-amber-100 px-2 py-0.5 rounded text-[9px] font-mono font-extrabold flex items-center space-x-1">
          <RefreshCw className="h-2.5 w-2.5 animate-spin mr-0.5" />
          <span>正在推流</span>
        </span>;
      case 'completed':
        return <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded text-[9px] font-mono font-bold">同步成功</span>;
      case 'failed':
        return <span className="bg-rose-50 text-rose-600 border border-rose-100 px-2 py-0.5 rounded text-[9px] font-mono font-bold">同步断联</span>;
    }
  };

  const currentVersionData = activeDraft ? activeDraft.versions[activeDraft.selectedAudience] : null;

  return (
    <div id="publish-view-wrapper" className="space-y-6 container mx-auto px-1 py-1">
      
      {/* 1. Header Select row */}
      <section id="select-publish-draft" className="bg-white border border-apple-border rounded-[24px] p-4 shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <div className="h-8 w-8 rounded-lg bg-apple-bg border border-apple-border/50 flex items-center justify-center text-apple-blue">
            <Smartphone className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-apple-muted uppercase tracking-wide">可同步审核微信图文列表</div>
            {drafts.length === 0 ? (
              <span className="text-xs text-apple-muted font-semibold mt-0.5">无任何草稿可用</span>
            ) : (
              <select
                value={activeDraft?.id || ''}
                onChange={(e) => setSelectedDraftId(e.target.value)}
                className="mt-0.5 bg-transparent border-none text-[11px] font-bold text-apple-dark outline-none p-0 cursor-pointer max-w-sm sm:max-w-md md:max-w-lg truncate"
              >
                {drafts.map(d => (
                  <option key={d.id} value={d.id} className="text-apple-dark bg-white font-semibold">
                    【{d.selectedAudience === 'officeWorker' ? '打工人' : d.selectedAudience === 'student' ? '大学生' : '自雇者'}】{d.versions[d.selectedAudience].title.substring(0, 36)}...
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Sync Trigger Action */}
        <button
          onClick={handleStartSync}
          disabled={!activeDraft || activeDraft.status === 'synced'}
          id="wechat-trigger-sync-btn"
          className="px-4 py-2 bg-[#0066CC] hover:bg-apple-blue-hover text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0 border border-[#0066CC]"
        >
          <Send className="h-3.5 w-3.5" />
          <span>{activeDraft?.status === 'synced' ? '微信服务端已缓存成文' : '一键推送至微信公众草稿箱'}</span>
        </button>
      </section>

      {/* 2. Middle Grid: iPhone Simulator on the Right, Queue Statuses on Left */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        
        {/* Left Side: Sync Queue logs */}
        <div className="space-y-4 lg:col-span-2">
          
          {/* Active queue task panel */}
          <div className="bg-white border border-apple-border rounded-[24px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-4">
            <h3 className="text-xs font-bold text-apple-dark flex items-center space-x-2 border-b border-apple-border pb-3">
              <Share2 className="h-4.5 w-4.5 text-apple-blue" />
              <span>微信公众号网络同步队列</span>
            </h3>

            <div className="space-y-3.5">
              {syncTasks.length === 0 ? (
                <div className="py-8 text-center text-[10px] text-apple-muted font-semibold">当前微信同步请求队列空置</div>
              ) : (
                syncTasks.map((task) => (
                  <div key={task.id} className="p-3.5 bg-apple-bg/50 border border-apple-border rounded-xl space-y-2.5 text-[11px] font-semibold text-apple-dark">
                    <div className="flex items-start justify-between">
                      <h4 className="line-clamp-1 text-xs truncate max-w-xs text-apple-dark font-bold">{task.title}</h4>
                      {getTaskStatusBadge(task.status)}
                    </div>
                    
                    {/* Progress tracking bar */}
                    <div className="space-y-1">
                      <div className="w-full bg-[#E5E5E7] h-1.5 rounded-full overflow-hidden">
                        <div 
                          style={{ width: `${task.progress}%` }} 
                          className="h-full bg-apple-blue rounded-full transition-all duration-300"
                        ></div>
                      </div>
                      <div className="flex justify-between text-[8px] font-mono text-apple-muted font-bold">
                        <span>进度: {task.progress}%</span>
                        <span>系统通道: wx_draft_v2</span>
                      </div>
                    </div>

                    <p className="text-[10px] text-apple-muted font-semibold italic">{task.message}</p>
                    <div className="flex justify-between items-center text-[8px] font-mono text-apple-muted pt-1 border-t border-apple-border/50">
                      <span>通信版本: {task.syncedVersion === 'officeWorker' ? '社群社畜' : task.syncedVersion === 'student' ? '考研大专' : '自由人客群'}</span>
                      <span>时间: {task.timestamp}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick specs instruction layout */}
          <div className="bg-white border border-apple-border rounded-[24px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-3">
            <h4 className="text-xs font-bold text-apple-dark flex items-center space-x-1.5">
              <Award className="h-4 w-4 text-[#34C759]" />
              <span>微信排版终核要诀</span>
            </h4>
            <ul className="space-y-1.5 list-disc list-inside text-[10.5px] text-apple-muted leading-normal font-semibold">
              <li>微信草稿同步完毕后，需要登录官方公众号微信公众号后台执行最终群发。</li>
              <li>本系统生成的 XML Markdown 结构深度兼容原生公众编辑器，无需二次洗稿清洗。</li>
              <li>请确保证设页内填写合法的 `AppID` 和 `AppSecret`，接口报错将返回在同步事件中。</li>
            </ul>
          </div>

        </div>

        {/* Right Side: Smartphone Preview container (High visual fidelity iPhone wrapper) */}
        <div className="lg:col-span-3 flex flex-col items-center justify-center p-4 bg-apple-bg/50 border border-apple-border rounded-[24px] min-h-[580px]">
          
          <div className="select-none text-[10px] text-apple-muted uppercase tracking-widest font-bold mb-4 flex items-center space-x-1.5 font-mono">
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
            <div className="w-full bg-white border-b border-apple-border/30 h-10 rounded-t-[26px] px-5 pt-5 flex items-center justify-between text-[11px] text-apple-dark shrink-0 font-sans select-none">
              <span className="font-bold text-[10px]">12:00</span>
              <div className="flex items-center space-x-1 font-mono text-[9px] font-bold">
                <span>5G</span>
                <span className="inline-block w-4 h-2 bg-apple-dark rounded-xs"></span>
              </div>
            </div>

            {/* WeChat Header simulation */}
            <div className="w-full bg-white border-b border-apple-border/50 px-3.5 py-2 flex items-center justify-between shrink-0 select-none text-[12px] font-bold text-apple-dark">
              <ChevronLeft className="h-4.5 w-4.5 text-apple-dark cursor-pointer font-bold" />
              <span className="truncate max-w-[150px] font-bold">微信公众号图文</span>
              <span className="text-xl tracking-tighter cursor-pointer leading-none text-apple-muted">•••</span>
            </div>

            {/* WeChat Native content list - Scroll container scrollable */}
            <div id="wechat-render-screen" className="flex-1 bg-white overflow-y-auto px-4 py-4 select-text max-h-[420px]">
              {activeDraft && currentVersionData ? (
                <article className="space-y-4 text-left">
                  {/* Article WeChat Title */}
                  <h1 className="text-[14px] font-bold text-apple-dark leading-snug">
                    {currentVersionData.title}
                  </h1>

                  {/* Subtitle pub info */}
                  <div className="flex items-center space-x-2 text-[10px] text-apple-muted select-none font-semibold">
                    <span className="text-apple-blue font-bold hover:underline cursor-pointer">小顺 AI 运营组</span>
                    <span>2026-05-24</span>
                    <span className="font-mono">北京</span>
                  </div>

                  {/* Featured mock article cover box */}
                  <div className="w-full h-32 rounded-xl bg-apple-dark border border-apple-dark/10 overflow-hidden relative select-none">
                    {/* Pure CSS background visual banner to mock cover */}
                    <div className="absolute inset-0 bg-apple-dark text-white flex flex-col justify-between p-3.5">
                      <div className="text-[9px] font-mono tracking-wider text-apple-muted flex justify-between font-bold">
                        <span>XIAOSHUN AI WEEKLY</span>
                        <span>CH.03</span>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[11px] font-bold tracking-tight text-white leading-tight line-clamp-1">
                          {activeDraft.translatedTitle}
                        </div>
                        <div className="text-[8px] font-bold text-apple-blue tracking-widest font-mono uppercase">
                          AUDIENCE SPECIFIC OUTREACH
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Message abstract box */}
                  <div className="p-3 bg-apple-bg border-l-2 border-apple-blue text-[10.5px] text-apple-muted leading-normal font-semibold whitespace-pre-wrap select-all">
                    {currentVersionData.excerpt}
                  </div>

                  {/* Main Paragraph content body rendered with CSS WeChat presets */}
                  <div className="text-[11px] leading-relaxed text-apple-dark space-y-3 whitespace-pre-wrap font-sans font-semibold selection:bg-apple-blue/15">
                    {currentVersionData.content}

                    {/* Footer note signature */}
                    <div className="pt-4 border-t border-dashed border-apple-border font-mono text-[9px] text-apple-muted select-none text-center leading-normal font-semibold">
                      <span>本文由 <b>小顺AI内容工作台</b> 针对其目标社群定制发布。</span>
                      <br />
                      <span>审核校验代码: {activeDraft.wechatMediaId || 'wx_pending_media'}</span>
                    </div>
                  </div>
                </article>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-apple-muted p-8 select-none">
                  <BookOpen className="h-6 w-6 mb-1.5" />
                  <span className="text-[10px] text-center font-bold">无精选图文数据，请到选题或工坊生成</span>
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
