// Тест чистой логики карточки-профиля теста на схемы: короткие подписи,
// группировка по потребностям, критерии выраженности, формула высоты.
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
  it('покрывает все 20 схем, домены — в порядке DOMAIN_ORDER', () => {
    const domains = buildYsqProfile(allScores());
    expect(domains.map((d) => d.needId)).toEqual(DOMAIN_ORDER);
    const rows = domains.reduce((n, d) => n + d.rows.length, 0);
    expect(rows).toBe(SCHEMAS.length);
  });

  it('внутри домена схемы отсортированы по убыванию среднего балла', () => {
    const scores = allScores();
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

  it('активность — по любому из двух критериев (средний ≥ 4 ИЛИ >50% ответов 5–6)', () => {
    const scores = allScores(2, 0);
    scores['Уязвимость'] = { avg: 4.3, pct5plus: 0 }; // только по среднему
    scores['Покорность'] = { avg: 3.5, pct5plus: 60 }; // только по классике
    const rows = buildYsqProfile(scores).flatMap((d) => d.rows);
    const byLabel = Object.fromEntries(rows.map((r) => [r.label, r]));
    expect(byLabel['Уязвимость'].active).toBe(true);
    expect(byLabel['Покорность'].active).toBe(true);
    expect(rows.filter((r) => r.active)).toHaveLength(2);
  });

  it('отсутствующий счёт схемы — защитный ноль, не активна', () => {
    const scores = allScores();
    delete scores['Неуспешность'];
    const rows = buildYsqProfile(scores).flatMap((d) => d.rows);
    const row = rows.find((r) => r.label === 'Неуспешность')!;
    expect(row.avg).toBe(0);
    expect(row.active).toBe(false);
  });
});

describe('ysqProfileCardHeight', () => {
  it('складывается из шапки, групп, строк и футера', () => {
    const domains = buildYsqProfile(allScores());
    // 158 (шапка+счёт) + 5×(26+6) + 20×24 + 8 + футер
    expect(ysqProfileCardHeight(domains)).toBe(158 + 160 + 480 + 8 + FOOTER_H);
  });

  it('пустой профиль не ломает формулу', () => {
    expect(ysqProfileCardHeight([])).toBe(158 + 8 + FOOTER_H);
  });
});
