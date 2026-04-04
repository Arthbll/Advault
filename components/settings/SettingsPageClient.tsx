"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Copy, Check } from "lucide-react";
import AutoSyncSettings    from "./AutoSyncSettings";
import NotificationSettings from "./NotificationSettings";
import NetworkCard          from "./NetworkCard";
import { NetworkErrorCard, PostbackHealthCard, MiniStatusCard } from "@/components/ui/SyncErrorCard";

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
  isDemo?: boolean;
  plan?: string;
  teamMembers?: TeamMemberData[];
  pendingInvites?: PendingInviteData[];
}

// ─── Network configs ────────────────────────────────────────────────────────────
const NETWORK_CONFIGS = [
  { network: "EXOCLICK",     label: "ExoClick",     description: "Adult & mainstream ad network", color: "#c08835", glow: "rgba(192,136,53,0.14)",  hasSecret: false, keyLabel: "API Key" },
  { network: "TRAFFICSTARS", label: "TrafficStars", description: "Premium display ad network",    color: "#7264a8", glow: "rgba(114,100,168,0.14)", hasSecret: false, keyLabel: "API Key (Refresh Token)" },
  { network: "TRAFFICJUNKY", label: "TrafficJunky", description: "Video & display advertising",  color: "#4a8fb4", glow: "rgba(74,143,180,0.14)",  hasSecret: false, keyLabel: "API Key" },
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
type Tab = "overview" | "connections" | "postbacks" | "engine" | "plan" | "team" | "security" | "demo";

const NAV_ITEMS: { id: Tab; label: string }[] = [
  { id: "overview",    label: "Overview" },
  { id: "connections", label: "Connections" },
  { id: "postbacks",   label: "Postbacks" },
  { id: "engine",      label: "Engine Defaults" },
  { id: "plan",        label: "Plan" },
  { id: "team",        label: "Team & Roles" },
  { id: "security",    label: "Security" },
];

// Admin-only nav item shown below a separator
const NAV_ADMIN: { id: Tab; label: string }[] = [
  { id: "demo", label: "Demo Mode" },
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

// ─── SeedDataCard ─────────────────────────────────────────────────────────────
function SeedDataCard() {
  const [state, setState] = useState<"idle" | "loading" | "done" | "clearing">("idle");
  const [result, setResult] = useState<string | null>(null);

  async function seed() {
    setState("loading"); setResult(null);
    try {
      const res  = await fetch("/api/debug/seed", { method: "POST" });
      const data = await res.json() as { ok?: boolean; inserted?: number; campaigns?: number; error?: string };
      if (data.ok) {
        setResult(`✓ ${data.inserted} rows inserted — ${data.campaigns} campaigns over 30 days`);
        setState("done");
      } else { setResult(`Error: ${data.error}`); setState("idle"); }
    } catch (e) { setResult(`Network error: ${String(e)}`); setState("idle"); }
  }

  async function clear() {
    setState("clearing");
    try {
      const res  = await fetch("/api/debug/seed", { method: "DELETE" });
      const data = await res.json() as { ok?: boolean; deleted?: number };
      setResult(`✓ ${data.deleted ?? 0} test rows removed`);
    } catch { /* silent */ }
    setState("idle");
  }

  return (
    <CardSm>
      <div style={{ fontSize: 22, fontWeight: 200, letterSpacing: "-0.04em" }}>Test data</div>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", marginTop: 8, lineHeight: 1.75 }}>
        Injects fake campaigns (ExoClick · TrafficStars · TrafficJunky) over 30 days directly into the DB.
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button
          onClick={seed}
          disabled={state === "loading" || state === "clearing"}
          style={{
            padding: "8px 18px", borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: "pointer",
            background: state === "done" ? "rgba(107,158,130,0.15)" : "rgba(255,255,255,0.07)",
            border: state === "done" ? "1px solid rgba(107,158,130,0.3)" : "1px solid rgba(255,255,255,0.1)",
            color: state === "done" ? "#6b9e82" : "rgba(255,255,255,0.7)",
            opacity: state === "loading" ? 0.6 : 1, transition: "all 0.2s",
          }}
        >
          {state === "loading" ? "Injecting..." : state === "done" ? "✓ Injected" : "Inject test data"}
        </button>
        <button
          onClick={clear}
          disabled={state === "loading" || state === "clearing"}
          style={{
            padding: "8px 18px", borderRadius: 9, fontSize: 12, cursor: "pointer",
            background: "transparent", border: "1px solid rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.28)", opacity: state === "clearing" ? 0.5 : 1,
          }}
        >
          {state === "clearing" ? "Clearing..." : "Clear"}
        </button>
      </div>
      {result && <p style={{ marginTop: 10, fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{result}</p>}
    </CardSm>
  );
}

// ─── Shell header config ─────────────────────────────────────────────────────────
const SHELL_CONFIG: Record<Tab, { eyebrow: string; sub: string }> = {
  overview:    { eyebrow: "Settings hub",    sub: "The overview is the entry point. It summarizes workspace health and routes you to the right sub-pages: connections, postbacks, engine defaults, team and security." },
  connections: { eyebrow: "Sub-page 1",      sub: "Manage ad network integrations. Make API health obvious, let users test credentials, and show sync state without burying everything in technical forms." },
  postbacks:   { eyebrow: "Sub-page 2",      sub: "Postbacks are the revenue signal. Manage affiliate sources, global URL, and signal health so problems never silently break profit calculation." },
  engine:      { eyebrow: "Sub-page 3",      sub: "Global defaults live here, not buried in one giant settings page. Define how the engine behaves before campaign-level overrides are applied." },
  plan:        { eyebrow: "Subscription",    sub: "Your current plan and what comes with it. Upgrade or downgrade at any time — changes take effect immediately." },
  team:        { eyebrow: "Sub-page 4",      sub: "Permissions should be simple and premium. Users should immediately understand who can edit campaigns, who can manage settings, and who only has read access." },
  security:    { eyebrow: "Sub-page 5",      sub: "Quiet but important controls in one place: secrets, logs, maintenance and audit history. Trustworthy, not scary or cluttered." },
  demo:        { eyebrow: "Admin · Personal", sub: "Activates fake data across the whole dashboard so you can preview the interface without real campaigns. Also lets you inject or wipe test data directly in DB." },
};

const SHELL_TITLES: Record<Tab, string> = {
  overview:    "Settings should be\na section, not one\ngiant wall of options.",
  connections: "Connections",
  postbacks:   "Postbacks",
  engine:      "Engine Defaults",
  plan:        "Plan",
  team:        "Team & Roles",
  security:    "Security",
  demo:        "Demo Mode",
};

// ─── Main component ─────────────────────────────────────────────────────────────
export default function SettingsPageClient({
  connectedCount,
  accounts,
  ksSettings,
  isDemo = false,
  plan = "Observer",
  teamMembers: initialTeamMembers = [],
  pendingInvites: initialPendingInvites = [],
}: Props) {
  const [tab, setTab]                     = useState<Tab>("overview");
  const [demoEnabled, setDemoEnabled]     = useState(false);
  const [demoLoading, setDemoLoading]     = useState(false);
  const [postbackUrl, setPostbackUrl]     = useState<string | null>(null);
  const [postbackToken, setPostbackToken] = useState<string | null>(null);
  const [postbackUid, setPostbackUid]     = useState<string | null>(null);
  const [pbCopied, setPbCopied]           = useState(false);
  const [tokenCopied, setTokenCopied]     = useState(false);
  const [inviteEmail, setInviteEmail]     = useState("");

  // Team state
  const [teamMembers, setTeamMembers]       = useState<TeamMemberData[]>(initialTeamMembers);
  const [pendingInvites, setPendingInvites] = useState<PendingInviteData[]>(initialPendingInvites);
  const [inviting, setInviting]             = useState(false);
  const [inviteResult, setInviteResult]     = useState<{ url?: string; error?: string } | null>(null);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

  // Plan state
  const [currentPlan, setCurrentPlan]   = useState(plan);
  const [planLoading, setPlanLoading]   = useState<string | null>(null); // which plan is loading
  const [planError, setPlanError]       = useState<string | null>(null);

  useEffect(() => {
    setDemoEnabled(document.cookie.split(";").some(c => c.trim().startsWith("profitdash_demo=1")));
  }, []);

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

  function copyText(text: string, setter: (v: boolean) => void) {
    navigator.clipboard.writeText(text).then(() => {
      setter(true); setTimeout(() => setter(false), 2000);
    }).catch(() => {});
  }

  async function toggleDemo(value: boolean) {
    setDemoLoading(true);
    try {
      await fetch("/api/demo-mode", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: value }),
      });
      setDemoEnabled(value);
      if (typeof window !== "undefined") window.location.href = "/dashboard";
    } finally { setDemoLoading(false); }
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
        body: JSON.stringify({ email: inviteEmail.trim().toLowerCase() }),
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
    const statCards = [
      { label: "Networks",  value: NETWORK_CONFIGS.length, sub: `${connectedCount} healthy · ${NETWORK_CONFIGS.length - connectedCount} pending` },
      { label: "Postbacks", value: 4,                      sub: "3 active · 1 draft" },
      { label: "Team",      value: 3,                      sub: "1 admin · 2 users" },
    ];
    const navCards: { tone: ToneKey; id: Tab; desc: string }[] = [
      { tone: "amber",   id: "connections", desc: "Ad network APIs, credentials, sync health" },
      { tone: "emerald", id: "postbacks",   desc: "Affiliate sources, revenue signal, health" },
      { tone: "violet",  id: "engine",      desc: "Global rule profile, scan interval, launch defaults" },
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
              Overview role
            </div>
            <div style={{ fontSize: 28, fontWeight: 200, letterSpacing: "-0.04em", marginTop: 6, maxWidth: "22ch", color: "rgba(255,255,255,0.92)" }}>
              Clean hub page with health, status and manage entry points.
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.75, color: "rgba(221,214,254,0.74)", marginTop: 10 }}>
              The overview should not try to do everything. It should feel like a premium control room summary with clear paths into deeper settings pages.
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
          {/* Workspace placeholder */}
          <div style={{
            borderRadius: 26, border: "1px solid rgba(255,255,255,0.06)",
            background: "linear-gradient(180deg,rgba(17,18,25,0.70),rgba(12,13,19,0.70))",
            padding: 20, minHeight: 190, opacity: 0.5,
            display: "flex", flexDirection: "column", justifyContent: "space-between",
          }}>
            <div>
              <Badge tone="white">Workspace</Badge>
              <div style={{ fontSize: 24, fontWeight: 200, letterSpacing: "-0.04em", marginTop: 18 }}>Workspace</div>
              <div style={{ fontSize: 13, lineHeight: 1.75, color: "rgba(255,255,255,0.40)", marginTop: 10 }}>Timezone, currency, demo mode, exports</div>
            </div>
            <div style={{
              borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(255,255,255,0.02)", height: 44, padding: "0 16px",
              display: "flex", alignItems: "center", fontSize: 13, color: "rgba(255,255,255,0.30)",
            }}>
              Coming soon
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
          {isDemo && <Badge tone="amber">Demo</Badge>}
        </div>

        {isDemo && (
          <div style={{
            padding: "12px 16px", borderRadius: 12,
            background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.14)",
            display: "flex", alignItems: "flex-start", gap: 10,
          }}>
            <span style={{ fontSize: 14, marginTop: 1 }}>👁</span>
            <div>
              <p style={{ fontSize: 12, fontWeight: 500, color: "rgba(245,158,11,0.9)", margin: "0 0 2px" }}>
                Demo mode — sample data
              </p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", margin: 0, lineHeight: 1.5 }}>
                No real account connected. Connect your ExoClick API key to see your real campaigns.
              </p>
            </div>
          </div>
        )}

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
        {NETWORK_CONFIGS.map((cfg, i) => {
          const acct = accounts.find(a => a.network === cfg.network);
          if (acct?.isActive) return null; // Only show for disconnected/missing accounts
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

        {/* ── Sync status mini-cards (only when at least one network is connected) ── */}
        {connectedCount > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <MiniStatusCard
              tone="sky"
              badge="No data after sync"
              title="No data after sync"
              text="The sync completed, but returned zero campaigns for the selected date scope."
              footer={
                <button style={{
                  borderRadius: 10,
                  border: "1px solid rgba(56,189,248,0.18)",
                  background: "rgba(14,165,233,0.07)",
                  padding: "7px 14px", fontSize: 11,
                  color: "rgba(186,230,253,0.85)", cursor: "pointer", fontFamily: "inherit",
                }}>
                  Expand date range
                </button>
              }
              delay={0.05}
            />
            <MiniStatusCard
              tone="violet"
              badge="Partial source outage"
              title="Partial source outage"
              text="One connected network is stale while the rest of the workspace is healthy."
              footer={
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {NETWORK_CONFIGS.map(cfg => {
                    const a = accounts.find(ac => ac.network === cfg.network);
                    const healthy = a?.isActive ?? false;
                    return (
                      <div key={cfg.network} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
                        <span style={{ color: "rgba(255,255,255,0.50)" }}>{cfg.label}</span>
                        <span style={{ fontSize: 11, letterSpacing: "0.04em", color: healthy ? "#4ade80" : "#f87171" }}>
                          {healthy ? "Healthy" : "Pending"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              }
              delay={0.1}
            />
            <MiniStatusCard
              tone="amber"
              badge="Rate limit reached"
              title="Rate limit reached"
              text="API requests are temporarily delayed. Data freshness is reduced."
              footer={
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: 99, background: "#fbbf24", opacity: 0.8, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: "rgba(253,230,138,0.6)" }}>Retry in ~4 min</span>
                </div>
              }
              delay={0.15}
            />
          </div>
        )}

        <div style={{ marginTop: 4 }}>
          <AutoSyncSettings />
        </div>
      </div>
    );
  }

  // ── Postbacks ─────────────────────────────────────────────────────────────────
  function renderPostbacks() {
    const sources: { name: string; sub: string; status: string; tone: ToneKey }[] = [
      { name: "CrakRevenue", sub: "Global postback linked · healthy signal", status: "Active", tone: "emerald" },
      { name: "MaxBounty",   sub: "Revenue events received",                  status: "Active", tone: "emerald" },
      { name: "ClickDealer", sub: "Healthy signal",                           status: "Active", tone: "emerald" },
      { name: "AdCombo",     sub: "Waiting validation",                       status: "Draft",  tone: "amber" },
    ];
    const draftSources = sources.filter(s => s.status === "Draft");
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>

        {/* ── Postback unhealthy card (for sources with Draft status) ──── */}
        {draftSources.length > 0 && (
          <PostbackHealthCard
            healthPct={73}
            likelyCause="Missing or malformed click IDs in postback URL parameters."
            delay={0}
          />
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 22 }}>
        {/* Left: sources list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
            <div style={{ fontSize: 34, fontWeight: 200, letterSpacing: "-0.05em", lineHeight: 1, marginTop: 14, color: "rgba(110,231,183,0.95)", fontVariantNumeric: "tabular-nums" }}>
              98.2%
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.36)", marginTop: 8 }}>Valid revenue signal ingestion</div>
          </CardSm>
        </div>
      </div>
      </div>
    );
  }

  // ── Engine Defaults ───────────────────────────────────────────────────────────
  function renderEngine() {
    const killThr  = ksSettings.roiThreshold;
    const interval = ksSettings.checkIntervalMinutes;
    const maxSpend = ksSettings.maxSpendPerCampaign;

    const rules: { label: string; value: string; t: typeof TONES[ToneKey] }[] = [
      { label: "Kill",  value: `< ${killThr}%`,           t: TONES.rose },
      { label: "Watch", value: `${killThr}% → +5%`,       t: TONES.amber },
      { label: "Scale", value: "> +25%",                  t: TONES.emerald },
    ];

    const behaviors: { label: string; value?: string; badge?: ToneKey }[] = [
      { label: "Scan interval",                value: `Every ${interval} min` },
      { label: "Default launch status",        value: "Paused" },
      { label: "Min. spend before decision",   value: maxSpend ? `€${maxSpend}` : "€200" },
      { label: "Cooldown after action",        value: "20 min" },
      { label: "Kill switch",                  badge: ksSettings.killSwitchEnabled ? "emerald" : "white", value: ksSettings.killSwitchEnabled ? "Enabled" : "Disabled" },
    ];

    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
        {/* Rule thresholds */}
        <div style={{ borderRadius: 28, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", padding: "22px 24px" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.22em", color: "rgba(255,255,255,0.24)" }}>Default automation profile</div>
          <div style={{ fontSize: 28, fontWeight: 200, letterSpacing: "-0.04em", marginTop: 6 }}>Global engine rules</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginTop: 22 }}>
            {rules.map(r => (
              <div key={r.label} style={{ borderRadius: 20, border: `1px solid ${r.t.border}`, background: r.t.bg, padding: 20 }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.22em", color: r.t.text }}>{r.label}</div>
                <div style={{ fontSize: 22, fontWeight: 200, letterSpacing: "-0.04em", marginTop: 10, color: r.t.text }}>{r.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Behavior defaults */}
        <div style={{ borderRadius: 28, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", padding: "22px 24px" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.22em", color: "rgba(255,255,255,0.24)" }}>Behavior defaults</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
            {behaviors.map(b => (
              <div key={b.label} style={{
                borderRadius: 18, border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.02)", padding: "13px 16px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span style={{ fontSize: 14, color: "rgba(255,255,255,0.76)" }}>{b.label}</span>
                {b.badge ? (
                  <Badge tone={b.badge}>{b.value}</Badge>
                ) : (
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.88)" }}>{b.value}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

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
                background: "linear-gradient(90deg,#ec4899,#8b5cf6,#6366f1)",
                color: "#fff", padding: "10px 24px", fontSize: 13, fontWeight: 600,
                cursor: "pointer", boxShadow: "0 14px 35px rgba(139,92,246,0.25)",
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
            <button
              disabled={!canInvite}
              onClick={handleInvite}
              style={{
                borderRadius: 14, border: "none",
                background: canInvite ? "linear-gradient(90deg,#ec4899,#8b5cf6,#6366f1)" : "rgba(255,255,255,0.05)",
                color: canInvite ? "#fff" : "rgba(255,255,255,0.25)",
                padding: "10px 20px", fontSize: 13, fontWeight: 600,
                cursor: canInvite ? "pointer" : "default",
                whiteSpace: "nowrap", transition: "all 0.2s",
                boxShadow: canInvite ? "0 10px 28px rgba(139,92,246,0.30)" : "none",
              }}
            >
              {inviting ? "Inviting…" : "+ Invite member"}
            </button>
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

  // ── Security ──────────────────────────────────────────────────────────────────
  function renderSecurity() {
    const secCards = [
      { title: "API secrets",  desc: "Encrypted credentials for networks and postback sources" },
      { title: "Sync logs",    desc: "Recent API connection events and failures" },
      { title: "Audit trail",  desc: "Who changed major system settings and when" },
      { title: "Maintenance",  desc: "Reset demo data, clear cached previews, workspace cleanup" },
    ];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {/* 2×2 security card grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
          {secCards.map(c => (
            <CardSm key={c.title} style={{ minHeight: 170, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 200, letterSpacing: "-0.04em" }}>{c.title}</div>
                <div style={{ fontSize: 13, lineHeight: 1.75, color: "rgba(255,255,255,0.38)", marginTop: 10 }}>{c.desc}</div>
              </div>
              <div style={{
                borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)", height: 44, padding: "0 16px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                fontSize: 13, color: "rgba(255,255,255,0.70)", marginTop: 16,
              }}>
                <span>Open</span><span>→</span>
              </div>
            </CardSm>
          ))}
        </div>

        {/* Demo mode toggle + Seed data */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
          <CardSm>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 200, letterSpacing: "-0.04em" }}>Demo Mode</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", marginTop: 6, lineHeight: 1.6 }}>
                  Show demo data across the dashboard to preview the interface.
                </div>
              </div>
              <button
                onClick={() => !demoLoading && toggleDemo(!demoEnabled)}
                disabled={demoLoading}
                style={{
                  width: 48, height: 26, borderRadius: 13, border: "none",
                  cursor: demoLoading ? "wait" : "pointer",
                  background: demoEnabled ? "rgba(192,136,53,0.9)" : "rgba(255,255,255,0.1)",
                  position: "relative", transition: "background 0.2s", flexShrink: 0,
                }}
              >
                <span style={{
                  position: "absolute", top: 3, width: 20, height: 20, borderRadius: "50%",
                  background: "#fff", transition: "left 0.2s",
                  left: demoEnabled ? 25 : 3, boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
                }} />
              </button>
            </div>
            {demoEnabled && (
              <div style={{
                padding: "10px 14px", borderRadius: 10,
                background: "rgba(192,136,53,0.08)", border: "1px solid rgba(192,136,53,0.2)",
                fontSize: 12, color: "#c08835",
              }}>
                ✦ Demo mode active — the dashboard is showing demo data.
              </div>
            )}
          </CardSm>

          <SeedDataCard />
        </div>

        {/* Notifications */}
        <div>
          <NotificationSettings />
        </div>
      </div>
    );
  }

  // ── Demo Mode ─────────────────────────────────────────────────────────────────
  function renderDemo() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Toggle card */}
        <div style={{
          borderRadius: 24, border: demoEnabled ? "1px solid rgba(192,136,53,0.20)" : "1px solid rgba(255,255,255,0.08)",
          background: demoEnabled ? "rgba(192,136,53,0.06)" : "rgba(255,255,255,0.02)",
          padding: "28px 28px", transition: "all 0.3s",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
            <div>
              <div style={{
                display: "inline-flex", borderRadius: 9999,
                border: "1px solid rgba(251,191,36,0.18)", background: "rgba(245,158,11,0.08)",
                padding: "3px 12px", fontSize: 10, textTransform: "uppercase" as const,
                letterSpacing: "0.22em", color: "rgba(253,230,138,1)", marginBottom: 14,
              }}>
                Personal toggle
              </div>
              <div style={{ fontSize: 28, fontWeight: 200, letterSpacing: "-0.04em", color: "rgba(255,255,255,0.92)" }}>
                Demo Mode
              </div>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.38)", marginTop: 8, lineHeight: 1.7, maxWidth: "52ch" }}>
                Shows demo data across the whole dashboard. Disable to return to your real campaigns.
              </div>
            </div>

            {/* Toggle switch */}
            <button
              onClick={() => !demoLoading && toggleDemo(!demoEnabled)}
              disabled={demoLoading}
              style={{
                width: 56, height: 30, borderRadius: 15, border: "none",
                cursor: demoLoading ? "wait" : "pointer",
                background: demoEnabled ? "rgba(192,136,53,0.88)" : "rgba(255,255,255,0.10)",
                position: "relative", transition: "background 0.25s", flexShrink: 0,
                boxShadow: demoEnabled ? "0 0 20px rgba(192,136,53,0.30)" : "none",
              }}
            >
              <span style={{
                position: "absolute", top: 4, width: 22, height: 22, borderRadius: "50%",
                background: "#fff", transition: "left 0.25s",
                left: demoEnabled ? 30 : 4,
                boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
              }} />
            </button>
          </div>

          {demoEnabled && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                marginTop: 20, padding: "12px 16px", borderRadius: 14,
                background: "rgba(192,136,53,0.10)", border: "1px solid rgba(192,136,53,0.22)",
                fontSize: 13, color: "#c08835", lineHeight: 1.6,
              }}
            >
              ✦ Demo mode active — the dashboard is showing demo data. Disable to return to your real data.
            </motion.div>
          )}
        </div>

        {/* Seed data card */}
        <SeedDataCard />

        {/* Info card */}
        <div style={{
          borderRadius: 24, border: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.01)", padding: "20px 24px",
        }}>
          <div style={{ fontSize: 11, textTransform: "uppercase" as const, letterSpacing: "0.22em", color: "rgba(255,255,255,0.20)" }}>
            How it works
          </div>
          <ol style={{ marginTop: 14, paddingLeft: 18, display: "flex", flexDirection: "column" as const, gap: 10 }}>
            {[
              "Demo mode injects a profitdash_demo=1 cookie via the /api/demo-mode API",
              "All dashboard pages read this cookie server-side and switch to the DEMO_* constants",
              "Test data (Inject button) writes directly to the DB and is read via the real endpoints",
              "Both modes are independent — you can have both active simultaneously",
            ].map((s, i) => (
              <li key={i} style={{ fontSize: 13, color: "rgba(255,255,255,0.32)", lineHeight: 1.6 }}>{s}</li>
            ))}
          </ol>
        </div>
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
              Sub menus
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

            {/* Admin separator */}
            <div style={{
              height: 1, background: "rgba(255,255,255,0.06)",
              margin: "10px 0 14px",
            }} />
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.24em", color: "rgba(251,191,36,0.40)", padding: "0 12px", marginBottom: 10 }}>
              Admin
            </div>
            {NAV_ADMIN.map(item => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  style={{
                    display: "block", width: "100%", textAlign: "left",
                    borderRadius: 16, padding: "14px 16px", marginBottom: 8, cursor: "pointer",
                    fontSize: 14,
                    border: active ? "1px solid rgba(251,191,36,0.22)" : "1px solid rgba(251,191,36,0.08)",
                    background: active ? "rgba(245,158,11,0.08)" : "rgba(245,158,11,0.02)",
                    color: active ? "rgba(253,230,138,1)" : "rgba(253,230,138,0.45)",
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
              {tab === "engine"      && renderEngine()}
              {tab === "plan"        && renderPlan()}
              {tab === "team"        && renderTeam()}
              {tab === "security"    && renderSecurity()}
              {tab === "demo"        && renderDemo()}
            </motion.div>
          </div>
        </main>

      </div>
    </div>
  );
}
