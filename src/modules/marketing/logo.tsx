/** WorkPulse wordmark — pulse-line glyph in an accent badge. */
export function Logo({
  className = "",
  showText = true,
}: {
  className?: string;
  showText?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        width="30"
        height="30"
        viewBox="0 0 30 30"
        fill="none"
        aria-hidden="true"
      >
        <rect width="30" height="30" rx="8.5" fill="var(--m-accent)" />
        <path
          d="M5.5 16.2h3.6l2-6.4 3.4 10.2 2.1-5.3h4.4"
          stroke="#fff"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {showText ? (
        <span className="m-display text-[1.05rem] font-semibold tracking-tight">
          WorkPulse
        </span>
      ) : null}
    </span>
  );
}
