import { useState } from 'react';
import { haptic } from '../../haptic';
import { api } from '../../api';
import { useTr } from '../../utils/addressForm';
import { getModeById } from '../../schemaTherapyData';
import { BottomSheet } from '../BottomSheet';
import { IdentityDot } from '../../../../shared/src/components/IdentityDot';
import { getDoubtsForMode } from '../../../../shared/src/mode/modeDoubts';
import { getModeLeafLabel } from '../../../../shared/src/mode/modeFeelGates';
import {
  MODE_DOUBT_OPENED_EVENT,
  MODE_DOUBT_SWITCHED_EVENT,
} from '../../../../shared/src/share/analytics';
import { cm } from '../../sections/schemas/utils';
/**
 * «Сомневаешься? Сравни с похожими» — на карточке выбранного режима
 * (ModeSelectStep, ветка selectedMode): кнопка + лист сравнения с соседями
 * по путанице (shared/mode/modeDoubts). «Это ближе» переключает выбор на
 * соседний режим и закрывает лист. Пустой список пар (быть не может —
 * покрыто тестом реестра) — кнопка не рендерится, защита обязательна.
 *
 * 2026-08-04: свайп больше не единственный выход — сверху текстовая «← Назад».
 * Заголовки пар теперь берутся из getModeLeafLabel вместо клинического
 * названия, оно осталось мелкой пометкой ниже. Внизу кнопка-подтверждение
 * текущего выбора.
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
        // Видимая кнопка, а не серая подпись: голый текст 12.5px кнопкой не
        // читался (в webapp тот же триггер давно ghost-кнопка — правило №3).
        // Семья стилей — accent-blue, как «Это ближе» в листе сравнения.
        style={{
          width: '100%',
          minHeight: 44,
          margin: '8px 0 16px',
          background: cm('var(--accent-blue)', 10),
          border: `1px solid ${cm('var(--accent-blue)', 35)}`,
          borderRadius: 'var(--r-12)',
          color: 'var(--accent-blue)',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
          padding: '10px 14px',
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
            <button
              onClick={() => {
                haptic.tap();
                setOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'none',
                border: 'none',
                color: 'var(--text-sub)',
                fontSize: 14,
                cursor: 'pointer',
                padding: 0,
                marginBottom: 14,
                fontFamily: 'inherit',
              }}
            >
              ← Назад
            </button>

            <div
              style={{
                background: cm('var(--accent-blue)', 10),
                border: `1px solid ${cm('var(--accent-blue)', 25)}`,
                borderRadius: 'var(--r-14)',
                padding: '10px 14px',
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 15,
                  fontWeight: 700,
                  color: 'var(--text)',
                }}
              >
                {mode && (
                  <IdentityDot color={mode.groupColor ?? 'var(--accent)'} />
                )}
                {mode?.name ?? ''}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>
                сейчас выбран
              </div>
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-sub)',
                marginBottom: 18,
                lineHeight: 1.5,
              }}
            >
              Вот с чем его чаще всего путают — и как отличить.
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-12)',
              }}
            >
              {doubts.map((d) => {
                const other = getModeById(d.otherId);
                const leafLabel = getModeLeafLabel(d.otherId);
                return (
                  <div
                    key={d.otherId}
                    style={{
                      background: 'rgba(var(--fg-rgb),0.04)',
                      border: '1px solid rgba(var(--fg-rgb),0.08)',
                      borderRadius: 'var(--r-14)',
                      padding: '12px 14px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-8)',
                        fontSize: 14.5,
                        fontWeight: 600,
                        color: 'var(--text)',
                      }}
                    >
                      <IdentityDot
                        color={other?.groupColor ?? 'var(--muted)'}
                      />
                      {leafLabel ?? other?.name ?? d.otherId}
                    </div>
                    <div
                      style={{
                        fontSize: 11.5,
                        color: 'var(--text-faint)',
                        marginBottom: 6,
                      }}
                    >
                      → {other?.name ?? d.otherId}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: 'var(--text-sub)',
                        lineHeight: 1.5,
                        marginBottom: 8,
                      }}
                    >
                      {d.gist}
                    </div>
                    <div
                      style={{
                        background: cm('var(--accent-blue)', 8),
                        borderRadius: 'var(--r-10)',
                        padding: '8px 10px',
                        marginBottom: 10,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12.5,
                          color: 'var(--text)',
                          lineHeight: 1.5,
                        }}
                      >
                        Проверить: {d.check}
                      </div>
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
                        width: '100%',
                        minHeight: 44,
                        background: cm('var(--accent-blue)', 16),
                        border: `1px solid ${cm('var(--accent-blue)', 40)}`,
                        borderRadius: 'var(--r-12)',
                        color: 'var(--accent-blue)',
                        fontSize: 14,
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

            <button
              onClick={() => {
                haptic.tap();
                setOpen(false);
              }}
              style={{
                width: '100%',
                marginTop: 18,
                padding: 14,
                borderRadius: 'var(--r-14)',
                border: 'none',
                minHeight: 48,
                background:
                  'linear-gradient(135deg, var(--accent), var(--accent-blue))',
                color: '#fff',
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Оставляю:{' '}
              {mode && (
                <IdentityDot color={mode.groupColor ?? 'var(--accent)'} />
              )}{' '}
              {mode?.name ?? ''}
            </button>
          </div>
        </BottomSheet>
      )}
    </>
  );
}
