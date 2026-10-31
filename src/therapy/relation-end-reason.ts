// Причина, по которой связь терапевт↔клиент стала `ended` (колонка
// TherapyRelation.endReason, VARCHAR(32)). Машинный код, не текст для людей.
//
// therapist_resigned — терапевт отказался от роли (end-therapist-relations.ts);
// клиент видит сообщение вместо «Мой терапевт» (former-therapist-info.ts).
// Тот же литерал — в бэкфиле миграции 20261022150000_therapy_relation_end.
export const THERAPIST_RESIGNED = 'therapist_resigned';
