import React, { useState, useEffect, useRef, useCallback } from "react";
import TopLoadingBar from "../components/TopLoadingBar";
import { motion, AnimatePresence } from "framer-motion";
import {
  EnvelopeSimple,
  EnvelopeOpen,
  MagnifyingGlass,
  Robot,
  PaperPlaneTilt,
  X,
  Copy,
  Check,
  CheckCircle,
  ArrowClockwise,
  Funnel,
} from "@phosphor-icons/react";
import { useI18n } from "../contexts/I18nContext";
import api from "../services/api";
import Button from "../components/ui/Button";
import FieldCard from "../components/ui/FieldCard";
import { formatDateTime as formatDate } from "../utils/dates";

function stripHtmlForContext(html) {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 3000);
}

// ─── Panel de chat IA ────────────────────────────────────────────────────────
function AIPanel({ onClose, contextSubject, contextBody }) {
  const { t } = useI18n();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    const newMessages = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    try {
      const res = await api.post("/inbox/ai-chat", {
        messages: newMessages,
        context_subject: contextSubject,
        context_body: contextBody,
      });
      const data = res.data;
      setMessages(prev => [...prev, { role: "assistant", content: data.reply || data.detail || "Sin respuesta" }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: `Error: ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, contextSubject, contextBody]);

  const copyText = (text, idx) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    });
  };

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 300, damping: 35 }}
      className="bg-card"
      style={{
        position: "absolute", top: 0, right: 0, bottom: 0, width: 380,
        borderLeft: "1px solid var(--border)",
        display: "flex", flexDirection: "column", zIndex: 10,
      }}
    >
      {/* Header */}
      <div style={{
        padding: "16px 16px 12px",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Robot size={18} weight="fill" style={{ color: "#3B82F6" }} />
          <span className="text-text-main" style={{ fontWeight: 700, fontSize: 14 }}>
            {t("aiAssistant")}
          </span>
        </div>
        <button onClick={onClose} className="btn-ghost p-1.5">
          <X size={16} weight="bold" className="text-text-muted" />
        </button>
      </div>

      {/* Context pill */}
      {contextSubject && (
        <div className="rounded-lg" style={{
          margin: "10px 12px 0",
          padding: "6px 10px",
          background: "rgba(59,130,246,0.08)",
          border: "1px solid rgba(59,130,246,0.2)",
          fontSize: 11,
          color: "#3B82F6",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          Contexto: {contextSubject}
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
        {messages.length === 0 && (
          <div className="text-text-muted" style={{ textAlign: "center", padding: "40px 20px", fontSize: 13 }}>
            <Robot size={32} style={{ margin: "0 auto 12px", display: "block", opacity: 0.4 }} />
            Haz una pregunta o pide que redacte una respuesta al email seleccionado.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{
            marginBottom: 12,
            display: "flex",
            flexDirection: "column",
            alignItems: m.role === "user" ? "flex-end" : "flex-start",
          }}>
            <div style={{
              maxWidth: "85%",
              padding: "8px 12px",
              borderRadius: m.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
              background: m.role === "user" ? "#3B82F6" : "var(--bg-hover)",
              color: m.role === "user" ? "#fff" : "var(--text-main)",
              fontSize: 13,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              border: m.role === "assistant" ? "1px solid var(--border)" : "none",
            }}>
              {m.content}
            </div>
            {m.role === "assistant" && (
              <button
                onClick={() => copyText(m.content, i)}
                style={{
                  marginTop: 4,
                  background: "none", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 4,
                  color: copiedIdx === i ? "#16A34A" : "var(--text-muted)",
                  fontSize: 11,
                }}
              >
                {copiedIdx === i ? <Check size={12} /> : <Copy size={12} />}
                {copiedIdx === i ? t("useThisReply") : t("useThisReply")}
              </button>
            )}
          </div>
        ))}
        {loading && (
          <div className="text-text-muted" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", fontSize: 13 }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
              <ArrowClockwise size={14} />
            </motion.div>
            {t('iaGenerating')}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "12px", borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
          placeholder="Escribe un mensaje..."
          className="input-field"
          style={{ flex: 1 }}
        />
        <motion.button
          onClick={sendMessage}
          disabled={!input.trim() || loading}
          whileTap={{ scale: 0.95 }}
          className="rounded-lg"
          style={{
            width: 36, height: 36, border: "none",
            background: "#3B82F6", color: "#fff", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            opacity: (!input.trim() || loading) ? 0.5 : 1,
          }}
        >
          <PaperPlaneTilt size={16} weight="fill" />
        </motion.button>
      </div>
    </motion.div>
  );
}

// ─── Visor de email ───────────────────────────────────────────────────────────
function EmailViewer({ email, onMarkRead, onOpenAI }) {
  const { t } = useI18n();
  const [marked, setMarked] = useState(false);

  const handleMarkRead = async () => {
    await onMarkRead();
    setMarked(true);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Headers */}
      <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <h3 className="text-text-main" style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.2, margin: "0 0 12px" }}>
          {email.subject || "(Sin asunto)"}
        </h3>
        <div className="rounded-lg" style={{ background: "var(--bg-input)", padding: "10px 12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <FieldCard label="De" value={email.from || "—"} />
          {email.to && <FieldCard label="Para" value={email.to} />}
          {email.cc && <FieldCard label="CC" value={email.cc} fullWidth />}
          <FieldCard label="Fecha" value={formatDate(email.date) || "—"} />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {!marked && (
            <Button variant="secondary" size="sm" icon={CheckCircle} onClick={handleMarkRead}>
              {t("markAsRead")}
            </Button>
          )}
          {marked && (
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#16A34A" }}>
              <Check size={14} /> Marcado como leído
            </span>
          )}
          <Button variant="primary" size="sm" icon={Robot} onClick={onOpenAI}>
            {t("replyWithAI")}
          </Button>
        </div>
      </div>

      {/* Cuerpo */}
      <div style={{ flex: 1, overflow: "auto", padding: "16px 24px" }}>
        {email.html_body ? (
          <iframe
            sandbox="allow-same-origin"
            srcDoc={email.html_body}
            className="rounded-lg"
            style={{
              width: "100%", height: "100%", minHeight: 400, border: "none",
              background: "#fff",
            }}
            title="email-body"
          />
        ) : (
          <pre className="text-text-main" style={{ fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
            {email.plain_body || "(Email sin contenido)"}
          </pre>
        )}
      </div>
    </div>
  );
}

// ─── Item de la lista ─────────────────────────────────────────────────────────
function EmailListItem({ email, selected, onClick }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ x: 1 }}
      className="rounded-lg"
      style={{
        width: "100%", textAlign: "left",
        padding: "10px 12px", border: "none",
        background: selected ? "rgba(59,130,246,0.12)" : "transparent",
        cursor: "pointer", display: "flex", flexDirection: "column", gap: 3,
        borderLeft: selected ? "2px solid #3B82F6" : "2px solid transparent",
        marginBottom: 2,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          {!email.is_read && (
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#3B82F6", shrink: 0, flexShrink: 0 }} />
          )}
          <span className="text-text-main" style={{
            fontSize: 13, fontWeight: email.is_read ? 400 : 700,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {email.subject || "(Sin asunto)"}
          </span>
        </div>
        <span className="text-text-muted" style={{ fontSize: 10, whiteSpace: "nowrap", flexShrink: 0 }}>
          {formatDate(email.date)}
        </span>
      </div>
      <span className="text-text-muted" style={{ fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {email.from}
      </span>
    </motion.button>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function InboxAssistant() {
  const { t } = useI18n();
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterUnread, setFilterUnread] = useState(false);
  const [selectedUid, setSelectedUid] = useState(null);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showAI, setShowAI] = useState(false);

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    try {
      const filter = filterUnread ? "unread" : "all";
      const res = await api.get("/inbox/emails", { params: { folder: "INBOX", filter } });
      setEmails(Array.isArray(res.data) ? res.data : []);
    } catch {
      setEmails([]);
    } finally {
      setLoading(false);
    }
  }, [filterUnread]);

  useEffect(() => { fetchEmails(); }, [fetchEmails]);

  const selectEmail = async (uid) => {
    setSelectedUid(uid);
    setShowAI(false);
    setLoadingDetail(true);
    try {
      const res = await api.get(`/inbox/emails/${uid}`, { params: { folder: "INBOX" } });
      setSelectedEmail(res.data);
    } catch (e) {
      setSelectedEmail({ error: e.message });
    } finally {
      setLoadingDetail(false);
    }
  };

  const markRead = async () => {
    if (!selectedUid) return;
    await api.post(`/inbox/emails/${selectedUid}/mark-read`, null, { params: { folder: "INBOX" } });
    setEmails(prev => prev.map(e => e.uid === selectedUid ? { ...e, is_read: true } : e));
  };

  const filtered = emails.filter(e => {
    const s = search.toLowerCase();
    return !s || e.subject?.toLowerCase().includes(s) || e.from?.toLowerCase().includes(s);
  });

  const unreadCount = emails.filter(e => !e.is_read).length;

  return (
    <>
    <TopLoadingBar loading={loading || loadingDetail} />
    <div className="border border-border" style={{
      display: "flex", height: "calc(100vh - 220px)", minHeight: 400, gap: 0,
      background: "var(--bg-page)", borderRadius: 16, overflow: "hidden",
    }}>
      {/* Panel izquierdo — Lista */}
      <div className="bg-card" style={{
        width: 300, flexShrink: 0, display: "flex", flexDirection: "column",
        borderRight: "1px solid var(--border)",
      }}>
        {/* Toolbar */}
        <div style={{ padding: "14px 12px 10px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <EnvelopeSimple size={16} className="text-text-muted" />
              <span className="text-text-main" style={{ fontWeight: 700, fontSize: 13 }}>Bandeja</span>
              {unreadCount > 0 && (
                <span style={{
                  background: "#3B82F6", color: "#fff", borderRadius: 10,
                  fontSize: 10, fontWeight: 700, padding: "1px 6px",
                }}>
                  {unreadCount}
                </span>
              )}
            </div>
            <motion.button
              onClick={fetchEmails}
              whileTap={{ scale: 0.9 }}
              className="text-text-muted"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
            >
              <ArrowClockwise size={14} />
            </motion.button>
          </div>

          {/* Búsqueda */}
          <div style={{ position: "relative", marginBottom: 8 }}>
            <MagnifyingGlass size={13} className="text-text-muted" style={{
              position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
            }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t("search") + "..."}
              className="input-field"
              style={{ paddingLeft: 26 }}
            />
          </div>

          {/* Filtro no leídos */}
          <button
            onClick={() => setFilterUnread(v => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "4px 8px", borderRadius: 6,
              border: `1px solid ${filterUnread ? "#3B82F6" : "var(--border)"}`,
              background: filterUnread ? "rgba(59,130,246,0.1)" : "transparent",
              color: filterUnread ? "#3B82F6" : "var(--text-muted)",
              fontSize: 11, cursor: "pointer",
            }}
          >
            <Funnel size={11} weight={filterUnread ? "fill" : "regular"} />
            {t("unreadOnly")}
          </button>
        </div>

        {/* Lista */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
          {loading ? (
            <div className="text-text-muted" style={{ padding: 20, textAlign: "center", fontSize: 13 }}>
              {t("loading")}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-text-muted" style={{ padding: 20, textAlign: "center", fontSize: 13 }}>
              {t('iaNoEmails')}
            </div>
          ) : (
            filtered.map(e => (
              <EmailListItem
                key={e.uid}
                email={e}
                selected={e.uid === selectedUid}
                onClick={() => selectEmail(e.uid)}
              />
            ))
          )}
        </div>
      </div>

      {/* Panel derecho — Visor + AI */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {loadingDetail ? (
          <div className="text-text-muted" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>
            {t("loading")}
          </div>
        ) : !selectedEmail ? (
          <div className="text-text-muted" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <EnvelopeOpen size={48} style={{ opacity: 0.2, marginBottom: 12 }} />
            <p style={{ fontSize: 14 }}>{t("noEmailSelected")}</p>
          </div>
        ) : selectedEmail.error ? (
          <div style={{ padding: 24, color: "#DC2626", fontSize: 13 }}>Error: {selectedEmail.error}</div>
        ) : (
          <EmailViewer
            email={selectedEmail}
            onMarkRead={markRead}
            onOpenAI={() => setShowAI(true)}
          />
        )}

        {/* Panel IA slide-in */}
        <AnimatePresence>
          {showAI && selectedEmail && (
            <AIPanel
              onClose={() => setShowAI(false)}
              contextSubject={selectedEmail.subject}
              contextBody={stripHtmlForContext(selectedEmail.html_body) || selectedEmail.plain_body || ""}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
    </>
  );
}
