import { useState } from 'react';
import { useTr } from '../../utils/addressForm';
import { InfoParts } from '../../../../shared/src/settings/InfoParts';
import { settingsInfoTexts, type SettingsInfoKey } from '../../../../shared/src/settings/infoTexts';
import { InfoModal } from './ui';

// Тихая ссылка «что это?» у заголовка раздела настроек (не кружок «?») и лист «Зачем это».
// Тексты общие: shared/src/settings/infoTexts.ts.
export function SettingsInfoHelp({ infoKey }: { infoKey: SettingsInfoKey }) {
  const tr = useTr();
  const [open, setOpen] = useState(false);
  const { title, paragraphs } = settingsInfoTexts(tr)[infoKey];
  return (
    <>
      <button type="button" className="st-help" onClick={() => setOpen(true)}>что это?</button>
      {open && (
        <InfoModal title={title} onClose={() => setOpen(false)}>
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
