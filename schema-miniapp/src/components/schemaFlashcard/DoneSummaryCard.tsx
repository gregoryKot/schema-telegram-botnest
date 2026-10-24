// Карточка «режим / потребность / шаг» на экране «Готово» — вынесено из
// DoneStep.tsx (правило №10, файл был у потолка).
export function DoneSummaryCard({
  modeLabel,
  needLabel,
  action,
}: {
  modeLabel: string;
  needLabel: string | undefined;
  action: string;
}) {
  const rows = [
    { label: 'Режим', value: modeLabel },
    needLabel ? { label: 'Потребность', value: needLabel } : null,
    action ? { label: 'Шаг', value: action } : null,
  ].filter((r): r is { label: string; value: string } => !!r);

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--r-20)',
        padding: '16px',
        marginBottom: 20,
      }}
    >
      {rows.map((row, i) => (
        <div
          key={row.label}
          style={{
            paddingBottom: i < rows.length - 1 ? 12 : 0,
            marginBottom: i < rows.length - 1 ? 12 : 0,
            borderBottom:
              i < rows.length - 1 ? '1px solid var(--border-color)' : undefined,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              color: 'var(--text-faint)',
              marginBottom: 3,
            }}
          >
            {row.label}
          </div>
          <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>
            {row.value}
          </div>
        </div>
      ))}
    </div>
  );
}
