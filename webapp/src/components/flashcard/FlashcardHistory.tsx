// «История карточек» и просмотр сохранённой карточки «Мне плохо». Вид (редизайн 2026-11, b12):
// список — плотные строки со знаком режима слева (знак группы, как в «Моих паттернах»), заголовок
// «Режим · Потребность» и шаг Literata; подпись режима — из общего словаря (flashcardModeView), а не
// сырой id; пусто — знак Heart и строка. Просмотр — тот же вид, что итог «Сохранено»: бережный лист
// с датой и строками FlashcardRows.
import { FlashcardFrame } from './FlashcardFrame';
import { FlashcardRows } from './FlashcardRows';
import { flashcardSummary, flashcardTitle } from './flashcardLook';
import { EntitySheet } from '../paper/EntitySheet';
import { PaperEmpty } from '../art/PaperEmpty';
import { Heart } from '../art/PaperArtSigns';
import { SignArt } from '../art/SignArt';
import type { FlashcardEntry, ModeData, NeedData } from '../schemaFlashcard/types';
import { FLASHCARD_TITLE } from '../../../../shared/src/flashcard/flashcardNames';

interface ListProps {
  cards: FlashcardEntry[];
  modes: ModeData[];
  needs: NeedData[];
  onBack: () => void;
  onOpen: (c: FlashcardEntry) => void;
}

export function FlashcardHistoryList({ cards, modes, needs, onBack, onOpen }: ListProps) {
  return (
    <FlashcardFrame onBack={onBack} label="Назад"
      side={<EntitySheet look="sos" titleAs="h1" compact className="sk-fc-hist-head" label={FLASHCARD_TITLE} title="История карточек" />}>
      {cards.length === 0 ? (
        <PaperEmpty art={Heart}>Пока нет сохранённых карточек</PaperEmpty>
      ) : (
        <div className="sk-fc-hist-list">
          {cards.map(card => {
            const parts = flashcardSummary(card, modes, needs);
            return (
              <div key={card.id} onClick={() => onOpen(card)} role="button" tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(card); } }}
                className="ds-card ds-card--hover sk-fc-hist">
                <span className="sk-fc-hist-sign" aria-hidden="true">{parts.mode?.sign && <SignArt sign={parts.mode.sign} size="row" />}</span>
                <div className="sk-fc-hist-body">
                  <div className="ds-list-title">{flashcardTitle(parts)}</div>
                  {card.action && <div className="sk-fc-hist-action">{card.action}</div>}
                </div>
                <span className="sk-fc-hist-date">{card.date}</span>
              </div>
            );
          })}
        </div>
      )}
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
  const parts = flashcardSummary(card, modes, needs);
  return (
    <FlashcardFrame onBack={onBack} label="К истории">
      <article className="pp-paper sk-fc-card">
        <span className="sk-fc-card-sign" aria-hidden="true"><Heart size="row" /></span>
        <div className="ds-label sk-fc-date">{card.date}</div>
        <FlashcardRows parts={parts} reflection={card.reflection || undefined} action={card.action || undefined} />
      </article>
    </FlashcardFrame>
  );
}
