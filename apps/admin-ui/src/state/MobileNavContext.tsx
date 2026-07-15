import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface MobileNavState {
  /** Whether the off-canvas sidebar drawer is open (mobile / below `lg`). */
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  close: () => void;
}

const MobileNavContext = createContext<MobileNavState | null>(null);

/** Tracks the mobile navigation drawer's open state (no-op on desktop). */
export function MobileNavProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((value) => !value), []);
  const close = useCallback(() => setOpen(false), []);
  const value = useMemo(
    () => ({ open, setOpen, toggle, close }),
    [open, toggle, close],
  );
  return (
    <MobileNavContext.Provider value={value}>
      {children}
    </MobileNavContext.Provider>
  );
}

export function useMobileNav(): MobileNavState {
  const ctx = useContext(MobileNavContext);
  if (!ctx) {
    throw new Error("useMobileNav must be used within a MobileNavProvider");
  }
  return ctx;
}
