const isFilled = (v: unknown) =>
  typeof v === 'string' ? v.trim() !== '' : v != null;

// Карточка пишется частичным апсертом: пустое или отсутствующее поле не
// трогает уже сохранённое. Опросники шлют ВСЕ поля разом, и вход без
// загруженной заметки («Познакомиться →» в SchemaDetailSheet) затирал
// написанное пустыми строками (docs/INCIDENTS.md, 2026-10-31). Кнопки
// «очистить поле» в интерфейсе нет — явного пути очистки сервер не держит.
// Фильтр стоит до шифрования: строка из пробелов после него уже не пуста.
export function withoutEmptyFields<T extends Record<string, unknown>>(
  data: T,
): Partial<T> {
  return Object.fromEntries(
    Object.entries(data).filter(([, v]) => isFilled(v)),
  ) as Partial<T>;
}

// Разбор «Что случилось» дописывает в карточку режима то, что увидел в одном
// моменте, и раньше переписывал портрет, собранный в упражнении «Карточка
// режима» (QA 2026-11, К1). Поля из `fill` ложатся только в пустое место
// сохранённой карточки; нечитаемое поле (сырой шифротекст) считается
// заполненным — затирать его нельзя.
export function keepFilled<T extends Record<string, unknown>>(
  data: Partial<T>,
  saved: Record<string, unknown> | null,
  fill: readonly string[],
): Partial<T> {
  if (!saved || fill.length === 0) return data;
  return Object.fromEntries(
    Object.entries(data).filter(
      ([k]) => !(fill.includes(k) && isFilled(saved[k])),
    ),
  ) as Partial<T>;
}
