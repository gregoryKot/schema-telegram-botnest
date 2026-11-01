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
    Object.entries(data).filter(([, v]) =>
      typeof v === 'string' ? v.trim() !== '' : v != null,
    ),
  ) as Partial<T>;
}
