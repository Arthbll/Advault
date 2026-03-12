"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Send, Sparkles, Loader } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Quelles campagnes couper ?",
  "Comment améliorer mon ROI ?",
  "Analyse mes performances",
];

export default function AiChat() {
  const [open,     setOpen]     = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput("");

    const newMessages: Message[] = [...messages, { role: "user", content }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ messages: newMessages }),
      });

      if (!res.ok || !res.body) throw new Error("Erreur réseau");

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   reply   = "";

      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: reply };
          return updated;
        });
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "⚠ Erreur — vérifie ta clé API dans .env.local." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Floating button */}
      <motion.button
        onClick={() => setOpen(v => !v)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-2xl flex items-center justify-center"
        style={{
          background: open ? "rgba(255,255,255,0.08)" : "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
          boxShadow:  open ? "none" : "0 4px 24px rgba(251,191,36,0.35)",
          border:     "1px solid rgba(255,255,255,0.1)",
        }}
        aria-label="AI Assistant"
      >
        <AnimatePresence mode="wait" initial={false}>
          {open
            ? <motion.div key="x"  initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.18 }}><X size={17} style={{ color: "#fff" }} /></motion.div>
            : <motion.div key="ai" initial={{ rotate: 90,  opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.18 }}><Sparkles size={17} style={{ color: "#000" }} /></motion.div>
          }
        </AnimatePresence>
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{    opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
            className="fixed bottom-22 right-6 z-40 flex flex-col rounded-3xl overflow-hidden"
            style={{
              width: 360,
              height: 500,
              background: "#0d0d0f",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="w-7 h-7 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.25)" }}>
                <Sparkles size={13} style={{ color: "#fbbf24" }} />
              </div>
              <div>
                <p className="text-xs font-black" style={{ color: "#ffffff" }}>AdVault AI</p>
                <p className="text-xs" style={{ color: "#3f3f46", fontSize: 10 }}>Analyse tes campagnes en temps réel</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
              {messages.length === 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="flex flex-col items-center justify-center h-full gap-4">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                    style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.15)" }}>
                    <Sparkles size={18} style={{ color: "#fbbf24" }} />
                  </div>
                  <p className="text-xs text-center" style={{ color: "#52525b" }}>
                    Pose-moi une question sur<br />tes campagnes et performances.
                  </p>
                  <div className="flex flex-col gap-2 w-full">
                    {SUGGESTIONS.map(s => (
                      <button key={s} onClick={() => send(s)}
                        className="px-3 py-2 rounded-2xl text-xs text-left transition-colors"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "#71717a" }}
                        onMouseEnter={e => { (e.currentTarget).style.background = "rgba(255,255,255,0.07)"; (e.currentTarget).style.color = "#fff"; }}
                        onMouseLeave={e => { (e.currentTarget).style.background = "rgba(255,255,255,0.04)"; (e.currentTarget).style.color = "#71717a"; }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className="max-w-[80%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap"
                    style={m.role === "user"
                      ? { background: "rgba(251,191,36,0.12)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.2)" }
                      : { background: "rgba(255,255,255,0.05)", color: "#e4e4e7", border: "1px solid rgba(255,255,255,0.07)" }
                    }
                  >
                    {m.content || (
                      <motion.span
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ repeat: Infinity, duration: 1 }}
                        style={{ color: "#52525b" }}
                      >
                        ···
                      </motion.span>
                    )}
                  </div>
                </motion.div>
              ))}

              {loading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex justify-start">
                  <div className="px-3.5 py-2.5 rounded-2xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1 }}>
                      <Loader size={12} style={{ color: "#52525b" }} />
                    </motion.div>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Demande quelque chose…"
                  className="flex-1 bg-transparent text-xs outline-none"
                  style={{ color: "#ffffff" }}
                />
                <motion.button
                  onClick={() => send()}
                  disabled={!input.trim() || loading}
                  whileHover={input.trim() && !loading ? { scale: 1.08 } : {}}
                  whileTap={input.trim() && !loading ? { scale: 0.94 } : {}}
                  className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: input.trim() && !loading ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.04)",
                    border: "1px solid " + (input.trim() && !loading ? "rgba(251,191,36,0.25)" : "rgba(255,255,255,0.06)"),
                    cursor: input.trim() && !loading ? "pointer" : "not-allowed",
                  }}
                >
                  <Send size={11} style={{ color: input.trim() && !loading ? "#fbbf24" : "#3f3f46" }} />
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
