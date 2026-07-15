import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Button variants taken from the reference toolbar: a teal primary ("Export"),
 * a near-black solid ("Apply"), a hairline-bordered secondary, and a bare
 * text button ("Reset"/"Manage").
 */
export type ButtonVariant =
  | "primary"
  | "dark"
  | "secondary"
  | "ghost"
  | "danger";

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-white hover:bg-brand-hover shadow-[0_1px_2px_rgba(37,99,235,0.25)]",
  dark: "bg-ink text-white hover:bg-black",
  secondary:
    "bg-panel text-ink border border-hairline-strong hover:bg-rowhover",
  ghost: "text-ink-soft hover:text-ink hover:bg-neutral-bg",
  danger: "bg-danger-bg text-danger hover:bg-[#fbdcd8]",
};

const SIZE = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-9 px-4 text-[13px] gap-2 rounded-lg",
  lg: "h-10 px-5 text-sm gap-2 rounded-lg",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: keyof typeof SIZE;
  icon?: ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  children,
  className = "",
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center font-medium whitespace-nowrap transition-colors duration-150 disabled:opacity-50 ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

/** Square icon-only button (the upload / gear affordances in the header). */
export function IconButton({
  label,
  children,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors duration-150 hover:bg-neutral-bg hover:text-ink disabled:opacity-50 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
