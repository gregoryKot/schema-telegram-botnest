// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ExternalLink } from './ExternalLink';
import { installTelegram, removeTelegram } from './tgStub.test-helpers';

afterEach(removeTelegram);

describe('ExternalLink', () => {
  it('в браузере — обычная ссылка в новой вкладке, клик не перехватывается', () => {
    render(<ExternalLink href="https://t.me/x">канал</ExternalLink>);
    const a = screen.getByRole('link', { name: 'канал' });
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    expect(fireEvent.click(a)).toBe(true); // preventDefault не вызван
  });

  it('в Telegram — host.openLink и preventDefault', () => {
    const openLink = vi.fn();
    installTelegram({ openLink });
    render(<ExternalLink href="https://t.me/x">канал</ExternalLink>);
    expect(fireEvent.click(screen.getByRole('link'))).toBe(false);
    expect(openLink).toHaveBeenCalledWith('https://t.me/x');
  });

  it('относительный адрес в Telegram превращается в полный', () => {
    const openLink = vi.fn();
    installTelegram({ openLink });
    render(<ExternalLink href="/donate">донат</ExternalLink>);
    fireEvent.click(screen.getByRole('link'));
    expect(openLink).toHaveBeenCalledWith(`${window.location.origin}/donate`);
  });

  it('свой onClick вызывается в обоих хостах', () => {
    const onClick = vi.fn();
    installTelegram({ openLink: vi.fn() });
    render(<ExternalLink href="https://t.me/x" onClick={onClick}>a</ExternalLink>);
    fireEvent.click(screen.getByRole('link'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
