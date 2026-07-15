import type { ReactNode } from "react";

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="rounded-card border border-danger/20 bg-danger-bg px-3.5 py-2.5 text-[13px] text-danger">
      {message}
    </div>
  );
}

export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-card border border-hairline bg-panel px-3.5 py-2.5 text-[13px] text-muted">
      {children}
    </div>
  );
}

/** A single shimmering placeholder block. Size it with `className`. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

/** Generic skeleton for screens that don't provide a tailored one. */
function DefaultSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-8 w-28" />
      </div>
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

/**
 * Standard "loading first / error / empty / content" wrapper for a screen.
 * The initial load shows a skeleton (content-shaped placeholder) rather than a
 * spinner; pass `skeleton` to tailor it to the screen's layout.
 */
export function AsyncSection<T>({
  loading,
  error,
  data,
  emptyLabel,
  isEmpty,
  skeleton,
  children,
}: {
  loading: boolean;
  error: string | null;
  data: T | null;
  emptyLabel: string;
  isEmpty: (data: T) => boolean;
  skeleton?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  if (data === null && loading) return <>{skeleton ?? <DefaultSkeleton />}</>;
  if (data === null && error) return <ErrorNote message={error} />;
  if (data === null) return <InfoNote>No data.</InfoNote>;
  return (
    <div className="flex flex-col gap-3">
      {error ? <ErrorNote message={error} /> : null}
      {isEmpty(data) ? <InfoNote>{emptyLabel}</InfoNote> : children(data)}
    </div>
  );
}
