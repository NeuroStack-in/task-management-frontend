/** WorkPulse wordmark — pulse-line glyph in an accent badge. */
export function Logo({
  className = "",
  showText = true,
  size = "md",
}: {
  className?: string;
  showText?: boolean;
  /** "md" for nav/footer chrome; "lg"/"xl" for brand moments (e.g. auth pages). */
  size?: "md" | "lg" | "xl";
}) {
  const icon = size === "xl" ? 56 : size === "lg" ? 44 : 30;
  return (
    <span
      className={`inline-flex items-center ${size === "md" ? "gap-2.5" : "gap-3"} ${className}`}
    >
      <svg
        width={icon}
        height={icon}
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
        <span
          className={`m-display font-semibold tracking-tight ${
            size === "xl"
              ? "text-[2.1rem]"
              : size === "lg"
                ? "text-[1.65rem]"
                : "text-[1.05rem]"
          }`}
        >
          WorkPulse
        </span>
      ) : null}
    </span>
  );
}
