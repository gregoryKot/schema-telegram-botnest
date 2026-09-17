import { useState } from 'react';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { GlyphArrowLeft } from '../exercises/ExScreen';
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
          <div
            style={{
              background: 'color-mix(in srgb, var(--accent-blue) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent-blue) 25%, transparent)',
              borderRadius: 'var(--r-14)',
              padding: '10px 14px',
              marginBottom: 14,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}>
              {mode && <IdentityDot color={mode.groupColor} />} {mode?.name ?? ''}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>
              сейчас выбран
            </div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.5, marginBottom: 28 }}>
            Вот с чем его чаще всего путают — и как отличить.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-12)' }}>
            {doubts.map((d) => {
              const other = getModeById(d.otherId);
              const leafLabel = getModeLeafLabel(d.otherId);
              return (
                <div key={d.otherId} className="aside-card" style={{ margin: 0 }}>
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
                    {other && <IdentityDot color={other.groupColor} />}
                    {leafLabel ?? other?.name ?? d.otherId}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginBottom: 6 }}>
                    → {other?.name ?? d.otherId}
                  </div>
                  <p className="body" style={{ marginBottom: 8 }}>{d.gist}</p>
                  <div
                    style={{
                      background: 'color-mix(in srgb, var(--accent-blue) 8%, transparent)',
                      borderRadius: 'var(--r-10)',
                      padding: '8px 10px',
                      marginBottom: 10,
                    }}
                  >
                    <div style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.5 }}>
                      Проверить: {d.check}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="ex-btn ex-btn-outline"
                    style={{ width: '100%', minHeight: 44, justifyContent: 'center' }}
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
            onClick={() => {
              haptic.tap();
              goBack();
            }}
            style={{
              width: '100%',
              marginTop: 20,
              padding: 14,
              borderRadius: 'var(--r-14)',
              border: 'none',
              minHeight: 48,
              background: 'linear-gradient(135deg, var(--accent), var(--accent-blue))',
              color: '#fff',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Оставляю: {mode?.name ?? ''}
          </button>
        </div>
      </div>
    </div>
  );
}
