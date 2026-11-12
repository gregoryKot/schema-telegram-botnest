import type { CSSProperties, ReactNode } from 'react';
import { ExternalLink } from '../../host/ExternalLink';
import { useTherapyBridgeTexts } from './useTherapyBridgeTexts';
import type { TherapyTarget } from './useTherapyTarget';
import { glue } from '../../../../shared/src/utils/typo';
import { glueBridge } from './bridgeTypo';
import type { PaperHue } from '../../../../shared/src/theme/entityLook';
import '../../styles/therapy-bridge.css';
/** Общая разметка карточки моста: сигнальной («Не сейчас») и постоянной («Скрыть») — вторая кнопка в `extra`; заголовок — glue.
 *  Лист бумаги без контура и полосы (b24): спокойная — шалфей, по сигналу — персик; знак — справа от надзаголовка.
 *  Без своего терапевта под заголовком только кнопка: кто ведёт встречи, говорит лист (2026-11-08). */
export function TherapyCardFrame({
  eyebrow,
  title,
  target,
  extra,
  hue,
  sign,
  quiet,
}: {
  eyebrow: string;
  title: string;
  target: TherapyTarget;
  extra?: ReactNode;
  /** Бумага листа: шалфей у спокойной, персик у сигнальной. */
  hue: PaperHue;
  /** Знак сущности (TherapyCardSign). */
  sign: ReactNode;
  /** Главная кнопка — белой капсулой: на экране уже есть залитая («Практики» — «Начать дыхание»). */
  quiet?: boolean;
}) {
  const btn = quiet ? 'ds-btn ds-btn--secondary th-btn' : 'ds-btn th-btn';
  const t = useTherapyBridgeTexts();
  return (
    <section className="pp-paper th-card" aria-label={t.cardTalk} style={{ '--h': hue } as CSSProperties}>
      <div className="th-card-head">
        <div className="ds-eyebrow">{glue(eyebrow)}</div>
        <span className="th-card-sign" aria-hidden="true">{sign}</span>
      </div>
      <h2 className="th-card-title">{glueBridge(title)}</h2>
      {/* Свой терапевт: с каналом — повод написать, без канала — про ближайшую встречу (волна 6). */}
      {target.write ? <p className="th-card-sub">{glue(t.cardSubTherapist)}</p>
        : target.connected ? <p className="th-card-sub">{glue(t.cardSubTherapistNoChannel)}</p> : null}
      <div className="th-card-acts">
        {target.write ? (
          <ExternalLink className={btn} href={target.write.url} onClick={target.write.onClick}>
            {t.cardWrite}
          </ExternalLink>
        ) : (
          <button type="button" className={btn} onClick={target.open}>
            {target.connected ? t.sheetNextMeeting : t.cardTalk}
          </button>
        )}
        {extra}
      </div>
      {target.sheet}
    </section>
  );
}
