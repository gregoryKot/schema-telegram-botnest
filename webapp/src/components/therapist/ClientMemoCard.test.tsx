// @vitest-environment jsdom
// «О клиенте»: заметка терапевта — сохранение, очистка, кризисная карточка, ошибка без потери текста.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('../../api', () => ({ api: { trackEvent: vi.fn() } }));
import { api, type TherapyClientSummary } from '../../api';
import { ClientMemoCard } from './ClientMemoCard';
import { describeCrisisField } from '../../test-support/crisisCardHarness';

afterEach(cleanup);

const clientWith = (memo: string | null) => ({ telegramId: 5, memo }) as unknown as TherapyClientSummary;
const setup = (memo: string | null, ok = true) => {
  const saveSessionInfo = vi.fn().mockResolvedValue(ok);
  render(<ClientMemoCard client={clientWith(memo)} detail={{ saveSessionInfo }} />);
  return { saveSessionInfo, field: screen.getByRole('textbox') as HTMLTextAreaElement, save: screen.getByRole('button', { name: 'Сохранить заметку' }) };
};

describe('ClientMemoCard', () => {
  it('показывает сохранённый текст; «Сохранить заметку» неактивна, пока текст не изменён', () => {
    const { field, save } = setup('любит рисовать');
    expect(field.value).toBe('любит рисовать');
    expect(save).toHaveProperty('disabled', true);
    fireEvent.change(field, { target: { value: 'любит рисовать и бегать' } });
    expect(save).toHaveProperty('disabled', false);
  });

  it('сохранение зовёт API с обрезанным текстом, шлёт событие без текста и пишет «Сохранено»', async () => {
    const { saveSessionInfo, field, save } = setup(null);
    fireEvent.change(field, { target: { value: '  боится опоздать ' } });
    fireEvent.click(save);
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Сохранено'));
    expect(saveSessionInfo).toHaveBeenCalledWith({ memo: 'боится опоздать' });
    expect(api.trackEvent).toHaveBeenCalledWith('cabinet_client_memo_saved', { length: 15, cleared: false });
  });

  it('пустой текст уходит как null', async () => {
    const { saveSessionInfo, field, save } = setup('старое');
    fireEvent.change(field, { target: { value: '   ' } });
    fireEvent.click(save);
    await waitFor(() => expect(saveSessionInfo).toHaveBeenCalledWith({ memo: null }));
    expect(api.trackEvent).toHaveBeenCalledWith('cabinet_client_memo_saved', { length: 0, cleared: true });
  });

  it('ошибка сохранения: текст остаётся, видна строка ошибки', async () => {
    const { field, save } = setup(null, false);
    fireEvent.change(field, { target: { value: 'важное' } });
    fireEvent.click(save);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Не удалось сохранить'));
    expect(field.value).toBe('важное');
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describeCrisisField('webapp/src/components/therapist/ClientMemoCard.tsx', {
  open: () => void setup(null),
  enter: (text) => fireEvent.change(screen.getByRole('textbox'), { target: { value: text } }),
});
