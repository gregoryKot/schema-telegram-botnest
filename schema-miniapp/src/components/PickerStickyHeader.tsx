// Липкая шапка выбиралки (SchemaPickerSheet/ModePickerSheet) — заголовок,
// подсказка «выбор сохраняется сразу» и кнопка «Готово» со счётчиком
// отмеченного. Раньше кнопка стояла внизу длинного списка — закрытие шита
// свайпом/крестиком до неё роняло выбор (жалоба пользователя, закрытый PR
// #237). Теперь сохранение автосохраняется (useAutosavedSelection), а эта
// шапка только закрывает и держит счётчик на виду весь скролл (правило
// «одна механика — один компонент»: механика одна и та же в обеих
// выбиралках).
export function PickerStickyHeader({
  title,
  hint,
  count,
  onDone,
}: {
  title: string;
  hint: string;
  count: number;
  onDone: () => void;
}) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 5,
        background: 'var(--sheet-bg)',
        paddingBottom: 10,
        marginBottom: 10,
        borderBottom: '1px solid var(--border-color)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 'var(--space-10)',
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
          {title}
        </div>
        <button
          onClick={onDone}
          style={{
            padding: '10px 18px',
            minHeight: 44,
            borderRadius: 'var(--r-14)',
            border: 'none',
            fontFamily: 'inherit',
            background:
              'linear-gradient(135deg, var(--accent), var(--accent-hi))',
            color: 'var(--text)',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          Готово{count > 0 ? ` (${count})` : ''}
        </button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 4 }}>
        {hint}
      </div>
    </div>
  );
}
