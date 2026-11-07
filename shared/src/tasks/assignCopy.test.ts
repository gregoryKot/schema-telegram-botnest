// Что обещает форма назначения задания. Регрессия QA 2026-10-26: лист
// обещал «Появится у клиента в мини-аппе – он выполняет самостоятельно» и
// офлайн-клиенту, и клиенту сайта.
import { describe, it, expect } from 'vitest';
import {
  ASSIGN_LEAD_OFFLINE,
  ASSIGN_LEAD_ONLINE,
  assignLead,
  assignableOptions,
} from './assignCopy';

const OPTIONS = [
  { type: 'tracker_streak' },
  { type: 'belief_check' },
  { type: 'custom' },
];

describe('assignLead', () => {
  it('своя цель клиента — без подписи', () => {
    expect(assignLead(undefined)).toBeNull();
  });
  it('клиент с аккаунтом — «в приложении», без мини-аппа и рода', () => {
    expect(assignLead(42)).toBe(ASSIGN_LEAD_ONLINE);
    expect(assignLead('1000000000000000123')).toBe(ASSIGN_LEAD_ONLINE);
    expect(ASSIGN_LEAD_ONLINE).not.toMatch(/мини-апп|\bон\b/);
  });
  it('офлайн-клиент — честно: пометка, выполненной её отмечает терапевт', () => {
    expect(assignLead(-5)).toBe(ASSIGN_LEAD_OFFLINE);
    expect(assignLead('-5')).toBe(ASSIGN_LEAD_OFFLINE);
  });
});

describe('assignableOptions', () => {
  it('клиенту с аккаунтом и своей цели — все типы', () => {
    expect(assignableOptions(OPTIONS, 42)).toEqual(OPTIONS);
    expect(assignableOptions(OPTIONS, undefined)).toEqual(OPTIONS);
  });
  it('офлайн-клиенту — только «Своё задание»', () => {
    expect(assignableOptions(OPTIONS, -5)).toEqual([{ type: 'custom' }]);
  });
});
