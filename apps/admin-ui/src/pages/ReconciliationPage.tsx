import { useState } from "react";
import { api, type ExportFormat } from "../api/client";
import { ErrorNote, InfoNote } from "../components/Feedback";
import { useMerchant } from "../state/MerchantContext";

/**
 * Screen 6 — Reconciliation Export (brief §18): Download CSV / Download JSON.
 * Each button fetches the export and saves it as a file; the server also writes
 * an export_generated ledger event on every download.
 */
export function ReconciliationPage() {
  const { merchantId } = useMerchant();
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const download = async (format: ExportFormat) => {
    setBusy(format);
    setError(null);
    try {
      const { blob, filename } = await api.downloadExport(merchantId, format);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setLastSaved(filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section>
      <div className="section-head">
        <h1>Reconciliation Export</h1>
      </div>

      <p className="lead">
        Export one reconciliation record per payment intent for{" "}
        <span className="mono">{merchantId}</span>. Columns follow the brief
        §14.9 order; every download records an <code>export_generated</code>{" "}
        ledger event.
      </p>

      <div className="export-actions">
        <button
          className="btn btn-lg"
          disabled={busy !== null}
          onClick={() => download("csv")}
        >
          {busy === "csv" ? "Preparing…" : "Download CSV"}
        </button>
        <button
          className="btn btn-lg"
          disabled={busy !== null}
          onClick={() => download("json")}
        >
          {busy === "json" ? "Preparing…" : "Download JSON"}
        </button>
      </div>

      {error ? <ErrorNote message={error} /> : null}
      {lastSaved ? <InfoNote>Saved {lastSaved}.</InfoNote> : null}
    </section>
  );
}
