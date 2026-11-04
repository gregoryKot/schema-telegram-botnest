import { getTherapistContact, hasConnectedTherapist } from '../../../../shared/src/utils/therapistContact';
import type { TherapyNudgePlace, TherapyNudgeTrigger } from '../../../../shared/src/analytics/therapyNudge';
import { bookingUrl, telegramUrl } from '../../../../shared/src/therapy/bridge/therapyBridgeLinks';
import { ExternalLink } from '../../host/ExternalLink';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { trackTherapyNudge } from './trackTherapyNudge';
import { useTherapyBridgeTexts } from './useTherapyBridgeTexts';
import '../../styles/client-why.css';
import '../../styles/therapy-bridge.css';

interface Props {
  place: TherapyNudgePlace;
  trigger?: TherapyNudgeTrigger;
  onClose: () => void;
}

/** Лист «Поговорить с кем-то»: куда пойти, если одной самопомощи мало. Цены на листе нет. */
export function TalkSheet({ place, trigger, onClose }: Props) {
  const goBack = useHistorySheet(onClose);
  const t = useTherapyBridgeTexts();
  const contact = getTherapistContact();
  const hasTherapist = hasConnectedTherapist(contact);

  return (
    <div className="u-sheet cw-sheet" role="dialog" aria-modal="true" aria-label={t.sheetEyebrow}>
      <div className="ds-sheet-head ds-sheet-head--page cw-head">
        <button type="button" className="ds-back" onClick={goBack}><span aria-hidden="true">←</span>{t.sheetBack}</button>
      </div>
      <div className="cw-inner">
        <div className="ds-eyebrow">{hasTherapist ? t.sheetTherapistEyebrow : t.sheetEyebrow}</div>
        <h1 className="ds-h1">{hasTherapist ? t.sheetTherapistTitle : t.sheetTitle}</h1>
        {hasTherapist ? (
          <p className="cw-lead">{t.sheetTherapistP}</p>
        ) : (
          <>
            <p className="cw-lead">{t.sheetP1}</p>
            <p className="cw-lead">{t.sheetP2}</p>
            <p className="cw-lead">{t.sheetP3}</p>
          </>
        )}
        <div className="th-sheet-acts">
          {hasTherapist ? (
            // Терапевт с веб-аккаунтом: написать из приложения некуда (З6).
            contact.url && (
              <ExternalLink
                className="ds-btn ds-btn--lg"
                href={contact.url}
                onClick={() => trackTherapyNudge(place, 'write', trigger)}
              >
                {t.sheetWriteTherapist}
              </ExternalLink>
            )
          ) : (
            <>
              <ExternalLink
                className="ds-btn ds-btn--lg"
                href={bookingUrl(place)}
                onClick={() => trackTherapyNudge(place, 'book', trigger)}
              >
                {t.sheetBook}
              </ExternalLink>
              <ExternalLink
                className="ds-btn ds-btn--secondary ds-btn--lg"
                href={telegramUrl()}
                onClick={() => trackTherapyNudge(place, 'write', trigger)}
              >
                {t.sheetTelegram}
              </ExternalLink>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
