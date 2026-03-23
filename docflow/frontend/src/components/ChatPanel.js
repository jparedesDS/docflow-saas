import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChatCircleDots, X, PaperPlaneTilt, Trash, SpinnerGap, Robot } from "@phosphor-icons/react";
import { useI18n } from "../contexts/I18nContext";
import SimpleMarkdown from "./SimpleMarkdown";
import api from "../services/api";

/* ── ChatPanel component ──────────────────────────────────── */

export default function ChatPanel() {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Show welcome message on first open
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        role: "assistant",
        content: t("chatWelcome"),
        id: "welcome",
      }]);
    }
  }, [isOpen, messages.length, t]);

  const handleSend = useCallback(async () => {
    const question = input.trim();
    if (!question || loading) return;

    const userMsg = { role: "user", content: question, id: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await api.post("/chatbot/ask", { question });
      const answer = res.data?.answer || t("chatError");
      setMessages(prev => [...prev, {
        role: "assistant",
        content: answer,
        id: Date.now() + 1,
      }]);
    } catch (err) {
      const detail = err.response?.data?.detail;
      const isApiError = detail?.includes("ANTHROPIC_API_KEY") || err.response?.status === 500;
      setMessages(prev => [...prev, {
        role: "assistant",
        content: isApiError ? t("chatNoApi") : t("chatError"),
        id: Date.now() + 1,
        isError: true,
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, t]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = async () => {
    try {
      await api.delete("/chatbot/history");
    } catch {
      // ignore — local clear is enough
    }
    setMessages([{
      role: "assistant",
      content: t("chatWelcome"),
      id: "welcome-reset",
    }]);
  };

  const handleToggle = () => {
    setIsOpen(prev => !prev);
    if (!isOpen) setHasNewMessage(false);
  };

  return (
    <>
      {/* ── Floating action button ── */}
      <motion.button
        onClick={handleToggle}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 9998,
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #4F46E5, #6366F1)",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 20px rgba(79,70,229,0.4)",
          color: "#fff",
        }}
        aria-label={t("chatTitle")}
      >
        {isOpen ? <X size={22} weight="bold" /> : <ChatCircleDots size={24} weight="fill" />}
        {hasNewMessage && !isOpen && (
          <span style={{
            position: "absolute",
            top: -2,
            right: -2,
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: "#DC2626",
            border: "2px solid var(--bg-page)",
          }} />
        )}
      </motion.button>

      {/* ── Chat panel ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: "fixed",
              bottom: 88,
              right: 24,
              zIndex: 9999,
              width: 400,
              height: 520,
              borderRadius: 16,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3), 0 0 0 1px rgba(99,102,241,0.1)",
            }}
          >
            {/* ── Header ── */}
            <div style={{
              padding: "12px 16px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "linear-gradient(135deg, rgba(79,70,229,0.08), rgba(99,102,241,0.04))",
              flexShrink: 0,
            }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: "linear-gradient(135deg, #4F46E5, #6366F1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}>
                <Robot size={18} weight="fill" color="#fff" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
                  {t("chatTitle")}
                </p>
                <p style={{ fontSize: 10, color: "var(--text-muted)", margin: 0 }}>
                  {t("chatSubtitle")}
                </p>
              </div>
              <button
                onClick={handleClear}
                title={t("chatClear")}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  padding: 4,
                  borderRadius: 6,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <Trash size={16} />
              </button>
              <button
                onClick={handleToggle}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  padding: 4,
                  borderRadius: 6,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* ── Messages ── */}
            <div style={{
              flex: 1,
              overflowY: "auto",
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    display: "flex",
                    justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                  }}
                >
                  <div style={{
                    maxWidth: "85%",
                    padding: "8px 12px",
                    borderRadius: msg.role === "user"
                      ? "14px 14px 4px 14px"
                      : "14px 14px 14px 4px",
                    backgroundColor: msg.role === "user"
                      ? "#4F46E5"
                      : msg.isError
                        ? "rgba(220,38,38,0.1)"
                        : "var(--bg-page)",
                    color: msg.role === "user"
                      ? "#fff"
                      : msg.isError
                        ? "#DC2626"
                        : "var(--text-main)",
                    fontSize: 13,
                    lineHeight: 1.5,
                    wordBreak: "break-word",
                    border: msg.role === "user"
                      ? "none"
                      : "1px solid var(--border)",
                  }}>
                    {msg.role === "assistant" ? <SimpleMarkdown text={msg.content} /> : msg.content}
                  </div>
                </div>
              ))}

              {/* Loading indicator */}
              {loading && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div style={{
                    padding: "8px 14px",
                    borderRadius: "14px 14px 14px 4px",
                    backgroundColor: "var(--bg-page)",
                    border: "1px solid var(--border)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 13,
                    color: "var(--text-muted)",
                  }}>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <SpinnerGap size={14} />
                    </motion.div>
                    {t("chatThinking")}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* ── Input ── */}
            <div style={{
              padding: "10px 14px",
              borderTop: "1px solid var(--border)",
              display: "flex",
              gap: 8,
              alignItems: "flex-end",
              flexShrink: 0,
              background: "var(--bg-card)",
            }}>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("chatPlaceholder")}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: "9px 12px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--bg-page)",
                  color: "var(--text-main)",
                  fontSize: 13,
                  outline: "none",
                  resize: "none",
                  fontFamily: "inherit",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => { e.target.style.borderColor = "#6366F1"; }}
                onBlur={(e) => { e.target.style.borderColor = "var(--border)"; }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  border: "none",
                  cursor: !input.trim() || loading ? "not-allowed" : "pointer",
                  background: !input.trim() || loading
                    ? "var(--bg-page)"
                    : "linear-gradient(135deg, #4F46E5, #6366F1)",
                  color: !input.trim() || loading ? "var(--text-muted)" : "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "background 0.15s, opacity 0.15s",
                  opacity: !input.trim() || loading ? 0.5 : 1,
                }}
                title={t("chatSend")}
              >
                <PaperPlaneTilt size={16} weight="fill" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
