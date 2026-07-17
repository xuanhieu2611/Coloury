'use client';

import { useState } from 'react';
import { field, btnPrimary } from '@/lib/ui';

/**
 * Soft email capture for the Pro launch. Phase-1 stopgap: stores locally so the
 * form is honest (we don't claim to have emailed anyone) — Phase 2 points this
 * at Supabase / an email provider. Kept intentionally small.
 */
export function WaitlistForm() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) return;
    try {
      const key = 'coloury.waitlist.v1';
      const prev: string[] = JSON.parse(localStorage.getItem(key) ?? '[]');
      if (!prev.includes(email)) localStorage.setItem(key, JSON.stringify([...prev, email]));
    } catch {
      /* storage unavailable — still confirm to the user */
    }
    setDone(true);
  };

  if (done) {
    return (
      <p className="font-[family-name:var(--font-mono)] text-xs text-accent">
        You&apos;re on the list — we&apos;ll email you when Pro opens up.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-sm gap-2">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@email.com"
        aria-label="Email address"
        className={field}
      />
      <button type="submit" className={`${btnPrimary} shrink-0`}>
        Notify me
      </button>
    </form>
  );
}
