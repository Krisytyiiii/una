import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef, useState, type MouseEvent } from "react";
import { Loader2 } from "lucide-react";

/** shadcn-style button primitive, styled via ui-tokens palette. */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "accent" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  /**
   * In-flight state for async actions. Renders an inline spinner, disables the
   * button, sets `aria-busy`, and keeps the label in the layout so the button
   * never changes width mid-click. Pair with `useMutationAction().busyId`.
   *
   * Async `onClick` handlers are also tracked automatically: if the handler
   * returns a promise, the button shows the same spinner until it settles. The
   * explicit prop still wins for work that spans more than one click handler.
   */
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      children,
      onClick,
      ...props
    },
    ref
  ) => {
    const [pending, setPending] = useState(false);
    const busy = loading || pending;

    const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
      if (!onClick || busy) return;
      const result = onClick(event) as unknown;
      // Event handlers are typed as void, but async callbacks return a promise
      // at runtime. Track it so every action button gets a spinner without
      // each caller having to wire its own pending state.
      if (result && typeof (result as Promise<unknown>).then === "function") {
        setPending(true);
        void Promise.resolve(result).finally(() => setPending(false));
      }
    };

    return (
      <button
        ref={ref}
        disabled={disabled || busy}
        aria-busy={busy || undefined}
        onClick={handleClick}
        className={cn(
          "inline-flex h-6 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 font-display text-[12.5px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:opacity-50 disabled:pointer-events-none",
          // App-wide 24px control height. `lg` is reserved for the public
          // auth/landing CTAs, which stay large on purpose.
          size === "sm" && "h-6 px-3 text-[12px]",
          size === "md" && "h-6 px-3.5 text-[12.5px]",
          size === "lg" && "h-8 rounded px-4 text-sm",
          variant === "primary" && "bg-primary-600 text-white shadow-soft hover:bg-primary-700",
          variant === "secondary" && "bg-white text-ink shadow-card hover:bg-cream-dark",
          variant === "accent" && "bg-accent-400 text-ink hover:bg-accent-300",
          variant === "outline" && "border-2 border-ink/15 bg-white text-ink hover:border-primary-400",
          variant === "ghost" && "text-ink-soft hover:bg-cream-dark",
          variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
          className,
        )}
        {...props}
      >
        {busy && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
