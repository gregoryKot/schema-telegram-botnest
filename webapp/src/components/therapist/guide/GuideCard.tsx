import { useState, type ReactNode } from 'react';
import { useSectionMark } from './marks/GuideSectionMark';
import { CiteTail } from './GuideText';
import { foldFirstSentence, liftCites } from './guideTextModel';

/**
 * Карточка канала работы или задания: заголовок и первая фраза; длинный текст раскрывается тапом по заголовку на
 * месте, раскрытая карточка с адресом сразу подсвечена для «Про клиента». `action` — «+ В план» в строке заголовка,
 * `footer` — история и «Дать заданием» под текстом.
 */
export function GuideCard({ title, text = '', action, address, footer }: {
  title: string; text?: string; action?: ReactNode; address?: string; footer?: ReactNode;
}) {
  const mark = useSectionMark(address);
  const [open, setOpen] = useState(false);
  const { text: clean, cites } = liftCites(text);
  const fold = foldFirstSentence(clean);
  const toggle = () => { setOpen(!open); mark?.pick(!open); };
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events -- с клавиатуры подсвечивает подпись-кнопка
    <li className={`gd-card${mark?.className ?? ''}`} data-address={mark && address} onClick={mark?.onTap}>
      <div className="gd-card-head">
        {fold ? (
          <button type="button" className="gd-card-toggle" aria-expanded={open} onClick={toggle}>
            <span className="gd-card-title">{title}</span><span className="ds-chev" aria-hidden="true" />
          </button>
        ) : <span className="gd-card-title">{mark ? mark.title(title) : title}</span>}
        {action}
      </div>
      {clean.trim() && (
        <p className="gd-card-text">{fold && !open ? fold.head : clean}{(!fold || open) && <CiteTail cites={cites} />}</p>
      )}
      {footer}
      {mark?.controls}
    </li>
  );
}
