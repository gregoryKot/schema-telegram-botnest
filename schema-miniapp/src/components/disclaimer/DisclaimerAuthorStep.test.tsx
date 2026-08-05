// @vitest-environment jsdom
// DisclaimerAuthorStep — шаг «Об авторе» (0% покрытия). Чисто статический
// контент без вилки ты/вы — проверяем, что ссылки на канал/запись/донат на
// месте и ведут на правильные адреса (частый баг копипасты — не тот href).
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DisclaimerAuthorStep } from './DisclaimerAuthorStep';

afterEach(() => {
  cleanup();
});

describe('DisclaimerAuthorStep', () => {
  it('ссылка на канал ведёт на @SchemeHappens', () => {
    render(<DisclaimerAuthorStep />);
    const link = screen.getByText('@SchemeHappens');
    expect(link.getAttribute('href')).toBe('https://t.me/SchemeHappens');
  });

  it('ссылка на запись ведёт на @kotlarewski', () => {
    render(<DisclaimerAuthorStep />);
    const link = screen.getByText('@kotlarewski');
    expect(link.getAttribute('href')).toBe('https://t.me/kotlarewski');
  });

  it('ссылка донат открывается в новой вкладке', () => {
    render(<DisclaimerAuthorStep />);
    const link = screen.getByText('донат');
    expect(link.getAttribute('href')).toBe('https://schemehappens.ru/donate');
    expect(link.getAttribute('target')).toBe('_blank');
  });
});
