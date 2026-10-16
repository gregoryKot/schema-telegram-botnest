import { describe, it, expect } from 'vitest';
import { MODE_GROUPS } from '../../schemaTherapy/schemaTherapyData';
import {
  COPING_KIND_LABEL,
  MANIFEST_FIELD,
  STRATEGY_HINTS,
  copingKindOf,
  groupIdsOfLane,
  laneOfMode,
  strategyGroupOf,
} from './modeLanes';

const ALL_MODE_IDS = MODE_GROUPS.flatMap((g) => g.items.map((m) => m.id));

describe('laneOfMode', () => {
  it('раскладывает группы по клеткам шаблона Редигера', () => {
    expect(laneOfMode('vulnerable_child')).toBe('child');
    expect(laneOfMode('punitive_critic')).toBe('critic');
    expect(laneOfMode('healthy_adult')).toBe('healthy');
    expect(laneOfMode('compliant_surrenderer')).toBe('coping');
    expect(laneOfMode('detached_protector')).toBe('coping');
    expect(laneOfMode('bully_attack')).toBe('coping');
  });

  it('неизвестный id — null', () => {
    expect(laneOfMode('no_such_mode')).toBeNull();
    expect(laneOfMode('')).toBeNull();
  });

  it('каждый режим реестра попадает в какую-то клетку и имеет группу подхода', () => {
    for (const id of ALL_MODE_IDS) {
      expect(laneOfMode(id), id).not.toBeNull();
      const group = strategyGroupOf(id);
      expect(group, id).not.toBeNull();
      expect(STRATEGY_HINTS[group!], id).toBeTruthy();
    }
  });
});

describe('copingKindOf', () => {
  it('вид копинга по группе, у остальных режимов его нет', () => {
    expect(copingKindOf('compliant_surrenderer')).toBe('surrender');
    expect(copingKindOf('angry_protector')).toBe('avoidance');
    expect(copingKindOf('pollyanna')).toBe('overcompensation');
    expect(copingKindOf('vulnerable_child')).toBeUndefined();
    expect(copingKindOf('no_such_mode')).toBeUndefined();
  });
});

describe('strategyGroupOf', () => {
  it('детские режимы делятся на уязвимых, злых и импульсивных', () => {
    for (const id of [
      'vulnerable_child',
      'lonely_child',
      'abandoned_child',
      'humiliated_child',
      'dependent_child',
    ]) {
      expect(strategyGroupOf(id)).toBe('vulnerable');
    }
    for (const id of ['angry_child', 'stubborn_child', 'enraged_child']) {
      expect(strategyGroupOf(id)).toBe('angry');
    }
    for (const id of ['impulsive_child', 'undisciplined_child']) {
      expect(strategyGroupOf(id)).toBe('impulsive');
    }
  });

  it('критики: карающий и вины — с карающим подходом, требовательный — свой', () => {
    expect(strategyGroupOf('punitive_critic')).toBe('punitive');
    expect(strategyGroupOf('guilt_critic')).toBe('punitive');
    expect(strategyGroupOf('demanding_critic')).toBe('demanding');
  });

  it('копинги — по виду, здоровые — по id, неизвестный — null', () => {
    expect(strategyGroupOf('helpless_surrenderer')).toBe('surrender');
    expect(strategyGroupOf('avoidant_protector')).toBe('avoidance');
    expect(strategyGroupOf('predator')).toBe('overcompensation');
    expect(strategyGroupOf('healthy_adult')).toBe('healthy_adult');
    expect(strategyGroupOf('happy_child')).toBe('happy_child');
    expect(strategyGroupOf('good_parent')).toBe('good_parent');
    expect(strategyGroupOf('no_such_mode')).toBeNull();
  });
});

describe('тексты клеток', () => {
  it('подпись поля «текст режима» зависит от клетки, у каждой есть подсказка', () => {
    expect(MANIFEST_FIELD.critic.label).toBe('Что говорит');
    expect(MANIFEST_FIELD.child.label).toBe('Что чувствует и чего хочет');
    expect(MANIFEST_FIELD.coping.label).toBe('Что делает и как это выглядит');
    expect(MANIFEST_FIELD.healthy.label).toBe('На что опирается');
    const labels = Object.values(MANIFEST_FIELD).map((f) => f.label);
    expect(new Set(labels).size).toBe(4);
    for (const lane of ['critic', 'child', 'coping', 'healthy'] as const) {
      expect(MANIFEST_FIELD[lane].placeholder.length).toBeGreaterThan(10);
    }
  });

  it('метки видов копинга', () => {
    expect(COPING_KIND_LABEL).toEqual({
      surrender: 'Капитуляция',
      avoidance: 'Избегание',
      overcompensation: 'Гиперкомпенсация',
    });
  });

  it('groupIdsOfLane: копинги — три группы, остальные — по одной', () => {
    expect(groupIdsOfLane('coping')).toEqual([
      'coping_surrender',
      'coping_avoidance',
      'coping_overcompensation',
    ]);
    expect(groupIdsOfLane('child')).toEqual(['child']);
    expect(groupIdsOfLane('critic')).toEqual(['critic']);
    expect(groupIdsOfLane('healthy')).toEqual(['healthy']);
  });
});
