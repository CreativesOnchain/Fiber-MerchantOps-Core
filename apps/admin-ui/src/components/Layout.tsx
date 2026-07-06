import { NavLink, Outlet } from "react-router-dom";
import { useMerchant } from "../state/MerchantContext";
import { Banner } from "./Banner";

const NAV = [
  { to: "/", label: "Payment Intents", end: true },
  { to: "/ledger", label: "Ledger", end: false },
  { to: "/webhooks", label: "Webhooks", end: false },
  { to: "/receipts", label: "Receipts", end: false },
  { to: "/reconciliation", label: "Reconciliation", end: false },
];

/** App chrome: title, merchant selector, nav, mode banner, and routed screen. */
export function Layout() {
  const { merchantId, setMerchantId } = useMerchant();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-title">
          <span className="app-title-main">Fiber MerchantOps</span>
          <span className="app-title-sub">Admin</span>
        </div>
        <label className="merchant-field">
          <span>Merchant</span>
          <input
            value={merchantId}
            onChange={(event) => setMerchantId(event.target.value)}
            spellCheck={false}
            aria-label="Merchant ID"
          />
        </label>
      </header>

      <Banner />

      <nav className="app-nav">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              isActive ? "nav-link nav-link-active" : "nav-link"
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
