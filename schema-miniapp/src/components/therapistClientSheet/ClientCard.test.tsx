// @vitest-environment jsdom
// ClientCard — строка клиента в списке терапевта. Проверяет цепочку
// фолбэков имени (алиас → имя → «Оффлайн»/«ID N»), метку активности
// (сегодня/дата/«Нет активности») и что индекс дня скрыт, когда клиент его не
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
        onOpen={() => {}}
      />,
    );
    expect(screen.getByText('Клиент А')).toBeTruthy();
    expect(screen.queryByText('Настоящее имя')).toBeNull();
  });

  it('нет алиаса — показывает имя из Telegram', () => {
    render(
      <ClientCard client={makeClient({ name: 'Иван' })} onOpen={() => {}} />,
    );
    expect(screen.getByText('Иван')).toBeTruthy();
  });

  it('виртуальный клиент (telegramId < 0) без имени — «Оффлайн»', () => {
    render(
      <ClientCard client={makeClient({ telegramId: -1 })} onOpen={() => {}} />,
    );
    expect(screen.getByText('Оффлайн')).toBeTruthy();
    expect(screen.getByText('Без Telegram')).toBeTruthy();
  });

  it('реальный клиент без имени и алиаса — «ID N»', () => {
    render(
      <ClientCard client={makeClient({ telegramId: 555 })} onOpen={() => {}} />,
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
          daysSinceActive: 0,
          streak: 4,
        })}
        onOpen={() => {}}
      />,
    );
    expect(screen.getByText(/Сегодня · Стрик 4 дн/)).toBeTruthy();
  });

  // lastActiveDate — день КЛИЕНТА; «сегодня» по его календарю отдаёт сервер.
  it('отмечался вчера по своему календарю — дата, не «Сегодня»', () => {
    render(
      <ClientCard
        client={makeClient({
          name: 'Иван',
          lastActiveDate: '2026-08-03',
          daysSinceActive: 1,
        })}
        onOpen={() => {}}
      />,
    );
    expect(screen.queryByText(/Сегодня/)).toBeNull();
    expect(screen.getByText(/3 авг/)).toBeTruthy();
  });

  // Аудит 2026-10: было «Не активен» — мужской род о клиенте неизвестного пола.
  it('активности ещё не было — «Нет активности»', () => {
    render(
      <ClientCard
        client={makeClient({ name: 'Иван', lastActiveDate: null })}
        onOpen={() => {}}
      />,
    );
    expect(screen.getByText('Нет активности · Стрик 0 дн')).toBeTruthy();
    expect(screen.queryByText(/[Аа]ктивен/)).toBeNull();
  });
});

describe('ClientCard — индекс дня', () => {
  it('клиент не оценил сегодня — индекс не показан (пусто, не 0)', () => {
    render(
      <ClientCard
        client={makeClient({ name: 'Иван', todayIndex: null })}
        onOpen={() => {}}
      />,
    );
    expect(screen.queryByText('индекс')).toBeNull();
  });

  it('клиент оценил — показывает реальный индекс', () => {
    render(
      <ClientCard
        client={makeClient({ name: 'Иван', todayIndex: 6.5 })}
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
    render(<ClientCard client={client} onOpen={onOpen} />);
    fireEvent.click(screen.getByText('Иван'));
    expect(onOpen).toHaveBeenCalledWith(client);
  });
});
