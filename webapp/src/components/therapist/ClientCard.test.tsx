// @vitest-environment jsdom
// Строка клиента в списке (#1674): радужной полосы доменов нет; знак — DomainArt ведущего домена,
// у офлайн-клиента — знак продукта; без ведущего домена — без знака. Схемы — тихий текст через «·» (К30).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import type { TherapyClientSummary } from '../../api';
import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { ClientCard } from './ClientCard';

afterEach(cleanup);

const [d1, d2] = SCHEMA_DOMAINS;
const client = (over: Partial<TherapyClientSummary>) => ({
  telegramId: 5, name: 'Аня', clientAlias: null, streak: 0, lastActiveDate: null, todayIndex: null,
  recentIndexHistory: [], relationCreatedAt: '2026-01-01', therapyStartDate: null, nextSession: null,
  meetingDays: [], schemaIds: [], ...over,
}) as TherapyClientSummary;
const card = (c: TherapyClientSummary) => render(<ClientCard client={c} today="2026-11-12" onOpen={vi.fn()} />).container;

describe('ClientCard — вид', () => {
  it('ведущий домен: знак домена; схемы — строка текста без пилюль; полосы нет; справа «→», без шеврона', () => {
    const ids = [d1.schemas[0].id, d1.schemas[1].id, d2.schemas[0].id];
    const root = card(client({ schemaIds: ids }));
    expect(root.querySelector('.tc-sign')?.getAttribute('data-sign')).toBe(d1.id);
    expect(root.querySelector('.tc-bar')).toBeNull();
    expect(root.querySelector('.tc-chip')).toBeNull();
    expect(root.querySelector('.tc-schemas')?.textContent).toBe([d1.schemas[0], d1.schemas[1], d2.schemas[0]].map((s) => s.name).join(' · '));
    expect(root.querySelector('.tc-go')?.textContent).toBe('→');
    expect(root.querySelector('.ds-chev')).toBeNull();
  });

  it('офлайн — знак продукта; без схем — без знака и без строки схем', () => {
    expect(card(client({ telegramId: -3 })).querySelector('.tc-sign [data-brand-mark]')).not.toBeNull();
    cleanup();
    const root = card(client({}));
    expect(root.querySelector('.tc-sign')).toBeNull();
    expect(root.querySelector('.tc-schemas')).toBeNull();
  });

  it('отметка о заданиях — в строке клиента; без пропа её нет', () => {
    const c = client({});
    const mark = 'выполнено с прошлой встречи: 2';
    const withMark = render(<ClientCard client={c} today="2026-11-12" onOpen={vi.fn()} tasksMark={mark} />).container;
    expect(withMark.querySelector('.tc-meta')?.textContent).toContain(mark);
    cleanup();
    expect(card(c).textContent).not.toContain('выполнено');
  });

  it('строка нажимается целиком: Enter открывает клиента', () => {
    const onOpen = vi.fn();
    const c = client({});
    const { getByRole } = render(<ClientCard client={c} today="2026-11-12" onOpen={onOpen} />);
    fireEvent.keyDown(getByRole('button'), { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledWith(c);
  });
});
