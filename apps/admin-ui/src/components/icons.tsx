import type { SVGProps } from "react";

/**
 * Hand-rolled icon set matching the glyphs in the reference screenshots.
 * Stroke-based, 1.6px, currentColor — no icon dependency, no network fetch.
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 18, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const GridIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </Svg>
);

export const MenuIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 6h18M3 12h18M3 18h18" />
  </Svg>
);

export const ReceiptIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2Z" />
    <path d="M9 7h6M9 11h6M9 15h3" />
  </Svg>
);

export const IntentIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2" y="5" width="20" height="14" rx="2.5" />
    <path d="M2 10h20" />
    <path d="M6 15h4" />
  </Svg>
);

export const LedgerIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5.5A1.5 1.5 0 0 1 4 19.5v-15Z" />
    <path d="M4 17.5h16" />
    <path d="M8 7h8M8 11h8" />
  </Svg>
);

export const WebhookIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="6" r="3" />
    <circle cx="5.5" cy="18" r="3" />
    <circle cx="18.5" cy="18" r="3" />
    <path d="M10.5 8.6 7 15M13.5 8.6 17 15M8.5 18h7" />
  </Svg>
);

export const ExportIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3v11" />
    <path d="m8 10 4 4 4-4" />
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </Svg>
);

export const UploadIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 17V6" />
    <path d="m8 10 4-4 4 4" />
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </Svg>
);

export const RefreshIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <path d="M21 3v6h-6" />
  </Svg>
);

export const SearchIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Svg>
);

export const ChevronDown = (p: IconProps) => (
  <Svg {...p}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);

export const ChevronLeft = (p: IconProps) => (
  <Svg {...p}>
    <path d="m15 18-6-6 6-6" />
  </Svg>
);

export const ChevronRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="m9 18 6-6-6-6" />
  </Svg>
);

export const ArrowDownIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14" />
    <path d="m6 13 6 6 6-6" />
  </Svg>
);

export const TrendUp = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 19V5" />
    <path d="m6 11 6-6 6 6" />
  </Svg>
);

export const TrendDown = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14" />
    <path d="m6 13 6 6 6-6" />
  </Svg>
);

export const TableIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 9h18M3 14.5h18M9 9v11" />
  </Svg>
);

export const CardsIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 9h18M12 9v11" />
  </Svg>
);

export const DotsIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="5" cy="12" r="1.4" fill="currentColor" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" />
    <circle cx="19" cy="12" r="1.4" fill="currentColor" />
  </Svg>
);

export const ReportIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 21V4a1 1 0 0 1 1-1h9l4 4v14" />
    <path d="M14 3v5h5" />
    <path d="M9 13h6M9 17h4" />
  </Svg>
);

export const ShieldIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3 5 6v5.5c0 4.2 2.9 8.1 7 9.5 4.1-1.4 7-5.3 7-9.5V6l-7-3Z" />
    <path d="m9.5 12 1.8 1.8 3.4-3.6" />
  </Svg>
);

export const UserIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
  </Svg>
);

export const CheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Svg>
);

export const PanelLeftIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M9 4v16" />
  </Svg>
);

export const ClockIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
);

/* --- Mate glyphs --- */

export const DownloadIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3v11" />
    <path d="m8 11 4 3 4-3" />
    <path d="M5 20h14" />
  </Svg>
);

export const PrinterIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 9V3h12v6" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="7" rx="1" />
  </Svg>
);

export const CopyIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </Svg>
);

export const FlagIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 21V4" />
    <path d="M5 4h11l-1.5 3L16 10H5" fill="currentColor" stroke="none" />
    <path d="M5 4h11l-1.5 3L16 10H5" />
  </Svg>
);

export const XIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const ExternalIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M15 3h6v6" />
    <path d="M10 14 21 3" />
    <path d="M20 14v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5" />
  </Svg>
);

export const SlidersIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M16 18h4" />
    <circle cx="15" cy="6" r="2" fill="currentColor" stroke="none" />
    <circle cx="9" cy="12" r="2" fill="currentColor" stroke="none" />
    <circle cx="15" cy="18" r="2" fill="currentColor" stroke="none" />
  </Svg>
);

export const EnvelopeIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3.5 7 8.5 6 8.5-6" />
  </Svg>
);

export const PhoneIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 5c0 9 6 15 15 15l1-3.5-4-2-2 2c-2-1-4-3-5-5l2-2-2-4L5 4a1 1 0 0 0-1 1Z" />
  </Svg>
);

export const LayersIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="7" cy="7" r="3" fill="currentColor" stroke="none" />
    <circle cx="17" cy="7" r="3" fill="currentColor" stroke="none" opacity="0.65" />
    <circle cx="7" cy="17" r="3" fill="currentColor" stroke="none" opacity="0.65" />
    <circle cx="17" cy="17" r="3" fill="currentColor" stroke="none" />
  </Svg>
);

