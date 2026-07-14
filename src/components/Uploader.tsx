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
        <h1 className={`${brandWordmark} text-[46px] leading-none sm:text-[54px]`}>Coloury</h1>
        <div
          className={`spectrum-bar spectrum-bar-glow mx-auto mt-3.5 transition-[width] duration-300 ease-[var(--ease-out)] ${
            dragOver ? 'w-44' : 'w-32'
          }`}
        />
        <p className="mt-5 max-w-[30ch] text-[15px] leading-snug text-text-dim">
          Drop a photo. Grade it by hand or let Auto Edit set the look.
        </p>
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a photo"
        aria-busy={loading}
        className={`group flex h-[280px] w-full cursor-pointer flex-col items-center justify-center gap-3.5 rounded-[14px] border border-dashed px-6 shadow-[var(--shadow-raised)] transition-[border-color,background,transform,box-shadow] duration-200 ease-[var(--ease-out)] focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 ${
          dragOver
            ? 'scale-[1.01] border-accent bg-[#141d29] shadow-[0_0_0_4px_rgba(107,179,255,0.12),var(--shadow-pop)]'
            : 'border-border-strong bg-panel-raised hover:border-accent/70 hover:bg-[#161a20]'
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
        <span
          className={`inline-flex h-14 w-14 items-center justify-center rounded-full ring-1 transition-[color,background,box-shadow] duration-150 ${
            dragOver
              ? 'bg-accent/15 text-accent ring-accent/40'
              : 'bg-panel-2/60 text-text-dim ring-border-strong group-hover:text-accent group-hover:ring-accent/40'
          }`}
        >
          <IconUpload size={26} />
        </span>
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
