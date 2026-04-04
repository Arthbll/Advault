"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, Pause, TrendingUp, TrendingDown, Bell,
  Plus, Trash2, Lightbulb, RefreshCw, Check,
  ChevronDown, AlertTriangle, Play,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type RuleCondition = "ROI_BELOW" | "ROI_ABOVE" | "SPEND_ABOVE" | "REVENUE_BELOW" | "CPC_ABOVE";
type RuleAction    = "PAUSE_CAMPAIGN" | "SCALE_BUDGET" | "NOTIFY";

interface AutomationRule {
  id:          string;
  name:        string;
  enabled:     boolean;
  condition:   RuleCondition;
  threshold:   number;
  action:      RuleAction;
  actionValue: number | null;
  network:     string | null;
  createdAt:   string;
  lastRunAt:   string | null;
}

interface Suggestion {
  condition:   RuleCondition;
  threshold:   number;
  action:      RuleAction;
  actionValue: number | null;
  name:        string;
  rationale:   string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const CONDITION_META: Record<RuleCondition, { label: string; unit: string; icon: React.ReactNode }> = {
  ROI_BELOW:      { label: "ROI below",        unit: "%",  icon: <TrendingDown size={11} /> },
  ROI_ABOVE:      { label: "ROI above",        unit: "%",  icon: <TrendingUp   size={11} /> },
  SPEND_ABOVE:    { label: "Spend above",      unit: "€",  icon: <AlertTriangle size={11} /> },
  REVENUE_BELOW:  { label: "Revenue below",   unit: "€",  icon: <TrendingDown size={11} /> },
  CPC_ABOVE:      { label: "CPC above",       unit: "€",  icon: <AlertTriangle size={11} /> },
};

const ACTION_META: Record<RuleAction, { label: string; color: string; icon: React.ReactNode }> = {
  PAUSE_CAMPAIGN: { label: "Pause campaign",  color: "#f87171", icon: <Pause      size={11} /> },
  SCALE_BUDGET:   { label: "Scale budget",    color: "#4ade80", icon: <TrendingUp size={11} /> },
  NOTIFY:         { label: "Notify",          color: "#a78bfa", icon: <Bell       size={11} /> },
};

const LABEL: React.CSSProperties = {
  fontSize: 10, fontWeight: 600,
  textTransform: "uppercase", letterSpacing: "0.12em",
  color: "rgba(255,255,255,0.28)",
};

const SURFACE: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border:     "1px solid rgba(255,255,255,0.07)",
  borderRadius: 16,
};

// ─── RuleCard ─────────────────────────────────────────────────────────────────
function RuleCard({
  rule, onToggle, onDelete,
}: {
  rule:     AutomationRule;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const cond  = CONDITION_META[rule.condition];
  const act   = ACTION_META[rule.action];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
      style={{
        ...SURFACE,
        padding: "16px 18px",
        display: "flex", alignItems: "center", gap: 14,
        opacity: rule.enabled ? 1 : 0.5,
        transition: "opacity 0.25s",
      }}
    >
      {/* Toggle */}
      <button
        onClick={() => onToggle(rule.id, !rule.enabled)}
        style={{
          flexShrink: 0, width: 36, height: 20, borderRadius: 99,
          background: rule.enabled ? "#4ade80" : "rgba(255,255,255,0.08)",
          border: "none", cursor: "pointer", position: "relative",
          transition: "background 0.25s",
        }}
      >
        <motion.div
          animate={{ left: rule.enabled ? 17 : 2 }}
          transition={{ type: "spring", stiffness: 500, damping: 35 }}
          style={{
            position: "absolute", top: 2, width: 16, height: 16,
            borderRadius: "50%", background: "#fff",
            boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
          }}
        />
      </button>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.88)", margin: "0 0 5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {rule.name}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {/* Condition chip */}
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 500,
            background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.55)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}>
            {cond.icon} {cond.label} {rule.threshold}{cond.unit}
          </span>

          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>→</span>

          {/* Action chip */}
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600,
            background: `${act.color}12`, color: act.color,
            border: `1px solid ${act.color}22`,
          }}>
            {act.icon} {act.label}
            {rule.action === "SCALE_BUDGET" && rule.actionValue &&
              ` ×${rule.actionValue}`}
          </span>

          {rule.network && (
            <span style={{
              padding: "2px 7px", borderRadius: 6, fontSize: 10,
              background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.35)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}>
              {rule.network}
            </span>
          )}
        </div>

        {rule.lastRunAt && (
          <p style={{ ...LABEL, marginTop: 6, marginBottom: 0 }}>
            Last run: {new Date(rule.lastRunAt).toLocaleString("en-GB", {
              day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
            })}
          </p>
        )}
      </div>

      {/* Delete */}
      <button
        onClick={async () => {
          if (!confirm(`Delete "${rule.name}"?`)) return;
          setDeleting(true);
          onDelete(rule.id);
        }}
        disabled={deleting}
        style={{
          flexShrink: 0, width: 30, height: 30, borderRadius: 8,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(248,113,113,0.06)",
          border: "1px solid rgba(248,113,113,0.1)",
          color: "rgba(248,113,113,0.5)",
          cursor: deleting ? "not-allowed" : "pointer",
          transition: "all 0.15s",
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = "rgba(248,113,113,0.12)";
          (e.currentTarget as HTMLElement).style.color = "#f87171";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = "rgba(248,113,113,0.06)";
          (e.currentTarget as HTMLElement).style.color = "rgba(248,113,113,0.5)";
        }}
      >
        <Trash2 size={13} strokeWidth={1.5} />
      </button>
    </motion.div>
  );
}

// ─── SuggestionCard ───────────────────────────────────────────────────────────
function SuggestionCard({
  s, onAdd, adding,
}: {
  s: Suggestion; onAdd: () => void; adding: boolean;
}) {
  const act = ACTION_META[s.action];
  const cond = CONDITION_META[s.condition];
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: "rgba(167,139,250,0.04)",
        border: "1px solid rgba(167,139,250,0.12)",
        borderRadius: 14, padding: "14px 16px",
        display: "flex", flexDirection: "column", gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.85)", margin: "0 0 4px" }}>{s.name}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 7px", borderRadius: 5, fontSize: 10, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>
              {cond.icon} {cond.label} {s.threshold}{cond.unit}
            </span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>→</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 7px", borderRadius: 5, fontSize: 10, fontWeight: 600, background: `${act.color}12`, color: act.color, border: `1px solid ${act.color}22` }}>
              {act.icon} {act.label}
            </span>
          </div>
        </div>
        <button
          onClick={onAdd}
          disabled={adding}
          style={{
            flexShrink: 0, display: "flex", alignItems: "center", gap: 5,
            padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600,
            background: adding ? "rgba(74,222,128,0.2)" : "rgba(167,139,250,0.1)",
            border: `1px solid ${adding ? "rgba(74,222,128,0.3)" : "rgba(167,139,250,0.2)"}`,
            color: adding ? "#4ade80" : "#a78bfa", cursor: adding ? "default" : "pointer",
            transition: "all 0.2s",
          }}
        >
          {adding ? <Check size={11} strokeWidth={2.5} /> : <Plus size={11} strokeWidth={2.5} />}
          {adding ? "Added" : "Add"}
        </button>
      </div>
      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: 0, lineHeight: 1.6 }}>
        {s.rationale}
      </p>
    </motion.div>
  );
}

// ─── AddRuleForm ──────────────────────────────────────────────────────────────
function AddRuleForm({ onCreated }: { onCreated: (rule: AutomationRule) => void }) {
  const [open,     setOpen]     = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [name,        setName]        = useState("");
  const [condition,   setCondition]   = useState<RuleCondition>("ROI_BELOW");
  const [threshold,   setThreshold]   = useState<string>("-30");
  const [action,      setAction]      = useState<RuleAction>("PAUSE_CAMPAIGN");
  const [actionValue, setActionValue] = useState<string>("1.3");

  const SELECT_STYLE: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8, padding: "8px 10px", fontSize: 12,
    color: "rgba(255,255,255,0.8)", cursor: "pointer", outline: "none",
    appearance: "none" as const, width: "100%",
  };

  const INPUT_STYLE: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8, padding: "8px 10px", fontSize: 12,
    color: "rgba(255,255,255,0.8)", outline: "none", width: "100%",
    boxSizing: "border-box" as const,
  };

  async function submit() {
    if (!name.trim()) { alert("Please give your rule a name."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/automation", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          name:        name.trim(),
          condition,
          threshold:   parseFloat(threshold) || 0,
          action,
          actionValue: action === "SCALE_BUDGET" ? parseFloat(actionValue) || 1.3 : null,
        }),
      });
      if (!res.ok) { const d = await res.json(); alert(d.error); return; }
      const { rule } = await res.json() as { rule: AutomationRule };
      onCreated(rule);
      setOpen(false);
      setName(""); setThreshold("-30"); setCondition("ROI_BELOW"); setAction("PAUSE_CAMPAIGN");
    } finally { setSaving(false); }
  }

  return (
    <div>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "11px 16px", borderRadius: 12, fontSize: 12, fontWeight: 500,
            background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.6)",
            border: "1px dashed rgba(255,255,255,0.12)", cursor: "pointer",
            width: "100%", justifyContent: "center", transition: "all 0.15s",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
            (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.8)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
            (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.6)";
          }}
        >
          <Plus size={14} strokeWidth={1.5} /> New rule
        </button>
      ) : (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16, padding: "18px 18px 16px",
              display: "flex", flexDirection: "column", gap: 12,
            }}
          >
            <p style={{ ...LABEL, marginBottom: 0 }}>New automation rule</p>

            {/* Name */}
            <div>
              <p style={{ ...LABEL, marginBottom: 6, marginTop: 0 }}>Name</p>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder='e.g. Pause if ROI negative'
                style={INPUT_STYLE}
              />
            </div>

            {/* Condition + threshold row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
              <div>
                <p style={{ ...LABEL, marginBottom: 6, marginTop: 0 }}>Condition</p>
                <div style={{ position: "relative" }}>
                  <select value={condition} onChange={e => setCondition(e.target.value as RuleCondition)} style={SELECT_STYLE}>
                    {Object.entries(CONDITION_META).map(([k, v]) => (
                      <option key={k} value={k} style={{ background: "#17171e" }}>{v.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "rgba(255,255,255,0.3)" }} />
                </div>
              </div>
              <div style={{ width: 90 }}>
                <p style={{ ...LABEL, marginBottom: 6, marginTop: 0 }}>Threshold</p>
                <input
                  type="number"
                  value={threshold}
                  onChange={e => setThreshold(e.target.value)}
                  style={{ ...INPUT_STYLE, width: 90 }}
                />
              </div>
            </div>

            {/* Action */}
            <div>
              <p style={{ ...LABEL, marginBottom: 6, marginTop: 0 }}>Action</p>
              <div style={{ position: "relative" }}>
                <select value={action} onChange={e => setAction(e.target.value as RuleAction)} style={SELECT_STYLE}>
                  {Object.entries(ACTION_META).map(([k, v]) => (
                    <option key={k} value={k} style={{ background: "#17171e" }}>{v.label}</option>
                  ))}
                </select>
                <ChevronDown size={12} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "rgba(255,255,255,0.3)" }} />
              </div>
            </div>

            {action === "SCALE_BUDGET" && (
              <div>
                <p style={{ ...LABEL, marginBottom: 6, marginTop: 0 }}>Multiplier (e.g. 1.3 = +30%)</p>
                <input
                  type="number"
                  step="0.1"
                  min="1.0"
                  max="5.0"
                  value={actionValue}
                  onChange={e => setActionValue(e.target.value)}
                  style={{ ...INPUT_STYLE, width: 100 }}
                />
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setOpen(false)} style={{
                padding: "8px 14px", borderRadius: 8, fontSize: 12,
                background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.5)", cursor: "pointer",
              }}>
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={saving}
                style={{
                  padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: saving ? "rgba(167,139,250,0.3)" : "rgba(167,139,250,0.15)",
                  border: "1px solid rgba(167,139,250,0.3)",
                  color: "#a78bfa", cursor: saving ? "not-allowed" : "pointer",
                  transition: "all 0.15s",
                }}
              >
                {saving ? "Creating…" : "Create rule"}
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function AutomationSettings() {
  const [rules,       setRules]       = useState<AutomationRule[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [runLoading,  setRunLoading]  = useState(false);
  const [lastRun,     setLastRun]     = useState<string | null>(null);
  const [runResults,  setRunResults]  = useState<{ message: string; count: number } | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [sugLoading,  setSugLoading]  = useState(false);
  const [sugError,    setSugError]    = useState<string | null>(null);
  const [addingIdx,   setAddingIdx]   = useState<number | null>(null);
  const [migrated,    setMigrated]    = useState(false);

  // Auto-migrate on mount if needed
  useEffect(() => {
    fetch("/api/debug/migrate-automation").catch(() => {});
    setMigrated(true);
  }, []);

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/automation");
      if (res.ok) {
        const d = await res.json() as { rules: AutomationRule[] };
        setRules(d.rules ?? []);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (migrated) loadRules();
  }, [migrated, loadRules]);

  async function toggleRule(id: string, enabled: boolean) {
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled } : r));
    await fetch(`/api/automation/${id}`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ enabled }),
    });
  }

  async function deleteRule(id: string) {
    setRules(prev => prev.filter(r => r.id !== id));
    await fetch(`/api/automation/${id}`, { method: "DELETE" });
  }

  async function runNow() {
    setRunLoading(true);
    setRunResults(null);
    try {
      const res = await fetch("/api/automation/run", { method: "POST" });
      const d   = await res.json() as { message?: string; results?: { applied: boolean }[] };
      setLastRun(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
      setRunResults({ message: d.message ?? "Done.", count: d.results?.filter(r => r.applied).length ?? 0 });
      loadRules(); // refresh lastRunAt
    } finally { setRunLoading(false); }
  }

  async function fetchSuggestions() {
    setSugLoading(true);
    setSugError(null);
    setSuggestions(null);
    try {
      const res = await fetch("/api/automation/suggest");
      const d   = await res.json() as { suggestions?: Suggestion[]; message?: string };
      if (d.suggestions && d.suggestions.length) {
        setSuggestions(d.suggestions);
      } else {
        setSugError(d.message ?? "No suggestions available.");
      }
    } finally { setSugLoading(false); }
  }

  async function addSuggestion(s: Suggestion, idx: number) {
    setAddingIdx(idx);
    try {
      const res = await fetch("/api/automation", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          name:        s.name,
          condition:   s.condition,
          threshold:   s.threshold,
          action:      s.action,
          actionValue: s.actionValue,
        }),
      });
      if (res.ok) {
        const { rule } = await res.json() as { rule: AutomationRule };
        setRules(prev => [rule, ...prev]);
      }
    } finally {
      setTimeout(() => setAddingIdx(null), 1500);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
      style={{ display: "flex", flexDirection: "column", gap: 20 }}
    >
      {/* ── Header bar ── */}
      <div style={{
        ...SURFACE,
        padding: "16px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.85)", margin: 0 }}>
            Active rules
          </p>
          <p style={{ ...LABEL, marginTop: 3, marginBottom: 0 }}>
            {loading ? "Loading…" : `${rules.filter(r => r.enabled).length} active · ${rules.length} total`}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {lastRun && (
            <span style={{ ...LABEL, marginRight: 4 }}>Ran at {lastRun}</span>
          )}
          <button
            onClick={runNow}
            disabled={runLoading}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 13px", borderRadius: 8, fontSize: 11, fontWeight: 600,
              background: runLoading ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${runLoading ? "rgba(74,222,128,0.25)" : "rgba(255,255,255,0.09)"}`,
              color: runLoading ? "#4ade80" : "rgba(255,255,255,0.6)",
              cursor: runLoading ? "not-allowed" : "pointer", transition: "all 0.2s",
            }}
          >
            {runLoading
              ? <><RefreshCw size={11} style={{ animation: "spin 1s linear infinite" }} /> Running…</>
              : <><Play size={11} strokeWidth={2} /> Run now</>
            }
          </button>
        </div>
      </div>

      {/* ── Run result feedback ── */}
      <AnimatePresence>
        {runResults && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              padding: "10px 14px", borderRadius: 10, fontSize: 12,
              background: runResults.count > 0 ? "rgba(74,222,128,0.06)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${runResults.count > 0 ? "rgba(74,222,128,0.14)" : "rgba(255,255,255,0.07)"}`,
              color: runResults.count > 0 ? "#4ade80" : "rgba(255,255,255,0.45)",
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            {runResults.count > 0 ? <Zap size={12} strokeWidth={2} /> : <Check size={12} strokeWidth={2} />}
            {runResults.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Rules list ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <AnimatePresence>
          {loading ? (
            <div style={{ padding: "28px 0", textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 12 }}>
              Loading rules…
            </div>
          ) : rules.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{
                padding: "32px 20px", textAlign: "center",
                background: "rgba(255,255,255,0.02)",
                border: "1px dashed rgba(255,255,255,0.07)",
                borderRadius: 14,
              }}
            >
              <Zap size={20} strokeWidth={1} style={{ color: "rgba(255,255,255,0.12)", marginBottom: 10 }} />
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", margin: "0 0 4px" }}>No rules configured</p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", margin: 0 }}>
                Add a rule manually or use the smart suggestions based on your history.
              </p>
            </motion.div>
          ) : (
            rules.map(rule => (
              <RuleCard
                key={rule.id}
                rule={rule}
                onToggle={toggleRule}
                onDelete={deleteRule}
              />
            ))
          )}
        </AnimatePresence>

        {/* Add rule form */}
        {!loading && (
          <AddRuleForm onCreated={rule => setRules(prev => [rule, ...prev])} />
        )}
      </div>

      {/* ── AI Suggest section ── */}
      <div style={{ ...SURFACE, padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 9, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.15)",
            }}>
              <Lightbulb size={14} strokeWidth={1.5} style={{ color: "#a78bfa" }} />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.85)", margin: 0 }}>
                Smart suggestions
              </p>
              <p style={{ ...LABEL, marginTop: 2, marginBottom: 0 }}>
                Thresholds computed from your history — no AI, 100% free
              </p>
            </div>
          </div>
          <button
            onClick={fetchSuggestions}
            disabled={sugLoading}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 13px", borderRadius: 8, fontSize: 11, fontWeight: 600,
              background: "rgba(167,139,250,0.08)",
              border: "1px solid rgba(167,139,250,0.18)",
              color: "#a78bfa", cursor: sugLoading ? "not-allowed" : "pointer",
              opacity: sugLoading ? 0.7 : 1, transition: "all 0.15s",
            }}
          >
            {sugLoading
              ? <><RefreshCw size={11} style={{ animation: "spin 1s linear infinite" }} /> Analysing…</>
              : <><Lightbulb size={11} /> Analyse</>
            }
          </button>
        </div>

        <AnimatePresence>
          {sugError && (
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", margin: 0, padding: "8px 0" }}
            >
              {sugError}
            </motion.p>
          )}
          {suggestions && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ display: "flex", flexDirection: "column", gap: 8 }}
            >
              {suggestions.map((s, i) => (
                <SuggestionCard
                  key={i}
                  s={s}
                  onAdd={() => addSuggestion(s, i)}
                  adding={addingIdx === i}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {!suggestions && !sugError && !sugLoading && (
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", margin: 0, lineHeight: 1.6 }}>
            Click &quot;Analyse&quot; to get recommended thresholds based on the statistical distribution (P25/P75) of your last 30 days of campaigns.
          </p>
        )}
      </div>

      {/* Spin animation */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </motion.div>
  );
}
