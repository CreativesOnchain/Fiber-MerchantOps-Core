import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { MerchantResponse } from "@fiber-merchantops/shared";
import { api } from "../api/client";
import { config } from "../config";

interface MerchantState {
  merchantId: string;
  setMerchantId: (id: string) => void;
  /** Every merchant the API knows about — backs the sidebar switcher. */
  merchants: MerchantResponse[];
  /** The currently selected merchant, once loaded. */
  current: MerchantResponse | null;
}

const MerchantContext = createContext<MerchantState | null>(null);
const STORAGE_KEY = "merchantops.merchantId";

/** Holds the merchant every merchant-scoped screen reads, persisted locally. */
export function MerchantProvider({ children }: { children: ReactNode }) {
  const [merchantId, setMerchantIdState] = useState<string>(() => {
    return window.localStorage.getItem(STORAGE_KEY) ?? config.defaultMerchantId;
  });
  const [merchants, setMerchants] = useState<MerchantResponse[]>([]);

  useEffect(() => {
    let active = true;
    api
      .listMerchants()
      .then((res) => {
        if (active) setMerchants(res.merchants);
      })
      .catch(() => {
        // Switcher degrades to just the selected merchant; screens still load.
        if (active) setMerchants([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<MerchantState>(
    () => ({
      merchantId,
      merchants,
      current: merchants.find((m) => m.merchant_id === merchantId) ?? null,
      setMerchantId: (id: string) => {
        const trimmed = id.trim();
        setMerchantIdState(trimmed);
        window.localStorage.setItem(STORAGE_KEY, trimmed);
      },
    }),
    [merchantId, merchants],
  );

  return (
    <MerchantContext.Provider value={value}>
      {children}
    </MerchantContext.Provider>
  );
}

export function useMerchant(): MerchantState {
  const ctx = useContext(MerchantContext);
  if (!ctx) {
    throw new Error("useMerchant must be used within a MerchantProvider");
  }
  return ctx;
}
