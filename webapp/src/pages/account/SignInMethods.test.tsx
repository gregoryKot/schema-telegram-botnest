// @vitest-environment jsdom
// QA 2026-11, М2: «Отвязать» у единственного способа входа была активна —
// подтверждение, затем отказ сервера и общее «Не удалось отвязать».
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SignInMethods } from './SignInMethods';
import type { AccountProvider } from './ProviderRows';

afterEach(cleanup);

const p = (provider: AccountProvider['provider']): AccountProvider => ({ provider, email: null, displayName: null });

function renderMethods(providers: AccountProvider[]) {
  render(
    <SignInMethods
      providers={providers} loading={false} busy={false} accessToken="t"
      onLink={{ google: vi.fn(), telegram: vi.fn(), vk: vi.fn() }} onUnlink={vi.fn()} onError={vi.fn()}
    />,
  );
}

describe('SignInMethods — отвязка', () => {
  it('единственный способ: «Отвязать» недоступна и сказано почему', () => {
    renderMethods([p('google')]);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Отвязать' }).disabled).toBe(true);
    expect(screen.getByText(/Единственный способ входа/)).toBeTruthy();
  });

  it('два способа: обе «Отвязать» доступны, пояснения нет', () => {
    renderMethods([p('google'), p('telegram')]);
    const buttons = screen.getAllByRole<HTMLButtonElement>('button', { name: 'Отвязать' });
    expect(buttons).toHaveLength(2);
    expect(buttons.every((b) => !b.disabled)).toBe(true);
    expect(screen.queryByText(/Единственный способ входа/)).toBeNull();
  });
});
