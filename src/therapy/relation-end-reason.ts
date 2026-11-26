// Причина, по которой связь терапевт↔клиент стала `ended` (колонка
// TherapyRelation.endReason, VARCHAR(32)). Машинный код, не текст для людей.
//
// therapist_resigned — терапевт отказался от роли (end-therapist-relations.ts);
// therapist_removed — терапевт убрал клиента (remove-client.ts);
// client_left — клиент отключился сам (TherapyRelationsService.disconnect).
// По каждой клиент видит свою строку вместо «Мой терапевт»
// (former-therapist-info.ts, тексты — shared/src/therapy/formerTherapist.ts).
// Литерал therapist_resigned — ещё и в бэкфиле миграции 20261022150000_therapy_relation_end.
export const THERAPIST_RESIGNED = 'therapist_resigned';
export const THERAPIST_REMOVED = 'therapist_removed';
export const CLIENT_LEFT = 'client_left';

export type RelationEndReason =
  typeof THERAPIST_RESIGNED | typeof THERAPIST_REMOVED | typeof CLIENT_LEFT;
