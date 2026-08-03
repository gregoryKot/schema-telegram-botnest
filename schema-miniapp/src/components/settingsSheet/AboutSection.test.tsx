// @vitest-environment jsdom
// Настройки: «О приложении» (CLAUDE.md — приоритет покрытия «настройки»).
// Статический блок — поведение ограничено наличием ключевых ссылок.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AboutSection } from './AboutSection';

afterEach(() => {
  cleanup();
});

describe('AboutSection', () => {
  it('показывает название продукта и рабочие ссылки на канал/запись/донат', () => {
    render(<AboutSection />);
    expect(screen.getByText('Всё по схеме')).toBeTruthy();

    const channel = screen.getByText('@SchemeHappens');
    expect(channel.getAttribute('href')).toBe('https://t.me/SchemeHappens');

    const booking = screen.getByText('@kotlarewski');
    expect(booking.getAttribute('href')).toBe('https://t.me/kotlarewski');

    const donate = screen.getByText('разовый донат 💛');
    expect(donate.getAttribute('href')).toBe('https://schemehappens.ru/donate');
  });
});
