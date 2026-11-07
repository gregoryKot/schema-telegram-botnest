// «журнал →» (#995) за строкой «делали …» у техники: на плашке «Обычно в
// методе», в листе режима или схемы и в листе техники. Ведёт в журнал техник
// карточки клиента — блок «На сессиях» вкладки «Задания»; переход даёт сайт
// (ConceptGuideActions.onOpenJournal), без него ссылки нет. Одна кнопка на
// все три места: слово с зоной нажатия 44 по высоте (wordBtn).
import type { CSSProperties } from 'react';
import { wordBtn } from './graphStyles';

const style: CSSProperties = { ...wordBtn, color: 'var(--text-sub)' };

/** Имя кнопки для ридера и тестов: куда она ведёт. */
export const JOURNAL_LINK_LABEL = 'Журнал техник во вкладке «Задания»';

export function JournalLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      style={style}
      aria-label={JOURNAL_LINK_LABEL}
      onClick={onClick}
    >
      журнал →
    </button>
  );
}
