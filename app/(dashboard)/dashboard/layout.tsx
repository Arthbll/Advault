"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Flame, Search } from "lucide-react";
import AiChat from "@/components/ai/AiChat";

const NAV = [
  { href: "/dashboard",            label: "Dashboard"  },
  { href: "/dashboard/campaigns",  label: "Campagnes"  },
  { href: "/dashboard/statistics", label: "Stats"      },
  { href: "/dashboard/vault",      label: "Vault"      },
  { href: "/dashboard/settings",   label: "Paramètres" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    const start = localStorage.getItem("streakStartDate");
    if (start) {
      const days = Math.floor((Date.now() - new Date(start).getTime()) / 86400_000);
      setStreak(Math.max(1, days + 1));
    }
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#0d0d10", display: "flex", flexDirection: "column" }}>

      {/* ── Top Navigation Bar ─────────────────────────────────────────────── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        height: 68,
        background: "rgba(13,13,16,0.88)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        padding: "0 28px",
        gap: 16,
      }}>

        {/* Left: Brand */}
        <div style={{
          fontWeight: 300, fontSize: 20,
          color: "rgba(255,255,255,0.92)",
          letterSpacing: "-0.03em",
        }}>
          AdVault
        </div>

        {/* Center: Nav pill */}
        <nav style={{
          display: "flex",
          alignItems: "center",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 9999,
          padding: "5px 6px",
          gap: 2,
        }}>
          {NAV.map(({ href, label }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: "inline-block",
                  padding: "7px 18px",
                  borderRadius: 9999,
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  color: active ? "#000000" : "rgba(113,113,122,0.9)",
                  background: active ? "#ffffff" : "transparent",
                  textDecoration: "none",
                  transition: "all 0.15s ease",
                  whiteSpace: "nowrap" as const,
                }}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Right: Search + Streak + Kill-Switch + User */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>

          {/* Search */}
          <button style={{
            width: 34, height: 34, borderRadius: 10,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}>
            <Search size={14} color="rgba(113,113,122,0.9)" strokeWidth={1.5} />
          </button>

          {/* Streak */}
          {streak > 0 && (
            <div style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "5px 10px", borderRadius: 8,
              background: "rgba(255,160,50,0.08)",
              border: "1px solid rgba(255,160,50,0.15)",
            }}>
              <Flame size={11} color="#FF9F0A" strokeWidth={2} />
              <span style={{ fontSize: 11, fontWeight: 600, color: "#FF9F0A" }}>{streak}j</span>
            </div>
          )}

          {/* Kill-Switch */}
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "5px 10px", borderRadius: 8,
            background: "rgba(0,255,135,0.06)",
            border: "1px solid rgba(0,255,135,0.1)",
          }}>
            <motion.div animate={{ opacity: [1, 0.3, 1], scale: [1, 0.85, 1] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
              <Zap size={11} color="#00FF87" strokeWidth={2} style={{ filter: "drop-shadow(0 0 4px rgba(0,255,135,0.6))" }} />
            </motion.div>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#00FF87" }}>Live</span>
          </div>

          {/* User */}
          <Link href="/dashboard/profile" style={{
            textDecoration: "none",
            display: "flex", alignItems: "center", gap: 9,
            padding: "5px 12px 5px 6px", borderRadius: 10,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: 8, flexShrink: 0,
              background: "#FFD60A", color: "#000",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9, fontWeight: 800,
              boxShadow: "0 0 8px rgba(255,214,10,0.35)",
            }}>
              AB
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#F5F5F7", lineHeight: 1.2 }}>Arthur B.</div>
              <div style={{ fontSize: 10, color: "#52525b" }}>Admin</div>
            </div>
          </Link>
        </div>
      </header>

      {/* ── Page Content ───────────────────────────────────────────────────── */}
      <main style={{ flex: 1, overflow: "auto" }}>
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
