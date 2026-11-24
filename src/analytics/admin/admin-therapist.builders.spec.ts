import { windowDates } from './admin-overview.builders';
import {
  buildTherapistRows,
  countClients,
  type ActionKey,
  type ActionStamp,
} from './admin-therapist.builders';

const KEYS: ActionKey[] = [
  'notes',
  'tasks',
  'planItems',
  'guideMarks',
  'conceptualizations',
  'customModes',
  'invites',
];
const empty = (): Record<ActionKey, ActionStamp[]> =>
  Object.fromEntries(KEYS.map((k) => [k, []])) as unknown as Record<
    ActionKey,
    ActionStamp[]
  >;

describe('countClients', () => {
  it('активные, ожидающие, завершённые и офлайн-клиенты', () => {
    expect(
      countClients([
        {
          therapistId: 1n,
          status: 'active',
          clientId: 5n,
          virtualClientName: null,
        },
        {
          therapistId: 1n,
          status: 'pending',
          clientId: null,
          virtualClientName: null,
        },
        {
          therapistId: 1n,
          status: 'active',
          clientId: null,
          virtualClientName: 'Оля',
        },
        {
          therapistId: 1n,
          status: 'ended',
          clientId: 6n,
          virtualClientName: null,
        },
        {
          therapistId: 1n,
          status: 'ended',
          clientId: null,
          virtualClientName: 'Ира',
        },
      ]),
    ).toEqual({ active: 1, pending: 1, ended: 2, virtual: 1 });
  });
});

describe('buildTherapistRows', () => {
  const dates = windowDates(3, '2026-06-10');
  const therapists = [
    { id: 1n, firstName: 'Боб', requestName: null },
    { id: 2n, firstName: null, requestName: 'Анна Иванова' },
    { id: 3n, firstName: null, requestName: null },
  ];

  it('пустая база: все терапевты с нулями, длина daily = days', () => {
    const rows = buildTherapistRows({
      dates,
      therapists,
      relations: [],
      actions: empty(),
      activity: new Map(),
    });
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.total === 0 && r.daily.length === 3)).toBe(true);
    expect(rows.find((r) => r.id === '3')?.name).toBe('Без имени');
    expect(rows[0].lastActive).toBeNull();
  });

  it('суммирует действия, раскладывает по дням и сортирует по total', () => {
    const actions = empty();
    actions.notes = [
      { therapistId: 2n, at: new Date('2026-06-10T09:00:00Z') },
      { therapistId: 2n, at: new Date('2026-06-09T09:00:00Z') },
    ];
    actions.invites = [
      { therapistId: 2n, at: new Date('2026-06-10T10:00:00Z') },
    ];
    actions.tasks = [{ therapistId: 1n, at: new Date('2026-06-08T10:00:00Z') }];
    const rows = buildTherapistRows({
      dates,
      therapists,
      relations: [
        {
          therapistId: 2n,
          status: 'active',
          clientId: 9n,
          virtualClientName: null,
        },
      ],
      actions,
      activity: new Map([['2', { activeDays: 2, lastActive: '2026-06-10' }]]),
    });
    expect(rows.map((r) => r.id)).toEqual(['2', '1', '3']);
    expect(rows[0]).toMatchObject({
      name: 'Анна Иванова',
      total: 3,
      daily: [0, 1, 2],
      activeDays: 2,
      lastActive: '2026-06-10',
      clients: { active: 1, pending: 0, ended: 0, virtual: 0 },
    });
    expect(rows[0].actions.notes).toBe(2);
  });
});
