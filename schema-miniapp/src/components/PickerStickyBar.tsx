// Шапка экранов выбора («Мои режимы», «Мои схемы»): всегда на виду, с числом
// отмеченного и кнопкой закрытия. До инцидента 2026-08 кнопка жила в самом
// низу списка из 35 карточек — кто не долистывал, терял выбор. Теперь выбор
// сохраняется сам (shared/hooks/useAutosavedSelection), а кнопка только
// закрывает — и до неё не надо скроллить.
export function PickerStickyBar({
  title,
  count,
  onDone,
}: {
  title: string;
  count: number;
  onDone: () => void;
}) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 2,
        background: 'var(--sheet-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '4px 0 10px',
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
        {title}
      </div>
      <button
        onClick={onDone}
        style={{
          flexShrink: 0,
          minHeight: 40,
          padding: '0 18px',
          borderRadius: 12,
          border: 'none',
          fontFamily: 'inherit',
          background:
            'linear-gradient(135deg, var(--accent), var(--accent-blue))',
          color: '#fff',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Готово{count > 0 ? ` · ${count}` : ''}
      </button>
    </div>
  );
}
