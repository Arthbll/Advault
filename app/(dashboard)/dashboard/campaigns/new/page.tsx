"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, ChevronLeft, ChevronRight, Globe, Monitor, Smartphone, Tablet,
  Upload, RefreshCw, Zap, ArrowLeft, X, ChevronDown, ChevronUp,
  Library, Image as ImageIcon2, Smile as SmileIcon, Film,
  Clock, Building2, Lock, AlertTriangle, TrendingDown, TrendingUp,
  Activity, Shield, Sliders,
} from "lucide-react";

// ─── Reference Data ────────────────────────────────────────────────────────────

const AD_FORMATS = [
  { id: 2,  label: "Banner",            sub: "Display 300×250, 728×90…", urlRequired: true  },
  { id: 4,  label: "Pop-under",         sub: "Opens in background", urlRequired: true  },
  { id: 8,  label: "Interstitial",      sub: "Full-screen between pages",   urlRequired: true  },
  { id: 13, label: "Push Notification", sub: "Browser notification",     urlRequired: false },
  { id: 14, label: "Native",            sub: "Native sponsored content",  urlRequired: true  },
  { id: 5,  label: "In-Video",          sub: "Pre/mid-roll video",        urlRequired: false },
];

const NETWORKS: { id: string; label: string; color: string; rgb: string; disabled: boolean; badge?: string }[] = [
  { id: "EXOCLICK",     label: "ExoClick",     color: "#c08835", rgb: "192,136,53",  disabled: false },
  { id: "TRAFFICSTARS", label: "TrafficStars", color: "#7264a8", rgb: "114,100,168", disabled: false },
  { id: "PROPELLERADS", label: "PropellerAds", color: "#5b6ea8", rgb: "91,110,168",  disabled: false },
  { id: "ADSTERRA",     label: "Adsterra",     color: "#2e7d9c", rgb: "46,125,156",  disabled: false },
  { id: "TRAFFICJUNKY", label: "TrafficJunky", color: "#4a8fb4", rgb: "74,143,180",  disabled: true,  badge: "Sync & manage only" },
];

// ─── PropellerAds direction options ───────────────────────────────────────────
// Swagger confirmed: direction enum = ["onclick", "nativeads"] only.
// Push & Interstitial use different creation flows (creatives endpoint).
const PA_DIRECTIONS = [
  { id: "onclick",   label: "Pop-under / Onclick", sub: "Opens in background tab", apiVal: "onclick"   },
  { id: "nativeads", label: "Native Ads",           sub: "Native sponsored content", apiVal: "nativeads" },
];

const PA_RATE_MODELS = [
  { value: "cpm",  label: "CPM",  sub: "Cost per 1000 impressions" },
  { value: "cpc",  label: "CPC",  sub: "Cost per click"            },
];

// ─── Adsterra format options ──────────────────────────────────────────────────
const ADT_FORMATS = [
  { id: "pop",          label: "Pop-under",     sub: "Opens in background"        },
  { id: "direct",       label: "Direct Link",   sub: "URL-based traffic"          },
  { id: "banner",       label: "Banner",        sub: "Display 300×250, 728×90…"   },
  { id: "native",       label: "Native",        sub: "Native sponsored content"   },
  { id: "push",         label: "Push",          sub: "Browser push notification"  },
  { id: "interstitial", label: "Interstitial",  sub: "Full-screen between pages"  },
];

const ADT_PRICING_TYPES = [
  { value: "CPM",  label: "CPM",  sub: "Cost per 1000 impressions" },
  { value: "CPC",  label: "CPC",  sub: "Cost per click"            },
  { value: "CPA",  label: "CPA",  sub: "Cost per action"           },
];

// ─── Time slot presets ─────────────────────────────────────────────────────────

const TIME_PRESETS = [
  { id: "morning",   label: "Morning",   sub: "6am – 12pm",  hours: [6,7,8,9,10,11],         recommended: false },
  { id: "afternoon", label: "Afternoon", sub: "12pm – 6pm",  hours: [12,13,14,15,16,17],      recommended: false },
  { id: "evening",   label: "Evening",   sub: "6pm – 12am",  hours: [18,19,20,21,22,23],      recommended: true  },
  { id: "night",     label: "Night",     sub: "12am – 6am",  hours: [0,1,2,3,4,5],            recommended: false },
];

// ─── Publisher sites ───────────────────────────────────────────────────────────
// minCpm = minimum CPM (€) required on the network to get impressions on this site.
// Values sourced from ExoClick/TrafficStars publisher data (Popunder, Tier-1 geos).
// TODO: replace with live data from ExoClick API /publishers endpoint.

type PublisherSite = {
  id: string; label: string; cat: string;
  traffic: string; color: string; rgb: string;
  minCpm: number; // minimum CPM in €
};

const EXOCLICK_SITES: PublisherSite[] = [
  // ── Tube ─────────────────────────────────────────────────────────────────────
  { id: "xvideos",      label: "xVideos",             cat: "Tube",    traffic: "130M+/j",  color: "#c08835", rgb: "192,136,53",  minCpm: 1.80 },
  { id: "xnxx",         label: "XNXX",                cat: "Tube",    traffic: "100M+/j",  color: "#6b9e82", rgb: "107,158,130", minCpm: 1.40 },
  { id: "xhamster",     label: "xHamster",            cat: "Tube",    traffic: "85M+/j",   color: "#8575b8", rgb: "133,117,184", minCpm: 1.10 },
  { id: "spankbang",    label: "SpankBang",           cat: "Tube",    traffic: "45M+/j",   color: "#a07070", rgb: "160,112,112", minCpm: 0.80 },
  { id: "redtube_ec",   label: "RedTube",             cat: "Tube",    traffic: "30M+/j",   color: "#a07070", rgb: "160,112,112", minCpm: 0.55 },
  { id: "youporn_ec",   label: "YouPorn",             cat: "Tube",    traffic: "25M+/j",   color: "#6b9e82", rgb: "107,158,130", minCpm: 0.50 },
  { id: "tube8_ec",     label: "Tube8",               cat: "Tube",    traffic: "18M+/j",   color: "#4a8fb4", rgb: "74,143,180",  minCpm: 0.40 },
  { id: "drtuber",      label: "DrTuber",             cat: "Tube",    traffic: "6M+/j",    color: "#8575b8", rgb: "133,117,184", minCpm: 0.20 },
  { id: "tubegalore",   label: "TubeGalore",          cat: "Tube",    traffic: "4M+/j",    color: "#c08835", rgb: "192,136,53",  minCpm: 0.16 },
  { id: "slutload",     label: "SlutLoad",            cat: "Tube",    traffic: "3M+/j",    color: "#a07070", rgb: "160,112,112", minCpm: 0.14 },
  { id: "hclips",       label: "HClips",              cat: "Tube",    traffic: "2M+/j",    color: "#6b9e82", rgb: "107,158,130", minCpm: 0.10 },
  { id: "4tube",        label: "4Tube",               cat: "Tube",    traffic: "2M+/j",    color: "#6b9e82", rgb: "107,158,130", minCpm: 0.10 },
  { id: "fapdu",        label: "Fapdu",               cat: "Tube",    traffic: "1M+/j",    color: "#8575b8", rgb: "133,117,184", minCpm: 0.08 },
  // ── Cams ──────────────────────────────────────────────────────────────────────
  { id: "chaturbate",   label: "Chaturbate",          cat: "Cams",    traffic: "60M+/j",   color: "#c08835", rgb: "192,136,53",  minCpm: 1.00 },
  { id: "bongacams",    label: "BongaCams",           cat: "Cams",    traffic: "28M+/j",   color: "#8575b8", rgb: "133,117,184", minCpm: 0.70 },
  { id: "cam4",         label: "Cam4",                cat: "Cams",    traffic: "12M+/j",   color: "#6b9e82", rgb: "107,158,130", minCpm: 0.45 },
  { id: "stripchat_ec", label: "Stripchat",           cat: "Cams",    traffic: "10M+/j",   color: "#a07070", rgb: "160,112,112", minCpm: 0.40 },
  { id: "xcams",        label: "xCams",               cat: "Cams",    traffic: "4M+/j",    color: "#6b9e82", rgb: "107,158,130", minCpm: 0.22 },
  // ── Dating ────────────────────────────────────────────────────────────────────
  { id: "adultff",      label: "Adult Friend Finder", cat: "Dating",  traffic: "22M+/j",   color: "#a07070", rgb: "160,112,112", minCpm: 1.20 },
  { id: "ashley",       label: "Ashley Madison",      cat: "Dating",  traffic: "14M+/j",   color: "#8575b8", rgb: "133,117,184", minCpm: 0.90 },
  { id: "fling",        label: "Fling",               cat: "Dating",  traffic: "5M+/j",    color: "#6b9e82", rgb: "107,158,130", minCpm: 0.50 },
  { id: "adultspace",   label: "AdultSpace",          cat: "Dating",  traffic: "2M+/j",    color: "#c08835", rgb: "192,136,53",  minCpm: 0.25 },
  // ── Niche ─────────────────────────────────────────────────────────────────────
  { id: "gaytube",      label: "GayTube",             cat: "Niche",   traffic: "8M+/j",    color: "#8575b8", rgb: "133,117,184", minCpm: 0.30 },
  { id: "trannytube",   label: "TrannyTube",          cat: "Niche",   traffic: "4M+/j",    color: "#a07070", rgb: "160,112,112", minCpm: 0.22 },
  { id: "hentaigasm",   label: "HentaiGasm",          cat: "Niche",   traffic: "3M+/j",    color: "#6b9e82", rgb: "107,158,130", minCpm: 0.20 },
  { id: "hentaiz",      label: "HentaiZ",             cat: "Niche",   traffic: "2M+/j",    color: "#8575b8", rgb: "133,117,184", minCpm: 0.18 },
  { id: "maturetube",   label: "MatureTube",          cat: "Niche",   traffic: "2M+/j",    color: "#c08835", rgb: "192,136,53",  minCpm: 0.15 },
  { id: "bbwtube",      label: "BBW Tube",            cat: "Niche",   traffic: "1M+/j",    color: "#6b9e82", rgb: "107,158,130", minCpm: 0.12 },
  { id: "ebonytube",    label: "Ebony Tube",          cat: "Niche",   traffic: "1M+/j",    color: "#a07070", rgb: "160,112,112", minCpm: 0.12 },
];

const TRAFFICSTARS_SITES: PublisherSite[] = [
  // ── Tube ─────────────────────────────────────────────────────────────────────
  { id: "pornhub_ts",   label: "Pornhub",             cat: "Tube",    traffic: "180M+/j",  color: "#c08835", rgb: "192,136,53",  minCpm: 2.00 },
  { id: "redtube_ts",   label: "RedTube",             cat: "Tube",    traffic: "30M+/j",   color: "#a07070", rgb: "160,112,112", minCpm: 0.60 },
  { id: "tube8_ts",     label: "Tube8",               cat: "Tube",    traffic: "18M+/j",   color: "#4a8fb4", rgb: "74,143,180",  minCpm: 0.40 },
  { id: "youporn_ts",   label: "YouPorn",             cat: "Tube",    traffic: "25M+/j",   color: "#6b9e82", rgb: "107,158,130", minCpm: 0.55 },
  { id: "xtube_ts",     label: "xTube",               cat: "Tube",    traffic: "6M+/j",    color: "#8575b8", rgb: "133,117,184", minCpm: 0.20 },
  // ── Cams ──────────────────────────────────────────────────────────────────────
  { id: "livejasmin",   label: "LiveJasmin",          cat: "Cams",    traffic: "35M+/j",   color: "#c08835", rgb: "192,136,53",  minCpm: 1.10 },
  { id: "myfreecams",   label: "MyFreeCams",          cat: "Cams",    traffic: "20M+/j",   color: "#6b9e82", rgb: "107,158,130", minCpm: 0.70 },
  { id: "stripchat",    label: "Stripchat",           cat: "Cams",    traffic: "18M+/j",   color: "#8575b8", rgb: "133,117,184", minCpm: 0.60 },
  { id: "flirt4free",   label: "Flirt4Free",          cat: "Cams",    traffic: "5M+/j",    color: "#a07070", rgb: "160,112,112", minCpm: 0.35 },
  // ── Premium ────────────────────────────────────────────────────────────────
  { id: "brazzers_ts",  label: "Brazzers",            cat: "Premium", traffic: "40M+/j",   color: "#b09040", rgb: "176,144,64",  minCpm: 2.50 },
  { id: "realitykings", label: "Reality Kings",       cat: "Premium", traffic: "15M+/j",   color: "#8575b8", rgb: "133,117,184", minCpm: 2.00 },
  { id: "privatecom",   label: "Private.com",         cat: "Premium", traffic: "10M+/j",   color: "#a07070", rgb: "160,112,112", minCpm: 1.80 },
];

const PUBLISHER_SITES_BY_NETWORK: Record<string, PublisherSite[]> = {
  EXOCLICK:     EXOCLICK_SITES,
  TRAFFICSTARS: TRAFFICSTARS_SITES,
};

const TIER1 = [
  { code: "US", name: "United States" }, { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" }, { code: "DE", name: "Germany" },
  { code: "FR", name: "France" }, { code: "AU", name: "Australia" },
  { code: "JP", name: "Japan" }, { code: "CH", name: "Switzerland" },
  { code: "NO", name: "Norway" }, { code: "SE", name: "Sweden" },
  { code: "DK", name: "Denmark" }, { code: "FI", name: "Finland" },
  { code: "NL", name: "Netherlands" }, { code: "BE", name: "Belgium" },
  { code: "AT", name: "Austria" },
];

const TIER2 = [
  { code: "ES", name: "Spain" }, { code: "IT", name: "Italy" },
  { code: "PL", name: "Poland" }, { code: "CZ", name: "Czech Republic" },
  { code: "HU", name: "Hungary" }, { code: "RO", name: "Romania" },
  { code: "TR", name: "Turkey" }, { code: "KR", name: "South Korea" },
  { code: "IL", name: "Israel" }, { code: "SG", name: "Singapore" },
  { code: "AE", name: "UAE" }, { code: "SA", name: "Saudi Arabia" },
  { code: "PT", name: "Portugal" }, { code: "GR", name: "Greece" },
];

const TIER3 = [
  { code: "BR", name: "Brazil" }, { code: "MX", name: "Mexico" },
  { code: "AR", name: "Argentina" }, { code: "CO", name: "Colombia" },
  { code: "IN", name: "India" }, { code: "PH", name: "Philippines" },
  { code: "TH", name: "Thailand" }, { code: "VN", name: "Vietnam" },
  { code: "MY", name: "Malaysia" }, { code: "ID", name: "Indonesia" },
  { code: "EG", name: "Egypt" }, { code: "NG", name: "Nigeria" },
  { code: "ZA", name: "South Africa" }, { code: "RU", name: "Russia" },
  { code: "UA", name: "Ukraine" },
];

const ALL_COUNTRIES = [...TIER1, ...TIER2, ...TIER3];

const DEVICES = [
  { id: "desktop", label: "Desktop", icon: Monitor },
  { id: "mobile",  label: "Mobile",  icon: Smartphone },
  { id: "tablet",  label: "Tablet",  icon: Tablet },
];

const OS_OPTIONS = [
  { id: "windows", label: "Windows", icon: "🪟" },
  { id: "macos",   label: "macOS",   icon: "🍎" },
  { id: "linux",   label: "Linux",   icon: "🐧" },
  { id: "android", label: "Android", icon: "🤖" },
  { id: "ios",     label: "iOS",     icon: "📱" },
];

const FREQ_CAP_PERIODS = [
  { value: "1",  label: "1 heure" },
  { value: "3",  label: "3 heures" },
  { value: "6",  label: "6 heures" },
  { value: "12", label: "12 heures" },
  { value: "24", label: "24 heures" },
];

// ─── Per-network wizard step definitions ──────────────────────────────────────
type StepKey =
  | "identity" | "ec-format" | "ts-campaign" | "pa-format" | "adt-campaign"
  | "geo" | "devices" | "publishers" | "schedule" | "ts-schedule"
  | "budget" | "rules" | "creative";

const NETWORK_WIZARD: Record<string, Array<{key: StepKey; label: string; sub: string}>> = {
  EXOCLICK: [
    { key: "identity",   label: "Identity",   sub: "Network, name & URL"          },
    { key: "ec-format",  label: "Format",     sub: "Ad type & pricing model"      },
    { key: "geo",        label: "Geo",        sub: "Countries & regions"          },
    { key: "devices",    label: "Targeting",  sub: "Devices & OS"                 },
    { key: "publishers", label: "Publishers", sub: "Publication sites"            },
    { key: "schedule",   label: "Schedule",   sub: "Time slots & frequency cap"   },
    { key: "budget",     label: "Budget",     sub: "Bid & spend limits"           },
    { key: "rules",      label: "Rules",      sub: "Kill · Watch · Scale"         },
    { key: "creative",   label: "Creative",   sub: "Visual & summary"             },
  ],
  TRAFFICSTARS: [
    { key: "identity",    label: "Identity",   sub: "Network, name & URL"     },
    { key: "ts-campaign", label: "Campaign",   sub: "Format & traffic type"   },
    { key: "geo",         label: "Geo",        sub: "Countries & regions"     },
    { key: "devices",     label: "Targeting",  sub: "Devices & OS"            },
    { key: "ts-schedule", label: "Schedule",   sub: "Hours grid & freq cap"   },
    { key: "publishers",  label: "Publishers", sub: "Publication sites"       },
    { key: "budget",      label: "Budget",     sub: "Pricing, bid & limits"   },
    { key: "rules",       label: "Rules",      sub: "Kill · Watch · Scale"    },
    { key: "creative",    label: "Creative",   sub: "Visual & summary"        },
  ],
  PROPELLERADS: [
    { key: "identity",  label: "Identity",  sub: "Network, name & URL"   },
    { key: "pa-format", label: "Format",    sub: "Direction & pricing"   },
    { key: "geo",       label: "Geo",       sub: "Countries & regions"   },
    { key: "devices",   label: "Targeting", sub: "Devices & OS"          },
    { key: "schedule",  label: "Schedule",  sub: "Time slots"            },
    { key: "budget",    label: "Budget",    sub: "Bid & spend limits"    },
    { key: "rules",     label: "Rules",     sub: "Kill · Watch · Scale"  },
    { key: "creative",  label: "Creative",  sub: "Visual & summary"      },
  ],
  ADSTERRA: [
    { key: "identity",     label: "Identity",  sub: "Network, name & URL"       },
    { key: "adt-campaign", label: "Campaign",  sub: "Format & pricing type"     },
    { key: "geo",          label: "Geo",       sub: "Countries & regions"       },
    { key: "devices",      label: "Targeting", sub: "Devices & OS"              },
    { key: "schedule",     label: "Schedule",  sub: "Time slots"                },
    { key: "budget",       label: "Budget",    sub: "Bid & spend limits"        },
    { key: "rules",        label: "Rules",     sub: "Kill · Watch · Scale"      },
    { key: "creative",     label: "Creative",  sub: "Visual & summary"          },
  ],
};

// ExoClick pricing models (1=CPC, 2=CPM, 3=SmartBid, 4=SmartCPM)
const EC_PRICING_MODELS = [
  { value: "cpm",       label: "CPM",      sub: "Cost per 1000 impressions"             },
  { value: "cpc",       label: "CPC",      sub: "Cost per click"                        },
  { value: "smart_cpm", label: "SmartCPM", sub: "Auto-optimized CPM within your budget" },
  { value: "smart_bid", label: "SmartBid", sub: "Bid auto-adjusted by performance"      },
];

// TrafficStars traffic type
const TS_TRAFFIC_TYPES = [
  { value: "ron",          label: "RON",          sub: "Run of Network — all sites"  },
  { value: "prime",        label: "Prime",         sub: "Premium partner sites only"  },
  { value: "members_area", label: "Members Area",  sub: "Logged-in users only"        },
];

// PropellerAds extended rate models
const PA_RATE_MODELS_EXT = [
  { value: "cpm",  label: "CPM",       sub: "Cost per 1000 impressions"       },
  { value: "cpc",  label: "CPC",       sub: "Cost per click"                  },
  { value: "scpm", label: "SmartCPM",  sub: "Auto-optimized CPM"              },
  { value: "scpc", label: "SmartCPC",  sub: "Auto-optimized CPC"              },
];

// ─── Styles ────────────────────────────────────────────────────────────────────

// Vision-style design tokens
const cardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.02)",
  borderRadius: 26,
  padding: "24px",
  border: "1px solid rgba(255,255,255,0.08)",
};

const inputStyle: React.CSSProperties = {
  width: "100%", height: 56, padding: "0 20px", borderRadius: 16, fontSize: 16, outline: "none",
  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
  color: "rgba(255,255,255,0.85)", transition: "border-color 0.15s, background 0.15s",
  boxSizing: "border-box", colorScheme: "dark",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, letterSpacing: "0.24em",
  textTransform: "uppercase", color: "rgba(255,255,255,0.24)", display: "block", marginBottom: 16,
};

// Selected/active card state (green tint from vision)
const selectedCard: React.CSSProperties = {
  border: "1px solid rgba(74,222,128,0.20)",
  background: "rgba(16,185,129,0.08)",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function focusGreen(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = "rgba(74,222,128,0.25)";
  e.currentTarget.style.background  = "rgba(255,255,255,0.05)";
}
function blurReset(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
  e.currentTarget.style.background  = "rgba(255,255,255,0.03)";
}

// ─── Slide animation ───────────────────────────────────────────────────────────

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 48 : -48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:  (dir: number) => ({ x: dir > 0 ? -48 : 48, opacity: 0 }),
};

// ─── Draft persistence ────────────────────────────────────────────────────────

const DRAFT_KEY = "profitdash_campaign_draft";

interface _DraftMeta {
  name:    string;
  step:    number;
  savedAt: string;
}

// ─── Form state ────────────────────────────────────────────────────────────────

interface FormState {
  network:        string;
  name:           string;
  url:            string;
  adFormat:       number;
  countries:      string[];
  devices:        string[];
  os:             string[];
  timeSlots:      number[];
  publisherSites: string[];
  bidType:        "cpm" | "cpc";
  bid:            string;
  dailyBudget:    string;
  // ── PropellerAds specific ───────────────────────────────────────────────────
  paDirection:    string;  // "onclick" | "push" | "nativeads" | "interstitial"
  paRateModel:    string;  // "cpm" | "cpc"
  // ── Adsterra specific ───────────────────────────────────────────────────────
  adtFormat:      string;  // "pop" | "direct" | "banner" | "native" | "push" | "interstitial"
  adtPricingType: string;  // "CPM" | "CPC" | "CPA"
  totalBudget:    string;
  freqCapImps:    string;
  freqCapHrs:     string;
  active:         boolean;
  imageFile:      File | null;
  imagePreview:   string | null;
  mediaType:      "image" | "video" | null;
  vaultAssetName: string | null;
  // ── Decision Rules ──────────────────────────────────────────────────────────
  engineActive:          boolean;
  killThreshold:         number;  // ROI % below which campaign is killed
  watchMinRoi:           number;  // ROI % lower bound of watch zone
  watchMaxRoi:           number;  // ROI % upper bound of watch zone
  scaleThreshold:        number;  // ROI % above which campaign is scaled
  scaleBy:               number;  // budget increase % when scaling
  maxScalingBudget:      number;  // max daily budget after scaling (€)
  minSpendBeforeAction:  number;  // min € spent before engine acts
  cooldownMins:          number;  // minutes between consecutive actions
  maxActionsPerDay:      number;  // max engine actions per day
  scanFreqMins:          number;  // how often engine scans (minutes)
  // ── Per-network extras (linked to APIs) ─────────────────────────────────────
  ecPricingModel:  string;  // ExoClick: "cpm"|"cpc"|"smart_cpm"|"smart_bid"
  tsTrafficType:   string;  // TrafficStars: "ron"|"prime"|"members_area"
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NewCampaignPage() {
  const router = useRouter();

  const [step,        setStep]        = useState(0);
  const [maxStep,     setMaxStep]     = useState(0);
  const [dir,         setDir]         = useState(1);
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [success,      setSuccess]      = useState(false);
  const [createdName,  setCreatedName]  = useState("");
  const [verification, setVerification] = useState<{ verified: boolean; id?: string; name?: string; status?: string; reason?: string } | null>(null);
  const [vaultOpen,   setVaultOpen]   = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const [showAdvanced,    setShowAdvanced]    = useState(false);
  const [countrySearch,   setCountrySearch]   = useState("");
  const isFirstRender = useRef(true);

  const dropRef     = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>({
    network:        "EXOCLICK",
    name:           "",
    url:            "",
    adFormat:       2,
    countries:      [],
    devices:        ["desktop", "mobile", "tablet"],
    os:             ["windows", "macos", "linux", "android", "ios"],
    timeSlots:      [],
    publisherSites: [],
    bidType:        "cpm",
    bid:            "",
    dailyBudget:    "",
    totalBudget:    "",
    freqCapImps:    "",
    freqCapHrs:     "24",
    paDirection:    "onclick",
    paRateModel:    "cpm",
    adtFormat:      "pop",
    adtPricingType: "CPM",
    active:         false,
    imageFile:      null,
    imagePreview:   null,
    mediaType:      null,
    vaultAssetName: null,
    // Decision Rules defaults
    engineActive:         false,
    killThreshold:        -30,
    watchMinRoi:          -10,
    watchMaxRoi:           30,
    scaleThreshold:        50,
    scaleBy:               25,
    maxScalingBudget:     200,
    minSpendBeforeAction:  10,
    cooldownMins:         120,
    maxActionsPerDay:       5,
    scanFreqMins:          60,
    ecPricingModel:  "cpm",
    tsTrafficType:   "ron",
  });

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(p => ({ ...p, [k]: v }));

  function toggleArr<T>(arr: T[], val: T): T[] {
    return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
  }


  // ── Draft: auto-save on every form/step change ────────────────────────────
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (success) return;
    if (!form.name.trim() && step === 0) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        form: {
          ...form,
          imageFile:    null,
          imagePreview: form.imagePreview?.startsWith("blob:") ? null : form.imagePreview,
        },
        step,
        maxStep,
        savedAt: new Date().toISOString(),
      }));
    } catch { /* quota exceeded */ }
  }, [form, step, success, maxStep]);

  // ── Draft: restore on mount (when navigating from the modal "Continue" button) ─
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.form && (data.form.name?.trim().length > 0 || (data.step ?? 0) > 0)) {
        setForm(prev => ({ ...prev, ...data.form, imageFile: null }));
        setStep(data.step ?? 0);
        setMaxStep(data.maxStep ?? data.step ?? 0);
      }
    } catch { /* localStorage inaccessible */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearDraftOnSuccess() {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* */ }
  }

  // ── Per-step validation ──────────────────────────────────────────────────────
  const selectedFormat = AD_FORMATS.find(f => f.id === form.adFormat);
  const isPA  = form.network === "PROPELLERADS";
  const isADT = form.network === "ADSTERRA";
  const urlFilled = form.url.trim().length > 4;

  // Per-network step config
  const activeSteps = NETWORK_WIZARD[form.network] ?? NETWORK_WIZARD.EXOCLICK;
  const currentKey  = activeSteps[step]?.key ?? "identity";

  // Validity per step key
  const identityValid = form.name.trim().length > 2;
  const budgetValid   = parseFloat(form.bid) > 0 && parseFloat(form.dailyBudget) > 0;

  const stepValidMap: Record<string, boolean> = {
    "identity":     identityValid,
    "ec-format":    form.adFormat > 0,
    "ts-campaign":  form.adFormat > 0,
    "pa-format":    true,
    "adt-campaign": true,
    "geo":          true,
    "devices":      form.devices.length > 0,
    "publishers":   true,
    "schedule":     true,
    "ts-schedule":  true,
    "budget":       budgetValid,
    "rules":        true,
    "creative":     true,
  };

  const stepValid = activeSteps.map(s => stepValidMap[s.key] ?? true);

  // ── Navigation ───────────────────────────────────────────────────────────────
  function goNext() {
    if (!stepValid[step]) return;
    setDir(1);
    setStep(s => {
      const next = Math.min(s + 1, activeSteps.length - 1);
      setMaxStep(m => Math.max(m, next));
      return next;
    });
    setError(null);
  }
  function goBack() {
    setDir(-1);
    setStep(s => Math.max(s - 1, 0));
    setError(null);
  }
  function goToStep(target: number) {
    // Navigable to any step already reached
    if (target === step || target > maxStep) return;
    setDir(target < step ? -1 : 1);
    setStep(target);
    setError(null);
  }

  // ── File drop ────────────────────────────────────────────────────────────────
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.type.startsWith("image/") || file.type.startsWith("video/"))) {
      const url = URL.createObjectURL(file);
      const mtype = file.type.startsWith("video/") ? "video" : "image";
      setForm(p => ({ ...p, imageFile: file, imagePreview: url, mediaType: mtype, vaultAssetName: null }));
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const mtype = file.type.startsWith("video/") ? "video" : "image";
      setForm(p => ({ ...p, imageFile: file, imagePreview: url, mediaType: mtype, vaultAssetName: null }));
    }
  };

  // ── Submit ───────────────────────────────────────────────────────────────────
  // ExoClick format IDs → TrafficStars format IDs
  // Mapping ExoClick format IDs → TrafficStars format IDs réels (GET /v1.1/ad_formats)
  const TS_FORMAT_MAP: Record<number, number> = {
    2:  1,   // Banner      → TS Banner 300x250 (id 1)
    4:  7,   // Pop-under   → TS Popunder (id 7) — l'ancien id 4 était déprécié
    8:  105, // Interstitial → TS Interstitial Full Page (id 105)
    13: 104, // Push        → TS Push (id 104)
    14: 62,  // Native      → TS Native (id 62, pas 65)
    5:  63,  // In-Video    → TS Video (id 63)
  };

  async function handleSubmit() {
    if (!budgetValid) return;
    setSubmitting(true);
    setError(null);
    try {
      const isTS  = form.network === "TRAFFICSTARS";
      const isTJ  = form.network === "TRAFFICJUNKY";
      const isPA  = form.network === "PROPELLERADS";
      const isADT = form.network === "ADSTERRA";

      const res = await fetch("/api/campaigns/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          network:        form.network,
          name:           form.name.trim(),
          url:            form.url.trim(),
          adFormat:       form.adFormat,

          // ── TrafficStars: format_id + pricing_model + price + max_daily + traffic_type
          ...(isTS ? {
            format_id:     TS_FORMAT_MAP[form.adFormat] ?? 1,
            pricing_model: form.bidType === "cpc" ? "cpc" : "cpm",
            price:         parseFloat(form.bid),
            max_daily:     form.dailyBudget ? parseFloat(form.dailyBudget) : 10,
            traffic_type:  form.tsTrafficType,
          } : {}),

          // ── TrafficJunky: dailyBudget + bidType + bid
          ...(isTJ ? {
            dailyBudget:  form.dailyBudget ? parseFloat(form.dailyBudget) : 10,
            bidType:      form.bidType,
            bid:          parseFloat(form.bid),
          } : {}),

          // ── PropellerAds: direction + rate_model
          ...(isPA ? {
            direction:    form.paDirection,
            rate_model:   form.paRateModel,
          } : {}),

          // ── Adsterra: format + pricing_type
          ...(isADT ? {
            format:        form.adtFormat,
            pricing_type:  form.adtPricingType,
          } : {}),

          // For ExoClick, use ecPricingModel (CPM/CPC/SmartCPM/SmartBid); for others, use generic bidType
          bidType:        form.network === "EXOCLICK" ? form.ecPricingModel : form.bidType,
          bid:            parseFloat(form.bid),
          dailyBudget:    form.dailyBudget ? parseFloat(form.dailyBudget) : undefined,
          totalBudget:    form.totalBudget ? parseFloat(form.totalBudget) : undefined,
          countries:      form.countries.length > 0      ? form.countries      : undefined,
          devices:        form.devices.length > 0        ? form.devices        : undefined,
          os:             form.os.length > 0             ? form.os             : undefined,
          timeSlots:      form.timeSlots.length > 0      ? form.timeSlots      : undefined,
          publisherSites: form.publisherSites.length > 0 ? form.publisherSites : undefined,
          freqCap:        form.freqCapImps ? { imps: parseInt(form.freqCapImps), hours: parseInt(form.freqCapHrs) } : undefined,
          active:         form.active,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.error == null) {
        setCreatedName(form.name.trim());
        setVerification(json.verification ?? null);
        clearDraftOnSuccess();
        setSuccess(true);
      } else {
        setError(json.error ?? `Erreur ${res.status}`);
      }
    } catch {
      setError("Network error");
    }
    setSubmitting(false);
  }

  // ── Geo helpers ──────────────────────────────────────────────────────────────
  const filteredCountries = countrySearch.trim()
    ? ALL_COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
        c.code.toLowerCase().includes(countrySearch.toLowerCase())
      )
    : null; // null = show tiers

  function toggleTier(tierCountries: { code: string }[]) {
    const codes = tierCountries.map(c => c.code);
    const allOn = codes.every(c => form.countries.includes(c));
    if (allOn) {
      set("countries", form.countries.filter(c => !codes.includes(c)));
    } else {
      set("countries", [...new Set([...form.countries, ...codes])]);
    }
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // SUCCESS SCREEN
  // ─────────────────────────────────────────────────────────────────────────────
  if (success) {
    const NET_NAME: Record<string, string> = {
      EXOCLICK: "ExoClick", TRAFFICSTARS: "TrafficStars",
      PROPELLERADS: "PropellerAds", ADSTERRA: "Adsterra",
      TRAFFICJUNKY: "TrafficJunky",
    };
    const networkLabel = NET_NAME[form.network] ?? form.network;
    return (
      <div style={{ minHeight: "100vh", background: "#04050a", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
          style={{ width: "100%", maxWidth: 520, textAlign: "center" as const }}
        >

                {/* Icon */}
                <motion.div
                  initial={{ scale: 0.72, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.42, ease: [0.23, 1, 0.32, 1] }}
                  style={{
                    margin: "0 auto", width: 72, height: 72, borderRadius: "50%",
                    border: "1px solid rgba(52,211,153,0.18)",
                    background: "rgba(16,185,129,0.06)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ color: "rgba(167,243,208,0.90)" }}>
                    <path d="M5 12.5L10 17L19 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </motion.div>

                {/* Text */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22, duration: 0.38 }}>
                  <p style={{ marginTop: 24, fontSize: 10, textTransform: "uppercase" as const, letterSpacing: "0.26em", color: "rgba(167,243,208,0.60)" }}>
                    Campaign created
                  </p>
                  <h1 style={{ marginTop: 12, fontSize: 38, lineHeight: 1.0, letterSpacing: "-0.05em", fontWeight: 300, color: "rgba(255,255,255,0.92)" }}>
                    {createdName}
                  </h1>
                  <p style={{ margin: "14px auto 0", maxWidth: 380, fontSize: 15, lineHeight: 1.7, color: "rgba(255,255,255,0.38)" }}>
                    Live on {networkLabel}.
                  </p>

                  {/* Verification badge — direct GET /campaign/{id} confirmation */}
                  {verification !== null && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5, duration: 0.3 }}
                      style={{
                        marginTop: 18,
                        padding: "14px 20px", borderRadius: 18,
                        background: verification.verified ? "rgba(16,185,129,0.06)" : "rgba(251,191,36,0.06)",
                        border: `1px solid ${verification.verified ? "rgba(74,222,128,0.20)" : "rgba(251,191,36,0.20)"}`,
                        display: "flex", flexDirection: "column", gap: 6,
                        textAlign: "left",
                      }}
                    >
                      {/* Status row */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{
                          width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                          background: verification.verified ? "#4ade80" : "#fbbf24",
                          boxShadow: verification.verified ? "0 0 6px #4ade80" : "0 0 6px #fbbf24",
                        }} />
                        <span style={{
                          fontSize: 11, fontWeight: 700, letterSpacing: "0.14em",
                          textTransform: "uppercase",
                          color: verification.verified ? "#86efac" : "#fde68a",
                        }}>
                          {verification.verified ? "Confirmed live on network" : "Pending propagation"}
                        </span>
                      </div>

                      {/* Details row */}
                      {verification.verified && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", paddingLeft: 16 }}>
                          {verification.id && (
                            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.38)" }}>
                              ID <span style={{ color: "rgba(255,255,255,0.70)", fontFamily: "monospace" }}>{verification.id}</span>
                            </span>
                          )}
                          {verification.name && (
                            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.38)" }}>
                              Name <span style={{ color: "rgba(255,255,255,0.70)" }}>{verification.name}</span>
                            </span>
                          )}
                          {verification.status && (
                            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.38)" }}>
                              Status <span style={{ color: "rgba(255,255,255,0.70)" }}>{verification.status}</span>
                            </span>
                          )}
                        </div>
                      )}

                      {/* Failure reason */}
                      {!verification.verified && verification.reason && (
                        <p style={{ fontSize: 11, color: "rgba(253,230,138,0.60)", margin: "0 0 0 16px", lineHeight: 1.5 }}>
                          {verification.reason}
                        </p>
                      )}
                    </motion.div>
                  )}
                </motion.div>

                {/* Actions */}
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36, duration: 0.36 }}>
                  <div style={{ marginTop: 32, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => router.push("/dashboard/campaigns")}
                      style={{
                        height: 44, borderRadius: 14, padding: "0 22px", fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none",
                        background: "#ffffff",
                        color: "#000000",
                      }}
                    >
                      View campaign
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => router.push("/dashboard/campaigns")}
                      style={{
                        height: 44, borderRadius: 14, padding: "0 22px", fontSize: 13, fontWeight: 500, cursor: "pointer",
                        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
                        color: "rgba(255,255,255,0.60)",
                      }}
                    >
                      Back to campaigns
                    </motion.button>
                  </div>

                  {/* Discreet link */}
                  <motion.button
                    whileHover={{ color: "rgba(255,255,255,0.60)" }}
                    onClick={() => {
                      setSuccess(false);
                      setStep(0);
                      setDir(1);
                      setForm({
                        network: "EXOCLICK", name: "", url: "", adFormat: 2, countries: [],
                        devices: ["desktop","mobile","tablet"], os: ["windows","macos","linux","android","ios"],
                        timeSlots: [], publisherSites: [],
                        bidType: "cpm", bid: "", dailyBudget: "", totalBudget: "",
                        freqCapImps: "", freqCapHrs: "24", active: false,
                        paDirection: "onclick", paRateModel: "cpm",
                        adtFormat: "pop", adtPricingType: "CPM",
                        imageFile: null, imagePreview: null, mediaType: null, vaultAssetName: null,
                        engineActive: false,
                        killThreshold: -30, watchMinRoi: -10, watchMaxRoi: 30, scaleThreshold: 50,
                        scaleBy: 25, maxScalingBudget: 200, minSpendBeforeAction: 10,
                        cooldownMins: 120, maxActionsPerDay: 5, scanFreqMins: 60,
                        ecPricingModel: "cpm",
                        tsTrafficType: "ron",
                      });
                    }}
                    style={{
                      marginTop: 20, fontSize: 14, color: "rgba(255,255,255,0.40)",
                      background: "none", border: "none", cursor: "pointer", transition: "color 0.2s",
                    }}
                  >
                    Create another
                  </motion.button>
                </motion.div>

        </motion.div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // AD PREVIEW SCREEN
  // ─────────────────────────────────────────────────────────────────────────────
  if (showPreview) {
    return (
      <AdPreviewScreen
        form={form}
        onBack={() => setShowPreview(false)}
        onLaunch={handleSubmit}
        submitting={submitting}
        error={error}
        onUpdateMedia={(preview, file, mediaType, name) =>
          setForm(p => ({ ...p, imagePreview: preview, imageFile: file, mediaType, vaultAssetName: name }))
        }
      />
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // WIZARD
  // ─────────────────────────────────────────────────────────────────────────────
  // Step subtitles for the vision-style header
  const STEP_SUBTITLES: Record<string, string> = {
    "identity":     "Choose your network. Set the campaign name and destination URL.",
    "ec-format":    "Select the ad format and pricing model for ExoClick.",
    "ts-campaign":  "Configure the ad format and traffic type for TrafficStars.",
    "pa-format":    "Select the ad direction and pricing model for PropellerAds.",
    "adt-campaign": "Set the ad format and pricing type for Adsterra.",
    "geo":          "Countries and regions where the campaign can serve.",
    "devices":      "Targeted devices and operating systems.",
    "publishers":   "Publication sites filtered by network. Empty = all available sites.",
    "schedule":     "Choose delivery windows and frequency cap.",
    "ts-schedule":  "Configure hourly targeting and frequency cap for TrafficStars.",
    "budget":       "Bid value, daily budget and total spend cap.",
    "rules":        "Automatic Kill, Watch, Scale based on ROI thresholds you define.",
    "creative":     "Add the visual. Review the summary. Launch.",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#05060a", padding: "32px 28px" }}>
      <div style={{
        maxWidth: 1400, margin: "0 auto",
        display: "grid", gridTemplateColumns: "248px 1fr", gap: 28,
        alignItems: "start",
      }}>

      {/* ── Sidebar ── */}
      <div style={{
        borderRadius: 28,
        border: "1px solid rgba(255,255,255,0.06)",
        background: "linear-gradient(180deg,rgba(12,13,18,0.98),rgba(9,10,15,0.96))",
        overflow: "hidden",
        position: "sticky", top: 32,
      }}>
        {/* Header */}
        <div style={{
          padding: "24px 20px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          <button
            onClick={() => router.push("/dashboard/campaigns")}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "none", border: "none", cursor: "pointer",
              color: "rgba(255,255,255,0.3)", fontSize: 11, padding: 0,
              marginBottom: 14, letterSpacing: "0.04em",
            }}
          >
            <ArrowLeft size={11} strokeWidth={1.3} />
            Campaigns
          </button>
          <div style={{ fontSize: 22, letterSpacing: "-0.04em", fontWeight: 300, color: "rgba(255,255,255,0.9)" }}>
            ProfitDash
          </div>
          <div style={{ marginTop: 3, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.22em", color: "rgba(255,255,255,0.28)" }}>
            Launch wizard
          </div>
        </div>

        {/* Step list */}
        <div style={{ padding: "14px 12px", display: "flex", flexDirection: "column", gap: 3 }}>
          {activeSteps.map((s, i) => {
            const done      = step > i;
            const active    = step === i;
            const clickable = i !== step && i <= maxStep;
            return (
              <div
                key={i}
                onClick={() => goToStep(i)}
                style={{
                  padding: "9px 12px", borderRadius: 12, cursor: clickable ? "pointer" : "default",
                  border: active ? "1px solid rgba(74,222,128,0.18)" : "1px solid transparent",
                  background: active ? "rgba(16,185,129,0.08)" : done ? "transparent" : "transparent",
                  transition: "all 0.15s",
                }}
              >
                {done ? (
                  <span style={{
                    fontSize: 14, color: "rgba(134,239,172,0.8)",
                    display: "flex", alignItems: "center", gap: 6,
                  }}>
                    <Check size={12} strokeWidth={2.5} />
                    {s.label}
                  </span>
                ) : active ? (
                  <span style={{ fontSize: 14, fontWeight: 500, color: "white" }}>
                    {i + 1} · {s.label}
                  </span>
                ) : (
                  <span style={{ fontSize: 14, color: "rgba(255,255,255,0.36)" }}>
                    {i + 1} · {s.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div style={{ padding: "8px 20px 20px" }}>
          <div style={{ height: 2, borderRadius: 99, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
            <motion.div
              animate={{ width: `${((step + 1) / activeSteps.length) * 100}%` }}
              transition={{ duration: 0.3, ease: [0.23,1,0.32,1] }}
              style={{ height: "100%", background: "linear-gradient(90deg,#4ade80,#22d3ee)", borderRadius: 99 }}
            />
          </div>
        </div>
      </div>

      {/* ── Main card ── */}
      <main>
        <div style={{
          borderRadius: 30,
          border: "1px solid rgba(255,255,255,0.06)",
          background: "linear-gradient(180deg,rgba(10,11,17,0.96),rgba(8,9,14,0.98))",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.02), 0 35px 120px rgba(0,0,0,0.45)",
          overflow: "hidden",
        }}>

          {/* Step header */}
          <div style={{
            padding: "32px 36px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            background: "radial-gradient(circle at 22% 0%, rgba(99,102,241,0.08), transparent 35%)",
          }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
              >
                <p style={{
                  fontSize: 11, textTransform: "uppercase", letterSpacing: "0.24em",
                  color: "rgba(134,239,172,0.8)", margin: "0 0 12px",
                }}>
                  Step {step + 1}
                </p>
                <h1 style={{
                  fontSize: 40, lineHeight: 0.96, letterSpacing: "-0.05em",
                  fontWeight: 300, margin: "0 0 16px", color: "rgba(255,255,255,0.95)",
                }}>
                  {activeSteps[step]?.label ?? ""}
                </h1>
                <p style={{
                  color: "rgba(255,255,255,0.46)", fontSize: 15, lineHeight: 1.75,
                  maxWidth: 640, margin: 0,
                }}>
                  {STEP_SUBTITLES[currentKey] ?? ""}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Scrollable step content */}
          <div style={{ padding: "32px 36px", overflowY: "auto", maxHeight: "calc(100vh - 320px)" }}>
          <AnimatePresence custom={dir} mode="wait">
            <motion.div
              key={step}
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
              style={{ display: "flex", flexDirection: "column", gap: 18 }}
            >

              {/* ══════════════════════════════════════════════════════ IDENTITY */}
              {currentKey === "identity" && (
                <>
                  {/* Network selector — tall vision cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
                    {NETWORKS.map(n => {
                      const isSelected = form.network === n.id;
                      return (
                        <motion.div
                          key={n.id}
                          onClick={() => { if (!n.disabled) set("network", n.id); }}
                          whileTap={n.disabled ? {} : { scale: 0.98 }}
                          style={{
                            position: "relative",
                            borderRadius: 24,
                            border: isSelected ? `1px solid rgba(${n.rgb},0.35)` : "1px solid rgba(255,255,255,0.08)",
                            background: "rgba(255,255,255,0.02)",
                            padding: 20, overflow: "hidden",
                            cursor: n.disabled ? "not-allowed" : "pointer",
                            opacity: n.disabled ? 0.55 : 1,
                            boxShadow: isSelected ? `0 20px 60px rgba(${n.rgb},0.10)` : "none",
                            transition: "all 0.2s",
                          }}
                        >
                          {/* gradient overlay when selected */}
                          {isSelected && (
                            <div style={{
                              position: "absolute", inset: 0,
                              background: `linear-gradient(135deg,rgba(${n.rgb},0.14),rgba(${n.rgb},0.03),transparent)`,
                              pointerEvents: "none",
                            }} />
                          )}
                          <div style={{ position: "relative", minHeight: 160, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                              <div>
                                <div style={{ fontSize: 26, letterSpacing: "-0.04em", fontWeight: 300, color: isSelected ? n.color : "rgba(255,255,255,0.78)" }}>
                                  {n.label}
                                </div>
                                <div style={{
                                  marginTop: 8, display: "inline-flex",
                                  borderRadius: 999, padding: "3px 10px", fontSize: 10,
                                  textTransform: "uppercase", letterSpacing: "0.2em",
                                  border: isSelected ? "1px solid rgba(74,222,128,0.20)" : "1px solid rgba(255,255,255,0.10)",
                                  background: isSelected ? "rgba(16,185,129,0.10)" : "rgba(255,255,255,0.03)",
                                  color: isSelected ? "#86efac" : "rgba(255,255,255,0.45)",
                                }}>
                                  {n.disabled ? (n.badge ?? "Coming soon") : "Live now"}
                                </div>
                              </div>
                              <div style={{
                                height: 32, width: 32, borderRadius: "50%", flexShrink: 0,
                                border: isSelected ? "1px solid rgba(134,239,172,0.25)" : "1px solid rgba(255,255,255,0.10)",
                                background: isSelected ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.03)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                color: isSelected ? "#86efac" : "transparent",
                                fontSize: 14,
                              }}>
                                {isSelected && <Check size={14} strokeWidth={2} />}
                              </div>
                            </div>
                            <div style={{ marginTop: 16, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.22em", color: "rgba(255,255,255,0.26)" }}>
                              Network-compatible launch flow
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Name + URL */}
                  <div style={cardStyle}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                      <div>
                        <label style={labelStyle}>Campaign name</label>
                        <input
                          value={form.name}
                          onChange={e => set("name", e.target.value)}
                          placeholder="Ex : ExoClick – Adult – US – Banner"
                          style={inputStyle}
                          onFocus={focusGreen} onBlur={blurReset}
                        />
                      </div>
                      {/* URL field */}
                      <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                          <label style={{ ...labelStyle, marginBottom: 0 }}>Destination URL</label>
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 999,
                            background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)",
                            border: "1px solid rgba(255,255,255,0.10)",
                            letterSpacing: "0.2em", textTransform: "uppercase",
                          }}>
                            Optional
                          </span>
                        </div>
                        <input
                          value={form.url}
                          onChange={e => set("url", e.target.value)}
                          placeholder="https://… (optional)"
                          style={inputStyle}
                          onFocus={focusGreen} onBlur={blurReset}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ExoClick: ec-format */}
              {currentKey === "ec-format" && (
                <>
                  <div style={cardStyle}>
                    <label style={labelStyle}>Format d&apos;annonce</label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      {AD_FORMATS.map(fmt => (
                        <motion.div
                          key={fmt.id}
                          onClick={() => {
                            set("adFormat", fmt.id);
                            if (fmt.id === 4 && form.ecPricingModel === "cpc") set("ecPricingModel", "cpm");
                          }}
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.97 }}
                          style={{
                            padding: "20px", borderRadius: 22, cursor: "pointer", minHeight: 100,
                            display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16,
                            background: form.adFormat === fmt.id ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.02)",
                            border: form.adFormat === fmt.id ? "1px solid rgba(74,222,128,0.20)" : "1px solid rgba(255,255,255,0.08)",
                            transition: "all 0.15s",
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                              <p style={{ fontSize: 20, fontWeight: 300, letterSpacing: "-0.04em", color: form.adFormat === fmt.id ? "white" : "rgba(255,255,255,0.78)", margin: 0 }}>{fmt.label}</p>
                              {!fmt.urlRequired && (
                                <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 7px", borderRadius: 999, background: "rgba(167,139,250,0.1)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.2)", letterSpacing: "0.1em", textTransform: "uppercase", flexShrink: 0 }}>No URL</span>
                              )}
                            </div>
                            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.36)", margin: 0, lineHeight: 1.6 }}>{fmt.sub}</p>
                          </div>
                          <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, marginTop: 2, background: form.adFormat === fmt.id ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.03)", border: form.adFormat === fmt.id ? "1px solid rgba(134,239,172,0.25)" : "1px solid rgba(255,255,255,0.10)", display: "flex", alignItems: "center", justifyContent: "center", color: form.adFormat === fmt.id ? "#86efac" : "transparent", transition: "all 0.2s" }}>
                            {form.adFormat === fmt.id && <Check size={12} strokeWidth={2.5} />}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                  <div style={cardStyle}>
                    <label style={labelStyle}>Pricing model</label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      {EC_PRICING_MODELS.map(m => (
                        <motion.div
                          key={m.value}
                          onClick={() => set("ecPricingModel", m.value)}
                          whileTap={{ scale: 0.97 }}
                          style={{
                            padding: "20px", borderRadius: 22, cursor: "pointer",
                            display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12,
                            background: form.ecPricingModel === m.value ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.02)",
                            border: form.ecPricingModel === m.value ? "1px solid rgba(74,222,128,0.20)" : "1px solid rgba(255,255,255,0.08)",
                            transition: "all 0.15s",
                          }}
                        >
                          <div>
                            <p style={{ fontSize: 22, fontWeight: 300, letterSpacing: "-0.04em", color: form.ecPricingModel === m.value ? "white" : "rgba(255,255,255,0.78)", margin: "0 0 8px" }}>{m.label}</p>
                            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.36)", margin: 0 }}>{m.sub}</p>
                          </div>
                          <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, marginTop: 2, background: form.ecPricingModel === m.value ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.03)", border: form.ecPricingModel === m.value ? "1px solid rgba(134,239,172,0.25)" : "1px solid rgba(255,255,255,0.10)", display: "flex", alignItems: "center", justifyContent: "center", color: form.ecPricingModel === m.value ? "#86efac" : "transparent" }}>
                            {form.ecPricingModel === m.value && <Check size={11} strokeWidth={2.5} />}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* TrafficStars: ts-campaign */}
              {currentKey === "ts-campaign" && (
                <>
                  <div style={cardStyle}>
                    <label style={labelStyle}>Format d&apos;annonce</label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      {AD_FORMATS.map(fmt => (
                        <motion.div
                          key={fmt.id}
                          onClick={() => set("adFormat", fmt.id)}
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.97 }}
                          style={{
                            padding: "20px", borderRadius: 22, cursor: "pointer", minHeight: 100,
                            display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16,
                            background: form.adFormat === fmt.id ? "rgba(114,100,168,0.10)" : "rgba(255,255,255,0.02)",
                            border: form.adFormat === fmt.id ? "1px solid rgba(114,100,168,0.30)" : "1px solid rgba(255,255,255,0.08)",
                            transition: "all 0.15s",
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 20, fontWeight: 300, letterSpacing: "-0.04em", color: form.adFormat === fmt.id ? "white" : "rgba(255,255,255,0.78)", margin: "0 0 8px" }}>{fmt.label}</p>
                            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.36)", margin: 0, lineHeight: 1.6 }}>{fmt.sub}</p>
                          </div>
                          <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, marginTop: 2, background: form.adFormat === fmt.id ? "rgba(114,100,168,0.15)" : "rgba(255,255,255,0.03)", border: form.adFormat === fmt.id ? "1px solid rgba(114,100,168,0.35)" : "1px solid rgba(255,255,255,0.10)", display: "flex", alignItems: "center", justifyContent: "center", color: form.adFormat === fmt.id ? "#c4b5fd" : "transparent", transition: "all 0.2s" }}>
                            {form.adFormat === fmt.id && <Check size={12} strokeWidth={2.5} />}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                  <div style={cardStyle}>
                    <label style={labelStyle}>Traffic type</label>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                      {TS_TRAFFIC_TYPES.map(t => (
                        <motion.div
                          key={t.value}
                          onClick={() => set("tsTrafficType", t.value)}
                          whileTap={{ scale: 0.97 }}
                          style={{
                            padding: "20px", borderRadius: 22, cursor: "pointer",
                            display: "flex", flexDirection: "column", gap: 8,
                            background: form.tsTrafficType === t.value ? "rgba(114,100,168,0.10)" : "rgba(255,255,255,0.02)",
                            border: form.tsTrafficType === t.value ? "1px solid rgba(114,100,168,0.30)" : "1px solid rgba(255,255,255,0.08)",
                            transition: "all 0.15s",
                          }}
                        >
                          <p style={{ fontSize: 20, fontWeight: 300, letterSpacing: "-0.04em", color: form.tsTrafficType === t.value ? "white" : "rgba(255,255,255,0.78)", margin: 0 }}>{t.label}</p>
                          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.36)", margin: 0 }}>{t.sub}</p>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* PropellerAds: pa-format */}
              {currentKey === "pa-format" && (
                <>
                  <div style={cardStyle}>
                    <label style={labelStyle}>Ad format</label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      {PA_DIRECTIONS.map(d => (
                        <motion.div
                          key={d.id}
                          onClick={() => set("paDirection", d.apiVal)}
                          whileTap={{ scale: 0.97 }}
                          style={{
                            padding: "20px", borderRadius: 22, cursor: "pointer",
                            display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12,
                            background: form.paDirection === d.apiVal ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.02)",
                            border: form.paDirection === d.apiVal ? "1px solid rgba(74,222,128,0.20)" : "1px solid rgba(255,255,255,0.08)",
                            transition: "all 0.15s",
                          }}
                        >
                          <div>
                            <p style={{ fontSize: 18, fontWeight: 300, letterSpacing: "-0.04em", color: form.paDirection === d.apiVal ? "white" : "rgba(255,255,255,0.78)", margin: "0 0 8px" }}>{d.label}</p>
                            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.36)", margin: 0 }}>{d.sub}</p>
                          </div>
                          <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, marginTop: 2, background: form.paDirection === d.apiVal ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.03)", border: form.paDirection === d.apiVal ? "1px solid rgba(134,239,172,0.25)" : "1px solid rgba(255,255,255,0.10)", display: "flex", alignItems: "center", justifyContent: "center", color: form.paDirection === d.apiVal ? "#86efac" : "transparent" }}>
                            {form.paDirection === d.apiVal && <Check size={11} strokeWidth={2.5} />}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                  <div style={cardStyle}>
                    <label style={labelStyle}>Pricing model</label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      {PA_RATE_MODELS_EXT.map(m => (
                        <motion.div
                          key={m.value}
                          onClick={() => set("paRateModel", m.value)}
                          whileTap={{ scale: 0.97 }}
                          style={{
                            padding: "20px", borderRadius: 22, cursor: "pointer",
                            display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12,
                            background: form.paRateModel === m.value ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.02)",
                            border: form.paRateModel === m.value ? "1px solid rgba(74,222,128,0.20)" : "1px solid rgba(255,255,255,0.08)",
                            transition: "all 0.15s",
                          }}
                        >
                          <div>
                            <p style={{ fontSize: 22, fontWeight: 300, letterSpacing: "-0.04em", color: form.paRateModel === m.value ? "white" : "rgba(255,255,255,0.78)", margin: "0 0 8px" }}>{m.label}</p>
                            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.36)", margin: 0 }}>{m.sub}</p>
                          </div>
                          <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, marginTop: 2, background: form.paRateModel === m.value ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.03)", border: form.paRateModel === m.value ? "1px solid rgba(134,239,172,0.25)" : "1px solid rgba(255,255,255,0.10)", display: "flex", alignItems: "center", justifyContent: "center", color: form.paRateModel === m.value ? "#86efac" : "transparent" }}>
                            {form.paRateModel === m.value && <Check size={11} strokeWidth={2.5} />}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Adsterra: adt-campaign */}
              {currentKey === "adt-campaign" && (
                <>
                  <div style={cardStyle}>
                    <label style={labelStyle}>Ad format</label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      {ADT_FORMATS.map(f => (
                        <motion.div
                          key={f.id}
                          onClick={() => set("adtFormat", f.id)}
                          whileTap={{ scale: 0.97 }}
                          style={{
                            padding: "20px", borderRadius: 22, cursor: "pointer",
                            display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12,
                            background: form.adtFormat === f.id ? "rgba(46,125,156,0.10)" : "rgba(255,255,255,0.02)",
                            border: form.adtFormat === f.id ? "1px solid rgba(46,125,156,0.30)" : "1px solid rgba(255,255,255,0.08)",
                            transition: "all 0.15s",
                          }}
                        >
                          <div>
                            <p style={{ fontSize: 18, fontWeight: 300, letterSpacing: "-0.04em", color: form.adtFormat === f.id ? "white" : "rgba(255,255,255,0.78)", margin: "0 0 8px" }}>{f.label}</p>
                            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.36)", margin: 0 }}>{f.sub}</p>
                          </div>
                          <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, marginTop: 2, background: form.adtFormat === f.id ? "rgba(46,125,156,0.15)" : "rgba(255,255,255,0.03)", border: form.adtFormat === f.id ? "1px solid rgba(46,125,156,0.35)" : "1px solid rgba(255,255,255,0.10)", display: "flex", alignItems: "center", justifyContent: "center", color: form.adtFormat === f.id ? "#7dd3fc" : "transparent" }}>
                            {form.adtFormat === f.id && <Check size={11} strokeWidth={2.5} />}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                  <div style={cardStyle}>
                    <label style={labelStyle}>Pricing type</label>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
                      {ADT_PRICING_TYPES.map(pt => (
                        <motion.div
                          key={pt.value}
                          onClick={() => set("adtPricingType", pt.value)}
                          whileTap={{ scale: 0.97 }}
                          style={{
                            padding: "18px", borderRadius: 22, cursor: "pointer",
                            display: "flex", flexDirection: "column", gap: 8,
                            background: form.adtPricingType === pt.value ? "rgba(46,125,156,0.10)" : "rgba(255,255,255,0.02)",
                            border: form.adtPricingType === pt.value ? "1px solid rgba(46,125,156,0.30)" : "1px solid rgba(255,255,255,0.08)",
                            transition: "all 0.15s",
                          }}
                        >
                          <p style={{ fontSize: 22, fontWeight: 300, letterSpacing: "-0.04em", color: form.adtPricingType === pt.value ? "white" : "rgba(255,255,255,0.78)", margin: 0 }}>{pt.label}</p>
                          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.36)", margin: 0 }}>{pt.sub}</p>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* ══════════════════════════════════════════════════════ GEO */}
              {currentKey === "geo" && (
                <>
                  {/* Selected count */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <p style={{ fontSize: 14, color: "rgba(255,255,255,0.36)", margin: 0 }}>
                      All countries if left empty
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      {form.countries.length > 0 && (
                        <motion.span
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          style={{ fontSize: 14, padding: "5px 14px", borderRadius: 999, background: "rgba(16,185,129,0.08)", color: "#86efac", border: "1px solid rgba(74,222,128,0.18)" }}
                        >
                          {form.countries.length} selected
                        </motion.span>
                      )}
                      {form.countries.length > 0 && (
                        <button onClick={() => set("countries", [])} style={{ fontSize: 14, color: "rgba(255,255,255,0.36)", background: "none", border: "none", cursor: "pointer" }}>
                          Clear all
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Search */}
                  <div style={cardStyle}>
                    <input
                      value={countrySearch}
                      onChange={e => setCountrySearch(e.target.value)}
                      placeholder="Rechercher un pays…"
                      style={inputStyle}
                      onFocus={focusGreen} onBlur={blurReset}
                    />
                  </div>

                  {/* Tier groups or search results */}
                  {filteredCountries ? (
                    <div style={cardStyle}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {filteredCountries.map(c => {
                          const on = form.countries.includes(c.code);
                          return (
                            <CountryRow key={c.code} c={c} on={on}
                              onClick={() => set("countries", toggleArr(form.countries, c.code))} />
                          );
                        })}
                        {filteredCountries.length === 0 && (
                          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "16px 0" }}>No results</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      {[
                        { label: "Tier 1", sub: "Premium — US, CA, AU, JP…", countries: TIER1, color: "#fcd34d", rgb: "245,158,11" },
                        { label: "Tier 2", sub: "Mid-market — ES, IT, KR, IL…", countries: TIER2, color: "#c4b5fd", rgb: "139,92,246" },
                        { label: "Tier 3", sub: "Volume — BR, IN, ID, NG…", countries: TIER3, color: "rgba(255,255,255,0.55)", rgb: "82,82,91" },
                      ].map(tier => {
                        const allOn = tier.countries.every(c => form.countries.includes(c.code));
                        return (
                          <div key={tier.label} style={cardStyle}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                              <div>
                                <div style={{ fontSize: 16, color: tier.color }}>{tier.label}</div>
                                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.30)", marginTop: 4 }}>{tier.sub}</div>
                              </div>
                              <button
                                onClick={() => toggleTier(tier.countries)}
                                style={{
                                  fontSize: 14, padding: "7px 16px", borderRadius: 999, cursor: "pointer",
                                  background: "rgba(255,255,255,0.03)",
                                  border: "1px solid rgba(255,255,255,0.08)",
                                  color: "rgba(255,255,255,0.44)",
                                }}
                              >
                                {allOn ? "Deselect all" : "Select all"}
                              </button>
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                              {tier.countries.map(c => {
                                const on = form.countries.includes(c.code);
                                return (
                                  <motion.button
                                    key={c.code}
                                    onClick={() => set("countries", toggleArr(form.countries, c.code))}
                                    whileTap={{ scale: 0.95 }}
                                    style={{
                                      padding: "7px 14px", borderRadius: 10, fontSize: 14,
                                      background: on ? `rgba(${tier.rgb},0.10)` : "rgba(255,255,255,0.03)",
                                      border: on ? `1px solid rgba(${tier.rgb},0.25)` : "1px solid rgba(255,255,255,0.08)",
                                      color: on ? tier.color : "rgba(255,255,255,0.42)",
                                      cursor: "pointer", transition: "all 0.12s",
                                    }}
                                  >
                                    {c.code}
                                  </motion.button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </>
              )}

              {/* ══════════════════════════════════════════════════════ DEVICES */}
              {currentKey === "devices" && (
                <>
                  {/* Devices */}
                  <div style={cardStyle}>
                    <label style={labelStyle}>Devices</label>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
                      {DEVICES.map(({ id, label, icon: Icon }) => {
                        const on = form.devices.includes(id);
                        return (
                          <motion.div
                            key={id}
                            onClick={() => set("devices", toggleArr(form.devices, id))}
                            whileTap={{ scale: 0.96 }}
                            style={{
                              borderRadius: 22, cursor: "pointer",
                              padding: "28px 10px", textAlign: "center",
                              background: on ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.02)",
                              border: on ? "1px solid rgba(74,222,128,0.20)" : "1px solid rgba(255,255,255,0.08)",
                              transition: "all 0.15s",
                            }}
                          >
                            <Icon size={28} strokeWidth={1.2} style={{ color: on ? "#86efac" : "rgba(255,255,255,0.3)", margin: "0 auto 14px", display: "block" }} />
                            <div style={{ fontSize: 20, fontWeight: 300, letterSpacing: "-0.04em", color: on ? "white" : "rgba(255,255,255,0.7)" }}>{label}</div>
                            <div style={{ marginTop: 8, fontSize: 13, color: on ? "rgba(134,239,172,0.7)" : "rgba(255,255,255,0.28)" }}>
                              {on ? "Selected" : "—"}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>

                  {/* OS */}
                  <div style={cardStyle}>
                    <label style={labelStyle}>Operating systems</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                      {OS_OPTIONS.map(({ id, label, icon }) => {
                        const on = form.os.includes(id);
                        return (
                          <motion.button
                            key={id}
                            onClick={() => set("os", toggleArr(form.os, id))}
                            whileTap={{ scale: 0.95 }}
                            style={{
                              padding: "10px 16px", borderRadius: 10, fontSize: 14,
                              display: "flex", alignItems: "center", gap: 7,
                              background: on ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.03)",
                              border: on ? "1px solid rgba(74,222,128,0.20)" : "1px solid rgba(255,255,255,0.08)",
                              color: on ? "white" : "rgba(255,255,255,0.44)",
                              cursor: "pointer", transition: "all 0.12s",
                            }}
                          >
                            <span>{icon}</span>
                            {label}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Advanced targeting (collapsible) */}
                  <div style={{ ...cardStyle, padding: "14px 18px" }}>
                    <button
                      onClick={() => setShowAdvanced(p => !p)}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                        background: "none", border: "none", cursor: "pointer", padding: 0,
                      }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 300, letterSpacing: "0.08em", textTransform: "uppercase", color: "#3F3F46" }}>
                        Advanced targeting
                      </span>
                      {showAdvanced ? <ChevronUp size={13} strokeWidth={1.4} color="#3F3F46" /> : <ChevronDown size={13} strokeWidth={1.4} color="#3F3F46" />}
                    </button>
                    <AnimatePresence>
                      {showAdvanced && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          style={{ overflow: "hidden" }}
                        >
                          <div style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                            <Field label="Browser — optional">
                              <input
                                placeholder="Ex : Chrome, Firefox, Safari…"
                                style={inputStyle}
                                onFocus={focusGreen} onBlur={blurReset}
                              />
                              <p style={{ fontSize: 10, color: "#3F3F46", marginTop: 5 }}>Comma-separated · all browsers if empty</p>
                            </Field>
                            <Field label="Language — optional">
                              <input
                                placeholder="Ex : en, fr, de…"
                                style={inputStyle}
                                onFocus={focusGreen} onBlur={blurReset}
                              />
                            </Field>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </>
              )}

              {/* ══════════════════════════════════════════════════════ SCHEDULE */}
              {(currentKey === "schedule" || currentKey === "ts-schedule") && <StepHoraires form={form} set={set} />}

              {/* ══════════════════════════════════════════════════════ BUDGET */}
              {currentKey === "budget" && (
                <>
                  {/* Bid type — TrafficStars only (EC uses ecPricingModel from ec-format step; PA/ADT set in their format steps) */}
                  {form.network === "TRAFFICSTARS" && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      {[
                        { value: "cpm", label: "CPM", sub: "Cost per 1000 impressions" },
                        { value: "cpc", label: "CPC", sub: "Cost per click" },
                      ].map(bt => (
                        <motion.div
                          key={bt.value}
                          onClick={() => set("bidType", bt.value as "cpm" | "cpc")}
                          whileTap={{ scale: 0.97 }}
                          style={{
                            padding: "24px", borderRadius: 24, cursor: "pointer", minHeight: 110,
                            background: form.bidType === bt.value ? "rgba(114,100,168,0.10)" : "rgba(255,255,255,0.02)",
                            border: form.bidType === bt.value ? "1px solid rgba(114,100,168,0.30)" : "1px solid rgba(255,255,255,0.08)",
                            transition: "all 0.15s",
                          }}
                        >
                          <div style={{ fontSize: 26, fontWeight: 300, letterSpacing: "-0.04em", color: form.bidType === bt.value ? "white" : "rgba(255,255,255,0.78)" }}>{bt.label}</div>
                          <div style={{ marginTop: 10, color: "rgba(255,255,255,0.36)", fontSize: 14 }}>{bt.sub}</div>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {/* For EC/PA/ADT: show the pricing model selected in their format step */}
                  {(form.network === "EXOCLICK" || isPA || isADT) && (
                    <div style={{
                      padding: "14px 18px", borderRadius: 16,
                      background: "rgba(16,185,129,0.06)", border: "1px solid rgba(74,222,128,0.15)",
                      display: "flex", alignItems: "center", gap: 10,
                    }}>
                      <span style={{ fontSize: 18 }}>✓</span>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#86efac" }}>
                          {form.network === "EXOCLICK"
                            ? `ExoClick · ${EC_PRICING_MODELS.find(m => m.value === form.ecPricingModel)?.label ?? form.ecPricingModel.toUpperCase()}`
                            : isPA
                            ? `PropellerAds · ${form.paRateModel.toUpperCase()}`
                            : `Adsterra · ${form.adtPricingType}`}
                        </span>
                        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginLeft: 8 }}>
                          set in format step — go back to change
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Bid amount + Budgets + Freq cap — all in one card like vision */}
                  <div style={cardStyle}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                      {/* Bid value */}
                      <div>
                        <label style={labelStyle}>Bid value</label>
                        <div style={{ position: "relative" }}>
                          <span style={{ position: "absolute", left: 20, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.5)", fontSize: 16, pointerEvents: "none" }}>€</span>
                          <input
                            type="number" min="0.001" step="0.001"
                            value={form.bid}
                            onChange={e => set("bid", e.target.value)}
                            placeholder={form.bidType === "cpm" ? "0.50" : "0.05"}
                            style={{ ...inputStyle, paddingLeft: 40 }}
                            onFocus={focusGreen} onBlur={blurReset}
                          />
                        </div>
                      </div>
                      {/* Budgets */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <div>
                          <label style={labelStyle}>
                            Daily budget{isPA ? (form.paRateModel === "cpa" ? " · min $5" : " · min $10") : ""}
                          </label>
                          <div style={{ position: "relative" }}>
                            <span style={{ position: "absolute", left: 20, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.5)", fontSize: 16, pointerEvents: "none" }}>€</span>
                            <input
                              type="number" min="0" step="0.01"
                              value={form.dailyBudget}
                              onChange={e => set("dailyBudget", e.target.value)}
                              placeholder="50"
                              style={{ ...inputStyle, paddingLeft: 40 }}
                              onFocus={focusGreen} onBlur={blurReset}
                            />
                          </div>
                        </div>
                        <div>
                          <label style={labelStyle}>Total budget · optional</label>
                          <div style={{ position: "relative" }}>
                            <span style={{ position: "absolute", left: 20, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.28)", fontSize: 16, pointerEvents: "none" }}>€</span>
                            <input
                              type="number" min="0" step="0.01"
                              value={form.totalBudget}
                              onChange={e => set("totalBudget", e.target.value)}
                              placeholder="Unlimited"
                              style={{ ...inputStyle, paddingLeft: 40 }}
                              onFocus={focusGreen} onBlur={blurReset}
                            />
                          </div>
                        </div>
                      </div>
                      {/* Frequency cap */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <div>
                          <label style={labelStyle}>Frequency cap</label>
                          <input
                            type="number" min="1" step="1"
                            value={form.freqCapImps}
                            onChange={e => set("freqCapImps", e.target.value)}
                            placeholder="3 impressions"
                            style={inputStyle}
                            onFocus={focusGreen} onBlur={blurReset}
                          />
                        </div>
                        <div>
                          <label style={labelStyle}>Per period</label>
                          <select
                            value={form.freqCapHrs}
                            onChange={e => set("freqCapHrs", e.target.value)}
                            style={{ ...inputStyle, appearance: "none" }}
                            onFocus={focusGreen} onBlur={blurReset}
                          >
                            {FREQ_CAP_PERIODS.map(p => (
                              <option key={p.value} value={p.value}>{p.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CPM warning — shown when bid is set AND some selected publishers require more */}
                  {(() => {
                    if (form.bidType !== "cpm" || !form.bid) return null;
                    const currentBid = parseFloat(form.bid) || 0;
                    if (currentBid <= 0) return null;
                    const allSites = PUBLISHER_SITES_BY_NETWORK[form.network] ?? [];
                    // Warn on selected sites that are too expensive
                    const selectedTooLow = allSites.filter(s => form.publisherSites.includes(s.id) && currentBid < s.minCpm);
                    // Also warn on high-traffic unselected sites as a heads-up
                    const notableTooLow = allSites.filter(s => !form.publisherSites.includes(s.id) && s.minCpm > currentBid && s.minCpm >= 1.00);
                    if (selectedTooLow.length === 0 && notableTooLow.length === 0) return null;
                    return (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                        style={{
                          padding: "14px 16px", borderRadius: 14,
                          background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.18)",
                          display: "flex", flexDirection: "column", gap: 10,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                          <AlertTriangle size={14} strokeWidth={1.4} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
                          <div>
                            <p style={{ fontSize: 12, fontWeight: 600, color: "#f87171", margin: "0 0 2px" }}>
                              CPM trop bas pour certains publishers
                            </p>
                            <p style={{ fontSize: 11, color: "rgba(248,113,113,0.65)", margin: 0 }}>
                              Your bid of €{parseFloat(form.bid).toFixed(2)} CPM is below the minimum required.
                            </p>
                          </div>
                        </div>
                        {selectedTooLow.length > 0 && (
                          <div>
                            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(248,113,113,0.5)", margin: "0 0 6px" }}>
                              Selected publishers blocked
                            </p>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                              {selectedTooLow.map(s => (
                                <span key={s.id} style={{
                                  fontSize: 11, padding: "3px 9px", borderRadius: 99,
                                  background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)",
                                  color: "#f87171",
                                }}>
                                  {s.label} — min. €{s.minCpm.toFixed(2)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {notableTooLow.length > 0 && selectedTooLow.length === 0 && (
                          <div>
                            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(248,113,113,0.4)", margin: "0 0 6px" }}>
                              Sites premium inaccessibles
                            </p>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                              {notableTooLow.slice(0, 4).map(s => (
                                <span key={s.id} style={{
                                  fontSize: 11, padding: "3px 9px", borderRadius: 99,
                                  background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.12)",
                                  color: "rgba(248,113,113,0.6)",
                                }}>
                                  {s.label} — min. €{s.minCpm.toFixed(2)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  })()}

                  {/* Launch status — vision tall cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    {[
                      { v: true,  label: "Launch active", sub: "Traffic starts immediately" },
                      { v: false, label: "Launch paused", sub: "Activate manually later"    },
                    ].map(({ v, label, sub }) => (
                      <motion.div
                        key={label}
                        onClick={() => set("active", v)}
                        whileTap={{ scale: 0.97 }}
                        style={{
                          padding: "24px", borderRadius: 24, cursor: "pointer", minHeight: 120,
                          background: form.active === v ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.02)",
                          border: form.active === v ? "1px solid rgba(74,222,128,0.20)" : "1px solid rgba(255,255,255,0.08)",
                          transition: "all 0.15s",
                        }}
                      >
                        <div style={{ fontSize: 24, fontWeight: 300, letterSpacing: "-0.04em", color: form.active === v ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.78)" }}>{label}</div>
                        <div style={{ marginTop: 12, color: "rgba(255,255,255,0.34)", fontSize: 14 }}>{sub}</div>
                      </motion.div>
                    ))}
                  </div>
                </>
              )}

              {/* ══════════════════════════════════════════════════════ PUBLISHERS */}
              {currentKey === "publishers" && <StepEditeurs form={form} set={set} toggleArr={toggleArr} />}

              {/* ══════════════════════════════════════════════════════ RULES */}
              {currentKey === "rules" && <StepDecisionRules form={form} set={set} />}

              {/* ══════════════════════════════════════════════════════ CREATIVE */}
              {currentKey === "creative" && (
                <>
                  {/* Image upload */}
                  <div style={cardStyle}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <label style={{ ...labelStyle, marginBottom: 0 }}>Creative — optional</label>
                      {/* Vault button */}
                      <button
                        type="button"
                        onClick={() => setVaultOpen(true)}
                        style={{
                          display: "flex", alignItems: "center", gap: 5,
                          padding: "5px 12px", borderRadius: 8, fontSize: 11, cursor: "pointer",
                          background: "rgba(14,165,233,0.08)", border: "1px solid rgba(14,165,233,0.2)",
                          color: "#38bdf8", fontWeight: 500,
                        }}>
                        <Library size={11} />
                        Vault
                      </button>
                    </div>

                    {form.imagePreview ? (
                      <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={form.imagePreview} alt="preview" style={{ width: "100%", height: 180, objectFit: "cover", display: "block" }} />
                        <button
                          onClick={() => setForm(p => ({ ...p, imageFile: null, imagePreview: null, vaultAssetName: null }))}
                          style={{
                            position: "absolute", top: 8, right: 8,
                            width: 28, height: 28, borderRadius: 8,
                            background: "rgba(0,0,0,0.7)", border: "none", cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}
                        >
                          <X size={13} color="#fff" strokeWidth={1.4} />
                        </button>
                        <div style={{ padding: "10px 12px", background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", gap: 6 }}>
                          {form.vaultAssetName && (
                            <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "rgba(14,165,233,0.2)", color: "#38bdf8", fontWeight: 600 }}>
                              VAULT
                            </span>
                          )}
                          <p style={{ fontSize: 11, color: "#52525B", margin: 0 }}>
                            {form.vaultAssetName ?? form.imageFile?.name ?? "Image selected"}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div
                        ref={dropRef}
                        onDragOver={e => e.preventDefault()}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          border: "1.5px dashed rgba(255,255,255,0.1)", borderRadius: 14,
                          padding: "32px 20px", textAlign: "center", cursor: "pointer",
                          background: "rgba(255,255,255,0.02)",
                          transition: "all 0.15s",
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(107,158,130,0.2)"; (e.currentTarget as HTMLElement).style.background = "rgba(107,158,130,0.03)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.1)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"; }}
                      >
                        <Upload size={22} strokeWidth={1.3} color="#3F3F46" style={{ margin: "0 auto 10px" }} />
                        <p style={{ fontSize: 13, color: "#52525B", margin: 0 }}>Glisse ton image ici</p>
                        <p style={{ fontSize: 11, color: "#3F3F46", marginTop: 4 }}>ou clique pour parcourir · PNG, JPG, GIF</p>
                        <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleFileInput} style={{ display: "none" }} />
                      </div>
                    )}
                  </div>

                  {/* Summary */}
                  <div style={{ ...cardStyle, background: "rgba(107,158,130,0.03)", border: "1px solid rgba(107,158,130,0.08)" }}>
                    <p style={{ fontSize: 10, fontWeight: 300, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6b9e82", marginBottom: 14 }}>
                      Summary
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {[
                        ["Network",   NETWORKS.find(n => n.id === form.network)?.label ?? "—"],
                        ["Name",     form.name || "—"],
                        ["URL",      form.url  || "—"],
                        ["Format",   AD_FORMATS.find(f => f.id === form.adFormat)?.label ?? "—"],
                        ["Countries", form.countries.length > 0 ? form.countries.slice(0, 5).join(", ") + (form.countries.length > 5 ? ` +${form.countries.length - 5}` : "") : "All"],
                        ["Devices",  form.devices.length > 0 ? form.devices.join(", ") : "—"],
                        ["OS",       form.os.length > 0 ? form.os.join(", ") : "—"],
                        ["Bid",  form.bid ? `€${form.bid} ${form.bidType.toUpperCase()}` : "—"],
                        ["Budget/j", form.dailyBudget ? `$${form.dailyBudget}` : "—"],
                        ["Freq cap", form.freqCapImps ? `${form.freqCapImps}× / ${FREQ_CAP_PERIODS.find(p => p.value === form.freqCapHrs)?.label}` : "None"],
                        ["Status",   form.active ? "🟢 Active" : "⏸ Paused"],
                      ].map(([k, v]) => (
                        <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, gap: 12 }}>
                          <span style={{ color: "#3F3F46", flexShrink: 0 }}>{k}</span>
                          <span style={{ color: "#E4E4E7", fontWeight: 500, textAlign: "right", wordBreak: "break-all" }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

            </motion.div>
          </AnimatePresence>
          </div>

          {/* ── Footer navigation ── */}
          <div style={{
            padding: "20px 36px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(255,255,255,0.02)",
          }}>
            {/* Back */}
            {step > 0 ? (
              <motion.button
                whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
                onClick={goBack}
                style={{
                  padding: "10px 20px", borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)",
                  color: "rgba(255,255,255,0.45)", fontSize: 14, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                ← Back
              </motion.button>
            ) : <div />}

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* Error inline */}
              <AnimatePresence>
                {error && (
                  <motion.span
                    initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                    style={{ fontSize: 13, color: "#f87171" }}
                  >
                    {error}
                  </motion.span>
                )}
              </AnimatePresence>

              {/* Continue / Preview */}
              {step < activeSteps.length - 1 ? (
                <motion.button
                  whileHover={stepValid[step] ? { scale: 1.013, boxShadow: "0 18px 44px rgba(139,92,246,0.48)" } : {}}
                  whileTap={stepValid[step] ? { scale: 0.97 } : {}}
                  onClick={goNext}
                  disabled={!stepValid[step]}
                  style={{
                    padding: "11px 28px", borderRadius: 16, fontSize: 14, fontWeight: 600,
                    border: "none", cursor: stepValid[step] ? "pointer" : "not-allowed",
                    background: stepValid[step] ? "#ffffff" : "rgba(255,255,255,0.06)",
                    color: stepValid[step] ? "#000000" : "rgba(255,255,255,0.22)",
                    transition: "background 0.18s, color 0.18s",
                  }}
                >
                  Continue →
                </motion.button>
              ) : (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setShowPreview(true)}
                  disabled={submitting}
                  style={{
                    padding: "11px 28px", borderRadius: 16, fontSize: 14, fontWeight: 600,
                    border: "none", cursor: "pointer",
                    background: "#ffffff",
                    color: "#000000",
                    display: "flex", alignItems: "center", gap: 7,
                  }}
                >
                  <Film size={13} strokeWidth={1.4} />
                  Voir la preview →
                </motion.button>
              )}
            </div>
          </div>

        </div>{/* end main-card */}
      </main>

      </div>{/* end grid */}

      {/* ── Vault Picker Modal ── */}
      <AnimatePresence>
        {vaultOpen && (
          <VaultPickerModal
            onSelect={(asset) => {
              const mtype = asset.type === "video" ? "video" : "image";
              setForm(p => ({ ...p, imagePreview: asset.url || null, imageFile: null, mediaType: mtype, vaultAssetName: asset.name }));
              setVaultOpen(false);
            }}
            onClose={() => setVaultOpen(false)}
          />
        )}
      </AnimatePresence>

    </div>
  );
}

// ─── Step 3 — Horaires ───────────────────────────────────────────────────────

function StepHoraires({ form, set }: { form: FormState; set: <K extends keyof FormState>(k: K, v: FormState[K]) => void }) {
  const [customOpen, setCustomOpen] = useState(false);

  function togglePreset(hours: number[]) {
    const allOn = hours.every(h => form.timeSlots.includes(h));
    if (allOn) {
      set("timeSlots", form.timeSlots.filter(h => !hours.includes(h)));
    } else {
      set("timeSlots", [...new Set([...form.timeSlots, ...hours])]);
    }
  }

  function toggleHour(h: number) {
    set("timeSlots", form.timeSlots.includes(h)
      ? form.timeSlots.filter(x => x !== h)
      : [...form.timeSlots, h].sort((a, b) => a - b));
  }

  const activeCount = form.timeSlots.length;

  return (
    <>
      {/* Info */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
        <p style={{ fontSize: 13, color: "#52525B", margin: 0 }}>
          Leave empty to serve 24/7
        </p>
        {activeCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <motion.span
              initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              style={{ fontSize: 11, padding: "3px 10px", borderRadius: 99, background: "rgba(107,158,130,0.08)", color: "#6b9e82", border: "1px solid rgba(107,158,130,0.18)", fontWeight: 600 }}
            >
              {activeCount}h active
            </motion.span>
            <button onClick={() => set("timeSlots", [])} style={{ fontSize: 11, color: "#3F3F46", background: "none", border: "none", cursor: "pointer" }}>
              Reset
            </button>
          </div>
        )}
      </div>

      {/* Preset cards — vision style */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {TIME_PRESETS.map(preset => {
          const allOn = preset.hours.every(h => form.timeSlots.includes(h));
          const someOn = preset.hours.some(h => form.timeSlots.includes(h));
          return (
            <motion.div
              key={preset.id}
              onClick={() => togglePreset(preset.hours)}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.97 }}
              style={{
                padding: "24px", borderRadius: 24, cursor: "pointer", minHeight: 130,
                background: allOn ? "rgba(16,185,129,0.08)" : someOn ? "rgba(16,185,129,0.04)" : "rgba(255,255,255,0.02)",
                border: allOn ? "1px solid rgba(74,222,128,0.20)" : someOn ? "1px solid rgba(74,222,128,0.10)" : "1px solid rgba(255,255,255,0.08)",
                transition: "all 0.15s", position: "relative",
                display: "flex", flexDirection: "column", justifyContent: "space-between",
              }}
            >
              {preset.recommended && (
                <span style={{
                  position: "absolute", top: 16, right: 16,
                  fontSize: 9, fontWeight: 600, padding: "3px 10px", borderRadius: 999,
                  background: "rgba(245,158,11,0.10)", color: "#fde68a",
                  border: "1px solid rgba(251,191,36,0.20)", letterSpacing: "0.20em",
                  textTransform: "uppercase",
                }}>
                  Recommended
                </span>
              )}
              <div>
                <div style={{ fontSize: 24, fontWeight: 300, letterSpacing: "-0.04em", color: allOn ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.78)" }}>
                  {preset.label}
                </div>
                <div style={{ marginTop: 12, color: "rgba(255,255,255,0.34)", fontSize: 15, lineHeight: 1.5 }}>{preset.sub}</div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Custom toggle */}
      <div style={{ ...cardStyle } as React.CSSProperties}>
        <button
          onClick={() => setCustomOpen(p => !p)}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "none", border: "none", cursor: "pointer", padding: 0,
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 300, letterSpacing: "-0.03em", color: "rgba(255,255,255,0.78)" }}>
              Customize hour by hour
            </div>
            <div style={{ marginTop: 8, fontSize: 14, color: "rgba(255,255,255,0.34)" }}>
              Open the full grid for finer control.
            </div>
          </div>
          {customOpen ? <ChevronUp size={16} strokeWidth={1.4} color="rgba(255,255,255,0.30)" /> : <ChevronDown size={16} strokeWidth={1.4} color="rgba(255,255,255,0.30)" />}
        </button>
        <AnimatePresence>
          {customOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: "hidden" }}
            >
              <div style={{ paddingTop: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 5 }}>
                  {Array.from({ length: 24 }, (_, h) => {
                    const on = form.timeSlots.includes(h);
                    return (
                      <motion.button
                        key={h}
                        onClick={() => toggleHour(h)}
                        whileTap={{ scale: 0.92 }}
                        style={{
                          padding: "7px 4px", borderRadius: 8, fontSize: 11,
                          fontWeight: on ? 600 : 400, cursor: "pointer",
                          background: on ? "rgba(107,158,130,0.12)" : "rgba(255,255,255,0.03)",
                          border: on ? "1px solid rgba(107,158,130,0.25)" : "1px solid rgba(255,255,255,0.06)",
                          color: on ? "#6b9e82" : "#52525B",
                          transition: "all 0.1s",
                        }}
                      >
                        {String(h).padStart(2, "0")}h
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

// ─── Step 6 — Decision Rules ──────────────────────────────────────────────────

function StepDecisionRules({
  form, set,
}: {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}) {
  // Helper: numeric input clamped to int
  function numInput(
    label: string,
    field: keyof FormState,
    unit: string,
    min: number,
    max: number,
    step: number,
    hint?: string
  ) {
    const val = form[field] as number;
    return (
      <div>
        <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#3f3f46", margin: "0 0 6px" }}>
          {label}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={val}
            onChange={e => set(field, Number(e.target.value) as FormState[typeof field])}
            style={{
              width: 80, padding: "9px 12px", borderRadius: 10, fontSize: 14,
              fontWeight: 300, letterSpacing: "-0.02em",
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.9)", outline: "none",
              colorScheme: "dark", textAlign: "right" as const,
            }}
            onFocus={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
          />
          <span style={{ fontSize: 11, color: "#52525b" }}>{unit}</span>
        </div>
        {hint && <p style={{ fontSize: 10, color: "#3f3f46", margin: "4px 0 0" }}>{hint}</p>}
      </div>
    );
  }

  return (
    <>
      {/* Engine toggle */}
      <div style={{
        ...({ ...cardStyle, padding: "22px 24px" } as React.CSSProperties),
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: form.engineActive ? "rgba(139,92,246,0.12)" : "rgba(255,255,255,0.04)",
              border: form.engineActive ? "1px solid rgba(139,92,246,0.3)" : "1px solid rgba(255,255,255,0.07)",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.2s",
            }}>
              <Activity size={16} strokeWidth={1.4} color={form.engineActive ? "#8b5cf6" : "#52525b"} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 400, color: form.engineActive ? "rgba(255,255,255,0.9)" : "#52525b", margin: 0, transition: "color 0.2s" }}>
                Decision engine
              </p>
              <p style={{ fontSize: 11, color: "#3f3f46", margin: "2px 0 0" }}>
                Kill, Watch, Scale automatique
              </p>
            </div>
          </div>
          <motion.button
            onClick={() => set("engineActive", !form.engineActive)}
            whileTap={{ scale: 0.93 }}
            style={{
              width: 44, height: 24, borderRadius: 12, cursor: "pointer",
              background: form.engineActive ? "rgba(139,92,246,0.25)" : "rgba(255,255,255,0.06)",
              border: form.engineActive ? "1px solid rgba(139,92,246,0.4)" : "1px solid rgba(255,255,255,0.1)",
              position: "relative", transition: "all 0.2s", flexShrink: 0,
            }}
          >
            <motion.div
              animate={{ x: form.engineActive ? 20 : 2 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              style={{
                position: "absolute", top: 2,
                width: 18, height: 18, borderRadius: "50%",
                background: form.engineActive ? "#8b5cf6" : "rgba(255,255,255,0.25)",
                transition: "background 0.2s",
              }}
            />
          </motion.button>
        </div>

        {!form.engineActive && (
          <p style={{ fontSize: 11, color: "#3f3f46", marginTop: 14, lineHeight: 1.5 }}>
            Enable the engine for ProfitDash to take automated decisions (kill/watch/scale) based on the thresholds you define below.
          </p>
        )}
      </div>

      {/* Kill rule — vision colored card */}
      <div style={{ borderRadius: 26, border: "1px solid rgba(251,113,133,0.18)", background: "rgba(244,63,94,0.08)", padding: "24px" }}>
        <div style={{ fontSize: 11, textTransform: "uppercase" as const, letterSpacing: "0.24em", color: "rgba(253,164,175,0.8)" }}>Kill</div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, marginTop: 16 }}>
          <div>
            <div style={{ fontSize: 42, fontWeight: 300, letterSpacing: "-0.05em", color: "#fda4af", fontVariantNumeric: "tabular-nums" }}>
              {form.killThreshold}%
            </div>
            <div style={{ marginTop: 12, color: "rgba(255,255,255,0.36)", fontSize: 14, lineHeight: 1.6 }}>
              Pause or kill if ROI drops below this threshold
            </div>
          </div>
          {numInput("Kill threshold (%)", "killThreshold", "%", -100, 0, 1)}
        </div>
      </div>

      {/* Watch rule — vision colored card */}
      <div style={{ borderRadius: 26, border: "1px solid rgba(251,191,36,0.18)", background: "rgba(245,158,11,0.08)", padding: "24px" }}>
        <div style={{ fontSize: 11, textTransform: "uppercase" as const, letterSpacing: "0.24em", color: "rgba(253,230,138,0.8)" }}>Watch</div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, marginTop: 16 }}>
          <div>
            <div style={{ fontSize: 42, fontWeight: 300, letterSpacing: "-0.05em", color: "#fde68a", fontVariantNumeric: "tabular-nums" }}>
              {form.watchMinRoi}% → {form.watchMaxRoi}%
            </div>
            <div style={{ marginTop: 12, color: "rgba(255,255,255,0.36)", fontSize: 14, lineHeight: 1.6 }}>
              Watch without acting — data collection in this range
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 20 }}>
          {numInput("ROI min (%)", "watchMinRoi", "%", -100, 100, 1)}
          {numInput("ROI max (%)", "watchMaxRoi", "%", -100, 300, 1)}
        </div>
        <div style={{ marginTop: 16, height: 3, borderRadius: 99, background: "rgba(255,255,255,0.05)", overflow: "hidden", position: "relative" }}>
          <div style={{
            position: "absolute", top: 0, height: "100%",
            left: `${Math.max(0, (form.watchMinRoi + 100) / 4)}%`,
            right: `${Math.max(0, (300 - form.watchMaxRoi) / 4)}%`,
            background: "linear-gradient(90deg, rgba(251,191,36,0.3), rgba(251,191,36,0.6))",
            borderRadius: 99, minWidth: 4,
          }} />
        </div>
      </div>

      {/* Scale rule — vision colored card */}
      <div style={{ borderRadius: 26, border: "1px solid rgba(74,222,128,0.18)", background: "rgba(16,185,129,0.08)", padding: "24px" }}>
        <div style={{ fontSize: 11, textTransform: "uppercase" as const, letterSpacing: "0.24em", color: "rgba(134,239,172,0.8)" }}>Scale</div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, marginTop: 16 }}>
          <div>
            <div style={{ fontSize: 42, fontWeight: 300, letterSpacing: "-0.05em", color: "#86efac", fontVariantNumeric: "tabular-nums" }}>
              +{form.scaleBy}% budget
            </div>
            <div style={{ marginTop: 12, color: "rgba(255,255,255,0.36)", fontSize: 14, lineHeight: 1.6 }}>
              Increase budget when ROI ≥ {form.scaleThreshold}%
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginTop: 20 }}>
          {numInput("Scale threshold (%)", "scaleThreshold", "%", 0, 500, 5, "Min ROI to scale")}
          {numInput("Increase by", "scaleBy", "%", 5, 200, 5, "Budget increase")}
          {numInput("Max budget/day (€)", "maxScalingBudget", "€", 10, 10000, 10, "Scaling cap")}
        </div>
      </div>

      {/* Safety conditions */}
      <div style={{ ...cardStyle, padding: "24px" } as React.CSSProperties}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
          <Shield size={14} strokeWidth={1.4} color="#a78bfa" />
          <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#a78bfa", margin: 0 }}>
            Safety conditions
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {numInput("Min spend before action", "minSpendBeforeAction", "€", 1, 500, 1, "Do not act below this threshold")}
          {numInput("Cooldown", "cooldownMins", "min", 15, 1440, 15, "Cooldown between actions")}
          {numInput("Max actions/day", "maxActionsPerDay", "actions", 1, 50, 1, "Daily limit")}
          {numInput("Scan every", "scanFreqMins", "min", 15, 1440, 15, "Check frequency")}
        </div>
      </div>
    </>
  );
}

// ─── Step 5 — Publishers ────────────────────────────────────────────────────────

function StepEditeurs({
  form, set, toggleArr,
}: {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  toggleArr: <T>(arr: T[], val: T) => T[];
}) {
  const [search, setSearch]       = useState("");
  const [apiSites, setApiSites]   = useState<PublisherSite[] | null>(null);
  const [loading, setLoading]     = useState(false);
  const [apiError, setApiError]   = useState<string | null>(null);

  // Fetch real ExoClick sites on mount (only for ExoClick network)
  useEffect(() => {
    if (form.network !== "EXOCLICK") return;
    setLoading(true);
    setApiError(null);
    fetch("/api/exoclick/sites")
      .then(async res => {
        const data = await res.json() as {
          sites?: Array<{ id: number; domain: string; name: string; cat: string; traffic: string; color: string; rgb: string; minCpm: number }>;
          error?: string;
        };
        if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
        if (data.sites && data.sites.length > 0) {
          // Map API response to our PublisherSite shape
          const mapped: PublisherSite[] = data.sites.map(s => ({
            id:       String(s.id),
            label:    s.name || s.domain,
            cat:      s.cat,
            traffic:  s.traffic,
            color:    s.color,
            rgb:      s.rgb,
            minCpm:   s.minCpm,
          }));
          setApiSites(mapped);
        }
      })
      .catch(err => {
        console.warn("[StepEditeurs] API fetch failed, using fallback data:", err);
        setApiError("Real-time data unavailable — showing reference data.");
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.network]);

  const selected = form.publisherSites;
  // Use real API data if available, otherwise fall back to hardcoded list
  const allSites = apiSites ?? (PUBLISHER_SITES_BY_NETWORK[form.network] ?? EXOCLICK_SITES);
  const currentBid = parseFloat(form.bid) || 0;

  const q = search.toLowerCase().trim();
  const sites = q ? allSites.filter(s => s.label.toLowerCase().includes(q) || s.cat.toLowerCase().includes(q)) : allSites;

  const allOn = sites.length > 0 && sites.every(s => selected.includes(s.id));
  const cats = q ? ["Results"] : [...new Set(allSites.map(s => s.cat))];

  return (
    <>
      {/* Search bar */}
      <div style={{ position: "relative" }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search for a site or category…"
          style={{ ...inputStyle, paddingRight: 40 }}
          onFocus={focusGreen} onBlur={blurReset}
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#52525B", padding: 0, display: "flex" }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Loading / error status */}
      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
          <motion.div
            animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(192,136,53,0.25)", borderTopColor: "#c08835" }}
          />
          <span style={{ fontSize: 12, color: "#52525B" }}>Loading ExoClick sites in real time…</span>
        </div>
      )}
      {!loading && apiSites && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#6b9e82" }} />
          <span style={{ fontSize: 11, color: "#3F3F46" }}>ExoClick live data · {apiSites.length} sites</span>
        </div>
      )}
      {!loading && apiError && (
        <p style={{ fontSize: 11, color: "#a07070", margin: 0 }}>{apiError}</p>
      )}

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ fontSize: 13, color: "#52525B", margin: 0 }}>
          {q ? `${sites.length} result${sites.length !== 1 ? "s" : ""}` : "Empty = all sites on this network"}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {selected.length > 0 && (
            <motion.span
              initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              style={{ fontSize: 11, padding: "3px 10px", borderRadius: 99, background: "rgba(107,158,130,0.08)", color: "#6b9e82", border: "1px solid rgba(107,158,130,0.18)", fontWeight: 600 }}
            >
              {selected.length} selected
            </motion.span>
          )}
          {selected.length > 0 && (
            <button onClick={() => set("publisherSites", [])} style={{ fontSize: 11, color: "#3F3F46", background: "none", border: "none", cursor: "pointer" }}>
              Clear all
            </button>
          )}
          {!allOn && sites.length > 0 && (
            <button
              onClick={() => set("publisherSites", [...new Set([...selected, ...sites.map(s => s.id)])])}
              style={{ fontSize: 11, color: "#52525B", background: "none", border: "none", cursor: "pointer" }}
            >
              Select all
            </button>
          )}
        </div>
      </div>

      {/* Categories (or flat search results) */}
      {cats.map(cat => {
        const catSites = q ? sites : sites.filter(s => s.cat === cat);
        if (catSites.length === 0) return null;
        return (
          <div key={cat} style={cardStyle as React.CSSProperties}>
            <label style={labelStyle}>{cat}</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {catSites.map(site => {
                const on = selected.includes(site.id);
                // Bid indicator: only show if a bid is already set (user may revisit step)
                const bidTooLow = currentBid > 0 && currentBid < site.minCpm;
                const bidOk     = currentBid > 0 && currentBid >= site.minCpm;
                return (
                  <motion.div
                    key={site.id}
                    onClick={() => set("publisherSites", toggleArr(selected, site.id))}
                    whileTap={{ scale: 0.985 }}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "16px 20px", borderRadius: 16, cursor: "pointer", gap: 16,
                      background: on ? "rgba(16,185,129,0.06)" : "rgba(255,255,255,0.02)",
                      border: on ? "1px solid rgba(74,222,128,0.15)" : "1px solid rgba(255,255,255,0.08)",
                      transition: "all 0.12s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{
                        width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                        background: on ? site.color : "rgba(255,255,255,0.20)",
                        transition: "background 0.15s",
                      }} />
                      <span style={{ fontSize: 18, fontWeight: 300, letterSpacing: "-0.03em", color: on ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.70)" }}>
                        {site.label}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <span style={{ fontSize: 14, color: "rgba(255,255,255,0.32)" }}>{site.traffic}</span>
                      {/* Min CPM badge */}
                      <span style={{
                        fontSize: 13, padding: "4px 12px", borderRadius: 999, fontWeight: 400,
                        background: bidTooLow ? "rgba(248,113,113,0.08)" : "rgba(255,255,255,0.03)",
                        color: bidTooLow ? "#f87171" : "rgba(255,255,255,0.32)",
                        border: bidTooLow ? "1px solid rgba(248,113,113,0.20)" : "1px solid rgba(255,255,255,0.08)",
                      }}>
                        min. €{site.minCpm.toFixed(2)}
                      </span>
                      <div style={{
                        width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                        background: on ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.03)",
                        border: on ? "1px solid rgba(74,222,128,0.30)" : "1px solid rgba(255,255,255,0.10)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.15s",
                      }}>
                        {on && <Check size={10} strokeWidth={2.5} color="#4ade80" />}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* No results */}
      {q && sites.length === 0 && (
        <div style={{ textAlign: "center", padding: "32px 0", color: "#3F3F46", fontSize: 13 }}>
          No site found for "{search}"
        </div>
      )}

      {/* CPM info note */}
      {!q && (
        <p style={{ fontSize: 11, color: "#3F3F46", margin: "4px 0 0", textAlign: "center" }}>
          Les CPM minimums sont indicatifs et peuvent varier selon le pays et le format.
        </p>
      )}
    </>
  );
}

// ─── Ad Preview Screen ────────────────────────────────────────────────────────

const FAKE_THUMBS = [
  { bg: "linear-gradient(135deg,#11141b,#191d27)", hot: true,  title: "Late night roulette strategy",    dur: "12:34"   },
  { bg: "linear-gradient(135deg,#11141b,#1c2030)", hot: false, title: "Best premium creators this week", dur: "8:42"    },
  { bg: "linear-gradient(135deg,#12141c,#191d27)", hot: true,  title: "New bonus unlock guide",          dur: "22:01"   },
  { bg: "linear-gradient(135deg,#11141b,#191d27)", hot: false, title: "Live cams worth opening now",     dur: "5:17"    },
  { bg: "linear-gradient(135deg,#12141e,#1a1e2a)", hot: false, title: "Top studios by retention",        dur: "1:04:22" },
  { bg: "linear-gradient(135deg,#11141b,#191d27)", hot: true,  title: "Private drop tonight",            dur: "18:50"   },
  { bg: "linear-gradient(135deg,#12141c,#1c2030)", hot: false, title: "Studio rankings this month",      dur: "31:12"   },
  { bg: "linear-gradient(135deg,#11141b,#191d27)", hot: false, title: "Weekly highlight reel",           dur: "9:08"    },
];

function AdPreviewScreen({ form, onBack, onLaunch, submitting, error, onUpdateMedia }: {
  form:            FormState;
  onBack:          () => void;
  onLaunch:        () => void;
  submitting:      boolean;
  error:           string | null;
  onUpdateMedia:   (preview: string | null, file: File | null, mediaType: "image" | "video" | null, name: string | null) => void;
}) {
  const [adVisible,        setAdVisible]        = useState(false);
  const [countdown,        setCountdown]        = useState(5);
  const [interDismissed,   setInterDismissed]   = useState(false);
  const [thumbHovered,     setThumbHovered]     = useState(false);
  const [previewVaultOpen, setPreviewVaultOpen] = useState(false);
  const [mediaMenuOpen,    setMediaMenuOpen]    = useState(false);
  const previewFileRef = useRef<HTMLInputElement>(null);

  function handlePreviewFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const url  = URL.createObjectURL(file);
      const mt   = file.type.startsWith("video/") ? "video" : "image";
      onUpdateMedia(url, file, mt, null);
      setMediaMenuOpen(false);
    }
  }

  function openMediaMenu(e: React.MouseEvent) {
    e.stopPropagation();
    setMediaMenuOpen(true);
  }
  function closeMediaMenu() { setMediaMenuOpen(false); }

  // Pop-under cursor micro-animation states
  const [cursorX,          setCursorX]          = useState(310);
  const [cursorY,          setCursorY]          = useState(180);
  const [cursorClicked,    setCursorClicked]    = useState(false);
  const [cursorVisible,    setCursorVisible]    = useState(false);
  const [activeTab,        setActiveTab]        = useState<"main"|"popup">("main");
  const [screenshotLoaded, setScreenshotLoaded] = useState(false);

  useEffect(() => {
    if (form.adFormat === 4) {
      const t0 = setTimeout(() => setCursorVisible(true),           300);
      const t1 = setTimeout(() => { setCursorX(195); setCursorY(255); }, 600);
      const t2 = setTimeout(() => setCursorClicked(true),          1300);
      const t3 = setTimeout(() => setCursorClicked(false),         1500);
      const t4 = setTimeout(() => setAdVisible(true),              1650); // tab slide in
      const t5 = setTimeout(() => setActiveTab("popup"),           2150); // content switch
      return () => [t0,t1,t2,t3,t4,t5].forEach(clearTimeout);
    } else {
      const t = setTimeout(() => setAdVisible(true), 1000);
      return () => clearTimeout(t);
    }
  }, [form.adFormat]);

  useEffect(() => {
    if (form.adFormat !== 5 || !adVisible || countdown <= 0) return;
    const t = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [adVisible, form.adFormat, countdown]);

  const format  = AD_FORMATS.find(f => f.id === form.adFormat);
  const netName = form.network === "EXOCLICK" ? "ExoClick"
                : form.network === "TRAFFICSTARS" ? "TrafficStars" : "TrafficJunky";
  const img     = form.imagePreview;
  const hasImg  = !!img;
  const screenshotUrl = form.url
    ? `https://s.wordpress.com/mshots/v1/${encodeURIComponent(form.url)}?w=800`
    : null;

  // Fake site URL based on network
  const fakeUrl = "contenthub-xxx.com/videos/trending";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      style={{ minHeight: "100vh", padding: 32 }}
    >
      <div style={{ maxWidth: 1540, margin: "0 auto", display: "grid", gridTemplateColumns: "280px 1fr", gap: 32 }}>

        {/* ── Left sidebar ── */}
        <aside style={{
          borderRadius: 28, border: "1px solid rgba(255,255,255,0.06)",
          background: "linear-gradient(180deg,rgba(12,13,18,0.98),rgba(9,10,15,0.96))",
          overflow: "hidden", position: "sticky", top: 32,
          display: "flex", flexDirection: "column", alignSelf: "start",
        }}>
          {/* Sidebar header */}
          <div style={{ padding: "32px 24px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: 25, letterSpacing: "-0.04em", fontWeight: 300 }}>AdVault</div>
            <div style={{ marginTop: 4, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.24em", color: "rgba(255,255,255,0.28)" }}>
              Campaign preview
            </div>
          </div>

          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Preview mode */}
            <div style={{ borderRadius: 24, border: "1px solid rgba(255,255,255,0.08)", background: "linear-gradient(180deg,rgba(17,18,25,0.98),rgba(12,13,19,0.98))", padding: 20 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.24em", color: "rgba(255,255,255,0.24)" }}>Preview mode</div>
              <div style={{ marginTop: 16, fontSize: 24, letterSpacing: "-0.04em", fontWeight: 300 }}>Launch Preview</div>
              <p style={{ marginTop: 12, fontSize: 14, lineHeight: 1.7, color: "rgba(255,255,255,0.42)", margin: "12px 0 0" }}>
                Visualise how the ad enters its format before the final launch confirmation.
              </p>
            </div>

            {/* Selected campaign */}
            <div style={{ borderRadius: 24, border: "1px solid rgba(255,255,255,0.08)", background: "linear-gradient(180deg,rgba(17,18,25,0.98),rgba(12,13,19,0.98))", padding: 20 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.24em", color: "rgba(255,255,255,0.24)" }}>Selected campaign</div>
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12, fontSize: 14 }}>
                {[
                  { label: "Network",      value: netName },
                  { label: "Format",       value: format?.label || "—" },
                  { label: "Campaign",     value: form.name || "—" },
                  { label: "Geo",          value: form.countries.length ? form.countries.slice(0,3).join(", ") + (form.countries.length > 3 ? ` +${form.countries.length - 3}` : "") : "All" },
                  { label: "Launch state", value: form.active ? "Active" : "Paused" },
                  { label: "Budget/day",   value: form.dailyBudget ? `€${form.dailyBudget}` : "—" },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                    <span style={{ color: "rgba(255,255,255,0.30)" }}>{label}</span>
                    <span style={{ color: "rgba(255,255,255,0.80)", textAlign: "right", maxWidth: 140 }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Engine after launch */}
            <div style={{ borderRadius: 24, border: "1px solid rgba(255,255,255,0.08)", background: "linear-gradient(180deg,rgba(17,18,25,0.98),rgba(12,13,19,0.98))", padding: 20 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.24em", color: "rgba(255,255,255,0.24)" }}>Engine after launch</div>
              <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                <div style={{ borderRadius: 16, border: "1px solid rgba(251,113,133,0.18)", background: "rgba(244,63,94,0.08)", padding: 12 }}>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.20em", color: "rgba(253,164,175,0.8)" }}>Kill</div>
                  <div style={{ marginTop: 8, fontSize: 18, letterSpacing: "-0.03em", fontWeight: 300, color: "#fda4af" }}>{form.killThreshold}%</div>
                </div>
                <div style={{ borderRadius: 16, border: "1px solid rgba(251,191,36,0.18)", background: "rgba(245,158,11,0.08)", padding: 12 }}>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.20em", color: "rgba(253,230,138,0.8)" }}>Watch</div>
                  <div style={{ marginTop: 8, fontSize: 14, letterSpacing: "-0.03em", fontWeight: 300, color: "#fde68a" }}>{form.watchMinRoi}→{form.watchMaxRoi}</div>
                </div>
                <div style={{ borderRadius: 16, border: "1px solid rgba(74,222,128,0.18)", background: "rgba(16,185,129,0.08)", padding: 12 }}>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.20em", color: "rgba(134,239,172,0.8)" }}>Scale</div>
                  <div style={{ marginTop: 8, fontSize: 18, letterSpacing: "-0.03em", fontWeight: 300, color: "#86efac" }}>+{form.scaleBy}%</div>
                </div>
              </div>
            </div>

            {/* Creative thumbnail */}
            <div style={{ borderRadius: 24, border: "1px solid rgba(255,255,255,0.08)", background: "linear-gradient(180deg,rgba(17,18,25,0.98),rgba(12,13,19,0.98))", padding: 20 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.24em", color: "rgba(255,255,255,0.24)", marginBottom: 16 }}>Creative</div>
              {/* Ad thumbnail — cliquable */}
              <div
                onMouseEnter={() => setThumbHovered(true)}
                onMouseLeave={() => setThumbHovered(false)}
                onClick={openMediaMenu}
                style={{
                  borderRadius: 16, overflow: "hidden",
                  background: "rgba(255,255,255,0.02)",
                  border: hasImg
                    ? "1px solid rgba(255,255,255,0.07)"
                    : thumbHovered
                      ? "1.5px dashed rgba(74,222,128,0.30)"
                      : "1.5px dashed rgba(255,255,255,0.09)",
                  aspectRatio: "16/9",
                  position: "relative",
                  cursor: "pointer",
                  transition: "border-color 0.2s",
                }}
              >
                {hasImg ? (
                  form.mediaType === "video"
                    ? <video src={img!} autoPlay loop muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    /* eslint-disable-next-line @next/next/no-img-element */
                    : <img src={img!} alt="creative" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <Upload size={18} color={thumbHovered ? "#4ade80" : "rgba(255,255,255,0.18)"} style={{ transition: "color 0.15s" }} />
                    <span style={{ fontSize: 11, color: thumbHovered ? "#4ade80" : "rgba(255,255,255,0.22)", transition: "color 0.15s" }}>
                      Add creative
                    </span>
                  </div>
                )}
                <AnimatePresence>
                  {hasImg && thumbHovered && (
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      transition={{ duration: 0.14 }}
                      style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: 500, letterSpacing: "0.04em" }}>Change creative</span>
                    </motion.div>
                  )}
                </AnimatePresence>
                {hasImg && (
                  <motion.button
                    initial={{ opacity: 0 }} animate={{ opacity: thumbHovered ? 1 : 0 }}
                    whileTap={{ scale: 0.93 }}
                    onClick={e => { e.stopPropagation(); onUpdateMedia(null, null, null, null); }}
                    style={{ position: "absolute", top: 8, right: 8, width: 24, height: 24, borderRadius: 7, background: "rgba(160,112,112,0.3)", border: "1px solid rgba(160,112,112,0.4)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "opacity 0.15s" }}
                  >
                    <X size={10} color="#a07070" />
                  </motion.button>
                )}
              </div>
              <input ref={previewFileRef} type="file" accept="image/*,video/*" onChange={handlePreviewFile} style={{ display: "none" }} />
            </div>
          </div>
        </aside>

        {/* ── Right main ── */}
        <main>
          <div style={{
            borderRadius: 30, border: "1px solid rgba(255,255,255,0.06)",
            background: "linear-gradient(180deg,rgba(10,11,17,0.96),rgba(8,9,14,0.98))",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.02), 0 35px 120px rgba(0,0,0,0.45)",
            overflow: "hidden",
          }}>
            {/* Vision header */}
            <div style={{ padding: 32, borderBottom: "1px solid rgba(255,255,255,0.06)", background: "radial-gradient(circle at 22% 0%,rgba(99,102,241,0.08),transparent 35%)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 32 }}>
                <div>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.24em", color: "rgba(134,239,172,0.8)", marginBottom: 12 }}>
                    Preview page
                  </div>
                  <h1 style={{ fontSize: 44, lineHeight: 0.96, letterSpacing: "-0.05em", fontWeight: 300, maxWidth: 640, margin: "0 0 16px" }}>
                    See how the campaign enters the format.
                  </h1>
                  <p style={{ maxWidth: 580, color: "rgba(255,255,255,0.46)", fontSize: 16, lineHeight: 1.75, margin: 0 }}>
                    {netName} · {format?.label || "Ad"} — {form.name || "Untitled campaign"}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0, paddingTop: 8 }}>
                  <button onClick={onBack} style={{
                    borderRadius: 16, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)",
                    padding: "10px 20px", fontSize: 14, color: "rgba(255,255,255,0.70)", cursor: "pointer",
                  }}>
                    ← Back to setup
                  </button>
                  <motion.button
                    onClick={onLaunch}
                    disabled={submitting}
                    whileTap={!submitting ? { scale: 0.97 } : {}}
                    style={{
                      borderRadius: 16, padding: "11px 24px", fontSize: 14, fontWeight: 600,
                      border: "none", cursor: submitting ? "not-allowed" : "pointer",
                      background: submitting ? "rgba(255,255,255,0.06)" : "#ffffff",
                      color: submitting ? "rgba(255,255,255,0.22)" : "#000000",
                      transition: "background 0.18s, color 0.18s",
                      display: "flex", alignItems: "center", gap: 7,
                    }}
                  >
                    {submitting
                      ? <><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}><RefreshCw size={13} /></motion.div> Creating…</>
                      : <>Launch campaign →</>
                    }
                  </motion.button>
                </div>
              </div>
              {error && (
                <div style={{ marginTop: 16, padding: "10px 16px", borderRadius: 12, background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.2)", color: "#f87171", fontSize: 13 }}>
                  {error}
                </div>
              )}
            </div>

            {/* Content area */}
            <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>

              {/* Format info card */}
              <div style={{ borderRadius: 26, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
                <div>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.24em", color: "rgba(255,255,255,0.24)" }}>Ad format</div>
                  <div style={{ marginTop: 8, fontSize: 24, letterSpacing: "-0.04em", fontWeight: 300 }}>{format?.label || "—"}</div>
                </div>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.38)", maxWidth: 360, textAlign: "right" }}>
                  {format?.sub}
                </div>
              </div>

              {/* ── Mock browser ── */}
              <div style={{ position: "relative" }}>
              {/* Main browser */}
              <div style={{
                position: "relative",
                background: "#16161e", borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.07)",
                overflow: "hidden", display: "flex", flexDirection: "column",
                boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
              }}>
          {/* Chrome bar — tab-bar style for pop-under, simple for others */}
          {form.adFormat === 4 ? (
            <div style={{ background: "#141420", flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {/* Tab row */}
              <div style={{ display: "flex", alignItems: "flex-end", padding: "8px 10px 0", gap: 1 }}>
                {/* Traffic lights */}
                <div style={{ display: "flex", gap: 5, alignSelf: "center", marginRight: 10, flexShrink: 0, paddingBottom: 6 }}>
                  {["#ff5f57","#febc2e","#28c840"].map(c => (
                    <div key={c} style={{ width: 9, height: 9, borderRadius: "50%", background: c }} />
                  ))}
                </div>
                {/* Tab 1 — XHUB */}
                <div style={{
                  background: activeTab === "main" ? "#1c1c26" : "transparent",
                  padding: "5px 12px 6px 10px",
                  borderRadius: "7px 7px 0 0",
                  display: "flex", alignItems: "center", gap: 6,
                  minWidth: 130, maxWidth: 180,
                  borderTop:   activeTab === "main" ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent",
                  borderLeft:  activeTab === "main" ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent",
                  borderRight: activeTab === "main" ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent",
                  borderBottom: "none",
                  transition: "all 0.2s",
                  cursor: "default",
                }}>
                  <div style={{ width: 11, height: 11, borderRadius: 2, flexShrink: 0,
                    background: "linear-gradient(135deg,#ff3366,#ff6633)" }} />
                  <span style={{ fontSize: 9.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    color: activeTab === "main" ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.3)", transition: "color 0.2s" }}>
                    XHUB – Trending
                  </span>
                </div>
                {/* Tab 2 — new tab slides in */}
                <AnimatePresence>
                  {adVisible && (
                    <motion.div
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: 170, opacity: 1 }}
                      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                      style={{
                        background: activeTab === "popup" ? "#1c1c26" : "rgba(255,255,255,0.04)",
                        padding: "5px 12px 6px 10px",
                        borderRadius: "7px 7px 0 0",
                        display: "flex", alignItems: "center", gap: 6,
                        overflow: "hidden", flexShrink: 0,
                        borderTop:   activeTab === "popup" ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(255,255,255,0.03)",
                        borderLeft:  activeTab === "popup" ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(255,255,255,0.03)",
                        borderRight: activeTab === "popup" ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(255,255,255,0.03)",
                        borderBottom: "none",
                        transition: "background 0.25s, border-color 0.25s",
                        cursor: "default",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <div style={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                        background: "#6366f1" }} />
                      <span style={{ fontSize: 9.5, overflow: "hidden", textOverflow: "ellipsis",
                        color: activeTab === "popup" ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.3)",
                        transition: "color 0.25s", flex: 1, minWidth: 0 }}>
                        {form.url ? form.url.replace(/^https?:\/\//, "").split("/")[0] : "Nouvel onglet"}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
                {/* + button */}
                <div style={{ alignSelf: "center", paddingBottom: 6, marginLeft: 4, width: 20, height: 20,
                  borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center",
                  color: "rgba(255,255,255,0.2)", fontSize: 15, flexShrink: 0 }}>+</div>
              </div>
              {/* Address bar */}
              <div style={{ padding: "5px 12px 8px", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, background: "rgba(255,255,255,0.05)", borderRadius: 6,
                  padding: "5px 10px", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 9, opacity: 0.4 }}>🔒</span>
                  <motion.span
                    key={activeTab}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ duration: 0.25 }}
                    style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", overflow: "hidden",
                      textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {activeTab === "popup"
                      ? (form.url ? form.url.replace(/^https?:\/\//, "") : "your-site.com")
                      : fakeUrl}
                  </motion.span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              background: "#1c1c26", padding: "10px 16px",
              display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}>
              <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                {["#ff5f57","#febc2e","#28c840"].map(c => (
                  <div key={c} style={{ width: 9, height: 9, borderRadius: "50%", background: c }} />
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1,
                background: "rgba(255,255,255,0.05)", borderRadius: 6, padding: "5px 10px" }}>
                <span style={{ fontSize: 9, opacity: 0.4 }}>🔒</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: "0.01em" }}>
                  {fakeUrl}
                </span>
              </div>
            </div>
          )}

          {/* Fake page */}
          <div style={{ flex: 1, overflowY: "auto", background: "#0e0e14", position: "relative", minHeight: 0 }}>

            {/* Pop-under: quand l'onglet 2 est actif, afficher la preview URL */}
            <AnimatePresence>
              {form.adFormat === 4 && activeTab === "popup" && (
                <motion.div
                  key="popup-content"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  style={{
                    position: "absolute", inset: 0, zIndex: 10,
                    background: "#0e0e14",
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                  }}
                >
                  {/* Vrai contenu si image/video uploadée */}
                  {hasImg && form.mediaType === "video" ? (
                    <video src={img!} autoPlay loop muted playsInline
                      style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : hasImg ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={img!} alt="ad" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : screenshotUrl ? (
                    /* Screenshot de l'URL via mshots */
                    <div style={{ width: "100%", height: "100%", position: "relative" }}>
                      {!screenshotLoaded && (
                        <div style={{
                          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                          alignItems: "center", justifyContent: "center", gap: 12,
                          background: "linear-gradient(135deg,#0d0d1a,#1a1a2e)",
                        }}>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
                          >
                            <RefreshCw size={18} color="rgba(255,255,255,0.2)" />
                          </motion.div>
                          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>
                            Loading page…
                          </span>
                        </div>
                      )}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={screenshotUrl}
                        alt="preview"
                        onLoad={() => setScreenshotLoaded(true)}
                        style={{
                          width: "100%", height: "100%", objectFit: "cover",
                          opacity: screenshotLoaded ? 1 : 0,
                          transition: "opacity 0.4s ease",
                        }}
                      />
                    </div>
                  ) : (
                    <div style={{ textAlign: "center" }}>
                      <Globe size={32} color="rgba(255,255,255,0.1)" />
                      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.18)", marginTop: 10 }}>
                        votre-site.com
                      </p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Site header — XHUB */}
            <div style={{
              padding: "0 18px", height: 44, background: "#111118", flexShrink: 0,
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              {/* Logo + nav */}
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                    background: "linear-gradient(135deg,#fb7185,#ec4899)" }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#fb7185", letterSpacing: "0.06em" }}>
                    XHUB
                  </span>
                </div>
                <div style={{ display: "flex", gap: 14 }}>
                  {[["Videos", true],["Photos", false],["Live", false],["Premium", false]].map(([n, on]) => (
                    <span key={n as string} style={{ fontSize: 9, color: on ? "rgba(255,255,255,0.66)" : "rgba(255,255,255,0.28)", letterSpacing: "0.02em" }}>
                      {n as string}
                    </span>
                  ))}
                </div>
              </div>
              {/* Search + avatar */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 110, height: 22, borderRadius: 5,
                  border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.04)",
                  display: "flex", alignItems: "center", gap: 5, padding: "0 8px",
                  fontSize: 8, color: "rgba(255,255,255,0.2)",
                }}>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                  Search...
                </div>
                <div style={{
                  width: 24, height: 24, borderRadius: "50%",
                  background: "linear-gradient(135deg,rgba(251,113,133,0.3),rgba(236,72,153,0.2))",
                  border: "1px solid rgba(251,113,133,0.2)",
                }} />
              </div>
            </div>

            {/* Banner AD — top leaderboard */}
            {form.adFormat === 2 && (
              <AnimatePresence>
                {adVisible && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    style={{
                      margin: "10px 16px", borderRadius: 8, overflow: "hidden",
                      height: 72, background: "#1a1a24",
                      border: "1px solid rgba(255,165,0,0.25)",
                      position: "relative",
                    }}
                  >
                    {hasImg
                      /* eslint-disable-next-line @next/next/no-img-element */
                      ? <img src={img!} alt="ad" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <div style={{ width: "100%", height: "100%", background: "linear-gradient(90deg,#1a0a0e,#2e1420)",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                          <X size={14} color="rgba(255,100,100,0.4)" />
                          <span style={{ fontSize: 10, color: "rgba(255,100,100,0.4)" }}>No creative</span>
                        </div>
                    }
                    <div style={{
                      position: "absolute", top: 4, right: 4,
                      background: "rgba(0,0,0,0.65)", borderRadius: 3,
                      padding: "1px 5px", fontSize: 8, color: "rgba(255,255,255,0.45)",
                    }}>
                      Annonce
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}

            {/* Thumbnail grid + Native / In-video */}
            <div style={{ padding: "12px 16px" }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.25)",
                letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
                Trending now
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                {FAKE_THUMBS.map((t, i) => {
                  // Native ad replaces slot 3
                  if (form.adFormat === 14 && i === 3) {
                    return (
                      <AnimatePresence key="native-ad">
                        {adVisible ? (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.35, ease: "easeOut" }}
                            style={{
                              borderRadius: 8, overflow: "hidden", cursor: "pointer",
                              border: "1px solid rgba(255,165,0,0.3)", position: "relative",
                            }}
                          >
                            <div style={{ height: 88, overflow: "hidden" }}>
                              {hasImg
                                /* eslint-disable-next-line @next/next/no-img-element */
                                ? <img src={img!} alt="ad" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                : <div style={{ width: "100%", height: "100%", background: "linear-gradient(145deg,#1a0826,#2d0f45)" }} />
                              }
                            </div>
                            <div style={{ padding: "5px 6px", background: "#1a1a24" }}>
                              <p style={{ fontSize: 9, color: "rgba(255,255,255,0.7)", margin: 0,
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {form.name || "Your ad"}
                              </p>
                            </div>
                            <div style={{
                              position: "absolute", top: 4, left: 4,
                              background: "rgba(245,158,11,0.85)", borderRadius: 3,
                              padding: "1px 5px", fontSize: 7, fontWeight: 700, color: "#000", letterSpacing: "0.06em",
                            }}>
                              Sponsored
                            </div>
                          </motion.div>
                        ) : (
                          <div key={i} style={{ borderRadius: 8, overflow: "hidden", background: t.bg }}>
                            <div style={{ height: 88 }} />
                            <div style={{ padding: "5px 6px", background: "rgba(0,0,0,0.4)" }}>
                              <p style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", margin: 0 }}>Loading…</p>
                            </div>
                          </div>
                        )}
                      </AnimatePresence>
                    );
                  }
                  // In-video — replaces slot 0 with a fake player
                  if (form.adFormat === 5 && i === 0) {
                    return (
                      <div key="invideo" style={{ gridColumn: "1 / -1", borderRadius: 10, overflow: "hidden",
                        background: "#000", position: "relative", aspectRatio: "16/9", marginBottom: 4 }}>
                        {/* Fake video bg */}
                        <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#0a0a14,#1a0a1e)",
                          display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.1)",
                            display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <div style={{ width: 0, height: 0, borderTop: "8px solid transparent",
                              borderBottom: "8px solid transparent", borderLeft: "14px solid rgba(255,255,255,0.4)", marginLeft: 2 }} />
                          </div>
                        </div>
                        {/* Pre-roll overlay */}
                        <AnimatePresence>
                          {adVisible && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.3 }}
                              style={{
                                position: "absolute", inset: 0,
                                display: "flex", flexDirection: "column",
                              }}
                            >
                              {hasImg
                                /* eslint-disable-next-line @next/next/no-img-element */
                                ? <img src={img!} alt="ad" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                : <div style={{ flex: 1, background: "linear-gradient(135deg,#1a0826,#2d0f45)",
                                    display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Votre visuel ici</span>
                                  </div>
                              }
                              <div style={{ position: "absolute", bottom: 8, right: 8, display: "flex", alignItems: "center", gap: 6 }}>
                                {countdown > 0 && (
                                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.55)",
                                    background: "rgba(0,0,0,0.55)", borderRadius: 4, padding: "2px 6px" }}>
                                    Skip dans {countdown}s
                                  </span>
                                )}
                                <div style={{ fontSize: 8, padding: "2px 6px", borderRadius: 4,
                                  background: "rgba(0,0,0,0.6)", color: "rgba(255,255,255,0.4)" }}>
                                  Annonce
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  }
                  return (
                    <div key={i} style={{ borderRadius: 8, overflow: "hidden" }}>
                      <div style={{ height: 88, background: t.bg, position: "relative" }}>
                        {t.hot && (
                          <div style={{ position: "absolute", top: 4, left: 4,
                            background: "rgba(255,50,50,0.8)", borderRadius: 3,
                            padding: "1px 4px", fontSize: 7, fontWeight: 700, color: "#fff" }}>
                            HD
                          </div>
                        )}
                        <div style={{
                          position: "absolute", bottom: 4, right: 4,
                          background: "rgba(0,0,0,0.62)", borderRadius: 2,
                          padding: "1px 4px", fontSize: 7.5, color: "rgba(255,255,255,0.5)",
                        }}>
                          {t.dur}
                        </div>
                      </div>
                      <div style={{ padding: "5px 7px", background: "#141420" }}>
                        <p style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", margin: "0 0 2px",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t.title}
                        </p>
                        <p style={{ fontSize: 7.5, color: "rgba(255,255,255,0.24)", margin: 0 }}>
                          contenthub-xxx.com
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Push notification */}
            {form.adFormat === 13 && (
              <AnimatePresence>
                {adVisible && (
                  <motion.div
                    initial={{ opacity: 0, x: 32, y: 16 }}
                    animate={{ opacity: 1, x: 0, y: 0 }}
                    exit={{ opacity: 0, x: 32 }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    style={{
                      position: "absolute", bottom: 16, right: 16,
                      width: 280, background: "#1c1c28",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12, overflow: "hidden",
                      boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px" }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: "#2a2a3a" }}>
                        {hasImg
                          /* eslint-disable-next-line @next/next/no-img-element */
                          ? <img src={img!} alt="icon" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#1a0826,#2d0f45)" }} />
                        }
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.85)", margin: "0 0 2px",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {form.name || "Nouvelle notification"}
                        </p>
                        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.38)", margin: "0 0 6px",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {form.url || "your-site.com"}
                        </p>
                        <p style={{ fontSize: 9, color: "rgba(255,255,255,0.22)", margin: 0 }}>
                          {netName} · Maintenant
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}

            {/* Interstitial — full overlay */}
            {form.adFormat === 8 && !interDismissed && (
              <AnimatePresence>
                {adVisible && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35 }}
                    style={{
                      position: "absolute", inset: 0,
                      background: "rgba(0,0,0,0.88)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      zIndex: 10,
                    }}
                  >
                    <div style={{
                      width: 300, background: "#1a1a26",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 14, overflow: "hidden",
                      position: "relative",
                    }}>
                      <div style={{ height: 200, background: "#0e0e18" }}>
                        {hasImg
                          /* eslint-disable-next-line @next/next/no-img-element */
                          ? <img src={img!} alt="ad" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <div style={{ width: "100%", height: "100%",
                              background: "linear-gradient(135deg,#1a0826,#2d0f45)",
                              display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>Votre visuel</span>
                            </div>
                        }
                      </div>
                      <div style={{ padding: "12px 14px" }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.75)", margin: "0 0 4px" }}>
                          {form.name || "Your ad"}
                        </p>
                        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", margin: 0 }}>
                          {form.url || "your-site.com"}
                        </p>
                      </div>
                      <button
                        onClick={() => setInterDismissed(true)}
                        style={{
                          position: "absolute", top: 8, right: 8,
                          width: 22, height: 22, borderRadius: "50%",
                          background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.15)",
                          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                        <X size={10} color="rgba(255,255,255,0.6)" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}

            {/* Pop-under: animated cursor micro-interaction */}
            {form.adFormat === 4 && cursorVisible && (
              <motion.div
                animate={{ left: cursorX, top: cursorY, scale: cursorClicked ? 0.75 : 1 }}
                transition={{ left: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }, top: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }, scale: { duration: 0.12 } }}
                style={{ position: "absolute", zIndex: 20, pointerEvents: "none", left: cursorX, top: cursorY }}
              >
                <svg width="18" height="22" viewBox="0 0 18 22" fill="none" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.7))" }}>
                  <path d="M2 2L2 18L6.5 13.5L9.5 20L11.5 19L8.5 12.5L15 12.5L2 2Z" fill="white" stroke="rgba(0,0,0,0.5)" strokeWidth="0.8" />
                </svg>
              </motion.div>
            )}

          </div>
        </div>

        </div>

              </div>{/* closes content area */}
            </div>{/* closes main card */}
          </main>
        </div>{/* closes outer grid */}

        {/* ── Media menu overlay (fixed, renders over everything) ── */}
          <AnimatePresence>
            {mediaMenuOpen && (
              <motion.div
                key="media-menu"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                onClick={closeMediaMenu}
                style={{
                  position: "fixed", inset: 0, zIndex: 500,
                  background: "rgba(0,0,0,0.72)",
                  backdropFilter: "blur(6px)",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  gap: 0,
                }}
              >
                <motion.div
                  onClick={e => e.stopPropagation()}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
                >
                  {/* Tronc */}
                  <motion.div
                    initial={{ scaleY: 0, opacity: 0 }}
                    animate={{ scaleY: 1, opacity: 1 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    style={{
                      width: 1.5, height: 48,
                      background: "rgba(255,255,255,0.18)",
                      transformOrigin: "top",
                    }}
                  />

                  {/* Point central */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 24, delay: 0.12 }}
                    style={{
                      width: 10, height: 10, borderRadius: "50%",
                      background: "rgba(255,255,255,0.55)",
                      flexShrink: 0,
                    }}
                  />

                  {/* Branches */}
                  <div style={{ display: "flex", gap: 20, marginTop: 28 }}>
                    <motion.button
                      initial={{ x: "65%", opacity: 0, scale: 0.78 }}
                      animate={{ x: 0, opacity: 1, scale: 1 }}
                      exit={{ x: "65%", opacity: 0, scale: 0.78 }}
                      transition={{ type: "spring", stiffness: 320, damping: 26, delay: 0.14 }}
                      whileHover={{ scale: 1.09, y: -5 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => previewFileRef.current?.click()}
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
                        width: 200, padding: "32px 0", borderRadius: 22, cursor: "pointer",
                        background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.13)",
                        color: "rgba(255,255,255,0.85)",
                        boxSizing: "border-box",
                      }}
                    >
                      <Upload size={32} strokeWidth={1.4} color="rgba(255,255,255,0.65)" />
                      <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "0.01em" }}>Fichier</span>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.28)" }}>PNG · JPG · GIF · MP4</span>
                    </motion.button>

                    <motion.button
                      initial={{ x: "-65%", opacity: 0, scale: 0.78 }}
                      animate={{ x: 0, opacity: 1, scale: 1 }}
                      exit={{ x: "-65%", opacity: 0, scale: 0.78 }}
                      transition={{ type: "spring", stiffness: 320, damping: 26, delay: 0.14 }}
                      whileHover={{ scale: 1.09, y: -5 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => { setPreviewVaultOpen(true); closeMediaMenu(); }}
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
                        width: 200, padding: "32px 0", borderRadius: 22, cursor: "pointer",
                        background: "rgba(74,143,180,0.09)", border: "1px solid rgba(74,143,180,0.22)",
                        color: "#4a8fb4",
                        boxSizing: "border-box",
                      }}
                    >
                      <Library size={32} strokeWidth={1.4} color="#4a8fb4" />
                      <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "0.01em" }}>ProfitDash</span>
                      <span style={{ fontSize: 11, color: "rgba(74,143,180,0.5)" }}>Mes assets</span>
                    </motion.button>
                  </div>

                  {/* Annuler */}
                  <motion.button
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.32 }}
                    onClick={closeMediaMenu}
                    style={{
                      marginTop: 32, background: "none", border: "none",
                      cursor: "pointer", fontSize: 12,
                      color: "rgba(255,255,255,0.22)", padding: "8px 20px",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Annuler
                  </motion.button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Vault modal */}
          <AnimatePresence>
            {previewVaultOpen && (
              <VaultPickerModal
                onSelect={asset => {
                  const mt = asset.type === "video" ? "video" : "image";
                  onUpdateMedia(asset.url || null, null, mt, asset.name);
                  setPreviewVaultOpen(false);
                }}
                onClose={() => setPreviewVaultOpen(false)}
              />
            )}
          </AnimatePresence>

    </motion.div>
  );
}

// ─── Vault Picker Modal ────────────────────────────────────────────────────────

const VAULT_MEDIA = [
  { id: "m1",  name: "banner_728x90.jpg",    url: "https://picsum.photos/seed/adv1/400/160",  type: "image", size: "42 KB",  duration: null },
  { id: "m2",  name: "square_300x250.jpg",   url: "https://picsum.photos/seed/adv2/300/250",  type: "image", size: "28 KB",  duration: null },
  { id: "m3",  name: "interstitiel.png",     url: "https://picsum.photos/seed/adv3/320/480",  type: "image", size: "95 KB",  duration: null },
  { id: "m4",  name: "halfpage_300x600.jpg", url: "https://picsum.photos/seed/adv9/250/400",  type: "image", size: "52 KB",  duration: null },
  { id: "m5",  name: "leaderboard.jpg",      url: "https://picsum.photos/seed/adv6/400/100",  type: "image", size: "38 KB",  duration: null },
  { id: "m6",  name: "animated_300x250.gif", url: "https://picsum.photos/seed/adv5/300/250",  type: "gif",   size: "1.1 MB", duration: null },
  { id: "m7",  name: "mobile_320x50.gif",    url: "https://picsum.photos/seed/adv8/320/160",  type: "gif",   size: "640 KB", duration: null },
  { id: "m8",  name: "banner_gif_320.gif",   url: "https://picsum.photos/seed/adv11/300/250", type: "gif",   size: "820 KB", duration: null },
  { id: "m9",  name: "promo_video_15s.mp4",  url: "",                                          type: "video", size: "2.4 MB", duration: "0:15" },
  { id: "m10", name: "video_banner_30s.mp4", url: "",                                          type: "video", size: "8.2 MB", duration: "0:30" },
  { id: "m11", name: "teaser_10s.mp4",       url: "",                                          type: "video", size: "1.8 MB", duration: "0:10" },
];

function VaultPickerModal({
  onSelect,
  onClose,
}: {
  onSelect: (asset: { name: string; url: string; type: string }) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"image" | "gif" | "video">("image");
  const [hovered, setHovered] = useState<string | null>(null);
  const filtered = VAULT_MEDIA.filter(m => m.type === tab);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.75)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 20 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        onClick={e => e.stopPropagation()}
        style={{
          background: "#121218",
          border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: 20,
          width: "100%", maxWidth: 580,
          maxHeight: "80vh",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        }}>

        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "18px 20px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
              <Library size={14} color="#38bdf8" />
              <h2 style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.9)", margin: 0 }}>
                Vault
              </h2>
            </div>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", margin: 0 }}>
              Select an asset from the Vault
            </p>
          </div>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 8, display: "flex",
            alignItems: "center", justifyContent: "center",
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
            cursor: "pointer",
          }}>
            <X size={12} color="rgba(255,255,255,0.5)" />
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex", gap: 4, padding: "12px 20px 0",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}>
          {([
            { key: "image" as const, label: "Photos", icon: <ImageIcon2 size={11} /> },
            { key: "gif"   as const, label: "GIFs",   icon: <SmileIcon size={11} /> },
            { key: "video" as const, label: "Videos", icon: <Film size={11} /> },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "7px 14px", borderRadius: "8px 8px 0 0", fontSize: 12, cursor: "pointer",
                fontWeight: tab === t.key ? 600 : 400,
                background: tab === t.key ? "rgba(14,165,233,0.08)" : "transparent",
                color: tab === t.key ? "#38bdf8" : "rgba(255,255,255,0.35)",
                border: tab === t.key ? "1px solid rgba(14,165,233,0.2)" : "1px solid transparent",
                borderBottom: "none",
                transition: "all 0.12s",
              }}>
              {t.icon}
              {t.label}
              <span style={{ fontSize: 9, color: "inherit", opacity: 0.6 }}>
                {VAULT_MEDIA.filter(m => m.type === t.key).length}
              </span>
            </button>
          ))}
        </div>

        {/* Grid */}
        <div style={{ overflowY: "auto", padding: "16px 20px 20px", flex: 1 }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 10,
          }}>
            {filtered.map(asset => (
              <motion.div key={asset.id}
                onClick={() => onSelect(asset)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onMouseEnter={() => setHovered(asset.id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  borderRadius: 12, overflow: "hidden", cursor: "pointer",
                  border: hovered === asset.id
                    ? "1.5px solid rgba(14,165,233,0.5)"
                    : "1px solid rgba(255,255,255,0.07)",
                  background: "rgba(255,255,255,0.025)",
                  transition: "border-color 0.12s",
                }}>

                {/* Thumbnail */}
                <div style={{ height: 90, background: "rgba(255,255,255,0.03)", position: "relative", overflow: "hidden" }}>
                  {asset.type === "video" ? (
                    /* Video placeholder */
                    <div style={{
                      width: "100%", height: "100%",
                      background: "linear-gradient(135deg, rgba(139,92,246,0.12), rgba(14,165,233,0.08))",
                      display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center", gap: 6,
                    }}>
                      <Film size={22} color="rgba(139,92,246,0.7)" />
                      {asset.duration && (
                        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontFamily: "monospace" }}>
                          {asset.duration}
                        </span>
                      )}
                    </div>
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={asset.url} alt={asset.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  )}
                  {/* Select overlay */}
                  <motion.div
                    animate={{ opacity: hovered === asset.id ? 1 : 0 }}
                    transition={{ duration: 0.12 }}
                    style={{
                      position: "absolute", inset: 0,
                      background: asset.type === "video" ? "rgba(139,92,246,0.25)" : "rgba(14,165,233,0.2)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: asset.type === "video" ? "#8b5cf6" : "#38bdf8",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Check size={14} color="#000" strokeWidth={1.4} />
                    </div>
                  </motion.div>
                </div>

                {/* Info */}
                <div style={{ padding: "8px 10px" }}>
                  <p style={{
                    fontSize: 10, fontWeight: 500, color: "rgba(255,255,255,0.65)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0,
                  }}>{asset.name}</p>
                  <p style={{ fontSize: 9, color: "rgba(255,255,255,0.28)", marginTop: 2 }}>{asset.size}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Country row sub-component ─────────────────────────────────────────────────

function CountryRow({ c, on, onClick }: { c: { code: string; name: string }; on: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 12px", borderRadius: 10, cursor: "pointer",
        background: on ? "rgba(107,158,130,0.05)" : "transparent",
        transition: "background 0.1s",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = on ? "rgba(107,158,130,0.08)" : "rgba(255,255,255,0.03)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = on ? "rgba(107,158,130,0.05)" : "transparent"; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 300, color: "#3F3F46", width: 24 }}>{c.code}</span>
        <span style={{ fontSize: 13, color: on ? "#F5F5F7" : "#71717A" }}>{c.name}</span>
      </div>
      <div style={{
        width: 16, height: 16, borderRadius: 5, flexShrink: 0,
        background: on ? "#6b9e82" : "rgba(255,255,255,0.06)",
        border: on ? "none" : "1px solid rgba(255,255,255,0.1)",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.15s",
      }}>
        {on && <Check size={9} strokeWidth={3} style={{ color: "#000" }} />}
      </div>
    </div>
  );
}
