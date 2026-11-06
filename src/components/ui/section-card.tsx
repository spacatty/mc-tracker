/**
 * SectionCard: the standard card surface with a header (title, description, actions), a padded body and an
 * optional footer. Use `flush` for tables and lists that run edge to edge. `SectionHeading` is the same
 * header without a card, for in-page group headings.
 *
 * @example
 * <SectionCard title="Members" description="People with access to this workspace." actions={<Button size="sm">Invite</Button>} flush>
 *   <Table bare>…</Table>
 * </SectionCard>
 *
 * <SectionHeading title="Danger zone" description="These actions cannot be undone." />
 */
import * as React from "react";
import { cn } from "@/lib/utils";

export interface SectionCardProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  /** Drop the body padding (tables, lists). */
  flush?: boolean;
  as?: "section" | "div" | "article" | "aside";
  headerClassName?: string;
  bodyClassName?: string;
}

export const SectionCard = React.forwardRef<HTMLElement, SectionCardProps>(
  (
    { title, description, actions, footer, flush, as: Comp = "section", className, headerClassName, bodyClassName, children, ...props },
    ref,
  ) => {
    const headingId = React.useId();
    return (
      <Comp
        ref={ref as React.Ref<HTMLDivElement>}
        aria-labelledby={title ? headingId : undefined}
        className={cn("relative min-w-0 overflow-hidden rounded-xl border border-white/[0.06] bg-surface text-foreground", className)}
        {...props}
      >
        {title || actions ? (
          <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4", headerClassName)}>
            <div className="min-w-0">
              {title ? (
                <h2 id={headingId} className="text-[15px] font-semibold leading-6 text-white">
                  {title}
                </h2>
              ) : null}
              {description ? <p className="mt-0.5 text-xs leading-5 text-zinc-500">{description}</p> : null}
            </div>
            {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
          </div>
        ) : null}
        <div className={cn("relative", !flush && "p-5", bodyClassName)}>{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/[0.06] bg-white/[0.015] px-5 py-3">{footer}</div>
        ) : null}
      </Comp>
    );
  },
);
SectionCard.displayName = "SectionCard";

export interface SectionHeadingProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  as?: "h2" | "h3";
}

export const SectionHeading = React.forwardRef<HTMLDivElement, SectionHeadingProps>(
  ({ title, description, actions, as: Heading = "h2", className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-wrap items-end justify-between gap-3", className)} {...props}>
      <div className="min-w-0">
        <Heading className="text-[15px] font-semibold leading-6 text-white">{title}</Heading>
        {description ? <p className="mt-0.5 text-xs leading-5 text-zinc-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  ),
);
SectionHeading.displayName = "SectionHeading";
