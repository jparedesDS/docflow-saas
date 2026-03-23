import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  File,
  FilePdf,
  FileImage,
  FileXls,
  UploadSimple,
  DownloadSimple,
  Trash,
} from "@phosphor-icons/react";
import api from "../services/api";
import { useI18n } from "../contexts/I18nContext";
import { useToast } from "../contexts/ToastContext";
import { timeAgo } from "../utils/dates";

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(filename) {
  if (!filename) return { Icon: File, color: "#64748B" };
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return { Icon: FilePdf, color: "#DC2626" };
  if (["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp"].includes(ext))
    return { Icon: FileImage, color: "#3B82F6" };
  if (["xls", "xlsx", "csv"].includes(ext))
    return { Icon: FileXls, color: "#16A34A" };
  return { Icon: File, color: "#64748B" };
}

export default function FileAttachments({ documentRef }) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const fetchFiles = useCallback(() => {
    if (!documentRef) return;
    api
      .get(`/attachments/${encodeURIComponent(documentRef)}`)
      .then((res) => setFiles(res.data || []))
      .catch(() => setFiles([]))
      .finally(() => setLoading(false));
  }, [documentRef]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleUpload = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);

    try {
      for (const file of fileList) {
        const formData = new FormData();
        formData.append("file", file);
        await api.post(
          `/attachments/${encodeURIComponent(documentRef)}/upload`,
          formData,
          { headers: { "Content-Type": "multipart/form-data" } }
        );
      }
      showToast(
        t("uploadSuccess") || `${fileList.length} archivo(s) subido(s)`,
        "success"
      );
      fetchFiles();
    } catch {
      showToast(t("uploadError") || "Error al subir archivo", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = (filename) => {
    const baseURL = process.env.REACT_APP_API_URL || "http://localhost:8000";
    const url = `${baseURL}/api/v1/attachments/${encodeURIComponent(documentRef)}/${encodeURIComponent(filename)}/download`;
    window.open(url, "_blank");
  };

  const handleDelete = async (attachmentId) => {
    const confirmed = window.confirm(
      t("deleteAttachmentConfirm") || "Eliminar este archivo?"
    );
    if (!confirmed) return;

    try {
      await api.delete(`/attachments/${attachmentId}`);
      setFiles((prev) => prev.filter((f) => f.id !== attachmentId));
      showToast(t("attachmentDeleted") || "Archivo eliminado", "success");
    } catch {
      showToast(t("deleteError") || "Error al eliminar", "error");
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
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
      {/* Drag-and-drop zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          padding: "20px 16px",
          marginBottom: 12,
          border: `2px dashed ${dragOver ? "var(--accent)" : "var(--border)"}`,
          borderRadius: 10,
          background: dragOver
            ? "var(--accent-soft, rgba(79,70,229,0.07))"
            : "var(--bg-input)",
          cursor: "pointer",
          transition: "border-color 0.2s, background 0.2s",
        }}
      >
        <UploadSimple
          size={24}
          weight="thin"
          color={dragOver ? "var(--accent)" : "var(--text-muted)"}
        />
        <span
          style={{
            fontSize: 12,
            color: dragOver ? "var(--accent)" : "var(--text-muted)",
            textAlign: "center",
          }}
        >
          {uploading
            ? t("uploading") || "Subiendo..."
            : t("dragAndDrop") || "Arrastra archivos aqu\u00ed o haz clic"}
        </span>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={(e) => handleUpload(e.target.files)}
          style={{ display: "none" }}
        />
      </div>

      {/* File list */}
      {files.length === 0 ? (
        <div
          style={{
            padding: 12,
            fontSize: 11,
            color: "var(--text-muted)",
            textAlign: "center",
          }}
        >
          {t("noAttachments") || "Sin archivos adjuntos"}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {files.map((file) => {
            const { Icon, color } = getFileIcon(file.filename || file.name);
            return (
              <div
                key={file.id || file.filename}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: 8,
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--bg-hover)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                {/* File icon */}
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    background: `${color}14`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon size={18} weight="duotone" color={color} />
                </div>

                {/* File info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: "var(--text-main)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {file.filename || file.name}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--text-muted)",
                      display: "flex",
                      gap: 8,
                    }}
                  >
                    <span>{formatFileSize(file.size)}</span>
                    {file.uploaded_at && <span>{timeAgo(file.uploaded_at)}</span>}
                  </div>
                </div>

                {/* Actions */}
                <button
                  onClick={() => handleDownload(file.filename || file.name)}
                  title={t("download") || "Descargar"}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 28,
                    height: 28,
                    background: "none",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    borderRadius: 6,
                    transition: "color 0.15s, background 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "var(--accent)";
                    e.currentTarget.style.background = "var(--accent-soft, rgba(79,70,229,0.07))";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--text-muted)";
                    e.currentTarget.style.background = "none";
                  }}
                >
                  <DownloadSimple size={14} />
                </button>

                <button
                  onClick={() => handleDelete(file.id)}
                  title={t("delete") || "Eliminar"}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 28,
                    height: 28,
                    background: "none",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    borderRadius: 6,
                    transition: "color 0.15s, background 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "#DC2626";
                    e.currentTarget.style.background = "rgba(220,38,38,0.07)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--text-muted)";
                    e.currentTarget.style.background = "none";
                  }}
                >
                  <Trash size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
