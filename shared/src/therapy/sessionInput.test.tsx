// @vitest-environment jsdom
// Ввод «следующей сессии» и «начала терапии» (QA 2026-10-26): день без
// времени не стирает сессию, время без дня не сохраняется, будущее начало
// терапии не пускается. «Сегодня» — местный день того, кто вводит.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  joinSession,
  sessionInputHint,
  sessionToSave,
  splitSession,
  startDateHint,
} from './sessionInput';
import { SessionDateTimeFields } from './SessionDateTimeFields';
import { withTimeZone } from '../utils/timeZone.test-helpers';

afterEach(() => vi.useRealTimers());

describe('splitSession / joinSession', () => {
  it('день со временем — два поля, секунды отбрасываются', () => {
    expect(splitSession('2026-10-27T10:00:00')).toEqual({
      date: '2026-10-27',
      time: '10:00',
    });
    expect(splitSession('2026-10-27')).toEqual({
      date: '2026-10-27',
      time: '',
    });
    expect(splitSession(null)).toEqual({ date: '', time: '' });
  });

  it('обратная сборка: без времени — день, без дня — время ждёт день', () => {
    expect(joinSession('2026-10-27', '10:00')).toBe('2026-10-27T10:00');
    expect(joinSession('2026-10-27', '')).toBe('2026-10-27');
    expect(joinSession('', '10:00')).toBe('T10:00');
    expect(splitSession(joinSession('', '10:00'))).toEqual({
      date: '',
      time: '10:00',
    });
  });
});

describe('sessionToSave / sessionInputHint', () => {
  it('день без времени сохраняется днём, а не null (сессия не стирается)', () => {
    expect(sessionToSave('2026-10-27')).toBe('2026-10-27');
    expect(sessionInputHint('2026-10-27')).toBeNull();
  });

  it('день со временем — как есть; секунды с сервера не мешают', () => {
    expect(sessionToSave('2026-10-27T10:00')).toBe('2026-10-27T10:00');
    expect(sessionToSave('2026-10-27T10:00:00')).toBe('2026-10-27T10:00');
  });

  it('оба поля пусты — явный сброс (null)', () => {
    expect(sessionToSave('')).toBeNull();
    expect(sessionInputHint('')).toBeNull();
  });

  it('время без дня — сохранять нечего, есть подсказка', () => {
    expect(sessionToSave('T10:00')).toBeUndefined();
    expect(sessionInputHint('T10:00')).toMatch(/день встречи/);
  });
});

describe('startDateHint', () => {
  it('сегодня и прошлое — можно; завтра — подсказка', () => {
    expect(startDateHint('2026-10-26', '2026-10-26')).toBeNull();
    expect(startDateHint('2025-09-26', '2026-10-26')).toBeNull();
    expect(startDateHint('', '2026-10-26')).toBeNull();
    expect(startDateHint('2026-10-27', '2026-10-26')).toMatch(/в будущем/);
  });

  it('по умолчанию «сегодня» — местный день: в 00:10 по Москве 27-е уже можно', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-26T21:10:00Z'));
    withTimeZone('Europe/Moscow', () =>
      expect(startDateHint('2026-10-27')).toBeNull(),
    );
    withTimeZone('America/Los_Angeles', () =>
      expect(startDateHint('2026-10-27')).toMatch(/в будущем/),
    );
  });
});

function Harness({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <SessionDateTimeFields value={value} onChange={setValue} />
      <output data-testid="value">{value}</output>
    </>
  );
}

describe('SessionDateTimeFields', () => {
  it('показывает сохранённые день и время', () => {
    render(<Harness initial="2026-10-27T10:00:00" />);
    expect(screen.getByLabelText('День сессии')).toHaveProperty(
      'value',
      '2026-10-27',
    );
    expect(screen.getByLabelText('Время сессии, необязательно')).toHaveProperty(
      'value',
      '10:00',
    );
  });

  it('ввели только день — в состоянии день, сохранится днём', () => {
    render(<Harness initial="" />);
    fireEvent.change(screen.getByLabelText('День сессии'), {
      target: { value: '2026-10-27' },
    });
    const value = screen.getByTestId('value').textContent ?? '';
    expect(value).toBe('2026-10-27');
    expect(sessionToSave(value)).toBe('2026-10-27');
  });

  it('стёрли время — день остаётся', () => {
    render(<Harness initial="2026-10-27T10:00" />);
    fireEvent.change(screen.getByLabelText('Время сессии, необязательно'), {
      target: { value: '' },
    });
    expect(screen.getByTestId('value').textContent).toBe('2026-10-27');
  });

  it('время до дня — не теряется, день добавляется к нему', () => {
    render(<Harness initial="" />);
    fireEvent.change(screen.getByLabelText('Время сессии, необязательно'), {
      target: { value: '15:00' },
    });
    expect(screen.getByTestId('value').textContent).toBe('T15:00');
    fireEvent.change(screen.getByLabelText('День сессии'), {
      target: { value: '2026-10-27' },
    });
    expect(screen.getByTestId('value').textContent).toBe('2026-10-27T15:00');
  });
});
