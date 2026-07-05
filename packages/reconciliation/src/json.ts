import type {
  ReconciliationJsonExport,
  ReconciliationRecord,
} from "@fiber-merchantops/shared";

export function buildReconciliationJsonExport(
  merchantId: string,
  records: readonly ReconciliationRecord[],
  generatedAt: Date | string = new Date(),
): ReconciliationJsonExport {
  return {
    merchant_id: merchantId,
    generated_at:
      typeof generatedAt === "string" ? generatedAt : generatedAt.toISOString(),
    records: [...records],
  };
}
