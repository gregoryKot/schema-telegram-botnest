// Ряд одной метрики результата теста на схемы (классика «5–6» / средний
// балл): подпись, бар, значение. Единственная копия для обоих фронтендов
// (правило №3) — фронтенд-специфичных импортов нет.
export function ScoreBarRow({
  label,
  barPct,
  value,
  color,
  mb,
}: {
  label: string;
  barPct: number;
  value: string;
  color: string;
  mb: number;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: mb,
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: 'var(--text-faint)',
          width: 78,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <div
        style={{
          flex: 1,
          height: 3,
          background: 'rgba(var(--fg-rgb),0.1)',
          borderRadius: 2,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${barPct}%`,
            background: color,
            borderRadius: 2,
          }}
        />
      </div>
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color,
          width: 44,
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
    </div>
  );
}
