/**
 * Menu toggle — rounded square with three bars (middle shorter), TailAdmin-style.
 * Always shows the hamburger icon (does not switch to X).
 */
export default function MenuToggle({ open = false, onClick, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition hover:opacity-90 ${className}`}
      style={{
        backgroundColor: "var(--bg-elevated)",
        borderColor: "var(--border-base)",
        color: "var(--text-secondary)",
      }}
      aria-label={open ? "Close menu" : "Open menu"}
      aria-expanded={open}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M3.5 5H14.5"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
        <path
          d="M3.5 9H10.5"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
        <path
          d="M3.5 13H14.5"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
