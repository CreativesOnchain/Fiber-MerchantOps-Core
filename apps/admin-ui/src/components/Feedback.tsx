import type { ReactNode } from "react";

export function ErrorNote({ message }: { message: string }) {
  return <div className="note note-error">Error: {message}</div>;
}

export function InfoNote({ children }: { children: ReactNode }) {
  return <div className="note note-info">{children}</div>;
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return <div className="loading">{label}</div>;
}

/** Standard "loading first / error / empty / content" wrapper for a screen. */
export function AsyncSection<T>({
  loading,
  error,
  data,
  emptyLabel,
  isEmpty,
  children,
}: {
  loading: boolean;
  error: string | null;
  data: T | null;
  emptyLabel: string;
  isEmpty: (data: T) => boolean;
  children: (data: T) => ReactNode;
}) {
  if (data === null && loading) return <Loading />;
  if (data === null && error) return <ErrorNote message={error} />;
  if (data === null) return <InfoNote>No data.</InfoNote>;
  return (
    <>
      {error ? <ErrorNote message={error} /> : null}
      {isEmpty(data) ? <InfoNote>{emptyLabel}</InfoNote> : children(data)}
    </>
  );
}
