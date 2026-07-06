/**
 * Runtime configuration for the admin UI. Both values can be overridden at
 * build/dev time with Vite env vars; the localhost defaults let a bare
 * `pnpm dev:admin` talk to a default api-server + seeded merchant.
 */
export interface UiConfig {
  /** api-server origin, no trailing slash. */
  apiBaseUrl: string;
  /** Merchant the operator views first (seeded demo merchant by default). */
  defaultMerchantId: string;
}

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

export const config: UiConfig = {
  apiBaseUrl: rawBaseUrl.replace(/\/+$/, ""),
  defaultMerchantId: import.meta.env.VITE_DEFAULT_MERCHANT_ID ?? "m_123",
};
