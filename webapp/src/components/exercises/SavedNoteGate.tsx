// Опросник карточки схемы/режима монтируется только с уже написанным: вход
// без initialData («Познакомиться →», «Практика», «Сегодня», задачи
// терапевта) открывал пустую форму, и сохранение стирало карточку
// (docs/INCIDENTS.md, 2026-10-31). Пока заметка грузится — силуэт опросника.
import type { ReactNode } from 'react';
import { api } from '../../api';
import { Skeleton } from '../Skeleton';
import { PaperAlert } from '../paper/PaperAlert';
import { useSavedNoteValues } from '../../../../shared/src/notes/useSavedNoteValues';
import type { MyCardsKind } from '../../../../shared/src/pattern/useMyCards';

// Силуэт по форме вопросов (CardQuestions): полоски, «Вопрос N из M», вопрос, поле, кнопка «Дальше».
function FlashcardSkeleton() {
  return (
    <div className="ex2-skel" aria-busy="true" aria-label="Загружаю карточку">
      <Skeleton height={5} radius={3} />
      <Skeleton width={140} height={12} />
      <Skeleton width="78%" height={28} />
      <Skeleton height={132} radius={14} />
      <Skeleton width={160} height={44} radius={22} style={{ marginLeft: 'auto' }} />
    </div>
  );
}

export function SavedNoteGate({ kind, id, preset, children }: {
  kind: MyCardsKind;
  id: string;
  /** Значения от вызывающего (экран паттерна, правка после «готово») — тогда без запроса. */
  preset?: Record<string, string>;
  children: (initial: Record<string, string> | undefined) => ReactNode;
}) {
  const saved = useSavedNoteValues(kind, id, api, preset);
  if (saved.loading) return <FlashcardSkeleton />;
  return (<>
    {saved.failed && <PaperAlert className="ex2-gate-alert" sign={kind === 'schema' ? 'layers' : 'cluster'} title="Не получилось загрузить уже написанное в карточке." text="Оно не пропало: пустые поля его не сотрут." />}
    {children(saved.values)}
  </>);
}
