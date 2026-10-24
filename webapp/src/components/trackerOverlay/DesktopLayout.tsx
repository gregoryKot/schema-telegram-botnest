import { NeedScalePanel } from './NeedScalePanel';
import { NeedExamples } from './NeedExamples';
import { hueStyle, NEED_HUE } from '../../lib/tone';
import type { NeedId } from '../../../../shared/src/needs/types';
import type { LayoutProps } from './types';

export function DesktopLayout({
  need,
  value,
  needName,
  extra,
  idx,
  needsLength,
  handleChange,
  setDetailNeed,
  yesterday,
  delta,
  topbar,
  footer,
  steps,
  detailSheet,
}: LayoutProps) {
  const hue = NEED_HUE[need.id as NeedId];
  return (
    <div className="tk2-overlay">
      {topbar}
      <div className="tk2-body">
        <div className="tk2-inner" style={hueStyle(hue)}>
          <div className="tk2-head">
            <div className="tk2-head-main">
              <p className="ds-sub tk2-intro">
                Пять базовых эмоциональных потребностей — из схема-терапии. Через 3–5 дней оценки показывают, что
                питает, а что истощает.
              </p>
              <div className="ds-eyebrow tk2-sub tone-text">
                <span className="tk2-count">
                  {String(idx + 1).padStart(2, '0')} / {String(needsLength).padStart(2, '0')}
                </span>
                <span className="ds-dot tone-fill" />
                <span>{extra?.subtitle ?? ''}</span>
              </div>
              <button onClick={() => setDetailNeed(need)} className="tk2-name">
                {needName}
              </button>
              {extra?.desc && <p className="tk2-desc">{extra.desc}</p>}
            </div>
            {steps}
          </div>
          <div className="tk2-cols tk2-cols--3">
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
      </div>
      {footer}
      {detailSheet}
    </div>
  );
}
