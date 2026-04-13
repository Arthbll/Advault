"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, RefreshCw, ChevronDown, Globe, Monitor, Smartphone, Tablet, Check } from "lucide-react";

// ── ExoClick reference data ──────────────────────────────────────────────────
const AD_FORMATS_EXOCLICK = [
  { id: 2,  label: "Banner",              sub: "Display 300x250, 728x90…"       },
  { id: 4,  label: "Pop-under",           sub: "Opens in background"            },
  { id: 8,  label: "Interstitial",        sub: "Full-screen between pages"      },
  { id: 13, label: "Push Notification",   sub: "Browser notification"           },
  { id: 14, label: "Native",              sub: "Native sponsored content"       },
  { id: 5,  label: "In-Video",            sub: "Pre/mid-roll video"             },
];

// ── TrafficStars reference data ───────────────────────────────────────────────
// Real formats from GET /v1.1/ad_formats (verified 23/03/2026)
const AD_FORMATS_TRAFFICSTARS = [
  { id: 1,   label: "Banner 300x250",        sub: "Standard display format"     },
  { id: 23,  label: "Banner 728x90",         sub: "Horizontal leaderboard"      },
  { id: 7,   label: "Popunder",              sub: "Opens in background"         },
  { id: 104, label: "Push Notification",     sub: "Web push / In-page push"     },
  { id: 63,  label: "Video",                 sub: "Pre-roll, outstream…"        },
  { id: 62,  label: "Native",                sub: "Native sponsored content"    },
  { id: 105, label: "Interstitial",          sub: "Full-screen between pages"   },
];

const BID_TYPES_EXOCLICK = [
  { value: "cpm", label: "CPM", sub: "Cost per 1,000 impressions" },
  { value: "cpc", label: "CPC", sub: "Cost per click"             },
];

const BID_TYPES_TRAFFICSTARS = [
  { value: "cpm", label: "CPM", sub: "Cost per 1,000 impressions" },
  { value: "cpc", label: "CPC", sub: "Cost per click"             },
  { value: "cpa", label: "CPA", sub: "Cost per action/conversion" },
];

const NETWORKS = [
  { id: "EXOCLICK",     label: "ExoClick",     color: "#c08835", disabled: false },
  { id: "TRAFFICSTARS", label: "TrafficStars", color: "#7264a8", disabled: false },
  { id: "TRAFFICJUNKY", label: "TrafficJunky", color: "#4a8fb4", disabled: true  },
  { id: "PROPELLERADS", label: "PropellerAds", color: "#f97316", disabled: true  },
  { id: "ADSTERRA",     label: "Adsterra",     color: "#06b6d4", disabled: true  },
];

const COUNTRIES: { code: string; name: string }[] = [
  { code: "US", name: "United States" }, { code: "GB", name: "United Kingdom" },
  { code: "DE", name: "Germany" },       { code: "FR", name: "France" },
  { code: "ES", name: "Spain" },         { code: "IT", name: "Italy" },
  { code: "CA", name: "Canada" },        { code: "AU", name: "Australia" },
  { code: "BR", name: "Brazil" },        { code: "MX", name: "Mexico" },
  { code: "IN", name: "India" },         { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },   { code: "RU", name: "Russia" },
  { code: "UA", name: "Ukraine" },       { code: "PL", name: "Poland" },
  { code: "NL", name: "Netherlands" },   { code: "BE", name: "Belgium" },
  { code: "SE", name: "Sweden" },        { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" },       { code: "FI", name: "Finland" },
  { code: "CH", name: "Switzerland" },   { code: "AT", name: "Austria" },
  { code: "PT", name: "Portugal" },      { code: "CZ", name: "Czech Republic" },
  { code: "HU", name: "Hungary" },       { code: "RO", name: "Romania" },
  { code: "TR", name: "Turkey" },        { code: "TH", name: "Thailand" },
  { code: "ID", name: "Indonesia" },     { code: "PH", name: "Philippines" },
  { code: "VN", name: "Vietnam" },       { code: "MY", name: "Malaysia" },
  { code: "SG", name: "Singapore" },     { code: "ZA", name: "South Africa" },
  { code: "AR", name: "Argentina" },     { code: "CO", name: "Colombia" },
];

const DEVICES = [
  { id: "desktop", label: "Desktop", icon: Monitor },
  { id: "mobile",  label: "Mobile",  icon: Smartphone },
  { id: "tablet",  label: "Tablet",  icon: Tablet },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px", borderRadius: 12, fontSize: 13, outline: "none",
  background: "#1A1A1C", border: "1.5px solid rgba(255,255,255,0.06)",
  color: "#E4E4E7", transition: "border-color 0.2s, background 0.2s, box-shadow 0.2s",
  boxSizing: "border-box",
};
const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
  textTransform: "uppercase", color: "#3F3F46", display: "block", marginBottom: 7,
};
const sectionStyle: React.CSSProperties = {
  background: "#0F0F11", borderRadius: 16, padding: "18px 20px",
  border: "1px solid rgba(255,255,255,0.05)",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export default function CampaignCreateModal({ onClose, onCreated }: Props) {
  const [step,       setStep]       = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // Network selector
  const [network, setNetwork] = useState<"EXOCLICK" | "TRAFFICSTARS" | "TRAFFICJUNKY">("EXOCLICK");

  // Form state
  const [name,        setName]        = useState("");
  const [adFormat,    setAdFormat]    = useState<number>(2);   // ExoClick format
  const [tsFormatId,  setTsFormatId]  = useState<number>(1);  // TrafficStars format
  const [bidType,     setBidType]     = useState<"cpm" | "cpc" | "cpa">("cpm");
  const [bid,         setBid]         = useState("");
  const [dailyBudget, setDailyBudget] = useState("");
  const [totalBudget, setTotalBudget] = useState("");
  const [startAt,     setStartAt]     = useState("");
  const [endAt,       setEndAt]       = useState("");
  const [countries,   setCountries]   = useState<string[]>([]);
  const [devices,     setDevices]     = useState<string[]>(["desktop", "mobile", "tablet"]);
  const [active,      setActive]      = useState(false);
  const [countrySearch, setCountrySearch] = useState("");

  function toggleCountry(code: string) {
    setCountries(p => p.includes(code) ? p.filter(c => c !== code) : [...p, code]);
  }
  function toggleDevice(id: string) {
    setDevices(p => p.includes(id) ? p.filter(d => d !== id) : [...p, id]);
  }

  const filteredCountries = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
    c.code.toLowerCase().includes(countrySearch.toLowerCase())
  );

  // Derived helpers
  const AD_FORMATS = network === "TRAFFICSTARS" ? AD_FORMATS_TRAFFICSTARS : AD_FORMATS_EXOCLICK;
  const BID_TYPES  = network === "TRAFFICSTARS" ? BID_TYPES_TRAFFICSTARS  : BID_TYPES_EXOCLICK;
  const activeFormatId = network === "TRAFFICSTARS" ? tsFormatId : adFormat;

  // Step validation
  const step1Valid = name.trim().length > 0 && activeFormatId > 0;
  const step2Valid = parseFloat(bid) > 0 && (network === "TRAFFICSTARS" ? parseFloat(dailyBudget) > 0 : true);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const commonTargeting = {
        countries: countries.length > 0 ? countries : undefined,
        active,
      };

      const payload = network === "TRAFFICSTARS"
        ? {
            network:       "TRAFFICSTARS",
            name:          name.trim(),
            format_id:     tsFormatId,
            pricing_model: bidType as "cpm" | "cpc" | "cpa",
            price:         parseFloat(bid),
            max_daily:     parseFloat(dailyBudget),
            ...commonTargeting,
          }
        : {
            network:     "EXOCLICK",
            name:        name.trim(),
            adFormat,
            bidType,
            bid:         parseFloat(bid),
            dailyBudget: dailyBudget ? parseFloat(dailyBudget) : undefined,
            totalBudget: totalBudget ? parseFloat(totalBudget) : undefined,
            devices:     devices.length > 0 ? devices : undefined,
            startAt:     startAt || undefined,
            endAt:       endAt   || undefined,
            ...commonTargeting,
          };

      const res = await fetch("/api/campaigns/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.ok) { onCreated(); onClose(); }
      else setError(json.error ?? "Unknown error");
    } catch { setError("Network error"); }
    setSubmitting(false);
  }

  const focusGreen = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = "rgba(0,255,135,0.4)";
    e.currentTarget.style.background  = "#111113";
    e.currentTarget.style.boxShadow   = "0 0 0 3px rgba(0,255,135,0.06)";
  };
  const blurReset = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
    e.currentTarget.style.background  = "#1A1A1C";
    e.currentTarget.style.boxShadow   = "none";
  };

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", zIndex: 40 }}
      />

      {/* Panel */}
      <motion.div
        key="panel"
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 35 }}
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, width: 520,
          background: "#111113", borderLeft: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "-24px 0 80px rgba(0,0,0,0.7)",
          zIndex: 50, display: "flex", flexDirection: "column",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div style={{ padding: "24px 28px 0", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div>
              <p style={{ fontSize: 11, color: "#3F3F46", marginBottom: 4 }}>{network === "TRAFFICSTARS" ? "TrafficStars" : "ExoClick"} · New campaign</p>
              <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.03em", color: "#F5F5F7", margin: 0 }}>
                Create campaign
              </h2>
            </div>
            <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.94 }} onClick={onClose}
              style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <X size={15} strokeWidth={1.5} style={{ color: "#52525B" }} />
            </motion.button>
          </div>

          {/* Step indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 20, marginBottom: 24 }}>
            {([1, 2, 3] as const).map((s, i) => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700,
                  background: step > s ? "#00FF87" : step === s ? "rgba(0,255,135,0.15)" : "rgba(255,255,255,0.05)",
                  color: step > s ? "#000" : step === s ? "#00FF87" : "#3F3F46",
                  border: step === s ? "1px solid rgba(0,255,135,0.3)" : "1px solid transparent",
                  transition: "all 0.25s",
                  boxShadow: step === s ? "0 0 10px rgba(0,255,135,0.2)" : "none",
                }}>
                  {step > s ? <Check size={11} strokeWidth={2.5} /> : s}
                </div>
                {i < 2 && (
                  <div style={{ width: 40, height: 1.5, borderRadius: 99, background: step > s ? "#00FF87" : "rgba(255,255,255,0.08)", transition: "background 0.25s" }} />
                )}
              </div>
            ))}
            <div style={{ marginLeft: 10 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#F5F5F7", margin: 0 }}>
                {step === 1 ? "Format & name" : step === 2 ? "Budget & bid" : "Targeting"}
              </p>
              <p style={{ fontSize: 11, color: "#3F3F46", marginTop: 1 }}>
                {step === 1 ? "Step 1 / 3" : step === 2 ? "Step 2 / 3" : "Step 3 / 3"}
              </p>
            </div>
          </div>

          <div style={{ height: 1, background: "rgba(255,255,255,0.05)", marginBottom: 28 }} />
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: "0 28px", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* ── STEP 1 : Format & name ── */}
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Network selector */}
                <div style={sectionStyle}>
                  <label style={labelStyle}>Ad network</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {NETWORKS.map(n => (
                      <motion.div key={n.id}
                        onClick={() => {
                          if (n.disabled) return;
                          setNetwork(n.id as "EXOCLICK" | "TRAFFICSTARS" | "TRAFFICJUNKY");
                          setAdFormat(2); setTsFormatId(1); setBidType("cpm");
                        }}
                        whileTap={n.disabled ? {} : { scale: 0.97 }}
                        title={n.disabled ? "Campaign creation not available for this network (account pending approval)" : undefined}
                        style={{
                          flex: 1, padding: "13px 14px", borderRadius: 12,
                          cursor: n.disabled ? "not-allowed" : "pointer",
                          opacity: n.disabled ? 0.45 : 1,
                          background: network === n.id ? `rgba(${n.id === "TRAFFICSTARS" ? "114,100,168" : n.id === "TRAFFICJUNKY" ? "74,143,180" : "192,136,53"},0.1)` : "rgba(255,255,255,0.03)",
                          border: network === n.id ? `1px solid rgba(${n.id === "TRAFFICSTARS" ? "114,100,168" : n.id === "TRAFFICJUNKY" ? "74,143,180" : "192,136,53"},0.35)` : "1px solid rgba(255,255,255,0.06)",
                          transition: "all 0.15s",
                          display: "flex", alignItems: "center", gap: 8, position: "relative",
                        }}
                      >
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: network === n.id ? n.color : "#3F3F46", flexShrink: 0, boxShadow: network === n.id ? `0 0 6px ${n.color}` : "none", transition: "all 0.15s" }} />
                        <span style={{ fontSize: 13, fontWeight: network === n.id ? 600 : 400, color: network === n.id ? "#F5F5F7" : "#52525B" }}>{n.label}</span>
                        {n.disabled && <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 600, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.05em" }}>Soon</span>}
                      </motion.div>
                    ))}
                  </div>
                </div>

                <div style={sectionStyle}>
                  <Field label="Campaign name">
                    <input value={name} onChange={e => setName(e.target.value)}
                      placeholder={network === "TRAFFICSTARS" ? "Ex : TS - Adult - FR - Banner" : "Ex : ExoClick - Adult - US - Banner"}
                      style={inputStyle} onFocus={focusGreen} onBlur={blurReset} />
                  </Field>
                </div>

                <div style={sectionStyle}>
                  <label style={labelStyle}>Ad format</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {AD_FORMATS.map(fmt => {
                      const isSelected = network === "TRAFFICSTARS" ? tsFormatId === fmt.id : adFormat === fmt.id;
                      return (
                      <motion.div key={fmt.id} onClick={() => network === "TRAFFICSTARS" ? setTsFormatId(fmt.id) : setAdFormat(fmt.id)}
                        whileHover={{ x: 2 }}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "12px 14px", borderRadius: 12, cursor: "pointer",
                          background: isSelected ? "rgba(0,255,135,0.06)" : "#111113",
                          border: isSelected ? "1px solid rgba(0,255,135,0.2)" : "1px solid rgba(255,255,255,0.05)",
                          transition: "all 0.15s",
                        }}
                      >
                        <div>
                          <p style={{ fontSize: 13, fontWeight: isSelected ? 600 : 400, color: isSelected ? "#F5F5F7" : "#A1A1AA", margin: 0 }}>{fmt.label}</p>
                          <p style={{ fontSize: 11, color: "#3F3F46", marginTop: 2 }}>{fmt.sub}</p>
                        </div>
                        <div style={{
                          width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                          background: isSelected ? "#00FF87" : "rgba(255,255,255,0.06)",
                          border: isSelected ? "none" : "1px solid rgba(255,255,255,0.1)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          boxShadow: isSelected ? "0 0 8px rgba(0,255,135,0.4)" : "none",
                          transition: "all 0.2s",
                        }}>
                          {isSelected && <Check size={10} strokeWidth={3} style={{ color: "#000" }} />}
                        </div>
                      </motion.div>
                      );
                    })}
                  </div>
                </div>

                {/* Initial status */}
                <div style={sectionStyle}>
                  <label style={labelStyle}>Launch status</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[{ v: false, label: "Paused", color: "#F59E0B", rgb: "245,158,11" }, { v: true, label: "Active", color: "#00FF87", rgb: "0,255,135" }].map(({ v, label, color, rgb }) => (
                      <motion.div key={label} onClick={() => setActive(v)} whileTap={{ scale: 0.97 }}
                        style={{
                          flex: 1, padding: "11px", borderRadius: 12, cursor: "pointer", textAlign: "center",
                          background: active === v ? `rgba(${rgb},0.1)` : "rgba(255,255,255,0.03)",
                          border: active === v ? `1px solid rgba(${rgb},0.25)` : "1px solid rgba(255,255,255,0.06)",
                          fontSize: 13, fontWeight: active === v ? 600 : 400,
                          color: active === v ? color : "#52525B",
                          transition: "all 0.15s",
                        }}
                      >{label}</motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── STEP 2 : Budget & bid ── */}
            {step === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Bid type */}
                <div style={sectionStyle}>
                  <label style={labelStyle}>Bid type</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {BID_TYPES.map(bt => (
                      <motion.div key={bt.value} onClick={() => setBidType(bt.value as "cpm" | "cpc" | "cpa")} whileTap={{ scale: 0.97 }}
                        style={{
                          flex: 1, padding: "14px", borderRadius: 12, cursor: "pointer",
                          background: bidType === bt.value ? "rgba(0,255,135,0.08)" : "rgba(255,255,255,0.03)",
                          border: bidType === bt.value ? "1px solid rgba(0,255,135,0.22)" : "1px solid rgba(255,255,255,0.06)",
                          transition: "all 0.15s",
                        }}
                      >
                        <p style={{ fontSize: 15, fontWeight: 700, color: bidType === bt.value ? "#00FF87" : "#52525B", margin: 0 }}>{bt.label}</p>
                        <p style={{ fontSize: 11, color: "#3F3F46", marginTop: 3 }}>{bt.sub}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Bid amount */}
                <div style={sectionStyle}>
                  <Field label={`${bidType.toUpperCase()} bid ($)`}>
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#3F3F46", fontSize: 13, pointerEvents: "none" }}>$</span>
                      <input type="number" min="0.001" step="0.001" value={bid} onChange={e => setBid(e.target.value)}
                        placeholder={bidType === "cpm" ? "Ex : 0.50" : "Ex : 0.05"}
                        style={{ ...inputStyle, paddingLeft: 28 }} onFocus={focusGreen} onBlur={blurReset} />
                    </div>
                    <p style={{ fontSize: 11, color: "#3F3F46", marginTop: 6 }}>
                      {bidType === "cpm" ? "Amount paid per 1,000 impressions" : "Amount paid per click"}
                    </p>
                  </Field>
                </div>

                {/* Budgets */}
                <div style={sectionStyle}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <Field label="Daily budget ($)">
                      <div style={{ position: "relative" }}>
                        <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#3F3F46", fontSize: 13, pointerEvents: "none" }}>$</span>
                        <input type="number" min="0" step="0.01" value={dailyBudget} onChange={e => setDailyBudget(e.target.value)}
                          placeholder="Ex : 50" style={{ ...inputStyle, paddingLeft: 28 }} onFocus={focusGreen} onBlur={blurReset} />
                      </div>
                    </Field>
                    <Field label="Total budget ($) — optional">
                      <div style={{ position: "relative" }}>
                        <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#3F3F46", fontSize: 13, pointerEvents: "none" }}>$</span>
                        <input type="number" min="0" step="0.01" value={totalBudget} onChange={e => setTotalBudget(e.target.value)}
                          placeholder="Unlimited" style={{ ...inputStyle, paddingLeft: 28 }} onFocus={focusGreen} onBlur={blurReset} />
                      </div>
                    </Field>
                  </div>
                </div>

                {/* Dates */}
                <div style={sectionStyle}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <Field label="Start date — optional">
                      <input type="date" value={startAt} onChange={e => setStartAt(e.target.value)}
                        style={{ ...inputStyle, colorScheme: "dark" }} onFocus={focusGreen} onBlur={blurReset} />
                    </Field>
                    <Field label="End date — optional">
                      <input type="date" value={endAt} onChange={e => setEndAt(e.target.value)}
                        style={{ ...inputStyle, colorScheme: "dark" }} onFocus={focusGreen} onBlur={blurReset} />
                    </Field>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── STEP 3 : Targeting ── */}
            {step === 3 && (
              <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Devices */}
                <div style={sectionStyle}>
                  <label style={labelStyle}>Devices</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {DEVICES.map(({ id, label, icon: Icon }) => {
                      const on = devices.includes(id);
                      return (
                        <motion.div key={id} onClick={() => toggleDevice(id)} whileTap={{ scale: 0.96 }}
                          style={{
                            flex: 1, padding: "14px 10px", borderRadius: 14, cursor: "pointer",
                            display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                            background: on ? "rgba(0,255,135,0.07)" : "rgba(255,255,255,0.03)",
                            border: on ? "1px solid rgba(0,255,135,0.2)" : "1px solid rgba(255,255,255,0.06)",
                            transition: "all 0.15s",
                          }}
                        >
                          <Icon size={18} strokeWidth={1.5} style={{ color: on ? "#00FF87" : "#3F3F46", filter: on ? "drop-shadow(0 0 4px rgba(0,255,135,0.5))" : "none", transition: "all 0.15s" }} />
                          <span style={{ fontSize: 11, fontWeight: on ? 600 : 400, color: on ? "#F5F5F7" : "#52525B" }}>{label}</span>
                          {on && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#00FF87", boxShadow: "0 0 5px rgba(0,255,135,0.7)" }} />}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                {/* Countries */}
                <div style={sectionStyle}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <Globe size={12} strokeWidth={1.5} style={{ color: "#00FF87" }} />
                      <label style={{ ...labelStyle, margin: 0 }}>Target countries</label>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {countries.length > 0 && (
                        <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 99, background: "rgba(0,255,135,0.08)", color: "#00FF87", border: "1px solid rgba(0,255,135,0.15)" }}>
                          {countries.length} selected
                        </span>
                      )}
                      <button onClick={() => setCountries([])} style={{ fontSize: 10, color: "#3F3F46", background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}>
                        Clear all
                      </button>
                    </div>
                  </div>

                  {/* Search */}
                  <input value={countrySearch} onChange={e => setCountrySearch(e.target.value)}
                    placeholder="Search a country…"
                    style={{ ...inputStyle, marginBottom: 10 }} onFocus={focusGreen} onBlur={blurReset} />

                  {/* Selected countries first */}
                  <div style={{ maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
                    {filteredCountries
                      .sort((a, b) => {
                        const aOn = countries.includes(a.code);
                        const bOn = countries.includes(b.code);
                        if (aOn && !bOn) return -1;
                        if (!aOn && bOn) return  1;
                        return 0;
                      })
                      .map(c => {
                        const on = countries.includes(c.code);
                        return (
                          <div key={c.code} onClick={() => toggleCountry(c.code)}
                            style={{
                              display: "flex", alignItems: "center", justifyContent: "space-between",
                              padding: "8px 12px", borderRadius: 10, cursor: "pointer",
                              background: on ? "rgba(0,255,135,0.05)" : "transparent",
                              transition: "background 0.1s",
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = on ? "rgba(0,255,135,0.08)" : "rgba(255,255,255,0.03)"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = on ? "rgba(0,255,135,0.05)" : "transparent"; }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: "#3F3F46", width: 24 }}>{c.code}</span>
                              <span style={{ fontSize: 13, color: on ? "#F5F5F7" : "#71717A" }}>{c.name}</span>
                            </div>
                            <div style={{
                              width: 16, height: 16, borderRadius: 5, flexShrink: 0,
                              background: on ? "#00FF87" : "rgba(255,255,255,0.06)",
                              border: on ? "none" : "1px solid rgba(255,255,255,0.1)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              transition: "all 0.15s",
                            }}>
                              {on && <Check size={9} strokeWidth={3} style={{ color: "#000" }} />}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Summary */}
                <div style={{ background: "rgba(0,255,135,0.04)", borderRadius: 14, padding: "14px 18px", border: "1px solid rgba(0,255,135,0.08)" }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "#00FF87", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.07em" }}>Summary</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {[
                      ["Network", network === "TRAFFICSTARS" ? "TrafficStars" : network === "TRAFFICJUNKY" ? "TrafficJunky" : "ExoClick"],
                      ["Name",    name || "—"],
                      ["Format",  AD_FORMATS.find(f => f.id === activeFormatId)?.label ?? "—"],
                      ["Bid",     bid ? `$${bid} ${bidType.toUpperCase()}` : "—"],
                      ["Budget",  dailyBudget ? `$${dailyBudget}/day` : network === "TRAFFICSTARS" ? "⚠ Required" : "Unlimited"],
                      ["Countries", countries.length > 0 ? countries.slice(0, 4).join(", ") + (countries.length > 4 ? ` +${countries.length - 4}` : "") : "All"],
                      ...(network === "EXOCLICK" ? [["Devices", devices.length > 0 ? devices.join(", ") : "—"] as [string, string]] : []),
                      ["Status",  active ? "Active" : "Paused"],
                    ].map(([k, v]) => (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span style={{ color: "#3F3F46" }}>{k}</span>
                        <span style={{ color: "#E4E4E7", fontWeight: 500 }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                style={{ padding: "11px 14px", borderRadius: 12, fontSize: 13, background: "rgba(255,69,58,0.07)", color: "#FF453A", border: "1px solid rgba(255,69,58,0.15)" }}>
                {error}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div style={{ padding: "24px 28px", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", gap: 8, flexShrink: 0 }}>
          {step > 1 && (
            <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }} onClick={() => setStep(s => (s - 1) as 1 | 2 | 3)}
              style={{ padding: "13px 20px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#52525B", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
              Back
            </motion.button>
          )}

          {step < 3 ? (
            <motion.button
              whileHover={(step === 1 ? step1Valid : step2Valid) ? { y: -1, boxShadow: "0 0 0 1px rgba(0,255,135,0.25), 0 4px 20px rgba(0,255,135,0.2)" } : {}}
              whileTap={(step === 1 ? step1Valid : step2Valid) ? { scale: 0.97 } : {}}
              onClick={() => { if (step === 1 && step1Valid) setStep(2); if (step === 2 && step2Valid) setStep(3); }}
              disabled={step === 1 ? !step1Valid : !step2Valid}
              style={{
                flex: 1, padding: "13px", borderRadius: 14, fontSize: 13, fontWeight: 600, cursor: "pointer",
                background: (step === 1 ? step1Valid : step2Valid) ? "rgba(0,255,135,0.12)" : "rgba(255,255,255,0.04)",
                border:     (step === 1 ? step1Valid : step2Valid) ? "1px solid rgba(0,255,135,0.25)" : "1px solid rgba(255,255,255,0.06)",
                color:      (step === 1 ? step1Valid : step2Valid) ? "#00FF87" : "#3F3F46",
                transition: "all 0.2s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              Continue <ChevronDown size={13} strokeWidth={2} style={{ rotate: "-90deg" }} />
            </motion.button>
          ) : (
            <motion.button
              whileHover={!submitting ? { y: -1, boxShadow: "0 0 0 1px rgba(0,255,135,0.3), 0 4px 24px rgba(0,255,135,0.25)" } : {}}
              whileTap={!submitting ? { scale: 0.97 } : {}}
              onClick={handleSubmit} disabled={submitting}
              style={{
                flex: 1, padding: "13px", borderRadius: 14, fontSize: 13, fontWeight: 600,
                background: submitting ? "rgba(255,255,255,0.04)" : "rgba(0,255,135,0.15)",
                border: submitting ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,255,135,0.3)",
                color: submitting ? "#3F3F46" : "#00FF87",
                cursor: submitting ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                boxShadow: submitting ? "none" : "0 0 20px rgba(0,255,135,0.1)",
                transition: "all 0.2s",
              }}
            >
              {submitting ? (
                <><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}><RefreshCw size={13} strokeWidth={2} /></motion.div> Creating…</>
              ) : (
                <><Check size={13} strokeWidth={2} /> Create campaign</>
              )}
            </motion.button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
