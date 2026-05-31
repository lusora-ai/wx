import React from 'react';
import { Image, ArrowRight } from 'lucide-react';
import type { ArticleImageSlot } from '../types';

type Props = {
  slotKey: string;
  slot?: ArticleImageSlot;
  onSelect?: (slotKey: string) => void;
};

export default function ImageSlotMarker({ slotKey, slot, onSelect }: Props) {
  const skipped = slot?.status === 'skipped';
  return (
    <button
      type="button"
      onClick={() => onSelect?.(slotKey)}
      className={`my-3 w-full rounded-2xl border px-4 py-3 text-left transition ${
        skipped
          ? 'border-apple-border bg-apple-bg/35 text-apple-muted'
          : 'border-dashed border-apple-blue/35 bg-[#f5f9ff] text-apple-dark hover:border-apple-blue/60'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-white border border-apple-border flex items-center justify-center text-apple-blue shrink-0">
            <Image className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold">{skipped ? '已跳过配图' : '这里建议配一张图'}</div>
            <div className="text-[10px] font-mono text-apple-muted mt-0.5">图片位：{slotKey}</div>
          </div>
        </div>
        <span className="text-[10px] font-bold text-apple-blue flex items-center gap-1 shrink-0">
          查看侧栏提示词
          <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </button>
  );
}
