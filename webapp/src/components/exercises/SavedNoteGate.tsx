// Опросник карточки схемы/режима монтируется только с уже написанным: вход
// без initialData («Познакомиться →», «Практика», «Сегодня», задачи
// терапевта) открывал пустую форму, и сохранение стирало карточку
// (docs/INCIDENTS.md, 2026-10-31). Пока заметка грузится — силуэт опросника.
import type { ReactNode } from 'react';
import { api } from '../../api';
import { Skeleton, SkeletonCard } from '../Skeleton';
import { useSavedNoteValues } from '../../../../shared/src/notes/useSavedNoteValues';
import type { MyCardsKind } from '../../../../shared/src/pattern/useMyCards';

// Силуэт опросника: тики вопросов, карточка вопроса, кнопка «Дальше».
function FlashcardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Загружаю карточку">
      <Skeleton height={6} radius={3} style={{ marginBottom: 'var(--space-12)' }} />
      <SkeletonCard height={280} />
      <Skeleton width={180} height={44} radius={22} style={{ marginTop: 'var(--space-12)', marginLeft: 'auto' }} />
    </div>
  );
}

export function SavedNoteGate({ kind, id, preset, children }: {
  kind: MyCardsKind;
  id: string;
  /** Значения от вызывающего (экран паттерна) — тогда без запроса. */
  preset?: Record<string, string>;
  children: (initial: Record<string, string> | undefined) => ReactNode;
}) {
  const saved = useSavedNoteValues(kind, id, api, preset);
  if (saved.loading) return <FlashcardSkeleton />;
  return (<>
    {saved.failed && (
      <p role="alert" className="ex2-fine">
        Не получилось загрузить уже написанное в карточке. Оно не пропало: пустые поля его не сотрут.
      </p>
    )}
    {children(saved.values)}
  </>);
}
