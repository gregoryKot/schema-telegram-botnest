// Раньше это был контент двух побайтово идентичных копий (webapp/schema-miniapp,
// аудит парности PR #349) — тест держит единственный источник целым: 20 схем
// в 5 доменах, 35 режимов в 6 группах, и производные реестры/хелперы не
// расходятся с исходными группами.
import { describe, it, expect } from 'vitest';
import {
  EMOTIONS,
  INTENSITY_LABELS,
  SCHEMA_DOMAINS,
  MODE_GROUPS,
  ALL_SCHEMAS,
  ALL_MODES,
  getModeById,
  getSchemaById,
} from './schemaTherapyData';

describe('schemaTherapyData', () => {
  it('содержит 20 схем в 5 доменах', () => {
    expect(SCHEMA_DOMAINS).toHaveLength(5);
    expect(ALL_SCHEMAS).toHaveLength(20);
  });

  it('содержит 35 режимов в 6 группах', () => {
    expect(MODE_GROUPS).toHaveLength(6);
    expect(ALL_MODES).toHaveLength(35);
  });

  it('ALL_SCHEMAS и ALL_MODES без дублей id', () => {
    expect(new Set(ALL_SCHEMAS.map((s) => s.id)).size).toBe(ALL_SCHEMAS.length);
    expect(new Set(ALL_MODES.map((m) => m.id)).size).toBe(ALL_MODES.length);
  });

  it('ALL_SCHEMAS несёт domainId/domainColor из своего домена', () => {
    const schema = ALL_SCHEMAS.find((s) => s.id === 'abandonment');
    expect(schema?.domainId).toBe('rejection');
    expect(schema?.domainColor).toBe('var(--accent-red)');
  });

  it('ALL_MODES несёт groupId/groupColor/groupName из своей группы', () => {
    const mode = ALL_MODES.find((m) => m.id === 'healthy_adult');
    expect(mode?.groupId).toBe('healthy');
    expect(mode?.groupName).toBe('Здоровые режимы');
    expect(mode?.groupColor).toBe('var(--accent-green)');
  });

  it('getSchemaById/getModeById находят реальные записи и не находят чужие', () => {
    expect(getSchemaById('mistrust')?.name).toBe(
      'Недоверие / Жестокое обращение',
    );
    expect(getSchemaById('does_not_exist')).toBeUndefined();
    expect(getModeById('vulnerable_child')?.name).toBe('Уязвимый Ребёнок');
    expect(getModeById('does_not_exist')).toBeUndefined();
  });

  it('EMOTIONS и INTENSITY_LABELS на месте', () => {
    expect(EMOTIONS.length).toBeGreaterThan(0);
    expect(INTENSITY_LABELS).toHaveLength(5);
  });
});
