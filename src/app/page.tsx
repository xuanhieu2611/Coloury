'use client';

import { useEditor } from '@/lib/store';
import { Uploader } from '@/components/Uploader';
import { EditorCanvas } from '@/components/EditorCanvas';
import { Toolbar } from '@/components/Toolbar';
import { Panels } from '@/components/Panels';
import { Histogram } from '@/components/Histogram';
import './editor.css';

export default function Home() {
  const image = useEditor((s) => s.image);

  if (!image) {
    return (
      <main className="landing">
        <Uploader />
      </main>
    );
  }

  return (
    <main className="editor">
      <Toolbar />
      <div className="editor-body">
        <div className="canvas-col">
          <EditorCanvas />
        </div>
        <aside className="side-col">
          <Histogram />
          <Panels />
        </aside>
      </div>
    </main>
  );
}
