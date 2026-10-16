import type { TherapyRelationInfo } from '../../api';
import { avatarInitial, formatNextSession } from './profileModel';

export function TherapistCard({ relation }: { relation: TherapyRelationInfo }) {
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
