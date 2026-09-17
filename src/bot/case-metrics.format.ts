// Блок «Разбор случая» для /stats (правило №8: метрика, которой нет в
// отчёте, — невидима, её будто нет).
//
// Что здесь меряется и почему именно это. Время в приложении и «дошёл до
// пятой записи» ничего не доказывают: в исследованиях приложений схема-
// терапии изменения симптомов с временем использования не коррелировали.
// Поэтому главные числа блока — не объём, а три признака того, что разбор
// работает:
//
//   1. «У меня было иначе» — индикатор эффекта Барнума. Восемь ворот с
//      тёплыми описаниями устроены так, что узнать себя можно почти везде.
//      Если этой кнопки не жмёт почти никто, описания подходят всем подряд
//      и не значат ничего — это повод заострить их, а не радоваться
//      конверсии.
//   2. Своё имя части — присвоил ли человек находку себе.
//   3. Второй разбор — вернулся ли он вообще; паттерн виден только с
//      третьего-пятого случая.
//
// Чистый форматчик, покрыт тестом, включая пустую БД. Язык — без терминов:
// «сказали „у меня было иначе“», а не «доля disagreement».

export interface CaseMetrics {
  /** Открыли поток разбора. */
  started: number;
  /** Довели разбор до конца. */
  finished: number;
  /** Сцена своими словами против сцены от готовой рамки. */
  sceneOwn: number;
  sceneFrame: number;
  /** Вердикт критерия: часть / обычная досада / пограничный случай. */
  verdictMode: number;
  verdictOrdinary: number;
  verdictBorderline: number;
  /** Экран узнавания: согласились и нажали «у меня было иначе». */
  recognizedAgreed: number;
  recognizedDoubted: number;
  /** Имя части: своим словом, из заготовок, пропустили. */
  namedOwn: number;
  namedChip: number;
  namedSkipped: number;
  /** Разных людей начали разбор и сколько из них вернулись за вторым. */
  people: number;
  peopleReturned: number;
}

const share = (part: number, whole: number): string =>
  whole === 0 ? '' : ` (${Math.round((part / whole) * 100)}%)`;

/** Текстовый блок для /stats. Чистая функция. */
export function formatCaseMetrics(m: CaseMetrics): string {
  const lines = ['🧭 <b>Разбор случая</b> (за месяц)'];
  if (m.started === 0) {
    lines.push('Пока никто не начинал');
    return lines.join('\n');
  }

  lines.push(`Начали ${m.started} · дошли до конца ${m.finished}`);
  lines.push(`Своими словами ${m.sceneOwn} · по готовой рамке ${m.sceneFrame}`);
  lines.push(
    `Похоже на часть ${m.verdictMode} · обычная досада ${m.verdictOrdinary} · не разобрать ${m.verdictBorderline}`,
  );

  const seen = m.recognizedAgreed + m.recognizedDoubted;
  lines.push(
    `Сказали «у меня было иначе» ${m.recognizedDoubted} из ${seen}${share(m.recognizedDoubted, seen)}`,
  );
  if (seen >= 20 && m.recognizedDoubted / seen < 0.1) {
    lines.push(
      'Почти никто не спорит — описания подходят всем подряд, стоит их заострить',
    );
  }

  lines.push(
    `Назвали часть своим словом ${m.namedOwn} · выбрали из заготовок ${m.namedChip} · пропустили ${m.namedSkipped}`,
  );
  lines.push(
    `Разных людей ${m.people} · вернулись за вторым разбором ${m.peopleReturned}${share(m.peopleReturned, m.people)}`,
  );
  return lines.join('\n');
}
