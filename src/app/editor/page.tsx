'use client';

import { useEditor } from '@/lib/store';
import { Uploader } from '@/components/Uploader';
import { EditorCanvas } from '@/components/EditorCanvas';
import { Toolbar } from '@/components/Toolbar';
import { Panels } from '@/components/Panels';
import { Histogram } from '@/components/Histogram';
import { AutoEdit } from '@/components/AutoEdit';
import { Filters } from '@/components/Filters';
import { ModeToggle } from '@/components/ModeToggle';
import { Account } from '@/components/Account';

export default function Editor() {
  const image = useEditor((s) => s.image);
  const mode = useEditor((s) => s.mode);

  if (!image) {
    return (
      <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-bg px-6 py-10">
        {/* Ambient wash behind content — must stay z-0 so it never covers the uploader. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 z-0 empty-wash" />
        <div className="absolute right-4 top-4 z-20">
          <Account />
        </div>
        <div className="relative z-10">
          <Uploader />
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-dvh flex-col">
      <Toolbar />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="relative min-h-[42vh] min-w-0 flex-1 bg-canvas md:min-h-0">
          <EditorCanvas />
        </div>
        <aside
          className="max-h-[58vh] w-full shrink-0 overflow-x-hidden overflow-y-auto border-t border-border bg-panel md:max-h-none md:w-[336px] md:border-t-0 md:border-l"
          aria-label="Edit controls"
        >
          {/* Creative zone — the filter-first front door. Simple mode stops here;
              the pro cockpit below is gated behind the Advanced toggle. */}
          <div className="surface-raised border-b border-border">
            <ModeToggle />
            <AutoEdit />
            <Filters hero={mode === 'simple'} />
          </div>
          {mode === 'advanced' && (
            <div className="animate-reveal-panels">
              <Histogram />
              <Panels />
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
