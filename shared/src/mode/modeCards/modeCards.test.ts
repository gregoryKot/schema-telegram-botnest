// Реестр-сверка (правило №4 CLAUDE.md): 35 id продублированы здесь ЖЁСТКО
// (не импортом из schema-miniapp — shared не зависит от фронтендов), чтобы
// тест падал сам по себе при рассинхроне карточек. Кросс-проверку с
// MODE_GROUPS делает отдельный фронтовый тест (не в этой задаче).
import { describe, it, expect } from 'vitest';
import { MODE_CARDS, getModeCard } from './index';
import type { ModeCard } from './types';
import { healthyAdultHint, DEFAULT_HINT } from '../healthyAdultHints';

const EXPECTED_IDS = [
  // child
  'vulnerable_child',
  'lonely_child',
  'abandoned_child',
  'humiliated_child',
  'dependent_child',
  'angry_child',
  'stubborn_child',
  'enraged_child',
  'impulsive_child',
  'undisciplined_child',
  // coping: surrender + avoidance
  'compliant_surrenderer',
  'helpless_surrenderer',
  'detached_protector',
  'detached_self_soother',
  'avoidant_protector',
  'angry_protector',
  // coping: overcompensation
  'self_aggrandiser',
  'overcontroller',
  'perfectionistic_oc',
  'suspicious_oc',
  'invincible_oc',
  'flagellating_oc',
  'compulsive_oc',
  'worrying_oc',
  'bully_attack',
  'manipulative',
  'predator',
  'attention_seeker',
  'pollyanna',
  // critic
  'demanding_critic',
  'punitive_critic',
  'guilt_critic',
  // healthy
  'happy_child',
  'healthy_adult',
  'good_parent',
];

const FIELDS: (keyof ModeCard)[] = [
  'about',
  'triggers',
  'body',
  'voice',
  'behavior',
  'origin',
  'cost',
  'need',
  'healthyAdult',
];

// Лимиты — из ТЗ («Длины» в описании ModeCard).
const LIMITS: Record<keyof ModeCard, number> = {
  about: 200,
  triggers: 120,
  body: 120,
  voice: 90,
  behavior: 120,
  origin: 140,
  cost: 140,
  need: 140,
  healthyAdult: 180,
};

// Форма обращения ты/вы (правило CLAUDE.md) — те же слова, что гейтит
// scripts/check-address-form.mjs (TY_RE), плюс симметричные «вы»-формы.
// \b в JS не видит кириллицу, поэтому границы слова — через lookaround.
const TY_VY_RE =
  /(?<![А-Яа-яЁёA-Za-z])([Тт]ы|[Тт]ебя|[Тт]ебе|[Тт]обой|[Тт]во(?:й|я|ё|е|и|их|им|ей|ю)|[Вв]ы|[Вв]ас|[Вв]ам|[Вв]ами|[Вв]аш\w*)(?![А-Яа-яЁё])/;
// Глаголы 2 л. ед.ч. («отметь-ешь/-ёшь/-аешь», «говор-ишь»). Пара частых
// слов совпадает по хвосту, не будучи глаголом («лишь», «тишь») — явное
// исключение, а не ослабление регулярки.
const VERB_2P_RE =
  /(?<![А-Яа-яЁёA-Za-z])([а-яё]+(?:ешь|ёшь|аешь|ишь))(?![А-Яа-яЁё])/gi;
const VERB_2P_EXCEPTIONS = new Set(['лишь', 'тишь']);

function hasSecondPersonVerb(value: string): boolean {
  for (const m of value.matchAll(VERB_2P_RE)) {
    if (!VERB_2P_EXCEPTIONS.has(m[1].toLowerCase())) return true;
  }
  return false;
}

describe('MODE_CARDS — реестр 35 id', () => {
  const actualIds = Object.keys(MODE_CARDS).sort();
  const expectedSorted = [...EXPECTED_IDS].sort();

  it('ни одного лишнего/пропущенного id — сверка со списком режимов ТЗ', () => {
    expect(actualIds).toEqual(expectedSorted);
  });

  it('ровно 35 карточек', () => {
    expect(actualIds).toHaveLength(35);
  });

  it.each(EXPECTED_IDS)('getModeCard(%s) находит карточку', (id) => {
    expect(getModeCard(id)).toBeDefined();
  });

  it('getModeCard для несуществующего id возвращает undefined', () => {
    expect(getModeCard('not_a_real_mode')).toBeUndefined();
  });
});

describe('MODE_CARDS — содержимое каждой карточки', () => {
  for (const id of EXPECTED_IDS) {
    const card = MODE_CARDS[id];

    it(`${id}: все 9 полей непустые`, () => {
      for (const field of FIELDS) {
        expect(card[field].trim().length, `поле ${field}`).toBeGreaterThan(0);
      }
    });

    it(`${id}: длины полей в лимитах ТЗ`, () => {
      for (const field of FIELDS) {
        expect(
          card[field].length,
          `${field}: "${card[field]}" (${card[field].length} симв., лимит ${LIMITS[field]})`,
        ).toBeLessThanOrEqual(LIMITS[field]);
      }
    });

    it(`${id}: нет ты/вы-форм и глаголов 2 л. ед.ч.`, () => {
      for (const field of FIELDS) {
        const value = card[field];
        expect(TY_VY_RE.test(value), `${field}: "${value}"`).toBe(false);
        expect(hasSecondPersonVerb(value), `${field}: "${value}"`).toBe(false);
      }
    });
  }
});

describe('healthyAdultHint — приоритет карточки над семьёй теста', () => {
  it('известный режим: возвращает именно healthyAdult из карточки', () => {
    expect(healthyAdultHint('vulnerable_child')).toBe(
      MODE_CARDS.vulnerable_child.healthyAdult,
    );
    expect(healthyAdultHint('detached_protector')).toBe(
      MODE_CARDS.detached_protector.healthyAdult,
    );
  });

  it('несуществующий id: падает на нейтральный дефолт', () => {
    expect(healthyAdultHint('not_a_real_mode')).toBe(DEFAULT_HINT);
  });
});
