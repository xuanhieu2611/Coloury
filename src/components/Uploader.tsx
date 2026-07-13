'use client';

import { useCallback, useRef, useState } from 'react';
import { loadImageFile, useEditor } from '@/lib/store';

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
      className={`uploader ${dragOver ? 'drag' : ''}`}
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
      <div className="uploader-inner">
        <div className="uploader-logo">Coloury</div>
        <div className="uploader-title">Drop a photo to start editing</div>
        <div className="uploader-sub">or click to browse — JPEG, PNG, WebP, HEIC</div>
        {error && <div className="uploader-error">{error}</div>}
      </div>
    </div>
  );
}
