import type { ReactNode } from "react";

/**
 * Screen header from the reference: title, a subtle count chip, a muted
 * one-line description, and right-aligned actions.
 */
export function PageHeader({
  title,
  count,
  description,
  actions,
}: {
  title: string;
  count?: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-[19px] font-semibold tracking-tight text-ink">
            {title}
          </h1>
          {count ? (
            <span className="rounded-md bg-neutral-bg px-1.5 py-0.5 text-[11px] font-medium text-muted">
              {count}
            </span>
          ) : null}
        </div>
        {description ? (
          <p className="mt-0.5 text-[13px] text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

/** White panel with hairline border and near-zero shadow (table surfaces). */
export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-card border border-hairline bg-panel ${className}`}
    >
      {children}
    </div>
  );
}
