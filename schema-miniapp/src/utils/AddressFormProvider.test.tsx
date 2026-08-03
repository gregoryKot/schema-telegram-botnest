// @vitest-environment jsdom
// AddressFormProvider — грузит форму обращения из настроек и раздаёт через
// контекст (0% покрытия). Read-after-write по смыслу: сохранённое в настройках
// значение обязано долететь до контекста и попасть к потребителю (useTr).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { AddressFormProvider } from './AddressFormProvider';
import { useTr } from './addressForm';
import { api } from '../api';

vi.mock('../api', () => ({ api: { getSettings: vi.fn() } }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});

function Consumer() {
  const tr = useTr();
  return <div>{tr('ты-вариант', 'вы-вариант')}</div>;
}

describe('AddressFormProvider', () => {
  it('дефолт до ответа сервера — «ты» (безопасный старт)', () => {
    vi.mocked(api.getSettings).mockReturnValue(new Promise(() => {}));
    render(
      <AddressFormProvider>
        <Consumer />
      </AddressFormProvider>,
    );
    expect(screen.getByText('ты-вариант')).toBeTruthy();
  });

  it("сервер вернул addressForm='vy' — контекст обновляется, потребитель видит «вы»", async () => {
    vi.mocked(api.getSettings).mockResolvedValue({
      addressForm: 'vy',
    } as never);
    render(
      <AddressFormProvider>
        <Consumer />
      </AddressFormProvider>,
    );
    await waitFor(() => expect(screen.getByText('вы-вариант')).toBeTruthy());
  });

  it('сервер недоступен — форма остаётся дефолтной, не падает', async () => {
    vi.mocked(api.getSettings).mockRejectedValue(new Error('offline'));
    render(
      <AddressFormProvider>
        <Consumer />
      </AddressFormProvider>,
    );
    await waitFor(() => expect(api.getSettings).toHaveBeenCalled());
    expect(screen.getByText('ты-вариант')).toBeTruthy();
  });
});
