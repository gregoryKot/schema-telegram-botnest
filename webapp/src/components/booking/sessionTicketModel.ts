// Строка «когда» → корешок билета: день и время отдельно, разделитель между ними как был.
// Форматы мест: «Вс, 15 ноя · 18:00» (nextSessionLabel), «Завтра, 16:00» и «сб, 14 нояб., 15:00» (sessionWhen),
// «Вс, 15 ноя» — дата без времени. Строку не переписываем: day + sep + time === исходная.
export interface TicketWhen { day: string; sep: string; time: string | null }

// Жадное начало: в дне свои запятые («сб, 14 нояб.»), время — всегда хвост строки.
const WHEN = /^(.*)(\s·\s|,\s)(\d{1,2}:\d{2})$/s;

export function ticketWhen(when: string): TicketWhen {
  const m = WHEN.exec(when);
  return m ? { day: m[1], sep: m[2], time: m[3] } : { day: when, sep: '', time: null };
}
