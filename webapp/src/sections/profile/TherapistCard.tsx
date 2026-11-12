import { SignArt } from '../../components/art/SignArt';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { SessionTicket } from '../../components/booking/SessionTicket';
import { api, type TherapyRelationInfo } from '../../api';
import { FormerTherapistNote } from '../../../../shared/src/therapy/FormerTherapistNote';
import { upcomingSession } from '../../../../shared/src/therapy/upcomingSession';
import { nextSessionLabel } from '../../../../shared/src/therapy/clientSheetHelpers';
import { telegramChatUrl } from '../../../../shared/src/utils/therapistContact';
import { ClientBookingBlock } from '../../components/booking/ClientBookingBlock';
import { useClientBooking } from '../../components/booking/useClientBooking';
import { nextBooking } from '../../components/booking/clientBookingModel';
import { avatarInitial } from './profileModel';
import { MyConceptRow } from './MyConceptRow';

// Карточка «Терапевт» профиля. Связи нет, а терапевт отказался от роли — вместо
// пустоты сообщение о бывшем терапевте (решение владельца 2026-10-22). Терапевт
// показал схему случая — строка «Схема случая» (MyConceptRow) под записью.
// Лист неба (ENTITY_LOOK.therapist) со знаком Talk один раз; сессия — «билетик» (SessionTicket, b24);
// нет сессии и записи — только шапка, пустого билета нет.
export function TherapistCard({ relation }: { relation: TherapyRelationInfo | null }) {
  if (!relation) return <FormerTherapistNote load={api.getFormerTherapist} enabled className="ds-card cpf-former" />;
  if (relation.role !== 'client' || !relation.partnerName) return null;
  return <ClientTherapistCard relation={relation} partnerName={relation.partnerName} />;
}

// Своя бронь (запись из приложения, #546) сильнее даты, которую терапевт ввёл
// руками: nextSession запись не пишет — два источника правды (docs/open/therapy.md).
function ClientTherapistCard({ relation, partnerName }: { relation: TherapyRelationInfo; partnerName: string }) {
  const { overview, reload } = useClientBooking();
  const next = nextBooking(overview?.upcoming) ? null : upcomingSession(relation.nextSession, relation.meetingDays);
  return (
    <section className="pp-paper cpf-therapist">
      <div className="cpf-therapist-head">
        <div className="cpf-therapist-ava" aria-hidden="true">{avatarInitial(partnerName)}</div>
        <div className="cpf-therapist-body">
          <div className="ds-label cpf-therapist-label">Терапевт</div>
          <div className="cpf-therapist-name">{partnerName}</div>
        </div>
        <span className="cpf-therapist-sign" aria-hidden="true"><SignArt sign={ENTITY_LOOK.therapist.sign} size="row" /></span>
      </div>
      {next && <SessionTicket when={nextSessionLabel(next)} label="Следующая сессия" />}
      <ClientBookingBlock overview={overview} onBooked={reload} writeUrl={relation.partnerId == null ? null : telegramChatUrl(relation.partnerId)} />
      {relation.conceptSharedAt && <MyConceptRow />}
    </section>
  );
}
