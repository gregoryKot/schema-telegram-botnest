import { useState } from 'react';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { GlyphArrowLeft } from '../exercises/ExScreen';
import { DIARY_HUE, hueStyle } from '../../lib/tone';
import '../../styles/sheet-diary.css';
import { haptic } from '../../haptic';
import { api } from '../../api';
import { useTr } from '../../utils/addressForm';
import { getModeById } from '../../schemaTherapyData';
import { IdentityDot } from '../../../../shared/src/components/IdentityDot';
import { getDoubtsForMode } from '../../../../shared/src/mode/modeDoubts';
import { getModeLeafLabel } from '../../../../shared/src/mode/modeFeelGates';
import {
  MODE_DOUBT_OPENED_EVENT,
  MODE_DOUBT_SWITCHED_EVENT,
} from '../../../../shared/src/share/analytics';

/**
 * «Сомневаешься? Сравни с похожими» — на карточке выбранного режима
 * (ModeEntryForm, аside рядом со «Сменить режим»): кнопка + полноэкранный
 * лист сравнения с соседями по путанице (shared/mode/modeDoubts). Лист —
 * fixed-оверлей, поэтому обязателен useHistorySheet (CLAUDE.md). «Это ближе»
 * переключает выбор через onSwitch и закрывает лист (goBack). Пустой список
 * пар (быть не может — покрыто тестом реестра) — кнопка не рендерится.
 *
 * Обновление 2026-08-04: заголовки карточек-пар больше не клинический
 * термин напрямую — сперва живая формулировка из getModeLeafLabel, а
 * исходное название остаётся мелким подзаголовком. Наверху добавлена
 * карточка-якорь текущего выбора, внизу — кнопка подтверждения. Парный файл:
 * schema-miniapp/ModeDoubtButton (правило №3 CLAUDE.md).
 */
export function ModeDoubtButton({
  modeId,
  onSwitch,
}: {
  modeId: string;
  onSwitch: (id: string) => void;
}) {
  const tr = useTr();
  const [open, setOpen] = useState(false);
  const doubts = getDoubtsForMode(modeId);

  if (doubts.length === 0) return null;

  return (
    <>
      <button
        type="button"
        className="ds-btn ds-btn--secondary ds-btn--sm"
        onClick={() => {
          haptic.tap();
          api.trackEvent(MODE_DOUBT_OPENED_EVENT, { modeId });
          setOpen(true);
        }}
      >
        {tr(
          'Сомневаешься? Сравни с похожими',
          'Сомневаетесь? Сравните с похожими',
        )}
      </button>
      {open && (
        <ModeDoubtSheet
          modeId={modeId}
          onSwitch={onSwitch}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ModeDoubtSheet({
  modeId,
  onSwitch,
  onClose,
}: {
  modeId: string;
  onSwitch: (id: string) => void;
  onClose: () => void;
}) {
  const goBack = useHistorySheet(onClose);
  const mode = getModeById(modeId);
  const doubts = getDoubtsForMode(modeId);

  return (
    <div className="ex-screen">
      <div className="ex-topbar">
        <button className="ds-link sd-back" onClick={goBack}>
          <GlyphArrowLeft /> Назад
        </button>
      </div>
      <div className="page">
        <div className="sd-doubt">
          <div className="ds-card ds-card--row tone-soft sd-doubt-now" style={hueStyle(DIARY_HUE.mode)}>
            <div className="sd-doubt-now-name">
              {mode && <IdentityDot color={mode.groupColor} />} {mode?.name ?? ''}
            </div>
            <div className="ds-sub">сейчас выбран</div>
          </div>
          <p className="ds-sub sd-doubt-lede">
            Вот с чем его чаще всего путают — и как отличить.
          </p>
          <div className="sd-doubt-list">
            {doubts.map((d) => {
              const other = getModeById(d.otherId);
              const leafLabel = getModeLeafLabel(d.otherId);
              return (
                <div key={d.otherId} className="ds-card sd-doubt-card">
                  <h3 className="ds-h3 sd-doubt-title">
                    {other && <IdentityDot color={other.groupColor} />}
                    {leafLabel ?? other?.name ?? d.otherId}
                  </h3>
                  <div className="ds-sub">→ {other?.name ?? d.otherId}</div>
                  <p className="sd-doubt-gist">{d.gist}</p>
                  <div className="sd-doubt-check tone-soft" style={hueStyle(DIARY_HUE.mode)}>
                    Проверить: {d.check}
                  </div>
                  <button
                    type="button"
                    className="ds-btn ds-btn--secondary sd-doubt-btn"
                    onClick={() => {
                      haptic.select();
                      api.trackEvent(MODE_DOUBT_SWITCHED_EVENT, {
                        from: modeId,
                        to: d.otherId,
                      });
                      onSwitch(d.otherId);
                      goBack();
                    }}
                  >
                    Это ближе
                  </button>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            className="ds-btn sd-doubt-btn sd-doubt-keep"
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
  );
}
