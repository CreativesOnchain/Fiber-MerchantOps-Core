import { Outlet } from "react-router-dom";
import { Banner } from "./Banner";
import { Sidebar } from "./Sidebar";

/**
 * Top-level chrome: the dark sidebar plus whatever the active route renders as
 * its siblings. Standard screens go through {@link StandardScreen}; the orders
 * screen renders its own <main> + right rail directly, so it becomes a flex
 * sibling of the sidebar for the full three-column Mate layout.
 */
export function AppFrame() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-white text-ink">
      <Sidebar />
      <Outlet />
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
      <div className="flex-1 overflow-y-auto scroll-slim">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-6 px-8 py-8">
          <Banner />
          <Outlet />
        </div>
      </div>
    </main>
  );
}
