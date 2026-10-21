// Чистая логика карточки партнёра в паре (правила №3 и №11 CLAUDE.md): пороги
// и тексты живут здесь один раз, цвет каждый фронтенд берёт из своей палитры
// по тону — литералов цвета в общем коде нет.

export type Tone = 'good' | 'mid' | 'low';
export type BarTone = Tone | 'none';

export const PARTNER_BAR_MAX_PX = 24;
const BAR_EMPTY_PX = 3;

export function indexTone(v: number): Tone {
  if (v >= 7) return 'good';
  if (v >= 4) return 'mid';
  return 'low';
}

// Безличные формулировки: пола партнёра в данных нет, а мужской род про
// человека ошибочен для половины пар (правило «Род читателя»).
export const PARTNER_EMPTY_TEXT = 'Дневник за сегодня пока пуст';

export function partnerContextText(
  name: string,
  done: boolean,
  idx: number,
): string {
  // Плашка над фразой уже говорит «пока пуст» — здесь не повторяем, а объясняем, что будет дальше.
  if (!done)
    return `Когда у ${name} появится запись за сегодня, день покажется здесь`;
  if (idx < 4) {
    return `Сегодня у ${name} непростой день. Иногда просто написать пару слов — уже помогает`;
  }
  if (idx < 7)
    return `${name} в норме сегодня. Следить за днём вдвоём — уже кое-что`;
  return `У ${name} хороший день. Приятно, когда у обоих всё неплохо`;
}

export interface WeekBar {
  px: number;
  tone: BarTone;
  /** Подпись «сег» — только у последнего столбика и только если день заполнен. */
  today: boolean;
}

// avgs приходят от бэка от сегодняшнего дня назад: слева направо рисуем от
// старого к новому, поэтому разворот.
export function weekBars(avgs: (number | null)[] | undefined): WeekBar[] {
  if (!avgs?.length) return [];
  const ordered = [...avgs].reverse();
  return ordered.map((v, i) => ({
    px:
      v === null
        ? BAR_EMPTY_PX
        : Math.round((Math.max(0, Math.min(10, v)) / 10) * PARTNER_BAR_MAX_PX),
    tone: v === null ? 'none' : indexTone(v),
    today: v !== null && i === ordered.length - 1,
  }));
}
