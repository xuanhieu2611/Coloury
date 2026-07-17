import Link from 'next/link';
import { BeforeAfter } from '@/components/marketing/BeforeAfter';
import { WaitlistForm } from '@/components/marketing/WaitlistForm';
import { FILTERS, FILTER_CATEGORIES, type FilterCategory } from '@/lib/filters';

const display = 'font-[family-name:var(--font-display)]';
const mono = 'font-[family-name:var(--font-mono)]';

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className={`${mono} text-[11px] uppercase tracking-[0.2em] text-accent`}>{children}</p>
  );
}

const FEATURES: { tag: string; title: string; body: string }[] = [
  {
    tag: 'AI',
    title: 'Auto Edit',
    body: 'Describe a mood — "warm and moody", "clean bright" — and a vision model grades the shot for you. Every slider it moves stays editable.',
  },
  {
    tag: 'LUT',
    title: 'Real film looks',
    body: 'Not slider guesses — each look is driven by an actual film LUT, with skin-tone protection so faces stay alive under the grade.',
  },
  {
    tag: 'HSL',
    title: 'Full manual control',
    body: 'Curves, HSL bands, tone, split-toning, grain, vignette. The whole Lightroom-style cockpit is one click away when you want it.',
  },
  {
    tag: 'RAW',
    title: 'RAW + HEIC',
    body: 'Drop a camera RAW or an iPhone HEIC straight in. Decoded in the browser, full resolution, nothing uploaded.',
  },
  {
    tag: 'NDE',
    title: 'Non-destructive',
    body: 'Every edit is a recipe, never baked into pixels until you export. Undo anything, anytime, back to the original.',
  },
  {
    tag: 'OUT',
    title: 'Full-res export',
    body: 'Export at original resolution — no forced downscale, no watermark on the free tier. Your photo, your pixels.',
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Do I need to install anything?',
    a: 'No. Coloury runs entirely in your browser. Open the editor and drop a photo in — that is the whole setup.',
  },
  {
    q: 'Are my photos uploaded anywhere?',
    a: 'No. Decoding, editing, and export all happen on your device. Your images never leave your computer.',
  },
  {
    q: 'What do I get for free?',
    a: 'The full editor, the free film-look pack, AI Auto Edit, RAW/HEIC support, and full-resolution export with no watermark.',
  },
  {
    q: 'What does Pro add?',
    a: 'The premium film pack, higher-throughput AI edits, and cloud sync of your looks across devices. Pro is a subscription — join the waitlist below.',
  },
];

function byCategory(cat: FilterCategory) {
  return FILTERS.filter((f) => f.category === cat);
}

export default function Landing() {
  return (
    // Own scroll container — the global body is overflow:hidden for the editor.
    <div className="fixed inset-0 overflow-y-auto overflow-x-hidden bg-bg text-text">
      {/* ---- Nav ---- */}
      <header className="sticky top-0 z-30 border-b border-border/70 bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <Link href="/" className="flex flex-col gap-1">
            <span className={`${display} text-lg font-bold tracking-[-0.02em]`}>Coloury</span>
            <span className="spectrum-bar spectrum-bar-glow w-24" aria-hidden />
          </Link>
          <nav className="hidden items-center gap-7 text-xs text-text-dim sm:flex">
            <a href="#looks" className="transition-colors hover:text-text">Looks</a>
            <a href="#features" className="transition-colors hover:text-text">Features</a>
            <a href="#pricing" className="transition-colors hover:text-text">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/editor" className="hidden text-xs text-text-dim transition-colors hover:text-text sm:block">
              Sign in
            </Link>
            <Link
              href="/editor"
              className="rounded-md bg-accent px-3.5 py-2 text-xs font-semibold text-[#06121f] shadow-[0_2px_10px_rgba(107,179,255,0.25)] transition-[filter,box-shadow] duration-150 hover:brightness-110"
            >
              Open editor
            </Link>
          </div>
        </div>
      </header>

      {/* ---- Hero ---- */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 empty-wash" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 md:grid-cols-[1.05fr_1.25fr] md:py-24">
          <div className="flex flex-col gap-6">
            <Eyebrow>Browser-based film color engine</Eyebrow>
            <h1 className={`${display} text-[clamp(2.6rem,6vw,4.2rem)] font-bold leading-[0.98] tracking-[-0.03em]`}>
              Grade like film.
              <br />
              <span className="text-accent">Right in your browser.</span>
            </h1>
            <p className="max-w-md text-[15px] leading-relaxed text-text-dim">
              Real film LUTs, AI auto-editing, and a full manual cockpit — the color of a
              proper edit, without the app, the upload, or the watermark. Free to use.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                href="/editor"
                className="rounded-md bg-accent px-5 py-3 text-sm font-semibold text-[#06121f] shadow-[0_2px_14px_rgba(107,179,255,0.3)] transition-[filter,box-shadow,transform] duration-150 hover:brightness-110 hover:shadow-[0_3px_20px_rgba(107,179,255,0.45)] active:translate-y-px"
              >
                Start editing — free
              </Link>
              <a
                href="#looks"
                className="rounded-md border border-border-strong px-5 py-3 text-sm font-medium text-text transition-colors hover:border-accent/70 hover:bg-white/[0.04]"
              >
                See the looks
              </a>
            </div>
            <p className={`${mono} pt-1 text-[11px] uppercase tracking-[0.14em] text-text-dim/70`}>
              No sign-up · No install · Photos never leave your device
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <BeforeAfter
              before="/marketing/hero-before.jpg"
              after="/marketing/hero-after.jpg"
              beforeLabel="Original"
              afterLabel="Golden Hour"
            />
            <p className={`${mono} px-1 text-[10.5px] uppercase tracking-[0.14em] text-text-dim/70`}>
              Drag to compare · flat original → graded result
            </p>
          </div>
        </div>
      </section>

      {/* ---- Stock marquee ---- */}
      <div className="border-y border-border/70 bg-panel/40">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-6 py-4">
          <span className={`${mono} text-[10px] uppercase tracking-[0.2em] text-text-dim/60`}>
            Includes
          </span>
          {FILTERS.slice(0, 8).map((f) => (
            <span key={f.id} className="flex items-center gap-2 text-xs text-text-dim">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: f.swatch }} aria-hidden />
              {f.name}
            </span>
          ))}
        </div>
      </div>

      {/* ---- Features ---- */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-12 flex flex-col gap-3">
          <Eyebrow>What&apos;s inside</Eyebrow>
          <h2 className={`${display} max-w-xl text-3xl font-bold tracking-[-0.02em] md:text-4xl`}>
            A real editor, not a one-tap toy.
          </h2>
        </div>
        <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex flex-col gap-3 bg-panel p-6 transition-colors hover:bg-panel-raised">
              <span className={`${mono} text-[10px] uppercase tracking-[0.2em] text-accent`}>{f.tag}</span>
              <h3 className={`${display} text-lg font-semibold`}>{f.title}</h3>
              <p className="text-[13px] leading-relaxed text-text-dim">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Looks showcase ---- */}
      <section id="looks" className="border-y border-border/70 bg-panel/30">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-12 flex flex-col gap-3">
            <Eyebrow>The film pack</Eyebrow>
            <h2 className={`${display} max-w-xl text-3xl font-bold tracking-[-0.02em] md:text-4xl`}>
              Looks with a point of view.
            </h2>
            <p className="max-w-lg text-sm text-text-dim">
              Four categories, each a real film grade. Free looks are genuinely good — the
              <span className="mx-1 rounded bg-amber-300/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">Pro</span>
              set adds the deep cinema and darkroom stocks.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FILTER_CATEGORIES.map((cat) => (
              <div key={cat} className="flex flex-col gap-4 rounded-lg border border-border bg-panel p-5">
                <h3 className={`${mono} text-[11px] uppercase tracking-[0.18em] text-text-dim`}>{cat}</h3>
                <div className="flex flex-col gap-2.5">
                  {byCategory(cat).map((f) => (
                    <div key={f.id} className="flex items-center gap-3">
                      <span
                        className="h-8 w-8 shrink-0 rounded-md border border-white/10"
                        style={{ background: f.swatch }}
                        aria-hidden
                      />
                      <span className="flex-1 text-[13px]">{f.name}</span>
                      {f.premium && (
                        <span className="rounded bg-amber-300/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-300">
                          Pro
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Pricing ---- */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-12 flex flex-col gap-3">
          <Eyebrow>Pricing</Eyebrow>
          <h2 className={`${display} text-3xl font-bold tracking-[-0.02em] md:text-4xl`}>
            Start free. Upgrade when the looks hook you.
          </h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {/* Free */}
          <div className="flex flex-col gap-6 rounded-xl border border-border bg-panel p-8">
            <div className="flex flex-col gap-1">
              <span className={`${mono} text-[11px] uppercase tracking-[0.18em] text-text-dim`}>Free</span>
              <div className="flex items-baseline gap-1">
                <span className={`${display} text-4xl font-bold`}>$0</span>
                <span className="text-sm text-text-dim">/ forever</span>
              </div>
            </div>
            <ul className="flex flex-col gap-2.5 text-[13px] text-text-dim">
              {['Full editor + manual cockpit', 'Free film-look pack', 'AI Auto Edit', 'RAW & HEIC support', 'Full-resolution export, no watermark'].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <Check /> {t}
                </li>
              ))}
            </ul>
            <Link
              href="/editor"
              className="mt-auto rounded-md border border-border-strong px-5 py-3 text-center text-sm font-medium transition-colors hover:border-accent/70 hover:bg-white/[0.04]"
            >
              Start editing
            </Link>
          </div>

          {/* Pro */}
          <div className="relative flex flex-col gap-6 rounded-xl border border-accent/50 bg-gradient-to-b from-accent/[0.06] to-transparent p-8 shadow-[0_0_40px_rgba(107,179,255,0.08)]">
            <span className={`${mono} absolute right-6 top-6 rounded-full border border-accent/40 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-accent`}>
              Coming soon
            </span>
            <div className="flex flex-col gap-1">
              <span className={`${mono} text-[11px] uppercase tracking-[0.18em] text-accent`}>Pro</span>
              <div className="flex items-baseline gap-1">
                <span className={`${display} text-4xl font-bold`}>$6.99</span>
                <span className="text-sm text-text-dim">/ month · or $39.99/yr</span>
              </div>
            </div>
            <ul className="flex flex-col gap-2.5 text-[13px] text-text">
              {['Everything in Free', 'The premium film pack (cinema + darkroom)', 'Priority AI Auto Edit', 'Cloud sync of your looks', 'Early access to new stocks'].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <Check accent /> {t}
                </li>
              ))}
            </ul>
            <a
              href="#waitlist"
              className="mt-auto rounded-md bg-accent px-5 py-3 text-center text-sm font-semibold text-[#06121f] shadow-[0_2px_14px_rgba(107,179,255,0.3)] transition-[filter] duration-150 hover:brightness-110"
            >
              Join the Pro waitlist
            </a>
          </div>
        </div>
      </section>

      {/* ---- FAQ ---- */}
      <section className="border-t border-border/70 bg-panel/30">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <h2 className={`${display} mb-10 text-3xl font-bold tracking-[-0.02em]`}>Questions</h2>
          <div className="flex flex-col divide-y divide-border">
            {FAQ.map((item) => (
              <div key={item.q} className="flex flex-col gap-2 py-5">
                <h3 className="text-[15px] font-medium">{item.q}</h3>
                <p className="text-[13px] leading-relaxed text-text-dim">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Waitlist CTA + footer ---- */}
      <footer id="waitlist" className="border-t border-border/70">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="flex flex-col gap-4 rounded-xl border border-border bg-panel p-8 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-2">
              <h2 className={`${display} text-2xl font-bold tracking-[-0.02em]`}>Be first to Pro.</h2>
              <p className="max-w-md text-sm text-text-dim">
                Get an email when the premium film pack and cloud sync go live. No spam — just the launch.
              </p>
            </div>
            <WaitlistForm />
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-6 border-t border-border pt-8 sm:flex-row">
            <div className="flex flex-col gap-2">
              <span className={`${display} text-base font-bold tracking-[-0.02em]`}>Coloury</span>
              <span className="spectrum-bar w-28" aria-hidden />
            </div>
            <p className={`${mono} text-[11px] text-text-dim/70`}>
              © {new Date().getFullYear()} Coloury · Film color in the browser
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Check({ accent = false }: { accent?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={`mt-0.5 shrink-0 ${accent ? 'text-accent' : 'text-text-dim'}`}
    >
      <path d="M5 12.5l4.5 4.5L19 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
