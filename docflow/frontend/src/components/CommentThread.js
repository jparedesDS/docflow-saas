import React, { useState, useEffect, useCallback } from "react";
import {
  ChatText,
  PaperPlaneRight,
  ArrowBendDownRight,
} from "@phosphor-icons/react";
import api from "../services/api";
import { useI18n } from "../contexts/I18nContext";
import { timeAgo } from "../utils/dates";

const AVATAR_COLORS = [
  "#4F46E5", "#0D9488", "#D97706", "#DC2626", "#DB2777",
  "#16A34A", "#7C3AED", "#2563EB", "#EA580C", "#0891B2",
];

function getAvatarColor(letter) {
  if (!letter) return AVATAR_COLORS[0];
  const code = letter.toUpperCase().charCodeAt(0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

function CommentItem({ comment, onReply, depth = 0 }) {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState("");
  const { t } = useI18n();

  const initials = comment.user_initials || comment.user_name?.slice(0, 2)?.toUpperCase() || "??";
  const avatarColor = getAvatarColor(initials[0]);

  const handleSubmitReply = () => {
    if (!replyText.trim()) return;
    onReply(replyText.trim(), comment.id);
    setReplyText("");
    setShowReplyInput(false);
  };

  return (
    <div style={{ marginLeft: depth > 0 ? 24 : 0 }}>
      <div
        style={{
          display: "flex",
          gap: 10,
          padding: "8px 0",
          borderLeft: depth > 0 ? "2px solid var(--border)" : "none",
          paddingLeft: depth > 0 ? 12 : 0,
        }}
      >
        {/* Avatar */}
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: avatarColor,
            color: "#FFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {initials}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 3,
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-main)",
              }}
            >
              {comment.user_name || initials}
            </span>
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
              {timeAgo(comment.created_at || comment.timestamp)}
            </span>
          </div>

          <div
            style={{
              fontSize: 12,
              color: "var(--text-sub, var(--text-main))",
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {comment.content}
          </div>

          {/* Reply button */}
          <button
            onClick={() => setShowReplyInput((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              marginTop: 4,
              padding: "2px 6px",
              fontSize: 10,
              fontWeight: 500,
              color: "var(--text-muted)",
              background: "none",
              border: "none",
              cursor: "pointer",
              borderRadius: 4,
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            <ArrowBendDownRight size={12} />
            {t("reply") || "Responder"}
          </button>

          {/* Inline reply input */}
          {showReplyInput && (
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <input
                autoFocus
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSubmitReply()}
                placeholder={t("writeReply") || "Escribe una respuesta..."}
                style={{
                  flex: 1,
                  fontSize: 11,
                  padding: "5px 8px",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  background: "var(--bg-input)",
                  color: "var(--text-main)",
                  outline: "none",
                }}
              />
              <button
                onClick={handleSubmitReply}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 28,
                  height: 28,
                  background: "var(--accent)",
                  color: "#FFF",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                <PaperPlaneRight size={12} weight="bold" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Nested replies */}
      {comment.replies?.map((reply) => (
        <CommentItem
          key={reply.id}
          comment={reply}
          onReply={onReply}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

export default function CommentThread({ documentRef }) {
  const { t } = useI18n();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchComments = useCallback(() => {
    if (!documentRef) return;
    api
      .get(`/comments/${encodeURIComponent(documentRef)}`)
      .then((res) => setComments(res.data || []))
      .catch(() => setComments([]))
      .finally(() => setLoading(false));
  }, [documentRef]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSubmit = async (content, parentId = null) => {
    if (!content.trim()) return;

    // Extract @mentions
    const mentionRegex = /@(\w+)/g;
    const mentions = [];
    let match;
    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push(match[1]);
    }

    setSubmitting(true);
    try {
      await api.post(`/comments/${encodeURIComponent(documentRef)}`, {
        content: content.trim(),
        parent_id: parentId,
        mentions,
      });
      fetchComments();
      if (!parentId) setNewComment("");
    } catch {
      // Error handled by api interceptor
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 16, fontSize: 12, color: "var(--text-muted)" }}>
        {t("loading") || "Cargando..."}
      </div>
    );
  }

  return (
    <div style={{ padding: "8px 12px" }}>
      {/* Comments list */}
      {comments.length === 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "28px 16px",
            gap: 8,
            color: "var(--text-muted)",
          }}
        >
          <ChatText size={32} weight="thin" />
          <span style={{ fontSize: 12 }}>
            {t("noComments") || "Sin comentarios. Inicia la conversaci\u00f3n."}
          </span>
        </div>
      ) : (
        <div style={{ marginBottom: 12 }}>
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onReply={handleSubmit}
            />
          ))}
        </div>
      )}

      {/* New comment input */}
      <div
        style={{
          display: "flex",
          gap: 8,
          paddingTop: 10,
          borderTop: "1px solid var(--border)",
        }}
      >
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(newComment);
            }
          }}
          placeholder={t("writeComment") || "Escribe un comentario..."}
          rows={2}
          style={{
            flex: 1,
            fontSize: 12,
            padding: "8px 10px",
            border: "1px solid var(--border)",
            borderRadius: 8,
            background: "var(--bg-input)",
            color: "var(--text-main)",
            outline: "none",
            resize: "vertical",
            minHeight: 36,
            fontFamily: "inherit",
          }}
        />
        <button
          onClick={() => handleSubmit(newComment)}
          disabled={submitting || !newComment.trim()}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            background: newComment.trim() ? "var(--accent)" : "var(--bg-hover)",
            color: newComment.trim() ? "#FFF" : "var(--text-muted)",
            border: "none",
            borderRadius: 8,
            cursor: newComment.trim() ? "pointer" : "default",
            transition: "background 0.2s, color 0.2s",
            flexShrink: 0,
            alignSelf: "flex-end",
          }}
        >
          <PaperPlaneRight size={16} weight="bold" />
        </button>
      </div>
    </div>
  );
}
