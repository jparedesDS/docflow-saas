export default function LoadingSpinner() {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: 320,
    }}>
      <div style={{
        width: 36,
        height: 36,
        border: "3px solid var(--border, #2E3244)",
        borderTopColor: "var(--accent, #4F46E5)",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
