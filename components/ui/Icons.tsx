/**
 * Profit Dash — MingCute Icon Set
 * Real SVG paths extracted from mingcute.com
 * Fill-based icons, 24×24 viewBox, fillRule="evenodd"
 *
 * Source icons:
 *   dashboard_3_line · target_line · heartbeat_line · wallet_2_line
 *   safe_box_line · settings_2_line · trending_up_line · trending_down_line
 *   pause_circle_line · play_circle_line · lightning_line · refresh_2_line
 *   warning_line · close_circle_line · arrow_right_up_line · right_line
 *   arrow_right_line · search_2_line · fire_line · add_line · close_line
 *   minus_circle_line · calendar_2_line · check_line · notification_line
 *   key_2_line
 */

import React from "react";

interface IconProps {
  size?:        number;
  color?:       string;
  style?:       React.CSSProperties;
  className?:   string;
  opacity?:     number;
  /** Accepted for backwards-compat — ignored (MingCute icons are fill-based) */
  strokeWidth?: number;
}

const D = { size: 16, color: "currentColor" };

function Svg({
  size, color, style, className, opacity, children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size ?? D.size}
      height={size ?? D.size}
      viewBox="0 0 24 24"
      fill="none"
      style={style}
      className={className}
      aria-hidden="true"
    >
      <g
        fill={color ?? D.color}
        fillRule="evenodd"
        clipRule="evenodd"
        opacity={opacity}
      >
        {children}
      </g>
    </svg>
  );
}

// ─── Navigation ───────────────────────────────────────────────────────────────

/** Dashboard gauge — Performance */
export function IconGauge(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 2a9.965 9.965 0 0 1 6.837 2.702l.234.227A9.973 9.973 0 0 1 22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m1 2.062V5a1 1 0 1 1-2 0v-.938A7.96 7.96 0 0 0 7.094 5.68l.663.663a1 1 0 1 1-1.414 1.414l-.663-.663A7.96 7.96 0 0 0 4.062 11H5a1 1 0 1 1 0 2h-.938a8.001 8.001 0 0 0 15.876 0H19a1 1 0 1 1 0-2h.938a7.96 7.96 0 0 0-1.618-3.906l-3.612 3.613a3 3 0 1 1-1.414-1.414l3.612-3.613A7.96 7.96 0 0 0 13 4.062M12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2" />
    </Svg>
  );
}

/** Crosshair target — Execution */
export function IconTarget(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 2c.375 0 .745.02 1.11.061a1 1 0 0 1-.22 1.988 8 8 0 1 0 7.061 7.061 1 1 0 1 1 1.988-.22c.04.365.061.735.061 1.11 0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m-.032 5.877a1 1 0 0 1-.719 1.217A3.002 3.002 0 0 0 12 15a3.002 3.002 0 0 0 2.906-2.25 1 1 0 0 1 1.936.5A5.002 5.002 0 0 1 7 12a5.002 5.002 0 0 1 3.75-4.842 1 1 0 0 1 1.218.719m6.536-5.75a1 1 0 0 1 .617.923v1.83h1.829a1 1 0 0 1 .707 1.707L18.12 10.12a1 1 0 0 1-.707.293H15l-1.828 1.829a1 1 0 0 1-1.415-1.415L13.586 9V6.586a1 1 0 0 1 .293-.707l3.535-3.536a1 1 0 0 1 1.09-.217m-1.383 3.337L15.586 7v1.414H17l1.536-1.535h-.415a1 1 0 0 1-1-1z" />
    </Svg>
  );
}

/** Heartbeat ECG — Analytics */
export function IconActivity(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9.514 3a1 1 0 0 1 .949.73l3.673 13.06 1.928-5.141A1 1 0 0 1 17 11h3a1 1 0 1 1 0 2h-2.307l-2.757 7.351a1 1 0 0 1-1.899-.08L9.45 7.514l-1.496 4.784A1 1 0 0 1 7 13H4a1 1 0 1 1 0-2h2.265l2.28-7.298A1 1 0 0 1 9.516 3Z" />
    </Svg>
  );
}

/** Wallet — Transactions */
export function IconWallet(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 2c.892 0 2.01.113 2.941.428.464.156.95.385 1.336.733.406.365.723.887.723 1.553 0 .642-.294 1.172-.647 1.566a3.86 3.86 0 0 1-.663.581C18.675 8.284 21 11.335 21 15c0 2.556-1.02 4.386-2.766 5.525C16.559 21.617 14.33 22 12 22s-4.56-.383-6.234-1.475C4.02 19.386 3 17.555 3 15c0-3.665 2.325-6.716 5.31-8.139a3.857 3.857 0 0 1-.663-.58C7.294 5.885 7 5.355 7 4.713c0-.666.317-1.188.723-1.553.386-.348.872-.577 1.336-.733C9.99 2.113 11.108 2 12 2m0 6c-3.488 0-7 3.092-7 7 0 1.944.73 3.114 1.859 3.85C8.059 19.633 9.83 20 12 20s3.94-.367 5.141-1.15C18.27 18.114 19 16.944 19 15c0-3.908-3.512-7-7-7m1.947 2.606a1 1 0 0 1 .447 1.341L13.868 13H14a1 1 0 1 1 0 2h-1v.5h1a1 1 0 1 1 0 2h-1v.5a1 1 0 1 1-2 0v-.5h-1a1 1 0 1 1 0-2h1V15h-1a1 1 0 1 1 0-2h.132l-.526-1.053a1 1 0 1 1 1.788-.894l.606 1.21.606-1.21a1 1 0 0 1 1.341-.447M12 4c-.765 0-1.647.101-2.301.322-.33.112-.533.23-.638.325l-.052.055A.14.14 0 0 0 9 4.716l.007.032a.597.597 0 0 0 .13.2c.14.156.375.334.702.503.66.342 1.503.549 2.161.549.658 0 1.502-.207 2.161-.549.327-.169.561-.347.702-.504a.597.597 0 0 0 .13-.199L15 4.716l-.028-.036a.498.498 0 0 0-.033-.033c-.105-.094-.308-.213-.638-.325C13.647 4.102 12.765 4 12 4" />
    </Svg>
  );
}

/** Safe box — Vault */
export function IconVault(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 3a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-1a1 1 0 1 1-2 0H7a1 1 0 1 1-2 0H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm0 2H4v13h16zm-8 2a1 1 0 0 1 1 1v.126a4.002 4.002 0 0 1 2.855 4.945l.109.063a1 1 0 1 1-1 1.732l-.11-.063A3.988 3.988 0 0 1 12 16a3.988 3.988 0 0 1-2.854-1.197l-.11.063a1 1 0 1 1-1-1.732l.109-.063A4.004 4.004 0 0 1 11 8.126V8a1 1 0 0 1 1-1m0 3a2 2 0 0 0-1.818 2.836l.094.178a1.999 1.999 0 0 0 3.359.138l.11-.174A2 2 0 0 0 12 10" />
    </Svg>
  );
}

/** Sliders — Settings */
export function IconSliders(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M18 4a1 1 0 1 0-2 0v1H4a1 1 0 0 0 0 2h12v1a1 1 0 1 0 2 0V7h2a1 1 0 1 0 0-2h-2zM4 11a1 1 0 1 0 0 2h2v1a1 1 0 1 0 2 0v-1h12a1 1 0 1 0 0-2H8v-1a1 1 0 0 0-2 0v1zm-1 7a1 1 0 0 1 1-1h12v-1a1 1 0 1 1 2 0v1h2a1 1 0 1 1 0 2h-2v1a1 1 0 1 1-2 0v-1H4a1 1 0 0 1-1-1" />
    </Svg>
  );
}

// ─── Dashboard actions ────────────────────────────────────────────────────────

/** Trending up */
export function IconTrendingUp(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M17 6a1 1 0 1 0 0 2h1.586L14 12.586l-3.793-3.793a1 1 0 0 0-1.414 0l-6.5 6.5a1 1 0 1 0 1.414 1.414L9.5 10.914l3.793 3.793a1 1 0 0 0 1.414 0L20 9.414V11a1 1 0 1 0 2 0V7a1 1 0 0 0-1-1h-4Z" />
    </Svg>
  );
}

/** Trending down */
export function IconTrendingDown(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M18.586 16H17a1 1 0 1 0 0 2h4a1 1 0 0 0 1-1v-4a1 1 0 1 0-2 0v1.586l-5.293-5.293a1 1 0 0 0-1.414 0L9.5 13.086 3.707 7.293a1 1 0 0 0-1.414 1.414l6.5 6.5a1 1 0 0 0 1.414 0L14 11.414 18.586 16Z" />
    </Svg>
  );
}

/** Pause circle */
export function IconPause(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16m-2 4a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0V9a1 1 0 0 1 1-1m4 0a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0V9a1 1 0 0 1 1-1" />
    </Svg>
  );
}

/** Play circle */
export function IconPlay(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16M8.964 8.65a1.192 1.192 0 0 1 1.654-.953l.325.143.44.202.349.169.39.196.43.223.462.251.494.28.249.145.469.282.428.268.564.368.464.318.455.328.083.061c.635.477.64 1.429.001 1.909l-.283.209-.393.276-.496.335-.387.25-.43.27-.473.283c-.082.049-.166.098-.252.147l-.498.282-.466.253-.43.224-.39.196-.505.242-.4.181-.202.088a1.192 1.192 0 0 1-1.651-.954l-.054-.499-.03-.334-.042-.599-.024-.46-.018-.506-.01-.549v-.579l.01-.548.018-.506.024-.46.042-.599.071-.73zm1.884 1.355-.027.467-.021.525-.012.58v.618l.012.58.02.525.028.467.416-.21.226-.118.488-.262.53-.299.522-.309.242-.148.444-.28.39-.255-.392-.257-.444-.281-.496-.3a29.503 29.503 0 0 0-.793-.453l-.488-.262-.442-.227z" />
    </Svg>
  );
}

/** Lightning bolt */
export function IconZap(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m9.65 4-3.111 7h3.447c.69 0 1.176.675.958 1.33l-1.656 4.967L16.586 10h-2.57a1.01 1.01 0 0 1-.903-1.462L15.382 4zM8.084 2.6c.162-.365.523-.6.923-.6h7.977c.75 0 1.239.79.903 1.462L15.618 8h3.358c.9 0 1.35 1.088.714 1.724L7.737 21.677c-.754.754-2.01-.022-1.672-1.033L8.613 13H5.015a1.01 1.01 0 0 1-.923-1.42z" />
    </Svg>
  );
}

/** Refresh */
export function IconRefresh(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2 12.08c-.006-.862.91-1.356 1.618-.975l.095.058 2.678 1.804c.972.655.377 2.143-.734 2.007l-.117-.02-1.063-.234a8.002 8.002 0 0 0 14.804.605 1 1 0 0 1 1.82.828c-1.987 4.37-6.896 6.793-11.687 5.509A10.003 10.003 0 0 1 2 12.08m.903-4.228C4.89 3.482 9.799 1.06 14.59 2.343a10.002 10.002 0 0 1 7.414 9.581c.007.863-.91 1.358-1.617.976l-.096-.058-2.678-1.804c-.972-.655-.377-2.143.734-2.007l.117.02 1.063.234A8.002 8.002 0 0 0 4.723 8.68a1 1 0 1 1-1.82-.828" />
    </Svg>
  );
}

/** Warning / info circle */
export function IconWarning(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16m0 11a1 1 0 1 1 0 2 1 1 0 0 1 0-2m0-9a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0V7a1 1 0 0 1 1-1" />
    </Svg>
  );
}

/** Close circle */
export function IconXCircle(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16M9.879 8.464 12 10.586l2.121-2.122a1 1 0 1 1 1.415 1.415l-2.122 2.12 2.122 2.122a1 1 0 0 1-1.415 1.415L12 13.414l-2.121 2.122a1 1 0 0 1-1.415-1.415L10.586 12 8.465 9.879a1 1 0 0 1 1.414-1.415" />
    </Svg>
  );
}

/** Arrow up-right */
export function IconArrowUpRight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M18 5a1 1 0 0 1 1 1v8a1 1 0 1 1-2 0V8.414l-9.95 9.95a1 1 0 0 1-1.414-1.414L15.586 7H10a1 1 0 1 1 0-2h8Z" />
    </Svg>
  );
}

/** Chevron right */
export function IconChevronRight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M15.707 11.293a1 1 0 0 1 0 1.414l-5.657 5.657a1 1 0 1 1-1.414-1.414l4.95-4.95-4.95-4.95a1 1 0 0 1 1.414-1.414l5.657 5.657Z" />
    </Svg>
  );
}

/** Arrow right */
export function IconArrowRight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m14.707 5.636 5.657 5.657a1 1 0 0 1 0 1.414l-5.657 5.657a1 1 0 0 1-1.414-1.414l3.95-3.95H4a1 1 0 1 1 0-2h13.243l-3.95-3.95a1 1 0 1 1 1.414-1.414Z" />
    </Svg>
  );
}

/** Search */
export function IconSearch(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 10a5 5 0 1 1 10 0 5 5 0 0 1-10 0m5-7a7 7 0 1 0 4.192 12.606l5.1 5.101a1 1 0 0 0 1.415-1.414l-5.1-5.1A7 7 0 0 0 10 3" />
    </Svg>
  );
}

/** Flame / fire */
export function IconFlame(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m10.255 1.387 1.26.756a8.146 8.146 0 0 1 3.48 4.144c.222-.5.486-.985.731-1.475l.981.981C18.909 7.995 21 11.295 21 14.5c0 4.298-2.65 7.023-6.89 7.494l-1.39.154.304-1.365c.237-1.068.28-1.766.23-2.255-.06-.615-.352-1.098-.716-1.578-.348-.46-.693-.921-.969-1.43-1.135.897-1.575 1.707-1.716 2.374-.18.854.075 1.727.541 2.659l.822 1.644-1.826-.203c-2.576-.286-5.114-2.007-6.114-4.518-1.045-2.627-.306-5.806 3.07-8.732 2.24-1.941 3.426-4.458 3.909-7.357m1.332 3.3c-.762 2.14-2.225 4.09-3.932 5.569-2.911 2.523-3.172 4.844-2.52 6.48.485 1.22 1.532 2.223 2.773 2.792a4.97 4.97 0 0 1-.012-2.046c.326-1.546 1.4308-2.995 3.574-4.33l1.077-.673.402 1.205c.352 1.056 1.082 1.803 1.653 2.73.628 1.02.748 2.19.62 3.358C17.842 19.117 19 17.13 19 14.5c0-2.222-1.34-4.402-2.67-6.106-.548 1.228-1.703 1.66-2.83 2.224V9c0-1.369-.557-3.038-1.913-4.312Z" />
    </Svg>
  );
}

/** Plus / add */
export function IconPlus(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M11 20a1 1 0 1 0 2 0v-7h7a1 1 0 1 0 0-2h-7V4a1 1 0 1 0-2 0v7H4a1 1 0 1 0 0 2h7z" />
    </Svg>
  );
}

/** X / close */
export function IconX(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m12 13.414 5.657 5.657a1 1 0 0 0 1.414-1.414L13.414 12l5.657-5.657a1 1 0 0 0-1.414-1.414L12 10.586 6.343 4.929A1 1 0 0 0 4.93 6.343L10.586 12l-5.657 5.657a1 1 0 1 0 1.414 1.414z" />
    </Svg>
  );
}

/** Minus circle */
export function IconMinus(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16m4 7a1 1 0 0 1 .117 1.993L16 13H8a1 1 0 0 1-.117-1.993L8 11z" />
    </Svg>
  );
}

/** Calendar */
export function IconCalendar(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M16 3a1 1 0 0 1 1 1v1h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2V4a1 1 0 0 1 2 0v1h6V4a1 1 0 0 1 1-1M8 7H5v2h14V7h-3zm-3 4v8h14v-8zm2 2a1 1 0 0 1 1-1h.01a1 1 0 1 1 0 2H8a1 1 0 0 1-1-1m1 2a1 1 0 1 0 0 2h.01a1 1 0 1 0 0-2zm3-2a1 1 0 0 1 1-1h.01a1 1 0 1 1 0 2H12a1 1 0 0 1-1-1m1 2a1 1 0 1 0 0 2h.01a1 1 0 1 0 0-2zm3-2a1 1 0 0 1 1-1h.01a1 1 0 1 1 0 2H16a1 1 0 0 1-1-1m1 2a1 1 0 1 0 0 2h.01a1 1 0 1 0 0-2z" />
    </Svg>
  );
}

/** Check */
export function IconCheck(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M21.192 5.465a1 1 0 0 1 0 1.414L9.95 18.122a1.1 1.1 0 0 1-1.556 0l-5.586-5.586a1 1 0 1 1 1.415-1.415l4.95 4.95L19.777 5.465a1 1 0 0 1 1.414 0Z" />
    </Svg>
  );
}

/** Bell / notification */
export function IconBell(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 9a7 7 0 0 1 14 0v3.764l1.822 3.644A1.1 1.1 0 0 1 19.838 18h-3.964a4.002 4.002 0 0 1-7.748 0H4.162a1.1 1.1 0 0 1-.984-1.592L5 12.764zm5.268 9a2 2 0 0 0 3.464 0zM12 4a5 5 0 0 0-5 5v3.764a2 2 0 0 1-.211.894L5.619 16h12.763l-1.17-2.342a2.001 2.001 0 0 1-.212-.894V9a5 5 0 0 0-5-5" />
    </Svg>
  );
}

/** Key */
export function IconKey(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M11.852 5.782a4.5 4.5 0 1 1 1.388 7.31 2.102 2.102 0 0 0-.837-.178H11.04c-.69 0-1.25.56-1.25 1.25v1.578H8.213c-.69 0-1.25.56-1.25 1.25v1.578H4.72v-1.414l5.356-5.355c.544-.544.68-1.296.55-1.931a4.495 4.495 0 0 1 1.226-4.088m7.778-1.414A6.5 6.5 0 0 0 8.666 10.27a.21.21 0 0 1-.006.118l-5.5 5.5a1.5 1.5 0 0 0-.44 1.061v2.611c0 .558.452 1.01 1.01 1.01h3.983c.69 0 1.25-.56 1.25-1.25v-1.578h1.578c.69 0 1.25-.56 1.25-1.25v-1.578h.61c.002 0 .016.002.042.013a6.502 6.502 0 0 0 7.187-10.56Zm-4.95 4.95a1.5 1.5 0 1 0 2.122-2.122 1.5 1.5 0 0 0-2.122 2.121Z" />
    </Svg>
  );
}

/** Brain — Decision Rules (Lucide brain, stroke-based) */
export function IconBrain({ size, color, style, className, opacity }: IconProps) {
  const sz   = size  ?? D.size;
  const clr  = color ?? D.color;
  return (
    <svg
      width={sz} height={sz} viewBox="0 0 24 24"
      fill="none" stroke={clr} strokeWidth={1.6}
      strokeLinecap="round" strokeLinejoin="round"
      style={style} className={className}
      opacity={opacity} aria-hidden="true"
    >
      <path d="M12 18V5" />
      <path d="M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4" />
      <path d="M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5" />
      <path d="M17.997 5.125a4 4 0 0 1 2.526 5.77" />
      <path d="M18 18a4 4 0 0 0 2-7.464" />
      <path d="M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517" />
      <path d="M6 18a4 4 0 0 1-2-7.464" />
      <path d="M6.003 5.125a4 4 0 0 0-2.526 5.77" />
    </svg>
  );
}

// ─── Aliases / extras ─────────────────────────────────────────────────────────

/** Loader (uses refresh icon) */
export function IconLoader(props: IconProps) {
  return <IconRefresh {...props} />;
}

/** Alert circle (uses warning) */
export function IconAlertCircle(props: IconProps) {
  return <IconWarning {...props} />;
}

/** Check circle (uses check) */
export function IconCheckCircle(props: IconProps) {
  return <IconCheck {...props} />;
}

/** Unplug (uses close circle) */
export function IconUnplug(props: IconProps) {
  return <IconXCircle {...props} />;
}
