import { useState } from 'react';
import { haptic } from '../../haptic';
import { api } from '../../api';
import { useTr } from '../../utils/addressForm';
import { getDoubtsForMode } from '../../../../shared/src/mode/modeDoubts';
import { MODE_DOUBT_OPENED_EVENT } from '../../../../shared/src/share/analytics';
import { ModeDoubtSheet } from './ModeDoubtSheet';

/**
 * «Сомневаешься? Сравни с похожими» — на листе выбранного режима (ModeEntryForm, строка под
 * героем рядом со «Сменить режим»): тихая ссылка + полноэкранный лист сравнения с соседями по
 * путанице (ModeDoubtSheet, shared/mode/modeDoubts). Пустой список пар (быть не может — покрыто
 * тестом реестра) — кнопка не рендерится.
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
      {open && (
        <ModeDoubtSheet modeId={modeId} onSwitch={onSwitch} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
