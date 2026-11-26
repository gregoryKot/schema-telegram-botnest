// Строка о бывшем терапевте вместо пустого «Мой терапевт». Одна на оба
// фронтенда (правило №3), у каждой причины свой честный текст: терапевт
// отказался от роли (решение владельца 2026-10-22), терапевт убрал клиента,
// клиент отключился сам (2026-11-05, src/therapy/relation-end-reason.ts —
// сверка кодов: src/therapy/relation-end-reason.parity.spec.ts). Даты нет: у
// связей, завершённых до 2026-10-22, она неизвестна. Род нейтральный, ты/вы — в tr.
type Tr = (ty: string, vy: string) => string;

/** Коды причин — зеркало src/therapy/relation-end-reason.ts. */
export const FORMER_THERAPIST_REASONS = [
  'therapist_resigned',
  'therapist_removed',
  'client_left',
] as const;
export type FormerTherapistReason = (typeof FORMER_THERAPIST_REASONS)[number];

/** Ответ GET /api/therapy/former-therapist (src/therapy/former-therapist-info.ts). */
export interface FormerTherapistInfo {
  name: string;
  endedAt: string | null;
  // Нет у ответа старого сервера — тогда текст отказа от роли, как было.
  reason?: FormerTherapistReason;
}

type Info = Pick<FormerTherapistInfo, 'name' | 'reason'>;

export function formerTherapistTitle(info: Info, tr: Tr): string {
  const n = info.name.trim();
  const who = n || 'Терапевт';
  switch (info.reason) {
    case 'therapist_removed':
      return tr(
        `${who} больше не работает с тобой в приложении`,
        `${who} больше не работает с вами в приложении`,
      );
    case 'client_left':
      return tr(
        `${who} больше не видит твои записи`,
        `${who} больше не видит ваши записи`,
      );
    default:
      return n
        ? `${n} больше не работает в приложении как терапевт`
        : 'Терапевт больше не работает в приложении';
  }
}

export function formerTherapistText(info: Info, tr: Tr): string {
  const again = 'Подключиться снова можно по новому коду.';
  switch (info.reason) {
    case 'therapist_removed':
      return tr(
        `Твои записи терапевту больше не видны. ${tasksMine(tr)} ${again}`,
        `Ваши записи терапевту больше не видны. ${tasksMine(tr)} ${again}`,
      );
    case 'client_left':
      return `Связь отключена. ${tasksMine(tr)} ${again}`;
    default:
      return tr(
        'Всё, что было сделано вместе, остаётся у тебя. Подключить другого терапевта можно по коду.',
        'Всё, что было сделано вместе, остаётся у вас. Подключить другого терапевта можно по коду.',
      );
  }
}

// Открытые задания бывшего терапевта стали личными целями
// (src/therapy/end-client-relations.ts) — сказать, где они и что с ними можно.
function tasksMine(tr: Tr): string {
  return tr(
    'Открытые задания от терапевта теперь в твоих целях: выполнить их или убрать — решать тебе.',
    'Открытые задания от терапевта теперь в ваших целях: выполнить их или убрать — решать вам.',
  );
}
