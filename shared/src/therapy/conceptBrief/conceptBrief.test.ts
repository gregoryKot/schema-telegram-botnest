// Экран «Главное» (2026-11): реестр блоков и набор по умолчанию, разбор выбора
// из хранилища (мусор → по умолчанию, пустой массив — законное «ничего»),
// переключение в порядке реестра, сборка секций с черновиком поверх.
import { describe, it, expect } from 'vitest';
import {
  BRIEF_BLOCKS,
  DEFAULT_BRIEF_BLOCKS,
  buildConceptBrief,
  parseBriefBlocks,
  serializeBriefBlocks,
  toggleBriefBlock,
} from './conceptBrief';
import { emptyModeLink } from '../conceptGraph/modeLinks';
import { emptySchemaLink } from '../conceptGraph/schemaLinks';

describe('parseBriefBlocks', () => {
  it('нет записи или мусор — набор по умолчанию: схема случая и цели без ранних полей', () => {
    expect(DEFAULT_BRIEF_BLOCKS).toEqual([
      'schemas',
      'modes',
      'needs',
      'cycle',
      'goals',
      'problems',
    ]);
    expect(parseBriefBlocks(null)).toEqual(DEFAULT_BRIEF_BLOCKS);
    expect(parseBriefBlocks('')).toEqual(DEFAULT_BRIEF_BLOCKS);
    expect(parseBriefBlocks('{not json')).toEqual(DEFAULT_BRIEF_BLOCKS);
    expect(parseBriefBlocks('"schemas"')).toEqual(DEFAULT_BRIEF_BLOCKS);
  });

  it('выбор — в порядке реестра, неизвестные id отброшены, пустой массив — «ничего»', () => {
    expect(parseBriefBlocks('["early","schemas","ghost",7]')).toEqual([
      'schemas',
      'early',
    ]);
    expect(parseBriefBlocks('[]')).toEqual([]);
  });

  it('запись → разбор возвращает тот же выбор (сохранил → нашёл)', () => {
    const picked = toggleBriefBlock(
      toggleBriefBlock(DEFAULT_BRIEF_BLOCKS, 'goals'),
      'triggers',
    );
    expect(picked).toEqual([
      'schemas',
      'modes',
      'needs',
      'cycle',
      'problems',
      'triggers',
    ]);
    expect(parseBriefBlocks(serializeBriefBlocks(picked))).toEqual(picked);
  });

  it('реестр: у каждого блока своя подпись', () => {
    expect(new Set(BRIEF_BLOCKS.map((b) => b.label)).size).toBe(
      BRIEF_BLOCKS.length,
    );
  });
});

describe('buildConceptBrief', () => {
  const concept = {
    schemaIds: ['failure'],
    modeIds: ['punitive_critic', 'detached_protector', 'healthy_adult'],
    modeLinks: [
      {
        ...emptyModeLink('punitive_critic'),
        alias: 'Судья',
        schemaIds: ['failure'],
        manifest: 'Ты опять всё испортил',
      },
      { ...emptyModeLink('healthy_adult'), needIds: ['limits'] },
    ],
    schemaLinks: [{ ...emptySchemaLink('failure'), needIds: ['autonomy'] }],
    goals: 'Снизить тревогу',
    currentProblems: null,
    modeTransitions: 'Критика → Судья → уход',
    triggers: '  оценка на работе ',
  };

  it('секции только выбранных блоков, в порядке реестра; пустой выбранный блок — empty, а не пропуск', () => {
    const s = buildConceptBrief(concept, undefined, [
      'problems',
      'schemas',
      'modes',
    ]);
    expect(s.map((x) => [x.id, x.kind, x.empty])).toEqual([
      ['schemas', 'chips', false],
      ['modes', 'modes', false],
      ['problems', 'text', true],
    ]);
    expect(s[0].items).toEqual([
      { text: 'Неуспешность', hue: 70, sign: 'domain_autonomy' },
    ]);
    expect(s[1].modes).toEqual([
      {
        modeId: 'punitive_critic',
        name: 'Судья (Карающий Критик)',
        hue: 310,
        lane: 'Критик',
        manifest: 'Ты опять всё испортил',
        schemas: ['Неуспешность'],
      },
      {
        modeId: 'detached_protector',
        name: 'Отстранённый Защитник',
        hue: 240,
        lane: 'Избегание',
        manifest: '',
        schemas: [],
      },
      {
        modeId: 'healthy_adult',
        name: 'Здоровый Взрослый',
        hue: 145,
        lane: 'Здоровый',
        manifest: '',
        schemas: [],
      },
    ]);
  });

  it('текстовые поля — обрезка пробелов; потребности — плашки сводки', () => {
    const s = buildConceptBrief(concept, undefined, [
      'needs',
      'cycle',
      'goals',
      'triggers',
    ]);
    expect(s.map((x) => x.text)).toEqual([
      '',
      'Критика → Судья → уход',
      'Снизить тревогу',
      'оценка на работе',
    ]);
    expect(s[0].items.map((i) => i.text)).toEqual([
      '✗ блокированы:',
      'Автономия',
      '✓ есть опора:',
      'Границы',
    ]);
  });

  it('черновик сильнее сервера; нет выбора — нет секций', () => {
    const s = buildConceptBrief(
      concept,
      { goals: 'Вернуть злость', modeTransitions: '' },
      ['cycle', 'goals'],
    );
    expect(s[0].empty).toBe(true);
    expect(s[1].text).toBe('Вернуть злость');
    expect(buildConceptBrief(concept, undefined, [])).toEqual([]);
    expect(buildConceptBrief(null, undefined, ['goals'])[0].empty).toBe(true);
  });
});
