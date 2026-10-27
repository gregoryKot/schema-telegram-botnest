import { useEffect, useState } from 'react';
import { getTherapistContact } from '../../../../shared/src/utils/therapistContact';
import type { TherapyNudgePlace } from '../../../../shared/src/analytics/therapyNudge';
import { ExternalLink } from '../../host/ExternalLink';
import { trackTherapyNudge } from './trackTherapyNudge';
import { TalkSheet } from './TalkSheet';
import { useTherapyBridgeTexts } from './useTherapyBridgeTexts';
import '../../styles/therapy-bridge.css';

/**
 * Тихая строка «это самопомощь, не замена терапии» с выходом к человеку: после
 * действий и внизу главной. Пользователю-терапевту не показывается. Терапевт
 * подключён — ссылка сразу на него; нет — лист «Поговорить с кем-то».
 */
export function TherapyLine({ place, text }: { place: TherapyNudgePlace; text: string }) {
  const t = useTherapyBridgeTexts();
  const [open, setOpen] = useState(false);
  const contact = getTherapistContact();
  const hidden = contact.isTherapist;
  const hasTherapist = contact.name !== 'автору';

  useEffect(() => {
    if (!hidden) trackTherapyNudge(place, 'shown');
  }, [place, hidden]);

  if (hidden) return null;

  return (
    <>
      <p className="th-line">
      {text}{' '}
      {hasTherapist ? (
        <ExternalLink className="th-link" href={contact.url} onClick={() => trackTherapyNudge(place, 'write')}>
          {t.linkWrite}
        </ExternalLink>
      ) : (
        <button
          type="button"
          className="th-link"
          onClick={() => {
            trackTherapyNudge(place, 'open');
            setOpen(true);
          }}
        >
          {t.linkTalk}
        </button>
      )}
      </p>
      {open && <TalkSheet place={place} onClose={() => setOpen(false)} />}
    </>
  );
}
