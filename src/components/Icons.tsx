/** Small inline SVG icons — keep stroke consistent at 1.75. */

type IconProps = { className?: string; size?: number };

export function IconChevron({ className, size = 12, open }: IconProps & { open?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
      className={`shrink-0 text-text-dim transition-transform duration-150 ease-[var(--ease-out)] ${
        open ? 'rotate-90' : ''
      } ${className ?? ''}`}
    >
      <path
        d="M4.25 2.5 7.75 6l-3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconReset({ className, size = 14 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden
      className={className}
    >
      <path
        d="M2.5 4.5A5.5 5.5 0 1 1 2 7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M2.5 2v2.5H5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconSpark({ className, size = 14 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden
      className={className}
    >
      <path
        d="M7 1.5v2M7 10.5v2M1.5 7h2M10.5 7h2M3.2 3.2l1.4 1.4M9.4 9.4l1.4 1.4M10.8 3.2 9.4 4.6M4.6 9.4 3.2 10.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="7" cy="7" r="1.75" fill="currentColor" />
    </svg>
  );
}

export function IconSpinner({ className, size = 14 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden
      className={`animate-spin-slow ${className ?? ''}`}
    >
      <circle cx="7" cy="7" r="5.25" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.75" />
      <path
        d="M12.25 7a5.25 5.25 0 0 0-5.25-5.25"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconUpload({ className, size = 28 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden
      className={className}
    >
      <rect
        x="3.5"
        y="5.5"
        width="21"
        height="17"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M9 16.5 12.5 13l2.5 2.5L19 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="1.25" fill="currentColor" />
    </svg>
  );
}

export function IconClose({ className, size = 14 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden
      className={className}
    >
      <path
        d="M3.5 3.5 10.5 10.5M10.5 3.5 3.5 10.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
