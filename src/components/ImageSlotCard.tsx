import React, { useEffect, useState } from 'react';
import { Copy, Edit3, Save, RefreshCw, Ban } from 'lucide-react';
import type { ArticleImageSlot } from '../types';
import type { UpdateImageSlotInput } from '../api/imageSlots';

type Props = {
  slot: ArticleImageSlot;
  active?: boolean;
  onUpdate: (slotId: string, input: UpdateImageSlotInput) => Promise<void>;
  onRegenerate: (slotId: string) => Promise<void>;
  onSkip: (slotId: string) => Promise<void>;
};

export default function ImageSlotCard({ slot, active, onUpdate, onRegenerate, onSkip }: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string>('');
  const [form, setForm] = useState({
    promptZh: slot.promptZh,
    promptEn: slot.promptEn || '',
    negativePrompt: slot.negativePrompt || '',
    aspectRatio: slot.aspectRatio,
    stylePreset: slot.stylePreset,
    altText: slot.altText || '',
  });

  useEffect(() => {
    setForm({
      promptZh: slot.promptZh,
      promptEn: slot.promptEn || '',
      negativePrompt: slot.negativePrompt || '',
      aspectRatio: slot.aspectRatio,
      stylePreset: slot.stylePreset,
      altText: slot.altText || '',
    });
  }, [slot]);

  const copy = async (text: string | null | undefined, label: string) => {
    if (!text) {
      setCopyStatus(`${label}为空，无法复制`);
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus(`${label}已复制`);
    } catch {
      setCopyStatus(`${label}复制失败，请手动选中文本复制`);
    } finally {
      window.setTimeout(() => setCopyStatus(''), 2200);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await onUpdate(slot.id, form);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <article
      id={`image-slot-card-${slot.slotKey}`}
      className={`rounded-2xl border bg-white p-4 space-y-3 transition ${
        active ? 'border-apple-blue shadow-[0_0_0_3px_rgba(0,102,204,0.10)]' : 'border-apple-border'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-card-title font-bold text-apple-dark">图片位编号：{slot.slotKey}</div>
          <div className="text-caption-readable text-apple-muted mt-1">绑定段落：第 {slot.paragraphIndex} 段</div>
        </div>
        <span className={`text-badge-readable font-bold px-2 py-0.5 rounded-lg border ${
          slot.status === 'skipped'
            ? 'bg-neutral-50 text-neutral-500 border-neutral-100'
            : 'bg-emerald-50 text-emerald-600 border-emerald-100'
        }`}>
          {slot.status}
        </span>
      </div>

      <p className="text-body-readable text-apple-muted leading-relaxed bg-apple-bg/60 border border-apple-border rounded-xl p-3">
        {slot.reason}
      </p>

      <div className="grid grid-cols-2 gap-2 text-caption-readable text-apple-muted">
        <div>比例：<span className="font-mono text-apple-dark">{form.aspectRatio}</span></div>
        <div>风格：<span className="text-apple-dark">{form.stylePreset}</span></div>
        <div className="col-span-2">Alt 文案：<span className="text-apple-dark">{form.altText || '-'}</span></div>
      </div>

      <div className="space-y-2">
        <label className="text-caption-readable font-bold text-apple-muted uppercase">中文提示词</label>
        <textarea
          value={form.promptZh}
          readOnly={!editing}
          onChange={(event) => setForm((current) => ({ ...current, promptZh: event.target.value }))}
          className="w-full min-h-24 rounded-xl border border-apple-border bg-apple-bg/40 p-3 text-body-readable leading-relaxed text-apple-dark outline-none focus:border-apple-blue/50"
        />
      </div>

      <div className="space-y-2">
        <label className="text-caption-readable font-bold text-apple-muted uppercase">英文提示词</label>
        <textarea
          value={form.promptEn}
          readOnly={!editing}
          onChange={(event) => setForm((current) => ({ ...current, promptEn: event.target.value }))}
          className="w-full min-h-20 rounded-xl border border-apple-border bg-apple-bg/40 p-3 text-body-readable leading-relaxed text-apple-dark outline-none focus:border-apple-blue/50"
        />
      </div>

      <div className="space-y-2">
        <label className="text-caption-readable font-bold text-apple-muted uppercase">负面提示词</label>
        <textarea
          value={form.negativePrompt}
          readOnly={!editing}
          onChange={(event) => setForm((current) => ({ ...current, negativePrompt: event.target.value }))}
          className="w-full min-h-16 rounded-xl border border-apple-border bg-apple-bg/40 p-3 text-body-readable leading-relaxed text-apple-dark outline-none focus:border-apple-blue/50"
        />
      </div>

      {editing && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select
            value={form.aspectRatio}
            onChange={(event) => setForm((current) => ({ ...current, aspectRatio: event.target.value as ArticleImageSlot['aspectRatio'] }))}
            className="rounded-xl border border-apple-border bg-apple-bg px-3 py-2 text-body-readable font-bold outline-none"
          >
            <option value="16:9">16:9</option>
            <option value="4:3">4:3</option>
            <option value="1:1">1:1</option>
          </select>
          <input
            value={form.stylePreset}
            onChange={(event) => setForm((current) => ({ ...current, stylePreset: event.target.value }))}
            className="rounded-xl border border-apple-border bg-apple-bg px-3 py-2 text-body-readable font-bold outline-none"
          />
          <input
            value={form.altText}
            onChange={(event) => setForm((current) => ({ ...current, altText: event.target.value }))}
            className="rounded-xl border border-apple-border bg-apple-bg px-3 py-2 text-body-readable font-bold outline-none"
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <button type="button" onClick={() => copy(slot.promptZh, '中文提示词')} className="px-3 py-1.5 rounded-xl border border-apple-border text-meta-readable font-bold flex items-center gap-1">
          <Copy className="h-3 w-3" />复制中文提示词
        </button>
        <button type="button" onClick={() => copy(slot.promptEn, '英文提示词')} className="px-3 py-1.5 rounded-xl border border-apple-border text-meta-readable font-bold flex items-center gap-1">
          <Copy className="h-3 w-3" />复制英文提示词
        </button>
        <button type="button" onClick={() => copy(slot.negativePrompt, '负面提示词')} className="px-3 py-1.5 rounded-xl border border-apple-border text-meta-readable font-bold flex items-center gap-1">
          <Copy className="h-3 w-3" />复制负面提示词
        </button>
        {editing ? (
          <button type="button" onClick={save} disabled={saving} className="px-3 py-1.5 rounded-xl bg-[#0066CC] text-white text-meta-readable font-bold flex items-center gap-1 disabled:opacity-50">
            <Save className="h-3 w-3" />保存提示词
          </button>
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="px-3 py-1.5 rounded-xl border border-apple-border text-meta-readable font-bold flex items-center gap-1">
            <Edit3 className="h-3 w-3" />编辑提示词
          </button>
        )}
        <button type="button" onClick={() => onRegenerate(slot.id)} className="px-3 py-1.5 rounded-xl border border-apple-border text-meta-readable font-bold flex items-center gap-1">
          <RefreshCw className="h-3 w-3" />重新生成提示词
        </button>
        <button type="button" onClick={() => onSkip(slot.id)} className="px-3 py-1.5 rounded-xl border border-apple-border text-meta-readable font-bold flex items-center gap-1 text-apple-muted">
          <Ban className="h-3 w-3" />跳过此图片位
        </button>
      </div>
      {copyStatus && (
        <div className="rounded-xl border border-apple-border bg-apple-bg px-3 py-2 text-caption-readable font-bold text-apple-dark">
          {copyStatus}
        </div>
      )}
    </article>
  );
}
