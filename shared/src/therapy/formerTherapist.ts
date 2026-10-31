// Сообщение о бывшем терапевте (решение владельца 2026-10-22): терапевт
// отказался от роли, «Мой терапевт» пропал — клиент видит вместо него эти
// слова. Один текст на оба фронтенда (правило №3). Даты нет: у связей,
// завершённых до 2026-10-22, она неизвестна. Род нейтральный, ты/вы — в tr.
type Tr = (ty: string, vy: string) => string;

/** Ответ GET /api/therapy/former-therapist (src/therapy/former-therapist-info.ts). */
export interface FormerTherapistInfo {
  name: string;
  endedAt: string | null;
}

export function formerTherapistTitle(name: string): string {
  const n = name.trim();
  return n
    ? `${n} больше не работает в приложении как терапевт`
    : 'Терапевт больше не работает в приложении';
}

export function formerTherapistText(tr: Tr): string {
  return tr(
    'Всё, что было сделано вместе, остаётся у тебя. Подключить другого терапевта можно по коду.',
    'Всё, что было сделано вместе, остаётся у вас. Подключить другого терапевта можно по коду.',
  );
}
