/**
 * Profit Dash — Custom Icon Set
 * Inspired by Phosphor Icons (phosphoricons.com) — thin, precise, Apple SF Symbols aesthetic
 * 24×24 viewBox, stroke-based, round caps/joins
 */

import React from "react";

interface IconProps {
  size?:        number;
  color?:       string;
  strokeWidth?: number;
  style?:       React.CSSProperties;
  className?:   string;
}

const defaults = {
  size:        16,
  color:       "currentColor",
  strokeWidth: 1.4,
};

function Svg({ size, color, strokeWidth, style, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size ?? defaults.size}
      height={size ?? defaults.size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? defaults.color}
      strokeWidth={strokeWidth ?? defaults.strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

// ─── Navigation ───────────────────────────────────────────────────────────────

/** Speedometer / gauge — Performance */
export function IconGauge(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Z" />
      <path d="M12 12 8.5 8.5" />
      <circle cx="12" cy="12" r="1.2" fill={props.color ?? "currentColor"} stroke="none" />
      <path d="M7 14.5a5.5 5.5 0 0 1 .9-3" opacity=".4" />
      <path d="M17 14.5a5.5 5.5 0 0 0-.9-3" opacity=".4" />
      <path d="M9.5 7.8a5.5 5.5 0 0 1 5 0" opacity=".4" />
    </Svg>
  );
}

/** Crosshair / target — Execution */
export function IconTarget(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="7.5" />
      <line x1="12" y1="2" x2="12" y2="4.5" />
      <line x1="12" y1="19.5" x2="12" y2="22" />
      <line x1="2" y1="12" x2="4.5" y2="12" />
      <line x1="19.5" y1="12" x2="22" y2="12" />
    </Svg>
  );
}

/** Pulse / ECG line — Analytics */
export function IconActivity(props: IconProps) {
  return (
    <Svg {...props}>
      <polyline points="2,13 6,13 8,6 10,20 13,9 15,16 17,13 22,13" />
    </Svg>
  );
}

/** Minimal wallet — Transactions */
export function IconWallet(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="2" y="6" width="20" height="14" rx="2.5" />
      <path d="M16 13a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z" fill={props.color ?? "currentColor"} stroke="none" opacity=".7" />
      <path d="M2 10h20" />
      <path d="M6 6V4.5a1.5 1.5 0 0 1 1.5-1.5h9A1.5 1.5 0 0 1 18 4.5V6" opacity=".5" />
    </Svg>
  );
}

/** Safe / vault door — Vault */
export function IconVault(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="2" y="3" width="20" height="18" rx="2.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1.5" />
      <line x1="12" y1="8" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="16" />
      <line x1="8" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="16" y2="12" />
      <line x1="6" y1="21" x2="6" y2="19" opacity=".5" />
      <line x1="18" y1="21" x2="18" y2="19" opacity=".5" />
    </Svg>
  );
}

/** Horizontal sliders — Settings */
export function IconSliders(props: IconProps) {
  return (
    <Svg {...props}>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
      <circle cx="8" cy="6" r="2" fill={props.color ?? "currentColor"} stroke="none" />
      <circle cx="16" cy="12" r="2" fill={props.color ?? "currentColor"} stroke="none" />
      <circle cx="10" cy="18" r="2" fill={props.color ?? "currentColor"} stroke="none" />
    </Svg>
  );
}

// ─── Dashboard actions ────────────────────────────────────────────────────────

/** Trending up arrow */
export function IconTrendingUp(props: IconProps) {
  return (
    <Svg {...props}>
      <polyline points="3,17 9,11 13,15 21,7" />
      <polyline points="15,7 21,7 21,13" />
    </Svg>
  );
}

/** Trending down arrow */
export function IconTrendingDown(props: IconProps) {
  return (
    <Svg {...props}>
      <polyline points="3,7 9,13 13,9 21,17" />
      <polyline points="15,17 21,17 21,11" />
    </Svg>
  );
}

/** Pause — two rounded bars */
export function IconPause(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="6" y="4.5" width="3.5" height="15" rx="1.75" />
      <rect x="14.5" y="4.5" width="3.5" height="15" rx="1.75" />
    </Svg>
  );
}

/** Play — filled triangle */
export function IconPlay(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 3.5 L20 12 L5 20.5 Z" />
    </Svg>
  );
}

/** Lightning bolt / Zap */
export function IconZap(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M13 2 L4 13 H11 L10.5 22 L20 11 H13 Z" />
    </Svg>
  );
}

/** Circular arrow / refresh */
export function IconRefresh(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M21 12a9 9 0 1 1-2.1-5.8" />
      <polyline points="21 3 21 8.5 15.5 8.5" />
    </Svg>
  );
}

/** Warning triangle */
export function IconWarning(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M10.3 3.6 L2 20 H22 L13.7 3.6 a2 2 0 0 0-3.4 0Z" />
      <line x1="12" y1="10" x2="12" y2="14.5" />
      <circle cx="12" cy="17.5" r="0.8" fill={props.color ?? "currentColor"} stroke="none" />
    </Svg>
  );
}

/** Circle with X */
export function IconXCircle(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="9" y1="9" x2="15" y2="15" />
      <line x1="15" y1="9" x2="9" y2="15" />
    </Svg>
  );
}

/** Arrow up-right */
export function IconArrowUpRight(props: IconProps) {
  return (
    <Svg {...props}>
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7,7 17,7 17,17" />
    </Svg>
  );
}

/** Chevron right */
export function IconChevronRight(props: IconProps) {
  return (
    <Svg {...props}>
      <polyline points="9,5 16,12 9,19" />
    </Svg>
  );
}

/** Arrow right */
export function IconArrowRight(props: IconProps) {
  return (
    <Svg {...props}>
      <line x1="4" y1="12" x2="20" y2="12" />
      <polyline points="14,6 20,12 14,18" />
    </Svg>
  );
}

/** Magnifying glass / search */
export function IconSearch(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="10.5" cy="10.5" r="7" />
      <line x1="16" y1="16" x2="21" y2="21" />
    </Svg>
  );
}

/** Flame / fire — streak */
export function IconFlame(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 22c4 0 7-3.1 7-7 0-2.5-1.2-4-2.5-5.5C15 8 15 6 15.5 4c-2 1-3.5 3-3.5 3s-.5-2-2-3.5C9.5 5.5 9 8 9 8S7 6.5 6.5 5C5 7 5 9 5 11c0 1.5.4 2.8 1 3.9" />
      <path d="M12 22c2 0 4-1.5 4-4 0-1.5-.8-2.5-1.5-3.5-.5-.8-.5-1.8 0-2.5-1 .5-2 1.5-2 1.5s-.3-1-1-2c-.8 1.2-1 2.5-1 3 0 .8.2 1.5.5 2.1" />
    </Svg>
  );
}

/** Plus */
export function IconPlus(props: IconProps) {
  return (
    <Svg {...props}>
      <line x1="12" y1="4" x2="12" y2="20" />
      <line x1="4" y1="12" x2="20" y2="12" />
    </Svg>
  );
}

/** X / close */
export function IconX(props: IconProps) {
  return (
    <Svg {...props}>
      <line x1="5" y1="5" x2="19" y2="19" />
      <line x1="19" y1="5" x2="5" y2="19" />
    </Svg>
  );
}

/** Minus */
export function IconMinus(props: IconProps) {
  return (
    <Svg {...props}>
      <line x1="4" y1="12" x2="20" y2="12" />
    </Svg>
  );
}

/** Calendar */
export function IconCalendar(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="5" width="18" height="17" rx="2.5" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
    </Svg>
  );
}

/** Check */
export function IconCheck(props: IconProps) {
  return (
    <Svg {...props}>
      <polyline points="4,12 9,17 20,6" />
    </Svg>
  );
}

/** Bell / notification */
export function IconBell(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 10a6 6 0 0 1 12 0c0 5 2 7 2 7H4s2-2 2-7Z" />
      <path d="M10.3 21a2 2 0 0 0 3.4 0" />
    </Svg>
  );
}

/** Key */
export function IconKey(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="7.5" cy="14.5" r="4.5" />
      <path d="M10.5 11.5 L20 3" />
      <line x1="18" y1="5" x2="21" y2="8" />
      <line x1="15" y1="8" x2="17.5" y2="10.5" />
    </Svg>
  );
}

/** Unplug / disconnect */
export function IconUnplug(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1.5 1.5" />
      <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1.5-1.5" />
      <line x1="2" y1="2" x2="22" y2="22" opacity=".3" />
    </Svg>
  );
}

/** Check circle */
export function IconCheckCircle(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="7,12 10,15 17,8" />
    </Svg>
  );
}

/** Alert circle */
export function IconAlertCircle(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="13" />
      <circle cx="12" cy="16.5" r="0.8" fill={props.color ?? "currentColor"} stroke="none" />
    </Svg>
  );
}

/** Loader / spinner (animated via CSS) */
export function IconLoader(props: IconProps) {
  return (
    <Svg {...props}>
      <line x1="12" y1="2" x2="12" y2="6" opacity="1" />
      <line x1="16.24" y1="3.76" x2="13.41" y2="6.59" opacity=".87" />
      <line x1="18" y1="7.76" x2="15.17" y2="9.17" opacity=".75" />
      <line x1="21.66" y1="12" x2="17.66" y2="12" opacity=".62" />
      <line x1="20.24" y1="16.24" x2="17.41" y2="13.41" opacity=".5" />
      <line x1="16" y1="20.24" x2="14.59" y2="17.41" opacity=".37" />
      <line x1="12" y1="22" x2="12" y2="18" opacity=".25" />
      <line x1="7.76" y1="20.24" x2="9.17" y2="17.41" opacity=".12" />
    </Svg>
  );
}
