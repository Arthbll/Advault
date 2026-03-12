"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, BarChart2, List, Settings, Zap, KeyRound, ChevronLeft, ChevronRight, Flame } from "lucide-react";
import AiChat from "@/components/ai/AiChat";

const NAV = [
  { href: "/dashboard",            icon: LayoutDashboard, label: "Dashboard"    },
  { href: "/dashboard/campaigns",  icon: List,            label: "Campagnes"    },
  { href: "/dashboard/statistics", icon: BarChart2,       label: "Statistiques" },
  { href: "/dashboard/vault",      icon: KeyRound,        label: "Vault"        },
  { href: "/dashboard/settings",   icon: Settings,        label: "Paramètres"   },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [navSpot, setNavSpot] = useState<{ href: string; x: number; y: number } | null>(null);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    // Streak : nb de jours consécutifs depuis streakStartDate (stocké après chaque sync positif)
    const start = localStorage.getItem("streakStartDate");
    if (start) {
      const days = Math.floor((Date.now() - new Date(start).getTime()) / 86400_000);
      setStreak(Math.max(1, days + 1));
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  function toggle() {
    setCollapsed(v => {
      localStorage.setItem("sidebar-collapsed", String(!v));
      return !v;
    });
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0A0A0B" }}>

      {/* ── Sidebar ── */}
      <motion.aside
        animate={{ width: collapsed ? 64 : 220 }}
        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
        style={{
          background:    "rgba(12,12,14,0.92)",
          backdropFilter: "blur(24px) saturate(160%)",
          WebkitBackdropFilter: "blur(24px) saturate(160%)",
          borderRight:   "1px solid rgba(255,255,255,0.06)",
          position:      "sticky", top: 0, height: "100vh",
          display:       "flex", flexDirection: "column",
          flexShrink:    0, overflow: "hidden",
          zIndex:        10,
        }}
      >
        {/* Logo row */}
        <div style={{ display: "flex", alignItems: "center", padding: "22px 14px 18px", minHeight: 60, gap: 10 }}>
          <motion.button
            onClick={toggle}
            whileTap={{ scale: 0.92 }}
            style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 800,
              background: "#FFD60A", color: "#000000", border: "none",
              boxShadow: "0 0 0 1px rgba(255,214,10,0.3), 0 2px 12px rgba(255,214,10,0.4)",
              letterSpacing: "-0.01em", cursor: "pointer",
            }}
          >
            AV
          </motion.button>

          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.18 }}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flex: 1, overflow: "hidden" }}
              >
                <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: "-0.02em", color: "#F5F5F7", whiteSpace: "nowrap" }}>
                  AdVault
                </span>
                <button
                  onClick={toggle}
                  style={{
                    width: 22, height: 22, borderRadius: 7, border: "1px solid rgba(255,255,255,0.08)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: "transparent", color: "#48484A",
                    cursor: "pointer", flexShrink: 0,
                  }}
                >
                  <ChevronLeft size={10} strokeWidth={2} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {collapsed && (
            <motion.button
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              onClick={toggle}
              style={{
                position: "absolute", right: -1, top: "50%", transform: "translateY(-50%)",
                width: 16, height: 32, borderRadius: "0 8px 8px 0",
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
                borderLeft: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#48484A",
              }}
            >
              <ChevronRight size={9} strokeWidth={2} />
            </motion.button>
          )}
        </div>

        {/* Nav label */}
        <AnimatePresence>
          {!collapsed && (
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 0.4 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{
                padding: "0 14px 8px",
                fontSize: 9, fontWeight: 700,
                letterSpacing: "0.1em", textTransform: "uppercase",
                color: "#52525B",
              }}
            >
              Navigation
            </motion.p>
          )}
        </AnimatePresence>

        {/* Nav items */}
        <nav style={{ display: "flex", flexDirection: "column", gap: 1, padding: "0 7px", flex: 1 }}>
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            const isSpotted = navSpot?.href === href;
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                style={{
                  height: 38,
                  paddingLeft:  collapsed ? 0 : 10,
                  paddingRight: collapsed ? 0 : 10,
                  justifyContent: collapsed ? "center" : "flex-start",
                  gap: collapsed ? 0 : 9,
                  display: "flex", alignItems: "center",
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  color: active ? "#00FF87" : "#52525B",
                  background: active ? "rgba(0,255,135,0.08)" : "transparent",
                  textDecoration: "none",
                  transition: "color 0.15s, background 0.15s",
                  position: "relative",
                  overflow: "hidden",
                }}
                onMouseMove={e => {
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setNavSpot({ href, x: e.clientX - rect.left, y: e.clientY - rect.top });
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.color = "#A1A1AA";
                  }
                }}
                onMouseLeave={e => {
                  setNavSpot(null);
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.color = "#52525B";
                  }
                }}
              >
                {/* Spotlight halo */}
                {isSpotted && (
                  <div
                    style={{
                      position: "absolute", inset: 0, borderRadius: 10, pointerEvents: "none",
                      background: active
                        ? `radial-gradient(70px circle at ${navSpot!.x}px ${navSpot!.y}px, rgba(0,255,135,0.12), transparent 70%)`
                        : `radial-gradient(70px circle at ${navSpot!.x}px ${navSpot!.y}px, rgba(255,255,255,0.05), transparent 70%)`,
                    }}
                  />
                )}

                {/* Active indicator bar */}
                {active && (
                  <span style={{
                    position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
                    width: 2.5, height: 18, borderRadius: 2,
                    background: "#00FF87",
                    boxShadow: "0 0 8px rgba(0,255,135,0.6)",
                  }} />
                )}

                <Icon
                  size={15}
                  strokeWidth={active ? 2 : 1.5}
                  style={{
                    flexShrink: 0,
                    color: active ? "#00FF87" : "inherit",
                    filter: active ? "drop-shadow(0 0 4px rgba(0,255,135,0.5))" : "none",
                  }}
                />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.16 }}
                      style={{ whiteSpace: "nowrap", overflow: "hidden" }}
                    >
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div style={{ padding: "0 7px 20px", display: "flex", flexDirection: "column", gap: 4 }}>

          {/* Streak badge */}
          {streak > 0 && (
            <div
              title={collapsed ? `${streak}j en positif` : undefined}
              style={{
                display: "flex", alignItems: "center",
                height: 32, borderRadius: 10,
                gap: collapsed ? 0 : 7,
                paddingLeft: collapsed ? 0 : 10,
                justifyContent: collapsed ? "center" : "flex-start",
                background: "rgba(255,160,50,0.06)",
                border: "1px solid rgba(255,160,50,0.12)",
              }}
            >
              <Flame size={11} strokeWidth={2} style={{ color: "#FF9F0A", filter: "drop-shadow(0 0 4px rgba(255,160,50,0.5))", flexShrink: 0 }} />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.16 }}
                    style={{ fontSize: 10, fontWeight: 600, color: "#FF9F0A", whiteSpace: "nowrap", overflow: "hidden", letterSpacing: "0.02em" }}
                  >
                    {streak}j en positif
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Kill-switch pill */}
          <div
            title={collapsed ? "Kill-Switch actif" : undefined}
            style={{
              display: "flex", alignItems: "center",
              height: 32, borderRadius: 10,
              gap: collapsed ? 0 : 8,
              paddingLeft: collapsed ? 0 : 10,
              justifyContent: collapsed ? "center" : "flex-start",
              background: "rgba(0,255,135,0.06)",
              border: "1px solid rgba(0,255,135,0.1)",
            }}
          >
            <motion.div
              animate={{ opacity: [1, 0.2, 1], scale: [1, 0.85, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Zap size={11} strokeWidth={2} style={{ color: "#00FF87", filter: "drop-shadow(0 0 4px rgba(0,255,135,0.6))" }} />
            </motion.div>
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.16 }}
                  style={{ fontSize: 10, fontWeight: 600, color: "#00FF87", whiteSpace: "nowrap", overflow: "hidden", letterSpacing: "0.02em" }}
                >
                  Kill-Switch actif
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* Profile */}
          <Link
            href="/dashboard/profile"
            title={collapsed ? "Mon profil" : undefined}
            style={{
              display: "flex", alignItems: "center",
              height: 44, borderRadius: 10,
              gap: collapsed ? 0 : 9,
              paddingLeft: collapsed ? 0 : 10,
              justifyContent: collapsed ? "center" : "flex-start",
              background: pathname === "/dashboard/profile" ? "rgba(0,255,135,0.06)" : "transparent",
              transition: "background 0.15s", textDecoration: "none",
              border: pathname === "/dashboard/profile" ? "1px solid rgba(0,255,135,0.1)" : "1px solid transparent",
            }}
            onMouseEnter={e => {
              if (pathname !== "/dashboard/profile") (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
            }}
            onMouseLeave={e => {
              if (pathname !== "/dashboard/profile") (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            <div style={{
              width: 26, height: 26, borderRadius: 8, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9, fontWeight: 800, letterSpacing: "-0.01em",
              background: "#FFD60A", color: "#000000",
              boxShadow: "0 0 8px rgba(255,214,10,0.35)",
            }}>
              AB
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.16 }}
                  style={{ display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}
                >
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#F5F5F7", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>Arthur B.</span>
                  <span style={{ fontSize: 10, color: "#3F3F46", whiteSpace: "nowrap" }}>Mon profil</span>
                </motion.div>
              )}
            </AnimatePresence>
          </Link>
        </div>
      </motion.aside>

      {/* ── Main content ── */}
      <main style={{ flex: 1, overflow: "auto", background: "#0A0A0B" }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
        <AiChat />
      </main>
    </div>
  );
}
