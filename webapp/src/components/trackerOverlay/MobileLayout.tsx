import { NeedScalePanel } from './NeedScalePanel';
import { NeedExamples } from './NeedExamples';
import { hueStyle, NEED_HUE } from '../../lib/tone';
import type { NeedId } from '../../../../shared/src/needs/types';
import type { LayoutProps } from './types';

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
        <div className="tk2-inner" style={hueStyle(hue)}>
          <p className="ds-sub tk2-intro">
            Пять базовых эмоциональных потребностей — из схема-терапии. Через 3–5 дней оценки показывают, что питает,
            а что истощает.
          </p>
          <div className="ds-head-row">
            <div className="ds-eyebrow tk2-sub tone-text">
              <span className="ds-dot tone-fill" />
              <span>{extra?.subtitle ?? ''}</span>
            </div>
            {steps}
          </div>
          <div>
            <button onClick={() => setDetailNeed(need)} className="tk2-name">
              {needName}
            </button>
            {extra?.desc && <p className="tk2-desc">{extra.desc}</p>}
          </div>
          <section className="ds-card">
            <div className="ds-label">вопрос дня</div>
            <p className="tk2-question">{extra?.question ?? ''}</p>
          </section>
          <section className="ds-card">
            <NeedScalePanel
              value={value}
              hue={hue}
              label={needName}
              yesterday={yesterday}
              delta={delta}
              onChange={(v) => handleChange(need.id, v)}
            />
          </section>
          <section className="ds-card">
            <div className="ds-label">что считается</div>
            <NeedExamples examples={extra?.examples ?? []} />
          </section>
        </div>
      </div>
      {footer}
      {detailSheet}
    </div>
  );
}
