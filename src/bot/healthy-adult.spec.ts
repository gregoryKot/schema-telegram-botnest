import { HEALTHY_ADULT_PHRASES } from './healthy-adult.data';
import { blockingIssues, issuesToReason } from './healthy-adult.quality';

describe('healthy-adult fallback pool', () => {
  it('большой пул без пустых и дублирующихся строк', () => {
    expect(HEALTHY_ADULT_PHRASES.length).toBeGreaterThanOrEqual(30);
    expect(HEALTHY_ADULT_PHRASES.every((p) => p.trim().length > 0)).toBe(true);
    expect(new Set(HEALTHY_ADULT_PHRASES).size).toBe(
      HEALTHY_ADULT_PHRASES.length,
    );
  });

  it('без AI-штампов и токсичного позитива (запреты брифа)', () => {
    const banned = [
      'важно помнить',
      'стоит отметить',
      'в конечном итоге',
      'помни, что',
      'всё к лучшему',
      'мысли позитивно',
      'возьми себя в руки',
      'хватит ныть',
    ];
    const offenders = HEALTHY_ADULT_PHRASES.filter((p) =>
      banned.some((b) => p.toLowerCase().includes(b)),
    );
    expect(offenders).toEqual([]);
  });

  // Свип 2026-07 (docs/VOICE.md): 18 фраз из 46 были построены на одном
  // скелете «Это не X. Это Y» — подряд пул читался как одна заготовка.
  // Переназывание остаётся законной формой брифа, но только пока оно редкое
  // и вторая часть даёт новое («Это не каприз, это счётчик»).
  it('определение через отрицание не расползается по пулу', () => {
    const skeleton = [
      /[Ээ]то\s+не\s+[^.!?]{2,60}[,.]\s*[Ээ]то\s/, // «это не X, это Y»
      /[Ээ]то\s+не\s+про\s/, // «это не про X, это про Y»
      /[—–]\s*это\s+не\s/, // «X — это не Y, а Z»
    ];
    const offenders = HEALTHY_ADULT_PHRASES.filter((p) =>
      skeleton.some((re) => re.test(p)),
    );
    expect(offenders.length).toBeLessThanOrEqual(2);
  });
  // Планка healthy-adult.quality стоит на входе в АДМИНКУ, а фолбэк едет мимо
  // неё: он приезжает файлом, и его никто не проверяет тем же мерилом. Дыра
  // не теоретическая — фраза с мужским родом уже доезжала до прода через пул
  // (см. шапку healthy-adult.quality.ts), а фолбэк — второй такой же путь к
  // читателю, просто через пустую БД. Здесь оба пути меряются одинаково.
  // Единственное исключение — эталон из docs/VOICE.md («Работает: „Это не
  // каприз, это счётчик“»). Точно такой же точечный ALLOW стоит в
  // scripts/check-robot-phrases.mjs; у планки пула ALLOW-списка нет — она
  // судит строку из БД и намеренно проще. Исключение по ПОЛНОМУ тексту, а не
  // по паттерну: любая другая фраза на том же скелете тест по-прежнему красит
  // (правило №15 — исключение с причиной и контрольным образцом).
  const VOICE_GUIDE_SAMPLE =
    'Тело сегодня тяжёлое и медленное не назло тебе. Оно так говорит, что запас кончился. Это не каприз, это счётчик. Его стоит слушать раньше, чем он дойдёт до нуля.';

  it('фолбэк проходит ту же планку, что и пачка из админки', () => {
    const offenders = HEALTHY_ADULT_PHRASES.filter(
      (p) => p !== VOICE_GUIDE_SAMPLE,
    )
      .map((p) => ({
        p,
        issues: blockingIssues(p),
      }))
      .filter(({ issues }) => issues.length > 0)
      .map(({ p, issues }) => `${p.slice(0, 50)}… — ${issuesToReason(issues)}`);
    expect(offenders).toEqual([]);
  });
});
