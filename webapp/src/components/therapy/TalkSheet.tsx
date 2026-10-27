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
      <div className="cw-inner">
        <div className="ds-eyebrow">{hasTherapist ? t.sheetTherapistEyebrow : t.sheetEyebrow}</div>
        <h1 className="ds-h1 cw-h1">{hasTherapist ? t.sheetTherapistTitle : t.sheetTitle}</h1>
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
            <ExternalLink
              className="ds-btn th-btn"
              href={contact.url}
              onClick={() => trackTherapyNudge(place, 'write', trigger)}
            >
              {t.sheetWriteTherapist}
            </ExternalLink>
          ) : (
            <>
              <ExternalLink
                className="ds-btn th-btn"
                href={bookingUrl(place)}
                onClick={() => trackTherapyNudge(place, 'book', trigger)}
              >
                {t.sheetBook}
              </ExternalLink>
              <ExternalLink
                className="ds-btn th-btn th-btn--ghost"
                href={telegramUrl()}
                onClick={() => trackTherapyNudge(place, 'write', trigger)}
              >
                {t.sheetTelegram}
              </ExternalLink>
            </>
          )}
          <button type="button" className="th-back" onClick={goBack}>
            {t.sheetBack}
          </button>
        </div>
      </div>
    </div>
  );
}
