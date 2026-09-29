// Сверка с бэкендом (правило №4 CLAUDE.md): CANCEL_LEAD_HOURS дублирует
// src/booking/booking.config.ts::MIN_CANCEL_LEAD_HOURS, потому что фронт не
// может импортировать бэкендовый модуль напрямую. Падает при рассинхроне,
// а не молчит.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CANCEL_LEAD_HOURS } from './cancelPolicy';

describe('cancelPolicy — сверка с backend', () => {
  it('CANCEL_LEAD_HOURS совпадает с MIN_CANCEL_LEAD_HOURS в src/booking/booking.config.ts', () => {
    const src = readFileSync(resolve(__dirname, '../../../../src/booking/booking.config.ts'), 'utf8');
    const m = src.match(/MIN_CANCEL_LEAD_HOURS\s*=\s*(\d+)/);
    expect(m).not.toBeNull();
    expect(CANCEL_LEAD_HOURS).toBe(Number(m![1]));
  });
});
