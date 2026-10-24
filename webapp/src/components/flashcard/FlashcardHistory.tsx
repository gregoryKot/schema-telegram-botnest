import { FlashcardFrame } from './FlashcardFrame';
import type { FlashcardEntry, ModeData, NeedData } from '../schemaFlashcard/types';

interface ListProps {
  cards: FlashcardEntry[];
  modes: ModeData[];
  needs: NeedData[];
  onBack: () => void;
  onOpen: (c: FlashcardEntry) => void;
}

export function FlashcardHistoryList({ cards, modes, needs, onBack, onOpen }: ListProps) {
  return (
    <FlashcardFrame onBack={onBack} label="Назад">
      <h1 className="ds-h1 sk-fc-h1-sm">История карточек</h1>
      {cards.length === 0 ? (
        <div className="ds-sub sk-fc-empty">Пока нет сохранённых карточек</div>
      ) : cards.map(card => {
        const m = modes.find(x => x.id === card.mode);
        const n = needs.find(x => x.id === card.needId);
        return (
          <div key={card.id} onClick={() => onOpen(card)} role="button" tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(card); } }}
            className="ds-card ds-card--row ds-card--hover sk-fc-hist">
            <div className="ds-label">{card.date}</div>
            <div className="ds-h3 sk-fc-hist-title">
              {m?.label ?? card.mode}
              {n ? ` · ${n.label}` : ''}
            </div>
            {card.action && <div className="sk-fc-hist-action">→ {card.action}</div>}
          </div>
        );
      })}
    </FlashcardFrame>
  );
}

interface ViewProps {
  card: FlashcardEntry;
  modes: ModeData[];
  needs: NeedData[];
  onBack: () => void;
}

export function FlashcardView({ card, modes, needs, onBack }: ViewProps) {
  const modeInfo = modes.find(m => m.id === card.mode);
  const needInfo = needs.find(n => n.id === card.needId);
  const rows = [
    { label: 'Режим', value: modeInfo?.label ?? card.mode },
    card.reflection ? { label: 'Рефлексия', value: card.reflection } : null,
    needInfo ? { label: 'Потребность', value: needInfo.label } : null,
    card.action ? { label: 'Шаг', value: card.action } : null,
  ].filter((r): r is { label: string; value: string } => r !== null);
  return (
    <FlashcardFrame onBack={onBack} label="К истории">
      <div className="ds-label sk-fc-date">{card.date}</div>
      <div className="ds-card sk-fc-rows">
        {rows.map((row, i) => (
          <div key={row.label} className="sk-fc-row">
            <div className="ds-eyebrow">{row.label}</div>
            <div className={i === 0 ? 'ds-h3' : 'sk-fc-value'}>{row.value}</div>
          </div>
        ))}
      </div>
    </FlashcardFrame>
  );
}
