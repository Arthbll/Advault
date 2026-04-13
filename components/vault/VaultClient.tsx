"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useMotionValue } from "framer-motion";
import {
  Plus, RefreshCw, ExternalLink,
  PauseCircle, PlayCircle, Search, AlertCircle,
  ChevronDown, X, Copy, Check, Film,
  Image as ImageIcon, Video, Smile, Link2,
  ChevronLeft, Trash2, ArrowUpRight,
} from "lucide-react";
import EmptyStateCard from "@/components/ui/EmptyStateCard";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Campaign {
  id: string; name: string; externalId: string; status: string; createdAt: string;
}
interface Variation {
  id: string | number; url: string;
  status: "active" | "paused" | "pending" | "rejected"; statusLabel: string;
}
interface MediaAsset {
  id: string; name: string; url: string;
  type: "image" | "video" | "gif"; size?: string;
}
interface Stats {
  total: number; active: number; paused: number; pending: number; rejected: number;
}
type FolderKey = "photos" | "gifs" | "videos" | "urls";

// ─── Constants ────────────────────────────────────────────────────────────────
const S = {
  active:   { label: "Active",   color: "#4ade80", rgb: "74,222,128"   },
  paused:   { label: "Paused",   color: "#fbbf24", rgb: "251,191,36"   },
  pending:  { label: "Pending",  color: "#a78bfa", rgb: "167,139,250"  },
  rejected: { label: "Rejected", color: "#f87171", rgb: "248,113,113"  },
} as const;

const FOLDERS = {
  photos: { label: "Photos",    Icon: ImageIcon, badge: "Creative assets",  color: "rgba(14,165,233,0.08)",  border: "rgba(56,189,248,0.16)",  text: "rgba(186,230,253,1)",  note: "Banners, halfpages, leaderboards"          },
  gifs:   { label: "GIFs",      Icon: Smile,     badge: "Motion creatives", color: "rgba(245,158,11,0.08)",  border: "rgba(251,191,36,0.16)",  text: "rgba(253,230,138,1)",  note: "Short loops for native and display"        },
  videos: { label: "Videos",    Icon: Video,     badge: "Video assets",     color: "rgba(139,92,246,0.08)",  border: "rgba(167,139,250,0.16)", text: "rgba(221,214,254,1)",  note: "In-video, interstitial, preview clips"     },
  urls:   { label: "URLs",      Icon: Link2,     badge: "Landing routes",   color: "rgba(16,185,129,0.08)",  border: "rgba(52,211,153,0.16)",  text: "rgba(167,243,208,1)",  note: "Offer links, rotators, destination variants" },
} as const;

const LABEL: React.CSSProperties = {
  fontSize: 10, fontWeight: 600,
  textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.28)",
};

// ─── Demo data ────────────────────────────────────────────────────────────────
const DEMO_MEDIA: MediaAsset[] = [
  { id: "m1",  name: "banner_728x90.jpg",    url: "https://picsum.photos/seed/adv1/400/160",  type: "image", size: "42 KB"  },
  { id: "m2",  name: "square_300x250.jpg",   url: "https://picsum.photos/seed/adv2/300/250",  type: "image", size: "28 KB"  },
  { id: "m3",  name: "interstitial.png",     url: "https://picsum.photos/seed/adv3/320/480",  type: "image", size: "95 KB"  },
  { id: "m4",  name: "halfpage_300x600.jpg", url: "https://picsum.photos/seed/adv9/250/400",  type: "image", size: "52 KB"  },
  { id: "m5",  name: "leaderboard.jpg",      url: "https://picsum.photos/seed/adv6/400/100",  type: "image", size: "38 KB"  },
  { id: "m6",  name: "animated_300x250.gif", url: "https://picsum.photos/seed/adv5/300/250",  type: "gif",   size: "1.1 MB" },
  { id: "m7",  name: "mobile_320x50.gif",    url: "https://picsum.photos/seed/adv8/320/160",  type: "gif",   size: "640 KB" },
  { id: "m8",  name: "banner_gif_320.gif",   url: "https://picsum.photos/seed/adv11/300/250", type: "gif",   size: "820 KB" },
  { id: "m9",  name: "promo_video_15s.mp4",  url: "",                                         type: "video", size: "2.4 MB" },
  { id: "m10", name: "video_30s.mp4",        url: "",                                         type: "video", size: "8.2 MB" },
  { id: "m11", name: "teaser_10s.mp4",       url: "",                                         type: "video", size: "1.8 MB" },
];

const DEMO_VARIATIONS: Variation[] = [
  { id: "d1",  url: "https://www.nutaku.net/games/",        status: "active",   statusLabel: "Active"  },
  { id: "d2",  url: "https://www.crakrevenue.com/offers/",  status: "active",   statusLabel: "Active"  },
  { id: "d3",  url: "https://www.maxbounty.com/",           status: "pending",  statusLabel: "Pending" },
  { id: "d4",  url: "https://www.adultfriendfinder.com/",   status: "active",   statusLabel: "Active"  },
  { id: "d5",  url: "https://www.cpagrip.com/offers.php",   status: "paused",   statusLabel: "Paused"  },
  { id: "d6",  url: "https://www.clickbank.com/",           status: "active",   statusLabel: "Active"  },
  { id: "d7",  url: "https://www.digistore24.com/",         status: "rejected", statusLabel: "Rejected" },
  { id: "d8",  url: "https://www.shareasale.com/",          status: "active",   statusLabel: "Active"  },
  { id: "d9",  url: "https://www.panthera.com/",            status: "pending",  statusLabel: "Pending" },
  { id: "d10", url: "https://www.affiliaxe.com/offers/",    status: "active",   statusLabel: "Active"  },
  { id: "d11", url: "https://www.impact.com/",              status: "paused",   statusLabel: "Paused"  },
  { id: "d12", url: "https://www.jvzoo.com/",               status: "active",   statusLabel: "Active"  },
];

const PAGE = 25;

// ─── Shared button styles ─────────────────────────────────────────────────────
const GHOST_BTN: React.CSSProperties = {
  borderRadius: 16, border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.03)", padding: "10px 16px",
  fontSize: 14, color: "rgba(255,255,255,0.70)", cursor: "pointer",
};
const PRIMARY_BTN: React.CSSProperties = {
  borderRadius: 16, border: "none",
  background: "linear-gradient(90deg,#ec4899,#8b5cf6,#6366f1)",
  padding: "10px 20px", fontSize: 14, fontWeight: 600, color: "#fff", cursor: "pointer",
  boxShadow: "0 14px 35px rgba(139,92,246,0.35)",
};

// ─── MagneticButton ───────────────────────────────────────────────────────────
function MagneticButton({ children, style, onClick, disabled }: {
  children: React.ReactNode; style: React.CSSProperties;
  onClick: () => void; disabled?: boolean;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  return (
    <motion.button ref={ref} style={{ ...style, x, y }}
      onMouseMove={e => {
        const r = ref.current!.getBoundingClientRect();
        x.set((e.clientX - r.left - r.width  / 2) * 0.3);
        y.set((e.clientY - r.top  - r.height / 2) * 0.3);
      }}
      onMouseLeave={() => { x.set(0); y.set(0); }}
      onClick={onClick} disabled={disabled} whileTap={{ scale: 0.96 }}
    >
      {children}
    </motion.button>
  );
}

// ─── FolderCard ───────────────────────────────────────────────────────────────
function FolderCard({
  folderKey, count, i, onClick,
}: {
  folderKey: FolderKey; count: number; i: number; onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const f = FOLDERS[folderKey];

  const accentColors: Record<FolderKey, string> = {
    photos: "linear-gradient(135deg, rgba(56,189,248,0.18), transparent)",
    gifs:   "linear-gradient(135deg, rgba(251,191,36,0.18), transparent)",
    videos: "linear-gradient(135deg, rgba(167,139,250,0.18), transparent)",
    urls:   "linear-gradient(135deg, rgba(52,211,153,0.18), transparent)",
  };

  const countLabels: Record<FolderKey, string> = {
    photos: count === 1 ? "asset"      : "assets",
    gifs:   count === 1 ? "loop"       : "loops",
    videos: count === 1 ? "clip"       : "clips",
    urls:   count === 1 ? "variation"  : "variations",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: i * 0.07 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        borderRadius: 26, border: `1px solid ${hovered ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.08)"}`,
        background: hovered
          ? "linear-gradient(180deg, rgba(19,21,30,0.99), rgba(14,15,22,0.99))"
          : "linear-gradient(180deg, rgba(17,18,25,0.98), rgba(12,13,19,0.98))",
        padding: 20, minHeight: 230,
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        position: "relative", overflow: "hidden",
        boxShadow: hovered ? "0 20px 56px rgba(0,0,0,0.28)" : "0 16px 40px rgba(0,0,0,0.18)",
        cursor: "pointer", transition: "all 0.22s ease",
      }}
    >
      {/* Color accent */}
      <div style={{ position: "absolute", inset: 0, background: accentColors[folderKey], pointerEvents: "none" }} />

      {/* Top */}
      <div style={{ position: "relative" }}>
        {/* Badge */}
        <div style={{
          display: "inline-flex", borderRadius: 999, padding: "6px 12px",
          fontSize: 10, textTransform: "uppercase" as const, letterSpacing: "0.22em",
          border: `1px solid ${f.border}`, background: f.color, color: f.text,
        }}>
          {f.badge}
        </div>
        <div style={{ marginTop: 20, fontSize: 28, letterSpacing: "-0.04em", fontWeight: 300, color: "rgba(255,255,255,0.92)" }}>
          {f.label}
        </div>
        <div style={{ marginTop: 8, color: "rgba(255,255,255,0.36)", fontSize: 14, lineHeight: 1.5 }}>
          {f.note}
        </div>
      </div>

      {/* Bottom */}
      <div style={{ position: "relative" }}>
        <div style={{ fontSize: 34, letterSpacing: "-0.05em", fontWeight: 300, color: count === 0 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.88)" }}>
          {count} <span style={{ fontSize: 14, fontWeight: 400, color: "rgba(255,255,255,0.36)" }}>{countLabels[folderKey]}</span>
        </div>
        <div style={{
          marginTop: 16, borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)",
          background: hovered ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.03)",
          height: 44, padding: "0 16px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          fontSize: 14, color: "rgba(255,255,255,0.70)",
          transition: "background 0.18s",
        }}>
          <span>Open folder</span>
          <ArrowUpRight size={14} style={{ color: "rgba(255,255,255,0.4)" }} />
        </div>
      </div>
    </motion.div>
  );
}

// ─── UrlRouteCard ─────────────────────────────────────────────────────────────
function UrlRouteCard({ v, i }: { v: Variation; i: number }) {
  const [hovered, setHovered] = useState(false);
  const c = S[v.status] ?? S.pending;

  let domain = v.url;
  try { domain = new URL(v.url).hostname.replace("www.", ""); } catch { /**/ }

  const weight = ((parseInt(String(v.id).replace(/\D/g, "") || "50") * 37 + 13) % 80) + 15;

  const roleMap: Record<string, string> = {
    "nutaku.net": "Games / offer / EN",
    "crakrevenue.com": "Dating / mobile / US",
    "maxbounty.com": "Finance / desktop / UK",
    "adultfriendfinder.com": "Dating / broad / CA",
    "cpagrip.com": "Sweepstakes / test",
    "clickbank.com": "VSL / direct response",
    "digistore24.com": "Info / email / DE",
    "shareasale.com": "Ecom / retargeting",
    "panthera.com": "CPA / mixed geo",
    "affiliaxe.com": "Push / mobile / WW",
    "impact.com": "Brand / CPS / US",
    "jvzoo.com": "SaaS / IM / EN",
  };
  const role = roleMap[domain] ?? "Offer / general";

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, delay: i * 0.05 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 24,
        border: `1px solid ${hovered ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.08)"}`,
        background: hovered
          ? "linear-gradient(180deg, rgba(20,21,30,0.99), rgba(13,14,21,0.99))"
          : "linear-gradient(180deg, rgba(18,19,27,0.98), rgba(12,13,19,0.98))",
        padding: 20,
        boxShadow: hovered ? "0 20px 48px rgba(0,0,0,0.32)" : "0 12px 30px rgba(0,0,0,0.16)",
        transition: "all 0.22s ease",
      }}
    >
      {/* Top: icon + badge */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 16, flexShrink: 0,
          border: `1px solid rgba(${c.rgb},0.2)`, background: `rgba(${c.rgb},0.08)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: c.color, fontSize: 18,
        }}>
          ↗
        </div>
        <div style={{
          display: "inline-flex", borderRadius: 999, padding: "5px 11px",
          fontSize: 10, textTransform: "uppercase" as const, letterSpacing: "0.18em",
          border: `1px solid rgba(${c.rgb},0.18)`,
          background: `rgba(${c.rgb},0.08)`, color: c.color,
        }}>
          {c.label}
        </div>
      </div>

      {/* Domain */}
      <div style={{ marginTop: 20, fontSize: 22, letterSpacing: "-0.04em", fontWeight: 300, color: "rgba(255,255,255,0.92)", wordBreak: "break-all" }}>
        {domain}
      </div>
      <div style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.30)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {v.url}
      </div>

      {/* Stats box */}
      <div style={{ marginTop: 20, borderRadius: 18, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 14 }}>
          <span style={{ color: "rgba(255,255,255,0.34)" }}>Traffic weight</span>
          <span style={{ color: "rgba(255,255,255,0.80)" }}>{weight}%</span>
        </div>
        <div style={{ marginTop: 12, height: 8, borderRadius: 999, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${weight}%` }}
            transition={{ duration: 1.1, delay: i * 0.05 + 0.2, ease: "easeOut" }}
            style={{ height: "100%", borderRadius: 999, background: c.color, opacity: 0.7 }}
          />
        </div>
      </div>

      {/* Role */}
      <div style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 14 }}>
        <span style={{ color: "rgba(255,255,255,0.34)" }}>Role</span>
        <span style={{ color: "rgba(255,255,255,0.78)" }}>{role}</span>
      </div>

      {/* Action buttons */}
      <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 8 }}>
        {[
          v.status === "active" ? "Pause" : "Activate",
          "Preview",
          "Attach",
        ].map((label, idx) => (
          <button key={label} style={{
            borderRadius: 12, border: "1px solid rgba(255,255,255,0.10)",
            background: idx === 0 && v.status === "active" ? "rgba(251,191,36,0.06)" : "rgba(255,255,255,0.03)",
            padding: "8px 12px", fontSize: 12,
            color: idx === 0 && v.status === "active" ? "#fbbf24" : "rgba(255,255,255,0.70)",
            cursor: "pointer",
            display: "flex", alignItems: "center", gap: 5,
          }}>
            {idx === 0 && (v.status === "active"
              ? <PauseCircle size={10} strokeWidth={2} />
              : <PlayCircle size={10} strokeWidth={2} />
            )}
            {label}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// ─── MediaCard ────────────────────────────────────────────────────────────────
function MediaCard({
  asset, i, folderKey, onPreview, onDelete,
}: {
  asset: MediaAsset; i: number; folderKey: FolderKey;
  onPreview: (a: MediaAsset) => void;
  onDelete: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [copied,  setCopied]  = useState(false);
  const f = FOLDERS[folderKey];

  function copyUrl() {
    if (!asset.url) return;
    navigator.clipboard.writeText(asset.url).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay: i * 0.04, ease: [0.23, 1, 0.32, 1] }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onPreview(asset)}
      style={{
        background: "#17171e", borderRadius: 16, overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.05)",
        borderTop: "1px solid rgba(255,255,255,0.09)",
        boxShadow: hovered
          ? `0 16px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(${f.border},0.1)`
          : "0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.04)",
        transition: "box-shadow 0.25s", cursor: "pointer",
      }}
    >
      {/* Thumbnail */}
      <div style={{ height: 140, position: "relative", overflow: "hidden", background: "rgba(255,255,255,0.02)" }}>
        {asset.url ? (
          <img src={asset.url} alt={asset.name} style={{
            width: "100%", height: "100%", objectFit: "cover",
            transform: hovered ? "scale(1.06)" : "scale(1)",
            transition: "transform 0.4s ease",
          }} />
        ) : (
          <div style={{
            width: "100%", height: "100%",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: `radial-gradient(circle at 50% 40%, rgba(139,92,246,0.08) 0%, transparent 70%)`,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.18)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Film size={20} strokeWidth={1} style={{ color: "#8b5cf6" }} />
            </div>
          </div>
        )}

        {/* Hover overlay */}
        <motion.div
          initial={false} animate={{ opacity: hovered ? 1 : 0 }} transition={{ duration: 0.18 }}
          onClick={e => e.stopPropagation()}
          style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            pointerEvents: hovered ? "auto" : "none",
          }}
        >
          <button onClick={e => { e.stopPropagation(); onPreview(asset); }} style={{
            padding: "6px 14px", borderRadius: 9, cursor: "pointer",
            background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)",
            color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: 500,
          }}>
            Preview
          </button>
          {asset.url && (
            <button onClick={e => { e.stopPropagation(); copyUrl(); }} style={{
              width: 30, height: 30, borderRadius: 8, cursor: "pointer",
              background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
              color: copied ? "#4ade80" : "rgba(255,255,255,0.5)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {copied ? <Check size={11} strokeWidth={2} /> : <Copy size={11} strokeWidth={1.5} />}
            </button>
          )}
          <button onClick={e => { e.stopPropagation(); onDelete(asset.id); }} style={{
            width: 30, height: 30, borderRadius: 8, cursor: "pointer",
            background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)",
            color: "#f87171", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Trash2 size={11} strokeWidth={1.5} />
          </button>
        </motion.div>
      </div>

      {/* Info */}
      <div style={{ padding: "11px 12px 9px" }}>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", margin: 0, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {asset.name}
        </p>
        {asset.size && (
          <p style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", margin: 0, fontFamily: "monospace" }}>
            {asset.size}
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────
function MediaLightbox({ asset, onClose }: { asset: MediaAsset; onClose: () => void }) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
        onClick={e => e.stopPropagation()}
        style={{
          background: "#17171e", borderRadius: 20,
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.07)",
          overflow: "hidden", maxWidth: "80vw", maxHeight: "80vh",
          display: "flex", flexDirection: "column",
        }}
      >
        <div style={{
          padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.75)", margin: 0 }}>
            {asset.name}
          </p>
          <button onClick={onClose} style={{
            width: 26, height: 26, borderRadius: 7, cursor: "pointer",
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
            color: "rgba(255,255,255,0.35)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <X size={12} strokeWidth={2} />
          </button>
        </div>
        <div style={{ padding: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {asset.url ? (
            <img src={asset.url} alt={asset.name} style={{ maxWidth: "100%", maxHeight: "60vh", borderRadius: 12 }} />
          ) : (
            <div style={{
              width: 300, height: 170, borderRadius: 12,
              background: "rgba(139,92,246,0.05)", border: "1px solid rgba(139,92,246,0.1)",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10,
            }}>
              <Film size={32} strokeWidth={0.8} style={{ color: "rgba(139,92,246,0.4)" }} />
              <p style={{ ...LABEL, color: "rgba(139,92,246,0.35)" }}>Video preview unavailable</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── VaultClient ──────────────────────────────────────────────────────────────
export default function VaultClient({ campaigns, hasExoClick }: { campaigns: Campaign[]; hasExoClick: boolean }) {

  // ── Navigation ──
  const [activeFolder, setActiveFolder] = useState<FolderKey | null>(null);

  // ── URL state ──
  const [selectedId,   setSelectedId]   = useState<string | null>(campaigns[0]?.externalId ?? null);
  const [search,       setSearch]       = useState("");
  const [showDrop,     setShowDrop]     = useState(false);
  const [variations,   setVariations]   = useState<Variation[]>(DEMO_VARIATIONS);
  const [isDemo,       setIsDemo]       = useState(true);
  const [loadingVar,   setLoadingVar]   = useState(false);
  const [urls,         setUrls]         = useState("");
  const [injecting,    setInjecting]    = useState(false);
  const [refreshing,   setRefreshing]   = useState(false);
  const [page,         setPage]         = useState(1);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // ── Media state ──
  const [mediaAssets,   setMediaAssets]   = useState<MediaAsset[]>(DEMO_MEDIA);
  const [lightboxAsset, setLightboxAsset] = useState<MediaAsset | null>(null);
  const [addUrl,        setAddUrl]        = useState("");
  const [addName,       setAddName]       = useState("");

  // ── Search / filter overlay ──
  const [showSearch,  setShowSearch]  = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterType,  setFilterType]  = useState<"all"|"image"|"gif"|"video">("all");

  // ── File upload ref ──
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Inject panel ref (for "+ Add URL" scroll-to) ──
  const injectPanelRef = useRef<HTMLDivElement>(null);

  // ── Toast ──
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3000);
  }

  // ── Computed ──
  const selectedCamp = campaigns.find(c => c.externalId === selectedId);

  const filtered = useMemo(
    () => campaigns.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.externalId.includes(search)),
    [campaigns, search],
  );

  const stats: Stats = useMemo(() => ({
    total:    variations.length,
    active:   variations.filter(v => v.status === "active").length,
    paused:   variations.filter(v => v.status === "paused").length,
    pending:  variations.filter(v => v.status === "pending").length,
    rejected: variations.filter(v => v.status === "rejected").length,
  }), [variations]);

  const visibleVars = useMemo(() => {
    const base = filterStatus === "all" ? variations : variations.filter(v => v.status === filterStatus);
    return base.slice(0, page * PAGE);
  }, [variations, filterStatus, page]);

  const totalFiltered = filterStatus === "all" ? variations.length : variations.filter(v => v.status === filterStatus).length;

  const mediaByType = useMemo(() => ({
    photos: mediaAssets.filter(a => a.type === "image"),
    gifs:   mediaAssets.filter(a => a.type === "gif"),
    videos: mediaAssets.filter(a => a.type === "video"),
  }), [mediaAssets]);

  // ── API ──
  const fetchVariations = useCallback(async (extId: string, quiet = false) => {
    if (quiet) setRefreshing(true); else setLoadingVar(true);
    setPage(1);
    try {
      const res = await fetch(`/api/vault?campaignId=${extId}`);
      const data = await res.json();
      const real = data.variations ?? [];
      setVariations(real.length > 0 ? real : DEMO_VARIATIONS);
      setIsDemo(real.length === 0);
    } catch { setVariations(DEMO_VARIATIONS); setIsDemo(true); }
    finally { setLoadingVar(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    if (selectedId) { setVariations([]); setFilterStatus("all"); fetchVariations(selectedId); }
  }, [selectedId, fetchVariations]);

  async function handleInject() {
    const list = urls.split("\n").map(u => u.trim()).filter(Boolean);
    if (!list.length || !selectedId) return;
    setInjecting(true);
    try {
      const res = await fetch("/api/vault/inject", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: selectedId, urls: list }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(`${data.success} URL${data.success > 1 ? "s" : ""} injected`, true);
        setUrls(""); setIsDemo(false); await fetchVariations(selectedId, true);
      } else showToast(data.error ?? "Error", false);
    } catch { showToast("Network error", false); }
    setInjecting(false);
  }

  function handleAddMedia() {
    if (!addUrl.trim()) return;
    const isGif = addUrl.toLowerCase().includes(".gif");
    const isVideo = addUrl.toLowerCase().match(/\.(mp4|webm|mov)$/);
    const type = isVideo ? "video" : isGif ? "gif" : "image";
    const name = addName.trim() || `media_${Date.now()}.${type === "video" ? "mp4" : type === "gif" ? "gif" : "jpg"}`;
    setMediaAssets(prev => [{ id: `u_${Date.now()}`, name, url: addUrl.trim(), type }, ...prev]);
    setAddUrl(""); setAddName(""); showToast("Asset added", true);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const newAssets: MediaAsset[] = files.map(f => {
      const isGif = f.name.toLowerCase().endsWith(".gif");
      const isVideo = f.type.startsWith("video/");
      const type: MediaAsset["type"] = isVideo ? "video" : isGif ? "gif" : "image";
      const url = f.type.startsWith("image/") || isGif ? URL.createObjectURL(f) : "";
      const size = f.size > 1_000_000 ? `${(f.size / 1_000_000).toFixed(1)} MB` : `${Math.round(f.size / 1000)} KB`;
      return { id: `upload_${Date.now()}_${f.name}`, name: f.name, url, type, size };
    });
    setMediaAssets(prev => [...newAssets, ...prev]);
    // Navigate to the appropriate folder
    const firstType = newAssets[0].type;
    setActiveFolder(firstType === "video" ? "videos" : firstType === "gif" ? "gifs" : "photos");
    showToast(`${newAssets.length} file${newAssets.length > 1 ? "s" : ""} uploaded`, true);
    e.target.value = "";
  }

  // Global search results
  const globalResults = useMemo(() => {
    if (!globalSearch.trim()) return { media: mediaAssets, urls: variations };
    const q = globalSearch.toLowerCase();
    return {
      media: mediaAssets.filter(a => a.name.toLowerCase().includes(q)),
      urls: variations.filter(v => v.url.toLowerCase().includes(q)),
    };
  }, [globalSearch, mediaAssets, variations]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  const recentAssets = useMemo(() => mediaAssets.slice(0, 6), [mediaAssets]);

  const thumbGrads = [
    "linear-gradient(135deg, #171b2a, #303a57)",
    "linear-gradient(135deg, #10131c, #202838)",
    "linear-gradient(135deg, #1a1824, #2d2442)",
  ];

  // ── Vault empty state ─────────────────────────────────────────────────────
  if (campaigns.length === 0) {
    return (
      <div style={{ padding: "36px 40px", background: "#0d0d10", minHeight: "100vh" }}>
        <EmptyStateCard
          tone="violet"
          badge="Vault empty"
          title="Your vault is empty. Add your first asset or route."
          text={
            !hasExoClick
              ? "Connect your ExoClick account first in Settings, then sync your campaigns to start managing creatives and destination URLs."
              : "Vault is the operating inventory for your campaigns. Upload creatives or add destination URLs to make your campaigns operational."
          }
          cta1={!hasExoClick ? "Connect ExoClick" : "Add asset"}
          cta1Href={!hasExoClick ? "/dashboard/settings?tab=connections" : undefined}
          cta2={!hasExoClick ? undefined : "Add destination URL"}
          preview={
            <div style={{
              width: "100%", maxWidth: 480,
              borderRadius: 28,
              border: "1px solid rgba(167,139,250,0.18)",
              background: "rgba(139,92,246,0.07)",
              padding: 22,
            }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {[
                  { label: "Upload creative", sub: "PNG, JPG, GIF, MP4" },
                  { label: "Add route",        sub: "Offer link, LP, rotator" },
                ].map(card => (
                  <div key={card.label} style={{
                    borderRadius: 22,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.04)",
                    padding: 22, minHeight: 148,
                    display: "flex", flexDirection: "column", justifyContent: "space-between",
                  }}>
                    <div style={{ fontSize: 14, color: "rgba(255,255,255,0.82)" }}>{card.label}</div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.32)" }}>{card.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ height: "calc(100vh - 56px)", overflow: "hidden", background: "#0d0d10" }}>

      {/* ── Hidden file input ── */}
      <input
        ref={fileInputRef} type="file" multiple accept="image/*,video/*,.gif"
        style={{ display: "none" }} onChange={handleFileUpload}
      />

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{
              position: "fixed", top: 14, left: "50%", transform: "translateX(-50%)", zIndex: 9999,
              padding: "9px 20px", borderRadius: 12,
              background: toast.ok ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)",
              border: `1px solid ${toast.ok ? "rgba(74,222,128,0.18)" : "rgba(248,113,113,0.18)"}`,
              color: toast.ok ? "#4ade80" : "#f87171",
              fontSize: 13, fontWeight: 500, whiteSpace: "nowrap",
            }}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Lightbox ── */}
      <AnimatePresence>
        {lightboxAsset && <MediaLightbox asset={lightboxAsset} onClose={() => setLightboxAsset(null)} />}
      </AnimatePresence>

      {/* ── Global search overlay ── */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => { setShowSearch(false); setGlobalSearch(""); }}
            style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
          >
            <motion.div
              initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              onClick={e => e.stopPropagation()}
              style={{ maxWidth: 640, margin: "80px auto 0", background: "#17171e", borderRadius: 20, border: "1px solid rgba(255,255,255,0.09)", overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.7)" }}
            >
              {/* Search input */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <Search size={16} strokeWidth={1.5} style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }} />
                <input
                  autoFocus
                  value={globalSearch}
                  onChange={e => setGlobalSearch(e.target.value)}
                  placeholder="Search assets, files, URLs…"
                  style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 15, color: "rgba(255,255,255,0.85)", colorScheme: "dark" }}
                />
                <button onClick={() => { setShowSearch(false); setGlobalSearch(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", display: "flex", alignItems: "center" }}>
                  <X size={14} strokeWidth={2} />
                </button>
              </div>

              {/* Results */}
              <div style={{ maxHeight: 420, overflowY: "auto", padding: "12px 0" }}>
                {!globalSearch.trim() ? (
                  <div style={{ padding: "20px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
                    <p style={{ ...LABEL, marginBottom: 8 }}>Quick navigate</p>
                    {(["photos", "gifs", "videos", "urls"] as FolderKey[]).map(k => {
                      const f = FOLDERS[k];
                      return (
                        <button key={k} onClick={() => { setShowSearch(false); setGlobalSearch(""); setActiveFolder(k); }}
                          style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", textAlign: "left" as const }}
                        >
                          <div style={{ width: 32, height: 32, borderRadius: 10, border: `1px solid ${f.border}`, background: f.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <f.Icon size={14} strokeWidth={1.5} style={{ color: f.text }} />
                          </div>
                          <span style={{ fontSize: 14, color: "rgba(255,255,255,0.75)" }}>{f.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ padding: "0 12px" }}>
                    {globalResults.media.length > 0 && (
                      <>
                        <p style={{ ...LABEL, padding: "8px 8px 4px" }}>Files ({globalResults.media.length})</p>
                        {globalResults.media.slice(0, 5).map(a => (
                          <button key={a.id}
                            onClick={() => { setShowSearch(false); setGlobalSearch(""); setActiveFolder(a.type === "video" ? "videos" : a.type === "gif" ? "gifs" : "photos"); setLightboxAsset(a); }}
                            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 8px", borderRadius: 10, background: "transparent", border: "none", cursor: "pointer", textAlign: "left" as const }}
                            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                          >
                            <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <ImageIcon size={12} strokeWidth={1.5} style={{ color: "rgba(255,255,255,0.4)" }} />
                            </div>
                            <div>
                              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)" }}>{a.name}</div>
                              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.28)" }}>{a.size ?? a.type}</div>
                            </div>
                          </button>
                        ))}
                      </>
                    )}
                    {globalResults.urls.length > 0 && (
                      <>
                        <p style={{ ...LABEL, padding: "8px 8px 4px" }}>URLs ({globalResults.urls.length})</p>
                        {globalResults.urls.slice(0, 5).map(v => {
                          let domain = v.url;
                          try { domain = new URL(v.url).hostname.replace("www.", ""); } catch { /**/ }
                          const c = S[v.status];
                          return (
                            <button key={String(v.id)}
                              onClick={() => { setShowSearch(false); setGlobalSearch(""); setActiveFolder("urls"); }}
                              style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 8px", borderRadius: 10, background: "transparent", border: "none", cursor: "pointer", textAlign: "left" as const }}
                              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                            >
                              <div style={{ width: 28, height: 28, borderRadius: 8, background: `rgba(${c.rgb},0.08)`, border: `1px solid rgba(${c.rgb},0.15)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <Link2 size={11} strokeWidth={1.5} style={{ color: c.color }} />
                              </div>
                              <div>
                                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)" }}>{domain}</div>
                                <div style={{ fontSize: 11, color: c.color }}>{c.label}</div>
                              </div>
                            </button>
                          );
                        })}
                      </>
                    )}
                    {globalResults.media.length === 0 && globalResults.urls.length === 0 && (
                      <p style={{ textAlign: "center" as const, padding: "28px", fontSize: 14, color: "rgba(255,255,255,0.2)" }}>No results for &ldquo;{globalSearch}&rdquo;</p>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Filter panel overlay ── */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowFilters(false)}
            style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.5)" }}
          >
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
              onClick={e => e.stopPropagation()}
              style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 320, background: "#17171e", borderLeft: "1px solid rgba(255,255,255,0.07)", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 24 }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ fontSize: 18, fontWeight: 300, letterSpacing: "-0.03em", margin: 0, color: "rgba(255,255,255,0.9)" }}>Filters</h3>
                <button onClick={() => setShowFilters(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", display: "flex" }}><X size={16} /></button>
              </div>

              <div>
                <p style={{ ...LABEL, marginBottom: 12 }}>Asset type</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {([
                    { key: "all",   label: "All assets" },
                    { key: "image", label: "Photos" },
                    { key: "gif",   label: "GIFs" },
                    { key: "video", label: "Videos" },
                  ] as const).map(({ key, label }) => (
                    <button key={key} onClick={() => setFilterType(key)}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 12, cursor: "pointer", background: filterType === key ? "rgba(139,92,246,0.1)" : "rgba(255,255,255,0.02)", border: `1px solid ${filterType === key ? "rgba(139,92,246,0.25)" : "rgba(255,255,255,0.07)"}`, fontSize: 14, color: filterType === key ? "#a78bfa" : "rgba(255,255,255,0.6)" }}
                    >
                      {label}
                      {filterType === key && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#a78bfa" }} />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p style={{ ...LABEL, marginBottom: 12 }}>Folders</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {(["photos", "gifs", "videos", "urls"] as FolderKey[]).map(k => {
                    const f = FOLDERS[k];
                    return (
                      <button key={k} onClick={() => { setShowFilters(false); setActiveFolder(k); }}
                        style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, cursor: "pointer", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", fontSize: 14, color: "rgba(255,255,255,0.6)", textAlign: "left" as const }}
                      >
                        <div style={{ width: 28, height: 28, borderRadius: 9, border: `1px solid ${f.border}`, background: f.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <f.Icon size={13} strokeWidth={1.5} style={{ color: f.text }} />
                        </div>
                        {f.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">

        {/* ═══════════════════════════════ HOME ═══════════════════════════════ */}
        {!activeFolder && (
          <motion.div key="home"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ height: "100%", overflowY: "auto", padding: "32px 32px 56px" }}
          >
            {/* TopNav */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, marginBottom: 32 }}>
              <div>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.22em", color: "rgba(255,255,255,0.24)", marginBottom: 8 }}>
                  Creative operating system
                </div>
                <h2 style={{ fontSize: 30, letterSpacing: "-0.04em", fontWeight: 300, margin: 0, color: "rgba(255,255,255,0.92)" }}>
                  Vault
                  {isDemo && (
                    <span style={{ marginLeft: 12, fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", padding: "3px 9px", borderRadius: 99, background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)", color: "#a78bfa", verticalAlign: "middle" }}>DEMO</span>
                  )}
                </h2>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button style={GHOST_BTN} onClick={() => setShowSearch(true)}>
                  <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <Search size={13} strokeWidth={1.5} />Search
                  </span>
                </button>
                <button style={GHOST_BTN} onClick={() => setShowFilters(true)}>Filters</button>
                <button style={PRIMARY_BTN} onClick={() => fileInputRef.current?.click()}>+ Add asset</button>
              </div>
            </div>

            {/* Main split: action card + overview */}
            <div style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 24, marginBottom: 24 }}>

              {/* Action card */}
              <motion.div
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}
                style={{
                  borderRadius: 28, padding: 28,
                  border: "1px solid rgba(167,139,250,0.16)",
                  background: "linear-gradient(135deg, rgba(94,32,189,0.14), rgba(16,18,30,0.95))",
                  boxShadow: "0 20px 60px rgba(139,92,246,0.08)",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "inline-flex", borderRadius: 999, padding: "6px 12px", fontSize: 10, textTransform: "uppercase" as const, letterSpacing: "0.22em", border: "1px solid rgba(167,139,250,0.16)", background: "rgba(139,92,246,0.08)", color: "rgba(221,214,254,1)" }}>
                      Main action
                    </div>
                    <h3 style={{ marginTop: 20, fontSize: 32, letterSpacing: "-0.05em", fontWeight: 300, lineHeight: 1.05, maxWidth: "13ch", color: "rgba(255,255,255,0.92)" }}>
                      Add a creative, a video, or a landing URL.
                    </h3>
                    <p style={{ marginTop: 16, color: "rgba(255,255,255,0.48)", fontSize: 15, lineHeight: 1.75, maxWidth: "52ch" }}>
                      Upload new assets, import from URL, or create a new destination variation — all from one place.
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div style={{ width: 240, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      style={{ borderRadius: 20, border: "1px solid rgba(255,255,255,0.10)", padding: 16, textAlign: "left" as const, cursor: "pointer", background: "rgba(255,255,255,0.06)" }}
                    >
                      <div style={{ fontSize: 14, color: "#fff", fontWeight: 500 }}>Upload file</div>
                      <div style={{ marginTop: 4, fontSize: 12, color: "rgba(255,255,255,0.36)" }}>PNG, JPG, GIF, MP4</div>
                    </button>
                    <button
                      onClick={() => setActiveFolder("urls")}
                      style={{ borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)", padding: 16, textAlign: "left" as const, cursor: "pointer", background: "rgba(255,255,255,0.03)" }}
                    >
                      <div style={{ fontSize: 14, color: "rgba(255,255,255,0.82)" }}>Add destination URL</div>
                      <div style={{ marginTop: 4, fontSize: 12, color: "rgba(255,255,255,0.36)" }}>Offer, rotator, landing page</div>
                    </button>
                    <button
                      onClick={() => setActiveFolder("urls")}
                      style={{ borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)", padding: 16, textAlign: "left" as const, cursor: "pointer", background: "rgba(255,255,255,0.03)" }}
                    >
                      <div style={{ fontSize: 14, color: "rgba(255,255,255,0.82)" }}>Import from campaign</div>
                      <div style={{ marginTop: 4, fontSize: 12, color: "rgba(255,255,255,0.36)" }}>Pull assets already live</div>
                    </button>
                  </div>
                </div>
              </motion.div>

              {/* Overview card */}
              <motion.div
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.07 }}
                style={{
                  borderRadius: 28, padding: 24,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.22em", color: "rgba(255,255,255,0.24)" }}>Overview</div>
                    <div style={{ marginTop: 8, fontSize: 22, letterSpacing: "-0.04em", fontWeight: 300, color: "rgba(255,255,255,0.88)" }}>What sits in the vault</div>
                  </div>
                  <div style={{ display: "inline-flex", borderRadius: 999, padding: "6px 12px", fontSize: 10, textTransform: "uppercase" as const, letterSpacing: "0.18em", border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.70)" }}>
                    {mediaAssets.length + stats.total} total
                  </div>
                </div>

                <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                  {([
                    { key: "photos" as FolderKey, count: mediaByType.photos.length, sub: "Banners, halfpages, leaderboards" },
                    { key: "gifs"   as FolderKey, count: mediaByType.gifs.length,   sub: "Short loops for native and display" },
                    { key: "videos" as FolderKey, count: mediaByType.videos.length, sub: "In-video, interstitial, preview clips" },
                    { key: "urls"   as FolderKey, count: stats.total,               sub: "Offer links, rotators, destinations" },
                  ] as const).map(({ key, count, sub }) => {
                    const f = FOLDERS[key];
                    return (
                      <div key={key}
                        onClick={() => setActiveFolder(key)}
                        style={{ borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, cursor: "pointer", transition: "background 0.15s, border-color 0.15s" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.13)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                          <div style={{ width: 48, height: 48, borderRadius: 16, border: `1px solid ${f.border}`, background: f.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <f.Icon size={18} strokeWidth={1.5} style={{ color: f.text }} />
                          </div>
                          <div>
                            <div style={{ fontSize: 15, letterSpacing: "-0.02em", color: "rgba(255,255,255,0.86)" }}>{f.label}</div>
                            <div style={{ marginTop: 3, fontSize: 12, color: "rgba(255,255,255,0.34)" }}>{sub}</div>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" as const }}>
                          <div style={{ fontSize: 14, color: count === 0 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.84)" }}>{count} {key === "gifs" ? "loops" : key === "videos" ? "clips" : key === "urls" ? "variations" : "assets"}</div>
                          <div style={{ marginTop: 3, fontSize: 12, color: "rgba(255,255,255,0.28)" }}>{f.badge}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </div>

            {/* 4-col folder grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 24 }}>
              <FolderCard folderKey="photos" count={mediaByType.photos.length} i={0} onClick={() => setActiveFolder("photos")} />
              <FolderCard folderKey="gifs"   count={mediaByType.gifs.length}   i={1} onClick={() => setActiveFolder("gifs")}   />
              <FolderCard folderKey="videos" count={mediaByType.videos.length} i={2} onClick={() => setActiveFolder("videos")} />
              <FolderCard folderKey="urls"   count={stats.total}               i={3} onClick={() => setActiveFolder("urls")}   />
            </div>

            {/* Recent assets + quick info */}
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 24 }}>

              {/* Recent assets */}
              <motion.div
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.32 }}
                style={{ borderRadius: 28, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", padding: 24 }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.22em", color: "rgba(255,255,255,0.24)" }}>Recent assets</div>
                    <div style={{ marginTop: 8, fontSize: 22, letterSpacing: "-0.04em", fontWeight: 300, color: "rgba(255,255,255,0.88)" }}>Added or edited recently</div>
                  </div>
                  <button style={GHOST_BTN} onClick={() => setActiveFolder("photos")}>See all</button>
                </div>

                <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                  {recentAssets.map((a, i) => (
                    <div key={a.id} style={{ borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", overflow: "hidden", cursor: "pointer" }}
                      onClick={() => { setActiveFolder("photos"); setLightboxAsset(a); }}
                    >
                      <div style={{ height: 110, background: thumbGrads[i % 3], position: "relative" }}>
                        {a.url && (
                          <img src={a.url} alt={a.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        )}
                        {!a.url && (
                          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Film size={24} strokeWidth={0.8} style={{ color: "rgba(255,255,255,0.2)" }} />
                          </div>
                        )}
                      </div>
                      <div style={{ padding: "12px 14px" }}>
                        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.78)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</div>
                        <div style={{ marginTop: 4, fontSize: 11, color: "rgba(255,255,255,0.28)" }}>{a.size ?? "—"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* URL status summary */}
              <motion.div
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.38 }}
                style={{ borderRadius: 28, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", padding: 24 }}
              >
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.22em", color: "rgba(255,255,255,0.24)" }}>URL status</div>
                <div style={{ marginTop: 8, fontSize: 22, letterSpacing: "-0.04em", fontWeight: 300, color: "rgba(255,255,255,0.88)" }}>Landing route breakdown</div>

                <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                  {([
                    { key: "active",   label: "Active",   count: stats.active,   color: "#4ade80", rgb: "74,222,128" },
                    { key: "paused",   label: "Paused",   count: stats.paused,   color: "#fbbf24", rgb: "251,191,36" },
                    { key: "pending",  label: "Pending",  count: stats.pending,  color: "#a78bfa", rgb: "167,139,250" },
                    { key: "rejected", label: "Rejected", count: stats.rejected, color: "#f87171", rgb: "248,113,113" },
                  ] as const).map(({ key, label, count, color, rgb }) => (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0, boxShadow: `0 0 6px rgba(${rgb},0.5)` }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.60)" }}>{label}</span>
                          <span style={{ fontSize: 13, color: count === 0 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.70)" }}>{count}</span>
                        </div>
                        <div style={{ height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 99 }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: stats.total > 0 ? `${(count / stats.total) * 100}%` : "0%" }}
                            transition={{ duration: 1.1, ease: "easeOut", delay: 0.4 }}
                            style={{ height: "100%", borderRadius: 99, background: color, opacity: 0.7 }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setActiveFolder("urls")}
                  style={{
                    ...PRIMARY_BTN,
                    marginTop: 28, width: "100%", padding: "12px 0",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  <ArrowUpRight size={14} />
                  Manage URLs
                </button>
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* ═════════════════════ MEDIA FOLDER (photos / gifs / videos) ════════ */}
        {(activeFolder === "photos" || activeFolder === "gifs" || activeFolder === "videos") && (
          <motion.div key={`media-${activeFolder}`}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ height: "100%", overflowY: "auto", padding: "32px 32px 56px" }}
          >
            {/* Folder header */}
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 32 }}>
              <div>
                <button
                  onClick={() => setActiveFolder(null)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
                    borderRadius: 10, cursor: "pointer", border: "1px solid rgba(255,255,255,0.07)",
                    background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.40)",
                    fontSize: 12, marginBottom: 16,
                  }}
                >
                  <ChevronLeft size={12} strokeWidth={2} />Vault
                </button>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.22em", color: "rgba(255,255,255,0.24)" }}>Folder</div>
                <div style={{ marginTop: 8, fontSize: 32, letterSpacing: "-0.04em", fontWeight: 300, color: "rgba(255,255,255,0.92)" }}>
                  {FOLDERS[activeFolder].label}
                </div>
                <div style={{ marginTop: 4, fontSize: 14, color: "rgba(255,255,255,0.34)" }}>
                  {FOLDERS[activeFolder].note} · {mediaByType[activeFolder].length} files
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 4 }}>
                <button style={GHOST_BTN} onClick={() => setShowFilters(true)}>Sort</button>
                <button style={GHOST_BTN} onClick={() => setShowFilters(true)}>Filter</button>
                <button style={PRIMARY_BTN} onClick={() => fileInputRef.current?.click()}>+ Add {activeFolder === "photos" ? "photo" : activeFolder === "gifs" ? "GIF" : "video"}</button>
              </div>
            </div>

            {/* File grid + sidebar */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 290px", gap: 24 }}>

              {/* File grid */}
              <div>
                {mediaByType[activeFolder].length === 0 ? (
                  <div style={{ minHeight: 300, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 16, background: `${FOLDERS[activeFolder].color}`, border: `1px solid ${FOLDERS[activeFolder].border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <FOLDERS.photos.Icon size={20} strokeWidth={1} style={{ color: FOLDERS[activeFolder].text }} />
                    </div>
                    <p style={{ fontSize: 14, color: "rgba(255,255,255,0.2)" }}>No files yet</p>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
                    {mediaByType[activeFolder].map((a, i) => (
                      <MediaCard key={a.id} asset={a} i={i} folderKey={activeFolder}
                        onPreview={setLightboxAsset}
                        onDelete={id => setMediaAssets(prev => prev.filter(x => x.id !== id))}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Sidebar */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Add panel */}
                <div style={{ borderRadius: 24, border: "1px solid rgba(167,139,250,0.16)", background: "rgba(139,92,246,0.08)", padding: 20 }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.22em", color: "rgba(221,214,254,0.8)" }}>Add new</div>
                  <div style={{ marginTop: 12, fontSize: 20, letterSpacing: "-0.04em", fontWeight: 300, lineHeight: 1.2, color: "rgba(255,255,255,0.90)" }}>
                    Upload or import without leaving the folder.
                  </div>

                  <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
                    <input
                      placeholder="Name (optional)"
                      value={addName}
                      onChange={e => setAddName(e.target.value)}
                      style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", height: 44, padding: "0 14px", fontSize: 13, color: "rgba(255,255,255,0.75)", outline: "none", colorScheme: "dark" }}
                    />
                    <input
                      placeholder="https://… or file URL"
                      value={addUrl}
                      onChange={e => setAddUrl(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleAddMedia()}
                      style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", height: 44, padding: "0 14px", fontSize: 13, color: "rgba(255,255,255,0.75)", outline: "none", colorScheme: "dark" }}
                    />
                    <button
                      onClick={handleAddMedia}
                      disabled={!addUrl.trim()}
                      style={{
                        ...PRIMARY_BTN,
                        height: 44, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        opacity: addUrl.trim() ? 1 : 0.4,
                      }}
                    >
                      <Plus size={13} strokeWidth={2} />Add file
                    </button>
                    <button style={{ borderRadius: 18, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)", padding: "12px 16px", fontSize: 13, color: "rgba(255,255,255,0.65)", cursor: "pointer" }}>
                      Duplicate from campaign
                    </button>
                  </div>
                </div>

                {/* Selection panel */}
                <div style={{ borderRadius: 24, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", padding: 20 }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.22em", color: "rgba(255,255,255,0.24)" }}>Selection tools</div>
                  <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10, fontSize: 14, color: "rgba(255,255,255,0.46)", lineHeight: 1.6 }}>
                    <div>Multi-select assets</div>
                    <div>Move to another folder</div>
                    <div>Attach to campaign</div>
                    <div>Open in preview page</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══════════════════════════════ URLs FOLDER ═════════════════════════ */}
        {activeFolder === "urls" && (
          <motion.div key="folder-urls"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ height: "100%", overflowY: "auto", padding: "32px 32px 56px" }}
          >
            {/* Folder header */}
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 28 }}>
              <div>
                <button
                  onClick={() => setActiveFolder(null)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
                    borderRadius: 10, cursor: "pointer", border: "1px solid rgba(255,255,255,0.07)",
                    background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.40)",
                    fontSize: 12, marginBottom: 16,
                  }}
                >
                  <ChevronLeft size={12} strokeWidth={2} />Vault
                </button>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.22em", color: "rgba(255,255,255,0.24)" }}>Folder</div>
                <div style={{ marginTop: 8, fontSize: 32, letterSpacing: "-0.04em", fontWeight: 300, color: "rgba(255,255,255,0.92)" }}>
                  Landing URLs
                </div>
                <div style={{ marginTop: 4, fontSize: 14, color: "rgba(255,255,255,0.34)" }}>
                  Offer routes, direct links, rotators and destination variants · {stats.total} variations
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 4 }}>

                {/* Campaign selector */}
                <div style={{ position: "relative" }}>
                  <button onClick={() => setShowDrop(v => !v)} style={{
                    ...GHOST_BTN,
                    display: "flex", alignItems: "center", gap: 7, maxWidth: 200,
                  }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140 }}>
                      {selectedCamp?.name ?? "Select campaign…"}
                    </span>
                    <ChevronDown size={11} strokeWidth={1.5} style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0, transform: showDrop ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
                  </button>
                  <AnimatePresence>
                    {showDrop && (
                      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}
                        style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 100, width: 260, background: "#17171e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden", boxShadow: "0 16px 48px rgba(0,0,0,0.7)" }}
                      >
                        <div style={{ padding: "9px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 7 }}>
                          <Search size={11} strokeWidth={1.5} style={{ color: "rgba(255,255,255,0.25)", flexShrink: 0 }} />
                          <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
                            style={{ flex: 1, background: "none", border: "none", outline: "none", color: "rgba(255,255,255,0.7)", fontSize: 12, colorScheme: "dark" }}
                          />
                        </div>
                        <div style={{ maxHeight: 240, overflowY: "auto" }}>
                          {filtered.length === 0
                            ? <p style={{ padding: "14px", fontSize: 12, color: "#3f3f46", textAlign: "center" }}>No results</p>
                            : filtered.map(c => (
                              <button key={c.id} onClick={() => { setSelectedId(c.externalId); setShowDrop(false); setSearch(""); }}
                                style={{ width: "100%", textAlign: "left", padding: "8px 14px", cursor: "pointer", background: c.externalId === selectedId ? "rgba(167,139,250,0.06)" : "transparent", border: "none", display: "flex", flexDirection: "column", gap: 1 }}
                              >
                                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>{c.name}</span>
                                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.15)", fontFamily: "monospace" }}>#{c.externalId}</span>
                              </button>
                            ))
                          }
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button style={GHOST_BTN}>Filter</button>
                <button
                  onClick={() => selectedId && fetchVariations(selectedId, true)}
                  style={{ ...GHOST_BTN, display: "flex", alignItems: "center", justifyContent: "center", padding: "10px 12px" }}
                >
                  <RefreshCw size={13} strokeWidth={1.5} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
                </button>
                <button
                  onClick={() => injectPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
                  style={PRIMARY_BTN}
                >+ Add URL</button>
                {selectedCamp && (
                  <Link
                    href={`/dashboard/campaigns/${selectedCamp.id}`}
                    style={{
                      display: "flex", alignItems: "center", gap: 4,
                      fontSize: 11, color: "rgba(167,139,250,0.7)",
                      textDecoration: "none", whiteSpace: "nowrap",
                      transition: "color 0.15s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = "rgba(167,139,250,1)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "rgba(167,139,250,0.7)")}
                  >
                    View campaign <ArrowUpRight size={10} strokeWidth={2} />
                  </Link>
                )}
              </div>
            </div>

            {/* Filter pills */}
            <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
              {[
                { key: "all",      label: `All (${stats.total})`         },
                { key: "active",   label: `Active (${stats.active})`     },
                { key: "paused",   label: `Paused (${stats.paused})`     },
                { key: "pending",  label: `Pending (${stats.pending})`   },
                { key: "rejected", label: `Rejected (${stats.rejected})` },
              ].map(({ key, label }) => {
                const active = filterStatus === key;
                return (
                  <button key={key} onClick={() => { setFilterStatus(key); setPage(1); }} style={{
                    padding: "6px 14px", borderRadius: 99, fontSize: 12,
                    fontWeight: active ? 600 : 400, cursor: "pointer", transition: "all 0.15s",
                    background: active ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.03)",
                    border: active ? "1px solid rgba(255,255,255,0.9)" : "1px solid rgba(255,255,255,0.08)",
                    color: active ? "#0d0d10" : "rgba(255,255,255,0.45)",
                  }}>
                    {label}
                  </button>
                );
              })}
            </div>

            {/* URL cards + sidebar */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 290px", gap: 24 }}>

              {/* URL card grid */}
              <div>
                {loadingVar ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                    {[...Array(6)].map((_, i) => (
                      <div key={i} style={{ height: 280, borderRadius: 24, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", animation: `pulse 1.6s ease-in-out ${i * 0.06}s infinite` }} />
                    ))}
                  </div>
                ) : visibleVars.length === 0 ? (
                  <div style={{ minHeight: 300, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
                    <AlertCircle size={28} strokeWidth={1} style={{ color: "#3f3f46" }} />
                    <p style={{ fontSize: 14, color: "rgba(255,255,255,0.2)", margin: 0 }}>
                      {selectedId ? "No variations found" : "Select a campaign"}
                    </p>
                  </div>
                ) : (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                      {visibleVars.map((v, i) => <UrlRouteCard key={String(v.id)} v={v} i={i} />)}
                    </div>
                    {visibleVars.length < totalFiltered && (
                      <button onClick={() => setPage(p => p + 1)} style={{
                        marginTop: 16, width: "100%", padding: "12px", borderRadius: 16, cursor: "pointer",
                        background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                        color: "rgba(255,255,255,0.28)", fontSize: 13, transition: "all 0.15s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                      >
                        Load more — {totalFiltered - visibleVars.length} remaining
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Sidebar */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Add URL panel */}
                <div ref={injectPanelRef} style={{ borderRadius: 24, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", padding: 20 }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.22em", color: "rgba(255,255,255,0.24)" }}>Add new URL</div>
                  <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", height: 44, padding: "0 14px", display: "flex", alignItems: "center", fontSize: 13, color: "rgba(255,255,255,0.28)" }}>
                      Name (optional)
                    </div>
                    <textarea
                      value={urls}
                      onChange={e => setUrls(e.target.value)}
                      placeholder={"https://offer1.com/lp\nhttps://offer2.com/lp"}
                      rows={4}
                      style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "12px 14px", color: "rgba(255,255,255,0.65)", fontSize: 12, fontFamily: "monospace", lineHeight: 1.6, resize: "none", outline: "none", colorScheme: "dark" }}
                    />
                    <div style={{ borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", height: 44, padding: "0 14px", display: "flex", alignItems: "center", fontSize: 13, color: "rgba(255,255,255,0.28)" }}>
                      Role / tag
                    </div>
                    <MagneticButton
                      onClick={handleInject}
                      disabled={injecting || !urls.trim() || !selectedId}
                      style={{
                        ...PRIMARY_BTN,
                        width: "100%", height: 44,
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        opacity: !urls.trim() || !selectedId ? 0.4 : 1,
                      }}
                    >
                      {injecting
                        ? <><RefreshCw size={12} strokeWidth={1.5} style={{ animation: "spin 1s linear infinite" }} />Injecting…</>
                        : <><Plus size={12} strokeWidth={2} />Add route{urls.trim() ? ` (${urls.split("\n").filter(u => u.trim()).length})` : ""}</>
                      }
                    </MagneticButton>
                  </div>
                </div>

                {/* Stats panel */}
                <div style={{ borderRadius: 24, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", padding: 20 }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.22em", color: "rgba(255,255,255,0.24)" }}>Distribution</div>
                  <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                    {([
                      { label: "Active",   count: stats.active,   color: "#4ade80", rgb: "74,222,128" },
                      { label: "Paused",   count: stats.paused,   color: "#fbbf24", rgb: "251,191,36" },
                      { label: "Pending",  count: stats.pending,  color: "#a78bfa", rgb: "167,139,250" },
                      { label: "Rejected", count: stats.rejected, color: "#f87171", rgb: "248,113,113" },
                    ] as const).map(({ label, count, color, rgb }) => (
                      <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.50)" }}>{label}</span>
                            <span style={{ fontSize: 13, color: count === 0 ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.70)" }}>{count}</span>
                          </div>
                          <div style={{ height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 99 }}>
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: stats.total > 0 ? `${(count / stats.total) * 100}%` : "0%" }}
                              transition={{ duration: 1.1, ease: "easeOut" }}
                              style={{ height: "100%", borderRadius: 99, background: color, opacity: 0.65 }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      <style>{`
        @keyframes spin  { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes pulse { 0%,100% { opacity: 0.4 } 50% { opacity: 0.1 } }
        ::-webkit-scrollbar       { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.07); border-radius: 2px; }
        button { font-family: inherit; }
        input, textarea { font-family: inherit; }
        input::placeholder { color: rgba(255,255,255,0.28); }
        textarea::placeholder { color: rgba(255,255,255,0.28); }
      `}</style>
    </div>
  );
}
