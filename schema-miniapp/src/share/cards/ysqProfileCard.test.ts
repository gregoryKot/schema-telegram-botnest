// Тест чистой логики карточки-профиля теста на схемы: короткие подписи,
// группировка по потребностям, отбор выраженных схем, формула высоты.
// На карточку идут ТОЛЬКО выраженные схемы — невыраженная строка («—» или
// балл 1.5) ничего не сообщает тому, кому карточку отправили.
import { describe, it, expect } from 'vitest';
import {
  buildYsqProfile,
  shortSchemaLabel,
  ysqProfileCardHeight,
} from '../../../../shared/src/share/cards/ysqProfileCard';
import { SCHEMAS, DOMAIN_ORDER } from '../../../../shared/src/hooks/ysqSchemas';
import { FOOTER_H } from '../../../../shared/src/share/cardKit';

function allScores(avg = 2, pct5plus = 0) {
  return Object.fromEntries(
    SCHEMAS.map((s) => [s.name, { avg, pct5plus }]),
  ) as Record<string, { pct5plus: number; avg: number }>;
}

describe('shortSchemaLabel', () => {
  it('каждая схема получает короткую непустую подпись (влезает в колонку)', () => {
    for (const s of SCHEMAS) {
      const label = shortSchemaLabel(s.name);
      expect(label.length).toBeGreaterThan(0);
      expect(label.length).toBeLessThanOrEqual(21);
    }
  });

  it('подписи всех 20 схем различимы', () => {
    const labels = SCHEMAS.map((s) => shortSchemaLabel(s.name));
    expect(new Set(labels).size).toBe(SCHEMAS.length);
  });

  it('обе пунитивности не схлопываются в одну', () => {
    expect(shortSchemaLabel('Пунитивность (на себя)')).not.toBe(
      shortSchemaLabel('Пунитивность (на других)'),
    );
  });
});

describe('buildYsqProfile', () => {
  it('все схемы выражены → все 20 строк, домены в порядке DOMAIN_ORDER', () => {
    const domains = buildYsqProfile(allScores(5, 80));
    expect(domains.map((d) => d.needId)).toEqual(DOMAIN_ORDER);
    const rows = domains.reduce((n, d) => n + d.rows.length, 0);
    expect(rows).toBe(SCHEMAS.length);
  });

  it('невыраженные схемы в профиль не попадают', () => {
    const scores = allScores(2, 0);
    scores['Уязвимость'] = { avg: 4.3, pct5plus: 0 };
    const rows = buildYsqProfile(scores).flatMap((d) => d.rows);
    expect(rows.map((r) => r.label)).toEqual(['Уязвимость']);
  });

  it('домен без выраженных схем не показывается вовсе', () => {
    const scores = allScores(2, 0);
    scores['Уязвимость'] = { avg: 4.3, pct5plus: 0 };
    const domains = buildYsqProfile(scores);
    expect(domains).toHaveLength(1);
    expect(domains[0].needId).toBe('autonomy');
  });

  it('ни одной выраженной → пустой профиль (карточка покажет пустое состояние)', () => {
    expect(buildYsqProfile(allScores(2, 0))).toEqual([]);
  });

  it('внутри домена схемы отсортированы по убыванию среднего балла', () => {
    // База 4.0 — уже выраженная, но ниже двух named-схем ниже.
    const scores = allScores(4, 80);
    scores['Покинутость/Нестабильность'] = { avg: 5.5, pct5plus: 80 };
    scores['Дефективность/Стыд'] = { avg: 4.2, pct5plus: 60 };
    const attachment = buildYsqProfile(scores)[0];
    expect(attachment.needId).toBe('attachment');
    expect(attachment.rows[0].label).toBe(
      shortSchemaLabel('Покинутость/Нестабильность'),
    );
    expect(attachment.rows[1].label).toBe(
      shortSchemaLabel('Дефективность/Стыд'),
    );
    const avgs = attachment.rows.map((r) => r.avg);
    expect(avgs).toEqual([...avgs].sort((a, b) => b - a));
  });

  it('выраженность — по любому из двух критериев (средний ≥ 4 ИЛИ >50% ответов 5–6)', () => {
    const scores = allScores(2, 0);
    scores['Уязвимость'] = { avg: 4.3, pct5plus: 0 }; // только по среднему
    scores['Покорность'] = { avg: 3.5, pct5plus: 60 }; // только по классике
    const rows = buildYsqProfile(scores).flatMap((d) => d.rows);
    expect(rows.map((r) => r.label).sort()).toEqual([
      'Покорность',
      'Уязвимость',
    ]);
  });

  it('отсутствующий счёт схемы — защитный ноль, в профиль не идёт', () => {
    const scores = allScores(5, 80);
    delete scores['Неуспешность'];
    const rows = buildYsqProfile(scores).flatMap((d) => d.rows);
    expect(rows.find((r) => r.label === 'Неуспешность')).toBeUndefined();
    expect(rows).toHaveLength(SCHEMAS.length - 1);
  });
});

describe('ysqProfileCardHeight', () => {
  it('растёт с числом строк: добавление домена с схемами увеличивает высоту', () => {
    const domains = buildYsqProfile(allScores(5, 80));
    const withoutLast = domains.slice(0, -1);
    expect(ysqProfileCardHeight(domains)).toBeGreaterThan(
      ysqProfileCardHeight(withoutLast),
    );
  });

  it('высота линейна по числу строк внутри профиля одинакового размера', () => {
    const domains = buildYsqProfile(allScores(5, 80));
    // Убираем по одной строке из каждого домена — число групп то же, строк меньше.
    const trimmed = domains.map((d) => ({ ...d, rows: d.rows.slice(1) }));
    const removedRows =
      domains.reduce((n, d) => n + d.rows.length, 0) -
      trimmed.reduce((n, d) => n + d.rows.length, 0);
    const diff = ysqProfileCardHeight(domains) - ysqProfileCardHeight(trimmed);
    // Разница делится ровно на число убранных строк — то есть каждая строка
    // добавляет фиксированную высоту, а не «магическое число» реализации.
    expect(diff % removedRows).toBe(0);
    expect(diff / removedRows).toBeGreaterThan(0);
  });

  // Регрессия: заголовок «Выраженных схем не обнаружено» переносится на две
  // строки, а высота считалась как для одной — последняя группа схем уезжала
  // под брендовый футер.
  it('заголовок в две строки добавляет высоту', () => {
    const domains = buildYsqProfile(allScores(5, 80));
    expect(ysqProfileCardHeight(domains, true, 2)).toBeGreaterThan(
      ysqProfileCardHeight(domains, true, 1),
    );
  });

  it('дата в подписи увеличивает высоту (есть подпись под заголовком)', () => {
    const domains = buildYsqProfile(allScores(5, 80));
    expect(ysqProfileCardHeight(domains, true)).toBeGreaterThan(
      ysqProfileCardHeight(domains, false),
    );
  });

  it('пустой профиль не ломает формулу и не уходит в ноль/NaN', () => {
    const h = ysqProfileCardHeight([]);
    expect(Number.isFinite(h)).toBe(true);
    expect(h).toBeGreaterThan(FOOTER_H);
  });

  it('пустой профиль ниже профиля с выраженными схемами', () => {
    const domains = buildYsqProfile(allScores(5, 80));
    expect(ysqProfileCardHeight([])).toBeLessThan(
      ysqProfileCardHeight(domains),
    );
  });
});
