import { useState, type ReactNode } from 'react';
import { haptic } from '../../haptic';
import { api } from '../../api';
import { useTr } from '../../utils/addressForm';
import { getDoubtsForMode } from '../../../../shared/src/mode/modeDoubts';
import { MODE_DOUBT_OPENED_EVENT } from '../../../../shared/src/share/analytics';
import { ModeDoubtSheet } from './ModeDoubtSheet';

/**
 * «Сомневаешься? Сравни с похожими» — на листе выбранного режима (ModeEntryForm): тихая ссылка
 * + полноэкранный лист сравнения с соседями по путанице (ModeDoubtSheet, shared/mode/modeDoubts).
 * Ссылка и лист отдаются порознь: ссылка стоит в листе-герое (heroFoot), а лист экран рисует
 * СИБЛИНГОМ после ExScreen. Внутри героя он попадал в колонку разворота (.pa-spread-side,
 * position: sticky — свой контекст наложения) и на ≥1024 ложился под липкую шапку мастера:
 * «← Назад к дневнику» закрывал мастер целиком (ревью g3 r2). Пустой список пар (быть не может —
 * покрыто тестом реестра) — ни ссылки, ни листа.
 */
export function useModeDoubt(modeId: string, onSwitch: (id: string) => void): { link: ReactNode; sheet: ReactNode } {
  const tr = useTr();
  const [open, setOpen] = useState(false);
  if (getDoubtsForMode(modeId).length === 0) return { link: null, sheet: null };

  const link = (
    <button
      type="button"
      className="ds-link sd-mode-link"
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
  );
  const sheet = open
    ? <ModeDoubtSheet modeId={modeId} onSwitch={onSwitch} onClose={() => setOpen(false)} />
    : null;
  return { link, sheet };
}
