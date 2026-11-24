import type { ReactNode } from "react";

export type IconName =
  | "search"
  | "arrowRight"
  | "arrowLeft"
  | "chevronDown"
  | "menu"
  | "close"
  | "mapPin"
  | "calendar"
  | "mail"
  | "music"
  | "sports"
  | "festival"
  | "theatre"
  | "technology"
  | "workshop"
  | "business"
  | "experience";

const ICON_SHAPES: Record<IconName, ReactNode> = {
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.8" />
      <path d="m16 16 4.6 4.6" />
    </>
  ),
  arrowRight: <path d="M4 12h15m-6-6 6 6-6 6" />,
  arrowLeft: <path d="M20 12H5m6-6-6 6 6 6" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  menu: (
    <>
      <path d="M3 7h18" />
      <path d="M3 12h18" />
      <path d="M3 17h18" />
    </>
  ),
  close: (
    <>
      <path d="m5 5 14 14" />
      <path d="M19 5 5 19" />
    </>
  ),
  mapPin: (
    <>
      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </>
  ),
  sports: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.6 5.6c4 2 6.8 6.7 6.8 12.8M18.4 5.6c-4 2-6.8 6.7-6.8 12.8M3.4 9.3h17.2M3.4 14.7h17.2" />
    </>
  ),
  festival: (
    <>
      <path d="M3 19h18M5 19V9l7-5 7 5v10" />
      <path d="M9 19v-5h6v5M3 9h18" />
    </>
  ),
  theatre: (
    <>
      <path d="M4 5c3.5-1 6.3.1 8 1.8C13.7 5.1 16.5 4 20 5v11c-3.5-1-6.3.1-8 1.8C10.3 16.1 7.5 15 4 16Z" />
      <path d="M8 10h.01M16 10h.01M8 13c1 .8 2 .8 3 0m2 0c1 .8 2 .8 3 0" />
    </>
  ),
  technology: (
    <>
      <rect x="6" y="6" width="12" height="12" />
      <path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4M10 10h4v4h-4z" />
    </>
  ),
  workshop: (
    <>
      <path d="m14 6 4-3 3 3-3 4" />
      <path d="m12 8 4 4-8 8-4 1 1-4Z" />
      <path d="m8 6 10 10" />
    </>
  ),
  business: (
    <>
      <path d="M4 20V4m0 16h17" />
      <path d="m7 15 4-4 3 2 6-7" />
      <path d="M16 6h4v4" />
    </>
  ),
  experience: (
    <>
      <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" />
    </>
  ),
};

export function Icon({
  name,
  size = 18,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
    >
      {ICON_SHAPES[name]}
    </svg>
  );
}
