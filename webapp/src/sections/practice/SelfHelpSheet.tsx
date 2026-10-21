import { useState } from 'react';
import { BottomSheetShell } from '../../components/BottomSheetShell';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { useTr } from '../../utils/addressForm';
import {
  buildSelfHelpParagraphs,
  SELF_HELP_TITLE,
} from '../../../../shared/src/selfHelp/selfHelpText';
import { CrisisContactsSheet } from './CrisisContactsSheet';
import '../../styles/practice-selfhelp.css';

/**
 * «Важное о самопомощи»: практики – передышка, не лечение. Кнопка
 * «Контакты помощи» открывает телефоны доверия поверх листа, чтобы после
 * закрытия контактов человек вернулся к тексту, а не потерял место.
 */
export function SelfHelpSheet({ onClose }: { onClose: () => void }) {
  const tr = useTr();
  const goBack = useHistorySheet(onClose);
  const [contacts, setContacts] = useState(false);
  return (
    <>
      <BottomSheetShell goBack={goBack} zIndex={310} label={SELF_HELP_TITLE}>
        <h2 className="ds-h3 sh-title">{SELF_HELP_TITLE}</h2>
        {buildSelfHelpParagraphs(tr).map((p) => (
          <p key={p} className="sh-text">
            {p}
          </p>
        ))}
        <div className="sh-actions">
          <button type="button" className="ds-btn ds-btn--secondary" onClick={() => setContacts(true)}>
            Контакты помощи
          </button>
          <button type="button" className="ds-btn" onClick={goBack}>
            Понятно
          </button>
        </div>
      </BottomSheetShell>
      {contacts && <CrisisContactsSheet onClose={() => setContacts(false)} />}
    </>
  );
}
