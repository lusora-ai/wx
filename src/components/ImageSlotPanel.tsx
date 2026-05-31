import React from 'react';
import { Image, Plus } from 'lucide-react';
import type { ArticleImageSlot } from '../types';
import type { UpdateImageSlotInput } from '../api/imageSlots';
import ImageSlotCard from './ImageSlotCard';

type Props = {
  slots: ArticleImageSlot[];
  activeSlotKey?: string | null;
  loading?: boolean;
  onUpdate: (slotId: string, input: UpdateImageSlotInput) => Promise<void>;
  onRegenerate: (slotId: string) => Promise<void>;
  onSkip: (slotId: string) => Promise<void>;
  onGenerate?: () => Promise<void>;
};

export default function ImageSlotPanel({ slots, activeSlotKey, loading, onUpdate, onRegenerate, onSkip, onGenerate }: Props) {
  return (
    <aside className="bg-white border border-apple-border rounded-[24px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-4 h-[520px] overflow-hidden flex flex-col">
      <div className="flex items-center justify-between border-b border-apple-border pb-3 shrink-0">
        <div className="flex items-center gap-2">
          <Image className="h-4.5 w-4.5 text-apple-blue" />
          <h3 className="text-section-title font-bold text-apple-dark">配图提示词</h3>
        </div>
        {onGenerate && (
          <button
            type="button"
            onClick={onGenerate}
            disabled={loading || slots.length >= 3}
            className="px-2.5 py-1.5 rounded-xl border border-apple-border text-meta-readable font-bold text-apple-dark disabled:opacity-40 flex items-center gap-1"
          >
            <Plus className="h-3 w-3" />补充图片位
          </button>
        )}
      </div>

      <div className="overflow-y-auto pr-1 space-y-3 flex-1 min-h-0">
        {slots.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-apple-muted p-6">
            <Image className="h-8 w-8 mb-3" />
            <p className="text-card-title font-bold text-apple-dark">当前文章暂无配图提示词</p>
            <p className="text-caption-readable leading-relaxed mt-1">AI 会在适合视觉表达的段落后插入图片位；旧文章可手动补充。</p>
          </div>
        ) : (
          slots.map((slot) => (
            <ImageSlotCard
              key={slot.id}
              slot={slot}
              active={slot.slotKey === activeSlotKey}
              onUpdate={onUpdate}
              onRegenerate={onRegenerate}
              onSkip={onSkip}
            />
          ))
        )}
      </div>
    </aside>
  );
}
