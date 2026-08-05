// @vitest-environment jsdom
// Секция «У меня уже есть аккаунт» в настройках мини-аппа.
//
// Проверяем две вещи, которые легко сломать незаметно: секция показывается
// только там, где она вообще нужна (в Telegram и в браузере у человека есть
// обычный вход, и предлагать перенос незачем), и что человек видит на каждом
// шаге — иначе ждать он будет впустую, не понимая, куда идти.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LinkAccountSection } from './LinkAccountSection';
import { getHost } from '../../../../shared/src/host';
import { useAccountLink } from '../../hooks/useAccountLink';

vi.mock('../../../../shared/src/host', () => ({ getHost: vi.fn() }));
vi.mock('../../hooks/useAccountLink', () => ({ useAccountLink: vi.fn() }));

const START = {
  deviceCode: 'd'.repeat(64),
  userCode: 'ABCD2345',
  expiresIn: 300,
  interval: 3,
};

function setHost(id: string) {
  (getHost as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ id });
}

function setLink(over: Partial<ReturnType<typeof useAccountLink>> = {}) {
  (useAccountLink as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    state: 'idle',
    start: null,
    busy: false,
    begin: vi.fn(),
    ...over,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setHost('max');
  setLink();
});

describe('где показывается', () => {
  it('в MAX — показывается: своего входа для сайтов у площадки нет', () => {
    render(<LinkAccountSection />);
    expect(screen.getByText(/У меня уже есть аккаунт/)).toBeTruthy();
  });

  it.each(['telegram', 'web'])('в %s — не показывается', (host) => {
    setHost(host);
    const { container } = render(<LinkAccountSection />);
    expect(container.textContent).toBe('');
  });
});

describe('что видно на каждом шаге', () => {
  it('ожидание: код на экране и подсказка, что делать в браузере', () => {
    setLink({ state: 'waiting', start: START });
    render(<LinkAccountSection />);

    expect(screen.getByText('ABCD2345')).toBeTruthy();
    expect(screen.getByText(/браузер/i)).toBeTruthy();
  });

  it('ожидание: адрес страницы виден целиком — на случай, если браузер не открылся', () => {
    setLink({ state: 'waiting', start: START });
    render(<LinkAccountSection />);

    expect(screen.getAllByText(/\/link\?code=ABCD2345/).length).toBeGreaterThan(
      0,
    );
  });

  it('успех: сказано прямо, что данные уже здесь', () => {
    setLink({ state: 'linked' });
    render(<LinkAccountSection />);
    expect(
      screen.getByText(/Данные из другого аккаунта теперь здесь/),
    ).toBeTruthy();
  });

  it('неудача: предлагает начать заново, а не оставляет в тупике', () => {
    setLink({ state: 'failed' });
    render(<LinkAccountSection />);
    expect(screen.getByText('Начать заново')).toBeTruthy();
  });
});
