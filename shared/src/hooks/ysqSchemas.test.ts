// Сверка ты/вы для реестра схем (правило №4 CLAUDE.md — денормализованные
// пары обязаны проверяться тестом). `SCHEMAS[i].tip` — ты-текст по умолчанию,
// `TIP_VY` — параллельный словарь с вы-формой по имени схемы (архитектура
// отличается от билдера buildX(tr): SCHEMAS — статический модульный
// константный массив без доступа к addressForm, поэтому вы-вариант вынесен в
// отдельную таблицу и подставляется потребителем через
// `tr(schema.tip, TIP_VY[schema.name] ?? schema.tip)` — см. YSQTestSheet.tsx
// и YsqActiveSchemaCard.tsx). Без этого теста рассинхрон (новая схема или
// правка tip без пары в TIP_VY) молча откатывает вы-пользователя на ты-текст.
import { describe, it, expect } from 'vitest';
import { SCHEMAS, TIP_VY } from './ysqSchemas';

describe('ysqSchemas: SCHEMAS.tip ⇄ TIP_VY', () => {
  it('у каждой схемы есть вы-вариант совета в TIP_VY', () => {
    for (const s of SCHEMAS) {
      expect(TIP_VY, `нет TIP_VY['${s.name}']`).toHaveProperty(s.name);
      expect(TIP_VY[s.name].trim().length).toBeGreaterThan(0);
    }
  });

  it('в TIP_VY нет отвязанных ключей — на них не было бы потребителя', () => {
    const names = new Set(SCHEMAS.map((s) => s.name));
    for (const key of Object.keys(TIP_VY)) {
      expect(
        names.has(key),
        `TIP_VY['${key}'] не ссылается ни на одну схему`,
      ).toBe(true);
    }
  });

  it('вы-вариант отличается от ты-варианта (не забыли развести)', () => {
    for (const s of SCHEMAS) {
      const vy = TIP_VY[s.name];
      if (vy === undefined) continue; // уже упало в первом тесте
      expect(
        vy,
        `TIP_VY['${s.name}'] совпадает с ты-текстом — вы-форма не разведена`,
      ).not.toBe(s.tip);
    }
  });
});
