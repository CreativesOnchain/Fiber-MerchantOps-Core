import { Link, Route, Routes } from "react-router-dom";
import { AppFrame, StandardScreen } from "./components/Layout";
import { DashboardPage } from "./pages/DashboardPage";
import { LedgerPage } from "./pages/LedgerPage";
import { PaymentIntentDetailPage } from "./pages/PaymentIntentDetailPage";
import { PaymentIntentsPage } from "./pages/PaymentIntentsPage";
import { ReceiptsPage } from "./pages/ReceiptsPage";
import { ReconciliationPage } from "./pages/ReconciliationPage";
import { WebhooksPage } from "./pages/WebhooksPage";
import { HealthProvider } from "./state/HealthContext";
import { MerchantProvider } from "./state/MerchantContext";
import { NodeProvider } from "./state/NodeContext";
import { SearchProvider } from "./state/SearchContext";

export function App() {
  return (
    <MerchantProvider>
      <HealthProvider>
        <NodeProvider>
        <SearchProvider>
          <Routes>
          <Route element={<AppFrame />}>
            {/* Orders renders its own <main> + right rail (full 3-column layout). */}
            <Route path="payment-intents" element={<PaymentIntentsPage />} />

            {/* Every other screen uses the standard single-column surface. */}
            <Route element={<StandardScreen />}>
              <Route index element={<DashboardPage />} />
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
          </Route>
          </Routes>
        </SearchProvider>
        </NodeProvider>
      </HealthProvider>
    </MerchantProvider>
  );
}

function NotFound() {
  return (
    <section className="rounded-card border border-hairline bg-panel px-6 py-16 text-center">
      <h1 className="text-[19px] font-semibold text-ink">Not found</h1>
      <p className="mt-1 text-[13px] text-muted">
        That screen does not exist.{" "}
        <Link to="/" className="font-medium text-brand underline underline-offset-2">
          Back to overview
        </Link>
        .
      </p>
    </section>
  );
}
