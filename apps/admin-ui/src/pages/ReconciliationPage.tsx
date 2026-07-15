import { useState } from "react";
import { api, type ExportFormat } from "../api/client";
import { Button } from "../components/Button";
import { ErrorNote, InfoNote } from "../components/Feedback";
import { PageHeader, Panel } from "../components/PageHeader";
import { CheckIcon, ExportIcon, ReportIcon } from "../components/icons";
import { useMerchant } from "../state/MerchantContext";

/**
 * Reconciliation — one record per payment intent, exported as CSV or JSON. Every
 * download also writes an `export_generated` ledger event server-side.
 */
export function ReconciliationPage() {
  const { merchantId, current } = useMerchant();
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
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Reconciliation"
        description={`Export one settlement record per payment intent for ${current?.name ?? merchantId}`}
      />

      {error ? <ErrorNote message={error} /> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <ExportOption
          title="CSV export"
          description="Spreadsheet-ready. Columns follow the reconciliation record order: date, merchant, order, intent, asset, amount, status, hashes, receipt, webhook and settlement status."
          filename={`reconciliation-${merchantId}.csv`}
          busy={busy === "csv"}
          disabled={busy !== null}
          onDownload={() => download("csv")}
        />
        <ExportOption
          title="JSON export"
          description="The same records as a structured document, wrapped with the merchant id and a generated_at timestamp — useful for programmatic reconciliation."
          filename={`reconciliation-${merchantId}.json`}
          busy={busy === "json"}
          disabled={busy !== null}
          onDownload={() => download("json")}
        />
      </div>

      {lastSaved ? (
        <div className="flex items-center gap-2 rounded-card border border-success/20 bg-success-bg px-3.5 py-2.5 text-[13px] text-success">
          <CheckIcon size={16} />
          Saved <span className="font-mono">{lastSaved}</span>
        </div>
      ) : null}

      <InfoNote>
        Every download records an{" "}
        <code className="rounded bg-neutral-bg px-1 py-0.5 font-mono text-[12px]">
          export_generated
        </code>{" "}
        ledger event, so exports are themselves auditable.
      </InfoNote>
    </div>
  );
}

function ExportOption({
  title,
  description,
  filename,
  busy,
  disabled,
  onDownload,
}: {
  title: string;
  description: string;
  filename: string;
  busy: boolean;
  disabled: boolean;
  onDownload: () => void;
}) {
  return (
    <Panel className="flex flex-col gap-3 p-5">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-tint text-brand">
        <ReportIcon size={19} />
      </span>
      <div>
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          {description}
        </p>
      </div>
      <p className="font-mono text-[12px] text-faint">{filename}</p>
      <div className="mt-auto pt-1">
        <Button
          variant="primary"
          icon={<ExportIcon size={16} />}
          disabled={disabled}
          onClick={onDownload}
        >
          {busy ? "Preparing…" : "Download"}
        </Button>
      </div>
    </Panel>
  );
}
