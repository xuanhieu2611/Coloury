'use client';

import { useCallback, useRef, useState } from 'react';
import { loadImageFile, useEditor } from '@/lib/store';
import { brandGradient } from '@/lib/ui';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif';

export function Uploader() {
  const setImage = useEditor((s) => s.setImage);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setError(null);
      try {
        const img = await loadImageFile(file);
        setImage(img);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load image.');
      }
    },
    [setImage],
  );

  return (
    <div
      className={`flex h-[340px] w-[min(560px,90vw)] cursor-pointer items-center justify-center rounded-[14px] border-2 border-dashed border-border bg-panel transition-[border-color,background] duration-150 ${
        dragOver ? 'border-accent bg-[#202632]' : 'hover:border-accent hover:bg-[#202632]'
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFile(e.dataTransfer.files[0]);
      }}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <div className="text-center">
        <div className={`mb-[18px] text-[26px] font-bold tracking-[0.5px] ${brandGradient}`}>
          Coloury
        </div>
        <div className="mb-1.5 text-base text-text">Drop a photo to start editing</div>
        <div className="text-text-dim">or click to browse — JPEG, PNG, WebP, HEIC</div>
        {error && <div className="mt-3.5 max-w-[400px] text-danger">{error}</div>}
      </div>
    </div>
  );
}
