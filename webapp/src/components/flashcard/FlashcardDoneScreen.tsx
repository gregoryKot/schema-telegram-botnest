import { FlashcardFrame } from './FlashcardFrame';

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
  const rows = [
    { label: 'Режим', value: modeLabel },
    needLabel ? { label: 'Потребность', value: needLabel } : null,
    action ? { label: 'Шаг', value: action } : null,
  ].filter((r): r is { label: string; value: string | undefined } => r !== null);
  return (
    <FlashcardFrame onBack={goBack} label="Закрыть" center>
      <h1 className="ds-h1 sk-fc-hero">Сохранено</h1>
      <p className="sk-fc-lead">
        {tr('Это твой шаг навстречу себе. Уже немало.', 'Это ваш шаг навстречу себе. Уже немало.')}
      </p>
      {syncFailed && (
        <div role="alert" className="sk-error">
          Карточка осталась только на этом устройстве — до сервера не доехала. На других устройствах и у терапевта её не будет.
        </div>
      )}
      <div className="ds-card sk-fc-rows">
        {rows.map((row, i) => (
          <div key={row.label} className="sk-fc-row">
            <div className="ds-eyebrow">{row.label}</div>
            <div className={i === 0 ? 'ds-h3' : 'sk-fc-value'}>{row.value}</div>
          </div>
        ))}
      </div>
      {onOpenTracker && (
        <button onClick={() => { goBack(); setTimeout(onOpenTracker, 100); }} className="ds-btn ds-btn--secondary sk-fc-wide">
          Открыть трекер →
        </button>
      )}
      <div className="sk-fc-pair">
        <button onClick={handleNew} className="ds-btn ds-btn--secondary">Ещё одну</button>
        <button onClick={goBack} className="ds-btn">Готово</button>
      </div>
    </FlashcardFrame>
  );
}
