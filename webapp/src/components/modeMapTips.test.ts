// modeMapTips.ts — база подсказок панели ModeMapGuide + pickTips(). 0%
// покрытия. Инвариант данных (нет дублей/пустых строк) плюс реальная
// проверка алгоритма выборки (Fisher–Yates) с зафиксированным Math.random —
// не просто «вернулся массив», а конкретный порядок и состав.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { MODE_MAP_TIPS, pickTips } from './modeMapTips';

describe('MODE_MAP_TIPS — инвариант базы знаний', () => {
  it('непустая база', () => {
    expect(MODE_MAP_TIPS.length).toBeGreaterThan(0);
  });

  it('у каждой подсказки непустой текст', () => {
    MODE_MAP_TIPS.forEach((t, i) => expect(t.text.trim().length, `tip[${i}]`).toBeGreaterThan(0));
  });

  it('нет дублей текста подсказок', () => {
    const texts = MODE_MAP_TIPS.map(t => t.text);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('kind, если указан, — один из personality/problem/couple', () => {
    const allowed = new Set(['personality', 'problem', 'couple']);
    MODE_MAP_TIPS.forEach((t, i) => {
      if (t.kind !== undefined) expect(allowed.has(t.kind), `tip[${i}].kind=${t.kind}`).toBe(true);
    });
  });

  it('для каждого kind есть хотя бы одна специфичная подсказка', () => {
    (['personality', 'problem', 'couple'] as const).forEach(kind => {
      expect(MODE_MAP_TIPS.some(t => t.kind === kind), kind).toBe(true);
    });
  });

  it('есть универсальные подсказки без kind (показываются на любой карте)', () => {
    expect(MODE_MAP_TIPS.some(t => t.kind === undefined)).toBe(true);
  });
});

describe('pickTips', () => {
  afterEach(() => vi.restoreAllMocks());

  it('возвращает подсказки только своего kind + универсальные', () => {
    const picked = pickTips('couple', 100);
    picked.forEach(text => {
      const tip = MODE_MAP_TIPS.find(t => t.text === text)!;
      expect(tip.kind === undefined || tip.kind === 'couple', text).toBe(true);
    });
  });

  it('никогда не возвращает подсказку другого специфичного kind', () => {
    const picked = pickTips('problem', 100);
    const leaked = picked.filter(text => {
      const tip = MODE_MAP_TIPS.find(t => t.text === text)!;
      return tip.kind === 'couple' || tip.kind === 'personality';
    });
    expect(leaked).toEqual([]);
  });

  it('n=0 возвращает пустой массив', () => {
    expect(pickTips('problem', 0)).toEqual([]);
  });

  it('n больше размера пула — возвращает весь пул без дублей', () => {
    const pool = MODE_MAP_TIPS.filter(t => !t.kind || t.kind === 'personality').map(t => t.text);
    const picked = pickTips('personality', pool.length + 50);
    expect(picked).toHaveLength(pool.length);
    expect(new Set(picked).size).toBe(pool.length);
  });

  it('exclude вычёркивает переданные подсказки из выдачи', () => {
    const pool = MODE_MAP_TIPS.filter(t => !t.kind || t.kind === 'problem').map(t => t.text);
    const excluded = pool.slice(0, 3);
    const picked = pickTips('problem', pool.length, excluded);
    excluded.forEach(text => expect(picked).not.toContain(text));
    expect(picked).toHaveLength(pool.length - excluded.length);
  });

  it('перемешивает пул по Fisher–Yates: при зафиксированном Math.random порядок выдачи предсказан', () => {
    // Три подсказки без kind, пул = только они (couple берёт и универсальные —
    // подменяем на маленький детерминированный пул через exclude всех кроме 3).
    const universal = MODE_MAP_TIPS.filter(t => t.kind === undefined).map(t => t.text);
    const problemOnly = MODE_MAP_TIPS.filter(t => t.kind === 'problem').map(t => t.text);
    expect(universal.length).toBeGreaterThanOrEqual(3);
    const keep = universal.slice(0, 3);
    // Исключаем ВСЁ остальное, что pickTips('problem', …) иначе включит в пул —
    // и хвост универсальных, и все problem-специфичные — иначе пул будет
    // больше трёх элементов и Fisher–Yates перемешает не то, что ожидает тест.
    const excludeRest = [...universal.slice(3), ...problemOnly];

    // Math.random зафиксирован на 0 → на каждом шаге Fisher–Yates j = floor(0 * (i+1)) = 0,
    // то есть цикл всегда меняет местами текущий последний элемент с элементом [0].
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const picked = pickTips('problem', 3, excludeRest);

    // Ручная симуляция того же алгоритма на копии keep даёт ожидаемый результат —
    // так тест не переписывает pickTips, а сверяет его с независимым эталоном.
    const expected = [...keep];
    for (let i = expected.length - 1; i > 0; i--) {
      [expected[i], expected[0]] = [expected[0], expected[i]];
    }
    expect(picked).toEqual(expected.slice(0, 3));
  });

  it('пустой пул (все исключены) возвращает пустой массив, не падает', () => {
    const problemPool = MODE_MAP_TIPS.filter(t => !t.kind || t.kind === 'problem').map(t => t.text);
    expect(pickTips('problem', 5, problemPool)).toEqual([]);
  });
});
