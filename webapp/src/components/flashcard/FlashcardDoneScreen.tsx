import { Topbar } from '../SchemaFlashcardTopbar';

// Экран «Сохранено» карточки схемы. Вынесен из SchemaFlashcard.tsx (файл
// сверх потолка 300, правило №10) вместе с оговоркой про несинхронизированную
// карточку: локальная копия честно существует, но серверной нет — раньше
// экран говорил «Сохранено» без оговорок и при упавшем createFlashcard.
interface Props {
  modeLabel?: string;
  needLabel?: string;
  action: string;
  syncFailed: boolean;
  onOpenTracker?: () => void;
  goBack: () => void;
  handleNew: () => void;
  tr: (ty: string, vy: string) => string;
}

export function FlashcardDoneScreen({ modeLabel, needLabel, action, syncFailed, onOpenTracker, goBack, handleNew, tr }: Props) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'var(--bg)', display: 'grid', gridTemplateRows: 'auto 1fr', overflow: 'hidden' }}>
      <Topbar onBack={goBack} label="Закрыть" />
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '60px 24px 80px', textAlign: 'center', overflowY: 'auto' }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 36, fontWeight: 400, color: 'var(--text)', marginBottom: 32 }}>Сохранено</h1>
        <p style={{ fontSize: 15, color: 'var(--text-sub)', lineHeight: 1.65, marginBottom: 40 }}>
          {tr('Это твой шаг навстречу себе. Уже немало.', 'Это ваш шаг навстречу себе. Уже немало.')}
        </p>
        {syncFailed && (
          <div role="alert" style={{ fontSize: 13, color: 'var(--c-rose)', lineHeight: 1.5, marginBottom: 24 }}>
            Карточка осталась только на этом устройстве — до сервера не доехала. На других устройствах и у терапевта её не будет.
          </div>
        )}
        <div style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: 'var(--r-20)', padding: '24px', marginBottom: 32, textAlign: 'left' }}>
          {[
            { label: 'Режим',       value: modeLabel },
            needLabel ? { label: 'Потребность', value: needLabel } : null,
            action    ? { label: 'Шаг',         value: action } : null,
          ].filter(Boolean).map((row, i, arr) => row && (
            <div key={row.label} style={{
              paddingBottom: i < arr.length - 1 ? 16 : 0,
              marginBottom: i < arr.length - 1 ? 16 : 0,
              borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : undefined,
            }}>
              <div className="eyebrow" style={{ marginBottom: 6 }}>{row.label}</div>
              <div style={{ fontFamily: i === 0 ? 'var(--serif)' : 'inherit', fontSize: i === 0 ? 20 : 15, color: 'var(--text)', lineHeight: 1.5 }}>{row.value}</div>
            </div>
          ))}
        </div>
        {onOpenTracker && (
          <button onClick={() => { goBack(); setTimeout(onOpenTracker, 100); }} className="ex-btn ex-btn-outline" style={{ width: '100%', marginBottom: 12 }}>
            Открыть трекер →
          </button>
        )}
        <div style={{ display: 'flex', gap: 'var(--space-10)' }}>
          <button onClick={handleNew} className="ex-btn ex-btn-ghost" style={{ flex: 1 }}>Ещё одну</button>
          <button onClick={goBack} className="ex-btn ex-btn-primary" style={{ flex: 1 }}>Готово</button>
        </div>
      </div>
    </div>
  );
}
