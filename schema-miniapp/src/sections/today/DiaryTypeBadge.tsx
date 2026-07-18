// DiaryTypeBadge — round type indicator for a diary entry (extracted from TodaySection.tsx).

export function DiaryTypeBadge({ type }: { type: string }) {
  const MAP: Record<string, { label: string; color: string }> = {
    schema: { label: 'Сх', color: '#818cf8' },
    mode: { label: 'Рж', color: '#f472b6' },
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
        background: color + '18',
        borderRadius: '50%',
      }}
    >
      {label}
    </span>
  );
}
