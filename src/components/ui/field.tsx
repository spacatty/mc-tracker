/**
 * The form system. `Field` stacks label → control → hint/error; `FieldRow` is the settings-style row
 * (label + description left, control right); `Fieldset` groups fields under a small-caps legend.
 *
 * @example
 * <div className="grid gap-4 sm:grid-cols-2">
 *   <Field label="Name" htmlFor="name" required error={errors.name}>
 *     <Input id="name" name="name" />
 *   </Field>
 *   <Field label="Currency" htmlFor="currency" hint="Shown next to amounts.">
 *     <Input id="currency" name="currency" />
 *   </Field>
 * </div>
 *
 * <FieldRow label="Email reminders" description="A digest the day before a payment is due." htmlFor="reminders">
 *   <Switch id="reminders" checked={on} onCheckedChange={setOn} />
 * </FieldRow>
 */
import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      "text-xs font-medium leading-4 text-zinc-400 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Label.displayName = "Label";

export const FieldLabel = Label;

export const FieldDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => <p ref={ref} className={cn("text-[11.5px] leading-[1.125rem] text-zinc-500", className)} {...props} />,
);
FieldDescription.displayName = "FieldDescription";

export const FieldError = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} role="alert" className={cn("text-xs font-medium leading-5 text-red-300", className)} {...props} />
  ),
);
FieldError.displayName = "FieldError";

function RequiredMark() {
  return (
    <span className="ml-0.5 text-red-300/80" aria-hidden="true">
      *
    </span>
  );
}

export interface FieldProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Label above the control. Omit it to use Field as a bare wrapper (then place `FieldLabel` yourself). */
  label?: React.ReactNode;
  /** Help line under the control. Its id is `${htmlFor}-hint` when `htmlFor` is set. */
  hint?: React.ReactNode;
  /** Validation message under the control (replaces nothing; hint still shows). Id `${htmlFor}-error`. */
  error?: React.ReactNode;
  required?: boolean;
  htmlFor?: string;
}

export const Field = React.forwardRef<HTMLDivElement, FieldProps>(
  ({ label, hint, error, required, htmlFor, className, children, ...props }, ref) => (
    <div ref={ref} className={cn("grid min-w-0 content-start gap-1.5", className)} {...props}>
      {label ? (
        <Label htmlFor={htmlFor}>
          {label}
          {required ? <RequiredMark /> : null}
        </Label>
      ) : null}
      {children}
      {hint ? <FieldDescription id={htmlFor ? `${htmlFor}-hint` : undefined}>{hint}</FieldDescription> : null}
      {error ? <FieldError id={htmlFor ? `${htmlFor}-error` : undefined}>{error}</FieldError> : null}
    </div>
  ),
);
Field.displayName = "Field";

export interface FieldRowProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  label: React.ReactNode;
  description?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  htmlFor?: string;
}

/** Settings-style row: label + description on the left, control on the right (stacks on mobile). */
export const FieldRow = React.forwardRef<HTMLDivElement, FieldRowProps>(
  ({ label, description, error, required, htmlFor, className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("grid gap-x-6 gap-y-2 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] sm:items-center", className)}
      {...props}
    >
      <div className="min-w-0">
        <Label htmlFor={htmlFor} className="text-[13px] text-zinc-200">
          {label}
          {required ? <RequiredMark /> : null}
        </Label>
        {description ? <FieldDescription className="mt-1">{description}</FieldDescription> : null}
      </div>
      <div className="flex min-w-0 flex-col gap-1.5 sm:items-end">
        {children}
        {error ? <FieldError id={htmlFor ? `${htmlFor}-error` : undefined}>{error}</FieldError> : null}
      </div>
    </div>
  ),
);
FieldRow.displayName = "FieldRow";

export interface FieldsetProps extends Omit<React.FieldsetHTMLAttributes<HTMLFieldSetElement>, "title"> {
  legend: React.ReactNode;
  description?: React.ReactNode;
}

/** Groups related fields under a small-caps legend. Children are laid out in a `grid gap-4`. */
export const Fieldset = React.forwardRef<HTMLFieldSetElement, FieldsetProps>(
  ({ legend, description, className, children, ...props }, ref) => (
    <fieldset ref={ref} className={cn("min-w-0", className)} {...props}>
      <legend className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-zinc-500">{legend}</legend>
      {description ? <FieldDescription className="mt-1">{description}</FieldDescription> : null}
      <div className="mt-3 grid gap-4">{children}</div>
    </fieldset>
  ),
);
Fieldset.displayName = "Fieldset";
