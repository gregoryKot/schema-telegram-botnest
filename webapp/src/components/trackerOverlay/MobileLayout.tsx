import { MobileScale } from './MobileScale';
import { NeedExamples } from './NeedExamples';
import { hueStyle, NEED_HUE } from '../../lib/tone';
import type { NeedId } from '../../../../shared/src/needs/types';
import type { LayoutProps } from './types';
import '../../styles/sheet-tracker-mobile.css';
/** Трекер на телефоне: шкала и «Далее» в первом экране; вопрос дня и примеры — ниже шкалы. */
export function MobileLayout({
  need,
  value,
  needName,
  extra,
  handleChange,
  setDetailNeed,
  yesterday,
  delta,
  onTS,
  onTE,
  topbar,
  onboarding,
  footer,
  steps,
  detailSheet,
}: LayoutProps & {
  onTS: (e: React.TouchEvent) => void;
  onTE: (e: React.TouchEvent) => void;
}) {
  const hue = NEED_HUE[need.id as NeedId];
  return (
    <div className="tk2-overlay" onTouchStart={onTS} onTouchEnd={onTE}>
      {topbar}
      <div className="tk2-body">
        <div className="tkm-inner" style={hueStyle(hue)}>
          {onboarding}
          <p className="tkm-intro">
            Пять базовых эмоциональных потребностей — из схема-терапии. Через 3–5 дней оценки показывают, что питает,
            а что истощает.
          </p>
          <div className="tkm-head">
            {steps}
            <button type="button" onClick={() => setDetailNeed(need)} className="tkm-pill">
              <span className="tkm-pill-name">{needName}</span>
              <span className="tkm-pill-i" aria-hidden="true">ⓘ</span>
            </button>
            <div className="tkm-sub tone-text">
              <span className="ds-dot tone-fill" />
              <span>{extra?.subtitle ?? ''}</span>
            </div>
            {extra?.desc && <p className="tkm-desc">{extra.desc}</p>}
          </div>
          <MobileScale
            value={value}
            hue={hue}
            label={needName}
            yesterday={yesterday}
            delta={delta}
            onChange={(v) => handleChange(need.id, v)}
          />
          <section className="tkm-q">
            <div className="ds-label">вопрос дня</div>
            <p className="tk2-question tkm-q-text">{extra?.question ?? ''}</p>
          </section>
          <details className="tkm-ex">
            <summary>Что считается</summary>
            <NeedExamples examples={extra?.examples ?? []} />
          </details>
        </div>
      </div>
      {footer}
      {detailSheet}
    </div>
  );
}
