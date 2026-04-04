"use client";

import { motion } from "framer-motion";
import Link from "next/link";

// ─── Tone palette ─────────────────────────────────────────────────────────────

const TONES = {
  violet:  { badge: { border: "rgba(167,139,250,0.22)", bg: "rgba(139,92,246,0.09)",  text: "rgba(221,214,254,0.9)" } },
  emerald: { badge: { border: "rgba(52,211,153,0.20)",  bg: "rgba(16,185,129,0.08)",  text: "rgba(167,243,208,0.9)" } },
  sky:     { badge: { border: "rgba(56,189,248,0.20)",  bg: "rgba(14,165,233,0.08)",  text: "rgba(186,230,253,0.9)" } },
  amber:   { badge: { border: "rgba(251,191,36,0.20)",  bg: "rgba(245,158,11,0.08)",  text: "rgba(253,230,138,0.9)" } },
  rose:    { badge: { border: "rgba(252,165,165,0.20)", bg: "rgba(244,63,94,0.08)",   text: "rgba(254,205,211,0.9)" } },
  white:   { badge: { border: "rgba(255,255,255,0.12)", bg: "rgba(255,255,255,0.05)", text: "rgba(255,255,255,0.65)" } },
} as const;

export type EmptyTone = keyof typeof TONES;

// ─── Props ────────────────────────────────────────────────────────────────────

interface EmptyStateCardProps {
  /** Tone used for the badge */
  tone: EmptyTone;
  /** Small badge label */
  badge: string;
  /** Main title */
  title: string;
  /** Body description */
  text: string;
  /** Primary CTA label */
  cta1: string;
  /** Primary CTA href (optional, otherwise onClick) */
  cta1Href?: string;
  cta1Click?: () => void;
  /** Secondary CTA label (optional) */
  cta2?: string;
  cta2Href?: string;
  cta2Click?: () => void;
  /** Right-side preview content */
  preview?: React.ReactNode;
  /** Stagger delay for animation */
  delay?: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EmptyStateCard({
  tone, badge, title, text,
  cta1, cta1Href, cta1Click,
  cta2, cta2Href, cta2Click,
  preview,
  delay = 0,
}: EmptyStateCardProps) {
  const t = TONES[tone];

  const PrimaryCTA = () => {
    const style: React.CSSProperties = {
      borderRadius: 16, border: "none",
      background: "linear-gradient(90deg, #ec4899, #8b5cf6, #6366f1)",
      padding: "12px 22px", fontSize: 14, fontWeight: 600, color: "#fff",
      boxShadow: "0 14px 35px rgba(139,92,246,0.32)",
      cursor: "pointer", fontFamily: "inherit",
      display: "inline-block", textDecoration: "none",
      lineHeight: 1, whiteSpace: "nowrap" as const,
    };
    if (cta1Href) return <Link href={cta1Href} style={style}>{cta1}</Link>;
    return <button onClick={cta1Click} style={style}>{cta1}</button>;
  };

  const SecondaryCTA = () => {
    if (!cta2) return null;
    const style: React.CSSProperties = {
      borderRadius: 16,
      border: "1px solid rgba(255,255,255,0.10)",
      background: "rgba(255,255,255,0.03)",
      padding: "12px 18px", fontSize: 14, color: "rgba(255,255,255,0.70)",
      cursor: "pointer", fontFamily: "inherit",
      display: "inline-block", textDecoration: "none",
      lineHeight: 1, whiteSpace: "nowrap" as const,
    };
    if (cta2Href) return <Link href={cta2Href} style={style}>{cta2}</Link>;
    return <button onClick={cta2Click} style={style}>{cta2}</button>;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0,  filter: "blur(0px)" }}
      transition={{ duration: 0.5, delay, ease: [0.23, 1, 0.32, 1] }}
      style={{
        borderRadius: 30,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "linear-gradient(180deg, rgba(16,17,25,0.98), rgba(10,11,17,0.98))",
        overflow: "hidden",
      }}
    >
      <div style={{
        display: "grid",
        gridTemplateColumns: preview ? "0.95fr 1.05fr" : "1fr",
        minHeight: 300,
      }}>
        {/* Left — text + CTAs */}
        <div style={{
          padding: "32px",
          borderRight: preview ? "1px solid rgba(255,255,255,0.06)" : "none",
          display: "flex", flexDirection: "column", justifyContent: "space-between",
        }}>
          <div>
            {/* Badge */}
            <div style={{
              display: "inline-flex", borderRadius: 999,
              border: `1px solid ${t.badge.border}`,
              background: t.badge.bg,
              padding: "5px 14px",
              fontSize: 10, textTransform: "uppercase", letterSpacing: "0.22em",
              color: t.badge.text,
            }}>
              {badge}
            </div>

            {/* Title */}
            <div style={{
              marginTop: 22, fontSize: 32, letterSpacing: "-0.045em",
              fontWeight: 300, lineHeight: 1.12, maxWidth: "16ch",
              color: "rgba(255,255,255,0.92)",
            }}>
              {title}
            </div>

            {/* Body */}
            <div style={{
              marginTop: 16, fontSize: 14, lineHeight: 1.75,
              color: "rgba(255,255,255,0.42)", maxWidth: "56ch", fontWeight: 300,
            }}>
              {text}
            </div>
          </div>

          {/* CTAs */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 28, flexWrap: "wrap" }}>
            <PrimaryCTA />
            <SecondaryCTA />
          </div>
        </div>

        {/* Right — preview */}
        {preview && (
          <div style={{
            padding: "32px",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "radial-gradient(circle at 50% 35%, rgba(255,255,255,0.025), transparent 34%)",
          }}>
            {preview}
          </div>
        )}
      </div>
    </motion.div>
  );
}
