// Покрываем: CASE_IMPULSES дословно с «Своё…» последним чипом; каждый
// modeId в IMPULSE_SECOND_DOOR реально существует в реестре режимов
// (правило №4 CLAUDE.md — денормализованное соответствие проверяется
// тестом-сверкой); suggestSecondDoor — null при совпадении с выбранным
// режимом, modeId при расхождении, null на пустом списке порывов.
import { describe, it, expect } from 'vitest';
import {
  CASE_IMPULSES,
  IMPULSE_SECOND_DOOR,
  suggestSecondDoor,
  buildSecondDoorNote,
} from './caseImpulses';
import { ALL_TEST_MODE_IDS, findTestGroupByModeId } from '../mode/modeTest';
import type { Tr } from './caseTypes';

const tyTr: Tr = (ty) => ty;

describe('CASE_IMPULSES', () => {
  it('восемь чипов, последний — «Своё…» с id impulse_own', () => {
    expect(CASE_IMPULSES.length).toBe(8);
    expect(CASE_IMPULSES[CASE_IMPULSES.length - 1]).toEqual({
      id: 'impulse_own',
      label: 'Своё…',
    });
  });

  it('id уникальны, label непустые', () => {
    expect(new Set(CASE_IMPULSES.map((c) => c.id)).size).toBe(
      CASE_IMPULSES.length,
    );
    for (const chip of CASE_IMPULSES) {
      expect(chip.label.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('IMPULSE_SECOND_DOOR — сверка с реестром режимов', () => {
  const entries = Object.entries(IMPULSE_SECOND_DOOR);

  it('шесть маппингов (не у каждого чипа есть вторая дверь)', () => {
    expect(entries.length).toBe(6);
  });

  it.each(entries)(
    '%s → %s: modeId существует в MODE_TEST_GROUPS',
    (_chipId, modeId) => {
      expect(ALL_TEST_MODE_IDS).toContain(modeId);
      expect(findTestGroupByModeId(modeId)).toBeTruthy();
    },
  );

  it('ключи — реальные id из CASE_IMPULSES', () => {
    const impulseIds = new Set(CASE_IMPULSES.map((c) => c.id));
    for (const chipId of Object.keys(IMPULSE_SECOND_DOOR)) {
      expect(impulseIds.has(chipId)).toBe(true);
    }
  });
});

describe('suggestSecondDoor', () => {
  it('пустой список порывов — null', () => {
    expect(suggestSecondDoor('sad', [], 'lonely_child')).toBeNull();
  });

  it('порыв совпадает с выбранным режимом — null', () => {
    expect(
      suggestSecondDoor('drained', ['impulse_close'], 'avoidant_protector'),
    ).toBeNull();
  });

  it('порыв расходится с выбранным режимом — возвращает modeId второй двери', () => {
    expect(suggestSecondDoor('sad', ['impulse_phone'], 'lonely_child')).toBe(
      'detached_self_soother',
    );
  });

  it('чип без записи в реестре (impulse_agree/impulse_own) не даёт подсказки', () => {
    expect(
      suggestSecondDoor(
        'shame',
        ['impulse_agree', 'impulse_own'],
        'humiliated_child',
      ),
    ).toBeNull();
  });

  it('первое расхождение среди нескольких порывов побеждает', () => {
    // impulse_agree не в реестре — пропускается; impulse_sharp совпадает с
    // выбранным режимом — тоже пропускается; impulse_phone расходится и
    // побеждает.
    expect(
      suggestSecondDoor(
        'anger',
        ['impulse_agree', 'impulse_sharp', 'impulse_phone'],
        'angry_child',
      ),
    ).toBe('detached_self_soother');
  });
});

describe('buildSecondDoorNote', () => {
  it('непустая строка', () => {
    expect(buildSecondDoorNote(tyTr).length).toBeGreaterThan(0);
  });
});
