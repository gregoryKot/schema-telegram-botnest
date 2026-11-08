import { useNavigate } from 'react-router-dom';
import { getTherapistContact, hasConnectedTherapist } from '../../../../shared/src/utils/therapistContact';
import type { TherapyNudgePlace, TherapyNudgeTrigger } from '../../../../shared/src/analytics/therapyNudge';
import { bookingUrl, telegramUrl } from '../../../../shared/src/therapy/bridge/therapyBridgeLinks';
import { Talk } from '../art/PaperArtSigns';
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

/** Лист «Поговорить с кем-то»: куда пойти, если одной самопомощи мало. Цены на листе нет.
 *  Без своего терапевта говорит владелец от первого лица: «если хочешь в терапию — напиши мне» (2026-11-08).
 *  Свой терапевт без канала связи (U4) — «запиши и принеси на встречу» и переход к ближайшей
 *  встрече (профиль: карточка терапевта, следующая сессия, запись): лист без действия был тупиком. */
export function TalkSheet({ place, trigger, onClose }: Props) {
  const goBack = useHistorySheet(onClose);
  const navigate = useNavigate();
  const t = useTherapyBridgeTexts();
  const contact = getTherapistContact();
  const hasTherapist = hasConnectedTherapist(contact);
  const toMeeting = () => {
    trackTherapyNudge(place, 'session', trigger);
    goBack(() => navigate('/profile'));
  };

  return (
    <div className="u-sheet cw-sheet" role="dialog" aria-modal="true" aria-label={t.sheetEyebrow}>
      <div className="ds-sheet-head ds-sheet-head--page cw-head">
        <button type="button" className="ds-back" onClick={goBack}><span aria-hidden="true">←</span>{t.sheetBack}</button>
      </div>
      <div className="cw-inner">
        <div className="ds-eyebrow">{hasTherapist ? t.sheetTherapistEyebrow : t.sheetEyebrow}</div>
        <div className="cw-title-row">
          <h1 className="ds-h1">{hasTherapist ? t.sheetTherapistTitle : t.sheetTitle}</h1>
          <Talk size="square" />
        </div>
        {hasTherapist ? (
          <p className="cw-lead">{contact.url ? t.sheetTherapistP : t.sheetTherapistNoChannelP}</p>
        ) : (
          <p className="cw-lead">{t.sheetP}</p>
        )}
        <div className="th-sheet-acts">
          {hasTherapist ? (
            contact.url ? (
              <ExternalLink className="ds-btn ds-btn--lg" href={contact.url}
                onClick={() => trackTherapyNudge(place, 'write', trigger)}>{t.sheetWriteTherapist}</ExternalLink>
            ) : (
              // Терапевт с веб-аккаунтом: написать из приложения некуда (З6) — ведём к встрече.
              <button type="button" className="ds-btn ds-btn--lg" onClick={toMeeting}>{t.sheetNextMeeting}</button>
            )
          ) : (
            <>
              <ExternalLink
                className="ds-btn ds-btn--lg"
                href={telegramUrl()}
                onClick={() => trackTherapyNudge(place, 'write', trigger)}
              >
                {t.sheetWriteMe}
              </ExternalLink>
              <ExternalLink
                className="ds-btn ds-btn--secondary ds-btn--lg"
                href={bookingUrl(place)}
                onClick={() => trackTherapyNudge(place, 'book', trigger)}
              >
                {t.sheetBook}
              </ExternalLink>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
