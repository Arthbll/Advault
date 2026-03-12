"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Mail, Lock, ArrowRight, AlertCircle } from "lucide-react";
import { login } from "@/app/actions/auth";

export default function LoginPage() {
  const [error, setError]           = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await login(formData);
      if (result?.error) setError(result.error);
    });
  }

  const focusStyle  = { border: "1px solid rgba(0,255,135,0.4)", boxShadow: "0 0 0 3px rgba(0,255,135,0.06)" };
  const blurStyle   = { border: "1px solid rgba(255,255,255,0.08)", boxShadow: "none" };

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
      className="w-full max-w-sm px-4"
    >
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1, duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
        className="flex flex-col items-center gap-3 mb-10"
      >
        <motion.div
          whileHover={{ rotate: 8, scale: 1.12 }}
          transition={{ type: "spring", stiffness: 300 }}
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-base font-black"
          style={{ background: "#FFD60A", color: "#000000", boxShadow: "0 0 0 1px rgba(255,214,10,0.3), 0 4px 16px rgba(255,214,10,0.3)" }}
        >
          AV
        </motion.div>
        <div className="text-center">
          <h1 className="text-xl font-black tracking-tight" style={{ color: "#F5F5F7" }}>AdVault</h1>
          <p className="text-xs mt-0.5" style={{ color: "#52525B" }}>Connexion à ton compte</p>
        </div>
      </motion.div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="rounded-3xl p-8"
        style={{ background: "#111113", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 32px 80px rgba(0,0,0,0.6)" }}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {[
            { label: "Email",          type: "email",    name: "email",    placeholder: "ton@email.com", autoComplete: "email" },
            { label: "Mot de passe",   type: "password", name: "password", placeholder: "••••••••",      autoComplete: "current-password" },
          ].map(({ label, type, name, placeholder, autoComplete }) => (
            <div key={name} className="flex flex-col gap-2">
              <label className="text-xs font-semibold tracking-widest uppercase" style={{ color: "#3F3F46" }}>{label}</label>
              <div className="relative">
                {type === "email"
                  ? <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#52525B" }} />
                  : <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#52525B" }} />
                }
                <input
                  type={type} name={name} required autoComplete={autoComplete} placeholder={placeholder}
                  className="w-full pl-9 pr-4 py-3 rounded-2xl text-sm outline-none transition-all"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}
                  onFocus={e => Object.assign(e.currentTarget.style, focusStyle)}
                  onBlur={e  => Object.assign(e.currentTarget.style, blurStyle)}
                />
              </div>
            </div>
          ))}

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, y: -6, height: 0 }}
                transition={{ duration: 0.25 }}
                className="flex items-center gap-2.5 px-4 py-3 rounded-2xl text-xs"
                style={{ background: "rgba(255,69,58,0.08)", border: "1px solid rgba(255,69,58,0.2)", color: "#FF453A" }}
              >
                <AlertCircle size={13} strokeWidth={1.5} />{error}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            type="submit" disabled={isPending}
            whileHover={!isPending ? { y: -1, boxShadow: "0 0 0 1px rgba(0,255,135,0.25), 0 4px 20px rgba(0,255,135,0.2)" } : {}}
            whileTap={!isPending ? { scale: 0.98 } : {}}
            className="flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold mt-1"
            style={{
              background: "rgba(0,255,135,0.1)", color: "#00FF87",
              border: "1px solid rgba(0,255,135,0.25)",
              opacity: isPending ? 0.7 : 1, cursor: isPending ? "not-allowed" : "pointer",
              transition: "box-shadow 0.2s",
            }}
          >
            {isPending
              ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}><Zap size={14} strokeWidth={1.5} /></motion.div>
              : <><span>Se connecter</span><ArrowRight size={14} strokeWidth={1.5} /></>
            }
          </motion.button>
        </form>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
        className="text-center text-xs mt-6" style={{ color: "#3F3F46" }}
      >
        Pas encore de compte ?{" "}
        <Link href="/register" className="font-semibold" style={{ color: "#00FF87" }}>Créer un compte</Link>
      </motion.p>
    </motion.div>
  );
}
