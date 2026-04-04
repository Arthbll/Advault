"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconGauge, IconTarget, IconActivity, IconWallet, IconVault, IconSliders,
  IconBrain,
} from "@/components/ui/Icons";
import GettingStarted from "@/components/dashboard/GettingStarted";

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
  const [isDemo, setIsDemo] = useState(false);
  const [demoBannerDismissed, setDemoBannerDismissed] = useState(false);

  const currentIdx = NAV_HREFS.findIndex(
    href => pathname === href || (href !== "/dashboard" && pathname.startsWith(href))
  );

  useEffect(() => {
    fetch("/api/me")
      .then(r => r.ok ? r.json() : null)
      .then((d: MeData | null) => { if (d) setMe(d); })
      .catch(() => {});

    fetch("/api/user/status")
      .then(r => r.ok ? r.json() : null)
      .then((d: { hasAccounts: boolean; hasCampaigns: boolean } | null) => {
        if (d && !d.hasAccounts) setIsDemo(true);
      })
      .catch(() => {});
  }, []);


  return (
    <div style={{ height: "100vh", background: "#0d0d10", display: "flex", flexDirection: "column" }}>

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

        {/* Center: Nav pill + dots */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
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

        {/* Right: Help + Account chip */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>

          {/* Help button */}
          <a
            href="mailto:hello@profitdash.io?subject=Support request"
            title="Get help"
            style={{
              width: 32, height: 32, borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.03)",
              display: "flex", alignItems: "center", justifyContent: "center",
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

          {/* Account chip — direction C: name · plan · avatar */}
          <Link href="/dashboard/profile" style={{ textDecoration: "none" }}>
            <div style={{
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.09)",
              background: "rgba(255,255,255,0.03)",
              padding: "7px 8px 7px 14px",
              display: "flex", alignItems: "center",
              justifyContent: "space-between",
              gap: 14,
              cursor: "pointer",
              transition: "background 0.2s",
            }}>
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
      <main style={{ flex: 1, overflow: "auto", position: "relative" }}>
        {/* Ambient violet vignette at top */}
        <div className="page-vignette" style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 300,
          pointerEvents: "none", zIndex: 0,
        }} />

        {/* Demo mode banner */}
        <AnimatePresence>
          {isDemo && !demoBannerDismissed && (
            <motion.div
              key="demo-banner"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4, ease: EASE }}
              style={{ padding: "10px 22px 0" }}
            >
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: 12, padding: "9px 16px 9px 18px",
                borderRadius: 12,
                background: "rgba(245,158,11,0.07)",
                border: "1px solid rgba(251,191,36,0.18)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: "#fbbf24", flexShrink: 0,
                    boxShadow: "0 0 6px rgba(251,191,36,0.6)",
                  }} />
                  <span style={{ fontSize: 12, color: "rgba(253,230,138,0.85)", lineHeight: 1.5 }}>
                    You are viewing demo data.{" "}
                    <Link
                      href="/dashboard/settings"
                      style={{ color: "rgba(253,230,138,1)", textDecoration: "underline", textDecorationColor: "rgba(253,230,138,0.4)" }}
                    >
                      Connect your first ad network
                    </Link>
                    {" "}to see your real metrics.
                  </span>
                </div>
                <button
                  onClick={() => setDemoBannerDismissed(true)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "rgba(253,230,138,0.4)", fontSize: 16, lineHeight: 1,
                    padding: "0 2px", flexShrink: 0,
                    transition: "color 0.15s",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "rgba(253,230,138,0.8)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(253,230,138,0.4)"; }}
                >
                  ×
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Getting Started */}
        <div style={{ paddingTop: 14 }}>
          <GettingStarted hasAccounts={false} hasCampaigns={false} />
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
    </div>
  );
}
