import { useState } from 'react';
import { useTr } from '../../utils/addressForm';
import { hitboxStyle } from '../../utils/hitbox';
import { InfoParts } from '../../../../shared/src/settings/InfoParts';
import { settingsInfoTexts, type SettingsInfoKey } from '../../../../shared/src/settings/infoTexts';
import { InfoModal } from './ui';

// Кнопка «?» у заголовка раздела настроек и лист «Зачем это» — как в
// мини-аппе (settingsSheet/InfoOverlays.tsx). Тексты общие: shared/src/settings/infoTexts.ts.
export function SettingsInfoHelp({ infoKey }: { infoKey: SettingsInfoKey }) {
  const tr = useTr();
  const [open, setOpen] = useState(false);
  const { title, paragraphs } = settingsInfoTexts(tr)[infoKey];
  const hit = hitboxStyle(18, 18, 44);
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Пояснение" style={hit.outer}>
        <span className="st-help-in" style={hit.inner}>?</span>
      </button>
      {open && (
        <InfoModal onClose={() => setOpen(false)}>
          <h2 className="dialog-title st-modal-title">{title}</h2>
          {paragraphs.map((p, i) => (
            <p key={i} className="st-text st-mb10">
              <InfoParts parts={p.parts} boldClassName="st-info-b" />
            </p>
          ))}
        </InfoModal>
      )}
    </>
  );
}
