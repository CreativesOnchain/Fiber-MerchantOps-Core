import { Link } from "react-router-dom";
import { api } from "../api/client";
import { StatusBadge } from "../components/Badge";
import { AsyncSection } from "../components/Feedback";
import { useAsync } from "../hooks/useAsync";
import { useMerchant } from "../state/MerchantContext";

/**
 * Screen 5 — Receipts (brief §18): every paid intent that issued a receipt,
 * with links to the JSON and HTML receipt documents. There is no list-receipts
 * endpoint, so the list is derived from the merchant's intents that carry a
 * receipt_id.
 */
export function ReceiptsPage() {
  const { merchantId } = useMerchant();
  const state = useAsync(
    () => api.listPaymentIntents(merchantId),
    [merchantId],
    5000,
  );

  return (
    <section>
      <div className="section-head">
        <h1>Receipts</h1>
        <button className="btn" onClick={() => state.reload()}>
          Refresh
        </button>
      </div>

      <AsyncSection
        loading={state.loading}
        error={state.error}
        data={state.data}
        isEmpty={(data) => data.items.every((i) => i.receipt_id === null)}
        emptyLabel={`No receipts yet for ${merchantId}. Receipts are issued when an intent is paid.`}
      >
        {(data) => (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Receipt ID</th>
                  <th>Order ID</th>
                  <th>Payment Intent</th>
                  <th>Amount</th>
                  <th>Asset</th>
                  <th>Status</th>
                  <th>Documents</th>
                </tr>
              </thead>
              <tbody>
                {data.items
                  .filter((intent) => intent.receipt_id !== null)
                  .map((intent) => {
                    const receiptId = intent.receipt_id as string;
                    return (
                      <tr key={receiptId}>
                        <td className="mono">{receiptId}</td>
                        <td>{intent.order_id}</td>
                        <td className="mono">
                          <Link
                            to={`/payment-intents/${intent.payment_intent_id}`}
                          >
                            {intent.payment_intent_id}
                          </Link>
                        </td>
                        <td className="num">{intent.amount}</td>
                        <td>{intent.asset}</td>
                        <td>
                          <StatusBadge status={intent.status} />
                        </td>
                        <td className="receipt-links">
                          <a
                            href={api.receiptJsonUrl(receiptId)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            JSON
                          </a>
                          <a
                            href={api.receiptHtmlUrl(receiptId)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            HTML
                          </a>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </AsyncSection>
    </section>
  );
}
