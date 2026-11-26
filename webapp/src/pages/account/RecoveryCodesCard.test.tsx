// @vitest-environment jsdom
// QA 2026-11, М7: резервные коды назывались «Recovery-коды», объяснение
// говорило «вместо TOTP-кода», и скопировать коды можно было только руками.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { RecoveryCodesCard } from './RecoveryCodesCard';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('RecoveryCodesCard', () => {
  it('человеческие слова вместо жаргона', () => {
    render(<RecoveryCodesCard codes={['aaaa1111']} onDone={vi.fn()} />);
    expect(screen.getByText('Резервные коды')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Recovery|TOTP/);
  });

  it('«Скопировать коды» кладёт в буфер все коды построчно', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    render(<RecoveryCodesCard codes={['aaaa1111', 'bbbb2222']} onDone={vi.fn()} />);
    fireEvent.click(screen.getByText('Скопировать коды'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Скопировано' })).toBeTruthy());
    expect(writeText).toHaveBeenCalledWith('aaaa1111\nbbbb2222');
  });

  it('«Готово, коды сохранены» закрывает карточку', () => {
    const onDone = vi.fn();
    render(<RecoveryCodesCard codes={['aaaa1111']} onDone={onDone} />);
    fireEvent.click(screen.getByText('Готово, коды сохранены'));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
