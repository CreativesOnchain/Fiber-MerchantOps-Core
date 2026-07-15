import { Outlet } from "react-router-dom";
import { MobileNavProvider, useMobileNav } from "../state/MobileNavContext";
import { Banner } from "./Banner";
import { Sidebar } from "./Sidebar";
import { LayersIcon, MenuIcon } from "./icons";

/**
 * Top-level chrome: the dark sidebar plus whatever the active route renders as
 * its siblings. On desktop the sidebar is docked; below `lg` it collapses into
 * an off-canvas drawer opened from the {@link MobileTopBar} hamburger. Standard
 * screens go through {@link StandardScreen}; the orders screen renders its own
 * <main> + right rail directly, so it becomes a flex sibling of the sidebar for
 * the full three-column Mate layout.
 */
export function AppFrame() {
  return (
    <MobileNavProvider>
      <div className="flex h-screen w-full overflow-hidden bg-white text-ink">
        <MobileNavBackdrop />
        <Sidebar />
        <Outlet />
      </div>
    </MobileNavProvider>
  );
}

/** Dimmed overlay behind the mobile drawer; tapping it closes the nav. */
function MobileNavBackdrop() {
  const { open, close } = useMobileNav();
  if (!open) return null;
  return (
    <div
      onClick={close}
      aria-hidden="true"
      className="fixed inset-0 z-40 bg-black/40 lg:hidden"
    />
  );
}

/**
 * Slim bar shown only below `lg`: a hamburger that opens the nav drawer plus the
 * product mark. Every screen renders it at the top of its content column; from
 * `lg` up it is hidden and the docked sidebar takes over.
 */
export function MobileTopBar() {
  const { toggle } = useMobileNav();
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-hairline bg-white px-4 py-2.5 lg:hidden">
      <button
        type="button"
        onClick={toggle}
        aria-label="Open navigation"
        className="flex h-9 w-9 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-rowhover"
      >
        <MenuIcon size={20} />
      </button>
      <span className="flex items-center gap-2 text-[15px] font-semibold text-ink">
        <LayersIcon size={18} className="text-brand" />
        MerchantOps
      </span>
    </div>
  );
}

/**
 * The single-column content surface shared by every screen except orders:
 * a white, independently scrolling panel with a centered measure, the health
 * banner pinned above the page body.
 */
export function StandardScreen() {
  return (
    <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-white">
      <MobileTopBar />
      <div className="flex-1 overflow-y-auto scroll-slim">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Banner />
          <Outlet />
        </div>
      </div>
    </main>
  );
}
