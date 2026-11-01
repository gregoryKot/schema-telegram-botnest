// Ветки вида «карточка клиента» (clientCardState.ts): карточка — только для
// клиента из адреса; пока список грузится — скелетон; сбой ≠ «не найден».
import { describe, it, expect } from 'vitest';
import { clientCardState } from './clientCardState';
import type { TherapyClientSummary } from '../../api';

const c = (telegramId: number | string) => ({ telegramId }) as TherapyClientSummary;
const base = { loading: false, loadFailed: false, clients: [c(-57), c(5)], selected: null };

describe('clientCardState', () => {
  it('выбран клиент из адреса — карточка (id сверяется строкой: -57 и "-57")', () => {
    expect(clientCardState({ ...base, selected: c(-57), openClientId: '-57' })).toBe('card');
  });

  it('в адресе другой id, чем у выбранного: есть в списке — скелетон, нет — «не найден»', () => {
    expect(clientCardState({ ...base, selected: c(-57), openClientId: '5' })).toBe('loading');
    expect(clientCardState({ ...base, selected: c(-57), openClientId: '999' })).toBe('missing');
  });

  it('список ещё грузится — скелетон, а не «не найден»', () => {
    expect(clientCardState({ ...base, loading: true, clients: [], openClientId: '999' })).toBe('loading');
  });

  it('сбой загрузки списка — failed, а не missing', () => {
    expect(clientCardState({ ...base, loadFailed: true, clients: [], openClientId: '-57' })).toBe('failed');
  });

  it('удалённый клиент (нет в списке, выбор сброшен) — missing', () => {
    expect(clientCardState({ ...base, clients: [c(5)], openClientId: '-57' })).toBe('missing');
  });

  it('без id в адресе решает выбор', () => {
    expect(clientCardState({ ...base, selected: c(5) })).toBe('card');
    expect(clientCardState({ ...base, loading: true })).toBe('loading');
    expect(clientCardState({ ...base })).toBe('missing');
  });
});
