// ── Diary type badge ──────────────────────────────────────────────────────────

export function DiaryTypeBadge({ type }: { type: string }) {
  const MAP: Record<string, { label: string; color: string }> = {
    schema: { label: 'Сх', color: 'var(--accent)' },
    mode: { label: 'Рж', color: 'var(--accent-pink)' },
    gratitude: { label: 'Бл', color: '#4ade80' },
  };
  const { label, color } = MAP[type] ?? {
    label: type.slice(0, 2),
    color: '#aaa',
  };
  return (
    <span
      style={{
        width: 22,
        height: 22,
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 10,
        fontWeight: 700,
        color,
        background: `color-mix(in srgb, ${color} 9%, transparent)`,
        borderRadius: '50%',
      }}
    >
      {label}
    </span>
  );
}
