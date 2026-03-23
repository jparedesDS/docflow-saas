import React from "react";

/**
 * Shared simple markdown renderer.
 * Supports: headings (#, ##, ###), lists (-, *, numbered), bold (**),
 * italic (*), inline code (`code`), and empty lines as spacing.
 */

function formatInline(text) {
  const parts = [];
  let remaining = text;
  let keyIdx = 0;

  while (remaining.length > 0) {
    // Code: `text`
    const codeMatch = remaining.match(/`([^`]+)`/);
    // Bold: **text**
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
    // Italic: *text* (not preceded/followed by *)
    const italicMatch = remaining.match(/(?<!\*)\*([^*]+)\*(?!\*)/);

    // Find earliest match
    let earliest = null;
    let earliestIdx = Infinity;

    if (codeMatch && codeMatch.index < earliestIdx) {
      earliest = { type: "code", match: codeMatch };
      earliestIdx = codeMatch.index;
    }
    if (boldMatch && boldMatch.index < earliestIdx) {
      earliest = { type: "bold", match: boldMatch };
      earliestIdx = boldMatch.index;
    }
    if (italicMatch && italicMatch.index < earliestIdx) {
      earliest = { type: "italic", match: italicMatch };
      earliestIdx = italicMatch.index;
    }

    if (!earliest) {
      parts.push(<span key={`t-${keyIdx++}`}>{remaining}</span>);
      break;
    }

    // Text before match
    if (earliestIdx > 0) {
      parts.push(<span key={`t-${keyIdx++}`}>{remaining.substring(0, earliestIdx)}</span>);
    }

    const m = earliest.match;
    if (earliest.type === "code") {
      parts.push(
        <code key={`c-${keyIdx++}`} style={{
          backgroundColor: "rgba(99,102,241,0.12)",
          padding: "1px 5px",
          borderRadius: 4,
          fontSize: "0.9em",
          fontFamily: "monospace",
        }}>{m[1]}</code>
      );
    } else if (earliest.type === "bold") {
      parts.push(<strong key={`b-${keyIdx++}`}>{m[1]}</strong>);
    } else {
      parts.push(<em key={`i-${keyIdx++}`}>{m[1]}</em>);
    }

    remaining = remaining.substring(earliestIdx + m[0].length);
  }

  return parts;
}

export default function SimpleMarkdown({ text }) {
  if (!text) return null;

  const lines = text.split("\n");
  const elements = [];
  let listItems = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} style={{ margin: "4px 0", paddingLeft: 18 }}>
          {listItems.map((li, i) => (
            <li key={i} style={{ marginBottom: 2 }}>{formatInline(li)}</li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // Headings
    if (trimmed.startsWith("### ")) {
      flushList();
      elements.push(<h4 key={`h4-${i}`} style={{ fontWeight: 700, fontSize: 14, marginTop: 12, marginBottom: 4 }}>{formatInline(trimmed.slice(4))}</h4>);
      continue;
    }
    if (trimmed.startsWith("## ")) {
      flushList();
      elements.push(<h3 key={`h3-${i}`} style={{ fontWeight: 700, fontSize: 15, marginTop: 16, marginBottom: 6 }}>{formatInline(trimmed.slice(3))}</h3>);
      continue;
    }
    if (trimmed.startsWith("# ")) {
      flushList();
      elements.push(<h2 key={`h2-${i}`} style={{ fontWeight: 700, fontSize: 16, marginTop: 16, marginBottom: 6 }}>{formatInline(trimmed.slice(2))}</h2>);
      continue;
    }

    // List items (- or * or numbered)
    if (/^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      const content = trimmed.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "");
      listItems.push(content);
      continue;
    }

    flushList();

    // Empty line
    if (!trimmed) {
      elements.push(<div key={`sp-${i}`} style={{ height: 8 }} />);
      continue;
    }

    // Regular paragraph
    elements.push(<p key={`p-${i}`} style={{ margin: "2px 0", lineHeight: 1.5 }}>{formatInline(trimmed)}</p>);
  }

  flushList();

  return (
    <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text-main)" }}>
      {elements}
    </div>
  );
}
