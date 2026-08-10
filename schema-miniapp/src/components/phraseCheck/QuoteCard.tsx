// «БЫЛО»/«СТАЛО» — общая карточка-цитата, отличаются только цветом и
// яркостью текста (правило «одна механика — один компонент»).
export function QuoteCard({
  label,
  color,
  text,
  bright,
}: {
  label: string;
  color: string;
  text: string;
  bright?: boolean;
}) {
  return (
    <div
      style={{
        background: `color-mix(in srgb, ${color} 6%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} ${bright ? 16 : 14}%, transparent)`,
        borderRadius: 16,
        padding: '13px 15px',
        textAlign: 'left',
        marginBottom: bright ? 16 : 10,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.06em',
          color,
          marginBottom: 5,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          lineHeight: 1.5,
          color: bright ? 'var(--text)' : 'var(--text-sub)',
        }}
      >
        «{text}»
      </div>
    </div>
  );
}
