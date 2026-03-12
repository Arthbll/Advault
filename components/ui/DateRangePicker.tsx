"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Calendar } from "lucide-react";

export interface DateRange {
  from: string; // YYYY-MM-DD
  to:   string;
}

const PRESETS = [
  { label: "7j",  days: 7  },
  { label: "14j", days: 14 },
  { label: "30j", days: 30 },
  { label: "90j", days: 90 },
];

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

interface Props {
  value:    DateRange;
  onChange: (range: DateRange) => void;
}

export default function DateRangePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);

  function applyPreset(days: number) {
    onChange({ from: daysAgo(days), to: today() });
    setOpen(false);
  }

  function activePreset() {
    const diff = Math.round((new Date(value.to).getTime() - new Date(value.from).getTime()) / 86400_000);
    return PRESETS.find(p => p.days === diff)?.label ?? null;
  }

  return (
    <div className="relative">
      <motion.button
        onClick={() => setOpen(v => !v)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-semibold"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "#ffffff",
        }}
      >
        <Calendar size={13} style={{ color: "#fbbf24" }} />
        {value.from} → {value.to}
      </motion.button>

      {open && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          className="absolute right-0 top-12 z-50 p-4 rounded-3xl flex flex-col gap-4 min-w-[280px]"
          style={{
            background: "#18181b",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
          }}
        >
          {/* Presets */}
          <div className="flex gap-2">
            {PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => applyPreset(p.days)}
                className="flex-1 py-2 rounded-xl text-xs font-black transition-all"
                style={{
                  background: activePreset() === p.label ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.04)",
                  color:      activePreset() === p.label ? "#fbbf24"                : "rgba(255,255,255,0.4)",
                  border:     activePreset() === p.label ? "1px solid rgba(251,191,36,0.3)" : "1px solid transparent",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom range */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: "#3f3f46" }}>Personnalisé</p>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={value.from}
                max={value.to}
                onChange={e => onChange({ ...value, from: e.target.value })}
                className="flex-1 px-3 py-2 rounded-xl text-xs outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#ffffff", colorScheme: "dark" }}
              />
              <span style={{ color: "#3f3f46" }}>→</span>
              <input
                type="date"
                value={value.to}
                min={value.from}
                max={today()}
                onChange={e => onChange({ ...value, to: e.target.value })}
                className="flex-1 px-3 py-2 rounded-xl text-xs outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#ffffff", colorScheme: "dark" }}
              />
            </div>
          </div>

          <button
            onClick={() => setOpen(false)}
            className="py-2 rounded-2xl text-xs font-black"
            style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.2)" }}
          >
            Appliquer
          </button>
        </motion.div>
      )}
    </div>
  );
}
