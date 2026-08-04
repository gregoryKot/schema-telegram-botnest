import { useState } from 'react';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { GlyphArrowLeft } from '../exercises/ExScreen';
import { haptic } from '../../haptic';
import { api } from '../../api';
import { useTr } from '../../utils/addressForm';
import { getModeById } from '../../schemaTherapyData';
import { getDoubtsForMode } from '../../../../shared/src/mode/modeDoubts';
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
        className="ex-btn ex-btn-ghost"
        style={{ padding: '8px 12px' }}
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
        <button className="ex-back" onClick={goBack}>
          <GlyphArrowLeft /> Назад
        </button>
      </div>
      <div className="page">
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '48px 24px 80px' }}>
          <div className="eyebrow" style={{ color: 'var(--accent)', marginBottom: 10 }}>
            С чем путают {mode?.name ?? ''}
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.6, marginBottom: 28 }}>
            Режимы легко перепутать — вот соседи, с которыми чаще всего, и
            быстрые проверки.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {doubts.map((d) => {
              const other = getModeById(d.otherId);
              return (
                <div key={d.otherId} className="aside-card" style={{ margin: 0 }}>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--text)', marginBottom: 8 }}>
                    {other?.emoji} {other?.name ?? d.otherId}
                  </div>
                  <p className="body" style={{ marginBottom: 8 }}>{d.gist}</p>
                  <p style={{ fontSize: 12.5, color: 'var(--text-faint)', lineHeight: 1.5, marginBottom: 14 }}>
                    Как проверить: {d.check}
                  </p>
                  <button
                    type="button"
                    className="ex-btn ex-btn-outline"
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
        </div>
      </div>
    </div>
  );
}
