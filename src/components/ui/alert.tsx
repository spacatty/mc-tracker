/**
 * Alert: a subtle tinted message box for info / success / warning / danger. Replaces ad-hoc coloured boxes
 * and carries form-level errors (`tone="danger"`).
 *
 * @example
 * <Alert tone="warning" title="Backup key missing" action={<Button size="xs" variant="secondary">Add key</Button>}>
 *   Without it, the vault cannot be recovered.
 * </Alert>
 */
import * as React from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export type AlertTone = "info" | "success" | "warning" | "danger";

const TONES: Record<AlertTone, { box: string; icon: string; title: string; body: string }> = {
  info: { box: "border-sky-400/15 bg-sky-500/[0.06]", icon: "text-sky-300", title: "text-sky-100", body: "text-sky-100/75" },
  success: {
    box: "border-emerald-400/15 bg-emerald-500/[0.06]",
    icon: "text-emerald-300",
    title: "text-emerald-100",
    body: "text-emerald-100/75",
  },
  warning: { box: "border-amber-400/15 bg-amber-500/[0.06]", icon: "text-amber-300", title: "text-amber-100", body: "text-amber-100/75" },
  danger: { box: "border-red-400/15 bg-red-500/[0.06]", icon: "text-red-300", title: "text-red-100", body: "text-red-100/75" },
};

const DEFAULT_ICONS: Record<AlertTone, React.ComponentType<{ className?: string }>> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertCircle,
};

export interface AlertProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  tone?: AlertTone;
  title?: React.ReactNode;
  /** Right-aligned action (a small button or link). */
  action?: React.ReactNode;
  /** Override the tone's icon; pass `null` for no icon. */
  icon?: React.ReactNode | null;
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ tone = "info", title, action, icon, className, children, role, ...props }, ref) => {
    const styles = TONES[tone];
    const DefaultIcon = DEFAULT_ICONS[tone];
    return (
      <div
        ref={ref}
        role={role ?? (tone === "danger" || tone === "warning" ? "alert" : "status")}
        className={cn("flex items-start gap-3 rounded-lg border px-3.5 py-3 text-[13px] leading-5", styles.box, className)}
        {...props}
      >
        {icon === null ? null : (
          <span className={cn("mt-0.5 shrink-0 [&_svg]:h-4 [&_svg]:w-4", styles.icon)} aria-hidden="true">
            {icon ?? <DefaultIcon />}
          </span>
        )}
        <div className="min-w-0 flex-1">
          {title ? <p className={cn("font-medium", styles.title)}>{title}</p> : null}
          {children ? <div className={cn(title && "mt-0.5", title ? styles.body : styles.title)}>{children}</div> : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2 self-center">{action}</div> : null}
      </div>
    );
  },
);
Alert.displayName = "Alert";
