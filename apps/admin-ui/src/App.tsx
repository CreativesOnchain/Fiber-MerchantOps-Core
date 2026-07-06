import { Link, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { LedgerPage } from "./pages/LedgerPage";
import { PaymentIntentDetailPage } from "./pages/PaymentIntentDetailPage";
import { PaymentIntentsPage } from "./pages/PaymentIntentsPage";
import { ReceiptsPage } from "./pages/ReceiptsPage";
import { ReconciliationPage } from "./pages/ReconciliationPage";
import { WebhooksPage } from "./pages/WebhooksPage";
import { HealthProvider } from "./state/HealthContext";
import { MerchantProvider } from "./state/MerchantContext";

export function App() {
  return (
    <MerchantProvider>
      <HealthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<PaymentIntentsPage />} />
            <Route
              path="payment-intents/:id"
              element={<PaymentIntentDetailPage />}
            />
            <Route path="ledger" element={<LedgerPage />} />
            <Route path="webhooks" element={<WebhooksPage />} />
            <Route path="receipts" element={<ReceiptsPage />} />
            <Route path="reconciliation" element={<ReconciliationPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </HealthProvider>
    </MerchantProvider>
  );
}

function NotFound() {
  return (
    <section>
      <h1>Not found</h1>
      <p className="lead">
        That screen does not exist. <Link to="/">Back to payment intents</Link>.
      </p>
    </section>
  );
}
