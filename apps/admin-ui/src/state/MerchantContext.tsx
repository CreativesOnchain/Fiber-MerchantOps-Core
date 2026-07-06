import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { config } from "../config";

interface MerchantState {
  merchantId: string;
  setMerchantId: (id: string) => void;
}

const MerchantContext = createContext<MerchantState | null>(null);
const STORAGE_KEY = "merchantops.merchantId";

/** Holds the merchant every merchant-scoped screen reads, persisted locally. */
export function MerchantProvider({ children }: { children: ReactNode }) {
  const [merchantId, setMerchantIdState] = useState<string>(() => {
    return (
      window.localStorage.getItem(STORAGE_KEY) ?? config.defaultMerchantId
    );
  });

  const value = useMemo<MerchantState>(
    () => ({
      merchantId,
      setMerchantId: (id: string) => {
        const trimmed = id.trim();
        setMerchantIdState(trimmed);
        window.localStorage.setItem(STORAGE_KEY, trimmed);
      },
    }),
    [merchantId],
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
