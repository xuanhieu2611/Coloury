'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { supabaseConfigured } from '@/lib/supabase/env';
import { btn, btnPrimary, field } from '@/lib/ui';
import { IconSpinner } from './Icons';

type Mode = 'signin' | 'signup';

/**
 * Account control (M5 — accounts). Shows a "Sign in" button when signed out and
 * the user's email + "Sign out" when signed in. Auth is email + password via
 * Supabase. Renders nothing until Supabase is configured (env vars) so the app
 * works fine pre-setup. Identity only — no cloud storage of edits (yet).
 */
export function Account() {
  // Hooks must run unconditionally; we bail in render if unconfigured.
  const supabase = useMemo(() => (supabaseConfigured ? createClient() : null), []);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  if (!supabase) return null;

  return (
    <>
      {user ? (
        <div className="flex items-center gap-2">
          <span
            className="hidden max-w-[16ch] truncate text-xs text-text-dim sm:inline"
            title={user.email ?? undefined}
          >
            {user.email}
          </span>
          <button className={btn} onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      ) : (
        <button className={btn} onClick={() => setOpen(true)} disabled={!ready}>
          Sign in
        </button>
      )}
      {open && <AuthModal supabase={supabase} onClose={() => setOpen(false)} />}
    </>
  );
}

function AuthModal({
  supabase,
  onClose,
}: {
  supabase: NonNullable<ReturnType<typeof createClient>>;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const titleId = useId();
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setError(error.message);
        else onClose(); // onAuthStateChange updates the header
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) setError(error.message);
        else if (data.session) onClose(); // confirmations disabled → signed in now
        else setNotice('Check your email to confirm your account, then sign in.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-[2px]"
      onClick={() => !busy && onClose()}
      role="presentation"
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={submit}
        className="w-[min(360px,100%)] rounded-[var(--radius-lg)] border border-border bg-panel px-5 py-5 shadow-[0_20px_50px_rgba(0,0,0,0.55)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          id={titleId}
          className="m-0 font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight"
        >
          {mode === 'signin' ? 'Sign in' : 'Create account'}
        </h3>
        <p className="mb-4 mt-1.5 text-xs leading-relaxed text-text-dim">
          Your account keeps your identity across sessions. Edits stay on this device.
        </p>

        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-xs text-text-dim">Email</span>
          <input
            ref={firstRef}
            type="email"
            required
            autoComplete="email"
            className={field}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-xs text-text-dim">Password</span>
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            className={field}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && (
          <p role="alert" className="mb-3 text-xs text-danger">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="mb-3 text-xs text-accent">
            {notice}
          </p>
        )}

        <button className={`${btnPrimary} w-full`} type="submit" disabled={busy} aria-busy={busy}>
          {busy ? (
            <>
              <IconSpinner />
              {mode === 'signin' ? 'Signing in…' : 'Creating…'}
            </>
          ) : mode === 'signin' ? (
            'Sign in'
          ) : (
            'Create account'
          )}
        </button>

        <div className="mt-3 text-center text-xs text-text-dim">
          {mode === 'signin' ? (
            <>
              No account?{' '}
              <button
                type="button"
                className="text-accent hover:underline"
                onClick={() => {
                  setMode('signup');
                  setError(null);
                  setNotice(null);
                }}
              >
                Create one
              </button>
            </>
          ) : (
            <>
              Have an account?{' '}
              <button
                type="button"
                className="text-accent hover:underline"
                onClick={() => {
                  setMode('signin');
                  setError(null);
                  setNotice(null);
                }}
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
