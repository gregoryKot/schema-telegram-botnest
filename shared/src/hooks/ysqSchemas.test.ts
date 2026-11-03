// Сверка ты/вы для реестра схем (правило №4 CLAUDE.md — денормализованные
// пары обязаны проверяться тестом; правило «ты/вы» — билдер от формы, как
// shared/src/needs/needData.ts). Регресс: `tip` раньше жил как ты-дефолт на
// SCHEMAS плюс параллельный словарь TIP_VY, подставляемый потребителем через
// `tr(schema.tip, TIP_VY[schema.name] ?? schema.tip)` — забытая пара молча
// откатывала вы-пользователя на ты-текст, а гейт check-second-person не видел
// эти строки внутри вилки-подстановки. Теперь единственный источник —
// `buildYsqSchemas(tr)`, обе формы разведены в одном месте на схему.
import { describe, it, expect } from 'vitest';
import {
  SCHEMAS,
  SCHEMA_NAME_TO_ID,
  getYsqSchemas,
  buildYsqSchemas,
} from './ysqSchemas';
import { SCHEMA_DOMAINS } from '../schemaTherapy/content/schemaDomains';

// Остаточные «ты»-формы (местоимения/императивы) — грубая проверка гейта
// check-second-person.mjs на резолвленном тексте формы «вы», и наоборот.
const TY_RE =
  /(?<![А-Яа-яЁё])(?:[Тт]ы|[Тт]еб[ея]|[Тт]обой|[Тт]во(?:[её]|[ий]|я|ю|ими|его|ему))(?![А-Яа-яЁё])/;
const VY_RE =
  /(?<![А-Яа-яЁё])(?:[Вв]ы|[Вв]ас|[Вв]ам|[Вв]ами|[Вв]аш\w*)(?![А-Яа-яЁё])/;

describe('ysqSchemas: buildYsqSchemas(tr)', () => {
  it('не теряет схемы при сборке (id/имена совпадают между формами)', () => {
    const ty = getYsqSchemas('ty');
    const vy = getYsqSchemas('vy');
    expect(ty.length).toBe(20);
    expect(vy.length).toBe(ty.length);
    expect(vy.map((s) => s.name)).toEqual(ty.map((s) => s.name));
  });

  it('форма «вы» — ни один tip не содержит остаточных «ты»-форм', () => {
    for (const s of getYsqSchemas('vy')) {
      expect(
        TY_RE.test(s.tip),
        `SCHEMAS['${s.name}'].tip (вы): «${s.tip}»`,
      ).toBe(false);
    }
  });

  it('форма «ты» — ни один tip не содержит «вы»-форм', () => {
    for (const s of getYsqSchemas('ty')) {
      expect(
        VY_RE.test(s.tip),
        `SCHEMAS['${s.name}'].tip (ты): «${s.tip}»`,
      ).toBe(false);
    }
  });

  it('вы-вариант отличается от ты-варианта (не забыли развести)', () => {
    const ty = getYsqSchemas('ty');
    const vy = getYsqSchemas('vy');
    ty.forEach((s, i) => {
      expect(
        vy[i].tip,
        `tip['${s.name}'] совпадает в обеих формах — вы-вариант не разведён`,
      ).not.toBe(s.tip);
    });
  });

  it('SCHEMAS (ты-дефолт для потребителей без формы) совпадает с getYsqSchemas("ty")', () => {
    expect(SCHEMAS).toEqual(getYsqSchemas('ty'));
  });

  it('getYsqSchemas кеширует по форме (не пересобирает объект)', () => {
    expect(getYsqSchemas('ty')).toBe(getYsqSchemas('ty'));
    expect(getYsqSchemas('vy')).toBe(getYsqSchemas('vy'));
  });

  it('buildYsqSchemas(tr) вызывает tr ровно по одному разу на схему', () => {
    let calls = 0;
    buildYsqSchemas((ty) => {
      calls++;
      return ty;
    });
    expect(calls).toBe(20);
  });
});

// QA 2026-11 (B-М11): в результатах теста стояло «Социальная отчужденность»
// без «ё» и «Покинутость/Нестабильность» без пробелов, а в реестре схем и в
// docs/TERMINOLOGY.md — «отчуждённость» и «Покинутость / Нестабильность».
// Имя — ключ SCHEMA_NAME_TO_ID и подсветки схемы в «Библиотеке» (SchemasTab
// сравнивает по имени): «Посмотреть схему» из результата её не находила.
describe('ysqSchemas: имена совпадают с реестром схем (правило №4)', () => {
  const registry = new Map(
    SCHEMA_DOMAINS.flatMap((d) =>
      d.schemas.map((s) => [s.id, s.name] as const),
    ),
  );

  it.each(SCHEMAS.map((s) => [s.name] as const))(
    '«%s» — как в SCHEMA_DOMAINS',
    (name) => {
      const id = SCHEMA_NAME_TO_ID[name];
      expect(id).toBeDefined();
      expect(registry.get(id)).toBe(name);
    },
  );

  it('у каждого ключа SCHEMA_NAME_TO_ID есть схема в опроснике', () => {
    const names = new Set(SCHEMAS.map((s) => s.name));
    expect(Object.keys(SCHEMA_NAME_TO_ID).filter((n) => !names.has(n))).toEqual(
      [],
    );
  });
});
