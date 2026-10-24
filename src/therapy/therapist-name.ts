// Имя терапевта глазами клиента — одно правило для «Мой терапевт»
// (therapy-relation-info.ts) и для сообщения о бывшем терапевте
// (former-therapist-info.ts): firstName профиля, иначе null.
export const therapistName = (
  therapist: { firstName: string | null } | null | undefined,
): string | null => therapist?.firstName ?? null;
