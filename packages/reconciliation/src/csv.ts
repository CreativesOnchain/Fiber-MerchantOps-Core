import { stringify } from "csv-stringify/sync";
import type { ReconciliationRecord } from "@fiber-merchantops/shared";
import { RECONCILIATION_COLUMNS } from "./types";

/**
 * Serializes records in the fixed column order; null fields become empty
 * cells so spreadsheets and accounting imports stay clean.
 */
export function reconciliationRecordsToCsv(
  records: readonly ReconciliationRecord[],
): string {
  const rows = records.map((record) =>
    RECONCILIATION_COLUMNS.map((column) => record[column] ?? ""),
  );
  return stringify(rows, {
    header: true,
    columns: [...RECONCILIATION_COLUMNS],
  });
}
