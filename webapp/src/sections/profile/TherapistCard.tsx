import { api } from '../../api';
import type { TherapyRelationInfo } from '../../api';
import { FormerTherapistNote } from '../../../../shared/src/therapy/FormerTherapistNote';
import { avatarInitial, formatNextSession } from './profileModel';

// Карточка «Терапевт» профиля. Связи нет, а терапевт отказался от роли — вместо
// пустоты сообщение о бывшем терапевте (решение владельца 2026-10-22).
export function TherapistCard({ relation }: { relation: TherapyRelationInfo | null }) {
  if (!relation) return <FormerTherapistNote load={api.getFormerTherapist} enabled className="ds-card cpf-former" />;
  if (relation.role !== 'client' || !relation.partnerName) return null;
  return (
    <section className="ds-card ds-card--ink cpf-therapist">
      <div className="cpf-therapist-ava" aria-hidden="true">{avatarInitial(relation.partnerName)}</div>
      <div className="cpf-therapist-body">
        <div className="ds-label cpf-therapist-label">Терапевт</div>
        <div className="cpf-therapist-name">{relation.partnerName}</div>
      </div>
      {relation.nextSession && (
        <div className="cpf-therapist-next">
          <span className="cpf-therapist-label">Следующая сессия</span>
          <span>{formatNextSession(relation.nextSession)}</span>
        </div>
      )}
    </section>
  );
}
