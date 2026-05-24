/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Library, 
  Search, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Send, 
  Sparkles, 
  User, 
  Star, 
  ArrowRight, 
  ChevronRight, 
  PenTool, 
  ThumbsUp, 
  Heart,
  ChevronDown,
  Trash2
} from 'lucide-react';
import { AiDraft } from '../types';

interface DraftLibraryViewProps {
  drafts: AiDraft[];
  onUpdateDraftStatus: (id: string, status: AiDraft['status'], score?: number, feedback?: string) => void;
  onDeleteDraft: (id: string) => void;
  setSelectedTopicIdForWorkshop: (id: string | null) => void;
  setSelectedDraftIdForPublish: (id: string | null) => void;
  setActiveTab: (tab: string) => void;
}

export default function DraftLibraryView({
  drafts,
  onUpdateDraftStatus,
  onDeleteDraft,
  setSelectedTopicIdForWorkshop,
  setSelectedDraftIdForPublish,
  setActiveTab
}: DraftLibraryViewProps) {
  
  const [searchTerm, setSearchTerm] = useState('');
  const [activeStatusTab, setActiveStatusTab] = useState<string>('ALL');
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(drafts[0]?.id || null);

  // Score editing local state
  const [localFeedback, setLocalFeedback] = useState('');
  const [localScore, setLocalScore] = useState(5);

  const selectedDraft = drafts.find(d => d.id === selectedDraftId) || drafts[0];

  const filteredDrafts = drafts.filter(draft => {
    const matchesSearch = draft.versions.officeWorker.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          draft.versions.student.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          draft.versions.freelancer.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = activeStatusTab === 'ALL' || draft.status === activeStatusTab;
    return matchesSearch && matchesTab;
  });

  const getStatusBadge = (status: AiDraft['status']) => {
    switch (status) {
      case 'generating':
        return <span className="bg-neutral-50 text-neutral-600 px-2 py-0.5 rounded text-[10px] uppercase font-bold border border-neutral-100 animate-pulse">写入中</span>;
      case 'pending_review':
        return <span className="bg-amber-50 text-amber-600 px-2 py-0.5 rounded text-[10px] uppercase font-extrabold border border-amber-100/40">待主审</span>;
      case 'approved':
        return <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded text-[10px] uppercase font-bold border border-emerald-100/40">已完备</span>;
      case 'synced':
        return <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[10px] uppercase font-bold border border-blue-100/40">已灌入微信</span>;
      case 'failed':
        return <span className="bg-rose-50 text-rose-600 px-2 py-0.5 rounded text-[10px] uppercase font-bold border border-rose-100/40">同步失败</span>;
      default:
        return null;
    }
  };

  const getAudienceTag = (aud: AiDraft['selectedAudience']) => {
    switch (aud) {
      case 'officeWorker':
        return <span className="text-[10px] text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded font-bold">打工人</span>;
      case 'student':
        return <span className="text-[10px] text-blue-600 bg-blue-50/50 px-2 py-0.5 rounded font-bold">大学生</span>;
      case 'freelancer':
        return <span className="text-[10px] text-purple-600 bg-purple-50/50 px-2 py-0.5 rounded font-bold">自雇自由人</span>;
    }
  };

  // Click Audit Accept Triage
  const handleApprove = () => {
    if (!selectedDraft) return;
    onUpdateDraftStatus(selectedDraft.id, 'approved', localScore, localFeedback || '内容结构过审。');
    // Pre-populate input box fields
    setLocalFeedback('');
  };

  // Push immediate sync handle
  const handlePublishSync = () => {
    if (!selectedDraft) return;
    // Auto approve first
    onUpdateDraftStatus(selectedDraft.id, 'approved', localScore, localFeedback || '内容准备发布。');
    setSelectedDraftIdForPublish(selectedDraft.id);
    setActiveTab('publish');
  };

  const handleRewrite = () => {
    if (!selectedDraft) return;
    setSelectedTopicIdForWorkshop(selectedDraft.topicId);
    setActiveTab('workshop');
  };

  return (
    <div id="drafts-view-wrapper" className="space-y-6 container mx-auto px-1 py-1">
      
      {/* Filters Segment row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-apple-border rounded-[24px] p-4 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
        
        {/* Tab filters */}
        <div className="flex items-center space-x-1 p-0.5 rounded-xl bg-apple-bg border border-apple-border/50 text-xs font-semibold text-apple-muted overflow-x-auto">
          {[
            { id: 'ALL', label: '全部草稿库' },
            { id: 'pending_review', label: '待主审' },
            { id: 'approved', label: '已提审通过' },
            { id: 'synced', label: '已同步微信' },
            { id: 'failed', label: '同步失败' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveStatusTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeStatusTab === tab.id 
                  ? 'bg-white text-apple-dark shadow-xs font-semibold' 
                  : 'hover:text-apple-dark text-apple-muted'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Instant Search text field */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-apple-muted" />
          <input
            type="text"
            id="draft-search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜索草稿中文关键字、大纲、分类..."
            className="w-full pl-9 pr-4 py-2 bg-apple-bg/50 hover:bg-apple-bg border border-apple-border focus:border-apple-blue/50 rounded-xl text-xs outline-none transition-all font-medium text-apple-dark placeholder-apple-muted/50"
          />
        </div>
      </div>

      {/* Main Content split */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        
        {/* Left Column: Draft lists */}
        <div className="lg:col-span-2 space-y-3.5 overflow-y-auto max-h-[550px] pr-1">
          {filteredDrafts.length === 0 ? (
            <div className="p-12 text-center bg-white border border-apple-border rounded-[24px] flex flex-col items-center justify-center space-y-2 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
              <Library className="h-8 w-8 text-apple-muted" />
              <h4 className="text-xs font-bold text-apple-dark">没有查取到对应草稿</h4>
              <p className="text-[10px] text-apple-muted">可以前往 ［AI写作工坊］ 进行全新创作生成</p>
            </div>
          ) : (
            filteredDrafts.map((draft) => {
              const isSelected = selectedDraft?.id === draft.id;
              // Display title of currently active target audience or default worker
              const displayedTitle = draft.selectedAudience === 'officeWorker' 
                ? draft.versions.officeWorker.title 
                : draft.selectedAudience === 'student'
                  ? draft.versions.student.title
                  : draft.versions.freelancer.title;

              return (
                <div
                  key={draft.id}
                  onClick={() => {
                    setSelectedDraftId(draft.id);
                    setLocalScore(draft.reviewScore || 5);
                  }}
                  className={`p-4 bg-white border rounded-[20px] cursor-pointer transition-all flex items-start justify-between space-x-3 text-left ${
                    isSelected 
                      ? 'border-apple-blue shadow-xs ring-1 ring-apple-blue/20' 
                      : 'border-apple-border hover:border-apple-border/80 hover:shadow-xs'
                  }`}
                >
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex items-center space-x-2">
                      {getAudienceTag(draft.selectedAudience)}
                      <span className="text-[10px] text-apple-muted font-mono">{draft.category}</span>
                    </div>

                    <h4 className="text-xs font-bold text-apple-dark leading-snug line-clamp-2">
                       {displayedTitle}
                    </h4>

                    <div className="flex items-center space-x-2 text-[9px] font-mono text-apple-muted">
                      <span>字数计: {draft.versions[draft.selectedAudience].wordCount}</span>
                      <span>•</span>
                      <span>修改于 {draft.lastEdited}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end shrink-0 space-y-2 select-none">
                    {getStatusBadge(draft.status)}
                    <span className="text-[10px] font-bold text-apple-dark font-mono flex items-center">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400 mr-0.5" />
                      <span>{draft.reviewScore ? `${draft.reviewScore}星` : '非标'}</span>
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Active Draft precise detail viewer & audits */}
        <div className="lg:col-span-3 bg-white border border-apple-border rounded-[24px] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] h-[550px] flex flex-col justify-between overflow-hidden">
          {selectedDraft ? (
            <div id="draft-details-layout" className="flex-1 flex flex-col justify-between h-full overflow-hidden select-text">
              
              {/* Top View details */}
              <div className="space-y-4 overflow-y-auto pr-1 flex-1 min-h-0 pb-4">
                <div className="flex items-start justify-between border-b border-apple-border pb-3">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-apple-dark text-white font-mono">{selectedDraft.category}</span>
                      <span className="text-[10px] text-apple-muted font-mono">ID: {selectedDraft.id}</span>
                    </div>
                    <div className="text-[10px] text-apple-muted font-mono">对应原创题名: {selectedDraft.originalTitle}</div>
                  </div>

                  <button
                    onClick={() => onDeleteDraft(selectedDraft.id)}
                    className="p-1.5 rounded-lg text-apple-muted hover:text-rose-500 hover:bg-rose-50 transition border border-transparent hover:border-rose-100 cursor-pointer"
                    title="移出草稿库"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Subsections: view title content and summary excerpt */}
                <div className="space-y-3 p-4 rounded-xl bg-apple-bg/55 border border-apple-border">
                  <h3 className="text-xs font-bold text-apple-dark leading-normal">
                    {selectedDraft.versions[selectedDraft.selectedAudience].title}
                  </h3>
                  
                  <blockquote className="border-l-2 border-apple-blue pl-3 text-[10px] italic text-apple-muted leading-relaxed font-semibold">
                    微信正文摘要: “{selectedDraft.versions[selectedDraft.selectedAudience].excerpt}”
                  </blockquote>

                  {/* HTML/Markdown View text snippets */}
                  <div className="pt-2 text-[11px] leading-relaxed text-apple-dark space-y-2 whitespace-pre-wrap font-sans border-t border-apple-border/50">
                    <strong className="text-apple-dark text-[10px] block mb-1">正文内容快览:</strong>
                    {selectedDraft.versions[selectedDraft.selectedAudience].content}
                  </div>
                </div>

                {/* System Feedback & Scoring history logs */}
                <div className="p-3.5 bg-amber-50/45 border border-amber-200/50 rounded-xl text-[11px] text-[#A05A00] leading-relaxed font-semibold">
                  <strong className="text-amber-800 font-bold block mb-1 text-[10px] flex items-center space-x-1">
                    <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                    <span>历史主编终审评语:</span>
                  </strong>
                  {selectedDraft.reviewerFeedback || '暂无评语。'}
                </div>
              </div>

              {/* Bottom Interactive Drawer: Audit fields */}
              <div className="border-t border-apple-border pt-4 bg-white shrink-0 space-y-3.5 select-none font-sans">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-end">
                  
                  {/* Feedback comment input */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-apple-muted uppercase">填写审核评语/改动指示 (100字以内)</label>
                    <input
                      type="text"
                      value={localFeedback}
                      onChange={(e) => setLocalFeedback(e.target.value)}
                      placeholder="写点改动建议给小编，如 “大标题可以再焦虑一些”..."
                      className="w-full px-3 py-1.5 bg-apple-bg border border-apple-border focus:border-apple-blue/50 outline-none rounded-xl text-xs font-semibold text-apple-dark placeholder-apple-muted/50"
                    />
                  </div>

                  {/* Stars choice */}
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold text-apple-muted uppercase mb-1">主编评分星级:</div>
                    <div className="flex items-center space-x-1 px-1">
                      {[1, 2, 3, 4, 5].map(starNum => (
                        <button
                          key={starNum}
                          onClick={() => setLocalScore(starNum)}
                          className="p-1 rounded hover:scale-110 transition cursor-pointer font-semibold text-apple-dark"
                        >
                          <Star 
                            className={`h-4.5 w-4.5 transition ${
                              starNum <= localScore 
                                ? 'fill-amber-400 text-amber-400' 
                                : 'text-neutral-200 hover:text-neutral-300'
                            }`} 
                          />
                        </button>
                      ))}
                      <span className="font-mono text-xs font-bold text-apple-muted ml-2">{localScore} 星极佳</span>
                    </div>
                  </div>

                </div>

                {/* Form submit buttons */}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-apple-border">
                  <div className="flex space-x-2">
                    <button
                      onClick={handleRewrite}
                      className="px-3.5 py-1.5 rounded-xl border border-apple-border bg-white hover:bg-apple-bg text-apple-dark font-bold text-[11px] shadow-xs transition flex items-center space-x-1 cursor-pointer"
                    >
                      <PenTool className="h-3.5 w-3.5" />
                      <span>细节重写</span>
                    </button>
                    
                    <button
                      onClick={handleApprove}
                      id="draft-approve-status-btn"
                      className="px-4 py-1.5 rounded-xl border border-[#34C759]/40 bg-[#34C759]/10 hover:bg-[#34C759]/15 text-[#34C759] font-bold text-[11px] shadow-xs transition flex items-center space-x-1 cursor-pointer"
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      <span>审核同意并通过</span>
                    </button>
                  </div>

                  <button
                    onClick={handlePublishSync}
                    id="draft-sync-direct-btn"
                    className="px-4.5 py-1.5 rounded-xl bg-[#0066CC] hover:bg-apple-blue-hover text-white font-bold text-[11.5px] transition flex items-center space-x-1 shadow-xs cursor-pointer border border-[#0066CC]"
                  >
                    <span>同步至微信中心</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>

              </div>

            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-apple-muted font-medium">
              请在左侧点击草稿查看深度排版以及开始主编审核评级。
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
