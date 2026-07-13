'use client';

import { useCallback, useRef, useState } from 'react';
import { loadImageFile, useEditor } from '@/lib/store';
import { brandWordmark } from '@/lib/ui';
import { IconUpload } from './Icons';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif';

export function Uploader() {
  const setImage = useEditor((s) => s.setImage);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setError(null);
      setLoading(true);
      try {
        const img = await loadImageFile(file);
        setImage(img);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load image.');
      } finally {
        setLoading(false);
      }
    },
    [setImage],
  );

  const openPicker = () => inputRef.current?.click();

  return (
    <div className="flex w-[min(560px,92vw)] flex-col items-center gap-8">
      <div className="text-center">
        <h1 className={`${brandWordmark} text-[42px] leading-none sm:text-[48px]`}>Coloury</h1>
        <div
          className={`spectrum-bar mx-auto mt-3 w-28 transition-[width,box-shadow] duration-300 ease-[var(--ease-out)] ${
            dragOver ? 'spectrum-bar-glow w-40' : ''
          }`}
        />
        <p className="mt-4 max-w-[28ch] text-[15px] leading-snug text-text-dim">
          Drop a photo. Grade it by hand or let Auto Edit set the look.
        </p>
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a photo"
        aria-busy={loading}
        className={`group flex h-[280px] w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-[12px] border border-dashed px-6 transition-[border-color,background,transform] duration-200 ease-[var(--ease-out)] focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 ${
          dragOver
            ? 'scale-[1.01] border-accent bg-[#1a2430]'
            : 'border-border-strong bg-panel hover:border-accent hover:bg-[#1a1f26]'
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
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openPicker();
          }
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <IconUpload
          className={`text-text-dim transition-colors duration-150 group-hover:text-accent ${
            dragOver ? 'text-accent' : ''
          }`}
        />
        <div className="text-center">
          <div className="text-[15px] font-medium text-text">
            {loading ? 'Opening photo…' : dragOver ? 'Release to open' : 'Drop a photo here'}
          </div>
          <div className="mt-1 text-xs text-text-dim">
            or click to browse — JPEG, PNG, WebP, HEIC
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="max-w-[400px] text-center text-sm text-danger">
          {error}
        </div>
      )}
    </div>
  );
}
