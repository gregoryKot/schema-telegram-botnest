import { useState } from 'react';
import { haptic } from '../../haptic';
import { api } from '../../api';
import { useTr } from '../../utils/addressForm';
import { getModeById } from '../../schemaTherapyData';
import { BottomSheet } from '../BottomSheet';
import { getDoubtsForMode } from '../../../../shared/src/mode/modeDoubts';
import {
  MODE_DOUBT_OPENED_EVENT,
  MODE_DOUBT_SWITCHED_EVENT,
} from '../../../../shared/src/share/analytics';

/**
 * «Сомневаешься? Сравни с похожими» — на карточке выбранного режима
 * (ModeSelectStep, ветка selectedMode): кнопка + лист сравнения с соседями
 * по путанице (shared/mode/modeDoubts). «Это ближе» переключает выбор на
 * соседний режим и закрывает лист. Пустой список пар (быть не может —
 * покрыто тестом реестра) — кнопка не рендерится, защита обязательна.
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

  const mode = getModeById(modeId);

  return (
    <>
      <button
        onClick={() => {
          haptic.tap();
          api.trackEvent(MODE_DOUBT_OPENED_EVENT, { modeId });
          setOpen(true);
        }}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-sub)',
          fontSize: 12.5,
          cursor: 'pointer',
          fontFamily: 'inherit',
          padding: '8px 2px 4px',
          textAlign: 'left',
        }}
      >
        {tr(
          'Сомневаешься? Сравни с похожими',
          'Сомневаетесь? Сравните с похожими',
        )}
      </button>

      {open && (
        <BottomSheet onClose={() => setOpen(false)}>
          <div style={{ paddingTop: 4 }}>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--text)',
                marginBottom: 4,
              }}
            >
              С чем путают {mode?.name ?? ''}
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-sub)',
                marginBottom: 18,
                lineHeight: 1.5,
              }}
            >
              Режимы легко перепутать — вот соседи, с которыми чаще всего, и
              быстрые проверки.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {doubts.map((d) => {
                const other = getModeById(d.otherId);
                return (
                  <div
                    key={d.otherId}
                    style={{
                      background: 'rgba(var(--fg-rgb),0.04)',
                      border: '1px solid rgba(var(--fg-rgb),0.08)',
                      borderRadius: 14,
                      padding: '12px 14px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 6,
                        fontSize: 14,
                        fontWeight: 600,
                        color: 'var(--text)',
                      }}
                    >
                      <span>{other?.emoji}</span>
                      {other?.name ?? d.otherId}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: 'var(--text-sub)',
                        lineHeight: 1.5,
                        marginBottom: 6,
                      }}
                    >
                      {d.gist}
                    </div>
                    <div
                      style={{
                        fontSize: 12.5,
                        color: 'var(--text-faint)',
                        lineHeight: 1.5,
                        marginBottom: 10,
                      }}
                    >
                      Как проверить: {d.check}
                    </div>
                    <button
                      onClick={() => {
                        haptic.select();
                        api.trackEvent(MODE_DOUBT_SWITCHED_EVENT, {
                          from: modeId,
                          to: d.otherId,
                        });
                        onSwitch(d.otherId);
                        setOpen(false);
                      }}
                      style={{
                        background: 'rgba(96,165,250,0.16)',
                        border: '1px solid rgba(96,165,250,0.4)',
                        borderRadius: 10,
                        padding: '7px 12px',
                        color: 'var(--accent-blue)',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      Это ближе
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </BottomSheet>
      )}
    </>
  );
}
