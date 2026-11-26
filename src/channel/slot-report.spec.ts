// Отчёт владельцу после планового поста. Pinterest не настроен с июля 2026
// (#214), и «дошло не везде · Молчали: Pinterest» приходило в каждом слоте —
// владелец попросил убрать ежедневный шум. Правило 2026-07-31 при этом в силе:
// о молчащей площадке напоминаем, только раз в неделю, а не каждый день.
import { shouldReportSlot, slotReportText } from './slot-report';
import { mskParts } from '../bot/healthy-adult.schedule';
import type { DeliveryFailure, SilentTarget } from './channel-target';

const pinterest: SilentTarget = {
  title: 'Pinterest',
  envKey: 'HEALTHY_ADULT_PINTEREST_BOARD',
};
const vkDown: DeliveryFailure = {
  platform: 'vk',
  title: 'VK',
  destination: 'club1',
  reason: '403: нет доступа',
};
const silentOnly = { failed: [], silent: [pinterest] };
const failedOnly = { failed: [vkDown], silent: [] };
const allDelivered = { failed: [], silent: [] };

const MONDAY = '2026-11-09';
const TUESDAY = '2026-11-10';
/** Неделя с понедельника по воскресенье. */
const WEEK = [9, 10, 11, 12, 13, 14, 15].map(
  (d) => `2026-11-${String(d).padStart(2, '0')}`,
);

describe('shouldReportSlot', () => {
  it('только молчащие в понедельник утром — напоминаем', () => {
    expect(shouldReportSlot(silentOnly, MONDAY, 'morning')).toBe(true);
  });

  it('только молчащие во вторник — молчим', () => {
    expect(shouldReportSlot(silentOnly, TUESDAY, 'morning')).toBe(false);
  });

  it('только молчащие: за неделю ровно одно напоминание — понедельник, утро', () => {
    const due = WEEK.flatMap((day) =>
      (['morning', 'evening'] as const)
        .filter((slot) => shouldReportSlot(silentOnly, day, slot))
        .map((slot) => `${day}:${slot}`),
    );
    expect(due).toEqual([`${MONDAY}:morning`]);
  });

  it('упавшая площадка будит владельца в любой день и слот', () => {
    for (const day of WEEK)
      for (const slot of ['morning', 'evening'] as const) {
        expect(shouldReportSlot(failedOnly, day, slot)).toBe(true);
        const both = { failed: [vkDown], silent: [pinterest] };
        expect(shouldReportSlot(both, day, slot)).toBe(true);
      }
  });

  it('ни упавших, ни молчащих — отчёта нет даже в понедельник утром', () => {
    expect(shouldReportSlot(allDelivered, MONDAY, 'morning')).toBe(false);
    expect(shouldReportSlot(allDelivered, TUESDAY, 'evening')).toBe(false);
  });

  it('понедельник — по МСК: утренний слот 09:00 МСК — это 06:00 UTC того же дня', () => {
    // Тот же источник дня, что у расписания (mskParts), а не зона машины.
    const mondayMorning = new Date('2026-11-09T06:30:00Z');
    const day = mskParts(mondayMorning).dateKey;
    expect(shouldReportSlot(silentOnly, day, 'morning')).toBe(true);
    // 00:30 МСК понедельника — ещё воскресенье по UTC, но день уже понедельник.
    expect(mskParts(new Date('2026-11-08T21:30:00Z')).dateKey).toBe(MONDAY);
  });
});

describe('slotReportText', () => {
  it('только молчащие: площадка, env и пометка о недельном ритме', () => {
    const text = slotReportText('утро', silentOnly);
    expect(text).toContain('Канал ЗВ (утро): дошло не везде');
    expect(text).toContain('Pinterest — нет HEALTHY_ADULT_PINTEREST_BOARD');
    expect(text).toContain('раз в неделю');
    expect(text).not.toContain('дослать');
  });

  it('есть упавшие: досылка обещана, молчащие названы, без недельной пометки', () => {
    const text = slotReportText('вечер', {
      failed: [vkDown],
      silent: [pinterest],
    });
    expect(text).toContain('VK (club1) — 403: нет доступа');
    expect(text).toContain('Pinterest — нет HEALTHY_ADULT_PINTEREST_BOARD');
    expect(text).toContain('Пробую дослать в ближайшие минуты.');
    expect(text).not.toContain('раз в неделю');
  });
});
