// @vitest-environment jsdom
// Строка способа входа в /account (#912): у единственного способа значок
// сжимался до ~19px, а пояснение «Единственный способ входа…» обрезалось
// многоточием — на телефоне и на компьютере. CSS в jsdom не считается, поэтому
// проверяем инлайн-стиль плитки и пиним правила auth-account.css.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ProviderRow, GoogleIcon, TelegramIcon, VkIcon, MaxIcon } from './ProviderRows';
import { ONLY_METHOD_NOTE } from './accountMethods';

const css = readFileSync(join(__dirname, '../../styles/auth-account.css'), 'utf8');
const rule = (sel: string) =>
  css.match(new RegExp(`(^|\\n)${sel.replace(/\./g, '\\.')} \\{([^}]*)\\}`))?.[2] ?? '';

describe('ProviderRow — значок и пояснение единственного способа', () => {
  it.each([
    ['Google', GoogleIcon],
    ['Telegram', TelegramIcon],
    ['VK', VkIcon],
    ['MAX', MaxIcon],
  ])('плитка значка %s не сжимается (flexShrink: 0)', (_name, Icon) => {
    const { container } = render(<Icon />);
    expect((container.firstChild as HTMLElement).style.flexShrink).toBe('0');
  });

  it('пояснение «Единственный способ входа» переносится, а не режется', () => {
    render(
      <ProviderRow icon={<TelegramIcon />} title="Telegram" linked busy={false} onUnlink={() => {}} unlinkBlocked />,
    );
    const note = screen.getByText(ONLY_METHOD_NOTE);
    expect(note.className).toContain('aa-row-why');
    expect(rule('.aa-row-why')).toMatch(/white-space:\s*normal/);
  });

  it('текстовая колонка забирает свободное место и может сжиматься', () => {
    expect(rule('.aa-row-text')).toMatch(/flex:\s*1/);
    expect(rule('.aa-row-text')).toMatch(/min-width:\s*0/);
  });

  it('подпись почты без модификатора по-прежнему режется многоточием', () => {
    render(
      <ProviderRow icon={<GoogleIcon />} title="Google" subtitle="very.long.address@example.com" linked busy={false} />,
    );
    expect(screen.getByText('very.long.address@example.com').className).toBe('aa-row-sub');
  });
});
