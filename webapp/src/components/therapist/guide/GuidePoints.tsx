import type { ReactNode } from 'react';
import { useSectionMark } from './marks/GuideSectionMark';
import { FoldText } from './GuideText';
import { GuideCard } from './GuideCard';
// Детали листа подсказок (GuideSheet.tsx, стили — therapist-guide.css): реплики «Как это звучит» и списки пунктов.

/** «Как это звучит»: реплики терапевта на бумаге листа (группы, домена); кавычки ставит лист, в данных их нет. */
export function GuideVoice({ lines = [], address }: { lines?: string[]; address?: string }) {
  const mark = useSectionMark(address);
  const said = lines.filter((l) => l.trim());
  if (said.length === 0) return null;
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events -- с клавиатуры подсвечивает подпись-кнопка
    <section aria-label="Как это звучит" className={`pp-paper gd-voice${mark?.className ?? ''}`} data-address={mark && address} onClick={mark?.onTap}>
      <h3 className="ds-label gd-label">{mark ? mark.title('Как это звучит') : 'Как это звучит'}</h3>
      {said.map((line, i) => <blockquote key={i} className="gd-voice-line">«{line}»</blockquote>)}
      {mark?.controls}
    </section>
  );
}

/** Пункт списка: строка или канал работы — карточка с подписью (GuideCard); с адресом канал отмечается «Про клиента». */
export type GuidePoint = string | { lead: string; text: string; action?: ReactNode; address?: string };

/** Шаги (`ordered`: номер Literata слева), пункты (тихая точка; длинный свёрнут до первой фразы) или карточки каналов. */
export function GuidePoints({ items, ordered }: { items: GuidePoint[]; ordered?: boolean }) {
  if (items.some((i) => typeof i !== 'string')) {
    return (
      <ul className="gd-cards">
        {items.map((item, i) => (typeof item === 'string'
          ? <GuideCard key={i} title="" text={item} />
          : <GuideCard key={i} title={item.lead} text={item.text} action={item.action} address={item.address} />))}
      </ul>
    );
  }
  const List = ordered ? 'ol' : 'ul';
  return (
    <List className={ordered ? 'gd-steps' : 'gd-points'}>
      {items.map((item, i) => <li key={i}><FoldText text={item as string} /></li>)}
    </List>
  );
}
