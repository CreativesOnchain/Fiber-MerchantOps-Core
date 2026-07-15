import { createContext, useContext, useState, type ReactNode } from "react";

interface SearchState {
  /** Free-text query typed into the sidebar search; filters the intents table. */
  query: string;
  setQuery: (query: string) => void;
}

const SearchContext = createContext<SearchState | null>(null);

/** Holds the global sidebar search query read by the payment-intents table. */
export function SearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");
  return (
    <SearchContext.Provider value={{ query, setQuery }}>
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch(): SearchState {
  const ctx = useContext(SearchContext);
  if (!ctx) {
    throw new Error("useSearch must be used within a SearchProvider");
  }
  return ctx;
}
