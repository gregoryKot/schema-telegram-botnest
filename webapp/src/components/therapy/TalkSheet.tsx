import { useNavigate } from 'react-router-dom';
import { getTherapistContact, hasConnectedTherapist } from '../../../../shared/src/utils/therapistContact';
import type { TherapyNudgePlace, TherapyNudgeTrigger } from '../../../../shared/src/analytics/therapyNudge';
import { bookingUrl, telegramUrl } from '../../../../shared/src/therapy/bridge/therapyBridgeLinks';
import { AuthorPhoto } from '../AuthorAvatar';
import { EntitySheet } from '../paper/EntitySheet';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { glue } from '../../../../shared/src/utils/typo';
import { ExternalLink } from '../../host/ExternalLink';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import type { CSSProperties } from 'react';
import { useDialogA11y } from '../../../../shared/src/utils/dialogA11y';
import { trackTherapyNudge } from './trackTherapyNudge';
import { useTherapyBridgeTexts } from './useTherapyBridgeTexts';
import '../../styles/client-why.css';
import '../../styles/therapy-bridge.css';

interface Props { place: TherapyNudgePlace; trigger?: TherapyNudgeTrigger; onClose: () => void }

/** Лист «Поговорить с кем-то»: куда пойти, если одной самопомощи мало. Цены на листе нет.
 *  Лист-герой + действия (b24): лист неба сверху, кнопки сразу под ним.
 *  Без своего терапевта говорит владелец от первого лица: «если хочешь в терапию — напиши мне» (2026-11-08).
 *  Свой терапевт без канала связи (U4) — «запиши и принеси на встречу» и переход к ближайшей
 *  встрече (профиль: карточка терапевта, следующая сессия, запись): лист без действия был тупиком. */
export function TalkSheet({ place, trigger, onClose }: Props) {
  const goBack = useHistorySheet(onClose);
  const dialogA11y = useDialogA11y(); // фокус на «Назад», Tab внутри, возврат к вызвавшей строке
  const navigate = useNavigate();
  const t = useTherapyBridgeTexts();
  const contact = getTherapistContact();
  const hasTherapist = hasConnectedTherapist(contact);
  const toMeeting = () => {
    trackTherapyNudge(place, 'session', trigger);
    goBack(() => navigate('/profile'));
  };

  return (
    <div {...dialogA11y} className="u-sheet cw-sheet" aria-label={t.sheetEyebrow}>
      <div className="ds-sheet-head ds-sheet-head--page cw-head">
        <button type="button" className="ds-back" onClick={goBack}><span aria-hidden="true">←</span>{t.sheetBack}</button>
      </div>
      <div className="cw-inner th-talk">
        {hasTherapist ? (
          // Свой терапевт: лист неба со знаком Talk — без фото автора, это не его клиент.
          <EntitySheet look="therapist" titleAs="h1" label={t.sheetTherapistEyebrow} title={t.sheetTherapistTitle}
            sub={contact.url ? t.sheetTherapistP : t.sheetTherapistNoChannelP} />
        ) : (
          // Без терапевта говорит автор: его фото с наклейкой Talk на том же листе неба (сломанное фото прячется само).
          <div className="pp-paper th-talk-hero" style={{ '--h': ENTITY_LOOK.therapist.hue } as CSSProperties}>
            <AuthorPhoto className="th-talk-photo" />
            <div className="th-talk-text">
              <div className="ds-eyebrow th-talk-label">{t.sheetEyebrow}</div>
              <h1 className="th-talk-title">{glue(t.sheetTitle)}</h1>
              <p className="th-talk-lead">{glue(t.sheetP)}</p>
            </div>
          </div>
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
