// SVG Icon Library — Standard 24x24 stroke-based icons
// No emoji, no icon font dependencies — pure inline SVG

interface IconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
}

const base = (path: string, opts?: { fill?: boolean }) =>
  function Icon({ size = 20, className = "", strokeWidth = 1.6 }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={opts?.fill ? "currentColor" : "none"}
        stroke={opts?.fill ? "none" : "currentColor"}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        <path d={path} />
      </svg>
    );
  };

const multi = (paths: string[], opts?: { fill?: boolean }) =>
  function Icon({ size = 20, className = "", strokeWidth = 1.6 }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={opts?.fill ? "currentColor" : "none"}
        stroke={opts?.fill ? "none" : "currentColor"}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        {paths.map((d, i) => <path key={i} d={d} />)}
      </svg>
    );
  };

// Navigation
export const DashboardIcon = multi([
  "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z",
  "M9 22V12h6v10",
]);
export const SearchIcon = multi([
  "M11 19a8 8 0 100-16 8 8 0 000 16z",
  "M21 21l-4.35-4.35",
]);
export const FolderIcon = multi([
  "M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z",
]);
export const BuildingIcon = multi([
  "M3 21h18",
  "M5 21V7l7-4 7 4v14",
  "M9 21v-4h6v4",
]);
export const ChartIcon = multi([
  "M18 20V10",
  "M12 20V4",
  "M6 20v-6",
]);
export const ShieldIcon = base("M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z");
export const ActivityIcon = base("M22 12h-4l-3 9L9 3l-3 9H2");

// Actions
export const PlusIcon       = base("M12 5v14M5 12h14");
export const DownloadIcon   = multi(["M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4","M7 10l5 5 5-5","M12 15V3"]);
export const ExternalIcon   = multi(["M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6","M15 3h6v6","M10 14L21 3"]);
export const RefreshIcon    = multi(["M23 4v6h-6","M1 20v-6h6","M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"]);
export const CalendarIcon   = multi(["M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2z","M16 2v4","M8 2v4","M3 10h18"]);
export const ClipboardIcon  = multi(["M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2","M15 2H9a1 1 0 00-1 1v2a1 1 0 001 1h6a1 1 0 001-1V3a1 1 0 00-1-1z"]);
export const SendIcon       = multi(["M22 2L11 13","M22 2L15 22l-4-9-9-4 20-7z"]);
export const CopyIcon       = multi(["M20 9H11a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-9a2 2 0 00-2-2z","M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"]);
export const FilterIcon     = base("M22 3H2l8 9.46V19l4 2v-8.54L22 3z");
export const MenuIcon       = multi(["M3 12h18","M3 6h18","M3 18h18"]);
export const XIcon          = base("M18 6L6 18M6 6l12 12");
export const MoreHorizontalIcon = multi(["M5 12h.01", "M12 12h.01", "M19 12h.01"]);
export const ChevronRight   = base("M9 18l6-6-6-6");
export const ChevronDown    = base("M6 9l6 6 6-6");
export const ArrowLeft      = multi(["M19 12H5","M12 19l-7-7 7-7"]);
export const ArrowUpIcon    = multi(["M12 19V5","M5 12l7-7 7 7"]);
export const ArrowDownIcon  = multi(["M12 5v14","M19 12l-7 7-7-7"]);

// Status
export const CheckCircleIcon = multi(["M22 11.08V12a10 10 0 11-5.93-9.14","M22 4L12 14.01l-3-3"]);
export const AlertCircleIcon = multi(["M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z","M12 9v4","M12 17h.01"]);
export const ClockIcon       = multi(["M12 22a10 10 0 100-20 10 10 0 000 20z","M12 6v6l4 2"]);
export const XCircleIcon     = multi(["M12 22a10 10 0 100-20 10 10 0 000 20z","M15 9l-6 6M9 9l6 6"]);
export const InfoIcon        = multi(["M12 22a10 10 0 100-20 10 10 0 000 20z","M12 16v-4","M12 8h.01"]);
export const LockIcon        = multi(["M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2z","M17 11V7a5 5 0 00-10 0v4"]);

// Domain-specific
export const NetworkIcon   = multi(["M12 2a3 3 0 100 6 3 3 0 000-6z","M19 9a3 3 0 100 6 3 3 0 000-6z","M5 9a3 3 0 100 6 3 3 0 000-6z","M12 8v3M7.5 10.5L12 11M16.5 10.5L12 11"]);
export const LinkIcon      = multi(["M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71","M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"]);
export const FileTextIcon  = multi(["M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z","M14 2v6h6","M16 13H8","M16 17H8","M10 9H8"]);
export const ZapIcon       = base("M13 2L3 14h9l-1 8 10-12h-9l1-8z");
export const GlobeIcon     = multi(["M12 22a10 10 0 100-20 10 10 0 000 20z","M2 12h20","M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"]);
export const UserIcon      = multi(["M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2","M12 11a4 4 0 100-8 4 4 0 000 8z"]);
export const DatabaseIcon  = multi(["M12 2C6.48 2 2 4.02 2 6.5v11C2 19.98 6.48 22 12 22s10-2.02 10-4.5v-11C22 4.02 17.52 2 12 2z","M2 6.5C2 8.98 6.48 11 12 11s10-2.02 10-4.5","M2 12c0 2.48 4.48 4.5 10 4.5s10-2.02 10-4.5"]);
export const HashIcon      = base("M4 9h16M4 15h16M10 3L8 21M16 3l-2 18");
export const TrendUpIcon   = multi(["M23 6l-9.5 9.5-5-5L1 18","M17 6h6v6"]);
export const SettingsIcon = multi(["M12 15a3 3 0 100-6 3 3 0 000 6z","M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"]);
export const SunIcon = multi(["M12 3v1m0 16v1m9-9h-1M4 12H3m15.36 6.36l-.7-.7M6.34 6.34l-.7-.7m12.72 0l-.7.7m-11.32 11.32l-.7.7","M12 8a4 4 0 100 8 4 4 0 000-8z"]); export const MoonIcon = base("M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z");
export const TrashIcon = multi(["M3 6h18", "M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2", "M10 11v6", "M14 11v6"]);
