// @vitest-environment jsdom
// Строка клиента в списке (К31): ритм оглавления — имя, встреча, тихая строка «активность · схемы».
// Без пилюль схем, без аватара и знака-домена; справа «→».
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import type { TherapyClientSummary } from '../../api';
import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { ClientCard } from './ClientCard';

afterEach(cleanup);

const schemas = SCHEMA_DOMAINS.flatMap((d) => d.schemas).slice(0, 6);
const client = (over: Partial<TherapyClientSummary>) => ({
  telegramId: 5, name: 'Аня', clientAlias: null, streak: 0, lastActiveDate: null, todayIndex: null,
  recentIndexHistory: [], relationCreatedAt: '2026-01-01', therapyStartDate: null, nextSession: null,
  meetingDays: [], schemaIds: [], ...over,
}) as TherapyClientSummary;
const card = (c: TherapyClientSummary, tasksMark?: string) =>
  render(<ClientCard client={c} today="2026-11-12" onOpen={vi.fn()} tasksMark={tasksMark} />).container;
const text = (root: HTMLElement, sel: string) => root.querySelector(sel)?.textContent;

describe('ClientCard — вид', () => {
  it('шесть схем — одна строка текста «две · ещё 4», ни одной пилюли, аватара и знака', () => {
    const root = card(client({ schemaIds: schemas.map((s) => s.id) }));
    expect(text(root, '.tc-schemas')).toMatch(/^[^·]+\u00a0· [^·]+\u00a0· ещё\u00a04$/);
    expect(root.querySelectorAll('.tc-schemas *')).toHaveLength(0);
    expect(root.querySelector('[class*="chip"], [class*="pill"], .tc-avatar, .tc-sign, svg')).toBeNull();
    expect(text(root, '.tc-go')).toBe('→');
  });

  it('встреча — подписью или «—»; активность — без рода; офлайн — словом', () => {
    const app = card(client({ meetingDays: [4], lastActiveDate: '2026-11-12', daysSinceActive: 0 }));
    expect(text(app, '.tc-when')).toBe('по Чт');
    expect(text(app, '.tc-activity')).toBe('активность сегодня');
    cleanup();
    const off = card(client({ telegramId: -3 }));
    expect(text(off, '.tc-when')).toBe('—');
    expect(text(off, '.tc-activity')).toBe('офлайн');
    expect(off.querySelector('.tc-schemas')).toBeNull();
  });

  it('отметка о заданиях — рядом с активностью; без пропа её нет', () => {
    const mark = 'выполнено с прошлой встречи: 2';
    expect(text(card(client({}), mark), '.tc-tasks')).toBe(mark);
    cleanup();
    expect(card(client({})).textContent).not.toContain('выполнено');
  });

  it('строка нажимается целиком: Enter открывает клиента', () => {
    const onOpen = vi.fn();
    const c = client({});
    const { getByRole } = render(<ClientCard client={c} today="2026-11-12" onOpen={onOpen} />);
    fireEvent.keyDown(getByRole('button'), { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledWith(c);
  });
});
