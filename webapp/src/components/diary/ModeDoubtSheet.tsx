import type { CSSProperties } from 'react';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { GlyphArrowLeft } from '../exercises/ExScreen';
import { SignArt } from '../art/SignArt';
import '../../styles/sheet-diary.css';
import { haptic } from '../../haptic';
import { api } from '../../api';
import { getModeById } from '../../schemaTherapyData';
import { modeLookById as lookOf } from './modeLookById';
import { getDoubtsForMode } from '../../../../shared/src/mode/modeDoubts';
import { getModeLeafLabel } from '../../../../shared/src/mode/modeFeelGates';
import { MODE_DOUBT_SWITCHED_EVENT } from '../../../../shared/src/share/analytics';

const paper = (hue: number) => ({ '--h': hue }) as CSSProperties;

/**
 * Лист «Сомневаешься? Сравни с похожими» (открывает ModeDoubtButton): якорь выбранного режима и
 * соседи по путанице (shared/mode/modeDoubts). Лист — fixed-оверлей, поэтому useHistorySheet.
 * Редизайн 2026-11: якорь — бумага группы выбранного режима с его знаком; сосед — бумага своей
 * группы и её знак у заголовка (не цветная точка), «Проверить» — белой вставкой, «Это ближе» —
 * второстепенной кнопкой, «Оставляю: …» — залитой, липнет к низу листа. Заголовок карточки —
 * живая фраза соседа (getModeLeafLabel), термин — пометкой «→ имя». «Это ближе» переключает
 * выбор через onSwitch и закрывает лист.
 */
export function ModeDoubtSheet({ modeId, onSwitch, onClose }: {
  modeId: string;
  onSwitch: (id: string) => void;
  onClose: () => void;
}) {
  const goBack = useHistorySheet(onClose);
  const mode = getModeById(modeId);
  const now = lookOf(modeId);
  const doubts = getDoubtsForMode(modeId);

  return (
    <div className="ex-screen">
      <div className="ds-sheet-head sd-top">
        <button type="button" className="ds-back" onClick={goBack}>
          <GlyphArrowLeft /> Назад
        </button>
      </div>
      <div className="page">
        <div className="sd-doubt">
          <div className="pp-paper sd-doubt-now" style={paper(now.hue)}>
            <div className="sd-doubt-now-text">
              <div className="sd-doubt-now-name">{mode?.name ?? ''}</div>
              <div className="ds-label sd-doubt-now-label">сейчас выбран</div>
            </div>
            <span className="sd-doubt-now-sign" aria-hidden="true"><SignArt sign={now.sign} size="square" /></span>
          </div>
          <p className="sd-doubt-lede">
            Вот с чем его чаще всего путают — и как отличить.
          </p>
          <div className="sd-doubt-list">
            {doubts.map((d) => {
              const other = getModeById(d.otherId);
              const look = lookOf(d.otherId);
              return (
                <section key={d.otherId} className="pp-paper sd-doubt-card" style={paper(look.hue)}>
                  <div className="sd-doubt-head">
                    <span className="sd-doubt-sign" aria-hidden="true"><SignArt sign={look.sign} size="row" /></span>
                    <div className="sd-doubt-head-text">
                      <h3 className="sd-doubt-title">{getModeLeafLabel(d.otherId) ?? other?.name ?? d.otherId}</h3>
                      <div className="sd-doubt-mode">→ {other?.name ?? d.otherId}</div>
                    </div>
                  </div>
                  <p className="sd-doubt-gist">{d.gist}</p>
                  <div className="sd-doubt-check">Проверить: {d.check}</div>
                  <button
                    type="button"
                    className="ds-btn ds-btn--secondary sd-doubt-btn"
                    onClick={() => {
                      haptic.select();
                      api.trackEvent(MODE_DOUBT_SWITCHED_EVENT, { from: modeId, to: d.otherId });
                      onSwitch(d.otherId);
                      goBack();
                    }}
                  >
                    Это ближе
                  </button>
                </section>
              );
            })}
          </div>

          <div className="sd-doubt-keep">
            <button
              type="button"
              className="ds-btn sd-doubt-keep-btn"
              onClick={() => {
                haptic.tap();
                goBack();
              }}
            >
              Оставляю: {mode?.name ?? ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
