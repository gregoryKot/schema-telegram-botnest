// Поисковые синонимы названий: другой перевод находит строку, но не обгоняет найденную по своему названию.
import { describe, it, expect } from 'vitest';
import { ALL_MODES, ALL_SCHEMAS } from '../schemaTherapy/schemaTherapyData';
import { SEARCH_ALIASES, searchAliases } from '../schemaTherapy/searchAliases';
import { normalizeSearchText } from '../utils/searchNormalize';
import {
  aliasScore,
  rankRowsWithAliases,
  rowScoreWithAliases,
} from './aliasScore';
import { ROW_SCORE } from './rankRows';

const NAME = 'Покинутость / Нестабильность';
const ALIASES = searchAliases('schema', 'abandonment');

describe('aliasScore', () => {
  it('синоним находит строку: целиком, недописанный, в другом падеже и с одной опечаткой', () => {
    expect(aliasScore(NAME, ALIASES, 'заброшенность')).toBe(ROW_SCORE.stems);
    expect(aliasScore(NAME, ALIASES, 'заброш')).toBe(ROW_SCORE.stems);
    expect(aliasScore(NAME, ALIASES, 'заброшенности')).toBe(ROW_SCORE.stems);
    expect(aliasScore(NAME, ALIASES, 'заброшеность')).toBe(ROW_SCORE.typo);
  });

  it('синоним-слово ищется вместе с названием: «злой ребёнок» находит «Сердитого Ребёнка»', () => {
    expect(
      aliasScore(
        'Сердитый Ребёнок',
        searchAliases('mode', 'angry_child'),
        'злой ребёнок',
      ),
    ).toBe(ROW_SCORE.stems);
    expect(
      aliasScore(
        'Сердитый Ребёнок',
        searchAliases('mode', 'angry_child'),
        'злой критик',
      ),
    ).toBe(ROW_SCORE.none);
  });

  it('без синонимов и без запроса веса нет; чужое слово не подходит', () => {
    expect(aliasScore(NAME, [], 'заброшенность')).toBe(ROW_SCORE.none);
    expect(aliasScore(NAME, ALIASES, ' ')).toBe(ROW_SCORE.none);
    expect(aliasScore(NAME, ALIASES, 'перфекционизм')).toBe(ROW_SCORE.none);
  });

  it('совпадение по своему названию остаётся выше совпадения по синониму', () => {
    expect(rowScoreWithAliases(NAME, '', 'покинутость', ALIASES)).toBe(
      ROW_SCORE.starts,
    );
    expect(rowScoreWithAliases(NAME, '', 'заброшенность', ALIASES)).toBe(
      ROW_SCORE.stems,
    );
    const rows = [
      { label: 'Заброшенность в детстве', text: '' },
      { label: NAME, text: '', aliases: ALIASES },
      { label: 'Другое', text: '' },
    ];
    expect(
      rankRowsWithAliases(rows, 'заброшенность', (r) => r).map(
        (r) => r.row.label,
      ),
    ).toEqual(['Заброшенность в детстве', NAME]);
  });
});

describe('реестр синонимов', () => {
  it('каждый ключ — id схемы или режима из каталога', () => {
    const schemaIds = new Set(ALL_SCHEMAS.map((s) => s.id));
    const modeIds = new Set(ALL_MODES.map((m) => m.id));
    expect(
      Object.keys(SEARCH_ALIASES.schema).filter((id) => !schemaIds.has(id)),
    ).toEqual([]);
    expect(
      Object.keys(SEARCH_ALIASES.mode).filter((id) => !modeIds.has(id)),
    ).toEqual([]);
  });

  it('синонимы — ключи поиска в нормализованном виде (строчные, без «ё»), не названия', () => {
    const all = [
      ...Object.values(SEARCH_ALIASES.schema),
      ...Object.values(SEARCH_ALIASES.mode),
    ].flat();
    expect(
      all.filter((a) => a !== normalizeSearchText(a) || a.trim() === ''),
    ).toEqual([]);
  });

  it('лист другого вида и незнакомый id — без синонимов', () => {
    expect(searchAliases('technique', 'abandonment')).toEqual([]);
    expect(searchAliases('schema', 'нет такой')).toEqual([]);
  });
});
