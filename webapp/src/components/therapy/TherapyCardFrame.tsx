import type { ReactNode } from 'react';
import { ExternalLink } from '../../host/ExternalLink';
import { useTherapyBridgeTexts } from './useTherapyBridgeTexts';
import type { TherapyTarget } from './useTherapyTarget';
import '../../styles/therapy-bridge.css';

/** Общая разметка карточки моста: сигнальной (с «Не сейчас») и постоянной (`extra` не задан). */
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
      <p className="th-card-sub">{target.write ? t.cardSubTherapist : t.cardSubAuthor}</p>
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
