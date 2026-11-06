"use client";

/**
 * Dialog parts (Radix) in the Quick Capture panel style, plus `ConfirmDialog`.
 *
 * @example
 * <Dialog open={open} onOpenChange={setOpen}>
 *   <DialogContent size="md">
 *     <DialogHeader icon={<KeyRound />} tone="accent">
 *       <DialogTitle>New account</DialogTitle>
 *       <DialogDescription>Saved to this workspace.</DialogDescription>
 *     </DialogHeader>
 *     <DialogBody>…fields…</DialogBody>
 *     <DialogFooter hint={<><Kbd>Esc</Kbd> to close</>}>
 *       <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
 *       <Button type="submit">Save</Button>
 *     </DialogFooter>
 *   </DialogContent>
 * </Dialog>
 *
 * <ConfirmDialog open={!!target} onOpenChange={(next) => !next && setTarget(null)} destructive
 *   title="Delete entry?" description="This cannot be undone." confirmLabel="Delete" onConfirm={remove} />
 */
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AlertTriangle, HelpCircle, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const DialogPortal = DialogPrimitive.Portal;

export const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn("capture-overlay-in fixed inset-0 z-50 bg-black/60 backdrop-blur-md", className)}
    {...props}
  />
));
DialogOverlay.displayName = "DialogOverlay";

export type DialogSize = "sm" | "md" | "lg" | "xl";
export type DialogTone = "default" | "accent" | "success" | "warning" | "danger" | "info";

const DIALOG_SIZES: Record<DialogSize, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  showClose?: boolean;
  closeLabel?: string;
  /** sm = 24rem, md = 32rem (default), lg = 42rem, xl = 56rem. */
  size?: DialogSize;
}

export const DialogContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, DialogContentProps>(
  ({ className, children, showClose = true, closeLabel = "Close dialog", size = "md", ...props }, ref) => (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          // Same panel as Quick Capture: centred with margins (not transforms) so the open animation never fights its position.
          "capture-panel-in fixed inset-x-0 top-[14vh] z-50 mx-auto flex max-h-[76vh] w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#101013] text-foreground shadow-[0_40px_120px_-30px_rgba(0,0,0,0.85)] outline-none",
          DIALOG_SIZES[size],
          className,
        )}
        {...props}
      >
        {children}
        {showClose ? (
          <DialogPrimitive.Close
            className="absolute right-4 top-4 inline-flex size-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40 disabled:pointer-events-none"
            aria-label={closeLabel}
          >
            <X className="size-4" aria-hidden="true" />
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPortal>
  ),
);
DialogContent.displayName = "DialogContent";

const ICON_TONES: Record<DialogTone, string> = {
  default: "bg-white/[0.06] text-zinc-300",
  accent: "bg-violet-500/10 text-violet-200",
  success: "bg-emerald-500/10 text-emerald-200",
  warning: "bg-amber-500/10 text-amber-200",
  danger: "bg-red-500/10 text-red-200",
  info: "bg-sky-500/10 text-sky-200",
};

export interface DialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional icon shown in a 36px tinted tile left of the title. */
  icon?: React.ReactNode;
  /** Icon tile tint. Defaults to accent (violet). */
  tone?: DialogTone;
}

export const DialogHeader = React.forwardRef<HTMLDivElement, DialogHeaderProps>(
  ({ className, icon, tone = "accent", children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex shrink-0 items-start gap-3 border-b border-white/[0.06] px-5 py-4 pr-14 text-left", className)}
      {...props}
    >
      {icon ? (
        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg [&_svg]:h-4 [&_svg]:w-4", ICON_TONES[tone])} aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <div className={cn("flex min-w-0 flex-1 flex-col gap-0.5", icon && "pt-px")}>{children}</div>
    </div>
  ),
);
DialogHeader.displayName = "DialogHeader";

export const DialogBody = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-4", className)} {...props} />,
);
DialogBody.displayName = "DialogBody";

export interface DialogFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Left-aligned hint, usually keyboard shortcuts (`<><Kbd>Ctrl</Kbd><Kbd>Enter</Kbd> to save</>`). Hidden on mobile. */
  hint?: React.ReactNode;
}

export const DialogFooter = React.forwardRef<HTMLDivElement, DialogFooterProps>(
  ({ className, hint, children, ...props }, ref) => (
    <div ref={ref} className={cn("flex shrink-0 items-center gap-3 border-t border-white/[0.06] px-5 py-3", className)} {...props}>
      {hint ? <div className="hidden min-w-0 items-center gap-1.5 text-[11.5px] text-zinc-500 sm:flex">{hint}</div> : null}
      <div className="ml-auto flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">{children}</div>
    </div>
  ),
);
DialogFooter.displayName = "DialogFooter";

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-[15px] font-semibold text-zinc-100", className)} {...props} />
));
DialogTitle.displayName = "DialogTitle";

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-xs leading-5 text-zinc-500", className)} {...props} />
));
DialogDescription.displayName = "DialogDescription";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Extra content between the header and the footer (e.g. what will be affected). */
  children?: React.ReactNode;
  confirmLabel?: React.ReactNode;
  cancelLabel?: React.ReactNode;
  closeLabel?: string;
  /** Red confirm button and a danger icon. */
  destructive?: boolean;
  /** Disables both buttons (and closing) and spins the confirm icon while the action runs. */
  pending?: boolean;
  onConfirm: () => void | Promise<void>;
  icon?: React.ReactNode;
}

/** Small confirmation dialog. It stays open while `onConfirm` runs; close it from the caller when done. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  closeLabel,
  destructive = false,
  pending = false,
  onConfirm,
  icon,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      {/* Stop clicks bubbling through the React tree to a clickable table row behind the portal. */}
      <DialogContent size="sm" closeLabel={closeLabel} onClick={(event) => event.stopPropagation()}>
        <DialogHeader icon={icon ?? (destructive ? <AlertTriangle /> : <HelpCircle />)} tone={destructive ? "danger" : "accent"}>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}
        </DialogHeader>
        {children ? <DialogBody className="text-[13px] text-zinc-300">{children}</DialogBody> : null}
        <DialogFooter>
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            size="sm"
            disabled={pending}
            onClick={() => void onConfirm()}
            autoFocus
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
ConfirmDialog.displayName = "ConfirmDialog";
