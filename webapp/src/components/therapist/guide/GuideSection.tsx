import type { ReactNode } from 'react';
import { useSectionMark } from './marks/GuideSectionMark';
import { Cited } from './GuideText';

/**
 * Раздел листа справочника: подпись и содержимое; пустой не рисуется (у режима бывают не все каналы). С адресом тап
 * подсвечивает раздел и даёт «Про клиента» (#1484); листы рисуют разделы только так (guideSectionOnly.test.ts).
 */
export function GuideSection({ title, text, action, address, children }: {
  title: string; text?: string; action?: ReactNode; address?: string; children?: ReactNode;
}) {
  const mark = useSectionMark(address);
  if (!children && !text?.trim()) return null;
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events -- с клавиатуры подсвечивает подпись-кнопка
    <section aria-label={title} className={`gd-section${mark?.className ?? ''}`} data-address={mark && address} onClick={mark?.onTap}>
      <div className="gd-head"><h3 className="ds-label gd-label">{mark ? mark.title(title) : title}</h3>{action}</div>
      {text?.trim() ? <p className="gd-text"><Cited text={text} /></p> : null}
      {children}
      {mark?.controls}
    </section>
  );
}
