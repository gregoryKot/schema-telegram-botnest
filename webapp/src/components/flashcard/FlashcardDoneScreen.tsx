import { FlashcardFrame } from './FlashcardFrame';
import { FlashcardRows } from './FlashcardRows';
import type { FlashcardSummaryParts } from './flashcardLook';
import { DoneSheet } from '../paper/DoneSheet';
import { PaperAlert } from '../paper/PaperAlert';
import { FLASHCARD_TITLE } from '../../../../shared/src/flashcard/flashcardNames';
import { glue } from '../../../../shared/src/utils/typo';

// Экран «Сохранено» карточки схемы. Вынесен из SchemaFlashcard.tsx (файл
// сверх потолка 300, правило №10) вместе с оговоркой про несинхронизированную
// карточку: локальная копия честно существует, но серверной нет — раньше
// экран говорил «Сохранено» без оговорок и при упавшем createFlashcard.
// Вид (редизайн 2026-11, b12): общий лист «готово» (DoneSheet) — бережная роза и сцена «готово»
// «Мне плохо» (Sprout с Heart); режим и потребность — строками со знаками (FlashcardRows, те же,
// что в просмотре из истории); «Готово» — залитая, «Ещё одну» и «Открыть трекер» — тихие ссылки;
// оговорка про сервер — наклейкой соломы (PaperAlert) с нейтральной чашкой исхода «подожди», а не
// красным абзацем по центру и не вторым сердцем под сценой с сердцем (ревью g4 r2).
interface Props {
  parts: FlashcardSummaryParts;
  action: string;
  syncFailed: boolean;
  onOpenTracker?: () => void;
  goBack: () => void;
  handleNew: () => void;
  tr: (ty: string, vy: string) => string;
}

export function FlashcardDoneScreen({ parts, action, syncFailed, onOpenTracker, goBack, handleNew, tr }: Props) {
  return (
    <FlashcardFrame onBack={goBack} label="Закрыть">
      <DoneSheet
        entity="sos"
        titleAs="h1"
        label={FLASHCARD_TITLE}
        title="Сохранено"
        sub={tr('Это твой шаг навстречу себе. Уже немало.', 'Это ваш шаг навстречу себе. Уже немало.')}
        primary={{ label: 'Готово', onClick: goBack }}
        secondary={{ label: 'Ещё одну', onClick: handleNew }}
      >
        {syncFailed && (
          <PaperAlert sign="sheets" className="sk-fc-alert"
            title={glue('Карточка осталась только на этом устройстве — до сервера не доехала.')}
            text={glue('На других устройствах и у терапевта её не будет.')} />
        )}
        <FlashcardRows parts={parts} action={action || undefined} />
      </DoneSheet>
      {onOpenTracker && (
        <button onClick={() => { goBack(); setTimeout(onOpenTracker, 100); }} className="ds-link pa-quiet">
          Открыть трекер →
        </button>
      )}
    </FlashcardFrame>
  );
}
