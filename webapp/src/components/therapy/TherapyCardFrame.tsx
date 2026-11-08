import type { ReactNode } from 'react';
import { ExternalLink } from '../../host/ExternalLink';
import { useTherapyBridgeTexts } from './useTherapyBridgeTexts';
import type { TherapyTarget } from './useTherapyTarget';
import '../../styles/therapy-bridge.css';

/** Общая разметка карточки моста: сигнальной («Не сейчас») и постоянной («Скрыть») — вторая кнопка в `extra`.
 *  Без своего терапевта под заголовком только кнопка: кто ведёт встречи, говорит лист (2026-11-08). */
export function TherapyCardFrame({
  eyebrow,
  title,
  target,
  extra,
}: {
  eyebrow: string;
  title: string;
  target: TherapyTarget;
  extra?: ReactNode;
}) {
  const t = useTherapyBridgeTexts();
  return (
    <section className="th-card" aria-label={t.cardTalk}>
      <div className="ds-eyebrow">{eyebrow}</div>
      <h2 className="th-card-title">{title}</h2>
      {target.write && <p className="th-card-sub">{t.cardSubTherapist}</p>}
      <div className="th-card-acts">
        {target.write ? (
          <ExternalLink className="ds-btn th-btn" href={target.write.url} onClick={target.write.onClick}>
            {t.cardWrite}
          </ExternalLink>
        ) : (
          <button type="button" className="ds-btn th-btn" onClick={target.open}>
            {t.cardTalk}
          </button>
        )}
        {extra}
      </div>
      {target.sheet}
    </section>
  );
}
