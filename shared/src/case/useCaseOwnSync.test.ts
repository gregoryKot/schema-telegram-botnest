// Чистые помощники «своего» (шаги тела/порыва): лимит относится только к
// тапнутым чипам, own-id живёт хвостом и следует за непустым текстом.
// Поведение в связке с состоянием потока — useCaseFlowState.test.ts.
import { describe, it, expect } from 'vitest';
import {
  IMPULSE_OWN_ID,
  isOwnChipId,
  ownChipIdForGate,
  syncOwnChipId,
  tappedChipIds,
  toggleTappedChip,
} from './useCaseOwnSync';

describe('isOwnChipId / ownChipIdForGate', () => {
  it('распознаёт own-id всех контент-банков', () => {
    expect(isOwnChipId('fear_own')).toBe(true);
    expect(isOwnChipId(IMPULSE_OWN_ID)).toBe(true);
    expect(isOwnChipId('fear_heartbeat')).toBe(false);
  });

  it('ворота без выбора дают unknown_own', () => {
    expect(ownChipIdForGate('fear')).toBe('fear_own');
    expect(ownChipIdForGate(null)).toBe('unknown_own');
  });
});

describe('tappedChipIds', () => {
  it('отфильтровывает own-id, порядок тапнутых сохраняется', () => {
    expect(tappedChipIds(['a', 'fear_own', 'b'])).toEqual(['a', 'b']);
  });
});

describe('toggleTappedChip — лимит только для тапнутых', () => {
  it('добавляет до лимита, own-хвост остаётся последним', () => {
    expect(toggleTappedChip(['a', 'fear_own'], 'b', 2)).toEqual([
      'a',
      'b',
      'fear_own',
    ]);
  });

  it('own-id в списке не занимает слот', () => {
    // 1 тапнутый + own: лимит 2 ещё не исчерпан
    expect(toggleTappedChip(['a', 'fear_own'], 'b', 2)).not.toBeNull();
    // 2 тапнутых: третий блокируется независимо от own
    expect(toggleTappedChip(['a', 'b', 'fear_own'], 'c', 2)).toBeNull();
  });

  it('снятие выбранного работает и при исчерпанном лимите', () => {
    expect(toggleTappedChip(['a', 'b'], 'a', 2)).toEqual(['b']);
  });
});

describe('syncOwnChipId — own-id следует за текстом', () => {
  it('null, когда уже согласовано (эффект не делает лишний setState)', () => {
    expect(syncOwnChipId(['a', 'fear_own'], 'fear_own', 'текст')).toBeNull();
    expect(syncOwnChipId(['a'], 'fear_own', '')).toBeNull();
  });

  it('непустой текст добавляет own-id последним, пробелы — не текст', () => {
    expect(syncOwnChipId(['a'], 'fear_own', 'текст')).toEqual([
      'a',
      'fear_own',
    ]);
    expect(syncOwnChipId(['a', 'fear_own'], 'fear_own', '   ')).toEqual(['a']);
  });

  it('устаревший own-id других ворот заменяется на текущий', () => {
    expect(syncOwnChipId(['a', 'fear_own'], 'sad_own', 'текст')).toEqual([
      'a',
      'sad_own',
    ]);
  });
});
