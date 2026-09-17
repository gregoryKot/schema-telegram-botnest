// @vitest-environment jsdom
// TherapistInviteShare — кнопка «Поделиться» у ссылки-приглашения клиенту.
// Файл был на 0% покрытия. Ключевой инвариант: без inviteUrl кнопки нет
// вообще — терапевт не должен успеть поделиться пустой/битой ссылкой.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TherapistInviteShare } from './TherapistInviteShare';

afterEach(() => {
  cleanup();
});

function renderShare(inviteUrl: string) {
  return render(
    <MemoryRouter>
      <TherapistInviteShare inviteUrl={inviteUrl} />
    </MemoryRouter>,
  );
}

describe('TherapistInviteShare', () => {
  it('без inviteUrl не рендерит вообще ничего — нечем делиться', () => {
    const { container } = renderShare('');
    expect(container.textContent).toBe('');
  });

  it('с inviteUrl показывает кнопку «Поделиться»', () => {
    renderShare('https://schemehappens.ru/invite/abc');
    expect(screen.getByText('Поделиться')).toBeTruthy();
  });

  it('клик открывает шит приглашения клиенту с корректным заголовком', () => {
    renderShare('https://schemehappens.ru/invite/abc');
    fireEvent.click(screen.getByText('Поделиться'));
    expect(screen.getByText('Приглашение клиенту')).toBeTruthy();
  });
});
