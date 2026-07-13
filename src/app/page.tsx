'use client';

import { useEditor } from '@/lib/store';
import { Uploader } from '@/components/Uploader';
import { EditorCanvas } from '@/components/EditorCanvas';
import { Toolbar } from '@/components/Toolbar';
import { Panels } from '@/components/Panels';
import { Histogram } from '@/components/Histogram';
import { AutoEdit } from '@/components/AutoEdit';

export default function Home() {
  const image = useEditor((s) => s.image);

  if (!image) {
    return (
      <main className="flex h-screen items-center justify-center p-6">
        <Uploader />
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col">
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1 bg-[#111]">
          <EditorCanvas />
        </div>
        <aside className="w-80 shrink-0 overflow-x-hidden overflow-y-auto border-l border-border bg-panel">
          <AutoEdit />
          <Histogram />
          <Panels />
        </aside>
      </div>
    </main>
  );
}
