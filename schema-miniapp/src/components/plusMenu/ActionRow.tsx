// Строка быстрого действия: название и подпись, БЕЗ иконки и без своего
// цвета — выбирают здесь по смыслу, а ряд эмодзи превращает меню в базар
// (правило перенесено из FloatingPill/DiaryTypeButton, где оно было записано
// до рефакторинга; регресс держит тест «меню плюса без эмодзи» в
// PlusMenuSheet.test.tsx). Эмодзи реестра живут только в листах настройки
// (там строки-тумблеры, как в «Настроить экран»).
export function ActionRow({
  label,
  sub,
  onClick,
}: {
  label: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        minHeight: 60,
        padding: '14px 16px',
        borderRadius: 16,
        border: '1px solid var(--line)',
        background: 'var(--surface)',
        cursor: 'pointer',
        fontFamily: 'inherit',
        textAlign: 'left',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
          {label}
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>
          {sub}
        </div>
      </div>
    </button>
  );
}
