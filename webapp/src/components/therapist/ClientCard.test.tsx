// @vitest-environment jsdom
// Карточка клиента в списке (b29): радужной полосы доменов нет; знак — DomainArt ведущего домена
// (тень слоем — его бумага), у офлайн-клиента — знак продукта; без ведущего домена — без знака и с
// небом терапевта. Чипы схем — бумага своего домена.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
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
  it('ведущий домен: знак домена и тень его бумаги; чипы — бумага своего домена; полосы нет', () => {
    const ids = [d1.schemas[0].id, d1.schemas[1].id, d2.schemas[0].id];
    const root = card(client({ schemaIds: ids }));
    const el = root.querySelector('.tc-card') as HTMLElement;
    expect(el.style.getPropertyValue('--h')).toBe(String(DOMAIN_HUE[d1.id]));
    expect(root.querySelector('.tc-sign')?.getAttribute('data-sign')).toBe(d1.id);
    expect(root.querySelector('.tc-bar')).toBeNull();
    const chips = [...root.querySelectorAll<HTMLElement>('.tc-chip')].map((c) => c.style.getPropertyValue('--h'));
    expect(chips).toEqual([DOMAIN_HUE[d1.id], DOMAIN_HUE[d1.id], DOMAIN_HUE[d2.id]].map(String));
  });

  it('офлайн — знак продукта; без схем — без знака, тень неба терапевта', () => {
    expect(card(client({ telegramId: -3 })).querySelector('.tc-sign [data-brand-mark]')).not.toBeNull();
    cleanup();
    const root = card(client({}));
    expect(root.querySelector('.tc-sign')).toBeNull();
    expect((root.querySelector('.tc-card') as HTMLElement).style.getPropertyValue('--h')).toBe('240');
  });
});
