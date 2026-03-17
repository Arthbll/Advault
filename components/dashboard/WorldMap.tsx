"use client";

import { useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GlowDot {
  label: string; countryCode: string;
  x: number; y: number;
  impressions: string; clicks: string; spent: string;
  size: number; delay: string;
}

interface Props { dots?: GlowDot[] }

// ─── Fallback dots ────────────────────────────────────────────────────────────

const FALLBACK: GlowDot[] = [
  { label: "USA",       countryCode: "US", x: 210, y: 165, impressions: "—", clicks: "—", spent: "—", size: 5,   delay: "0s"   },
  { label: "France",    countryCode: "FR", x: 490, y: 155, impressions: "—", clicks: "—", spent: "—", size: 4,   delay: "0.4s" },
  { label: "Brazil",    countryCode: "BR", x: 293, y: 318, impressions: "—", clicks: "—", spent: "—", size: 4.5, delay: "0.8s" },
  { label: "India",     countryCode: "IN", x: 722, y: 240, impressions: "—", clicks: "—", spent: "—", size: 4,   delay: "1.2s" },
  { label: "Japan",     countryCode: "JP", x: 895, y: 170, impressions: "—", clicks: "—", spent: "—", size: 3.5, delay: "1.6s" },
  { label: "Australia", countryCode: "AU", x: 882, y: 348, impressions: "—", clicks: "—", spent: "—", size: 3.5, delay: "2.0s" },
];

// ─── Topojson → SVG path (minimal decoder, no dependencies) ──────────────────

interface TopoArc   { [0]: number; [1]: number; length: number }
interface Topology {
  transform?: { scale: [number, number]; translate: [number, number] };
  arcs: TopoArc[][];
  objects: Record<string, { geometries: TopoGeometry[] }>;
}
interface TopoGeometry {
  type: "Polygon" | "MultiPolygon" | string;
  arcs: number[][] | number[][][];
}

const W = 1000, H = 500;

function project(lon: number, lat: number): [number, number] {
  return [(lon + 180) / 360 * W, (90 - lat) / 180 * H];
}

function decodeArcs(topology: Topology): [number, number][][] {
  const s = topology.transform?.scale     ?? [1, 1];
  const t = topology.transform?.translate ?? [0, 0];
  return topology.arcs.map(arc => {
    let x = 0, y = 0;
    return (arc as unknown as number[][]).map(([dx, dy]) => {
      x += dx; y += dy;
      return [x * s[0] + t[0], y * s[1] + t[1]] as [number, number];
    });
  });
}

function ringToD(indices: number[], arcs: [number, number][][]): string {
  const pts: [number, number][] = [];
  for (const i of indices) {
    const arc = i < 0 ? [...arcs[~i]].reverse() : arcs[i];
    for (const [lon, lat] of arc) pts.push(project(lon, lat));
  }
  if (!pts.length) return "";
  return "M" + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L") + "Z";
}

function geometryToPath(geo: TopoGeometry, arcs: [number, number][][]): string {
  if (geo.type === "Polygon") {
    return (geo.arcs as number[][]).map(ring => ringToD(ring, arcs)).join(" ");
  }
  if (geo.type === "MultiPolygon") {
    return (geo.arcs as number[][][]).flatMap(poly =>
      (poly as number[][]).map(ring => ringToD(ring, arcs))
    ).join(" ");
  }
  return "";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WorldMap({ dots }: Props) {
  const activeDots  = dots && dots.length > 0 ? dots : FALLBACK;
  const hasRealData = dots && dots.length > 0;

  const [paths,   setPaths]   = useState<string[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;

    // Load Natural Earth 110m topojson from CDN (cached by browser)
    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
      .then(r => r.json())
      .then((topo: Topology) => {
        const decoded = decodeArcs(topo);
        const geoms   = topo.objects?.countries?.geometries ?? [];
        const newPaths = geoms
          .map(g => geometryToPath(g, decoded))
          .filter(Boolean);
        setPaths(newPaths);
        setMapReady(true);
      })
      .catch(() => {
        // CDN unavailable — map renders without country paths, dots still show
        setMapReady(true);
      });
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>

      {/* SVG fills the card completely */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
      >
        <defs>
          {/* Ocean background gradient */}
          <linearGradient id="ocean" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#0d1117" />
            <stop offset="100%" stopColor="#0a0f1a" />
          </linearGradient>

          {/* Subtle grid pattern */}
          <pattern id="grid" x="0" y="0" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(255,255,255,0.025)" strokeWidth="0.5" />
          </pattern>

          {/* Country land gradient */}
          <linearGradient id="land" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#1c2333" />
            <stop offset="100%" stopColor="#161c2a" />
          </linearGradient>

          {/* Vignette */}
          <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
            <stop offset="0%"   stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.7)" />
          </radialGradient>

          {/* Glow filters */}
          <filter id="glow" x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur stdDeviation="6" result="blur1" />
            <feGaussianBlur stdDeviation="2" result="blur2" in="SourceGraphic" />
            <feMerge>
              <feMergeNode in="blur1" />
              <feMergeNode in="blur1" />
              <feMergeNode in="blur2" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glowCore" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Country border glow */}
          <filter id="countryGlow" x="-5%" y="-5%" width="110%" height="110%">
            <feGaussianBlur stdDeviation="1" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Ocean */}
        <rect width={W} height={H} fill="url(#ocean)" />
        <rect width={W} height={H} fill="url(#grid)" />

        {/* Countries — loaded from topojson */}
        {mapReady && paths.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="url(#land)"
            stroke="rgba(99,120,175,0.25)"
            strokeWidth="0.4"
            strokeLinejoin="round"
          />
        ))}

        {/* Loading skeleton if map not ready */}
        {!mapReady && (
          <text x={W / 2} y={H / 2} textAnchor="middle"
            fontSize="11" fill="rgba(255,255,255,0.1)"
            fontFamily="Inter, system-ui, sans-serif">
            Chargement de la carte…
          </text>
        )}

        {/* Vignette overlay */}
        <rect width={W} height={H} fill="url(#vignette)" />

        {/* ── Glow Dots ── */}
        {activeDots.map((dot) => (
          <g key={dot.countryCode}>
            {/* Wide diffuse halo */}
            <circle cx={dot.x} cy={dot.y} r={dot.size * 5}
              fill="rgba(139,92,246,0.06)" filter="url(#glow)"
              className="glow-dot" style={{ animationDelay: dot.delay }} />
            {/* Mid halo */}
            <circle cx={dot.x} cy={dot.y} r={dot.size * 2.5}
              fill="rgba(167,139,250,0.15)" filter="url(#glow)"
              className="glow-dot" style={{ animationDelay: dot.delay }} />
            {/* Inner ring */}
            <circle cx={dot.x} cy={dot.y} r={dot.size * 1.3}
              fill="rgba(196,181,253,0.3)"
              className="glow-dot" style={{ animationDelay: dot.delay }} />
            {/* Bright core */}
            <circle cx={dot.x} cy={dot.y} r={dot.size * 0.65}
              fill="#ede9fe" filter="url(#glowCore)"
              className="glow-dot" style={{ animationDelay: dot.delay }} />

            {/* Label centered above */}
            <text x={dot.x} y={dot.y - dot.size * 3.2}
              textAnchor="middle" fontSize="7.5"
              fill="rgba(196,181,253,0.95)"
              fontFamily="Inter, system-ui, sans-serif"
              fontWeight="600" letterSpacing="0.1em">
              {dot.label.toUpperCase()}
            </text>
            {/* Impressions centered below */}
            <text x={dot.x} y={dot.y + dot.size * 3.6}
              textAnchor="middle" fontSize="7"
              fill="rgba(100,100,120,0.9)"
              fontFamily="Inter, system-ui, sans-serif"
              letterSpacing="0.04em">
              {dot.impressions}
            </text>
          </g>
        ))}
      </svg>

      {/* Header overlay — on top of SVG */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
        padding: "14px 18px",
        background: "linear-gradient(to bottom, rgba(13,17,23,0.85) 0%, rgba(13,17,23,0) 100%)",
        pointerEvents: "none",
      }}>
        <p style={{
          fontSize: 9, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.15em", color: "rgba(255,255,255,0.3)", margin: 0,
        }}>
          Global Traffic
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 3 }}>
          <span style={{ color: "#fff", fontWeight: 300, fontSize: 15, letterSpacing: "-0.02em" }}>
            ExoClick
          </span>
          {/* Blinking LED */}
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span className="live-dot" />
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em",
              color: "#4ade80", textTransform: "uppercase" }}>
              Live
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
