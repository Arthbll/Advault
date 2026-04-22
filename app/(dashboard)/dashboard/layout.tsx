"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconGauge, IconTarget, IconActivity, IconWallet, IconVault, IconSliders,
  IconBrain,
} from "@/components/ui/Icons";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import PostbackSafetyBanner from "@/components/dashboard/PostbackSafetyBanner";

const NAV = [
  { href: "/dashboard",             label: "Performance",  icon: IconGauge    },
  { href: "/dashboard/campaigns",   label: "Execution",    icon: IconTarget   },
  { href: "/dashboard/statistics",  label: "Analytics",    icon: IconActivity },
  { href: "/dashboard/conversions", label: "Transactions", icon: IconWallet   },
  { href: "/dashboard/rules",       label: "Rules",        icon: IconBrain    },
  { href: "/dashboard/vault",       label: "Vault",        icon: IconVault    },
  { href: "/dashboard/settings",    label: "Settings",     icon: IconSliders  },
];

const NAV_HREFS = NAV.map(n => n.href);
const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1];

// Premium page transitions — subtle y + opacity + blur, no horizontal slamming
const pageVariants = {
  initial: { opacity: 0, y: 10, filter: "blur(4px)" },
  animate: { opacity: 1, y: 0,  filter: "blur(0px)" },
  exit:    { opacity: 0, y: -6, filter: "blur(3px)" },
};

interface MeData { name: string; initials: string; plan: string; role: string; }

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [direction, setDirection] = useState(0);
  const [me, setMe] = useState<MeData>({ name: "", initials: "", plan: "", role: "" });
  const isMobile = useIsMobile();
  const currentIdx = NAV_HREFS.findIndex(
    href => pathname === href || (href !== "/dashboard" && pathname.startsWith(href))
  );

  useEffect(() => {
    function fetchMe() {
      fetch("/api/me")
        .then(r => r.ok ? r.json() : null)
        .then((d: MeData | null) => { if (d) setMe(d); })
        .catch(() => {});
    }

    fetchMe();

    // Auto-sync every 15 min in background — keeps campaign statuses fresh
    // without requiring a manual "Sync now" click
    const syncInterval = setInterval(() => {
      fetch("/api/sync", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ mode: "daily" }),
      }).catch(() => {}); // silent — campaigns page will show updated data on next render
    }, 15 * 60 * 1000);

    // Update the chip immediately when the profile page saves a new display name.
    // We apply the same formatting as /api/me and update local state directly —
    // no server round-trip needed (server-side JWT can be stale right after updateUser).
    function handleProfileUpdated(e: Event) {
      const raw = (e as CustomEvent<{ displayName: string }>).detail?.displayName;
      if (!raw) { fetchMe(); return; }

      const name = raw
        .split(/[\s._-]+/)
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      const words = name.split(" ");
      const initials = words.length >= 2
        ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
        : name.slice(0, 2).toUpperCase();

      setMe(prev => ({ ...prev, name, initials }));
    }

    window.addEventListener("profitdash:profile-updated", handleProfileUpdated);

    return () => {
      clearInterval(syncInterval);
      window.removeEventListener("profitdash:profile-updated", handleProfileUpdated);
    };
  }, []);


  return (
    <div style={{ height: "100dvh", background: "#0d0d10", display: "flex", flexDirection: "column" }}>

      {/* ── Top Navigation Bar ─────────────────────────────────────────────── */}
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        style={{
          position: "sticky", top: 0, zIndex: 50,
          background: "rgba(13,13,16,0.85)",
          backdropFilter: "blur(28px)",
          WebkitBackdropFilter: "blur(28px)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          padding: "10px 28px",
          gap: 16,
        }}>

        {/* Left: Brand */}
        <div style={{
          fontWeight: 400, fontSize: 18,
          color: "rgba(255,255,255,0.3)",
          letterSpacing: "-0.02em",
        }}>
          ProfitDash
        </div>

        {/* Center: Nav pill + dots (hidden on mobile) */}
        <div style={{ display: isMobile ? "none" : "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
          <nav style={{
            display: "flex",
            alignItems: "center",
            background: "rgba(255,255,255,0.035)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 9999,
            padding: "4px 5px",
            gap: 1,
          }}>
            {NAV.map(({ href, label, icon: Icon }) => {
              const active    = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
              const targetIdx = NAV_HREFS.indexOf(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setDirection(targetIdx > currentIdx ? -1 : 1)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "5px 13px",
                    borderRadius: 9999,
                    fontSize: 12,
                    fontWeight: active ? 500 : 400,
                    color: active ? "#000000" : "rgba(113,113,122,0.9)",
                    textDecoration: "none",
                    whiteSpace: "nowrap" as const,
                    cursor: "pointer",
                    position: "relative" as const,
                    zIndex: 1,
                    transition: "color 0.2s",
                  }}
                >
                  {/* Sliding background pill — moves smoothly via layoutId */}
                  {active && (
                    <motion.span
                      layoutId="nav-active-pill"
                      style={{
                        position: "absolute", inset: 0, borderRadius: 9999,
                        background: "#ffffff",
                        zIndex: -1,
                      }}
                      transition={{ type: "spring", stiffness: 380, damping: 34 }}
                    />
                  )}
                  <Icon size={14} strokeWidth={active ? 1.8 : 1.3} />
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Position dots — spring animated */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {NAV.map((_, i) => (
              <motion.div
                key={i}
                animate={{
                  width:      i === currentIdx ? 16 : 3,
                  opacity:    i === currentIdx ? 0.75 : 0.18,
                  background: i === currentIdx ? "#ffffff" : "#ffffff",
                }}
                transition={{ type: "spring", stiffness: 360, damping: 30 }}
                style={{ height: 3, borderRadius: 99, background: "#ffffff" }}
              />
            ))}
          </div>
        </div>

        {/* Right: Help + Account chip (help button hidden on mobile) */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>

          {/* Help button — hidden on mobile */}
          <a
            href="mailto:hello@profitdash.io?subject=Support request"
            title="Get help"
            style={{
              width: 32, height: 32, borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.03)",
              display: isMobile ? "none" : "flex", alignItems: "center", justifyContent: "center",
              color: "rgba(255,255,255,0.32)",
              fontSize: 13, fontWeight: 600, textDecoration: "none",
              transition: "color 0.15s, background 0.15s",
              letterSpacing: "-0.01em",
              flexShrink: 0,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.65)";
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.32)";
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
            }}
          >
            ?
          </a>

          {/* Account chip — simplified on mobile (no subtitle) */}
          <Link href="/dashboard/profile" style={{ textDecoration: "none" }}>
            <div style={{
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.09)",
              background: "rgba(255,255,255,0.03)",
              padding: isMobile ? "7px 10px" : "7px 8px 7px 14px",
              display: "flex", alignItems: "center",
              justifyContent: "space-between",
              gap: isMobile ? 10 : 14,
              cursor: "pointer",
              transition: "background 0.2s",
            }}>
              {!isMobile && (
                <div>
                  <div style={{
                    fontSize: 13, letterSpacing: "-0.02em", fontWeight: 500,
                    color: "rgba(255,255,255,0.85)", lineHeight: 1.25,
                    whiteSpace: "nowrap",
                  }}>
                    {me.name || "—"}
                  </div>
                  <div style={{
                    marginTop: 2, fontSize: 11,
                    color: "rgba(255,255,255,0.38)",
                    whiteSpace: "nowrap",
                  }}>
                    {me.role || "Operator"} · {me.plan || "…"}
                  </div>
                </div>
              )}
              <div style={{
                height: 30, width: 30, borderRadius: 9, flexShrink: 0,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.05)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 600,
                color: "rgba(255,255,255,0.70)",
                letterSpacing: "0.01em",
              }}>
                {me.initials || "—"}
              </div>
            </div>
          </Link>
        </div>
      </motion.header>

      {/* ── Page Content ───────────────────────────────────────────────────── */}
      <main style={{
        flex: 1,
        overflow: "auto",
        position: "relative",
        paddingBottom: isMobile ? 72 : 0,
      }}>
        {/* Ambient violet vignette at top */}
        <div className="page-vignette" style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 300,
          pointerEvents: "none", zIndex: 0,
        }} />

        {/* Bannière sécurité postback — persiste au travers des navigations.
            S'affiche uniquement si grace period active ou downgrade récent. */}
        <div style={{
          position: "relative", zIndex: 2,
          padding: isMobile ? "12px 16px 0" : "16px 28px 0",
        }}>
          <PostbackSafetyBanner />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.38, ease: [0.23, 1, 0.32, 1] }}
          >
            {children}
          </motion.div>
        </AnimatePresence>

      </main>

      {/* ── Mobile Bottom Tab Bar (mobile only) ───────────────────────────── */}
      {isMobile && (
        <nav style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          background: "rgba(13,13,16,0.95)",
          backdropFilter: "blur(28px)",
          WebkitBackdropFilter: "blur(28px)",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
          height: 56,
          paddingBottom: "env(safe-area-inset-bottom, 8px)",
        }}>
          {[
            { href: "/dashboard", label: "Performance", icon: IconGauge },
            { href: "/dashboard/campaigns", label: "Execution", icon: IconTarget },
            { href: "/dashboard/statistics", label: "Analytics", icon: IconActivity },
            { href: "/dashboard/rules", label: "Rules", icon: IconBrain },
            { href: "/dashboard/settings", label: "Settings", icon: IconSliders },
          ].map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  flex: 1,
                  textDecoration: "none",
                  padding: "8px 0",
                  transition: "opacity 0.2s",
                  opacity: active ? 1 : 0.7,
                }}
              >
                <Icon size={14} strokeWidth={active ? 1.8 : 1.3} color={active ? "#ffffff" : "rgba(113,113,122,0.9)"} />
                <span style={{
                  fontSize: 9,
                  fontWeight: active ? 500 : 400,
                  color: active ? "#ffffff" : "rgba(113,113,122,0.9)",
                  whiteSpace: "nowrap",
                  lineHeight: 1.1,
                }}>
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
