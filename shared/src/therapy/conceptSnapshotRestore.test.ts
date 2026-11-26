import { describe, it, expect } from 'vitest';
import { snapshotToConceptFields } from './conceptSnapshotRestore';
import type { ConceptSnapshot } from '../apiTypes';

const base: ConceptSnapshot = {
  savedAt: '2026-08-01T10:00:00Z',
  schemaIds: ['abandonment'],
  modeIds: ['vulnerable-child'],
  earlyExperience: 'ранний опыт',
  unmetNeeds: null,
  triggers: null,
  copingStyles: null,
  goals: 'цель',
  currentProblems: null,
};

describe('snapshotToConceptFields', () => {
  it('переносит поля, null превращает в пустую строку', () => {
    const f = snapshotToConceptFields(base);
    expect(f.schemaIds).toEqual(['abandonment']);
    expect(f.earlyExperience).toBe('ранний опыт');
    expect(f.unmetNeeds).toBe('');
    expect(f.modeTransitions).toBe('');
  });

  it('старый снимок без связей графа не несёт ключей связей (граф не затирается)', () => {
    const f = snapshotToConceptFields(base);
    expect('modeLinks' in f).toBe(false);
    expect('schemaLinks' in f).toBe(false);
  });

  it('снимок со связями возвращает их', () => {
    const f = snapshotToConceptFields({
      ...base,
      modeLinks: [],
      schemaLinks: [],
    });
    expect(f.modeLinks).toEqual([]);
    expect(f.schemaLinks).toEqual([]);
  });
});
