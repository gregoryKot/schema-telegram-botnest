// @vitest-environment jsdom
// Строка клиента в списке (#1674): радужной полосы доменов нет; знак — DomainArt ведущего домена,
// у офлайн-клиента — знак продукта; без ведущего домена — без знака. Чипы схем — бумага своего домена.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import type { TherapyClientSummary } from '../../api';
import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { DOMAIN_HUE } from '../../lib/tone';
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
  it('ведущий домен: знак домена; чипы — бумага своего домена; полосы нет; справа «→», без шеврона', () => {
    const ids = [d1.schemas[0].id, d1.schemas[1].id, d2.schemas[0].id];
    const root = card(client({ schemaIds: ids }));
    expect(root.querySelector('.tc-sign')?.getAttribute('data-sign')).toBe(d1.id);
    expect(root.querySelector('.tc-bar')).toBeNull();
    const chips = [...root.querySelectorAll<HTMLElement>('.tc-chip')].map((c) => c.style.getPropertyValue('--h'));
    expect(chips).toEqual([DOMAIN_HUE[d1.id], DOMAIN_HUE[d1.id], DOMAIN_HUE[d2.id]].map(String));
    expect(root.querySelector('.tc-go')?.textContent).toBe('→');
    expect(root.querySelector('.ds-chev')).toBeNull();
  });

  it('офлайн — знак продукта; без схем — без знака и без ряда чипов', () => {
    expect(card(client({ telegramId: -3 })).querySelector('.tc-sign [data-brand-mark]')).not.toBeNull();
    cleanup();
    const root = card(client({}));
    expect(root.querySelector('.tc-sign')).toBeNull();
    expect(root.querySelector('.tc-chips')).toBeNull();
  });

  it('строка нажимается целиком: Enter открывает клиента', () => {
    const onOpen = vi.fn();
    const c = client({});
    const { getByRole } = render(<ClientCard client={c} today="2026-11-12" onOpen={onOpen} />);
    fireEvent.keyDown(getByRole('button'), { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledWith(c);
  });
});
