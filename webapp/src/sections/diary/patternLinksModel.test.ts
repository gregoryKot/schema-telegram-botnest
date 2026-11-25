// @vitest-environment node
// Переходы из записи к карточке паттерна: схемы записи по порядку, режим записи; неизвестный id — без ссылки.
import { describe, it, expect } from 'vitest';
import { entryPatternLinks } from './patternLinksModel';
import { ALL_SCHEMAS, ALL_MODES } from '../../../../shared/src/schemaTherapy/schemaTherapyData';
import type { SchemaDiaryEntry, ModeDiaryEntry } from '../../types';

const at = new Date().toISOString();
const schema = (schemaIds: string[]): SchemaDiaryEntry => ({ id: 1, createdAt: at, trigger: 't', emotions: [], schemaIds });
const mode = (modeId: string): ModeDiaryEntry => ({ id: 2, createdAt: at, modeId, situation: 's' });

describe('entryPatternLinks', () => {
  it('запись схем — по ссылке на каждую известную схему, неизвестная пропущена', () => {
    const [a, b] = ALL_SCHEMAS;
    const links = entryPatternLinks({ _type: 'schema', entry: schema([a.id, 'нет-такой', b.id]) });
    expect(links).toEqual([{ kind: 'schema', id: a.id, name: a.name }, { kind: 'schema', id: b.id, name: b.name }]);
  });

  it('запись режима — ссылка на режим; удалённый режим — пусто', () => {
    const m = ALL_MODES[0];
    expect(entryPatternLinks({ _type: 'mode', entry: mode(m.id) })).toEqual([{ kind: 'mode', id: m.id, name: m.name }]);
    expect(entryPatternLinks({ _type: 'mode', entry: mode('нет-такого') })).toEqual([]);
  });

  it('запись без схем — без ссылок', () => {
    expect(entryPatternLinks({ _type: 'schema', entry: schema([]) })).toEqual([]);
  });
});
