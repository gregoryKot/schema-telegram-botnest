import type { CSSProperties, ReactNode } from 'react';
import { ExternalLink } from '../../host/ExternalLink';
import { useTherapyBridgeTexts } from './useTherapyBridgeTexts';
import type { TherapyTarget } from './useTherapyTarget';
import { glue } from '../../../../shared/src/utils/typo';
import { glueBridge } from './bridgeTypo';
import type { PaperHue } from '../../../../shared/src/theme/entityLook';
import '../../styles/therapy-bridge.css';
/** Общая разметка карточки моста: сигнальной («Не сейчас») и постоянной («Скрыть») — вторая кнопка в `extra`; заголовок — glue.
 *  Заметка между линиями (pp-block--note, #1674): оттенок — только у знака справа (шалфей спокойной, персик сигнальной).
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
  /** Оттенок знака: шалфей у спокойной, персик у сигнальной. */
  hue: PaperHue;
  /** Знак сущности (TherapyCardSign). */
  sign: ReactNode;
  /** Главная кнопка — белой капсулой: на экране уже есть залитая («Практики» — «Начать дыхание»). */
  quiet?: boolean;
}) {
  const btn = quiet ? 'ds-btn ds-btn--secondary th-btn' : 'ds-btn th-btn';
  const t = useTherapyBridgeTexts();
  const sub = cardSub(t, target);
  return (
    <section className="pp-block pp-block--note th-card" aria-label={t.cardTalk} style={{ '--h': hue } as CSSProperties}>
      <div className="pp-block-head">
        <div className="ds-eyebrow">{glue(eyebrow)}</div>
        <span className="pp-block-sign" aria-hidden="true">{sign}</span>
      </div>
      <h2 className="pp-block-title">{glueBridge(title)}</h2>
      {sub && <p className="pp-block-text">{glue(sub)}</p>}
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

type Texts = ReturnType<typeof useTherapyBridgeTexts>;
/** Свой терапевт: с каналом — повод написать, без канала — про ближайшую встречу (волна 6); нет терапевта — без строки. */
function cardSub(t: Texts, target: TherapyTarget): string | null {
  return target.write ? t.cardSubTherapist : target.connected ? t.cardSubTherapistNoChannel : null;
}

/** Силуэт загрузки той же разметкой, что спокойная карточка: заголовок и строка мерцают по своей форме, остальное
 *  невидимо — высота совпадает и со строкой про своего терапевта (список под карточкой не прыгает). */
export function TherapyCardSkeleton({ target }: { target: TherapyTarget }) {
  const t = useTherapyBridgeTexts();
  const sub = cardSub(t, target);
  return (
    <div className="pp-block pp-block--note th-card th-card--skel" aria-hidden="true" data-testid="therapy-card-skeleton">
      <div className="pp-block-head"><div className="ds-eyebrow">{t.cardEyebrowCalm}</div></div>
      <div className="pp-block-title skel">{glueBridge(t.cardTitleCalm)}</div>
      {sub && <p className="pp-block-text skel">{glue(sub)}</p>}
      <div className="th-card-acts"><span className="ds-btn th-btn">{target.write ? t.cardWrite : t.cardTalk}</span></div>
    </div>
  );
}
