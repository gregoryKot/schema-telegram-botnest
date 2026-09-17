// Раньше это был контент двух отдельных файлов (webapp/schema-miniapp) —
// тест держит единственный источник целым: все пять потребностей на месте,
// у каждой полный набор советов, и форма «вы» не подсовывает «ты»-текст.
import { describe, it, expect } from 'vitest';
import { NEED_ORDER, buildNeedData, getNeedData } from './needData';

const tr = (ty: string, vy: string) => `${ty}|${vy}`;

describe('needData', () => {
  it('содержит все пять потребностей реестра NEED_ORDER и ничего лишнего', () => {
    const data = buildNeedData(tr);
    expect(Object.keys(data).sort()).toEqual([...NEED_ORDER].sort());
  });

  it('у каждой потребности полный набор советов по уровням', () => {
    const data = buildNeedData(tr);
    for (const id of NEED_ORDER) {
      const need = data[id];
      expect(need.tips.low.length).toBeGreaterThan(0);
      expect(need.tips.medium.length).toBeGreaterThan(0);
      expect(need.tips.high.length).toBeGreaterThan(0);
      expect(need.name).toBeTruthy();
      expect(need.explanation).toBeTruthy();
      expect(need.ranges).toHaveLength(3);
    }
  });

  it('getNeedData отдаёт форму «ты» и «вы» без путаницы между ними', () => {
    const ty = getNeedData('ty');
    const vy = getNeedData('vy');
    // question для attachment различается между формами (см. content/attachment.ts)
    expect(ty.attachment.question).toContain('тебя услышали');
    expect(vy.attachment.question).toContain('вас услышали');
    expect(ty.attachment.question).not.toBe(vy.attachment.question);
  });

  it('getNeedData кеширует результат по форме — повторный вызов возвращает тот же объект', () => {
    expect(getNeedData('ty')).toBe(getNeedData('ty'));
  });
});
