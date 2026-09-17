// Форма строки запуска для экрана ошибки входа.
//
// Зачем: «не удалось войти» одинаково выглядит и когда токен от другого бота,
// и когда мессенджер прислал подпись не в том виде, что разбирает бэкенд.
// Различает их форма строки — имена полей и признак «значения остались
// процент-кодированными». Показываем её на самом экране, а не только в
// аудит-логе: так причина видна тому, кто держит телефон в руках.
//
// НИ ОДНОГО ЗНАЧЕНИЯ наружу: строка содержит идентификатор и имя пользователя,
// а этот текст попадает на экран и в скриншоты. Только структура и длины.

export interface InitDataShape {
  /** Имена полей по алфавиту — «auth_date,chat,hash,ip,query_id,user». */
  keys: string;
  /** Значения не раскодированы до конца (лишний слой кодирования). */
  stillEncoded: boolean;
  length: number;
}

export function describeInitDataShape(initData: string): InitDataShape | null {
  if (!initData) return null;
  const keys: string[] = [];
  let stillEncoded = false;
  for (const pair of initData.split('&')) {
    const eq = pair.indexOf('=');
    if (eq <= 0) continue;
    keys.push(pair.slice(0, eq));
    let value = pair.slice(eq + 1);
    try {
      value = decodeURIComponent(value);
    } catch {
      /* битое кодирование — смотрим на исходное значение */
    }
    // После снятия одного слоя процентов остаться не должно: бэкенд снимает
    // ровно один и ждёт готовые значения. Остались — вот и причина.
    if (/%[0-9a-f]{2}/i.test(value)) stillEncoded = true;
  }
  if (keys.length === 0) return null;
  return {
    keys: keys.sort().join(','),
    stillEncoded,
    length: initData.length,
  };
}

/** Одна строка для экрана — то, что можно прислать скриншотом. */
export function formatInitDataShape(shape: InitDataShape): string {
  return `поля: ${shape.keys} · длина ${shape.length} · кодировка внутри: ${
    shape.stillEncoded ? 'осталась' : 'снята'
  }`;
}
