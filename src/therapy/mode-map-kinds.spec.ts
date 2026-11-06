// Типы карт (#963): бэкенд знает те же kind, что фронт (правило №4). Тип
// ModeMapKind живёт в webapp, бэкенд его не импортирует — читаем из файла.
import { readFileSync } from 'fs';
import { join } from 'path';
import { MODE_MAP_KINDS, normalizeModeMapKind } from './mode-map-kinds';

describe('mode-map-kinds', () => {
  it('concept и free — известные типы, сохраняются как есть', () => {
    expect(normalizeModeMapKind('concept')).toBe('concept');
    expect(normalizeModeMapKind('free')).toBe('free');
    expect(normalizeModeMapKind('personality')).toBe('personality');
  });

  it('неизвестный и пустой kind — фолбэк на problem', () => {
    expect(normalizeModeMapKind('bogus')).toBe('problem');
    expect(normalizeModeMapKind(undefined)).toBe('problem');
    expect(normalizeModeMapKind('')).toBe('problem');
  });

  it('сверка с ModeMapKind фронта (webapp/src/api.types.ts)', () => {
    const src = readFileSync(
      join(__dirname, '../../webapp/src/api.types.ts'),
      'utf8',
    );
    const m = /export type ModeMapKind\s*=([^;]+);/.exec(src);
    expect(m).not.toBeNull();
    const front = [...m![1].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort();
    expect(front).toEqual([...MODE_MAP_KINDS].sort());
  });
});
