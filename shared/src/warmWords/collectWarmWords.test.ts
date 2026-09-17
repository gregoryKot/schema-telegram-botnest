import { describe, it, expect } from 'vitest';
import { collectWarmWords } from './collectWarmWords';

describe('collectWarmWords', () => {
  it('пустые входы → пустой список', () => {
    expect(collectWarmWords([], [])).toEqual([]);
  });

  it('фильтрует пустые/пробельные тексты из обоих источников', () => {
    const items = collectWarmWords(
      [
        { modeId: 'critic', healthyView: '   ', updatedAt: '2026-01-01' },
        { modeId: 'child', healthyView: undefined, updatedAt: '2026-01-01' },
      ],
      [
        {
          id: 1,
          modeId: 'critic',
          healthyResponse: '',
          createdAt: '2026-01-01',
        },
        {
          id: 2,
          modeId: 'child',
          healthyResponse: null,
          createdAt: '2026-01-01',
        },
      ],
    );
    expect(items).toEqual([]);
  });

  it('сортирует новые сверху и смешивает источники', () => {
    const items = collectWarmWords(
      [
        {
          modeId: 'critic',
          healthyView: 'Я справлюсь',
          updatedAt: '2026-01-10',
        },
      ],
      [
        {
          id: 1,
          modeId: 'child',
          healthyResponse: 'Я в безопасности',
          createdAt: '2026-01-15',
        },
        {
          id: 2,
          modeId: 'child',
          healthyResponse: 'Всё пройдёт',
          createdAt: '2026-01-05',
        },
      ],
    );
    expect(items.map((i) => i.text)).toEqual([
      'Я в безопасности',
      'Я справлюсь',
      'Всё пройдёт',
    ]);
    expect(items.map((i) => i.source)).toEqual(['diary', 'card', 'diary']);
  });

  it('ключ уникален по источнику: diary-{id} / card-{modeId}, текст обрезан по краям', () => {
    const items = collectWarmWords(
      [
        {
          modeId: 'critic',
          healthyView: '  Ты справишься  ',
          updatedAt: '2026-01-01',
        },
      ],
      [
        {
          id: 7,
          modeId: 'critic',
          healthyResponse: 'Держись',
          createdAt: '2026-01-02',
        },
      ],
    );
    const byKey = Object.fromEntries(items.map((i) => [i.key, i]));
    expect(byKey['card-critic'].text).toBe('Ты справишься');
    expect(byKey['diary-7'].text).toBe('Держись');
  });
});

describe('collectWarmWords: разборы фразы', () => {
  const PHRASE = {
    id: 3,
    rewrite: '  вышло неточно, поправлю завтра  ',
    inWarmWords: true,
    createdAt: '2026-01-03',
  };

  it('переписанная фраза попадает в коллекцию, когда её туда позвали', () => {
    const items = collectWarmWords([], [], [PHRASE]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      key: 'phrase-3',
      source: 'phrase',
      text: 'вышло неточно, поправлю завтра',
      modeId: '',
    });
  });

  it('без флага не попадает — это выбор пользователя, а не автосбор', () => {
    expect(
      collectWarmWords([], [], [{ ...PHRASE, inWarmWords: false }]),
    ).toEqual([]);
    expect(
      collectWarmWords([], [], [{ ...PHRASE, inWarmWords: null }]),
    ).toEqual([]);
  });

  it('флаг есть, а фразы нет — в коллекцию ничего не кладём', () => {
    expect(collectWarmWords([], [], [{ ...PHRASE, rewrite: '   ' }])).toEqual(
      [],
    );
    expect(collectWarmWords([], [], [{ ...PHRASE, rewrite: null }])).toEqual(
      [],
    );
  });

  it('третий источник встаёт в общую сортировку по дате, а не в конец списка', () => {
    const items = collectWarmWords(
      [{ modeId: 'critic', healthyView: 'старое', updatedAt: '2026-01-01' }],
      [
        {
          id: 9,
          modeId: 'critic',
          healthyResponse: 'самое новое',
          createdAt: '2026-01-05',
        },
      ],
      [PHRASE],
    );
    expect(items.map((i) => i.source)).toEqual(['diary', 'phrase', 'card']);
  });

  it('старый вызов без третьего аргумента продолжает работать', () => {
    const items = collectWarmWords(
      [{ modeId: 'critic', healthyView: 'слова', updatedAt: '2026-01-01' }],
      [],
    );
    expect(items).toHaveLength(1);
  });
});
