import { useState } from 'react';
import { BottomSheetShell } from '../../components/BottomSheetShell';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { useTr } from '../../utils/addressForm';
import { hueStyle } from '../../lib/tone';
import { glue } from '../../../../shared/src/utils/typo';
import { buildSelfHelpParagraphs, SELF_HELP_TITLE } from '../../../../shared/src/selfHelp/selfHelpText';
import { SignHero } from '../../components/paper/SignHero';
import { CrisisContactsSheet } from './CrisisContactsSheet';
import { SELF_HELP_LOOK } from './practiceLook';
import '../../styles/practice-selfhelp.css';

/**
 * «Важное о самопомощи»: практики – передышка, не лечение. Шапка — лист шалфея со знаком Limits
 * (рамка метода), первый абзац (жилет в шторм) — лидом Literata. «Контакты помощи» открывают
 * телефоны доверия поверх листа, чтобы после них человек вернулся к тексту, а не потерял место.
 */
export function SelfHelpSheet({ onClose }: { onClose: () => void }) {
  const tr = useTr();
  const goBack = useHistorySheet(onClose);
  const [contacts, setContacts] = useState(false);
  const [lead, ...rest] = buildSelfHelpParagraphs(tr);
  return (
    <>
      <BottomSheetShell goBack={goBack} zIndex={310} maxWidth={560} label={SELF_HELP_TITLE}>
        <div className="pp-head pp-paper sh-head" style={hueStyle(SELF_HELP_LOOK.hue)}>
          <h2 className="sh-title">{glue(SELF_HELP_TITLE)}</h2><SignHero sign={SELF_HELP_LOOK.sign} />
        </div>
        <p className="sh-lead">{glue(lead)}</p>
        {rest.map((p) => <p key={p} className="sh-text">{glue(p)}</p>)}
        <div className="sh-actions">
          <button type="button" className="ds-btn ds-btn--secondary" onClick={() => setContacts(true)}>Контакты помощи</button>
          <button type="button" className="ds-btn" onClick={goBack}>Понятно</button>
        </div>
      </BottomSheetShell>
      {contacts && <CrisisContactsSheet overSheet onClose={() => setContacts(false)} />}
    </>
  );
}
