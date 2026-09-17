// @vitest-environment jsdom
// ClientCard — строка клиента в списке терапевта. Проверяет цепочку
// фолбэков имени (алиас → имя → «Оффлайн»/«ID N»), метку активности
// (сегодня/дата/«Не активен») и что индекс дня скрыт, когда клиент его не
// поставил (пусто, а не выдуманный 0 — правило «никаких хардкод-заглушек»).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ClientCard } from './ClientCard';
import type { TherapyClientSummary } from '../../api';

afterEach(() => {
  cleanup();
});

function makeClient(
  overrides: Partial<TherapyClientSummary> = {},
): TherapyClientSummary {
  return {
    telegramId: 123,
    name: null,
    clientAlias: null,
    streak: 0,
    lastActiveDate: null,
    todayIndex: null,
    recentIndexHistory: [],
    relationCreatedAt: '2026-01-01',
    therapyStartDate: null,
    nextSession: null,
    meetingDays: [],
    schemaIds: [],
    ...overrides,
  };
}

describe('ClientCard — отображаемое имя (цепочка фолбэков)', () => {
  it('есть алиас — показывает алиас, а не имя', () => {
    render(
      <ClientCard
        client={makeClient({ clientAlias: 'Клиент А', name: 'Настоящее имя' })}
        today="2026-08-03"
        onOpen={() => {}}
      />,
    );
    expect(screen.getByText('Клиент А')).toBeTruthy();
    expect(screen.queryByText('Настоящее имя')).toBeNull();
  });

  it('нет алиаса — показывает имя из Telegram', () => {
    render(
      <ClientCard
        client={makeClient({ name: 'Иван' })}
        today="2026-08-03"
        onOpen={() => {}}
      />,
    );
    expect(screen.getByText('Иван')).toBeTruthy();
  });

  it('виртуальный клиент (telegramId < 0) без имени — «Оффлайн»', () => {
    render(
      <ClientCard
        client={makeClient({ telegramId: -1 })}
        today="2026-08-03"
        onOpen={() => {}}
      />,
    );
    expect(screen.getByText('Оффлайн')).toBeTruthy();
    expect(screen.getByText('Без Telegram')).toBeTruthy();
  });

  it('реальный клиент без имени и алиаса — «ID N»', () => {
    render(
      <ClientCard
        client={makeClient({ telegramId: 555 })}
        today="2026-08-03"
        onOpen={() => {}}
      />,
    );
    expect(screen.getByText('ID 555')).toBeTruthy();
  });
});

describe('ClientCard — метка активности', () => {
  it('активен сегодня — «Сегодня»', () => {
    render(
      <ClientCard
        client={makeClient({
          name: 'Иван',
          lastActiveDate: '2026-08-03',
          streak: 4,
        })}
        today="2026-08-03"
        onOpen={() => {}}
      />,
    );
    expect(screen.getByText(/Сегодня · Стрик 4 дн/)).toBeTruthy();
  });

  it('никогда не заходил — «Не активен»', () => {
    render(
      <ClientCard
        client={makeClient({ name: 'Иван', lastActiveDate: null })}
        today="2026-08-03"
        onOpen={() => {}}
      />,
    );
    expect(screen.getByText(/Не активен/)).toBeTruthy();
  });
});

describe('ClientCard — индекс дня', () => {
  it('клиент не оценил сегодня — индекс не показан (пусто, не 0)', () => {
    render(
      <ClientCard
        client={makeClient({ name: 'Иван', todayIndex: null })}
        today="2026-08-03"
        onOpen={() => {}}
      />,
    );
    expect(screen.queryByText('индекс')).toBeNull();
  });

  it('клиент оценил — показывает реальный индекс', () => {
    render(
      <ClientCard
        client={makeClient({ name: 'Иван', todayIndex: 6.5 })}
        today="2026-08-03"
        onOpen={() => {}}
      />,
    );
    expect(screen.getByText('6.5')).toBeTruthy();
    expect(screen.getByText('индекс')).toBeTruthy();
  });
});

describe('ClientCard — клик открывает клиента', () => {
  it('клик по строке вызывает onOpen с самим клиентом', () => {
    const onOpen = vi.fn();
    const client = makeClient({ name: 'Иван' });
    render(<ClientCard client={client} today="2026-08-03" onOpen={onOpen} />);
    fireEvent.click(screen.getByText('Иван'));
    expect(onOpen).toHaveBeenCalledWith(client);
  });
});
