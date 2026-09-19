/**
 * The portal icon set. Real SVG, drawn on a 16px grid at 1.5px stroke.
 *
 * DESIGN.md tell 7: zero emoji in any portal UI, including status chips, empty
 * states and queue item types. An icon is either drawn here or there is no
 * icon, and most places in this product a number belongs where an icon would
 * otherwise go.
 */

type IconProps = { className?: string; size?: number };

function Svg({ children, className, size = 16 }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {children}
    </svg>
  );
}

export function QueueIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2 4h12M2 8h12M2 12h7" />
    </Svg>
  );
}

export function RosterIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="2" y="3" width="12" height="10" rx="0" />
      <path d="M2 6.5h12M6 6.5V13" />
    </Svg>
  );
}

export function BuilderIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 13V7M8 13V3M13 13v-4" />
    </Svg>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="2" y="3.5" width="12" height="10" rx="0" />
      <path d="M2 6.5h12M5.5 2v3M10.5 2v3" />
    </Svg>
  );
}

export function MessagesIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2.5 3h11v8h-6l-3 2.5V11h-2z" />
    </Svg>
  );
}

export function LibraryIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 2.5v11M6.5 2.5v11M10 3l3.5 10.5" />
    </Svg>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="8" cy="8" r="2.25" />
      <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4" />
    </Svg>
  );
}

/** Trend arrows for the weight column. Direction carries the meaning. */
export function TrendDownIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 3v10M4.5 9.5L8 13l3.5-3.5" />
    </Svg>
  );
}

export function TrendUpIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 13V3M4.5 6.5L8 3l3.5 3.5" />
    </Svg>
  );
}

export function TrendFlatIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 8h10" />
    </Svg>
  );
}

export function SignOutIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 14H3.5v-12H6M10 11l3-3-3-3M13 8H6" />
    </Svg>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M12.95 3.05l-1.06 1.06M4.11 11.89l-1.06 1.06" />
    </Svg>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M13.5 9.5A5.6 5.6 0 0 1 6.5 2.5a5.6 5.6 0 1 0 7 7Z" />
    </Svg>
  );
}
