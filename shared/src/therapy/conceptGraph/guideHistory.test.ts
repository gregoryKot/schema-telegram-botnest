// История пунктов «Между сессиями» (#995): какое задание клиента дано по
// пункту, сколько раз, что с последним, и строка «давали …». День задания —
// день назначения в зоне терапевта (момент createdAt, правило №25). Статус —
// модель кабинета (tasks/taskStatus.ts), подпись — её STATUS_LABEL со строчной.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BetweenSessionsItem } from '../../schemaTherapy/guide';
import { STATUS_LABEL, type TaskStatus } from '../../tasks/taskStatus';
import { withTimeZone } from '../../utils/timeZone.test-helpers';
import {
  guideNotes,
  guideTaskHistory,
  guideTaskLabel,
  type GuideTask,
} from './guideHistory';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-07T12:00:00Z'));
});
afterEach(() => vi.useRealTimers());

const task = (over: Partial<GuideTask>): GuideTask => ({
  type: 'letter_to_self',
  text: 'Написать письмо себе в детстве',
  done: null,
  dueDate: null,
  createdAt: '2026-10-12T10:00:00.000Z',
  ...over,
});
const MODE = { kind: 'mode', id: 'vulnerable_child' } as const;
const SCHEMA = { kind: 'schema', id: 'abandonment' } as const;
const letter: BetweenSessionsItem = {
  kind: 'task',
  type: 'letter_to_self',
  title: 'Письмо себе',
};
const card: BetweenSessionsItem = {
  kind: 'task',
  type: 'schema_intro',
  title: 'Карточка схемы',
};
const diary: BetweenSessionsItem = {
  kind: 'custom',
  title: 'Дневник разлук',
  text: 'Записывать, что происходит',
};

describe('guideTaskHistory — какое задание дано по пункту', () => {
  it('ни одного — null', () => {
    expect(guideTaskHistory(letter, MODE, [])).toBeNull();
    expect(
      guideTaskHistory(letter, MODE, [task({ type: 'safe_place' })]),
    ).toBeNull();
  });

  it('упражнение — по типу; последнее — самое позднее по дате назначения, а не по порядку', () => {
    const tasks = [
      task({ createdAt: '2026-10-01T10:00:00.000Z', done: true }),
      task({ createdAt: '2026-10-20T10:00:00.000Z', done: null }),
      task({ createdAt: '2026-10-12T10:00:00.000Z', done: false }),
      task({ type: 'safe_place' }),
    ];
    expect(guideTaskHistory(letter, MODE, tasks)).toEqual({
      count: 3,
      last: { day: '2026-10-20', status: 'active' },
    });
  });

  it('карточка схемы — ещё и по id схемы в тексте задания', () => {
    const tasks = [
      task({ type: 'schema_intro', text: 'abandonment', done: true }),
      task({ type: 'schema_intro', text: 'mistrust' }),
    ];
    expect(guideTaskHistory(card, SCHEMA, tasks)).toEqual({
      count: 1,
      last: { day: '2026-10-12', status: 'done' },
    });
    expect(
      guideTaskHistory(card, { kind: 'schema', id: 'subjugation' }, tasks),
    ).toBeNull();
  });

  it('карточка режима — по id режима', () => {
    const intro: BetweenSessionsItem = {
      kind: 'task',
      type: 'mode_intro',
      title: 'Карточка режима',
    };
    const tasks = [
      task({ type: 'mode_intro', text: 'vulnerable_child', done: false }),
    ];
    expect(guideTaskHistory(intro, MODE, tasks)?.last.status).toBe('failed');
    expect(
      guideTaskHistory(intro, { kind: 'mode', id: 'angry_child' }, tasks),
    ).toBeNull();
  });

  it('своё задание — по первой строке: название и перевод строки или одно название', () => {
    const tasks = [
      task({
        type: 'custom',
        text: 'Дневник разлук\nЗаписывать, что происходит',
      }),
      task({
        type: 'custom',
        text: 'Дневник разлук\nсвоими словами терапевта',
      }),
      task({ type: 'custom', text: 'Дневник разлук' }),
      task({ type: 'custom', text: 'Дневник разлуки с собой' }),
      task({ type: 'custom', text: 'Другое\nДневник разлук' }),
      task({ type: 'belief_check', text: 'Дневник разлук' }),
    ];
    expect(guideTaskHistory(diary, SCHEMA, tasks)?.count).toBe(3);
  });

  it('день назначения — в зоне терапевта: поздний вечер по Гринвичу на востоке уже завтра', () => {
    const late = [task({ createdAt: '2026-10-12T22:30:00.000Z' })];
    const dayIn = (tz: string) =>
      withTimeZone(tz, () => guideTaskHistory(letter, MODE, late)?.last.day);
    expect(dayIn('UTC')).toBe('2026-10-12');
    expect(dayIn('Asia/Jerusalem')).toBe('2026-10-13');
    expect(dayIn('America/Los_Angeles')).toBe('2026-10-12');
  });
});

describe('guideTaskLabel', () => {
  it('один раз — день и статус; несколько — сколько раз и последний', () => {
    expect(
      guideTaskLabel({ count: 1, last: { day: '2026-10-12', status: 'done' } }),
    ).toBe('давали 12 окт · выполнено');
    expect(
      guideTaskLabel({
        count: 3,
        last: { day: '2026-10-12', status: 'active' },
      }),
    ).toBe('давали 3 раза, последний 12 окт · в работе');
    expect(
      guideTaskLabel({
        count: 5,
        last: { day: '2025-12-30', status: 'failed' },
      }),
    ).toBe('давали 5 раз, последний 30 дек 2025 · не вышло');
  });

  it('подпись статуса — та же, что в кабинете (STATUS_LABEL), со строчной после «·»', () => {
    const statuses: TaskStatus[] = [
      'done',
      'failed',
      'overdue',
      'soon',
      'active',
    ];
    for (const status of statuses) {
      const label = guideTaskLabel({
        count: 1,
        last: { day: '2026-10-12', status },
      });
      expect(label).toBe(
        `давали 12 окт · ${STATUS_LABEL[status].toLowerCase()}`,
      );
    }
  });
});

describe('guideTaskHistory — статус как в карточке клиента', () => {
  it('открытое задание со сроком: прошёл — «просрочено», скоро — «скоро срок»', () => {
    const today = '2026-11-07';
    const status = (dueDate: string) =>
      guideTaskHistory(letter, MODE, [task({ dueDate })], today)?.last.status;
    expect(status('2026-11-01')).toBe('overdue');
    expect(status('2026-11-08')).toBe('soon');
    expect(status('2026-11-30')).toBe('active');
    // закрытое задание срок не смотрит
    expect(
      guideTaskHistory(
        letter,
        MODE,
        [task({ dueDate: '2026-11-01', done: true })],
        today,
      )?.last.status,
    ).toBe('done');
  });
});

describe('guideNotes — строки раздела для плашки и листов', () => {
  it('без заданий клиента (справочник) строк «давали» нет; отметки — по своей технике', () => {
    const notes = guideNotes(MODE, undefined, [
      { techniqueId: 'chairwork', day: '2026-11-05' },
    ]);
    expect(notes.task(letter)).toBeNull();
    expect(notes.technique('chairwork')).toBe('делали 5 ноя');
    expect(notes.technique('imagery_rescripting')).toBeNull();
  });

  it('с заданиями — строка «давали …» у своего пункта', () => {
    const notes = guideNotes(MODE, [task({ done: true })], undefined);
    expect(notes.task(letter)).toBe('давали 12 окт · выполнено');
    expect(notes.task(diary)).toBeNull();
  });
});
