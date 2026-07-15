import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type RefObject,
} from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useMerchant } from "../state/MerchantContext";
import { useMobileNav } from "../state/MobileNavContext";
import { useSearch } from "../state/SearchContext";
import {
  CheckIcon,
  DotsIcon,
  GridIcon,
  IntentIcon,
  LayersIcon,
  LedgerIcon,
  PanelLeftIcon,
  ReceiptIcon,
  ReportIcon,
  SearchIcon,
  WebhookIcon,
  XIcon,
} from "./icons";

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  end?: boolean;
}

/** The console's real destinations, presented in the Mate navigation style. */
const NAV: NavItem[] = [
  { to: "/", label: "Overview", icon: GridIcon, end: true },
  { to: "/payment-intents", label: "Payment intents", icon: IntentIcon },
  { to: "/ledger", label: "Ledger", icon: LedgerIcon },
  { to: "/webhooks", label: "Webhooks", icon: WebhookIcon },
  { to: "/receipts", label: "Receipts", icon: ReceiptIcon },
  { to: "/reconciliation", label: "Reconciliation", icon: ReportIcon },
];

const COLLAPSE_KEY = "sidebar.collapsed";

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(
    () => window.localStorage.getItem(COLLAPSE_KEY) === "1",
  );
  const inputRef = useRef<HTMLInputElement>(null);

  const { open: mobileOpen, close: closeMobile } = useMobileNav();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  // The icon-rail collapse is a desktop-only affordance; the mobile drawer
  // always renders the full-width, labelled sidebar.
  const effectiveCollapsed = isDesktop ? collapsed : false;

  const setCollapsedPersist = (value: boolean) => {
    setCollapsed(value);
    window.localStorage.setItem(COLLAPSE_KEY, value ? "1" : "0");
  };
  const expandAndFocusSearch = () => {
    setCollapsedPersist(false);
    window.setTimeout(() => inputRef.current?.focus(), 220);
  };

  // ⌘K / Ctrl-K focuses search — expanding the rail first when collapsed.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (effectiveCollapsed) expandAndFocusSearch();
        else inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [effectiveCollapsed]);

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex h-full shrink-0 flex-col bg-sidebar text-sidebar-text transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 lg:transition-[width] ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      } ${effectiveCollapsed ? "w-[68px]" : "w-[240px]"}`}
    >
      {/* Brand + collapse toggle */}
      {effectiveCollapsed ? (
        <div className="flex justify-center px-3 py-6">
          <button
            type="button"
            onClick={() => setCollapsedPersist(false)}
            title="Expand sidebar"
            aria-label="Expand sidebar"
            className="flex h-9 w-9 items-center justify-center rounded-md text-white transition-colors hover:bg-sidebar-hover"
          >
            <LayersIcon size={20} className="text-brand" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between px-5 py-6 text-white">
          <div className="flex items-center gap-2 text-[17px] font-semibold tracking-wide">
            <LayersIcon size={20} className="text-brand" />
            MerchantOps
          </div>
          {/* Collapse to the icon rail on desktop; close the drawer on mobile. */}
          <button
            type="button"
            onClick={() => setCollapsedPersist(true)}
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
            className="hidden text-sidebar-text transition-colors hover:text-white lg:block"
          >
            <PanelLeftIcon size={18} />
          </button>
          <button
            type="button"
            onClick={closeMobile}
            title="Close menu"
            aria-label="Close menu"
            className="text-sidebar-text transition-colors hover:text-white lg:hidden"
          >
            <XIcon size={18} />
          </button>
        </div>
      )}

      {/* Search */}
      {effectiveCollapsed ? (
        <div className="mb-6 flex justify-center px-3">
          <button
            type="button"
            onClick={expandAndFocusSearch}
            title="Search intents"
            aria-label="Search intents"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-sidebar-border bg-sidebar-input text-gray-400 transition-colors hover:text-white"
          >
            <SearchIcon size={16} />
          </button>
        </div>
      ) : (
        <SidebarSearch inputRef={inputRef} />
      )}

      {/* Navigation */}
      <nav
        className={`flex-1 space-y-1 overflow-y-auto scroll-slim ${
          effectiveCollapsed ? "px-2" : "px-3"
        }`}
      >
        {NAV.map((item) => (
          <NavItemLink
            key={item.to}
            item={item}
            collapsed={effectiveCollapsed}
            onNavigate={closeMobile}
          />
        ))}
      </nav>

      <ProfileSwitcher collapsed={effectiveCollapsed} />
    </aside>
  );
}

function NavItemLink({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        collapsed
          ? `flex h-10 items-center justify-center rounded-md transition-colors duration-150 ${
              isActive
                ? "bg-sidebar-hover text-white"
                : "hover:bg-sidebar-hover hover:text-white"
            }`
          : `group relative flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors duration-150 ${
              isActive
                ? "bg-sidebar-hover font-medium text-white before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-r-full before:bg-brand before:content-['']"
                : "hover:bg-sidebar-hover hover:text-white"
            }`
      }
    >
      {({ isActive }) =>
        isActive ? (
          <>
            <span className="flex h-5 w-5 items-center justify-center rounded bg-white text-sidebar">
              <Icon size={13} />
            </span>
            {collapsed ? null : item.label}
          </>
        ) : (
          <>
            <Icon size={collapsed ? 18 : 17} />
            {collapsed ? null : item.label}
          </>
        )
      }
    </NavLink>
  );
}

/** Global search: filters the payment-intents table. */
function SidebarSearch({ inputRef }: { inputRef: RefObject<HTMLInputElement> }) {
  const { query, setQuery } = useSearch();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="mb-6 px-4">
      <div className="flex items-center rounded-md border border-sidebar-border bg-sidebar-input px-3 py-2 focus-within:border-brand">
        <SearchIcon size={15} className="mr-2 text-gray-500" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => {
            const value = event.target.value;
            setQuery(value);
            if (value && location.pathname !== "/payment-intents") {
              navigate("/payment-intents");
            }
          }}
          placeholder="Search intents"
          spellCheck={false}
          className="w-full border-none bg-transparent text-[13px] text-white placeholder-gray-500 outline-none"
        />
        <span className="ml-2 shrink-0 rounded bg-sidebar-border px-1.5 py-0.5 text-[10px] text-gray-400">
          ⌘K
        </span>
      </div>
    </div>
  );
}

/** Deterministic avatar tint so each merchant keeps a stable colour. */
const TINTS = [
  "bg-brand",
  "bg-forest",
  "bg-amber",
  "bg-violet",
  "bg-cyan",
  "bg-danger",
];

function tintFor(id: string): string {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff;
  return TINTS[hash % TINTS.length] ?? "bg-brand";
}

/**
 * The bottom profile block doubles as the merchant switcher — the real,
 * functional analog of the Mate account row.
 */
function ProfileSwitcher({ collapsed }: { collapsed: boolean }) {
  const { merchantId, setMerchantId, merchants, current } = useMerchant();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const name = current?.name ?? merchantId;
  const initial = name.replace(/^m_/, "").charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative mt-auto border-t border-sidebar-border">
      {collapsed ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          title={name}
          className="flex w-full justify-center py-4 transition-colors duration-150 hover:bg-sidebar-hover"
        >
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold text-white ${tintFor(merchantId)}`}
          >
            {initial}
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex w-full items-center justify-between px-4 py-4 text-left transition-colors duration-150 hover:bg-sidebar-hover"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white ${tintFor(merchantId)}`}
            >
              {initial}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium text-white">
                {name}
              </span>
              <span className="block truncate font-mono text-[11px] text-sidebar-text">
                {merchantId}
              </span>
            </span>
          </span>
          <DotsIcon size={17} className="shrink-0" />
        </button>
      )}

      {open ? (
        <div
          role="listbox"
          className={`absolute z-30 max-h-80 overflow-y-auto rounded-xl border border-sidebar-border bg-sidebar p-1.5 shadow-float scroll-slim ${
            collapsed
              ? "bottom-2 left-full ml-2 w-60"
              : "bottom-full left-3 right-3 mb-2"
          }`}
        >
          {merchants.length === 0 ? (
            <p className="px-2 py-3 text-[12px] text-sidebar-text">
              No merchants returned by the API.
            </p>
          ) : (
            merchants.map((m) => {
              const selected = m.merchant_id === merchantId;
              return (
                <button
                  key={m.merchant_id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    setMerchantId(m.merchant_id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors duration-150 ${
                    selected ? "bg-sidebar-hover" : "hover:bg-sidebar-hover"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white ${tintFor(m.merchant_id)}`}
                  >
                    {m.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-white">
                      {m.name}
                    </span>
                    <span className="block truncate font-mono text-[11px] text-sidebar-text">
                      {m.merchant_id}
                    </span>
                  </span>
                  {selected ? (
                    <CheckIcon size={15} className="shrink-0 text-brand" />
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
