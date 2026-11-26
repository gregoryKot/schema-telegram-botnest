/**
 * Сверка (правило №4): итог быстрого разбора, «Карта себя», «Мои паттерны» и
 * «Записи» называют режим одним каноническим именем из реестра, а не фразой ворот.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_MODES } from '../schemaTherapy/schemaTherapyData';
import { modeClinicalName, modeDisplayName } from './modeDisplayName';
import { getModeLeafLabel } from './modeFeelGates';
import { quickModeName } from '../case/quick/caseQuick';
import { modeMeta } from '../pattern/patternMeta';
import { collectModeItems } from '../map/mapVm';

describe('имя режима — один источник на четырёх экранах', () => {
  const items = collectModeItems({
    cases: ALL_MODES.map((m) => ({ modeId: m.id, at: '2026-11-01' })),
    notes: [],
    warmWords: [],
    ysqDone: false,
    today: '2026-11-26',
  });
  const mapName = new Map(items.map((i) => [i.modeId, i.name]));

  it.each(ALL_MODES.map((m) => [m.id, m.name]))('%s → %s', (id, name) => {
    expect(modeClinicalName(id)).toBe(name);
    expect(quickModeName(id)).toBe(name);
    expect(mapName.get(id)).toBe(name);
    expect(modeMeta(id)?.name).toBe(name);
    expect(modeDisplayName(id)).toBe(name);
  });

  it('бытовая фраза ворот («Неловко отказать — соглашаюсь») именем не становится', () => {
    const phrase = getModeLeafLabel('compliant_surrenderer');
    expect(phrase).toBe('Неловко отказать — соглашаюсь');
    expect(mapName.get('compliant_surrenderer')).toBe('Послушный Капитулянт');
    expect(mapName.get('compliant_surrenderer')).not.toBe(phrase);
  });

  it('«Записи» берут заголовок той же функцией', () => {
    const src = readFileSync(
      join(__dirname, '../../../webapp/src/sections/diary/EntryCards.tsx'),
      'utf8',
    );
    expect(src).toMatch(/title=\{mode \? modeClinicalName\(mode\.id\)/);
  });
});
