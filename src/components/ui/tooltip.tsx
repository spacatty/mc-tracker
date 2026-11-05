"use client";

import { cloneElement, isValidElement, useState, type ReactElement, type ReactNode, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";

type Anchor = { x: number; y: number };
type TriggerProps = {
  onMouseEnter?: (event: SyntheticEvent<HTMLElement>) => void;
  onMouseLeave?: (event: SyntheticEvent<HTMLElement>) => void;
  onFocus?: (event: SyntheticEvent<HTMLElement>) => void;
  onBlur?: (event: SyntheticEvent<HTMLElement>) => void;
  "aria-label"?: string;
};

/**
 * Small hover/focus label above its child. Rendered in a portal so table scroll areas don't clip it.
 * The child must accept mouse/focus handlers (a button or link).
 */
export function Tooltip({ label, children }: { label: ReactNode; children: ReactElement<TriggerProps> }) {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  if (!isValidElement(children)) return children;

  const show = (event: SyntheticEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setAnchor({ x: rect.left + rect.width / 2, y: rect.top });
  };
  const hide = () => setAnchor(null);
  const chain =
    (own: (event: SyntheticEvent<HTMLElement>) => void, theirs?: (event: SyntheticEvent<HTMLElement>) => void) =>
    (event: SyntheticEvent<HTMLElement>) => {
      theirs?.(event);
      own(event);
    };

  return (
    <>
      {cloneElement(children, {
        onMouseEnter: chain(show, children.props.onMouseEnter),
        onMouseLeave: chain(hide, children.props.onMouseLeave),
        onFocus: chain(show, children.props.onFocus),
        onBlur: chain(hide, children.props.onBlur),
        "aria-label": children.props["aria-label"] ?? (typeof label === "string" ? label : undefined),
      })}
      {anchor && typeof document !== "undefined"
        ? createPortal(
            <span
              role="tooltip"
              style={{ left: anchor.x, top: anchor.y }}
              className="suggest-in pointer-events-none fixed z-[60] -translate-x-1/2 -translate-y-[calc(100%+6px)] whitespace-nowrap rounded-md border border-white/10 bg-[#18181c] px-2 py-1 text-[11px] font-medium text-zinc-200 shadow-[0_12px_30px_-12px_rgba(0,0,0,0.9)]"
            >
              {label}
            </span>,
            document.body,
          )
        : null}
    </>
  );
}

/** Square icon button used for compact row actions. */
export const iconActionClass =
  "inline-grid h-7 w-7 shrink-0 place-items-center rounded-md border border-white/[0.06] bg-white/[0.02] text-zinc-400 transition hover:text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40";
