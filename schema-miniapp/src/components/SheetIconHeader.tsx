// Шапка BottomSheet-экранов ресурсов (Тёплые слова, Письмо Уязвимому
// Ребёнку, Безопасное место): квадрат 44×44 с эмодзи в цветной плашке +
// заголовок + подзаголовок. Одна механика — один компонент (см. CLAUDE.md):
// раньше разметка была продублирована в каждом экране.
interface Props {
  emoji: string;
  bg: string;
  border: string;
  title: React.ReactNode;
  subtitle: React.ReactNode;
}

export function SheetIconHeader({ emoji, bg, border, title, subtitle }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 20,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          background: bg,
          border: `1px solid ${border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
          flexShrink: 0,
        }}
      >
        {emoji}
      </div>
      <div>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 2 }}>
          {subtitle}
        </div>
      </div>
    </div>
  );
}
