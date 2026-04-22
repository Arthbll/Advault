"use client";

import React, { useState, useEffect, useTransition, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, ShieldCheck, ShieldOff, AlertCircle, X } from "lucide-react";
import { enrollMFA, verifyMFA, listMFAFactors } from "@/app/actions/mfa";
import {
  createRecoveryCodes,
  getRecoveryCodeStats,
  regenerateRecoveryCodes,
  unenrollMFAWithConfirmation,
} from "@/app/actions/recovery-codes";
import AutoSyncSettings    from "./AutoSyncSettings";
import NotificationSettings from "./NotificationSettings";
import NetworkCard          from "./NetworkCard";
import { NetworkErrorCard, PostbackHealthCard } from "@/components/ui/SyncErrorCard";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface KSConfig {
  killSwitchEnabled: boolean;
  roiThreshold: number;
  maxSpendPerCampaign: number | null;
  checkIntervalMinutes: number;
}

interface AccountInfo {
  network: string;
  isActive: boolean;
}

interface TeamMemberData {
  id: string;
  memberId: string;
  email: string;
  role: string;
  createdAt: string;
}

interface PendingInviteData {
  id: string;
  email: string;
  token: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  inviteUrl: string;
}

interface Props {
  connectedCount: number;
  accounts: AccountInfo[];
  ksSettings: KSConfig;
  plan?: string;
  teamMembers?: TeamMemberData[];
  pendingInvites?: PendingInviteData[];
  timezone?: string;
  currency?: string;
}

// ─── Network configs ────────────────────────────────────────────────────────────
const NETWORK_CONFIGS = [
  { network: "EXOCLICK",      label: "ExoClick",      description: "Adult & mainstream ad network",  color: "#c08835", glow: "rgba(192,136,53,0.14)",   hasSecret: false, keyLabel: "API Key" },
  { network: "TRAFFICSTARS",  label: "TrafficStars",  description: "Premium display ad network",     color: "#7264a8", glow: "rgba(114,100,168,0.14)",  hasSecret: false, keyLabel: "API Key (Refresh Token)" },
  { network: "TRAFFICJUNKY",  label: "TrafficJunky",  description: "Video & display advertising",   color: "#4a8fb4", glow: "rgba(74,143,180,0.14)",   hasSecret: false, keyLabel: "API Key" },
  { network: "PROPELLERADS",  label: "PropellerAds",  description: "Push & popunder ad network",    color: "#f97316", glow: "rgba(249,115,22,0.14)",   hasSecret: false, keyLabel: "API Token" },
  { network: "ADSTERRA",      label: "Adsterra",      description: "Multi-format ad network",       color: "#06b6d4", glow: "rgba(6,182,212,0.14)",    hasSecret: false, keyLabel: "API Key" },
] as const;

// ─── Tone tokens ────────────────────────────────────────────────────────────────
const TONES = {
  amber:   { border: "rgba(251,191,36,0.16)",  bg: "rgba(245,158,11,0.08)",  text: "rgba(253,230,138,1)" },
  violet:  { border: "rgba(167,139,250,0.16)", bg: "rgba(139,92,246,0.08)", text: "rgba(221,214,254,1)" },
  sky:     { border: "rgba(56,189,248,0.16)",  bg: "rgba(14,165,233,0.08)", text: "rgba(186,230,253,1)" },
  emerald: { border: "rgba(52,211,153,0.16)",  bg: "rgba(16,185,129,0.08)", text: "rgba(167,243,208,1)" },
  rose:    { border: "rgba(251,113,133,0.16)", bg: "rgba(244,63,94,0.08)",  text: "rgba(254,205,211,1)" },
  white:   { border: "rgba(255,255,255,0.10)", bg: "rgba(255,255,255,0.04)", text: "rgba(255,255,255,0.70)" },
} as const;
type ToneKey = keyof typeof TONES;

// ─── Navigation ─────────────────────────────────────────────────────────────────
type Tab = "overview" | "connections" | "postbacks" | "plan" | "team" | "security" | "workspace";

// ─── Security log types ──────────────────────────────────────────────────────────
type SyncLogEntry = {
  id: string; type: string; isError: boolean; network: string;
  detail: string; time: string; datetime: string; createdAt: string;
};
type AuditEntry = {
  id: string; type: string; action: string;
  tone: "rose" | "amber" | "emerald" | "blue" | "white";
  campaign: string; network: string; detail: string;
  time: string; datetime: string; createdAt: string;
};
type SecurityLogsData = {
  syncLogs:   SyncLogEntry[];
  auditTrail: AuditEntry[];
  syncTotal:  number;
  auditTotal: number;
};

const NAV_ITEMS: { id: Tab; label: string }[] = [
  { id: "overview",    label: "Overview" },
  { id: "connections", label: "Connections" },
  { id: "postbacks",   label: "Postbacks" },
  { id: "plan",        label: "Plan" },
  { id: "team",        label: "Team & Roles" },
  { id: "workspace",   label: "Workspace" },
  { id: "security",    label: "Security" },
];


// ─── Shared micro-components ────────────────────────────────────────────────────
function Badge({ tone, children }: { tone: ToneKey; children: React.ReactNode }) {
  const t = TONES[tone];
  return (
    <span style={{
      display: "inline-flex", borderRadius: 9999, border: `1px solid ${t.border}`,
      padding: "3px 12px", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.22em",
      background: t.bg, color: t.text, whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  );
}

function CardDark({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      borderRadius: 24, border: "1px solid rgba(255,255,255,0.08)",
      background: "linear-gradient(180deg,rgba(17,18,25,0.98),rgba(12,13,19,0.98))",
      padding: "20px 22px", ...style,
    }}>
      {children}
    </div>
  );
}

function CardSm({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      borderRadius: 24, border: "1px solid rgba(255,255,255,0.08)",
      background: "rgba(255,255,255,0.02)", padding: 20, ...style,
    }}>
      {children}
    </div>
  );
}

function BtnXs({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        borderRadius: 10, border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.70)",
        padding: "6px 12px", fontSize: 11, cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function NavEntryCard({
  tone, label, desc, onClick,
}: {
  tone: ToneKey; label: string; desc: string; onClick: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        borderRadius: 26,
        border: `1px solid ${hov ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.08)"}`,
        background: "linear-gradient(180deg,rgba(17,18,25,0.98),rgba(12,13,19,0.98))",
        padding: 20, minHeight: 190, cursor: "pointer",
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        transition: "border-color 0.2s",
      }}
    >
      <div>
        <Badge tone={tone}>{label}</Badge>
        <div style={{ fontSize: 24, fontWeight: 200, letterSpacing: "-0.04em", marginTop: 18, color: "rgba(255,255,255,0.92)" }}>
          {label}
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.75, color: "rgba(255,255,255,0.40)", marginTop: 10 }}>
          {desc}
        </div>
      </div>
      <div style={{
        borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.03)", height: 44, padding: "0 16px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        fontSize: 13, color: "rgba(255,255,255,0.70)", marginTop: 16,
      }}>
        <span>Manage</span><span>→</span>
      </div>
    </div>
  );
}

// SeedDataCard supprimé — route debug retirée de la production

// ─── Shell header config ─────────────────────────────────────────────────────────
const SHELL_CONFIG: Record<Tab, { eyebrow: string; sub: string }> = {
  overview:    { eyebrow: "Settings hub",    sub: "Integration health, team access, and configuration." },
  connections: { eyebrow: "Ad Networks",     sub: "Connect your ad network accounts. Review API sync health and manage credentials." },
  postbacks:   { eyebrow: "Revenue Signal",  sub: "Affiliate sources, global postback URL, and revenue signal health." },
  plan:        { eyebrow: "Subscription",    sub: "Your current plan and what comes with it. Upgrade or downgrade at any time." },
  team:        { eyebrow: "Access Control",  sub: "Invite teammates, assign roles, and manage workspace access." },
  workspace:   { eyebrow: "Preferences",     sub: "Timezone, display currency, and data exports." },
  security:    { eyebrow: "Security",        sub: "Credentials, event logs, and workspace tools." },
};

const SHELL_TITLES: Record<Tab, string> = {
  overview:    "Settings",
  connections: "Connections",
  postbacks:   "Postbacks",
  plan:        "Plan",
  team:        "Team & Roles",
  workspace:   "Workspace",
  security:    "Security",
};

// ─── Main component ─────────────────────────────────────────────────────────────
export default function SettingsPageClient({
  connectedCount,
  accounts,
  ksSettings,
  plan = "Observer",
  teamMembers: initialTeamMembers = [],
  pendingInvites: initialPendingInvites = [],
  timezone: initialTimezone = "UTC",
  currency: initialCurrency = "USD",
}: Props) {
  const searchParams = useSearchParams();
  const [tab, setTab]                     = useState<Tab>(() => {
    const t = searchParams?.get("tab");
    const VALID_TABS: Tab[] = ["overview","connections","postbacks","plan","team","workspace","security"];
    return (VALID_TABS.includes(t as Tab) ? t as Tab : "overview");
  });
  const [postbackUrl, setPostbackUrl]     = useState<string | null>(null);
  const [postbackToken, setPostbackToken] = useState<string | null>(null);
  const [postbackUid, setPostbackUid]     = useState<string | null>(null);
  const [pbCopied, setPbCopied]           = useState(false);
  const [tokenCopied, setTokenCopied]     = useState(false);
  // Postback sources — loaded from real conversion data
  type PbSource = { source: string; revenue: number; count: number; approvedCount: number };
  const [pbSources, setPbSources]         = useState<PbSource[] | null>(null);
  const [pbHealth,  setPbHealth]          = useState<number | null>(null);
  const [pbSourcesLoaded, setPbSourcesLoaded] = useState(false);
  const [inviteEmail, setInviteEmail]     = useState("");

  // Team state
  const [teamMembers, setTeamMembers]       = useState<TeamMemberData[]>(initialTeamMembers);
  const [pendingInvites, setPendingInvites] = useState<PendingInviteData[]>(initialPendingInvites);
  const [inviting, setInviting]             = useState(false);
  const [inviteResult, setInviteResult]     = useState<{ url?: string; error?: string } | null>(null);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [inviteRole, setInviteRole]         = useState<"editor" | "viewer">("editor");

  // Workspace settings state
  const [wsTimezone, setWsTimezone]   = useState(initialTimezone);
  const [wsCurrency, setWsCurrency]   = useState(initialCurrency);
  const [wsSaving, setWsSaving]       = useState(false);
  const [wsSaved, setWsSaved]         = useState(false);

  // Plan state
  const [currentPlan, setCurrentPlan]   = useState(plan);
  const [planLoading, setPlanLoading]   = useState<string | null>(null); // which plan is loading
  const [planError, setPlanError]       = useState<string | null>(null);

  // Security logs state
  const [secLogs,    setSecLogs]    = useState<SecurityLogsData | null>(null);
  const [secLoading, setSecLoading] = useState(false);
  type SecView = null | "credentials" | "sync-logs" | "audit-trail";
  const [secView, setSecView] = useState<SecView>(null);

  useEffect(() => {
    if (tab !== "postbacks" || pbSourcesLoaded) return;
    setPbSourcesLoaded(true);
    const today = new Date().toISOString().slice(0, 10);
    const from  = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
    fetch(`/api/conversions?dateFrom=${from}&dateTo=${today}&page=0&limit=0`)
      .then(r => r.ok ? r.json() : null)
      .then((d: { bySource?: { source: string; revenue: number; count: number; approvedCount?: number }[]; healthPct?: number } | null) => {
        if (d) {
          setPbSources(d.bySource?.map(s => ({ ...s, approvedCount: s.approvedCount ?? 0 })) ?? []);
          setPbHealth(d.healthPct ?? null);
        }
      })
      .catch(() => { setPbSources([]); });
  }, [tab, pbSourcesLoaded]);

  useEffect(() => {
    if (tab !== "postbacks" || postbackUrl) return;
    fetch("/api/postback-token")
      .then(r => r.ok ? r.json() : null)
      .then((d: { postbackUrl?: string; token?: string; uid?: string } | null) => {
        if (d?.postbackUrl) setPostbackUrl(d.postbackUrl);
        if (d?.token)       setPostbackToken(d.token);
        if (d?.uid)         setPostbackUid(d.uid);
      })
      .catch(() => {});
  }, [tab, postbackUrl]);

  useEffect(() => {
    if (tab !== "security" || secLogs !== null) return;
    setSecLoading(true);
    fetch("/api/security/logs?limit=50")
      .then(r => r.ok ? r.json() : null)
      .then((d: SecurityLogsData | null) => { if (d) setSecLogs(d); })
      .catch(() => {})
      .finally(() => setSecLoading(false));
  }, [tab, secLogs]);

  function copyText(text: string, setter: (v: boolean) => void) {
    navigator.clipboard.writeText(text).then(() => {
      setter(true); setTimeout(() => setter(false), 2000);
    }).catch(() => {});
  }

  // ── Plan actions ──────────────────────────────────────────────────────────────
  async function handlePlanChange(newPlan: string) {
    setPlanLoading(newPlan);
    setPlanError(null);
    try {
      const res = await fetch("/api/plan/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: newPlan }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || data.error) {
        setPlanError(data.error ?? "Failed to update plan");
      } else {
        setCurrentPlan(newPlan);
      }
    } catch {
      setPlanError("Network error");
    } finally {
      setPlanLoading(null);
    }
  }

  // ── Team actions ──────────────────────────────────────────────────────────────
  async function handleInvite() {
    if (!inviteEmail.includes("@")) return;
    setInviting(true);
    setInviteResult(null);
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim().toLowerCase(), role: inviteRole }),
      });
      const data = await res.json() as { ok?: boolean; inviteUrl?: string; error?: string; alreadyExists?: boolean };
      if (!res.ok || data.error) {
        setInviteResult({ error: data.error ?? "Failed to create invite" });
      } else {
        setInviteResult({ url: data.inviteUrl });
        setInviteEmail("");
        // Refresh invite list
        const invRes = await fetch("/api/team/invites");
        if (invRes.ok) setPendingInvites(await invRes.json());
      }
    } catch {
      setInviteResult({ error: "Network error" });
    } finally {
      setInviting(false);
    }
  }

  async function handleRevokeInvite(inviteId: string) {
    await fetch(`/api/team/invites/${inviteId}`, { method: "DELETE" });
    setPendingInvites(prev => prev.filter(i => i.id !== inviteId));
  }

  async function handleRemoveMember(memberId: string) {
    await fetch(`/api/team/members/${memberId}`, { method: "DELETE" });
    setTeamMembers(prev => prev.filter(m => m.id !== memberId));
  }

  function copyInviteUrl(inviteId: string, url: string) {
    navigator.clipboard.writeText(url).catch(() => {});
    setCopiedInviteId(inviteId);
    setTimeout(() => setCopiedInviteId(null), 2000);
  }

  // ── Overview ──────────────────────────────────────────────────────────────────
  function renderOverview() {
    const memberCount = initialTeamMembers.length + 1; // +1 for the account owner
    const statCards = [
      { label: "Networks",  value: NETWORK_CONFIGS.length, sub: `${connectedCount} connected · ${NETWORK_CONFIGS.length - connectedCount} not set up` },
      { label: "Postbacks", value: "—",                    sub: "Configure in Postbacks" },
      { label: "Team",      value: memberCount,             sub: memberCount === 1 ? "Just you" : `${memberCount} member${memberCount !== 1 ? "s" : ""}` },
    ];
    const navCards: { tone: ToneKey; id: Tab; desc: string }[] = [
      { tone: "amber",   id: "connections", desc: "Ad network APIs, credentials, sync health" },
      { tone: "emerald", id: "postbacks",   desc: "Affiliate sources, revenue signal, health" },
      { tone: "rose",    id: "plan",        desc: "Current subscription, upgrade or downgrade" },
      { tone: "sky",     id: "team",        desc: "Invites, permissions, access levels" },
      { tone: "white",   id: "security",    desc: "Secrets, audit trail, maintenance" },
    ];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {/* Violet insight + 3 stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 22 }}>
          <div style={{ borderRadius: 28, border: "1px solid rgba(167,139,250,0.16)", background: "rgba(139,92,246,0.08)", padding: "22px 24px" }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.22em", color: "rgba(196,181,253,0.8)" }}>
              Workspace health
            </div>
            <div style={{ fontSize: 28, fontWeight: 200, letterSpacing: "-0.04em", marginTop: 6, maxWidth: "22ch", color: "rgba(255,255,255,0.92)" }}>
              Your workspace at a glance.
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
            {statCards.map(s => (
              <CardSm key={s.label}>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.22em", color: "rgba(255,255,255,0.24)" }}>{s.label}</div>
                <div style={{ fontSize: 34, fontWeight: 200, letterSpacing: "-0.05em", lineHeight: 1, marginTop: 14, fontVariantNumeric: "tabular-nums" }}>{s.value}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.36)", marginTop: 8 }}>{s.sub}</div>
              </CardSm>
            ))}
          </div>
        </div>

        {/* 5 nav entry cards + 1 coming-soon placeholder */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18 }}>
          {navCards.map(nc => (
            <NavEntryCard
              key={nc.id}
              tone={nc.tone}
              label={SHELL_TITLES[nc.id]}
              desc={nc.desc}
              onClick={() => setTab(nc.id)}
            />
          ))}
          {/* Workspace card */}
          <div
            onClick={() => setTab("workspace")}
            style={{
              borderRadius: 26, border: "1px solid rgba(255,255,255,0.08)",
              background: "linear-gradient(180deg,rgba(17,18,25,0.80),rgba(12,13,19,0.80))",
              padding: 20, minHeight: 190, cursor: "pointer",
              display: "flex", flexDirection: "column", justifyContent: "space-between",
              transition: "border-color 0.2s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.18)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
          >
            <div>
              <Badge tone="white">Workspace</Badge>
              <div style={{ fontSize: 24, fontWeight: 200, letterSpacing: "-0.04em", marginTop: 18 }}>Workspace</div>
              <div style={{ fontSize: 13, lineHeight: 1.75, color: "rgba(255,255,255,0.40)", marginTop: 10 }}>Timezone, currency, exports</div>
            </div>
            <div style={{
              borderRadius: 16, border: "1px solid rgba(255,255,255,0.09)",
              background: "rgba(255,255,255,0.03)", height: 44, padding: "0 16px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              fontSize: 13, color: "rgba(255,255,255,0.50)",
            }}>
              <span>{wsTimezone} · {wsCurrency}</span>
              <span style={{ fontSize: 11, opacity: 0.5 }}>Configure →</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Connections ───────────────────────────────────────────────────────────────
  function renderConnections() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.22em", color: "rgba(255,255,255,0.24)" }}>Ad network APIs</div>
            <div style={{ fontSize: 28, fontWeight: 200, letterSpacing: "-0.04em", marginTop: 6 }}>Campaign data sources</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {NETWORK_CONFIGS.map((cfg, i) => {
            const acct = accounts.find(a => a.network === cfg.network);
            return (
              <motion.div
                key={cfg.network}
                initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.45, delay: i * 0.1, ease: [0.23, 1, 0.32, 1] }}
              >
                <NetworkCard
                  network={cfg.network as import("@prisma/client").Network}
                  label={cfg.label}
                  description={cfg.description}
                  color={cfg.color}
                  glow={cfg.glow}
                  hasSecret={cfg.hasSecret}
                  keyLabel={cfg.keyLabel}
                  secretLabel={undefined}
                  isConnected={acct?.isActive ?? false}
                  index={i}
                />
              </motion.div>
            );
          })}
        </div>

        {/* ── Disconnected networks error cards ─────────────────────────── */}
        {/* Only show for networks that WERE connected but became inactive — not for never-connected ones */}
        {NETWORK_CONFIGS.map((cfg, i) => {
          const acct = accounts.find(a => a.network === cfg.network);
          // Skip: never connected (no account row at all) — nothing to warn about
          if (!acct) return null;
          // Skip: actively connected
          if (acct.isActive) return null;
          // Show: was connected but is now inactive/broken
          return (
            <NetworkErrorCard
              key={cfg.network}
              networkLabel={cfg.label}
              description={`The ${cfg.label} API credentials are missing or inactive. Campaign data from this network is unavailable until the connection is restored.`}
              tone="rose"
              onReconnect={() => {
                // Scroll to the NetworkCard above for reconnect
              }}
              delay={i * 0.08}
            />
          );
        })}

        <div style={{ marginTop: 4 }}>
          <AutoSyncSettings />
        </div>
      </div>
    );
  }

  // ── Postbacks ─────────────────────────────────────────────────────────────────
  function renderPostbacks() {
    // Real sources derived from conversion data
    const realSources: { name: string; sub: string; status: string; tone: ToneKey }[] =
      (pbSources ?? []).map(s => ({
        name: s.source.charAt(0).toUpperCase() + s.source.slice(1),
        sub:  `${s.count} conversion event${s.count !== 1 ? "s" : ""} received`,
        status: s.count > 0 ? "Active" : "No data",
        tone:   s.count > 0 ? "emerald" : ("white" as ToneKey),
      }));
    const sources = realSources;
    const isLoadingSources = pbSources === null;
    const unhealthy = pbHealth !== null && pbHealth < 85;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>

        {/* ── Postback unhealthy card ──── */}
        {!isLoadingSources && unhealthy && pbHealth !== null && (
          <PostbackHealthCard
            healthPct={pbHealth}
            likelyCause="Missing or malformed click IDs in postback URL parameters."
            delay={0}
          />
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 22 }}>
        {/* Left: sources list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {isLoadingSources && (
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.25)", padding: "20px 0" }}>Loading sources…</div>
          )}
          {!isLoadingSources && sources.length === 0 && (
            <CardDark>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.25)", textAlign: "center", padding: "28px 0" }}>
                No affiliate sources yet.
                <div style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.15)" }}>
                  Sources appear here once your postback URL receives conversion events.
                </div>
              </div>
            </CardDark>
          )}
          {sources.map((s, i) => (
            <motion.div
              key={s.name}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
            >
              <CardDark style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 200, letterSpacing: "-0.04em" }}>{s.name}</div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.36)", marginTop: 6 }}>{s.sub}</div>
                </div>
                <Badge tone={s.tone}>{s.status}</Badge>
              </CardDark>
            </motion.div>
          ))}
        </div>

        {/* Right: postback URL + health */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ borderRadius: 24, border: "1px solid rgba(167,139,250,0.16)", background: "rgba(139,92,246,0.08)", padding: 20 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.22em", color: "rgba(196,181,253,0.8)" }}>
              Global postback URL
            </div>
            {postbackUrl ? (
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 14 }}>
                <div style={{
                  flex: 1, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(167,139,250,0.16)",
                  borderRadius: 12, padding: "12px 14px", fontSize: 12,
                  color: "rgba(221,214,254,0.80)", wordBreak: "break-all", lineHeight: 1.6,
                }}>
                  {postbackUrl}
                </div>
                <button
                  onClick={() => copyText(postbackUrl, setPbCopied)}
                  style={{
                    flexShrink: 0, width: 38, height: 38, borderRadius: 10,
                    background: pbCopied ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.06)",
                    border: `1px solid ${pbCopied ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.08)"}`,
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    color: pbCopied ? "#22c55e" : "rgba(255,255,255,0.5)", transition: "all 0.2s",
                  }}
                >
                  {pbCopied ? <Check size={14} strokeWidth={1.4} /> : <Copy size={14} strokeWidth={1.3} />}
                </button>
              </div>
            ) : (
              <div style={{ marginTop: 14, fontSize: 13, color: "rgba(255,255,255,0.2)" }}>Loading…</div>
            )}

            {postbackToken && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.22em", color: "rgba(196,181,253,0.8)", marginBottom: 8 }}>
                  Token
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{
                    flex: 1, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(167,139,250,0.16)",
                    borderRadius: 10, padding: "8px 12px", fontFamily: "monospace",
                    fontSize: 11, color: "rgba(255,255,255,0.5)", letterSpacing: "0.05em", overflow: "hidden",
                    textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {postbackToken}
                  </div>
                  <button
                    onClick={() => copyText(postbackToken, setTokenCopied)}
                    style={{
                      flexShrink: 0, width: 34, borderRadius: 10,
                      background: tokenCopied ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.06)",
                      border: `1px solid ${tokenCopied ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.08)"}`,
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                      color: tokenCopied ? "#22c55e" : "rgba(255,255,255,0.5)",
                    }}
                  >
                    {tokenCopied ? <Check size={12} strokeWidth={1.4} /> : <Copy size={12} strokeWidth={1.3} />}
                  </button>
                </div>
              </div>
            )}

            {postbackUid && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.22em", color: "rgba(196,181,253,0.8)", marginBottom: 8 }}>
                  User ID (uid)
                </div>
                <div style={{
                  background: "rgba(0,0,0,0.25)", border: "1px solid rgba(167,139,250,0.16)",
                  borderRadius: 10, padding: "8px 12px", fontFamily: "monospace",
                  fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: "0.03em",
                }}>
                  {postbackUid}
                </div>
              </div>
            )}
          </div>

          <CardSm>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.22em", color: "rgba(255,255,255,0.24)" }}>Health</div>
            {isLoadingSources ? (
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.2)", marginTop: 14 }}>Loading…</div>
            ) : pbHealth !== null ? (
              <>
                <div style={{
                  fontSize: 34, fontWeight: 200, letterSpacing: "-0.05em", lineHeight: 1, marginTop: 14,
                  color: pbHealth >= 85 ? "rgba(110,231,183,0.95)" : pbHealth >= 60 ? "rgba(251,191,36,0.95)" : "rgba(251,113,133,0.95)",
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {pbHealth.toFixed(1)}%
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.36)", marginTop: 8 }}>
                  {pbHealth >= 85 ? "Valid revenue signal ingestion" : pbHealth >= 60 ? "Signal degraded" : "Signal unhealthy"}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 34, fontWeight: 200, letterSpacing: "-0.05em", lineHeight: 1, marginTop: 14, color: "rgba(255,255,255,0.2)" }}>—</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.25)", marginTop: 8 }}>No data yet</div>
              </>
            )}
          </CardSm>
        </div>
      </div>
      </div>
    );
  }

  // ── Engine Defaults ───────────────────────────────────────────────────────────
  // ── Team & Roles ──────────────────────────────────────────────────────────────
  // ── Plan ──────────────────────────────────────────────────────────────────────
  function renderPlan() {
    const PLANS: {
      id: string;
      label: string;
      tagline: string;
      features: string[];
      tone: ToneKey;
    }[] = [
      {
        id: "Observer",
        label: "Observer",
        tagline: "Read-only visibility into your traffic",
        features: ["Performance dashboard", "Analytics & statistics", "Transaction history", "Vault access"],
        tone: "white",
      },
      {
        id: "Operator",
        label: "Operator",
        tagline: "Active campaign management",
        features: ["Everything in Observer", "Campaign execution", "Kill-switch engine", "Postback tracking"],
        tone: "sky",
      },
      {
        id: "Dominion",
        label: "Dominion",
        tagline: "Advanced automation & analytics",
        features: ["Everything in Operator", "Engine defaults & rules", "Advanced ROI tracking", "Priority sync intervals"],
        tone: "violet",
      },
      {
        id: "Command",
        label: "Command",
        tagline: "Full workspace with team management",
        features: ["Everything in Dominion", "Invite team members", "Role-based access", "Shared workspace"],
        tone: "rose",
      },
    ];

    const PLAN_ORDER = ["Observer", "Operator", "Dominion", "Command"];
    const currentIdx = PLAN_ORDER.indexOf(currentPlan);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <div>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.22em", color: "rgba(255,255,255,0.24)" }}>
            Current plan
          </div>
          <div style={{ fontSize: 28, fontWeight: 200, letterSpacing: "-0.04em", marginTop: 6 }}>
            You are on <span style={{ color: "rgba(255,255,255,0.90)" }}>{currentPlan}</span>
          </div>
          {planError && (
            <div style={{ marginTop: 8, fontSize: 12, color: "rgba(251,113,133,0.9)" }}>{planError}</div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
          {PLANS.map((p, i) => {
            const isCurrent = p.id === currentPlan;
            const isUpgrade = i > currentIdx;
            const t = TONES[p.tone];
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.07 }}
                style={{
                  borderRadius: 24,
                  border: isCurrent ? `1px solid ${t.border}` : "1px solid rgba(255,255,255,0.07)",
                  background: isCurrent
                    ? `linear-gradient(160deg,${t.bg},rgba(12,13,19,0.98))`
                    : "linear-gradient(180deg,rgba(17,18,25,0.98),rgba(12,13,19,0.98))",
                  padding: "20px 20px 18px",
                  display: "flex", flexDirection: "column", gap: 0,
                  position: "relative",
                }}
              >
                {/* Badge */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Badge tone={isCurrent ? p.tone : "white"}>{p.label}</Badge>
                  {isCurrent && (
                    <span style={{
                      fontSize: 9, textTransform: "uppercase", letterSpacing: "0.18em",
                      color: t.text, background: t.bg,
                      border: `1px solid ${t.border}`, borderRadius: 99,
                      padding: "2px 8px",
                    }}>Active</span>
                  )}
                </div>

                {/* Tagline */}
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", marginTop: 14, lineHeight: 1.6 }}>
                  {p.tagline}
                </div>

                {/* Features */}
                <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 18, flex: 1 }}>
                  {p.features.map(f => (
                    <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <span style={{ color: isCurrent ? t.text : "rgba(255,255,255,0.22)", fontSize: 12, marginTop: 1 }}>✓</span>
                      <span style={{ fontSize: 12, color: isCurrent ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.30)", lineHeight: 1.5 }}>{f}</span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <button
                  disabled={isCurrent || planLoading === p.id}
                  onClick={() => !isCurrent && handlePlanChange(p.id)}
                  style={{
                    marginTop: 22, width: "100%", borderRadius: 14, padding: "10px 0",
                    fontSize: 12, fontWeight: 500, cursor: isCurrent ? "default" : "pointer",
                    border: isCurrent ? `1px solid ${t.border}` : "1px solid rgba(255,255,255,0.10)",
                    background: isCurrent ? t.bg : "rgba(255,255,255,0.04)",
                    color: isCurrent ? t.text : "rgba(255,255,255,0.45)",
                    transition: "all 0.2s",
                    opacity: planLoading === p.id ? 0.6 : 1,
                  }}
                >
                  {planLoading === p.id
                    ? "Updating…"
                    : isCurrent
                    ? "Current plan"
                    : isUpgrade
                    ? `Upgrade to ${p.label}`
                    : `Downgrade to ${p.label}`}
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Team ──────────────────────────────────────────────────────────────────────
  function renderTeam() {
    // Team management is exclusive to the Command plan
    if (currentPlan !== "Command") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.22em", color: "rgba(255,255,255,0.24)" }}>Access control</div>
            <div style={{ fontSize: 28, fontWeight: 200, letterSpacing: "-0.04em", marginTop: 6 }}>Team & Roles</div>
          </div>
          <div style={{
            borderRadius: 28,
            border: "1px solid rgba(251,113,133,0.16)",
            background: "linear-gradient(160deg,rgba(244,63,94,0.06),rgba(12,13,19,0.98))",
            padding: "36px 32px",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            textAlign: "center", gap: 16, minHeight: 280,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              border: "1px solid rgba(251,113,133,0.20)",
              background: "rgba(244,63,94,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22,
            }}>⚑</div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 200, letterSpacing: "-0.04em" }}>Command plan required</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", marginTop: 8, maxWidth: "42ch", lineHeight: 1.7 }}>
                Team management is available on the Command plan. Invite members, assign roles, and share your workspace.
              </div>
            </div>
            <button
              onClick={() => setTab("plan")}
              style={{
                marginTop: 8, borderRadius: 16, border: "none",
                background: "#ffffff",
                color: "#000000", padding: "10px 24px", fontSize: 13, fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Upgrade to Command →
            </button>
          </div>
        </div>
      );
    }

    // Command plan: full team management
    const canInvite = inviteEmail.includes("@") && !inviting;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <div>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.22em", color: "rgba(255,255,255,0.24)" }}>Access control</div>
          <div style={{ fontSize: 28, fontWeight: 200, letterSpacing: "-0.04em", marginTop: 6 }}>Who can operate the workspace</div>
        </div>

        {/* Invite row */}
        <CardDark style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <input
              type="email"
              placeholder="Email address to invite…"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleInvite()}
              style={{
                flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "rgba(255,255,255,0.80)",
                outline: "none",
              }}
            />
            {/* Role selector */}
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value as "editor" | "viewer")}
              style={{
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "rgba(255,255,255,0.70)",
                outline: "none", cursor: "pointer", colorScheme: "dark",
              }}
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <button
              disabled={!canInvite}
              onClick={handleInvite}
              style={{
                borderRadius: 14, border: "none",
                background: canInvite ? "#ffffff" : "rgba(255,255,255,0.05)",
                color: canInvite ? "#000000" : "rgba(255,255,255,0.25)",
                padding: "10px 20px", fontSize: 13, fontWeight: 600,
                cursor: canInvite ? "pointer" : "default",
                whiteSpace: "nowrap", transition: "background 0.2s, color 0.2s",
              }}
            >
              {inviting ? "Inviting…" : "+ Invite"}
            </button>
          </div>
          {/* Role explanation */}
          <div style={{ display: "flex", gap: 16, fontSize: 11, color: "rgba(255,255,255,0.28)" }}>
            <span><strong style={{ color: "rgba(255,255,255,0.45)" }}>Editor</strong> — can create & modify campaigns, rules, bids</span>
            <span><strong style={{ color: "rgba(255,255,255,0.45)" }}>Viewer</strong> — read-only access to stats and campaigns</span>
          </div>

          {/* Invite result */}
          {inviteResult?.url && (
            <div style={{
              background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.18)",
              borderRadius: 12, padding: "10px 14px",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            }}>
              <div>
                <div style={{ fontSize: 11, color: "rgba(167,243,208,0.7)", textTransform: "uppercase", letterSpacing: "0.15em" }}>Invite link ready</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 4, wordBreak: "break-all" }}>{inviteResult.url}</div>
              </div>
              <button
                onClick={() => { navigator.clipboard.writeText(inviteResult.url!).catch(() => {}); setInviteResult(null); }}
                style={{ borderRadius: 10, border: "1px solid rgba(52,211,153,0.25)", background: "rgba(52,211,153,0.10)", color: "rgba(167,243,208,0.9)", padding: "6px 14px", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}
              >
                Copy link
              </button>
            </div>
          )}
          {inviteResult?.error && (
            <div style={{ fontSize: 12, color: "rgba(251,113,133,0.9)", padding: "6px 0" }}>{inviteResult.error}</div>
          )}
        </CardDark>

        {/* Pending invites */}
        {pendingInvites.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.18em", color: "rgba(255,255,255,0.22)" }}>Pending invites</div>
            {pendingInvites.map(inv => (
              <CardDark key={inv.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 18px" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 400, color: "rgba(255,255,255,0.75)" }}>{inv.email}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", marginTop: 3 }}>
                    Expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => copyInviteUrl(inv.id, inv.inviteUrl)}
                    style={{ borderRadius: 10, border: "1px solid rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.55)", padding: "6px 12px", fontSize: 11, cursor: "pointer" }}
                  >
                    {copiedInviteId === inv.id ? "✓ Copied" : "Copy link"}
                  </button>
                  <button
                    onClick={() => handleRevokeInvite(inv.id)}
                    style={{ borderRadius: 10, border: "1px solid rgba(251,113,133,0.15)", background: "transparent", color: "rgba(251,113,133,0.6)", padding: "6px 12px", fontSize: 11, cursor: "pointer" }}
                  >
                    Revoke
                  </button>
                </div>
              </CardDark>
            ))}
          </div>
        )}

        {/* Active members */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.18em", color: "rgba(255,255,255,0.22)" }}>
            Active members {teamMembers.length > 0 && `· ${teamMembers.length}`}
          </div>
          {teamMembers.length === 0 ? (
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.24)", padding: "16px 0" }}>
              No members yet. Invite someone to get started.
            </div>
          ) : (
            teamMembers.map((m, i) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
              >
                <CardDark style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 300, letterSpacing: "-0.02em" }}>{m.email}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.30)", marginTop: 4 }}>
                      Member since {new Date(m.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <Badge tone="violet">{m.role}</Badge>
                    <button
                      onClick={() => handleRemoveMember(m.id)}
                      style={{ borderRadius: 10, border: "1px solid rgba(251,113,133,0.15)", background: "transparent", color: "rgba(251,113,133,0.6)", padding: "6px 12px", fontSize: 11, cursor: "pointer" }}
                    >
                      Remove
                    </button>
                  </div>
                </CardDark>
              </motion.div>
            ))
          )}
        </div>
      </div>
    );
  }

  // ── Workspace ─────────────────────────────────────────────────────────────────
  function renderWorkspace() {
    const TIMEZONES = [
      "UTC",
      "Europe/Paris","Europe/London","Europe/Berlin","Europe/Madrid",
      "Europe/Rome","Europe/Amsterdam","Europe/Brussels","Europe/Zurich",
      "Europe/Warsaw","Europe/Lisbon","Europe/Stockholm","Europe/Helsinki",
      "America/New_York","America/Chicago","America/Denver","America/Los_Angeles",
      "America/Toronto","America/Sao_Paulo","America/Mexico_City","America/Bogota",
      "Asia/Tokyo","Asia/Shanghai","Asia/Seoul","Asia/Singapore",
      "Asia/Dubai","Asia/Kolkata","Australia/Sydney","Pacific/Auckland",
    ];

    const CURRENCIES = [
      { code: "USD", label: "USD — US Dollar" },
      { code: "EUR", label: "EUR — Euro" },
      { code: "GBP", label: "GBP — British Pound" },
      { code: "JPY", label: "JPY — Japanese Yen" },
      { code: "CAD", label: "CAD — Canadian Dollar" },
      { code: "AUD", label: "AUD — Australian Dollar" },
      { code: "CHF", label: "CHF — Swiss Franc" },
      { code: "SEK", label: "SEK — Swedish Krona" },
      { code: "NOK", label: "NOK — Norwegian Krone" },
      { code: "DKK", label: "DKK — Danish Krone" },
      { code: "PLN", label: "PLN — Polish Zloty" },
      { code: "BRL", label: "BRL — Brazilian Real" },
      { code: "SGD", label: "SGD — Singapore Dollar" },
      { code: "HKD", label: "HKD — Hong Kong Dollar" },
    ];

    const selectStyle: React.CSSProperties = {
      width: "100%", background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.09)", borderRadius: 12,
      padding: "10px 14px", fontSize: 14, color: "rgba(255,255,255,0.80)",
      outline: "none", cursor: "pointer", colorScheme: "dark",
    };

    async function handleSaveWorkspace() {
      setWsSaving(true);
      setWsSaved(false);
      try {
        await fetch("/api/workspace", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timezone: wsTimezone, currency: wsCurrency }),
        });
        setWsSaved(true);
        setTimeout(() => setWsSaved(false), 2500);
      } finally {
        setWsSaving(false);
      }
    }

    async function handleExportCampaigns() {
      const res = await fetch("/api/campaigns?limit=1000&format=csv").catch(() => null);
      if (!res?.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "campaigns.csv"; a.click();
      URL.revokeObjectURL(url);
    }

    async function handleExportConversions() {
      const today = new Date().toISOString().slice(0, 10);
      const from = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
      const res = await fetch(`/api/conversions?dateFrom=${from}&dateTo=${today}&limit=10000&format=csv`).catch(() => null);
      if (!res?.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "conversions.csv"; a.click();
      URL.revokeObjectURL(url);
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <div>
          <div style={{ fontSize: 11, textTransform: "uppercase" as const, letterSpacing: "0.22em", color: "rgba(255,255,255,0.24)" }}>Preferences</div>
          <div style={{ fontSize: 28, fontWeight: 200, letterSpacing: "-0.04em", marginTop: 6 }}>Workspace settings</div>
        </div>

        {/* Timezone + Currency */}
        <CardDark style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase" as const, letterSpacing: "0.18em", color: "rgba(255,255,255,0.28)", marginBottom: 10 }}>Timezone</div>
            <select value={wsTimezone} onChange={e => setWsTimezone(e.target.value)} style={selectStyle}>
              {TIMEZONES.map(tz => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 6 }}>
              Used for date displays, schedule windows, and exports
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase" as const, letterSpacing: "0.18em", color: "rgba(255,255,255,0.28)", marginBottom: 10 }}>Display currency</div>
            <select value={wsCurrency} onChange={e => setWsCurrency(e.target.value)} style={selectStyle}>
              {CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 6 }}>
              Affects how revenue and spend are displayed across the dashboard
            </div>
          </div>

          <button
            onClick={handleSaveWorkspace}
            disabled={wsSaving}
            style={{
              alignSelf: "flex-start", height: 40, padding: "0 24px", borderRadius: 14,
              border: "none", background: wsSaved ? "rgba(52,211,153,0.15)" : "#ffffff",
              color: wsSaved ? "#34d399" : "#000000",
              fontSize: 13, fontWeight: 600, cursor: wsSaving ? "default" : "pointer",
              opacity: wsSaving ? 0.6 : 1, transition: "all 0.2s",
            }}
          >
            {wsSaving ? "Saving…" : wsSaved ? "✓ Saved" : "Save preferences"}
          </button>
        </CardDark>

        {/* Data exports */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase" as const, letterSpacing: "0.18em", color: "rgba(255,255,255,0.22)" }}>Data exports</div>

          <CardDark style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, padding: "18px 22px" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 400, color: "rgba(255,255,255,0.80)" }}>Campaigns</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.30)", marginTop: 3 }}>All campaigns with status, network, and current bid</div>
            </div>
            <button
              onClick={handleExportCampaigns}
              style={{
                borderRadius: 12, border: "1px solid rgba(255,255,255,0.09)",
                background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.60)",
                padding: "8px 18px", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              Export CSV
            </button>
          </CardDark>

          <CardDark style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, padding: "18px 22px" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 400, color: "rgba(255,255,255,0.80)" }}>Conversions</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.30)", marginTop: 3 }}>Last 90 days of conversion events and revenue</div>
            </div>
            <button
              onClick={handleExportConversions}
              style={{
                borderRadius: 12, border: "1px solid rgba(255,255,255,0.09)",
                background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.60)",
                padding: "8px 18px", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              Export CSV
            </button>
          </CardDark>
        </div>
      </div>
    );
  }

  // ── Security ──────────────────────────────────────────────────────────────────
  function renderSecurity() {
    const TONE: Record<string, { bg: string; text: string; border: string }> = {
      rose:    { bg: "rgba(244,63,94,0.10)",   text: "#fca5a5", border: "rgba(251,113,133,0.22)" },
      amber:   { bg: "rgba(245,158,11,0.10)",  text: "#fcd34d", border: "rgba(251,191,36,0.22)"  },
      emerald: { bg: "rgba(16,185,129,0.10)",  text: "#6ee7b7", border: "rgba(52,211,153,0.22)"  },
      white:   { bg: "rgba(255,255,255,0.05)", text: "rgba(255,255,255,0.55)", border: "rgba(255,255,255,0.10)" },
    };
    const NET_COLOR: Record<string, string> = {
      EXOCLICK: "#f97316", TRAFFICSTARS: "#a78bfa", TRAFFICJUNKY: "#38bdf8",
    };
    const syncEntries  = secLogs?.syncLogs   ?? [];
    const auditEntries = secLogs?.auditTrail ?? [];
    const syncErrors   = syncEntries.filter(e => e.isError).length;

    function refreshLogs() {
      setSecLogs(null); setSecLoading(true);
      fetch("/api/security/logs?limit=50")
        .then(r => r.ok ? r.json() : null)
        .then((d: SecurityLogsData | null) => { if (d) setSecLogs(d); })
        .catch(() => {})
        .finally(() => setSecLoading(false));
    }

    // ── Back button ─────────────────────────────────────────────────────────
    function BackBtn() {
      return (
        <button
          onClick={() => setSecView(null)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "none", border: "none", cursor: "pointer",
            fontSize: 12, color: "rgba(255,255,255,0.35)", padding: 0,
            marginBottom: 22, transition: "color 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.color = "rgba(255,255,255,0.7)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.35)"; }}
        >
          ← Security
        </button>
      );
    }

    // ── Sub-view: Credentials & 2FA ─────────────────────────────────────────
    if (secView === "credentials") return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <BackBtn />
        <div>
          <div style={{ fontSize: 11, textTransform: "uppercase" as const, letterSpacing: "0.14em", color: "rgba(255,255,255,0.28)", marginBottom: 6 }}>Credentials & 2FA</div>
          <div style={{ fontSize: 24, fontWeight: 200, letterSpacing: "-0.04em" }}>API key protection</div>
        </div>

        {/* 2FA card */}
        <TwoFactorCard />

        {/* Encryption guarantees — 3-column compact */}
        <div style={{ borderRadius: 20, border: "1px solid rgba(52,211,153,0.10)", background: "rgba(16,185,129,0.03)", padding: "18px 22px" }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: "rgba(110,231,183,0.6)", marginBottom: 14 }}>How keys are stored</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {[
              { icon: "🔒", title: "AES-256-GCM", desc: "Authenticated encryption, unique IV per key" },
              { icon: "🔑", title: "Never plaintext", desc: "Only encrypted blobs in the database" },
              { icon: "🛡", title: "Key isolated", desc: "Decryption key in server env only — not in DB" },
              { icon: "👁", title: "Server-side only", desc: "Keys decrypted only for outbound API calls" },
              { icon: "✅", title: "Tamper-proof", desc: "GCM auth tag rejects any modified data" },
              { icon: "🚫", title: "No transit leak", desc: "Never logged, never in URLs or responses" },
            ].map(({ icon, title, desc }) => (
              <div key={title} style={{ padding: "10px 12px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ fontSize: 13, marginBottom: 4 }}>{icon} <span style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.65)" }}>{title}</span></div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", lineHeight: 1.5 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Link to connections */}
        <button
          onClick={() => setTab("connections")}
          style={{
            alignSelf: "flex-start", height: 38, padding: "0 18px", borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.03)",
            color: "rgba(255,255,255,0.5)", fontSize: 12, cursor: "pointer", transition: "all 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; e.currentTarget.style.color = "rgba(255,255,255,0.8)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
        >
          Manage API keys in Connections →
        </button>

        {/* Session management */}
        <div style={{ borderRadius: 20, border: "1px solid rgba(251,113,133,0.12)", background: "rgba(244,63,94,0.04)", padding: "18px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.70)" }}>Sign out all devices</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.30)", marginTop: 4 }}>
              Immediately revoke access on every browser and device. Anyone logged in with your credentials will be forced to re-authenticate.
            </div>
          </div>
          <SignOutAllButton />
        </div>
      </div>
    );

    // ── Sub-view: Sync Logs ──────────────────────────────────────────────────
    if (secView === "sync-logs") return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <BackBtn />
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase" as const, letterSpacing: "0.14em", color: "rgba(255,255,255,0.28)", marginBottom: 6 }}>Network activity</div>
            <div style={{ fontSize: 24, fontWeight: 200, letterSpacing: "-0.04em" }}>Sync logs</div>
          </div>
          <button onClick={refreshLogs} style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}>↻ Refresh</button>
        </div>

        {syncErrors > 0 && (
          <div style={{ padding: "10px 14px", borderRadius: 12, background: "rgba(244,63,94,0.07)", border: "1px solid rgba(251,113,133,0.16)", display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "rgba(252,165,165,0.9)" }}>
            <span>⚠</span> {syncErrors} network error{syncErrors !== 1 ? "s" : ""} detected — check your API keys in Connections.
          </div>
        )}

        <div style={{ borderRadius: 20, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.015)", overflow: "hidden" }}>
          {secLoading ? (
            <div style={{ padding: "32px 0", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.28)" }}>Loading…</div>
          ) : syncEntries.length === 0 ? (
            <div style={{ padding: "32px 0", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.28)" }}>No sync events yet. Connect a network in Connections to start syncing.</div>
          ) : syncEntries.map((entry, i) => {
            const netColor = NET_COLOR[entry.network] ?? "rgba(255,255,255,0.4)";
            return (
              <div key={entry.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 18px", borderBottom: i < syncEntries.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", background: entry.isError ? "rgba(244,63,94,0.03)" : "transparent" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: entry.isError ? "#fca5a5" : netColor, flexShrink: 0 }} />
                <div style={{ fontSize: 10, letterSpacing: "0.08em", color: entry.isError ? "#fca5a5" : netColor, width: 88, flexShrink: 0, textTransform: "uppercase" as const }}>{entry.isError ? "Error" : entry.network}</div>
                <div style={{ flex: 1, fontSize: 12, color: entry.isError ? "rgba(252,165,165,0.8)" : "rgba(255,255,255,0.5)" }}>{entry.detail}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", flexShrink: 0 }} title={entry.datetime}>{entry.time}</div>
              </div>
            );
          })}
        </div>
      </div>
    );

    // ── Sub-view: Audit Trail ────────────────────────────────────────────────
    if (secView === "audit-trail") return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <BackBtn />
        <div>
          <div style={{ fontSize: 11, textTransform: "uppercase" as const, letterSpacing: "0.14em", color: "rgba(255,255,255,0.28)", marginBottom: 6 }}>Engine & manual decisions</div>
          <div style={{ fontSize: 24, fontWeight: 200, letterSpacing: "-0.04em" }}>Audit trail</div>
        </div>

        <div style={{ borderRadius: 20, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.015)", overflow: "hidden" }}>
          {secLoading ? (
            <div style={{ padding: "32px 0", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.28)" }}>Loading…</div>
          ) : auditEntries.length === 0 ? (
            <div style={{ padding: "32px 0", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.28)" }}>No decisions logged yet. Engine and manual actions will appear here.</div>
          ) : auditEntries.map((entry, i) => {
            const tc = TONE[entry.tone] ?? TONE.white;
            const netColor = NET_COLOR[entry.network] ?? "rgba(255,255,255,0.3)";
            return (
              <div key={entry.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", borderBottom: i < auditEntries.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                <div style={{ fontSize: 10, letterSpacing: "0.06em", fontWeight: 600, padding: "2px 9px", borderRadius: 6, background: tc.bg, color: tc.text, border: `1px solid ${tc.border}`, flexShrink: 0, whiteSpace: "nowrap" as const, minWidth: 72, textAlign: "center" as const }}>{entry.action}</div>
                <div style={{ flex: 1, fontSize: 12, color: "rgba(255,255,255,0.62)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{entry.campaign || "—"}</div>
                {entry.detail && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>{entry.detail}</div>}
                {entry.network && <div style={{ fontSize: 10, color: netColor, flexShrink: 0, letterSpacing: "0.06em" }}>{entry.network}</div>}
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", flexShrink: 0 }} title={entry.datetime}>{entry.time}</div>
              </div>
            );
          })}
        </div>
      </div>
    );

    // ── Hub (default) ────────────────────────────────────────────────────────
    const HUB_CARDS: Array<{
      view: SecView; eyebrow: string; title: string; icon: string;
      stat: React.ReactNode; badge?: React.ReactNode;
    }> = [
      {
        view: "credentials",
        eyebrow: "Keys & 2FA",
        title: "Credentials",
        icon: "🔒",
        stat: <span style={{ fontSize: 11, color: "rgba(110,231,183,0.65)" }}>AES-256-GCM · server-side only</span>,
      },
      {
        view: "sync-logs",
        eyebrow: "Network activity",
        title: "Sync logs",
        icon: "🔄",
        stat: secLoading
          ? <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>Loading…</span>
          : <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{secLogs?.syncTotal ?? 0} events recorded</span>,
        badge: syncErrors > 0
          ? <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: "rgba(244,63,94,0.10)", border: "1px solid rgba(251,113,133,0.22)", color: "#fca5a5" }}>{syncErrors} error{syncErrors !== 1 ? "s" : ""}</span>
          : undefined,
      },
      {
        view: "audit-trail",
        eyebrow: "Decisions",
        title: "Audit trail",
        icon: "📋",
        stat: secLoading
          ? <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>Loading…</span>
          : <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{secLogs?.auditTotal ?? 0} actions · last {auditEntries[0]?.time ?? "—"}</span>,
      },
    ];

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {HUB_CARDS.map(({ view, eyebrow, title, icon, stat, badge }) => (
          <div
            key={title}
            onClick={() => setSecView(view)}
            style={{
              borderRadius: 18, border: "1px solid rgba(255,255,255,0.07)",
              background: "rgba(255,255,255,0.02)",
              padding: "16px 20px",
              display: "flex", alignItems: "center", gap: 16,
              cursor: "pointer", transition: "border-color 0.18s, background 0.18s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)"; e.currentTarget.style.background = "rgba(255,255,255,0.035)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
          >
            <div style={{ fontSize: 20, flexShrink: 0, width: 36, textAlign: "center" as const }}>{icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, textTransform: "uppercase" as const, letterSpacing: "0.12em", color: "rgba(255,255,255,0.25)", marginBottom: 3 }}>{eyebrow}</div>
              <div style={{ fontSize: 15, fontWeight: 300, letterSpacing: "-0.02em", color: "rgba(255,255,255,0.85)" }}>{title}</div>
              <div style={{ marginTop: 3 }}>{stat}</div>
            </div>
            {badge && <div>{badge}</div>}
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.2)", flexShrink: 0 }}>›</div>
          </div>
        ))}
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  const { eyebrow, sub } = SHELL_CONFIG[tab];
  const title = SHELL_TITLES[tab];

  return (
    <div style={{ height: "calc(100vh - 56px)", overflowY: "auto", background: "#0d0d10" }}>
      <div style={{
        display: "grid", gridTemplateColumns: "240px 1fr",
        gap: 32, padding: 32, maxWidth: 1580, margin: "0 auto", alignItems: "start",
      }}>

        {/* ── Sidebar ── */}
        <aside style={{
          borderRadius: 28, border: "1px solid rgba(255,255,255,0.06)",
          background: "linear-gradient(180deg,rgba(12,13,18,0.98),rgba(9,10,15,0.96))",
          overflow: "hidden", position: "sticky", top: 32,
        }}>
          <div style={{ padding: "28px 24px 22px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: 22, fontWeight: 200, letterSpacing: "-0.04em" }}>ProfitDash</div>
            <div style={{ marginTop: 4, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.24em", color: "rgba(255,255,255,0.28)" }}>
              Settings section
            </div>
          </div>
          <div style={{ padding: "18px 16px" }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.24em", color: "rgba(255,255,255,0.24)", padding: "0 12px", marginBottom: 10 }}>
              Sections
            </div>
            {NAV_ITEMS.map(item => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  style={{
                    display: "block", width: "100%", textAlign: "left",
                    borderRadius: 16, padding: "14px 16px", marginBottom: 8, cursor: "pointer",
                    fontSize: 14,
                    border: active ? "1px solid rgba(52,211,153,0.18)" : "1px solid rgba(255,255,255,0.06)",
                    background: active ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.02)",
                    color: active ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.58)",
                    transition: "all 0.2s",
                  }}
                >
                  {item.label}
                </button>
              );
            })}

          </div>
        </aside>

        {/* ── Main shell ── */}
        <main style={{
          borderRadius: 30, border: "1px solid rgba(255,255,255,0.06)",
          background: "linear-gradient(180deg,rgba(11,12,18,0.98),rgba(8,9,14,0.98))",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.02),0 35px 120px rgba(0,0,0,0.45)",
          overflow: "hidden",
        }}>
          {/* Shell header */}
          <div style={{
            padding: "28px 32px 26px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            background: "radial-gradient(circle at 22% 0%,rgba(99,102,241,0.08),transparent 34%)",
          }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.24em", color: "rgba(110,231,183,0.8)", marginBottom: 10 }}>
              {eyebrow}
            </div>
            <div style={{ fontSize: 42, fontWeight: 200, letterSpacing: "-0.05em", lineHeight: 1.0, color: "rgba(255,255,255,0.92)", whiteSpace: "pre-line" }}>
              {title}
            </div>
            <p style={{ marginTop: 14, maxWidth: 680, color: "rgba(255,255,255,0.46)", fontSize: 15, lineHeight: 1.75 }}>
              {sub}
            </p>
          </div>

          {/* Shell body — tab content */}
          <div style={{ padding: "28px 32px" }}>
            <motion.div
              key={tab}
              initial={{ opacity: 0, filter: "blur(6px)", y: 6 }}
              animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
              transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            >
              {tab === "overview"    && renderOverview()}
              {tab === "connections" && renderConnections()}
              {tab === "postbacks"   && renderPostbacks()}
              {tab === "plan"        && renderPlan()}
              {tab === "team"        && renderTeam()}
              {tab === "workspace"   && renderWorkspace()}
              {tab === "security"    && renderSecurity()}
            </motion.div>
          </div>
        </main>

      </div>
    </div>
  );
}

// ─── SignOutAllButton ──────────────────────────────────────────────────────────
function SignOutAllButton() {
  const [state, setState] = React.useState<"idle" | "loading" | "done" | "error">("idle");

  async function handleSignOutAll() {
    if (!confirm("This will sign out every device logged into your account. Are you sure?")) return;
    setState("loading");
    try {
      const res = await fetch("/api/auth/sign-out-all", { method: "POST" });
      if (res.ok) {
        setState("done");
        // Redirect to login after short delay
        setTimeout(() => { window.location.href = "/login"; }, 1200);
      } else {
        setState("error");
        setTimeout(() => setState("idle"), 3000);
      }
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  }

  const label = { idle: "Sign out all", loading: "Revoking…", done: "✓ Done", error: "Failed" }[state];
  const bg    = { idle: "rgba(244,63,94,0.08)", loading: "rgba(244,63,94,0.08)", done: "rgba(52,211,153,0.10)", error: "rgba(244,63,94,0.14)" }[state];
  const color = { idle: "rgba(252,165,165,0.80)", loading: "rgba(252,165,165,0.50)", done: "#34d399", error: "#f87171" }[state];

  return (
    <button
      onClick={handleSignOutAll}
      disabled={state === "loading" || state === "done"}
      style={{
        borderRadius: 12, border: "1px solid rgba(251,113,133,0.20)",
        background: bg, color, padding: "9px 18px",
        fontSize: 12, fontWeight: 500, cursor: state === "idle" ? "pointer" : "default",
        whiteSpace: "nowrap", flexShrink: 0, transition: "all 0.2s",
      }}
    >
      {label}
    </button>
  );
}

// ─── TwoFactorCard ─────────────────────────────────────────────────────────────
type MFAStep =
  | "idle"           // not enrolled
  | "enrolling"      // calling enrollMFA()
  | "verifying"      // QR shown, waiting for code
  | "show-recovery"  // just enrolled — show codes once
  | "enabled"        // enrolled, normal state
  | "remove-confirm" // TOTP confirm before unenroll
  | "regen-confirm"  // TOTP confirm before regen
  | "show-new-codes"; // new codes after regen

interface TOTPFactor { id: string; friendlyName: string; createdAt: string; }

function TwoFactorCard() {
  const [step, setStep]               = useState<MFAStep>("idle");
  const [factors, setFactors]         = useState<TOTPFactor[]>([]);
  const [factorId, setFactorId]       = useState<string | null>(null);
  const [qrCode, setQrCode]           = useState<string | null>(null);
  const [secret, setSecret]           = useState<string | null>(null);
  const [code, setCode]               = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [error, setError]             = useState<string | null>(null);
  const [isPending, startTransition]  = useTransition();
  const [loaded, setLoaded]           = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [remaining, setRemaining]     = useState<number>(0);
  const [savedChecked, setSavedChecked] = useState(false);
  const [copied, setCopied]           = useState(false);
  const inputRef    = useRef<HTMLInputElement>(null);
  const confirmRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listMFAFactors().then(async res => {
      const f = res.factors ?? [];
      setFactors(f);
      if (f.length > 0) {
        try {
          const stats = await getRecoveryCodeStats();
          setRemaining(stats.remaining ?? 0);
        } catch {
          // RecoveryCode table not yet migrated — show 0, non-blocking
        }
        setStep("enabled"); // already enrolled — go straight to enabled state
      }
      setLoaded(true);
    }).catch(() => {
      // listMFAFactors failed — still show the card in idle state
      setLoaded(true);
    });
  }, []);

  const isEnabled = factors.length > 0;

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function resetEnroll() {
    setStep("idle"); setQrCode(null); setSecret(null);
    setFactorId(null); setCode(""); setError(null);
  }

  function handleCopyAll() {
    navigator.clipboard.writeText(recoveryCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    const blob = new Blob(
      [`ProfitDash — Recovery Codes\nGenerated: ${new Date().toLocaleDateString()}\n\n${recoveryCodes.join("\n")}\n\nEach code can only be used once. Store them safely.`],
      { type: "text/plain" }
    );
    const url = URL.createObjectURL(blob);
    const a   = document.createElement("a");
    a.href = url; a.download = "profitdash-recovery-codes.txt";
    a.click(); URL.revokeObjectURL(url);
  }

  // ── Actions ──────────────────────────────────────────────────────────────────

  function startEnroll() {
    setError(null); setStep("enrolling");
    startTransition(async () => {
      const res = await enrollMFA();
      if (res.error) { setError(res.error); setStep("idle"); return; }
      setFactorId(res.factorId ?? null);
      setQrCode(res.qrCode ?? null);
      setSecret(res.secret ?? null);
      setStep("verifying");
      setTimeout(() => inputRef.current?.focus(), 100);
    });
  }

  function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (code.replace(/\s/g, "").length !== 6) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await verifyMFA(factorId!, code);
      if (res.error) { setError("Invalid code — try again."); setCode(""); inputRef.current?.focus(); return; }
      // Generate recovery codes right after enrollment
      const codeRes = await createRecoveryCodes();
      if (codeRes.error || !codeRes.codes) {
        setError("2FA activated but failed to generate recovery codes. Please regenerate them from the security settings.");
        const updated = await listMFAFactors();
        setFactors(updated.factors ?? []);
        setRemaining(0);
        setStep("enabled");
        return;
      }
      const updated = await listMFAFactors();
      setFactors(updated.factors ?? []);
      setRecoveryCodes(codeRes.codes);
      setRemaining(codeRes.codes.length);
      setSavedChecked(false);
      setCode("");
      setStep("show-recovery");
    });
  }

  function handleRemoveStart() {
    setConfirmCode(""); setError(null);
    setStep("remove-confirm");
    setTimeout(() => confirmRef.current?.focus(), 100);
  }

  function handleRemoveConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (confirmCode.replace(/\s/g, "").length !== 6) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await unenrollMFAWithConfirmation(factors[0].id, confirmCode);
      if (res.error) { setError(res.error); setConfirmCode(""); confirmRef.current?.focus(); return; }
      setFactors([]); setRemaining(0);
      setConfirmCode("");
      setStep("idle");
    });
  }

  function handleRegenStart() {
    setConfirmCode(""); setError(null);
    setStep("regen-confirm");
    setTimeout(() => confirmRef.current?.focus(), 100);
  }

  function handleRegenConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (confirmCode.replace(/\s/g, "").length !== 6) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await regenerateRecoveryCodes(factors[0].id, confirmCode);
      if (res.error) { setError(res.error); setConfirmCode(""); confirmRef.current?.focus(); return; }
      setRecoveryCodes(res.codes ?? []);
      setRemaining((res.codes ?? []).length);
      setSavedChecked(false);
      setConfirmCode("");
      setStep("show-new-codes");
    });
  }

  if (!loaded) return (
    <div style={{
      borderRadius: 22, border: "1px solid rgba(255,255,255,0.07)",
      background: "rgba(255,255,255,0.02)", padding: "22px 26px",
    }}>
      {/* Header skeleton */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 13, flexShrink: 0,
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
        }} />
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
          <div style={{ width: 90,  height: 9,  borderRadius: 6, background: "rgba(255,255,255,0.05)" }} />
          <div style={{ width: 200, height: 14, borderRadius: 6, background: "rgba(255,255,255,0.05)" }} />
        </div>
      </div>
      <div style={{ marginTop: 14, width: "70%", height: 10, borderRadius: 6, background: "rgba(255,255,255,0.04)" }} />
      <div style={{ marginTop: 6,  width: "50%", height: 10, borderRadius: 6, background: "rgba(255,255,255,0.03)" }} />
    </div>
  );

  // ── Shared styles ─────────────────────────────────────────────────────────────
  const totpInputStyle: React.CSSProperties = {
    flex: 1, height: 48, padding: "0 18px", borderRadius: 14, boxSizing: "border-box",
    border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.9)", fontSize: 22, fontWeight: 200,
    letterSpacing: "0.3em", outline: "none", textAlign: "center",
    colorScheme: "dark" as never, transition: "border-color 0.15s",
  };

  const confirmBtnStyle = (disabled: boolean): React.CSSProperties => ({
    height: 48, padding: "0 20px", borderRadius: 14, border: "none", flexShrink: 0,
    background: disabled ? "rgba(52,211,153,0.15)" : "rgba(16,185,129,0.85)",
    color: disabled ? "rgba(110,231,183,0.4)" : "#fff",
    fontSize: 13, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", transition: "all 0.15s",
  });

  const cancelBtnStyle: React.CSSProperties = {
    height: 48, width: 48, borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.35)",
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  };

  // ── Render recovery codes grid (reused for show-recovery + show-new-codes) ───
  function RecoveryCodesDisplay({ isNew }: { isNew: boolean }) {
    return (
      <motion.div
        key={isNew ? "show-new-codes" : "show-recovery"}
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.3 }}
        style={{ marginTop: 20 }}
      >
        <div style={{
          padding: "16px 18px", borderRadius: 14,
          background: "rgba(245,158,11,0.06)", border: "1px solid rgba(251,191,36,0.14)",
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(253,230,138,0.9)", marginBottom: 4 }}>
            {isNew ? "🔄 New recovery codes generated" : "🔐 Save your recovery codes"}
          </div>
          <div style={{ fontSize: 11, color: "rgba(253,230,138,0.55)", lineHeight: 1.6 }}>
            These codes are shown <strong style={{ color: "rgba(253,230,138,0.8)" }}>only once</strong>. If you lose access to your authenticator app, each code can be used once to sign in. Store them somewhere safe.
          </div>
        </div>

        {/* Codes grid */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6,
          marginBottom: 14,
        }}>
          {recoveryCodes.map((c, i) => (
            <div key={i} style={{
              padding: "9px 14px", borderRadius: 9,
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
              fontFamily: "monospace", fontSize: 14, letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.75)", textAlign: "center",
              userSelect: "all",
            }}>
              {c}
            </div>
          ))}
        </div>

        {/* Copy + download */}
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          <button
            type="button" onClick={handleCopyAll}
            style={{
              flex: 1, height: 36, borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)",
              color: copied ? "rgba(110,231,183,0.85)" : "rgba(255,255,255,0.55)",
              fontSize: 12, cursor: "pointer", transition: "all 0.15s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            {copied ? <><Check size={13} strokeWidth={2} /> Copied!</> : <><Copy size={13} strokeWidth={1.5} /> Copy all</>}
          </button>
          <button
            type="button" onClick={handleDownload}
            style={{
              flex: 1, height: 36, borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.55)", fontSize: 12, cursor: "pointer", transition: "all 0.15s",
            }}
          >
            ↓ Download .txt
          </button>
        </div>

        {/* Confirm checkbox */}
        <label style={{
          display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer",
          padding: "12px 14px", borderRadius: 11,
          background: savedChecked ? "rgba(52,211,153,0.06)" : "rgba(255,255,255,0.02)",
          border: savedChecked ? "1px solid rgba(52,211,153,0.18)" : "1px solid rgba(255,255,255,0.07)",
          transition: "all 0.2s", marginBottom: 14,
        }}>
          <input
            type="checkbox" checked={savedChecked}
            onChange={e => setSavedChecked(e.target.checked)}
            style={{ marginTop: 1, accentColor: "#10b981", width: 15, height: 15, flexShrink: 0, cursor: "pointer" }}
          />
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.55 }}>
            I have saved my recovery codes in a safe place. I understand they cannot be shown again.
          </span>
        </label>

        <button
          type="button"
          disabled={!savedChecked}
          onClick={async () => {
            const stats = await getRecoveryCodeStats();
            setRemaining(stats.remaining ?? 0);
            setStep("enabled");
          }}
          style={{
            width: "100%", height: 42, borderRadius: 12, border: "none",
            background: savedChecked ? "rgba(16,185,129,0.85)" : "rgba(52,211,153,0.10)",
            color: savedChecked ? "#fff" : "rgba(110,231,183,0.35)",
            fontSize: 13, fontWeight: 600, cursor: savedChecked ? "pointer" : "not-allowed",
            transition: "all 0.15s",
          }}
        >
          {isNew ? "Done — back to security settings" : "Continue to dashboard"}
        </button>
      </motion.div>
    );
  }

  return (
    <div style={{
      borderRadius: 22,
      border: isEnabled
        ? "1px solid rgba(52,211,153,0.18)"
        : "1px solid rgba(255,255,255,0.07)",
      background: isEnabled
        ? "linear-gradient(135deg,rgba(16,185,129,0.05) 0%,rgba(12,13,19,0.0) 60%)"
        : "rgba(255,255,255,0.02)",
      padding: "22px 26px",
      transition: "border-color 0.3s, background 0.3s",
    }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 13, flexShrink: 0,
            background: isEnabled ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.04)",
            border: isEnabled ? "1px solid rgba(52,211,153,0.18)" : "1px solid rgba(255,255,255,0.07)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {isEnabled
              ? <ShieldCheck size={20} strokeWidth={1.5} color="rgba(110,231,183,0.85)" />
              : <ShieldOff   size={20} strokeWidth={1.5} color="rgba(255,255,255,0.3)"  />
            }
          </div>
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase" as const, letterSpacing: "0.14em", color: "rgba(255,255,255,0.28)", marginBottom: 2 }}>Account security</div>
            <div style={{ fontSize: 18, fontWeight: 200, letterSpacing: "-0.03em" }}>Two-Factor Authentication</div>
          </div>
        </div>
        <div style={{
          fontSize: 11, padding: "4px 12px", borderRadius: 999, flexShrink: 0,
          background: isEnabled ? "rgba(16,185,129,0.10)" : "rgba(255,255,255,0.04)",
          border: isEnabled ? "1px solid rgba(52,211,153,0.20)" : "1px solid rgba(255,255,255,0.08)",
          color: isEnabled ? "rgba(110,231,183,0.85)" : "rgba(255,255,255,0.35)",
          letterSpacing: "0.06em", textTransform: "uppercase" as const, marginTop: 4,
        }}>
          {isEnabled ? "Active" : "Disabled"}
        </div>
      </div>

      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1.65, margin: "14px 0 0" }}>
        {isEnabled
          ? "Protected with TOTP. Each sign-in requires a code from your authenticator app — even if your password is compromised."
          : "Add an extra layer of protection. After enabling, every sign-in will require a time-based code from Google Authenticator, Authy, or any TOTP app."}
      </p>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
              borderRadius: 10, marginTop: 14,
              background: "rgba(244,63,94,0.07)", border: "1px solid rgba(248,113,133,0.16)",
              fontSize: 12, color: "rgba(254,205,211,0.9)",
            }}
          >
            <AlertCircle size={13} strokeWidth={1.5} />{error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── State machine ─────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">

        {/* ── QR + verify step ─────────────────────────────────────────────── */}
        {step === "verifying" && qrCode && (
          <motion.div
            key="verify"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            style={{ marginTop: 20, display: "flex", flexDirection: "column" as const, gap: 16 }}
          >
            <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
              <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.10)", background: "#fff", padding: 10, flexShrink: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrCode} alt="2FA QR code" style={{ width: 180, height: 180, display: "block", imageRendering: "pixelated" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.7)", marginBottom: 6 }}>
                  1. Scan with your authenticator app
                </div>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", lineHeight: 1.65, margin: "0 0 12px" }}>
                  Open Google Authenticator, Authy, or any TOTP app and scan the QR code.
                </p>
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 5 }}>Can't scan? Type this key manually:</div>
                  <div style={{
                    padding: "9px 12px", borderRadius: 8,
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                    fontFamily: "monospace", fontSize: 13, letterSpacing: "0.14em",
                    color: "rgba(255,255,255,0.65)", wordBreak: "break-all" as const, userSelect: "all" as const,
                  }}>{secret}</div>
                </div>
              </div>
            </div>
            <form onSubmit={handleVerify} style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.7)" }}>2. Enter the 6-digit code to confirm</div>
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  ref={inputRef} type="text" inputMode="numeric" autoComplete="one-time-code"
                  placeholder="000000" value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  disabled={isPending}
                  style={totpInputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = "rgba(52,211,153,0.40)"; }}
                  onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}
                />
                <button type="submit" disabled={isPending || code.length < 6} style={confirmBtnStyle(isPending || code.length < 6)}>
                  {isPending ? "Activating…" : "Activate"}
                </button>
                <button type="button" onClick={resetEnroll} style={cancelBtnStyle}>
                  <X size={16} strokeWidth={1.5} />
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* ── Show recovery codes (post-enrollment) ────────────────────────── */}
        {step === "show-recovery" && <RecoveryCodesDisplay isNew={false} />}

        {/* ── Show new codes (post-regen) ───────────────────────────────────── */}
        {step === "show-new-codes" && <RecoveryCodesDisplay isNew={true} />}

        {/* ── Enabled: stats + actions ──────────────────────────────────────── */}
        {step === "enabled" && isEnabled && (
          <motion.div
            key="enabled"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ marginTop: 18 }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" as const }}>
              <div style={{ fontSize: 12, color: "rgba(110,231,183,0.6)" }}>
                ✓ Active since{" "}
                {new Date(factors[0].createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </div>
              {/* Recovery code count pill */}
              <div style={{
                fontSize: 11, padding: "4px 11px", borderRadius: 999,
                background: remaining <= 2 ? "rgba(245,158,11,0.10)" : "rgba(255,255,255,0.04)",
                border: remaining <= 2 ? "1px solid rgba(251,191,36,0.20)" : "1px solid rgba(255,255,255,0.08)",
                color: remaining <= 2 ? "rgba(253,230,138,0.85)" : "rgba(255,255,255,0.35)",
              }}>
                {remaining} recovery code{remaining !== 1 ? "s" : ""} remaining
                {remaining <= 2 && remaining > 0 && " ⚠"}
                {remaining === 0 && " — regenerate now"}
              </div>
            </div>
            {/* Action buttons */}
            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" as const }}>
              <button
                onClick={handleRegenStart}
                style={{
                  height: 36, padding: "0 16px", borderRadius: 10, flexShrink: 0,
                  border: "1px solid rgba(167,139,250,0.18)", background: "rgba(139,92,246,0.07)",
                  color: "rgba(221,214,254,0.7)", fontSize: 12, cursor: "pointer", transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(139,92,246,0.14)"; e.currentTarget.style.color = "rgba(221,214,254,1)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(139,92,246,0.07)"; e.currentTarget.style.color = "rgba(221,214,254,0.7)"; }}
              >
                Regenerate codes
              </button>
              <button
                onClick={handleRemoveStart}
                style={{
                  height: 36, padding: "0 16px", borderRadius: 10, flexShrink: 0,
                  border: "1px solid rgba(251,113,133,0.18)", background: "rgba(244,63,94,0.05)",
                  color: "rgba(252,165,165,0.65)", fontSize: 12, cursor: "pointer", transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(244,63,94,0.12)"; e.currentTarget.style.color = "rgba(252,165,165,1)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(244,63,94,0.05)"; e.currentTarget.style.color = "rgba(252,165,165,0.65)"; }}
              >
                Remove 2FA
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Remove confirm ────────────────────────────────────────────────── */}
        {step === "remove-confirm" && (
          <motion.div
            key="remove-confirm"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            style={{ marginTop: 18 }}
          >
            <div style={{
              padding: "12px 14px", borderRadius: 11, marginBottom: 14,
              background: "rgba(244,63,94,0.06)", border: "1px solid rgba(251,113,133,0.14)",
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(252,165,165,0.9)", marginBottom: 3 }}>Confirm 2FA removal</div>
              <div style={{ fontSize: 11, color: "rgba(252,165,165,0.5)", lineHeight: 1.55 }}>
                Enter a code from your authenticator app to confirm. This will disable 2FA and delete all recovery codes.
              </div>
            </div>
            <form onSubmit={handleRemoveConfirm} style={{ display: "flex", gap: 10 }}>
              <input
                ref={confirmRef} type="text" inputMode="numeric" autoComplete="one-time-code"
                placeholder="000000" value={confirmCode}
                onChange={e => setConfirmCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                disabled={isPending}
                style={{ ...totpInputStyle, borderColor: "rgba(251,113,133,0.20)" }}
                onFocus={e => { e.currentTarget.style.borderColor = "rgba(252,165,165,0.45)"; }}
                onBlur={e  => { e.currentTarget.style.borderColor = "rgba(251,113,133,0.20)"; }}
              />
              <button type="submit" disabled={isPending || confirmCode.length < 6} style={{
                ...confirmBtnStyle(isPending || confirmCode.length < 6),
                background: isPending || confirmCode.length < 6 ? "rgba(244,63,94,0.12)" : "rgba(220,38,38,0.75)",
                color: isPending || confirmCode.length < 6 ? "rgba(252,165,165,0.35)" : "#fff",
              }}>
                {isPending ? "Removing…" : "Confirm"}
              </button>
              <button type="button" onClick={() => { setStep("enabled"); setConfirmCode(""); setError(null); }} style={cancelBtnStyle}>
                <X size={16} strokeWidth={1.5} />
              </button>
            </form>
          </motion.div>
        )}

        {/* ── Regen confirm ─────────────────────────────────────────────────── */}
        {step === "regen-confirm" && (
          <motion.div
            key="regen-confirm"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            style={{ marginTop: 18 }}
          >
            <div style={{
              padding: "12px 14px", borderRadius: 11, marginBottom: 14,
              background: "rgba(139,92,246,0.07)", border: "1px solid rgba(167,139,250,0.14)",
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(221,214,254,0.9)", marginBottom: 3 }}>Confirm code regeneration</div>
              <div style={{ fontSize: 11, color: "rgba(221,214,254,0.5)", lineHeight: 1.55 }}>
                Enter a code from your authenticator app. All existing recovery codes will be invalidated and replaced with 10 new ones.
              </div>
            </div>
            <form onSubmit={handleRegenConfirm} style={{ display: "flex", gap: 10 }}>
              <input
                ref={confirmRef} type="text" inputMode="numeric" autoComplete="one-time-code"
                placeholder="000000" value={confirmCode}
                onChange={e => setConfirmCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                disabled={isPending}
                style={{ ...totpInputStyle, borderColor: "rgba(167,139,250,0.20)" }}
                onFocus={e => { e.currentTarget.style.borderColor = "rgba(167,139,250,0.50)"; }}
                onBlur={e  => { e.currentTarget.style.borderColor = "rgba(167,139,250,0.20)"; }}
              />
              <button type="submit" disabled={isPending || confirmCode.length < 6} style={confirmBtnStyle(isPending || confirmCode.length < 6)}>
                {isPending ? "Regenerating…" : "Confirm"}
              </button>
              <button type="button" onClick={() => { setStep("enabled"); setConfirmCode(""); setError(null); }} style={cancelBtnStyle}>
                <X size={16} strokeWidth={1.5} />
              </button>
            </form>
          </motion.div>
        )}

        {/* ── Idle: not enrolled + not mid-flow ────────────────────────────── */}
        {(step === "idle" || step === "enrolling") && !isEnabled && (
          <motion.div
            key="disabled"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ marginTop: 18 }}
          >
            <button
              onClick={startEnroll}
              disabled={isPending || step === "enrolling"}
              style={{
                height: 40, padding: "0 20px", borderRadius: 12,
                border: "1px solid rgba(52,211,153,0.22)", background: "rgba(16,185,129,0.08)",
                color: "rgba(110,231,183,0.85)", fontSize: 13, fontWeight: 500,
                cursor: isPending ? "wait" : "pointer", transition: "all 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(16,185,129,0.14)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(16,185,129,0.08)"; }}
            >
              {step === "enrolling" ? "Loading…" : "Enable Two-Factor Authentication"}
            </button>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
